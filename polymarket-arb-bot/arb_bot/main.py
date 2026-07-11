"""CLI entry point.

    python -m arb_bot scan          one-shot scan: print books + opportunities
    python -m arb_bot run           continuous loop (paper trading by default)
    python -m arb_bot run --live    real orders; also needs PM_MODE/PM_LIVE_ACK etc.
"""

from __future__ import annotations

import argparse
import dataclasses
import logging
import time

import requests

from .arb import find_opportunity
from .config import Settings, load_env_file
from .executor import make_broker
from .markets import MarketInfo, discover_markets, enrich_from_clob, fetch_books
from .state import ExposureTracker, TradeLog

log = logging.getLogger("arb_bot")


def _refresh_markets(session: requests.Session, settings: Settings) -> list[MarketInfo]:
    markets = discover_markets(
        session,
        settings.gamma_host,
        question_regex=settings.market_question_regex,
        lookahead_hours=settings.lookahead_hours,
    )
    markets = [
        enrich_from_clob(
            session, settings.clob_host, m,
            fee_rate_bps_fallback=settings.fee_rate_bps_fallback,
        )
        for m in markets
    ]
    markets = [m for m in markets if m.accepting_orders]
    log.info("tracking %d markets", len(markets))
    for m in markets:
        log.info("  %s (ends %s, fee %.0fbps, min %g, tick %g)",
                 m.question, m.end_date, m.fee_rate_bps, m.min_order_size, m.tick_size)
    return markets


def _scan_once(session, settings, markets, exposure) -> list:
    """Fetch all books in one round trip and return opportunities."""
    token_ids = [t for m in markets for t in m.token_ids]
    books = fetch_books(session, settings.clob_host, token_ids)
    opportunities = []
    for m in markets:
        book_a, book_b = books.get(m.token_ids[0]), books.get(m.token_ids[1])
        if not book_a or not book_b:
            continue
        max_outlay = min(settings.max_usdc_per_trade, exposure.headroom())
        opp = find_opportunity(
            m, book_a, book_b,
            min_edge=settings.min_edge,
            max_outlay=max_outlay,
        )
        if opp:
            opportunities.append(opp)
        elif book_a.best_ask and book_b.best_ask:
            log.debug("%s: ask sum %.4f (no edge)",
                      m.question, book_a.best_ask.price + book_b.best_ask.price)
    return opportunities


def cmd_scan(settings: Settings) -> int:
    session = requests.Session()
    markets = _refresh_markets(session, settings)
    if not markets:
        log.warning("no markets matched %r in the next %.1fh",
                    settings.market_question_regex, settings.lookahead_hours)
        return 1
    exposure = ExposureTracker(max_total=settings.max_total_exposure_usdc)
    token_ids = [t for m in markets for t in m.token_ids]
    books = fetch_books(session, settings.clob_host, token_ids)
    found = 0
    for m in markets:
        book_a, book_b = books.get(m.token_ids[0]), books.get(m.token_ids[1])
        if not book_a or not book_b or not book_a.best_ask or not book_b.best_ask:
            print(f"[--] {m.question}: book unavailable")
            continue
        ask_sum = book_a.best_ask.price + book_b.best_ask.price
        opp = find_opportunity(
            m, book_a, book_b,
            min_edge=settings.min_edge,
            max_outlay=min(settings.max_usdc_per_trade, exposure.headroom()),
        )
        if opp:
            found += 1
            print(f"[GO] {opp.describe()}")
        else:
            print(f"[--] {m.question}: {m.outcomes[0]} {book_a.best_ask.price:.3f} + "
                  f"{m.outcomes[1]} {book_b.best_ask.price:.3f} = {ask_sum:.3f}")
    print(f"\n{found} opportunit{'y' if found == 1 else 'ies'} at min_edge={settings.min_edge}")
    return 0


def cmd_run(settings: Settings) -> int:
    session = requests.Session()
    broker = make_broker(settings, session)
    trade_log = TradeLog(settings.data_dir / f"{broker.name}_trades.jsonl")
    exposure = ExposureTracker(max_total=settings.max_total_exposure_usdc)

    markets: list[MarketInfo] = []
    last_refresh = 0.0
    last_trade_at: dict[str, float] = {}
    stats = {"scans": 0, "opportunities": 0, "trades": 0, "locked_profit": 0.0}
    last_report = time.time()

    log.info("mode=%s | min_edge=%s | per-trade cap $%s | exposure cap $%s",
             broker.name, settings.min_edge,
             settings.max_usdc_per_trade, settings.max_total_exposure_usdc)
    if broker.name == "live":
        log.warning("LIVE TRADING ENABLED — real orders will be placed")

    try:
        while True:
            now = time.time()
            if now - last_refresh > settings.market_refresh_s:
                try:
                    markets = _refresh_markets(session, settings)
                except Exception as exc:  # noqa: BLE001
                    log.error("market refresh failed: %s", exc)
                last_refresh = now
            exposure.release_expired()

            if markets:
                stats["scans"] += 1
                try:
                    opportunities = _scan_once(session, settings, markets, exposure)
                except Exception as exc:  # noqa: BLE001
                    log.error("scan failed: %s", exc)
                    opportunities = []
                for opp in opportunities:
                    market_id = opp.market.id
                    if now - last_trade_at.get(market_id, 0) < settings.per_market_cooldown_s:
                        continue
                    stats["opportunities"] += 1
                    log.info("OPPORTUNITY %s", opp.describe())
                    result = broker.execute(opp)
                    last_trade_at[market_id] = time.time()
                    trade_log.append({
                        "mode": broker.name,
                        "market": opp.market.question,
                        "market_id": market_id,
                        "planned": opp.__dict__ | {"market": opp.market.question,
                                                   "leg_a": opp.leg_a.__dict__,
                                                   "leg_b": opp.leg_b.__dict__},
                        "result": result.__dict__,
                    })
                    if result.ok and result.paired_shares > 0:
                        stats["trades"] += 1
                        stats["locked_profit"] += result.locked_profit
                        exposure.add(market_id, result.outlay, opp.market.end_date)
                        log.info("FILLED %g pairs, locked $%.4f (total $%.4f, exposure $%.2f)",
                                 result.paired_shares, result.locked_profit,
                                 stats["locked_profit"], exposure.total)
                    for note in result.notes:
                        log.info("  note: %s", note)

            if time.time() - last_report > 60:
                log.info("heartbeat: %(scans)d scans, %(opportunities)d opps, "
                         "%(trades)d trades, $%(locked_profit).4f locked", stats)
                last_report = time.time()
            time.sleep(settings.scan_interval_s)
    except KeyboardInterrupt:
        log.info("stopped: %(scans)d scans, %(opportunities)d opps, "
                 "%(trades)d trades, $%(locked_profit).4f locked", stats)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="arb_bot", description=__doc__)
    parser.add_argument("command", choices=["scan", "run"])
    parser.add_argument("--live", action="store_true",
                        help="enable live trading (still requires PM_LIVE_ACK)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    load_env_file()
    settings = Settings.from_env()
    if args.live:
        settings = dataclasses.replace(settings, mode="live")
    if settings.mode == "live":
        try:
            settings.validate_live()
        except RuntimeError as exc:
            print(f"error: {exc}")
            return 2

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
    )
    if args.command == "scan":
        return cmd_scan(settings)
    return cmd_run(settings)


if __name__ == "__main__":
    raise SystemExit(main())
