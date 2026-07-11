"""Execution types and the pure decision logic shared by paper/live brokers.

The IO-free functions here (repair pricing, unwind decisions) are what make
one-leg failures survivable; they are unit-tested in tests/test_execution.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .fees import per_share_fee, round_down_to_tick


@dataclass
class ExecutionResult:
    ok: bool
    paired_shares: float = 0.0        # shares held on BOTH legs (riskless)
    leg_a_filled: float = 0.0
    leg_b_filled: float = 0.0
    leg_a_cost: float = 0.0           # USDC spent
    leg_b_cost: float = 0.0
    fees: float = 0.0
    unwound_shares: float = 0.0
    unwind_pnl: float = 0.0
    locked_profit: float = 0.0        # guaranteed at resolution for paired part
    notes: list[str] = field(default_factory=list)

    @property
    def outlay(self) -> float:
        return self.leg_a_cost + self.leg_b_cost


def locked_profit(paired_shares: float, cost_a: float, cost_b: float, fees: float) -> float:
    """Profit locked by holding `paired_shares` of both outcomes to
    resolution: exactly one side pays $1/share."""
    return paired_shares * 1.0 - cost_a - cost_b - fees


def repair_cap_price(
    filled_vwap_other: float,
    *,
    fee_rate_bps: float,
    tick_size: float,
    min_locked_edge: float = 0.0,
) -> float:
    """Highest price we may pay to complete the missing leg while still
    locking at least `min_locked_edge` per share.

    The fee on the repair leg depends on its own price; we bound it by the
    worst case (price = 0.5) so the cap is always safe.
    """
    worst_case_fee = per_share_fee(0.5, fee_rate_bps)
    fee_other = per_share_fee(filled_vwap_other, fee_rate_bps)
    cap = 1.0 - filled_vwap_other - fee_other - worst_case_fee - min_locked_edge
    return max(0.0, round_down_to_tick(cap, tick_size))


def should_unwind(
    vwap_paid: float,
    best_bid: float | None,
    *,
    fee_rate_bps: float,
    max_loss_per_share: float,
) -> bool:
    """Sell an unpaired leg back only if the realized loss stays within the
    configured budget. Otherwise the caller holds the position (a directional
    bet, but with loss bounded by what was paid)."""
    if best_bid is None or best_bid <= 0:
        return False
    loss = vwap_paid - best_bid + per_share_fee(best_bid, fee_rate_bps)
    return loss <= max_loss_per_share
