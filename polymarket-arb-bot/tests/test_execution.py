import pytest

from arb_bot.execution import locked_profit, repair_cap_price, should_unwind
from arb_bot.executor import parse_fill


def test_locked_profit():
    # 100 pairs at 0.48+0.49, no fees -> $3.
    assert locked_profit(100, 48.0, 49.0, 0.0) == pytest.approx(3.0)
    assert locked_profit(100, 48.0, 49.0, 1.0) == pytest.approx(2.0)


def test_repair_cap_price_no_fees():
    # Other leg filled at 0.48; break-even cap for the missing leg is 0.52.
    cap = repair_cap_price(0.48, fee_rate_bps=0, tick_size=0.01, min_locked_edge=0.0)
    assert cap == pytest.approx(0.52)
    # Requiring 1c locked edge lowers the cap to 0.51.
    cap = repair_cap_price(0.48, fee_rate_bps=0, tick_size=0.01, min_locked_edge=0.01)
    assert cap == pytest.approx(0.51)


def test_repair_cap_price_with_fees_is_conservative():
    cap_free = repair_cap_price(0.48, fee_rate_bps=0, tick_size=0.001)
    cap_fee = repair_cap_price(0.48, fee_rate_bps=200, tick_size=0.001)
    assert cap_fee < cap_free
    # 200bps: fee(0.48) = 0.0096, worst-case repair fee = 0.01
    assert cap_fee == pytest.approx(1 - 0.48 - 0.0096 - 0.01, abs=0.001)


def test_repair_cap_never_negative():
    assert repair_cap_price(0.999, fee_rate_bps=500, tick_size=0.01) == 0.0


def test_should_unwind_within_budget():
    # Paid 0.48, bid at 0.47 -> 1c loss, within the 2c budget.
    assert should_unwind(0.48, 0.47, fee_rate_bps=0, max_loss_per_share=0.02)
    # Bid at 0.45 -> 3c loss, exceeds budget -> hold.
    assert not should_unwind(0.48, 0.45, fee_rate_bps=0, max_loss_per_share=0.02)


def test_should_unwind_accounts_for_sell_fee():
    # 1.5c raw loss + fee pushes past a 2c budget at 200bps.
    raw_ok = should_unwind(0.485, 0.47, fee_rate_bps=0, max_loss_per_share=0.02)
    with_fee = should_unwind(0.485, 0.47, fee_rate_bps=200, max_loss_per_share=0.02)
    assert raw_ok and not with_fee


def test_should_unwind_no_bid():
    assert not should_unwind(0.48, None, fee_rate_bps=0, max_loss_per_share=0.02)


def test_parse_fill_buy():
    resp = {"success": True, "status": "matched",
            "makingAmount": "9.70", "takingAmount": "20"}
    shares, usdc = parse_fill(resp, side="BUY")
    assert shares == pytest.approx(20.0)
    assert usdc == pytest.approx(9.70)


def test_parse_fill_sell():
    resp = {"success": True, "status": "matched",
            "makingAmount": "20", "takingAmount": "9.40"}
    shares, usdc = parse_fill(resp, side="SELL")
    assert shares == pytest.approx(20.0)
    assert usdc == pytest.approx(9.40)


def test_parse_fill_failures():
    assert parse_fill({}, side="BUY") == (0.0, 0.0)
    assert parse_fill({"success": False}, side="BUY") == (0.0, 0.0)
    assert parse_fill({"success": True, "status": "unmatched"}, side="BUY") == (0.0, 0.0)
    assert parse_fill({"success": True, "status": "matched",
                       "makingAmount": "garbage"}, side="BUY") == (0.0, 0.0)
