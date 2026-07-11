"""Paper trading broker: simulates fills against the order book snapshot the
opportunity was computed from.

This is optimistic — it assumes the displayed liquidity is still there and
that nobody beats you to it. Real fills will be strictly worse; treat paper
results as an upper bound, not a forecast.
"""

from __future__ import annotations

from .arb import Opportunity
from .execution import ExecutionResult, locked_profit


class PaperBroker:
    name = "paper"

    def execute(self, opp: Opportunity) -> ExecutionResult:
        result = ExecutionResult(
            ok=True,
            paired_shares=opp.shares,
            leg_a_filled=opp.shares,
            leg_b_filled=opp.shares,
            leg_a_cost=opp.leg_a.cost,
            leg_b_cost=opp.leg_b.cost,
            fees=opp.fees,
        )
        result.locked_profit = locked_profit(
            result.paired_shares, result.leg_a_cost, result.leg_b_cost, result.fees
        )
        result.notes.append("paper fill at snapshot prices (optimistic)")
        return result
