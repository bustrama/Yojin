---
name: Covered Call Writing
description: Sell OTM calls against long equity positions when implied volatility rank is elevated, harvesting the volatility risk premium
category: MARKET
style: income
requires:
  - market_data
  - derivatives
triggers:
  - type: INDICATOR_THRESHOLD
    description: IV Rank exceeds 50, indicating implied volatility is in the upper half of its 12-month range
    params:
      indicator: IV_RANK
      threshold: 50
      direction: above
tickers: []
maxPositionSize: 0.10
---

# Covered Call Writing

## Thesis

The volatility risk premium (VRP) — the persistent spread between implied and realized volatility — is one of the most reliable sources of return in options markets. Ilmanen (2011) documented that implied volatility exceeds subsequent realized volatility approximately 85% of the time across asset classes. Carr & Wu (2009) showed that variance risk premiums are significantly negative (implying options are systematically overpriced) with compensation for bearing volatility risk.

Covered call writing is the most conservative method to harvest VRP. The CBOE S&P 500 BuyWrite Index (BXM) has matched or exceeded S&P 500 returns with roughly two-thirds the volatility since 1986 (Whaley, 2002). The strategy sacrifices upside beyond the strike price in exchange for premium income that provides a cushion against moderate declines.

By conditioning entries on IV Rank > 50, the strategy ensures calls are sold when volatility is relatively expensive. Selling at the 16-delta strike (approximately 1 standard deviation OTM) balances premium capture against the probability of assignment, leaving room for moderate appreciation in the underlying.

## Entry Rules

1. Identify long equity positions eligible for covered calls (minimum 100 shares per lot).
2. Check IV Rank for each position daily. When IV Rank > 50, the position qualifies.
3. Sell 1 call contract per 100 shares at the 16-delta strike, targeting 30-45 DTE (days to expiration).
4. Prefer monthly expiration cycles over weeklies for better liquidity and lower commission drag.
5. Require the call's bid-ask spread to be < 5% of the mid-price (liquidity filter).
6. Do not write calls within 10 days of an earnings announcement (assignment risk and IV crush complicate management).

## Exit Rules

1. **Expiration**: Let the call expire worthless if OTM at expiration. The premium is fully captured.
2. **Early close at 50% profit**: Buy back the call when 50% of the premium has decayed (typically 10-15 days before expiration). Re-sell a new call at the next monthly cycle.
3. **Roll up and out**: If the stock rallies past the strike, roll to a higher strike at the next expiration for a net credit. Only roll if the net credit exceeds $0.30 per share.
4. **Assignment acceptance**: If deep ITM near expiration, accept assignment and repurchase shares at market if the position remains a core holding.
5. **Defensive close**: Buy back the call at any time if IV Rank drops below 20 (volatility has cheapened, premium is insufficient to justify the cap).

## Risk Controls

- Maximum position size for the underlying: 10% of portfolio NAV.
- Only write calls on positions you are willing to sell at the strike price.
- Never write naked calls — every call must be fully covered by shares.
- Cap covered call overlay at 50% of total equity exposure (keep some positions uncapped for upside).
- Monitor portfolio delta: if net delta drops below 0.4 per share on covered positions, the overlay is too aggressive.
- Avoid writing calls on stocks in strong uptrends (above upper Bollinger Band) unless willing to forgo further gains.
