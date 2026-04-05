---
name: Concentration Drift Rebalance
description: Rebalance portfolio when any single position drifts above 12% weight, capturing the rebalancing premium from systematic mean-reversion of relative weights
category: RISK
style: risk
requires:
  - portfolio
triggers:
  - type: CONCENTRATION_DRIFT
    description: Any single position exceeds 12% of portfolio NAV, triggering a rebalance to target weights
    params:
      maxWeight: 0.12
tickers: []
maxPositionSize: 0.12
---

# Concentration Drift Rebalance

## Thesis

Portfolio rebalancing generates a systematic return premium by selling relative winners and buying relative losers — effectively harvesting mean-reversion at the portfolio level. Perold & Sharpe (1988) analyzed constant-mix strategies that implicitly capture a rebalancing effect relative to buy-and-hold in a mean-reverting market. The rebalancing premium literature estimates this benefit at 0.5-1.0% annually for diversified equity portfolios.

The mechanism is intuitive: as positions drift due to differential returns, the portfolio becomes increasingly concentrated in recent winners. This creates hidden risk (position-level drawdowns amplified by overweight) and forgoes the diversification return. Willenbrock (2011) showed that the rebalancing premium is mathematically equivalent to selling volatility — a structured extraction of mean-reversion across portfolio constituents.

A 12% threshold per position strikes a balance between allowing natural momentum to build (avoiding excessive turnover) and preventing dangerous concentration. Empirical studies by Masters (2003) found that threshold-based rebalancing outperforms calendar-based rebalancing on both return and turnover metrics.

## Entry Rules

1. Monitor portfolio weights daily. When any single position exceeds 12% of total portfolio NAV, trigger a rebalance review.
2. Compute the target weight for each position based on the portfolio's strategic allocation (equal-weight, risk-parity, or custom targets).
3. Sell the overweight position down to its target weight. Allocate proceeds to the most underweight positions.
4. If multiple positions breach 12% simultaneously, rebalance all in a single batch to minimize transaction costs.
5. For tax-advantaged accounts: execute immediately. For taxable accounts, check if short-term gains exceed the expected rebalancing benefit and defer if so.
6. Minimum rebalance trade size: $500 (skip negligible adjustments).

## Exit Rules

Rebalancing is a portfolio-level discipline, not a directional trade. There is no "exit" in the traditional sense.

1. **Post-rebalance verification**: After execution, confirm no position exceeds 12% and all are within 2% of target weight.
2. **Re-trigger**: If a position rapidly re-breaches 12% within 20 trading days of a rebalance, investigate whether the thesis has changed. If the position is in a strong trend, allow a temporary increase to 14% before re-triggering.
3. **Cascade rebalance**: If rebalancing one position causes another to breach a weight limit (due to NAV denominator change), batch both adjustments.

## Risk Controls

- Maximum single-position weight: hard cap at 15% regardless of trend or thesis.
- Minimum rebalance interval: 20 trading days between rebalances of the same position (avoid churn in volatile markets).
- Annual turnover budget: target 20-40% from rebalancing. If turnover exceeds 60%, widen the trigger threshold to 14%.
- Transaction cost budget: total rebalancing costs should not exceed 0.3% of portfolio NAV per year. Use limit orders, not market orders.
- Tax-loss harvesting: when selling an overweight position in a taxable account, check for positions with unrealized losses that can be harvested simultaneously.
- Track rebalancing alpha: compare portfolio returns against a buy-and-hold counterfactual. If the rebalancing premium is negative over 12 months, review whether portfolio constituents are trending rather than mean-reverting.
- Coordinate with other strategies: do not rebalance a position that is under an active trade from another strategy (e.g., a drawdown mean reversion entry). Flag conflicts and resolve manually.
