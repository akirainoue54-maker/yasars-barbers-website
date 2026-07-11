# Polymarket YES+NO < $1 Arbitrage Bot

A bot that scans Polymarket's short-term crypto "Up or Down" markets and, when
the two sides of a binary market can be bought for less than $1 combined
(e.g. Up @ $0.48 + Down @ $0.49 = $0.97), buys both sides simultaneously.
Exactly one side pays $1 at resolution, so a fully paired position locks in
the difference regardless of where the price goes.

**Paper trading is the default.** Live trading requires an explicit,
multi-step opt-in described below.

---

## ⚠️ Reality check — read this first

This bot was built from a viral social-media post claiming $100 → $3,799 in
hours. **Those numbers are almost certainly fabricated or cherry-picked.**
Posts like that ("watch the video for the exact build") are engagement bait,
not audited track records. Before risking money, understand why real results
will be far smaller:

1. **The math caps your upside.** With a $100 bankroll and a typical 1–3¢
   edge, a *fully filled* $97 paired position earns about $3 — and your
   capital is then locked until the market resolves and you redeem. You
   cannot compound faster than markets resolve.
2. **You are racing professionals.** Market-making firms quote these books
   with sub-second infrastructure. Gaps that survive long enough for a
   1-second REST polling loop to catch are rare, small, and usually thin.
3. **Most "opportunities" you see are stale.** By the time your order
   arrives, the liquidity is gone. That is why this bot uses Fill-And-Kill
   orders and treats a one-legged fill as an incident to repair, not a win.
4. **Fees can eat the whole edge.** Polymarket has enabled taker fees on
   exactly these short-term crypto markets in the past. The bot reads
   per-market fee rates from the CLOB API and models the documented formula
   `fee = bps/10⁴ × min(p, 1−p) × shares`, but **verify the live fee
   schedule yourself** before trusting any backtest or paper result.
5. **Paper mode is optimistic by construction.** It assumes you get the
   displayed liquidity with zero latency and zero competition. Treat paper
   PnL as an upper bound, not a forecast.
6. **Legal/ToS:** Polymarket geo-blocks a number of jurisdictions and
   prohibits VPN circumvention. Check Polymarket's terms and the law where
   you live (this includes Japan) before trading. Nothing here is financial
   advice; you can lose money, including to bugs.

If after all that you still want to run it — start in paper mode, then go
live with `PM_MAX_USDC_PER_TRADE=2` and watch it like a hawk.

---

## 日本語まとめ

**これは何?** Polymarket の BTC「Up or Down」マーケットで、YES(Up)と
NO(Down)の合計買値が $1 未満のときに両方を同時に買い、差額をロックする
ボットです。デフォルトは**ペーパートレード**(実注文なし)。

**先に現実を:** 元ネタ投稿の「$100が数時間で$3,799」はほぼ確実に誇張です。
$100 の資金で 1〜3¢ の歪みを取っても、1回の満額約定で得られるのは $3 程度で、
資金はマーケット解決まで拘束されます。さらに、こうした板はプロのマーケット
メイカーがミリ秒単位で監視しており、1秒間隔の REST ポーリングで取れる歪みは
稀で小さい。加えて、まさにこの Up/Down 系マーケットには**テイカー手数料**が
導入されたことがあり、手数料を無視すると「儲かったつもりで損」になります
(本ボットは API から手数料を読み込んで利益計算に含めます)。

**使い方:**

```bash
cd polymarket-arb-bot
pip install -r requirements.txt
cp .env.example .env         # 設定を編集
python -m arb_bot scan       # 現在の板とチャンスを1回表示
python -m arb_bot run        # ペーパートレードで常駐
```

実売買は `.env` に秘密鍵等を設定した上で `PM_MODE=live` と
`PM_LIVE_ACK=I-UNDERSTAND-THE-RISKS` を明示し、`python -m arb_bot run --live`。
**必ず極小サイズ(PM_MAX_USDC_PER_TRADE=2 など)から始めてください。**
また、Polymarket の利用規約と居住国(日本を含む)の法規制を必ず確認して
ください。VPN での回避は規約違反です。

---

## How it works

```
┌────────────┐   Gamma API   ┌──────────────┐   CLOB API    ┌───────────┐
│  discover   │ ────────────▶ │ enrich: fees, │ ────────────▶ │ batch     │
│  "BTC Up or │               │ tick, min size│               │ order     │
│  Down" mkts │               └──────────────┘               │ books     │
└────────────┘                                               └─────┬─────┘
                                                                   ▼
      ┌──────────────────────────────────────────────────────────────┐
      │ arb.find_opportunity: walk BOTH ask books level by level;    │
      │ accept marginal shares while 1 − (pᵤₚ + p_down) − fees ≥     │
      │ min_edge; cap by per-trade / total-exposure limits           │
      └──────────────────────────────┬───────────────────────────────┘
                                     ▼
      ┌──────────────────────────────────────────────────────────────┐
      │ executor: pre-sign both legs, POST as FAK concurrently.      │
      │ One leg lagged? → repair: re-buy missing side, capped at a   │
      │ price that still locks ≥ 0 edge. Still unpaired? → unwind    │
      │ at best bid if loss ≤ PM_MAX_UNWIND_LOSS, else hold + alert. │
      └──────────────────────────────────────────────────────────────┘
```

