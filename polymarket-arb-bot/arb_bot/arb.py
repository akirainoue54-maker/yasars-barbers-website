"""Core arbitrage math: detect YES+NO < $1 opportunities with depth walking.

Pure functions only — no network I/O — so everything here is unit-testable.
"""

from __future__ import annotations

from dataclasses import dataclass

from .books import Level, OrderBook
from .fees import per_share_fee
from .markets import MarketInfo

_EPS = 1e-9


@dataclass(frozen=True)
class LegPlan:
    token_id: str
    outcome: str
    shares: float
    vwap: float        # average price actually walked
    cap_price: float   # worst level touched -> use as the limit price
    cost: float        # shares * vwap


@dataclass(frozen=True)
class Opportunity:
    market: MarketInfo
    leg_a: LegPlan     # first outcome (e.g. "Up")
    leg_b: LegPlan     # second outcome (e.g. "Down")
    shares: float
    outlay: float      # USDC spent on both legs (before fees)
    fees: float        # modeled taker fees, both legs
    profit: float      # shares * $1 - outlay - fees (locked at resolution)
    edge_per_share: float

    def describe(self) -> str:
        return (
            f"{self.market.question}: buy {self.shares:g} "
            f"{self.leg_a.outcome}@{self.leg_a.vwap:.4f} + "
            f"{self.leg_b.outcome}@{self.leg_b.vwap:.4f} "
            f"= {self.outlay / self.shares:.4f}/share, fees {self.fees:.4f}, "
            f"locked profit ${self.profit:.4f} ({self.edge_per_share * 100:.2f}c/share)"
        )


def _walk(
    asks_a: list[Level],
    asks_b: list[Level],
    fee_rate_bps: float,
    min_edge: float,
    max_outlay: float,
) -> list[tuple[float, float, float]]:
    """Greedily pair ask levels from both books while each marginal share
    still clears `min_edge` after fees. Both books ascend in price, so once
    the marginal pair is unprofitable every later pair is too.

    Returns [(price_a, price_b, shares), ...].
    """
    fills: list[tuple[float, float, float]] = []
    i = j = 0
    rem_a = asks_a[0].size if asks_a else 0.0
    rem_b = asks_b[0].size if asks_b else 0.0
    budget = max_outlay

    while i < len(asks_a) and j < len(asks_b) and budget > _EPS:
        pa, pb = asks_a[i].price, asks_b[j].price
        per_share_cost = pa + pb
        fee = per_share_fee(pa, fee_rate_bps) + per_share_fee(pb, fee_rate_bps)
        if 1.0 - per_share_cost - fee < min_edge - _EPS:
            break
        take = min(rem_a, rem_b, budget / per_share_cost)
        if take <= _EPS:
            break
        fills.append((pa, pb, take))
        budget -= take * per_share_cost
        rem_a -= take
        rem_b -= take
        if rem_a <= _EPS:
            i += 1
            rem_a = asks_a[i].size if i < len(asks_a) else 0.0
        if rem_b <= _EPS:
            j += 1
            rem_b = asks_b[j].size if j < len(asks_b) else 0.0
    return fills


def _trim(fills: list[tuple[float, float, float]], target: float) -> list[tuple[float, float, float]]:
    """Trim fills (from the worst levels backwards) so shares sum to `target`."""
    out: list[tuple[float, float, float]] = []
    remaining = target
    for pa, pb, sh in fills:
        take = min(sh, remaining)
        if take <= _EPS:
            break
        out.append((pa, pb, take))
        remaining -= take
    return out


def find_opportunity(
    market: MarketInfo,
    book_a: OrderBook,
    book_b: OrderBook,
    *,
    min_edge: float,
    max_outlay: float,
    fee_rate_bps: float | None = None,
    size_decimals: int = 2,
) -> Opportunity | None:
    """Find the largest profitable paired buy across both ask books.

    `max_outlay` should already reflect all portfolio-level limits
    (per-trade cap, remaining total exposure, cash on hand).
    """
    if max_outlay <= 0:
        return None
    bps = market.fee_rate_bps if fee_rate_bps is None else fee_rate_bps

    fills = _walk(book_a.asks, book_b.asks, bps, min_edge, max_outlay)
    if not fills:
        return None

    total = sum(sh for _, _, sh in fills)
    # Round the paired size down to a clean lot so both legs match exactly.
    factor = 10 ** size_decimals
    total = int(total * factor + _EPS) / factor
    if total <= 0 or total < market.min_order_size:
        return None
    fills = _trim(fills, total)

    cost_a = sum(pa * sh for pa, _, sh in fills)
    cost_b = sum(pb * sh for _, pb, sh in fills)
    fees = sum(
        (per_share_fee(pa, bps) + per_share_fee(pb, bps)) * sh for pa, pb, sh in fills
    )
    profit = total * 1.0 - cost_a - cost_b - fees
    if profit <= 0:
        return None

    leg_a = LegPlan(
        token_id=book_a.token_id,
        outcome=market.outcomes[0],
        shares=total,
        vwap=cost_a / total,
        cap_price=max(pa for pa, _, _ in fills),
        cost=cost_a,
    )
    leg_b = LegPlan(
        token_id=book_b.token_id,
        outcome=market.outcomes[1],
        shares=total,
        vwap=cost_b / total,
        cap_price=max(pb for _, pb, _ in fills),
        cost=cost_b,
    )
    return Opportunity(
        market=market,
        leg_a=leg_a,
        leg_b=leg_b,
        shares=total,
        outlay=cost_a + cost_b,
        fees=fees,
        profit=profit,
        edge_per_share=profit / total,
    )
