"""Market discovery (Gamma API) and order book fetching (CLOB API)."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import requests

from .books import OrderBook

log = logging.getLogger(__name__)

DEFAULT_MIN_ORDER_SIZE = 5.0
DEFAULT_TICK_SIZE = 0.01


@dataclass
class MarketInfo:
    id: str
    question: str
    condition_id: str
    slug: str
    end_date: datetime | None
    token_ids: list[str]           # [outcome_a, outcome_b] token ids
    outcomes: list[str]            # e.g. ["Up", "Down"] or ["Yes", "No"]
    neg_risk: bool = False
    min_order_size: float = DEFAULT_MIN_ORDER_SIZE
    tick_size: float = DEFAULT_TICK_SIZE
    fee_rate_bps: float = 0.0
    accepting_orders: bool = True
    extra: dict = field(default_factory=dict)


def _loads_maybe(value) -> list:
    """Gamma returns list fields (outcomes, clobTokenIds) as JSON strings."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return []
    return list(value) if isinstance(value, (list, tuple)) else []


def _parse_end_date(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def parse_gamma_market(raw: dict) -> MarketInfo | None:
    token_ids = [str(t) for t in _loads_maybe(raw.get("clobTokenIds"))]
    outcomes = [str(o) for o in _loads_maybe(raw.get("outcomes"))]
    if len(token_ids) != 2 or len(outcomes) != 2:
        return None  # not a two-outcome market we can pair
    return MarketInfo(
        id=str(raw.get("id", "")),
        question=str(raw.get("question", "")),
        condition_id=str(raw.get("conditionId", "")),
        slug=str(raw.get("slug", "")),
        end_date=_parse_end_date(raw.get("endDate")),
        token_ids=token_ids,
        outcomes=outcomes,
        neg_risk=bool(raw.get("negRisk", False)),
    )


def discover_markets(
    session: requests.Session,
    gamma_host: str,
    *,
    question_regex: str,
    lookahead_hours: float,
    limit: int = 500,
) -> list[MarketInfo]:
    """Fetch active two-outcome markets resolving within the lookahead window
    whose question matches the regex (default: Bitcoin Up or Down)."""
    now = datetime.now(timezone.utc)
    params = {
        "active": "true",
        "closed": "false",
        "limit": str(limit),
        "order": "endDate",
        "ascending": "true",
        "end_date_min": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end_date_max": (now + timedelta(hours=lookahead_hours)).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    resp = session.get(f"{gamma_host}/markets", params=params, timeout=15)
    resp.raise_for_status()
    pattern = re.compile(question_regex)
    markets = []
    for raw in resp.json():
        if not pattern.search(str(raw.get("question", ""))):
            continue
        info = parse_gamma_market(raw)
        if info is not None:
            markets.append(info)
    return markets


def enrich_from_clob(
    session: requests.Session,
    clob_host: str,
    market: MarketInfo,
    *,
    fee_rate_bps_fallback: float = 0.0,
) -> MarketInfo:
    """Pull min order size, tick size, fee rate and order-acceptance status
    from the CLOB. Field names are probed defensively; on any failure the
    conservative defaults stand."""
    market.fee_rate_bps = fee_rate_bps_fallback
    try:
        resp = session.get(f"{clob_host}/markets/{market.condition_id}", timeout=15)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as exc:  # noqa: BLE001 - network robustness
        log.warning("CLOB enrich failed for %s: %s", market.question, exc)
        return market

    market.min_order_size = float(raw.get("minimum_order_size") or market.min_order_size)
    market.tick_size = float(raw.get("minimum_tick_size") or market.tick_size)
    market.neg_risk = bool(raw.get("neg_risk", market.neg_risk))
    market.accepting_orders = bool(raw.get("accepting_orders", True))
    for key in ("taker_base_fee", "fee_rate_bps", "taker_fee_bps"):
        if raw.get(key) is not None:
            try:
                market.fee_rate_bps = float(raw[key])
                break
            except (TypeError, ValueError):
                pass
    market.extra = {"clob": {k: raw.get(k) for k in ("active", "closed", "accepting_orders")}}
    return market


def fetch_books(
    session: requests.Session,
    clob_host: str,
    token_ids: list[str],
) -> dict[str, OrderBook]:
    """Fetch order books for many tokens in one round trip (POST /books),
    falling back to per-token GET /book."""
    if not token_ids:
        return {}
    try:
        resp = session.post(
            f"{clob_host}/books",
            json=[{"token_id": t} for t in token_ids],
            timeout=15,
        )
        resp.raise_for_status()
        books = {}
        for raw in resp.json():
            book = OrderBook.from_clob(raw)
            if book.token_id:
                books[book.token_id] = book
        if books:
            return books
    except Exception as exc:  # noqa: BLE001
        log.warning("batch /books failed (%s); falling back to per-token GET", exc)

    books = {}
    for token_id in token_ids:
        try:
            resp = session.get(f"{clob_host}/book", params={"token_id": token_id}, timeout=15)
            resp.raise_for_status()
            raw = resp.json()
            raw.setdefault("asset_id", token_id)
            books[token_id] = OrderBook.from_clob(raw)
        except Exception as exc:  # noqa: BLE001
            log.warning("book fetch failed for token %s…: %s", token_id[:12], exc)
    return books
