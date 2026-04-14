---
name: Golden Cross
description: Fire when the 50-day moving average crosses above the 200-day — a classical long-term bullish trend signal.
category: MARKET
style: trend_following
requires:
  - technicals
triggerGroups:
  - label: Golden cross forms
    conditions:
      - type: INDICATOR_THRESHOLD
        description: GOLDEN_CROSS flag transitions from 0 to 1
        params:
          indicator: GOLDEN_CROSS
          threshold: 0.5
          direction: crosses_above
tickers: []
---

## Thesis

When the 50-day simple moving average crosses above the 200-day SMA, short-term momentum
has shifted above the long-term trend. Historically this has been a durable bullish regime
signal for equities — not a short-term timing edge, but a filter for "is trend up?".

## How to act

- **BUY** on confirmation for positions you'd otherwise be neutral on
- Defer entries that would otherwise trim/sell on fundamentals — trend regime is supportive
- **REVIEW** if the ticker has poor fundamentals: golden cross on a broken story is a trap

## Risk controls

- Don't size up on this alone — combine with a fundamental or catalyst view
- Exit trigger lives elsewhere (death cross, drawdown, earnings miss)
