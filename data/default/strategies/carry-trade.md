---
name: Currency Carry Trade
description: Go long high-yielding currencies and short low-yielding currencies to capture interest rate differentials
category: MARKET
style: carry
requires:
  - macro_data
triggers:
  - type: CUSTOM
    description: Interest rate differential between target and funding currency exceeds 2 percentage points
    params:
      rate_differential_threshold: 0.02
      rebalance_frequency: monthly
tickers: []
maxPositionSize: 0.10
---

# Currency Carry Trade

## Thesis

The carry trade exploits the well-documented failure of uncovered interest rate parity (UIP). Under UIP, high-yield currencies should depreciate to offset the interest rate advantage, but empirically they tend to appreciate — the "forward premium puzzle" (Fama, 1984). Burnside, Eichenbaum, Kleshchelski & Rebelo (2011) confirmed that carry returns are not explained by traditional risk factors.

Brunnermeier, Nagel & Pedersen (2008) showed that carry trade returns exhibit negative skewness — slow steady gains punctuated by sharp crashes during liquidity crises and risk-off episodes. This "up the escalator, down the elevator" pattern means the strategy earns compensation for bearing crash risk. Lustig, Roussanov & Verdelhan (2011) identified a "dollar carry factor" that prices cross-sectional variation in currency excess returns.

The strategy is viable for retail investors through currency ETFs and forwards, avoiding the complexity of direct FX trading. The 2% rate differential threshold ensures the carry exceeds typical transaction costs and provides a meaningful cushion against adverse exchange rate movements.

## Entry Rules

1. Monthly, survey short-term (3-month) government bond yields across G10 currencies plus selected EM currencies with liquid forwards.
2. Rank currencies by yield. Identify the top 3 highest-yielding and bottom 3 lowest-yielding currencies.
3. Enter long positions in high-yield currencies and short positions in low-yield currencies, only where the pairwise differential exceeds 2%.
4. Implement via currency ETFs (e.g., FXA for AUD, FXY for JPY) or through a forex broker with competitive swap rates.
5. Equal-weight each leg within the long and short baskets.
6. Require that each currency has a liquid forward market and daily volume > $1B in spot.

## Exit Rules

1. **Monthly rebalance**: Adjust holdings when the yield ranking changes at the monthly review.
2. **Risk-off exit**: Close all positions if the VIX exceeds 30 or the JPY appreciates more than 3% in a single week (historical carry crash indicator).
3. **Differential collapse**: Exit a pair if the rate differential narrows below 1% (carry no longer compensates for FX risk).
4. **Drawdown stop**: Close all carry positions if the portfolio carry sleeve draws down more than 5% from peak.
5. **Trend filter**: Only maintain carry positions where the high-yield currency is above its 200-day moving average against USD.

## Risk Controls

- Maximum carry sleeve: 10% of total portfolio NAV across all currency positions.
- Maximum per-currency exposure: 3% of portfolio NAV.
- Leverage: none for ETF implementation; maximum 2x for direct FX (margin requirement).
- Hedge tail risk with 3-month OTM put options on the highest-yielding currency (25-delta puts) when implied vol is below median.
- Monitor correlations between carry positions — reduce if average pairwise correlation exceeds 0.7 (concentration of crash risk).
- The carry sleeve is a satellite allocation, not a core holding.
