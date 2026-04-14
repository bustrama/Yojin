---
name: MACD Bullish Crossover
description: Fire when MACD histogram crosses above zero — MACD line moved above the signal line, indicating short-term momentum flipping positive.
category: MARKET
style: momentum
requires:
  - technicals
triggerGroups:
  - label: MACD turns positive
    conditions:
      - type: INDICATOR_THRESHOLD
        description: MACD histogram crosses above 0
        params:
          indicator: MACD
          threshold: 0
          direction: crosses_above
tickers: []
---

## Thesis

When the MACD histogram flips from negative to positive, short-term momentum (12 EMA) has
overtaken medium-term momentum (26 EMA). On its own this is a weak signal — but combined
with a supportive trend (price above 200 SMA) it's historically a good **add** trigger on
names you already hold or have a thesis on.

## How to act

- **BUY** / add if the ticker is already above its 200-day SMA
- **REVIEW** if the crossover happens below the 200 SMA — possible counter-trend rally, treat cautiously
- Combine with volume confirmation: no volume = no follow-through

## Exit

- Cross back below 0 after a few sessions → thesis invalidated
- Use ATR-based stop (1.5× ATR below entry) to size position
