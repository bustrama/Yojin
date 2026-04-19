import type { PositionInsight, InsightRating } from '../../api/types';

const RATING_LABEL: Record<InsightRating, string> = {
  VERY_BULLISH: 'Very Bullish',
  BULLISH: 'Bullish',
  NEUTRAL: 'Neutral',
  BEARISH: 'Bearish',
  VERY_BEARISH: 'Very Bearish',
};

// App theme colors (src/index.css — dark theme @theme tokens)
const COLOR = {
  bgPrimary: '#1a1a1a',
  bgCard: '#262626',
  bgTertiary: '#2d2d2d',
  border: '#3d3d3d',
  textPrimary: '#f5f5f4',
  textSecondary: '#a8a8a8',
  textMuted: '#737373',
  accent: '#ff5a5e',
  success: '#5bb98c',
  error: '#e57373',
  warning: '#d4a34a',
};

const RATING_COLOR: Record<InsightRating, string> = {
  VERY_BULLISH: COLOR.success,
  BULLISH: COLOR.success,
  NEUTRAL: COLOR.textSecondary,
  BEARISH: COLOR.error,
  VERY_BEARISH: COLOR.error,
};

const CARD_WIDTH = 380;
const SITE_URL = 'yojin.ai';

interface ShareCardProps {
  insight: PositionInsight;
}

/**
 * Compact share card using the app's storybook theme colors and logo.
 * Fixed width (540px), height grows with content so every safe field fits.
 * Only reads safe fields — no portfolio values, no memoryContext, no priceTarget.
 */
export function ShareCard({ insight }: ShareCardProps) {
  const rating = RATING_LABEL[insight.rating];
  const ratingColor = RATING_COLOR[insight.rating];
  const convictionPct = Math.round(insight.conviction * 100);

  return (
    <div
      style={{
        width: CARD_WIDTH,
        background: COLOR.bgPrimary,
        color: COLOR.textPrimary,
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        padding: 16,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header: logo + brand + URL */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img
            src="/brand/yojin_icon_color.png"
            width={16}
            height={16}
            alt=""
            style={{ borderRadius: 4, display: 'block' }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: COLOR.textPrimary }}>Yojin</span>
        </div>
        <span style={{ fontSize: 10, color: COLOR.accent, fontWeight: 600 }}>{SITE_URL}</span>
      </div>

      {/* Ticker + rating */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1,
              color: COLOR.textPrimary,
              letterSpacing: '-0.03em',
            }}
          >
            ${insight.symbol}
          </div>
          {insight.name && insight.name !== insight.symbol && (
            <div style={{ fontSize: 11, color: COLOR.textSecondary, fontWeight: 500 }}>{insight.name}</div>
          )}
        </div>
        <div
          style={{
            backgroundColor: `${ratingColor}22`,
            color: ratingColor,
            border: `1px solid ${ratingColor}66`,
            padding: '2px 8px',
            borderRadius: 9999,
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {rating}
        </div>
      </div>

      {/* Conviction */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            color: COLOR.textMuted,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
            minWidth: 58,
          }}
        >
          Conviction
        </span>
        <div
          style={{
            flex: 1,
            height: 3,
            backgroundColor: COLOR.bgTertiary,
            borderRadius: 9999,
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${convictionPct}%`, height: '100%', background: ratingColor }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: COLOR.textPrimary, minWidth: 28, textAlign: 'right' }}>
          {convictionPct}%
        </span>
      </div>

      {/* Thesis */}
      <Section label="Thesis">
        <p style={{ fontSize: 11, lineHeight: 1.45, color: COLOR.textPrimary, margin: 0, fontWeight: 400 }}>
          {insight.thesis}
        </p>
      </Section>

      {/* Opportunities */}
      {insight.opportunities.length > 0 && (
        <Section label="Opportunities">
          <ul style={listStyle}>
            {insight.opportunities.map((o, i) => (
              <Item key={`o${i}`} text={o} color={COLOR.success} mark="+" />
            ))}
          </ul>
        </Section>
      )}

      {/* Risks */}
      {insight.risks.length > 0 && (
        <Section label="Risks">
          <ul style={listStyle}>
            {insight.risks.map((r, i) => (
              <Item key={`r${i}`} text={r} color={COLOR.error} mark="!" />
            ))}
          </ul>
        </Section>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTop: `1px solid ${COLOR.border}`,
          fontSize: 9,
          color: COLOR.textMuted,
        }}
      >
        <span>— generated by Yojin</span>
        <span style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>Not investment advice</span>
      </div>
    </div>
  );
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

function Item({ text, color, mark }: { text: string; color: string; mark: string }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 12,
        lineHeight: 1.45,
        color: COLOR.textPrimary,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 16,
          height: 16,
          borderRadius: 9999,
          background: `${color}22`,
          color,
          fontSize: 10,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {mark}
      </span>
      <span style={{ flex: 1 }}>{text}</span>
    </li>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          color: COLOR.textMuted,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
