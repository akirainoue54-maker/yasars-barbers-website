"""Live order execution via the official `py-clob-client`.

Flow per opportunity:
  1. Pre-sign both legs as Fill-And-Kill (FAK) limit buys at the cap prices
     the detector walked, then POST them concurrently.
  2. Compare filled sizes. If one leg lags, retry it (fresh book, capped at
     a price that still locks `repair_min_locked_edge`).
  3. If still unpaired, sell the excess back if the loss fits
     `max_unwind_loss_per_share`; otherwise hold and log loudly.

VALIDATE THIS FILE WITH TINY SIZES FIRST. Response field names are parsed
defensively but exchange APIs evolve; a $2 trial run costs less than a bug.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor

import requests

from .arb import Opportunity
from .config import Settings
from .execution import ExecutionResult, locked_profit, repair_cap_price, should_unwind
from .fees import round_down_to_tick, taker_fee_usdc
from .markets import fetch_books

log = logging.getLogger(__name__)

_EPS = 1e-6


def parse_fill(resp: dict, *, side: str) -> tuple[float, float]:
    """Extract (shares, usdc) filled from a post_order response.

    For BUY orders the maker asset is USDC and the taker asset is the
    outcome token; for SELL it is reversed.
    """
    if not resp or not resp.get("success", False):
        return 0.0, 0.0
    status = str(resp.get("status", "")).lower()
    if status in {"unmatched", "killed", "canceled", "cancelled"}:
        return 0.0, 0.0
    try:
        making = float(resp.get("makingAmount") or 0.0)
        taking = float(resp.get("takingAmount") or 0.0)
    except (TypeError, ValueError):
        return 0.0, 0.0
    if side == "BUY":
        return taking, making  # shares received, USDC spent
    return making, taking      # shares given, USDC received


class LiveBroker:
    name = "live"

    def __init__(self, settings: Settings, session: requests.Session):
        settings.validate_live()
        self.settings = settings
        self.session = session

        # Imported lazily so paper mode and the test suite never need the
        # dependency installed.
        from py_clob_client.client import ClobClient
        from py_clob_client.clob_types import OrderArgs, OrderType
        from py_clob_client.order_builder.constants import BUY, SELL

        self._OrderArgs = OrderArgs
        self._OrderType = OrderType
        self._BUY, self._SELL = BUY, SELL

        kwargs = dict(key=settings.private_key, chain_id=settings.chain_id)
        if settings.signature_type in (1, 2):
            kwargs.update(signature_type=settings.signature_type, funder=settings.funder)
        self.client = ClobClient(settings.clob_host, **kwargs)
        self.client.set_api_creds(self.client.create_or_derive_api_creds())
        log.info("live broker ready (signature_type=%s)", settings.signature_type)

    # -- low level ---------------------------------------------------------

    def _post_fak(self, token_id: str, price: float, size: float, side: str,
                  fee_rate_bps: float) -> dict:
        # Fee-enabled markets reject orders signed without the fee rate.
        args = self._OrderArgs(token_id=token_id, price=price, size=size, side=side,
                               fee_rate_bps=int(fee_rate_bps))
        try:
            signed = self.client.create_order(args)
            return self.client.post_order(signed, self._OrderType.FAK) or {}
        except Exception as exc:  # noqa: BLE001 - never let one leg's error kill the pair handling
            log.error("post_order failed (%s %s @ %s): %s", side, token_id[:12], price, exc)
            return {}

    def _buy(self, token_id: str, price: float, size: float,
             fee_rate_bps: float) -> tuple[float, float]:
        return parse_fill(self._post_fak(token_id, price, size, self._BUY, fee_rate_bps),
                          side="BUY")

    def _sell(self, token_id: str, price: float, size: float,
              fee_rate_bps: float) -> tuple[float, float]:
        return parse_fill(self._post_fak(token_id, price, size, self._SELL, fee_rate_bps),
                          side="SELL")

    def _best_bid_ask(self, token_id: str):
        book = fetch_books(self.session, self.settings.clob_host, [token_id]).get(token_id)
        if book is None:
            return None, None
        return book.best_bid, book.best_ask

    # -- pair execution ----------------------------------------------------

    def execute(self, opp: Opportunity) -> ExecutionResult:
        result = ExecutionResult(ok=False)
        market = opp.market

        with ThreadPoolExecutor(max_workers=2) as pool:
            fut_a = pool.submit(self._buy, opp.leg_a.token_id, opp.leg_a.cap_price,
                                opp.shares, market.fee_rate_bps)
            fut_b = pool.submit(self._buy, opp.leg_b.token_id, opp.leg_b.cap_price,
                                opp.shares, market.fee_rate_bps)
            a_shares, a_usdc = fut_a.result()
            b_shares, b_usdc = fut_b.result()

        result.leg_a_filled, result.leg_a_cost = a_shares, a_usdc
        result.leg_b_filled, result.leg_b_cost = b_shares, b_usdc

        # -- repair a lagging leg ------------------------------------------
        for _ in range(self.settings.repair_attempts):
            gap = result.leg_a_filled - result.leg_b_filled
            if abs(gap) <= _EPS:
                break
            if gap > 0:  # leg A over-filled -> buy more of leg B
                lag_leg, filled_cost, filled_shares = opp.leg_b, result.leg_a_cost, result.leg_a_filled
            else:
                lag_leg, filled_cost, filled_shares = opp.leg_a, result.leg_b_cost, result.leg_b_filled
            cap = repair_cap_price(
                filled_cost / filled_shares,
                fee_rate_bps=market.fee_rate_bps,
                tick_size=market.tick_size,
                min_locked_edge=self.settings.repair_min_locked_edge,
            )
            if cap <= 0:
                break
            _, ask = self._best_bid_ask(lag_leg.token_id)
            if ask is None or ask.price > cap + _EPS:
                continue  # too expensive right now; retry
            shares, usdc = self._buy(lag_leg.token_id, min(cap, ask.price), abs(gap),
                                     market.fee_rate_bps)
            if lag_leg is opp.leg_b:
                result.leg_b_filled += shares
                result.leg_b_cost += usdc
            else:
                result.leg_a_filled += shares
                result.leg_a_cost += usdc
            if shares > 0:
                result.notes.append(f"repaired {shares:g} shares of {lag_leg.outcome}")

        # -- unwind whatever is still unpaired -----------------------------
        gap = result.leg_a_filled - result.leg_b_filled
        if abs(gap) > _EPS:
            over_leg = opp.leg_a if gap > 0 else opp.leg_b
            over_filled = result.leg_a_filled if gap > 0 else result.leg_b_filled
            over_cost = result.leg_a_cost if gap > 0 else result.leg_b_cost
            vwap_paid = over_cost / over_filled if over_filled > 0 else 0.0
            bid, _ = self._best_bid_ask(over_leg.token_id)
            if bid is not None and should_unwind(
                vwap_paid,
                bid.price,
                fee_rate_bps=market.fee_rate_bps,
                max_loss_per_share=self.settings.max_unwind_loss_per_share,
            ):
                price = round_down_to_tick(bid.price, market.tick_size)
                sold, received = self._sell(over_leg.token_id, price, abs(gap),
                                            market.fee_rate_bps)
                result.unwound_shares = sold
                result.unwind_pnl = received - sold * vwap_paid
                if gap > 0:
                    result.leg_a_filled -= sold
                    result.leg_a_cost -= sold * vwap_paid
                else:
                    result.leg_b_filled -= sold
                    result.leg_b_cost -= sold * vwap_paid
                result.notes.append(
                    f"unwound {sold:g} {over_leg.outcome} (pnl {result.unwind_pnl:+.4f})"
                )
            elif abs(result.leg_a_filled - result.leg_b_filled) > _EPS:
                result.notes.append(
                    f"HOLDING UNPAIRED {abs(gap):g} {over_leg.outcome} shares — directional risk"
                )

        # -- bookkeeping ----------------------------------------------------
        result.paired_shares = min(result.leg_a_filled, result.leg_b_filled)
        bps = market.fee_rate_bps
        result.fees = self._estimate_fees(result.leg_a_filled, result.leg_a_cost, bps) + \
            self._estimate_fees(result.leg_b_filled, result.leg_b_cost, bps)
        if result.paired_shares > _EPS:
            result.locked_profit = locked_profit(
                result.paired_shares,
                result.leg_a_cost,
                result.leg_b_cost,
                result.fees,
            ) + result.unwind_pnl
        result.ok = result.paired_shares > _EPS or abs(gap) <= _EPS
        return result

    @staticmethod
    def _estimate_fees(shares: float, cost: float, fee_rate_bps: float) -> float:
        if shares <= 0:
            return 0.0
        return taker_fee_usdc(cost / shares, shares, fee_rate_bps)


def make_broker(settings: Settings, session: requests.Session):
    if settings.mode == "live":
        return LiveBroker(settings, session)
    from .paper import PaperBroker

    return PaperBroker()
