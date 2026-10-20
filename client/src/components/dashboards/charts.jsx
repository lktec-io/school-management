import { useTranslation } from 'react-i18next';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compactNumber } from '../../utils/charts.js';
import { formatMoney, formatNumber } from '../../utils/format.js';

const AXIS = { fontSize: 12, fill: '#64748b' };
const GRID = '#e2e8f0';

function ChartTooltip({ active, payload, label, money, percent, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label !== undefined && label !== '' && <div className="chart-tooltip__label">{labelFormatter ? labelFormatter(label) : label}</div>}
      {payload.map((item) => (
        <div key={item.dataKey ?? item.name} className="chart-tooltip__row">
          <span className="chart-tooltip__swatch" style={{ background: item.color }} />
          <span>{item.name}</span>
          <strong className="mono">
            {money ? `TZS ${formatMoney(item.value)}` : percent ? `${formatNumber(item.value, 1)}%` : formatNumber(item.value, 1)}
          </strong>
        </div>
      ))}
    </div>
  );
}

/**
 * Smooth trend line (e.g. "Mwenendo wa Matokeo"). `lines` is [{ key, name, color }].
 * Clicking a point (or its column) calls `onSelect(row)`.
 */
export function TrendChart({ data, xKey, lines, onSelect, money = false, percent = false, height = 280, labelFormatter, emptyText }) {
  const { t } = useTranslation();
  if (!data.length) return <p className="chart-empty">{emptyText ?? t('charts.noData')}</p>;
  const handleClick = (state) => {
    if (!onSelect || !state) return;
    const index = state.activeIndex !== undefined && state.activeIndex !== null ? Number(state.activeIndex) : -1;
    const row = data[index] ?? data.find((entry) => entry[xKey] === state.activeLabel);
    if (row) onSelect(row);
  };
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }} onClick={handleClick}
          style={onSelect ? { cursor: 'pointer' } : undefined}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={labelFormatter} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44}
            tickFormatter={percent ? (value) => `${value}%` : compactNumber} domain={percent ? [0, 100] : ['auto', 'auto']} />
          <Tooltip content={<ChartTooltip money={money} percent={percent} labelFormatter={labelFormatter} />} />
          {lines.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2.5}
              dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }}
              activeDot={{ r: 6 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Card wrapper for a chart or table with title, optional caption and header action. */
export function ChartCard({ title, caption, action, children, className = '' }) {
  return (
    <section className={`card chart-card ${className}`}>
      <div className="card__header">
        <div>
          <h2 className="card__title">{title}</h2>
          {caption && <p className="card__caption">{caption}</p>}
        </div>
        {action}
      </div>
      <div className="card__body">{children}</div>
    </section>
  );
}
