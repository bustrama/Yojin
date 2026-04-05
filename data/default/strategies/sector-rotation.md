---
name: Sector Rotation
description: Rotate into the top 3 performing sectors monthly using industry momentum signals
category: MARKET
style: momentum
requires:
  - market_data
  - portfolio
triggers:
  - type: PRICE_MOVE
    description: Monthly sector performance review — rank all sectors by trailing 6-month return
    params:
      review_frequency: monthly
      lookback_months: 6
      top_n: 3
tickers: []
maxPositionSize: 0.15
---

# Sector Rotation

## Thesis

Industry momentum is a distinct and powerful anomaly, separate from individual stock momentum. Moskowitz & Grinblatt (1999) demonstrated that industry momentum explains a substantial portion of the cross-sectional momentum profits documented by Jegadeesh & Titman (1993), with top-performing industries outperforming bottom industries by 5-10% annually over 6-12 month horizons.

The strategy leverages the persistent nature of sector-level trends driven by macroeconomic cycles, capital flows, and industry-specific catalysts. Unlike single-stock momentum, sector rotation benefits from natural diversification within each sector allocation, reducing idiosyncratic risk. O'Neal (2000) showed that sector rotation strategies generate higher Sharpe ratios than market-cap-weighted benchmarks.

The economic rationale ties to the business cycle framework: different sectors lead at different phases (technology and consumer discretionary in early expansion, energy and materials in late expansion, utilities and healthcare in contraction). Stangl, Jacobsen & Visaltanachoti (2009) confirmed that sector rotation strategies based on relative strength produce economically significant alpha even after accounting for transaction costs.

## Entry Rules

1. On the first trading day of each month, compute trailing 6-month total returns for each of the 11 GICS sectors using sector ETFs as proxies.
2. Rank sectors from highest to lowest return.
3. Allocate equally to the top 3 sectors (approximately 33% each, scaled by maxPositionSize constraint).
4. Implement via sector ETFs (e.g., XLK, XLF, XLE) for simplicity, or use the top 5 stocks by market cap within each chosen sector.
5. Skip sectors with fewer than 20 constituent stocks with volume > $1M/day (illiquidity filter).
6. Execute rebalancing trades over 2 days to reduce market impact.

## Exit Rules

1. **Monthly rebalance**: Exit sectors that drop out of the top 3 ranking at the monthly review.
2. **Crash filter**: If the broad market (S&P 500) drops more than 8% in a calendar month, move 50% of the portfolio to cash or short-term treasuries at month-end.
3. **Absolute momentum filter**: Only invest in a top-3 sector if its absolute 6-month return is positive. If negative despite being top-ranked, allocate that share to cash.
4. **No mid-month exits** unless the crash filter triggers, to avoid overtrading.

## Risk Controls

- Maximum allocation per sector: 15% of total portfolio (33% of the rotation sleeve).
- The rotation strategy should occupy no more than 45% of total portfolio NAV, with the remainder in core holdings.
- Maximum turnover: expect 2-4 sector changes per quarter. If turnover exceeds 6 changes in a quarter, widen the ranking threshold to top 4 sectors.
- Transaction costs: budget 10 bps per rebalance round-trip. Skip marginal rank changes (4th vs. 3rd sector within 1% return) to reduce churn.
- Review correlation with broad market quarterly — if the strategy beta exceeds 1.3, reduce allocation by 20%.
