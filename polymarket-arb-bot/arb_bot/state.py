"""Trade logging and exposure tracking."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


class TradeLog:
    """Append-only JSONL log of every executed (or attempted) trade."""

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, record: dict) -> None:
        record = {"ts": datetime.now(timezone.utc).isoformat(), **record}
        with self.path.open("a") as f:
            f.write(json.dumps(record, default=str) + "\n")


@dataclass
class _OpenPosition:
    outlay: float
    end_ts: float  # unix time after which capital is assumed recyclable


@dataclass
class ExposureTracker:
    """Caps total USDC parked in unresolved paired positions.

    A fully paired position is riskless but its capital is locked until the
    market resolves (and, live, until winnings are redeemed) — so we still
    cap it. Exposure is released once a market's end time passes, plus a
    small buffer for resolution.
    """

    max_total: float
    resolution_buffer_s: float = 300.0
    _open: dict[str, _OpenPosition] = field(default_factory=dict)

    def release_expired(self, now: float | None = None) -> None:
        now = time.time() if now is None else now
        expired = [k for k, p in self._open.items() if p.end_ts + self.resolution_buffer_s < now]
        for k in expired:
            del self._open[k]

    @property
    def total(self) -> float:
        return sum(p.outlay for p in self._open.values())

    def headroom(self) -> float:
        return max(0.0, self.max_total - self.total)

    def add(self, market_id: str, outlay: float, end_date: datetime | None) -> None:
        end_ts = end_date.timestamp() if end_date else time.time() + 3600
        pos = self._open.get(market_id)
        if pos:
            pos.outlay += outlay
            pos.end_ts = max(pos.end_ts, end_ts)
        else:
            self._open[market_id] = _OpenPosition(outlay=outlay, end_ts=end_ts)
