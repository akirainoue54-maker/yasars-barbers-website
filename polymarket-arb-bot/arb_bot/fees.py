"""Polymarket fee model.

Polymarket's documented taker fee formula is proportional to how close the
price is to the extremes:

    fee = base_rate_bps / 10_000 * min(price, 1 - price) * shares

Fees are charged in the asset you receive (shares on buys, USDC on sells);
we model both as their USDC value, which is exact for sells and a
value-equivalent (slightly conservative) approximation for buys.

Most Polymarket markets have historically been fee-free, but the short-term
crypto "Up or Down" markets are exactly where taker fees have been switched
on. The bot reads per-market fee rates from the CLOB API when available and
falls back to `fee_rate_bps_fallback` otherwise — verify the real fee before
trading live, because a 1-2c gross edge dies quickly to fees.
"""

from __future__ import annotations


def taker_fee_usdc(price: float, shares: float, fee_rate_bps: float) -> float:
    """USDC-value fee for taking `shares` at `price`."""
    if fee_rate_bps <= 0 or shares <= 0:
        return 0.0
    return fee_rate_bps / 10_000.0 * min(price, 1.0 - price) * shares


def per_share_fee(price: float, fee_rate_bps: float) -> float:
    return taker_fee_usdc(price, 1.0, fee_rate_bps)


def round_down_to_tick(price: float, tick: float) -> float:
    """Round a price down to the market's tick grid (e.g. 0.01 or 0.001)."""
    if tick <= 0:
        return price
    steps = int(price / tick + 1e-9)
    return round(steps * tick, 6)
