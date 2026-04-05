---
name: Multi-Factor Composite Ranking
description: Weekly composite ranking of stocks across four factors — value, momentum, quality, and sentiment — to identify the strongest risk-adjusted opportunities
category: MARKET
style: quant
requires:
  - fundamentals
  - technicals
  - sentiment
triggers:
  - type: CUSTOM
    description: Weekly composite ranking computed every Monday; top decile stocks are entry candidates
    params:
      frequency: weekly
      top_n_percentile: 10
      factors:
        - value
        - momentum
        - quality
        - sentiment
tickers: []
maxPositionSize: 0.08
---

# Multi-Factor Composite Ranking

## Thesis

Multi-factor investing combines complementary return drivers to produce more consistent alpha than any single factor. Fama & French (1993) established the foundation with size and value factors. Carhart (1997) added momentum as a fourth factor, showing it captures return variation unexplained by market, size, and value. Novy-Marx (2013) demonstrated that gross profitability (quality) is the "other side of value" — quality and value are negatively correlated, making their combination particularly powerful.

The four-factor composite — value (B/P), momentum (12-1 month return), quality (gross profitability), and sentiment (social/news) — exploits the low correlation between factors. When value underperforms, momentum often outperforms, and vice versa. Asness, Moskowitz & Pedersen (2013) showed that the value-momentum negative correlation is pervasive across asset classes and geographies. Adding sentiment captures the retail information advantage in an era of social media-driven price discovery (Da, Engelberg & Gao, 2015).

The composite ranking approach avoids the fragility of single-factor strategies and reduces turnover through diversified signal aggregation. Harvey, Liu & Zhu (2016) cautioned about factor proliferation, but the four factors used here each have strong theoretical foundations and out-of-sample evidence spanning decades.

## Entry Rules

1. Every Monday before market open, compute four factor scores for each stock in the universe (minimum 200 stocks, market cap > $1B):
   - **Value**: Book-to-price ratio, sector-neutralized percentile rank.
   - **Momentum**: Cumulative return months t-12 to t-2, percentile rank.
   - **Quality**: Gross profitability (revenue minus COGS divided by total assets), trailing 12 months, percentile rank.
   - **Sentiment**: 7-day social sentiment score, percentile rank (0-100).
2. Composite score = equal-weighted average of the four percentile ranks.
3. Rank stocks by composite score. Select the top decile (top 10%) as candidates.
4. From the top decile, select the top 12-15 stocks with the highest composite scores.
5. Equal-weight positions at entry (approximately 6-8% per position).
6. Require average daily volume > $5M and no pending earnings within 5 trading days.

## Exit Rules

1. **Weekly rebalance**: Remove stocks that fall below the top 20th percentile at the weekly ranking. This hysteresis band (enter at top 10%, exit at top 20%) reduces turnover from marginal rank changes.
2. **Factor deterioration**: Exit immediately if any two of the four factor scores drop below the 30th percentile (broad deterioration across signals).
3. **Stop-loss**: Exit if position declines 12% from entry. Multi-factor selection does not guarantee short-term performance.
4. **Earnings exit**: Reduce position by 50% ahead of earnings if the stock has an earnings announcement within 3 trading days. Re-evaluate after the report.

## Risk Controls

- Maximum position size: 8% of portfolio NAV.
- Minimum portfolio positions: 12 (diversification floor).
- Maximum sector concentration: 25% in any single GICS sector.
- Factor balance check: if the portfolio's average score for any single factor drops below the 40th percentile, tilt rebalancing toward that factor.
- Annual turnover target: 80-120%. Multi-factor strategies have moderate turnover by design.
- Transaction cost budget: weekly rebalancing costs must stay below 5 bps per round-trip. Use limit orders exclusively.
- Backtest validation: re-run the composite ranking on a 3-year rolling basis quarterly. If the strategy's information ratio falls below 0.3, investigate whether factor definitions need recalibration.
- Avoid crowded factors: if a factor's long-short return has been negative for 6 consecutive months, reduce its weight in the composite to 15% and redistribute to the remaining factors.
