/** Shared formatting helpers for display card formatters. */

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function fmtCurrency(n: number): string {
  return currencyFmt.format(n);
}

export function fmtPnl(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function pnlEmoji(n: number): string {
  return n >= 0 ? '\u{1F4C8}' : '\u{1F4C9}';
}
