/** Shared formatting helpers for display card formatters. */

export function fmtCurrency(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return n < 0 ? `-${formatted}` : formatted;
}

export function fmtPnl(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function pnlEmoji(n: number): string {
  return n >= 0 ? '\u{1F4C8}' : '\u{1F4C9}';
}
