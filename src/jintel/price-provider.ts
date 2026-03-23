import type { JintelClient } from './client.js';
import type { PriceOutcome, PriceProvider } from '../memory/types.js';

export function createJintelPriceProvider(client: JintelClient): PriceProvider {
  return async (ticker: string, _since: Date): Promise<PriceOutcome> => {
    const result = await client.quotes([ticker]);
    if (!result.success) {
      throw new Error(`Failed to fetch price for ${ticker}: ${result.error}`);
    }
    const quote = result.data.find((q) => q.ticker === ticker);
    if (!quote) {
      throw new Error(`No quote returned for ticker "${ticker}"`);
    }
    const priceAtAnalysis = quote.previousClose ?? quote.open ?? quote.price;
    const priceNow = quote.price;
    const returnPct = priceAtAnalysis !== 0 ? ((priceNow - priceAtAnalysis) / priceAtAnalysis) * 100 : 0;
    return {
      priceAtAnalysis,
      priceNow,
      returnPct,
      highInPeriod: quote.high ?? priceNow,
      lowInPeriod: quote.low ?? priceNow,
    };
  };
}
