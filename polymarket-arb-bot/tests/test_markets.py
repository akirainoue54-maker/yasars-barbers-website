import json

from arb_bot.books import OrderBook
from arb_bot.markets import parse_gamma_market

# Shape mirrors the Gamma API: list-ish fields arrive as JSON *strings*.
GAMMA_FIXTURE = {
    "id": "253591",
    "question": "Bitcoin Up or Down - July 11, 3PM ET",
    "conditionId": "0x00265fd90c1c9dca9e19d6ab88fe17b829b46bb85e33ee9dc27bfebcf5e279a5",
    "slug": "bitcoin-up-or-down-july-11-3pm-et",
    "endDate": "2026-07-11T19:00:00Z",
    "active": True,
    "closed": False,
    "clobTokenIds": json.dumps(["111222333", "444555666"]),
    "outcomes": json.dumps(["Up", "Down"]),
    "negRisk": False,
}


def test_parse_gamma_market():
    m = parse_gamma_market(GAMMA_FIXTURE)
    assert m is not None
    assert m.token_ids == ["111222333", "444555666"]
    assert m.outcomes == ["Up", "Down"]
    assert m.condition_id.startswith("0x00265")
    assert m.end_date is not None and m.end_date.tzinfo is not None


def test_parse_gamma_market_with_real_lists():
    raw = dict(GAMMA_FIXTURE, clobTokenIds=["1", "2"], outcomes=["Yes", "No"])
    m = parse_gamma_market(raw)
    assert m is not None
    assert m.token_ids == ["1", "2"]


def test_parse_gamma_market_rejects_non_binary():
    raw = dict(GAMMA_FIXTURE, outcomes=json.dumps(["A", "B", "C"]))
    assert parse_gamma_market(raw) is None
    raw = dict(GAMMA_FIXTURE, clobTokenIds="not json {")
    assert parse_gamma_market(raw) is None


def test_orderbook_parses_strings_and_sorts():
    raw = {
        "asset_id": "111222333",
        "bids": [{"price": "0.46", "size": "10"}, {"price": "0.47", "size": "5"}],
        "asks": [{"price": "0.50", "size": "20"}, {"price": "0.48", "size": "7"},
                 {"price": "0.49", "size": "0"}],  # zero-size levels dropped
    }
    book = OrderBook.from_clob(raw)
    assert book.token_id == "111222333"
    assert book.best_bid.price == 0.47
    assert book.best_ask.price == 0.48
    assert [l.price for l in book.asks] == [0.48, 0.50]


def test_orderbook_empty():
    book = OrderBook.from_clob({"asset_id": "x"})
    assert book.best_bid is None and book.best_ask is None
