---
name: Volatility Risk Premium
description: Systematically sell volatility when the implied-realized spread is elevated, capturing the persistent premium that option sellers earn
category: MARKET
style: income
requires:
  - technicals
  - market_data
triggers:
  - type: INDICATOR_THRESHOLD
    description: Implied volatility minus realized volatility spread exceeds 5 percentage points
    params:
      indicator: IV_RV_SPREAD
      threshold: 5
      direction: above
tickers: []
maxPositionSize: 0.05
---

# Volatility Risk Premium

## Thesis

The volatility risk premium (VRP) is the compensation investors earn for selling insurance against adverse market moves. Carr & Wu (2009) demonstrated that variance risk premiums are significantly negative across equity indices and individual stocks, implying that options are systematically overpriced relative to subsequent realized volatility. Ilmanen (2011) documented that implied volatility exceeds realized volatility approximately 85-90% of the time, generating a persistent income stream for volatility sellers.

The economic rationale is straightforward: investors are willing to pay above actuarial value for portfolio protection, creating a structural excess of demand for options over supply. This demand is largely inelastic — pension funds, insurers, and leveraged investors must hedge regardless of price. Bakshi & Kapadia (2003) confirmed that delta-hedged option positions earn negative returns on average, consistent with a volatility risk premium.

Conditioning on an elevated IV-RV spread (> 5 points) increases the strategy's edge. When implied volatility is expensive relative to realized, the expected profit from selling options is above average. Conversely, when the spread is negative (realized > implied), the strategy stands aside.

## Entry Rules

1. Daily, compute the IV-RV spread: 30-day implied volatility (from ATM options) minus 20-day realized (historical) volatility.
2. When IV-RV spread exceeds 5 percentage points, the signal is active.
3. Implement via short iron condors on broad indices (SPY, QQQ) for diversified exposure:
   - Sell put at 16-delta, buy put at 5-delta (defines max loss).
   - Sell call at 16-delta, buy call at 5-delta.
   - Target 30-45 DTE for optimal theta decay.
4. Alternatively, sell put spreads only (bullish bias) on individual stocks meeting the IV-RV threshold.
5. Collect minimum 1/3 of the spread width as premium (risk-reward filter).
6. Require options bid-ask spread < 10% of premium collected (liquidity filter).

## Exit Rules

1. **Profit target**: Close at 50% of maximum profit. This captures the bulk of edge while freeing capital and reducing gamma risk near expiration.
2. **Loss management**: Close if the position reaches 2x the premium collected in losses.
3. **Time-based close**: Close all positions at 10 DTE to avoid gamma expansion in the final days.
4. **IV collapse**: If IV-RV spread drops below 0 (realized exceeds implied), close all positions — the premium is no longer compensating for the risk.
5. **VIX spike**: Close all positions if VIX jumps more than 40% in a single day (regime change signal).

## Risk Controls

- Maximum portfolio notional in short volatility: 5% of portfolio NAV as measured by maximum loss.
- Maximum concurrent positions: 4 (spread across indices and single stocks).
- Never sell naked options — always use defined-risk spreads.
- Maximum 15% of portfolio theta at risk at any time.
- Reduce position size by 50% when VIX is above 25 (elevated vol regimes have fatter tails).
- No new positions within 5 days of FOMC announcements, employment reports, or CPI releases.
- Maintain at least 50% of the account in cash or liquid assets as a margin buffer.
