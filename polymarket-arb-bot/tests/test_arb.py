from datetime import datetime, timezone

import pytest

from arb_bot.arb import find_opportunity
from arb_bot.books import Level, OrderBook
from arb_bot.markets import MarketInfo


def make_market(fee_bps=0.0, min_order=5.0):
    return MarketInfo(
        id="1",
        question="Bitcoin Up or Down - July 11, 3PM ET",
        condition_id="0xabc",
        slug="bitcoin-up-or-down",
        end_date=datetime(2026, 7, 11, 19, tzinfo=timezone.utc),
        token_ids=["tokUP", "tokDOWN"],
        outcomes=["Up", "Down"],
        fee_rate_bps=fee_bps,
        min_order_size=min_order,
    )


def book(token, asks, bids=()):
    return OrderBook(
        token_id=token,
        asks=[Level(p, s) for p, s in asks],
        bids=[Level(p, s) for p, s in bids],
    )


def test_simple_top_of_book_arb():
    # The canonical example: 0.48 + 0.49 = 0.97 -> 3c gross edge.
    up = book("tokUP", [(0.48, 100)])
    down = book("tokDOWN", [(0.49, 100)])
    opp = find_opportunity(make_market(), up, down, min_edge=0.01, max_outlay=1000)
    assert opp is not None
    assert opp.shares == 100
    assert opp.outlay == pytest.approx(97.0)
    assert opp.profit == pytest.approx(3.0)
    assert opp.edge_per_share == pytest.approx(0.03)
    assert opp.leg_a.cap_price == 0.48
    assert opp.leg_b.cap_price == 0.49


def test_no_arb_when_sum_at_or_above_one():
    up = book("tokUP", [(0.50, 100)])
    down = book("tokDOWN", [(0.50, 100)])
    assert find_opportunity(make_market(), up, down, min_edge=0.005, max_outlay=1000) is None


def test_min_edge_respected():
    # 0.495 + 0.50 = 0.995 -> only 0.5c edge; require 1c.
    up = book("tokUP", [(0.495, 100)])
    down = book("tokDOWN", [(0.50, 100)])
    assert find_opportunity(make_market(), up, down, min_edge=0.01, max_outlay=1000) is None
    opp = find_opportunity(make_market(), up, down, min_edge=0.005, max_outlay=1000)
    assert opp is not None


def test_depth_walk_stops_at_unprofitable_level():
    up = book("tokUP", [(0.47, 50), (0.50, 200)])
    down = book("tokDOWN", [(0.49, 50), (0.51, 200)])
    opp = find_opportunity(make_market(), up, down, min_edge=0.01, max_outlay=1000)
    # Level 2 pair costs 0.50+0.51 > 1, must stop after the first 50 shares.
    assert opp is not None
    assert opp.shares == 50
    assert opp.profit == pytest.approx(50 * (1 - 0.96))


def test_depth_walk_mixes_levels_asymmetrically():
    # UP has 30 at 0.46 then plenty at 0.48; DOWN has 100 at 0.50.
    up = book("tokUP", [(0.46, 30), (0.48, 100)])
    down = book("tokDOWN", [(0.50, 100)])
    opp = find_opportunity(make_market(), up, down, min_edge=0.01, max_outlay=1000)
    assert opp is not None
    # 30 pairs at 0.96, then 70 pairs at 0.98 -> all still >= 1c edge.
    assert opp.shares == 100
    assert opp.profit == pytest.approx(30 * 0.04 + 70 * 0.02)
    assert opp.leg_a.cap_price == 0.48
    assert opp.leg_b.cap_price == 0.50


def test_max_outlay_caps_size():
    up = book("tokUP", [(0.48, 1000)])
    down = book("tokDOWN", [(0.49, 1000)])
    opp = find_opportunity(make_market(), up, down, min_edge=0.01, max_outlay=9.70)
    assert opp is not None
    assert opp.shares == pytest.approx(10.0)
    assert opp.outlay <= 9.70 + 1e-9


def test_min_order_size_blocks_dust():
    up = book("tokUP", [(0.48, 3)])
    down = book("tokDOWN", [(0.49, 3)])
    assert find_opportunity(make_market(min_order=5), up, down,
                            min_edge=0.01, max_outlay=1000) is None


def test_fees_kill_marginal_arb():
    # Gross edge 2c; 200bps fee at ~0.5 costs ~1c/share/leg -> ~2c total. Dead.
    up = book("tokUP", [(0.49, 100)])
    down = book("tokDOWN", [(0.49, 100)])
    assert find_opportunity(make_market(fee_bps=200), up, down,
                            min_edge=0.01, max_outlay=1000) is None
    # Fee-free it's fine.
    opp = find_opportunity(make_market(fee_bps=0), up, down,
                           min_edge=0.01, max_outlay=1000)
    assert opp is not None


def test_fees_reduce_but_dont_kill_big_edge():
    up = book("tokUP", [(0.45, 100)])
    down = book("tokDOWN", [(0.48, 100)])
    fee_free = find_opportunity(make_market(fee_bps=0), up, down,
                                min_edge=0.01, max_outlay=1000)
    with_fee = find_opportunity(make_market(fee_bps=100), up, down,
                                min_edge=0.01, max_outlay=1000)
    assert fee_free is not None and with_fee is not None
    assert with_fee.profit < fee_free.profit
    # fee = 1% * (min(0.45,0.55) + min(0.48,0.52)) * 100 shares
    assert with_fee.fees == pytest.approx(0.01 * (0.45 + 0.48) * 100)


def test_empty_books():
    market = make_market()
    assert find_opportunity(market, book("tokUP", []), book("tokDOWN", [(0.4, 10)]),
                            min_edge=0.01, max_outlay=100) is None
    assert find_opportunity(market, book("tokUP", [(0.4, 10)]), book("tokDOWN", []),
                            min_edge=0.01, max_outlay=100) is None


def test_zero_outlay():
    up = book("tokUP", [(0.48, 100)])
    down = book("tokDOWN", [(0.49, 100)])
    assert find_opportunity(make_market(), up, down, min_edge=0.01, max_outlay=0) is None
