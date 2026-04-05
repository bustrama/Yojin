---
name: RSI Divergence
description: Identify bullish and bearish RSI divergences as leading reversal signals when price and momentum disagree
category: MARKET
style: technical
requires:
  - technicals
  - market_data
triggers:
  - type: INDICATOR_THRESHOLD
    description: RSI(14) drops below 40, entering the zone where divergences are most significant
    params:
      indicator: RSI
      threshold: 40
      direction: below
tickers: []
maxPositionSize: 0.04
---

# RSI Divergence

## Thesis

J. Welles Wilder (1978) identified divergence as the "most indicative characteristic of the Relative Strength Index" — more significant than overbought/oversold readings or centerline crossovers. A bullish divergence occurs when price makes a lower low while RSI makes a higher low, indicating that downward momentum is weakening even as price continues to fall. The mirror pattern (bearish divergence) signals weakening upward momentum.

Divergence works because price is a lagging indicator of momentum shifts. Andrew Cardwell, who extended Wilder's work in the 1990s, classified divergences into "classic" (Type I) and "hidden" (Type II) patterns, with classic divergences signaling reversals and hidden divergences signaling trend continuation. Empirical tests by Dacorogna, Gencay, Muller, Olsen & Pictet (2001) support the predictive value of momentum divergence across time frames.

The strategy focuses on the more reliable classic (Type I) divergence patterns and requires confirmation through price action to reduce false signals. RSI below 40 sets the stage for bullish divergences, while RSI above 60 sets the stage for bearish divergences.

## Entry Rules

1. **Bullish divergence (long)**:
   - Price makes a swing low that is lower than the prior swing low (within 20 trading days).
   - RSI(14) at the second low is higher than RSI at the first low.
   - RSI at both lows is below 40 (ensuring oversold context).
   - Enter when price closes above the high between the two lows (breakout confirmation).

2. **Bearish divergence (short/exit)**:
   - Price makes a swing high that is higher than the prior swing high (within 20 trading days).
   - RSI(14) at the second high is lower than RSI at the first high.
   - RSI at both highs is above 60.
   - Use as an exit signal for existing long positions or a short entry for qualified names.

3. Require the two swing points to be 5-20 trading days apart (too close is noise, too far is a different regime).
4. Volume at the second swing point should be lower than at the first (confirms exhaustion).
5. Minimum average daily volume: $3M. Market cap > $500M.

## Exit Rules

1. **Target exit**: For bullish divergence longs, target the prior swing high (the high that preceded the divergence formation).
2. **RSI target**: Exit when RSI reaches 65 (momentum has shifted from oversold to neutral-bullish).
3. **Stop-loss**: Place stop 1% below the second (most recent) swing low. If triggered, the divergence has failed.
4. **Time-based exit**: Close after 15 trading days if neither target is reached.
5. **Opposing divergence**: Exit immediately if a bearish divergence forms while in a long position.

## Risk Controls

- Maximum position size: 4% of portfolio NAV.
- Maximum concurrent divergence trades: 4.
- Avoid divergence trades during earnings week for the target stock.
- Skip divergence signals in stocks that have been in a persistent downtrend (below 200-day MA for more than 60 days) — these may be value traps, not reversal candidates.
- Do not trade bearish divergences short unless the stock is in a confirmed downtrend (below 50-day MA).
- Require a minimum RSI spread of 5 points between the two divergence lows/highs (e.g., RSI 28 then RSI 35 qualifies; RSI 28 then RSI 30 does not).
