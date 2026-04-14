---
name: RSI Mean Reversion
description: Fire when RSI enters oversold territory alongside a sharp price drop — candidate for mean-reversion bounce.
category: MARKET
style: mean_reversion
requires:
  - technicals
  - market_data
triggerGroups:
  - label: Oversold + sharp drop
    conditions:
      - type: INDICATOR_THRESHOLD
        description: RSI crosses below 30
        params:
          indicator: RSI
          threshold: 30
          direction: crosses_below
      - type: PRICE_MOVE
        description: 1-day drop greater than 5%
        params:
          threshold: 0.05
          direction: drop
tickers: []
---

## Thesis

RSI below 30 combined with a >5% single-day drop typically indicates a capitulative move.
Statistically, 1–3 day forward returns are positive on average when this pattern fires on
liquid large-caps. The edge compresses quickly — this is a tactical, not structural, signal.

## How to act

- **BUY** a starter (≤1% portfolio weight) if the name fits your universe
- **REVIEW** if the drop is catalyst-driven (earnings miss, guidance cut, regulatory action) —
  do not buy into broken stories; mean reversion only applies to noise, not news
- **HOLD** / skip if macro-wide selloff — the single-name bounce gets drowned out

## Exit

- 5–10% bounce → trim half, let the rest run to the 20-day SMA
- If RSI fails to recover above 40 within 3 sessions, close the position at breakeven
