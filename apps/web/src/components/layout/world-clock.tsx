import { useState, useEffect } from 'react';
import Modal from '../common/modal';
import { cn } from '../../lib/utils';

/* ── Types ───────────────────────────────────── */

interface Market {
  city: string;
  exchange: string;
  timezone: string;
  hours: [number, number];
  flag: string;
  color: string;
  preMarketHours?: [number, number];
  afterHoursRange?: [number, number];
}

type Phase = 'pre-market' | 'open' | 'after-hours' | 'closed';

interface ClockData {
  time: string;
  phase: Phase;
  minutesInDay: number;
  countdown: string;
}

/* ── Markets ─────────────────────────────────── */

const MARKETS: Market[] = [
  {
    city: 'New York',
    exchange: 'NYSE',
    timezone: 'America/New_York',
    hours: [570, 960],
    flag: '\u{1F1FA}\u{1F1F8}',
    color: '#F6B93B',
    preMarketHours: [240, 570],
    afterHoursRange: [960, 1200],
  },
  {
    city: 'London',
    exchange: 'LSE',
    timezone: 'Europe/London',
    hours: [480, 990],
    flag: '\u{1F1EC}\u{1F1E7}',
    color: '#38BDF8',
  },
  {
    city: 'Frankfurt',
    exchange: 'XETRA',
    timezone: 'Europe/Berlin',
    hours: [540, 1050],
    flag: '\u{1F1E9}\u{1F1EA}',
    color: '#A78BFA',
  },
  {
    city: 'Tokyo',
    exchange: 'TSE',
    timezone: 'Asia/Tokyo',
    hours: [540, 900],
    flag: '\u{1F1EF}\u{1F1F5}',
    color: '#FB7185',
  },
  {
    city: 'Hong Kong',
    exchange: 'HKEX',
    timezone: 'Asia/Hong_Kong',
    hours: [570, 960],
    flag: '\u{1F1ED}\u{1F1F0}',
    color: '#FB923C',
  },
  {
    city: 'India',
    exchange: 'NSE',
    timezone: 'Asia/Kolkata',
    hours: [555, 930],
    flag: '\u{1F1EE}\u{1F1F3}',
    color: '#34D399',
  },
];

/* ── Time Helpers ────────────────────────────── */

function getClockData(market: Market): ClockData {
  const now = new Date();
  const { timezone, hours, preMarketHours, afterHoursRange } = market;

  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = timeFmt.formatToParts(now).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now);
  const h = parseInt(parts.hour, 10);
  const m = parseInt(parts.minute, 10);
  const minutesInDay = h * 60 + m;
  const isWeekend = day === 'Sat' || day === 'Sun';

  let phase: Phase = 'closed';
  if (!isWeekend) {
    if (minutesInDay >= hours[0] && minutesInDay < hours[1]) phase = 'open';
    else if (preMarketHours && minutesInDay >= preMarketHours[0] && minutesInDay < preMarketHours[1])
      phase = 'pre-market';
    else if (afterHoursRange && minutesInDay >= afterHoursRange[0] && minutesInDay < afterHoursRange[1])
      phase = 'after-hours';
  }

  return {
    time: timeFmt.format(now),
    phase,
    minutesInDay,
    countdown: fmtCountdown(minutesInDay, hours, phase, isWeekend),
  };
}

function fmtCountdown(min: number, hours: [number, number], phase: Phase, weekend: boolean): string {
  if (weekend) return 'Opens Mon';
  if (phase === 'open') return fmtDur(hours[1] - min, 'Closes');
  if (phase === 'pre-market' || min < hours[0]) return fmtDur(hours[0] - min, 'Opens');
  if (phase === 'after-hours') return `Opens tmrw ${fmtHr(hours[0])}`;
  return `Opens ${fmtHr(hours[0])}`;
}

