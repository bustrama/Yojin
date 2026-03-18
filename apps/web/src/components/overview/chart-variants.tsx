import { useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const timeRanges = ['1D', '1W', '1M', '3M', '1Y', 'ALL'] as const;
type TimeRange = (typeof timeRanges)[number];

const RANGE_DAYS: Record<TimeRange, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
  ALL: 730,
};

function generateMockData(days: number) {
  const data: { date: string; value: number }[] = [];
  let value = 106000;
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const label = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    value += (Math.random() - 0.35) * 1200;
    value = Math.max(value, 104000);
    data.push({ date: label, value: Math.round(value * 100) / 100 });
  }

  data[data.length - 1].value = 124850.32;
  return data;
}

function TimeRangeButtons({
  activeRange,
  onRangeChange,
}: {
  activeRange: TimeRange;
  onRangeChange: (r: TimeRange) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {timeRanges.map((range) => (
        <button
          key={range}
          onClick={() => onRangeChange(range)}
          className={cn(
            'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
            activeRange === range ? 'bg-accent-primary text-white' : 'text-text-muted hover:text-text-secondary',
          )}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  color: 'var(--color-text-primary)',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Recharts Formatter type is overly strict
const formatValue: any = (value: number | string) => [
  `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  'Value',
];

/** Variant A — Sparkline: ultra-minimal, no axes or grid, just the gradient shape */
export function ChartVariantA() {
  const [activeRange, setActiveRange] = useState<TimeRange>('1M');
  const chartData = useMemo(() => generateMockData(RANGE_DAYS[activeRange]), [activeRange]);

  return (
    <div className="flex min-h-[80px] flex-1 flex-col rounded-lg border border-border bg-bg-card px-3 pt-2 pb-1">
      <div className="mb-1 flex flex-shrink-0 items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">A — Sparkline</h3>
        <TimeRangeButtons activeRange={activeRange} onRangeChange={setActiveRange} />
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF5A5E" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#FF5A5E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip contentStyle={tooltipStyle} formatter={formatValue} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#FF5A5E"
              strokeWidth={1.5}
              fill="url(#sparkGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Variant B — Clean line: thin line, subtle horizontal grid, compact axis labels */
export function ChartVariantB() {
  const [activeRange, setActiveRange] = useState<TimeRange>('1M');
  const chartData = useMemo(() => generateMockData(RANGE_DAYS[activeRange]), [activeRange]);

  return (
    <div className="flex min-h-[80px] flex-1 flex-col rounded-lg border border-border bg-bg-card px-3 pt-2 pb-1">
      <div className="mb-1 flex flex-shrink-0 items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">B — Clean Line</h3>
        <TimeRangeButtons activeRange={activeRange} onRangeChange={setActiveRange} />
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={['dataMin - 2000', 'dataMax + 2000']}
              tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={formatValue} />
            <Line type="monotone" dataKey="value" stroke="#FF5A5E" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Variant C — Filled area with baseline reference: gradient fill, dashed baseline at start value */
export function ChartVariantC() {
  const [activeRange, setActiveRange] = useState<TimeRange>('1M');
  const chartData = useMemo(() => generateMockData(RANGE_DAYS[activeRange]), [activeRange]);
  const baselineValue = chartData[0]?.value ?? 0;

  return (
    <div className="flex min-h-[80px] flex-1 flex-col rounded-lg border border-border bg-bg-card px-3 pt-2 pb-1">
      <div className="mb-1 flex flex-shrink-0 items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">C — Area + Baseline</h3>
        <TimeRangeButtons activeRange={activeRange} onRangeChange={setActiveRange} />
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="areaBaseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF5A5E" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#FF5A5E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} opacity={0.4} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={['dataMin - 2000', 'dataMax + 2000']}
              tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
            />
            <ReferenceLine
              y={baselineValue}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={formatValue} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#FF5A5E"
              strokeWidth={2}
              fill="url(#areaBaseGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Variant D — Bar chart: daily value bars with subtle gradient, good for shorter ranges */
export function ChartVariantD() {
  const [activeRange, setActiveRange] = useState<TimeRange>('1M');
  const chartData = useMemo(() => generateMockData(RANGE_DAYS[activeRange]), [activeRange]);

  return (
    <div className="flex min-h-[80px] flex-1 flex-col rounded-lg border border-border bg-bg-card px-3 pt-2 pb-1">
      <div className="mb-1 flex flex-shrink-0 items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">D — Bar Chart</h3>
        <TimeRangeButtons activeRange={activeRange} onRangeChange={setActiveRange} />
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF5A5E" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#FF5A5E" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} opacity={0.4} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={['dataMin - 2000', 'dataMax + 2000']}
              tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={formatValue} />
            <Bar dataKey="value" fill="url(#barGrad)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
