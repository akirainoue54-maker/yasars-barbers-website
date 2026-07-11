"""Configuration for the Polymarket YES+NO < $1 arbitrage bot.

Everything is driven by environment variables (optionally loaded from a
`.env` file) so no secrets ever live in the repo. See `.env.example`.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def load_env_file(path: str | Path = ".env") -> None:
    """Minimal .env loader (KEY=VALUE lines, '#' comments). Existing
    environment variables always win over file values."""
    p = Path(path)
    if not p.is_file():
        return
    for raw in p.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def _f(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


def _i(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def _s(name: str, default: str) -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class Settings:
    # --- endpoints ---
    gamma_host: str = "https://gamma-api.polymarket.com"
    clob_host: str = "https://clob.polymarket.com"
    chain_id: int = 137  # Polygon

    # --- market discovery ---
    # Default targets the hourly "Bitcoin Up or Down" markets.
    market_question_regex: str = r"(?i)^(bitcoin|btc)\b.*\bup or down\b"
    lookahead_hours: float = 2.0     # only markets resolving within this window
    market_refresh_s: float = 60.0   # how often to re-discover markets

    # --- strategy ---
    scan_interval_s: float = 1.0
    # Required profit per share AFTER modeled fees. Keep a buffer: anything
    # the fee model misses (rounding, fee changes) eats into this.
    min_edge: float = 0.01
    # Used when the CLOB API does not report a fee for a market. Up/Down
    # crypto markets have carried taker fees; verify before going live.
    fee_rate_bps_fallback: float = 0.0

    # --- risk limits ---
    max_usdc_per_trade: float = 25.0
    max_total_exposure_usdc: float = 100.0
    per_market_cooldown_s: float = 5.0
    # One-leg repair behaviour (live mode):
    repair_attempts: int = 3
    repair_min_locked_edge: float = 0.0   # accept break-even to finish the pair
    max_unwind_loss_per_share: float = 0.02

    # --- execution mode ---
    mode: str = "paper"              # "paper" | "live"
    live_ack: str = ""               # must be exactly "I-UNDERSTAND-THE-RISKS"

    # --- credentials (live mode only) ---
    private_key: str = ""
    funder: str = ""                 # Polymarket proxy wallet address
    signature_type: int = 1          # 0=EOA, 1=email/magic proxy, 2=browser wallet proxy

    # --- bookkeeping ---
    data_dir: Path = Path("data")

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            gamma_host=_s("PM_GAMMA_HOST", cls.gamma_host),
            clob_host=_s("PM_CLOB_HOST", cls.clob_host),
            chain_id=_i("PM_CHAIN_ID", cls.chain_id),
            market_question_regex=_s("PM_MARKET_REGEX", cls.market_question_regex),
            lookahead_hours=_f("PM_LOOKAHEAD_HOURS", cls.lookahead_hours),
            market_refresh_s=_f("PM_MARKET_REFRESH_S", cls.market_refresh_s),
            scan_interval_s=_f("PM_SCAN_INTERVAL_S", cls.scan_interval_s),
            min_edge=_f("PM_MIN_EDGE", cls.min_edge),
            fee_rate_bps_fallback=_f("PM_FEE_BPS_FALLBACK", cls.fee_rate_bps_fallback),
            max_usdc_per_trade=_f("PM_MAX_USDC_PER_TRADE", cls.max_usdc_per_trade),
            max_total_exposure_usdc=_f("PM_MAX_TOTAL_EXPOSURE", cls.max_total_exposure_usdc),
            per_market_cooldown_s=_f("PM_COOLDOWN_S", cls.per_market_cooldown_s),
            repair_attempts=_i("PM_REPAIR_ATTEMPTS", cls.repair_attempts),
            repair_min_locked_edge=_f("PM_REPAIR_MIN_LOCKED_EDGE", cls.repair_min_locked_edge),
            max_unwind_loss_per_share=_f("PM_MAX_UNWIND_LOSS", cls.max_unwind_loss_per_share),
            mode=_s("PM_MODE", cls.mode).lower(),
            live_ack=_s("PM_LIVE_ACK", cls.live_ack),
            private_key=_s("PM_PRIVATE_KEY", cls.private_key),
            funder=_s("PM_FUNDER", cls.funder),
            signature_type=_i("PM_SIGNATURE_TYPE", cls.signature_type),
            data_dir=Path(_s("PM_DATA_DIR", "data")),
        )

    def validate_live(self) -> None:
        """Raise unless the settings are explicitly armed for live trading."""
        problems = []
        if self.live_ack != "I-UNDERSTAND-THE-RISKS":
            problems.append("PM_LIVE_ACK must be set to I-UNDERSTAND-THE-RISKS")
        if not self.private_key:
            problems.append("PM_PRIVATE_KEY is not set")
        if self.signature_type in (1, 2) and not self.funder:
            problems.append("PM_FUNDER (proxy wallet address) required for signature types 1/2")
        if problems:
            raise RuntimeError("live mode blocked: " + "; ".join(problems))
