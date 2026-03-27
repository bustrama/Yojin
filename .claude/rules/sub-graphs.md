# Sub-Graph Usage

## Prefer nested sub-graphs over separate top-level queries

When a client (Yojin or any consumer) needs data from multiple domains for the same ticker/entity, use nested sub-graphs instead of separate queries. This reduces round trips and lets Mercurius loaders batch and deduplicate upstream calls.

### Available sub-graphs

| Parent Type | Sub-graph | Data |
|---|---|---|
| `Entity` | `market` | Quote, fundamentals, history |
| `Entity` | `risk` | OFAC sanctions, risk signals |
| `Entity` | `regulatory` | Sanctions, SEC filings |
| `Entity` | `corporate` | Legal name, officers, jurisdiction |
| `Entity` | `technicals` | RSI, MACD, BB, EMA, SMA, ATR, VWMA, MFI |
| `Entity` | `derivatives` | Futures curve, options chain (crypto only) |
| `Entity` | `news` | News articles via Serper |
| `Entity` | `research` | Web research via Exa |
| `MarketQuote` | `technicals` | Technical indicators |
| `MarketQuote` | `derivatives` | Derivatives data (crypto only) |
| `CryptoQuote` | `technicals` | Technical indicators |
| `CryptoQuote` | `derivatives` | Derivatives data |

### Do

```graphql
# Single call gets everything
query {
  quotes(tickers: ["AAPL", "BTC"]) {
    price changePercent
    technicals { rsi macd { histogram } }
    derivatives { futures { expiration price } }
  }
}
```

### Don't

```graphql
# Separate calls for the same tickers — wasteful
query { quotes(tickers: ["AAPL"]) { price } }
query { technicalsBatch(tickers: ["AAPL"]) { rsi } }
```

### When adding new data sources

When creating a new connector that provides entity-level data:
1. Wire it as a sub-graph on `Entity` (loader in `entityLoaders.Entity`)
2. If the data is also useful on `MarketQuote` or `CryptoQuote`, add it there too using the shared loader factories (`createTechnicalsLoader`, `createDerivativesLoader`, or a new factory)
3. Top-level queries are still fine for standalone use cases (e.g. `sanctionsScreen` for ad-hoc screening without an entity)
