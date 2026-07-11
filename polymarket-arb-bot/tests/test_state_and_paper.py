import json
from datetime import datetime, timedelta, timezone

import pytest

from arb_bot.arb import find_opportunity
from arb_bot.books import Level, OrderBook
from arb_bot.markets import MarketInfo
from arb_bot.paper import PaperBroker
from arb_bot.state import ExposureTracker, TradeLog


def test_exposure_tracker_caps_and_releases():
    now = 1_000_000.0
    tracker = ExposureTracker(max_total=100.0, resolution_buffer_s=300)
    end = datetime.fromtimestamp(now + 600, tz=timezone.utc)
    tracker.add("m1", 60.0, end)
    assert tracker.headroom() == pytest.approx(40.0)
    tracker.add("m1", 10.0, end)
    assert tracker.total == pytest.approx(70.0)

    # Before end + buffer nothing is released...
    tracker.release_expired(now + 800)
    assert tracker.total == pytest.approx(70.0)
    # ...after it, capital is recycled.
    tracker.release_expired(now + 1000)
    assert tracker.total == 0.0
    assert tracker.headroom() == pytest.approx(100.0)


def test_trade_log_appends_jsonl(tmp_path):
    log = TradeLog(tmp_path / "sub" / "trades.jsonl")
    log.append({"a": 1})
    log.append({"b": 2})
    lines = (tmp_path / "sub" / "trades.jsonl").read_text().strip().splitlines()
    assert len(lines) == 2
    assert json.loads(lines[0])["a"] == 1
    assert "ts" in json.loads(lines[1])


def test_paper_broker_locks_expected_profit():
    market = MarketInfo(
        id="1", question="Bitcoin Up or Down", condition_id="0x1", slug="s",
        end_date=datetime.now(timezone.utc) + timedelta(hours=1),
        token_ids=["A", "B"], outcomes=["Up", "Down"], fee_rate_bps=0.0,
    )
    up = OrderBook("A", asks=[Level(0.48, 100)])
    down = OrderBook("B", asks=[Level(0.49, 100)])
    opp = find_opportunity(market, up, down, min_edge=0.01, max_outlay=50)
    assert opp is not None
    result = PaperBroker().execute(opp)
    assert result.ok
    assert result.paired_shares == opp.shares
    assert result.locked_profit == pytest.approx(opp.profit)
    # ~51.5 pairs affordable with $50; profit = shares * 3c
    assert result.locked_profit == pytest.approx(result.paired_shares * 0.03)
