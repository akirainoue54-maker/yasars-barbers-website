"""Order book model + parsing for the Polymarket CLOB REST shapes."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Level:
    price: float
    size: float


@dataclass
class OrderBook:
    token_id: str
    bids: list[Level] = field(default_factory=list)  # best (highest) first
    asks: list[Level] = field(default_factory=list)  # best (lowest) first

    @classmethod
    def from_clob(cls, raw: dict) -> "OrderBook":
        """Parse a CLOB `/book` (or `/books` element) response. Prices and
        sizes arrive as strings; sort order is not relied upon."""
        token_id = str(raw.get("asset_id") or raw.get("token_id") or "")
        bids = [Level(float(l["price"]), float(l["size"])) for l in raw.get("bids") or []]
        asks = [Level(float(l["price"]), float(l["size"])) for l in raw.get("asks") or []]
        bids = [l for l in bids if l.size > 0]
        asks = [l for l in asks if l.size > 0]
        bids.sort(key=lambda l: l.price, reverse=True)
        asks.sort(key=lambda l: l.price)
        return cls(token_id=token_id, bids=bids, asks=asks)

    @property
    def best_bid(self) -> Level | None:
        return self.bids[0] if self.bids else None

    @property
    def best_ask(self) -> Level | None:
        return self.asks[0] if self.asks else None
