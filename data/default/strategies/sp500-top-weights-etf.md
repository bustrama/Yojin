---
name: S&P 500 Top Weights ETF Clone
description: Hold the five largest S&P 500 constituents in target weights mimicking the index. Fires when any position drifts > 5% from target.
category: PORTFOLIO
style: defensive
requires:
  - portfolio
  - market_data
triggerGroups:
  - label: Rebalance required
    conditions:
      - type: ALLOCATION_DRIFT
        description: Actual weight deviates from target by > 5%
        params:
          toleranceBps: 500
tickers:
  - AAPL
  - MSFT
  - NVDA
  - GOOGL
  - AMZN
targetWeights:
  AAPL: 0.30
  MSFT: 0.25
  NVDA: 0.20
  GOOGL: 0.15
  AMZN: 0.10
---

## Thesis

Replicate a concentrated "mega-cap S&P" exposure using 5 names at fixed weights instead of
paying an ETF expense ratio. Rebalance when any position drifts > 500 bps from its target.

## How to act

- **TRIM** positions flagged `overweight` back toward target
- **BUY** positions flagged `underweight` back toward target (including zero-position underweights)
- Execute rebalances in a single pass — partial rebalances defeat the point
- Ignore the signal if drift is due to a recent conviction change; edit `targetWeights`
  rather than rebalancing to a stale plan

## Risk controls

- This strategy is *allocation-driven*, not *event-driven* — expect triggers on quiet days
  too, whenever relative performance accumulates enough drift
- Keep the total portfolio weight across all targets ≤ 100% (leave dry powder)
- Taxable accounts: prefer to rebalance via new capital before realizing gains