- **Detection** (`arb_bot/arb.py`) — pure math, fully unit-tested. Walks
  order book depth so it sizes across multiple levels, not just top of book.
- **Fees** (`arb_bot/fees.py`) — Polymarket's proportional taker-fee
  formula; the per-market rate comes from the CLOB API with a configurable
  fallback (`PM_FEE_BPS_FALLBACK`).
- **Execution** (`arb_bot/executor.py`) — live orders via the official
  [`py-clob-client`](https://github.com/Polymarket/py-clob-client). Both
  legs are Fill-And-Kill so nothing rests on the book.
- **Leg risk** (`arb_bot/execution.py`) — the actual hard part of this
  strategy. If one side fills and the other doesn't, the bot first tries to
  complete the pair at a price that still breaks even, then falls back to
  selling the orphaned leg within a bounded loss, and only holds (a
  directional position) as a last resort — loudly logged.
- **Risk limits** (`arb_bot/state.py`) — per-trade cap, total locked-capital
  cap (paired positions are riskless but their cash is stuck until
  resolution), per-market cooldown.

## Install

```bash
cd polymarket-arb-bot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Run the test suite (offline, no keys needed):

```bash
python -m pytest
```

## Usage

```bash
python -m arb_bot scan        # one-shot: list tracked markets + any current edge
python -m arb_bot run         # paper trade continuously (default)
python -m arb_bot run -v      # same, with per-scan debug logging
```

Trades are appended to `data/paper_trades.jsonl` / `data/live_trades.jsonl`.

### Going live (deliberately annoying)

1. Fund your Polymarket account with USDC and export your key
   (email/Magic accounts: Settings → Export Private Key).
2. In `.env` set `PM_PRIVATE_KEY`, `PM_FUNDER` (your Polymarket wallet
   address), `PM_SIGNATURE_TYPE` (1 for email accounts, 2 for browser
   wallets), `PM_MODE=live`, and `PM_LIVE_ACK=I-UNDERSTAND-THE-RISKS`.
3. Set `PM_MAX_USDC_PER_TRADE=2` for the first session and confirm that
   fills, fees, and the trade log match reality — the order-response
   parsing in `executor.py` is written defensively against the documented
   API but **must be validated with tiny orders before you raise sizes**.
4. `python -m arb_bot run --live`

Winnings from resolved markets may need to be **claimed/redeemed** — check
your Polymarket portfolio; paired positions free up their capital only after
redemption. (Advanced: complementary shares can also be merged back into
USDC on-chain via the CTF `merge` operation without waiting for resolution.)

If you trade from a raw EOA (`PM_SIGNATURE_TYPE=0`), you must first set the
USDC/CTF allowances for Polymarket's exchange contracts yourself — accounts
created through the Polymarket UI already have this done.

## Tuning

| Env var | Default | Meaning |
|---|---|---|
| `PM_MARKET_REGEX` | `(?i)^(bitcoin\|btc)\b.*\bup or down\b` | which market questions to trade (try `(bitcoin|ethereum)` etc.) |
| `PM_MIN_EDGE` | `0.01` | required $/share profit after modeled fees |
| `PM_FEE_BPS_FALLBACK` | `0` | fee assumed when the API reports none |
| `PM_MAX_USDC_PER_TRADE` | `25` | max outlay per paired trade |
| `PM_MAX_TOTAL_EXPOSURE` | `100` | max USDC locked in unresolved positions |
| `PM_SCAN_INTERVAL_S` | `1.0` | polling cadence (mind rate limits) |
| `PM_MAX_UNWIND_LOSS` | `0.02` | max $/share loss accepted to exit an orphaned leg |

## Known limitations (a.k.a. why the pros still win)

- REST polling (~1s) instead of the CLOB websocket feed. Subscribing to
  `market` channel deltas would cut reaction time by an order of magnitude
  and is the single highest-value upgrade.
- Paper fills assume snapshot liquidity is still there (optimistic).
- No automatic redemption of resolved positions; capital recycling is
  manual (or via the UI's claim).
- Order-response field parsing (`makingAmount`/`takingAmount`) follows the
  documented CLOB behaviour but should be re-verified whenever the API
  version bumps.

## Disclaimer

Educational software provided as-is, with no warranty. Trading on
prediction markets involves real financial risk and may not be legal in
your jurisdiction. You are solely responsible for what you run.
