---
name: Follow Warren Buffett 13F
description: Fire when a new 13F disclosure shows Warren Buffett (Berkshire Hathaway, CIK 0001067983) buying a position worth over $100M.
category: RESEARCH
style: value
requires:
  - filings
triggerGroups:
  - label: Buffett buys a meaningful stake
    conditions:
      - type: PERSON_ACTIVITY
        description: Warren Buffett BUY > $100M (13F disclosure)
        params:
          person: Warren Buffett
          action: BUY
          minDollar: 100000000
          lookback_days: 120
tickers: []
---

## Thesis

Berkshire Hathaway's 13F filings are lagged by up to 45 days, but large new positions
still carry signal. Buffett's sector preferences (durable moats, pricing power, boring cash
flows) are consistent enough that "what he buys" is useful research, not a trade signal.

## How to act

- **REVIEW** the named ticker — do NOT blindly BUY off the disclosure
- Check:
  - Current price vs Buffett's estimated cost basis (disclosed in 13F value field)
  - Thesis: does it fit a "Buffett-style" story (moat, cash flow, management)?
  - Position sizing: treat as a research tip, not a core holding anchor
- **BUY** only if the thesis passes your own screen AND valuation hasn't re-rated
  meaningfully since the filing

## Risk controls

- 13F disclosures don't include short positions, options, or derivative hedges — Berkshire
  may be paired with hedges you can't see
- Position could already be exited by the time you act on the signal — especially for small
  positions that fall below the reporting threshold in later filings
