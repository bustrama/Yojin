---
name: Price Momentum
description: Buy stocks with strong 12-month returns, skipping the most recent month to avoid short-term reversal effects
category: MARKET
style: momentum
requires:
  - market_data
triggers:
  - type: PRICE_MOVE
    description: 12-month cumulative return exceeds 15%, excluding the most recent month
    params:
      lookback_months: 12
      skip_months: 1
      threshold: 0.15
tickers: []
maxPositionSize: 0.05
---

# Price Momentum

## Thesis

Cross-sectional momentum is one of the most robust anomalies in asset pricing. Jegadeesh & Titman (1993) documented that stocks with high returns over the past 3-12 months continue to outperform over the next 3-12 months, with annualized spreads of 8-12% between winner and loser deciles. The effect persists across geographies, asset classes, and time periods (Asness, Moskowitz & Pedersen, 2013).

The strategy skips the most recent month to avoid the well-documented short-term reversal effect (Jegadeesh, 1990). This "1-month gap" significantly improves risk-adjusted returns by filtering out liquidity-driven mean reversion that contaminates the signal.

Behavioral explanations center on underreaction to gradual information flow (Hong & Stein, 1999) and the disposition effect where investors sell winners too early (Frazzini, 2006). Risk-based explanations point to time-varying expected returns and crash risk in momentum portfolios (Daniel & Moskowitz, 2016).

## Entry Rules

1. Compute each stock's cumulative return over months t-12 through t-2 (skip the most recent month).
2. Rank the investable universe by this return metric.
3. Enter long positions in the top decile (or top 20 stocks if the universe is small).
4. Require average daily volume > $5M to ensure liquidity.
5. Exclude stocks with pending earnings within 5 trading days to avoid event contamination.
6. Stagger entries over 3-5 days to reduce timing risk.

## Exit Rules

1. **Scheduled rebalance**: Re-rank monthly. Exit positions that fall out of the top quartile.
2. **Stop-loss**: Exit if position declines 15% from entry price.
3. **Momentum crash protection**: If the portfolio's trailing 1-week return is below -10%, reduce all positions by 50%.
4. **Time-based exit**: Close any position held longer than 12 months regardless of rank.

## Risk Controls

- Maximum position size: 5% of portfolio NAV.
- Maximum sector concentration: 30% in any single GICS sector.
- Minimum portfolio diversification: at least 10 positions when fully invested.
- Avoid adding to positions that are already at maximum weight.
- Reduce gross exposure by 50% when the VIX exceeds 30 (momentum crash regime).
- No leverage. Cash is the residual allocation when fewer than 10 stocks qualify.
