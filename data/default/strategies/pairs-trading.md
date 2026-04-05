---
name: Pairs Trading
description: Market-neutral strategy that trades cointegrated stock pairs when their spread deviates beyond 2 standard deviations
category: MARKET
style: statistical_arb
requires:
  - market_data
triggers:
  - type: CUSTOM
    description: Price spread between paired stocks exceeds 2 standard deviations from historical mean
    params:
      spread_threshold_std: 2.0
      lookback_days: 252
      cointegration_pvalue: 0.05
tickers: []
maxPositionSize: 0.04
---

# Pairs Trading

## Thesis

Pairs trading, formalized by Gatev, Goetzmann & Rouwenhorst (2006), exploits temporary mispricings between historically cointegrated securities. The strategy earned an average of 11% annually in their 1962-2002 sample with a Sharpe ratio above 1.0. The approach is market-neutral by construction — dollar-neutral long/short positions eliminate broad market exposure.

The statistical foundation rests on cointegration theory (Engle & Granger, 1987): while individual stock prices are non-stationary, certain pairs maintain a stationary spread that mean-reverts. When the spread deviates significantly from its historical mean, the strategy bets on convergence. Vidyamurthy (2004) provides a comprehensive treatment of the cointegration-based pairs trading framework.

Recent evidence suggests returns have compressed due to increased competition (Do & Faff, 2010), but the strategy remains viable for retail investors who can target less liquid pairs that institutional capital ignores. Krauss (2017) confirms that pairs trading continues to generate positive risk-adjusted returns when pairs are selected using robust cointegration tests.

## Entry Rules

1. **Pair selection** (monthly): Screen for pairs within the same GICS sub-industry. Run the Engle-Granger cointegration test on 252-day price histories. Select pairs with p-value < 0.05.
2. Compute the spread as: log(Price_A) - beta * log(Price_B), where beta is the cointegrating coefficient from OLS regression.
3. Normalize the spread: z-score = (spread - mean) / std, using a rolling 252-day window.
4. **Entry signal**: Open a position when |z-score| > 2.0.
   - If z > 2.0: short Stock A, long Stock B (spread is wide, expect convergence).
   - If z < -2.0: long Stock A, short Stock B.
5. Size the legs to be dollar-neutral at entry.
6. Both legs must have average daily volume > $5M.

## Exit Rules

1. **Convergence exit**: Close both legs when |z-score| < 0.5 (spread has reverted near the mean).
2. **Stop-loss**: Close both legs if |z-score| > 3.5 (spread is diverging, cointegration may have broken).
3. **Time-based exit**: Close after 20 trading days if the spread hasn't reverted.
4. **Cointegration break**: If the pair fails the cointegration test on a rolling basis (p-value > 0.10), close and remove from the active pair set.

## Risk Controls

- Maximum position size per leg: 4% of portfolio NAV (8% gross for the pair).
- Maximum concurrent active pairs: 5.
- No single stock in more than 2 active pairs simultaneously.
- Require minimum 60% of historical trading days with both stocks trading (avoid illiquid stubs).
- Monitor sector-level net exposure and hedge if net sector beta exceeds 0.15.
- Margin requirement: maintain at least 30% excess margin above maintenance at all times.
