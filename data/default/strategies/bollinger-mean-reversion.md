---
name: Bollinger Band Mean Reversion
description: Buy oversold stocks touching the lower Bollinger Band with RSI confirmation, targeting mean reversion to the middle band
category: MARKET
style: mean_reversion
requires:
  - market_data
  - technicals
triggers:
  - type: INDICATOR_THRESHOLD
    description: Price touches or penetrates the lower Bollinger Band (20-day, 2 std dev)
    params:
      indicator: BB_LOWER
      threshold: 0
      direction: below
  - type: INDICATOR_THRESHOLD
    description: RSI(14) drops below 30, confirming oversold condition
    params:
      indicator: RSI
      threshold: 30
      direction: below
tickers: []
maxPositionSize: 0.04
---

# Bollinger Band Mean Reversion

## Thesis

Bollinger Bands (Bollinger, 1992, 2002) provide dynamic support/resistance levels based on rolling volatility. When prices touch the lower band (mean - 2 standard deviations), the vast majority of recent price action has occurred above this level, suggesting a statistically extreme reading. (Note: the 2-sigma/95% rule assumes normality; stock returns are fat-tailed, so band touches may occur more frequently than a Gaussian model predicts.). Combined with Wilder's (1978) Relative Strength Index confirming oversold conditions (RSI < 30), the dual-signal filter identifies high-probability mean reversion setups.

The strategy exploits the empirical tendency of prices to revert to their short-term mean after transient dislocations. Poterba & Summers (1988) documented mean reversion in stock returns at horizons of 1-4 weeks. The key insight is distinguishing temporary oversold conditions from fundamental regime changes — the RSI confirmation and quality filters help separate the two.

Academic evidence supports combining technical indicators: Sullivan, Timmermann & White (1999) found that while individual indicators often fail after transaction costs, composite signals retain predictive power. The dual Bollinger-RSI trigger achieves this by requiring both price-level and momentum-level confirmation.

## Entry Rules

1. Compute 20-day Bollinger Bands (2 standard deviations) and 14-day RSI daily.
2. Trigger when price closes below the lower Bollinger Band AND RSI(14) < 30.
3. Enter the next trading day at the open if both conditions still hold.
4. Require the stock to be above its 200-day moving average (filtering for uptrend context — mean reversion works poorly in downtrends).
5. Require average daily volume > $3M and market cap > $500M.
6. Limit to 1 entry per stock per 20-day window (avoid averaging down repeatedly).

## Exit Rules

1. **Target exit**: Close when price reaches the 20-day moving average (middle Bollinger Band).
2. **Upper band exit**: If price overshoots to the upper band, close immediately (extended move).
3. **Time-based exit**: Close after 10 trading days if neither target is reached.
4. **Stop-loss**: Exit if price closes 3% below the lower Bollinger Band at entry (the dislocation is structural, not transient).

## Risk Controls

- Maximum position size: 4% of portfolio NAV.
- Maximum concurrent mean reversion positions: 6 (diversify entry timing).
- No more than 2 positions in the same sector.
- Skip entries during earnings week for the target stock.
- Reduce position size by 50% when VIX > 25 (high-volatility regimes increase false signals).
- Do not enter if the stock has declined more than 20% in the prior month (potential fundamental deterioration, not mean-reverting noise).
