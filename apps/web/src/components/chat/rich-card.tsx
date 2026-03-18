import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/* ─── RichCard (outer container) ─── */

interface RichCardRootProps {
  children: ReactNode;
  className?: string;
}

function RichCardRoot({ children, className }: RichCardRootProps) {
  return <div className={cn('overflow-hidden rounded-2xl border border-border bg-bg-card', className)}>{children}</div>;
}

/* ─── Header ─── */

interface HeaderProps {
  icon?: ReactNode;
  title: string;
  badge?: string;
}

function Header({ icon, title, badge }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 pt-5 pb-4">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-lg">{icon}</span>}
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      </div>
      {badge && (
        <span className="rounded-md border border-accent-primary/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-primary">
          {badge}
        </span>
      )}
    </div>
  );
}

/* ─── Body (description text) ─── */

interface BodyProps {
  children: ReactNode;
}

function Body({ children }: BodyProps) {
  return (
    <div className="px-6 pb-5">
      <p className="text-sm leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}

/* ─── Stats row ─── */

interface StatItem {
  value: string;
  label: string;
  highlight?: boolean;
}

interface StatsProps {
  items: StatItem[];
}

function Stats({ items }: StatsProps) {
  return (
    <div className="grid gap-3 px-6 pb-5" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-bg-secondary px-4 py-4 text-center">
          <div className={cn('text-2xl font-bold', item.highlight ? 'text-accent-primary' : 'text-text-primary')}>
            {item.value}
          </div>
          <div className="mt-1.5 text-xs text-text-muted">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Data table ─── */

interface TableColumn {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
}

interface TableRow {
  [key: string]: ReactNode;
}

interface TableProps {
  columns: TableColumn[];
  rows: TableRow[];
}

function Table({ columns, rows }: TableProps) {
  const alignClass = (align?: string) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="px-6 pb-5">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'pb-3 text-[11px] font-medium uppercase tracking-wider text-text-muted',
                  alignClass(col.align),
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className={cn('py-3 text-sm text-text-primary', alignClass(col.align))}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Divider ─── */

function Divider() {
  return <div className="mx-6 border-t border-border/40" />;
}

/* ─── Section label ─── */

interface SectionLabelProps {
  children: ReactNode;
}

function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="px-6 pt-4 pb-3 text-[11px] font-medium uppercase tracking-wider text-text-muted">{children}</div>
  );
}

/* ─── Related Documents ─── */

interface DocumentItem {
  icon?: ReactNode;
  title: string;
  subtitle: string;
}

interface DocumentsProps {
  label?: string;
  items: DocumentItem[];
}

function Documents({ label = 'Related Documents', items }: DocumentsProps) {
  return (
    <div className="px-6 pb-5">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((doc) => (
          <div
            key={doc.title}
            className="flex items-center gap-3 rounded-xl border border-border bg-bg-secondary px-4 py-3"
          >
            {doc.icon && <span className="text-text-muted">{doc.icon}</span>}
            <div>
              <div className="text-sm font-medium text-text-primary">{doc.title}</div>
              <div className="text-xs text-text-muted">{doc.subtitle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Suggested Actions ─── */

interface ActionsProps {
  label?: string;
  actions: Array<{ label: string; onClick?: () => void }>;
}

function Actions({ label = 'Suggested Actions', actions }: ActionsProps) {
  return (
    <div className="px-6 pb-6">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</div>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="cursor-pointer rounded-xl border border-border px-5 py-2.5 text-sm text-text-primary transition-colors hover:border-border-light hover:bg-bg-hover"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Compound export ─── */

const RichCard = Object.assign(RichCardRoot, {
  Header,
  Body,
  Stats,
  Table,
  Divider,
  SectionLabel,
  Documents,
  Actions,
});

export default RichCard;
