import pytest

from arb_bot.fees import per_share_fee, round_down_to_tick, taker_fee_usdc


def test_fee_formula_symmetric_around_half():
    assert taker_fee_usdc(0.30, 100, 200) == pytest.approx(taker_fee_usdc(0.70, 100, 200))


def test_fee_formula_values():
    # 200bps * min(0.4, 0.6) * 50 shares = 0.02 * 0.4 * 50 = 0.40
    assert taker_fee_usdc(0.40, 50, 200) == pytest.approx(0.40)
    assert per_share_fee(0.50, 100) == pytest.approx(0.005)


def test_zero_fee():
    assert taker_fee_usdc(0.48, 100, 0) == 0.0
    assert taker_fee_usdc(0.48, 0, 200) == 0.0


def test_round_down_to_tick():
    assert round_down_to_tick(0.4899, 0.01) == pytest.approx(0.48)
    assert round_down_to_tick(0.48, 0.01) == pytest.approx(0.48)
    assert round_down_to_tick(0.4899, 0.001) == pytest.approx(0.489)
    assert round_down_to_tick(0.5, 0) == 0.5
