---
name: Drawdown Mean Reversion
description: Buy quality stocks after sharp drawdowns of 15% or more, exploiting overreaction and subsequent mean reversion
category: MARKET
style: mean_reversion
requires:
  - market_data
  - technicals
triggers:
  - type: DRAWDOWN
    description: Stock has declined 15% or more from its 52-week high
    params:
      threshold: -0.15
      reference: 52_week_high
  - type: INDICATOR_THRESHOLD
    description: RSI(14) confirms oversold condition below 35
    params:
      indicator: RSI
      threshold: 35
      direction: below
tickers: []
maxPositionSize: 0.05
---

# Drawdown Mean Reversion

## Thesis

DeBondt & Thaler (1985) demonstrated that stocks experiencing extreme negative returns over 3-5 years subsequently outperform, consistent with investor overreaction — a cornerstone finding in behavioral finance. At shorter horizons, Lehmann (1990) and Jegadeesh (1990) documented weekly and monthly reversals in stock returns. The strategy targets an intermediate horizon: sharp drawdowns (15%+ from highs) that trigger behavioral overreaction but in fundamentally sound companies.

The key insight is distinguishing between drawdowns caused by temporary dislocations (overreaction candidates) and those reflecting genuine fundamental deterioration (value traps). Quality filters — profitability, manageable debt, and consistent cash flows — serve as the screen. Novy-Marx (2013) showed that profitability is the strongest predictor of returns among cheap stocks, making quality essential in any mean-reversion strategy.

The RSI confirmation ensures that selling pressure has reached an extreme (RSI < 35) rather than just price level. Combining a fundamental quality filter with a technical oversold signal creates a robust dual-screen approach that reduces false positives from either signal alone.

## Entry Rules

1. Daily, scan for stocks that have declined 15% or more from their 52-week high.
2. Filter for RSI(14) below 35 (confirming oversold momentum, not just price decline).
3. Apply quality filters to exclude value traps:
   - Positive trailing 12-month EPS.
   - Return on equity (ROE) > 10%.
   - Debt-to-equity below 1.5.
   - Free cash flow positive in at least 3 of the last 4 quarters.
4. Require the drawdown catalyst to be identifiable (sector rotation, market sell-off, earnings miss with intact thesis) — avoid stocks declining on fraud, regulatory action, or structural disruption.
5. Enter in 2 tranches: 50% on signal day, 50% two trading days later (averaging into the position).
6. Minimum market cap: $2B. Average daily volume > $5M.

## Exit Rules

1. **Recovery target**: Exit when the stock has retraced halfway back to its 52-week high. For example, if the high was $100 and the stock drew down 20% to $80, exit at $90 (the midpoint between the trough and the high, i.e., -10% from high instead of -20%).
2. **Full recovery exit**: Close remaining position if stock returns to within 3% of the 52-week high.
3. **RSI recovery**: Exit when RSI(14) crosses above 55 (momentum has normalized).
4. **Stop-loss**: Exit if the stock declines an additional 10% from entry price (total drawdown exceeds 25% from high — thesis is broken).
5. **Time-based exit**: Close after 40 trading days if the stock has not recovered at least 5% from entry.
6. **Fundamental exit**: Close immediately if a quarterly earnings report shows negative earnings (quality filter breached).

## Risk Controls

- Maximum position size: 5% of portfolio NAV.
- Maximum concurrent drawdown-reversion positions: 5 (diversify across sectors and timing).
- No more than 2 positions in the same GICS sector (avoid concentrated sector risk if a sector-wide event caused the drawdowns).
- Avoid entering during broad market corrections (S&P 500 drawdown > 10% from high) — stock-specific mean reversion is unreliable when the market itself is in drawdown.
- Scale position size inversely with volatility: reduce by 25% when the stock's 20-day realized volatility exceeds 50% annualized.
- Maintain a watchlist of 10-20 pre-screened quality stocks to act on quickly when drawdowns occur.
