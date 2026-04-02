import type { Action } from '../../../src/actions/types.js';
import { chunkMessage as chunkMessageBase, escapeHtml } from '../../../src/formatting/index.js';
import type { InsightReport } from '../../../src/insights/types.js';
import type { Snap } from '../../../src/snap/types.js';

export { escapeHtml } from '../../../src/formatting/index.js';

const TELEGRAM_LIMIT = 4096;

export function chunkMessage(text: string, limit = TELEGRAM_LIMIT): string[] {
  return chunkMessageBase(text, limit);
}

export function formatSnap(snap: Snap): string {
  const lines: string[] = ['\u{1F4CB} <b>Snap Brief</b>'];

  if (snap.intelSummary) {
    lines.push('', escapeHtml(snap.intelSummary), '');
  }

  if (snap.actionItems.length > 0) {
    lines.push('<b>Actions:</b>');
    for (const item of snap.actionItems) {
      lines.push(`\u{2022} ${escapeHtml(item.text)}`);
    }
  }

  return lines.join('\n');
}

export function formatAction(action: Action): string {
  return [
    '\u{26A1} <b>New Action</b>',
    '',
    escapeHtml(action.what),
    '',
    `<i>Why:</i> ${escapeHtml(action.why)}`,
    `<i>Source:</i> ${escapeHtml(action.source)}`,
  ].join('\n');
}

export function formatInsight(report: InsightReport): string {
  const lines: string[] = ['\u{1F4CA} <b>Daily Insights Report</b>', ''];

  if (report.portfolio) {
    lines.push(`<b>Health:</b> ${escapeHtml(report.portfolio.overallHealth)}`);
    lines.push(escapeHtml(report.portfolio.summary));
    lines.push('');
  }

  for (const pos of report.positions.slice(0, 5)) {
    lines.push(`<code>${escapeHtml(pos.symbol)}</code>: ${escapeHtml(pos.rating)} — ${escapeHtml(pos.thesis)}`);
  }
  if (report.positions.length > 5) {
    lines.push(`...and ${report.positions.length - 5} more positions`);
  }

  return lines.join('\n');
}