function fmtDur(totalMin: number, pfx: string): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${pfx} in ${h}h ${m}m` : `${pfx} in ${m}m`;
}

function fmtHr(min: number): string {
  return `${Math.floor(min / 60)
    .toString()
    .padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`;
}

/* ── UTC Helpers ─────────────────────────────── */

function utcOffset(tz: string): number {
  const now = new Date();
  const ps = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const lH = parseInt(ps.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const lM = parseInt(ps.find((p) => p.type === 'minute')?.value ?? '0', 10);
  let off = lH * 60 + lM - (now.getUTCHours() * 60 + now.getUTCMinutes());
  if (off > 720) off -= 1440;
  if (off < -720) off += 1440;
  return off;
}

function toUtcMin(localMin: number, off: number): number {
  return (((localMin - off) % 1440) + 1440) % 1440;
}

/** Convert minutes-in-day to percentage of 24h (0–100) */
function minToPct(min: number): number {
  return (min / 1440) * 100;
}

/* ── Phase Styles ────────────────────────────── */

const PH: Record<Phase, { label: string; dot: string; text: string }> = {
  open: { label: 'Open', dot: 'bg-success animate-pulse', text: 'text-success' },
  'pre-market': { label: 'Pre-Mkt', dot: 'bg-warning animate-pulse', text: 'text-warning' },
  'after-hours': { label: 'After Hrs', dot: 'bg-market animate-pulse', text: 'text-market' },
  closed: { label: 'Closed', dot: 'bg-text-muted/40', text: 'text-text-muted' },
};

/* ── UTC Axis Labels ─────────────────────────── */

const UTC_LABELS = [
  { label: '00', pct: 0 },
  { label: '06', pct: 25 },
  { label: '12', pct: 50 },
  { label: '18', pct: 75 },
  { label: '24', pct: 100 },
];

/* ── Component ───────────────────────────────── */

interface WorldClockProps {
  open: boolean;
  onClose: () => void;
}

export default function WorldClock({ open, onClose }: WorldClockProps) {
  const [tick, setTick] = useState(0);
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((t) => t + 1), 1_000);
    requestAnimationFrame(() => setBarsReady(true));
    return () => {
      clearInterval(id);
      setBarsReady(false);
    };
  }, [open]);

  void tick;

  const now = new Date();
  const utcFrac = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  const nowPct = (utcFrac / 1440) * 100;

  const utcStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const entries = MARKETS.map((market) => {
    const clock = getClockData(market);
    const off = utcOffset(market.timezone);
    const uOpen = toUtcMin(market.hours[0], off);
    const uClose = toUtcMin(market.hours[1], off);

    const uPreOpen = market.preMarketHours ? toUtcMin(market.preMarketHours[0], off) : undefined;
    const uPreClose = market.preMarketHours ? toUtcMin(market.preMarketHours[1], off) : undefined;
    const uAfterOpen = market.afterHoursRange ? toUtcMin(market.afterHoursRange[0], off) : undefined;
    const uAfterClose = market.afterHoursRange ? toUtcMin(market.afterHoursRange[1], off) : undefined;

    return { market, clock, uOpen, uClose, uPreOpen, uPreClose, uAfterOpen, uAfterClose };
  });

  const openCount = entries.filter((e) => e.clock.phase === 'open').length;

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-3xl" aria-labelledby="wc-title">
      {/* ── Header ── */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 id="wc-title" className="font-headline text-xl text-text-primary">
            World Markets
          </h2>
          <p className="mt-1 flex items-center gap-2 text-2xs text-text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            {openCount} of {MARKETS.length} exchanges trading
            <span className="opacity-30">&middot;</span>
            UTC {utcStr}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer text-text-muted transition-colors hover:text-text-primary"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── 24-Hour Horizontal Timeline ── */}
      <div className="mb-6" role="img" aria-label="24-hour trading session timeline">
        {/* UTC axis labels */}
        <div className="flex items-center">
          <div className="w-[76px] shrink-0 mr-3" />
          <div className="relative flex-1 h-4">
            {UTC_LABELS.map(({ label, pct }) => (
              <span
                key={label}
                className="absolute text-3xs text-text-muted/45 font-medium tabular-nums -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Timeline rows */}
        <div className="relative mt-1">
          {/* Vertical "now" cursor — spans the track area only */}
          <div
            className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{ left: `calc(88px + (100% - 88px) * ${nowPct / 100})` }}
          >
            <div
              className="absolute -top-1 -bottom-1 w-px bg-text-primary/50"
              style={{ boxShadow: '0 0 6px rgba(255,255,255,0.15)' }}
            />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-text-primary/70" />
          </div>

          {/* Market rows */}
          {entries.map(({ market, clock, uOpen, uClose, uPreOpen, uPreClose, uAfterOpen, uAfterClose }, i) => {
            const active = clock.phase !== 'closed';

            /* Compute segment positions as percentages */
            const coreLeft = minToPct(uOpen);
            let coreWidth = minToPct(uClose) - coreLeft;
            if (coreWidth < 0) coreWidth += 100;

            let preLeft: number | undefined;
            let preWidth: number | undefined;
            if (uPreOpen !== undefined && uPreClose !== undefined) {
              preLeft = minToPct(uPreOpen);
              preWidth = minToPct(uPreClose) - preLeft;
              if (preWidth < 0) preWidth += 100;
            }

            let afterLeft: number | undefined;
            let afterWidth: number | undefined;
            if (uAfterOpen !== undefined && uAfterClose !== undefined) {
              afterLeft = minToPct(uAfterOpen);
              afterWidth = minToPct(uAfterClose) - afterLeft;
              if (afterWidth < 0) afterWidth += 100;
            }

            return (
              <div
                key={market.exchange}
                className="flex items-center gap-3 py-[7px]"
                style={{
                  animation: 'waterfall-in 0.3s ease-out both',
                  animationDelay: `${i * 60}ms`,
                }}
              >
                {/* Market label */}
                <div className="w-[76px] shrink-0 text-right">
                  <span
                    className={cn(
                      'text-2xs font-medium transition-opacity duration-300',
                      active ? 'text-text-primary' : 'text-text-muted/50',
                    )}
                  >
                    {market.city}
                  </span>
                </div>

                {/* Track */}
                <div className="relative flex-1 h-[6px]">
                  {/* Background track line */}
                  <div className="absolute inset-0 rounded-full bg-border/20" />

                  {/* Pre-market segment (dimmer) */}
                  {preLeft !== undefined && preWidth !== undefined && (
                    <div
                      className="absolute top-[1px] h-[4px] rounded-full transition-all duration-700"
                      style={{
                        left: `${preLeft}%`,
                        width: barsReady ? `${preWidth}%` : '0%',
                        backgroundColor: market.color,
                        opacity: active && clock.phase === 'pre-market' ? 0.4 : 0.15,
                        transitionDelay: `${i * 80}ms`,
                      }}
                    />
                  )}

                  {/* Core trading hours segment */}
                  <div
                    className="absolute inset-y-0 rounded-full transition-all duration-700"
                    style={{
                      left: `${coreLeft}%`,
                      width: barsReady ? `${coreWidth}%` : '0%',
                      backgroundColor: market.color,
                      opacity: active ? 1 : 0.25,
                      transitionDelay: `${i * 80}ms`,
                      boxShadow: active ? `0 0 8px ${market.color}40` : undefined,
                    }}
                  />

                  {/* After-hours segment (dimmer) */}
                  {afterLeft !== undefined && afterWidth !== undefined && (
                    <div
                      className="absolute top-[1px] h-[4px] rounded-full transition-all duration-700"
                      style={{
                        left: `${afterLeft}%`,
                        width: barsReady ? `${afterWidth}%` : '0%',
                        backgroundColor: market.color,
                        opacity: active && clock.phase === 'after-hours' ? 0.4 : 0.15,
                        transitionDelay: `${i * 80}ms`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Market Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {entries.map(({ market, clock }, i) => {
          const active = clock.phase !== 'closed';
          const ph = PH[clock.phase];
          return (
            <div
              key={market.exchange}
              className={cn(
                'flex flex-col gap-1 rounded-lg border border-border px-3 py-2.5 transition-all duration-300',
                active ? 'bg-bg-card/50' : 'bg-transparent opacity-45',
              )}
              style={{
                animation: 'waterfall-in 0.3s ease-out both',
                animationDelay: `${500 + i * 60}ms`,
              }}
            >
              {/* City + exchange */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm leading-none">{market.flag}</span>
                  <span className="text-xs font-medium text-text-primary">{market.city}</span>
                </div>
                <span className="text-3xs text-text-muted">{market.exchange}</span>
              </div>

              {/* Local time */}
              <div className="text-lg tabular-nums font-light text-text-primary tracking-tight leading-tight">
                {clock.time}
              </div>

              {/* Status + countdown */}
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1 w-1 rounded-full', ph.dot)} />
                <span className={cn('text-3xs font-medium', ph.text)}>{ph.label}</span>
                <span className="ml-auto text-3xs text-text-muted/60 truncate">{clock.countdown}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
