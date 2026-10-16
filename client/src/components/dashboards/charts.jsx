import { useTranslation } from 'react-i18next';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CHART_COLORS, compactNumber } from '../../utils/charts.js';
import { formatMoney, formatNumber } from '../../utils/format.js';

const AXIS = { fontSize: 12, fill: '#55657e' };
const GRID = '#e5ebf2';

function ChartTooltip({ active, payload, label, money, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label !== undefined && label !== '' && <div className="chart-tooltip__label">{labelFormatter ? labelFormatter(label) : label}</div>}
      {payload.map((item) => (
        <div key={item.dataKey ?? item.name} className="chart-tooltip__row">
          <span className="chart-tooltip__swatch" style={{ background: item.color ?? item.payload?.fill }} />
          <span>{item.name}</span>
          <strong className="mono">{money ? `TZS ${formatMoney(item.value)}` : formatNumber(item.value, 1)}</strong>
        </div>
      ))}
    </div>
  );
}

/** The data row behind a clicked Recharts element (Bar/Pie hand back props wrapping the original row). */
function rowOf(entry) {
  return entry?.payload && typeof entry.payload === 'object' ? entry.payload : entry;
}

/**
 * Donut with the total in the centre and a clickable legend list beside it.
 * `data` is [{ key, name, value }]; `onSelect(row)` makes slices and legend items clickable.
 */
export function DonutChart({ data, onSelect, money = false, centerLabel, height = 220 }) {
  const { t } = useTranslation();
  const rows = data.filter((row) => row.value > 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (total === 0) return <p className="chart-empty">{t('charts.noData')}</p>;
  return (
    <div className="donut">
      <div className="donut__chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
              onClick={onSelect ? (entry) => onSelect(rowOf(entry)) : undefined}
              cursor={onSelect ? 'pointer' : undefined}
            >
              {rows.map((row, index) => <Cell key={row.key} fill={row.color ?? CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip money={money} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut__center" aria-hidden="true">
          <strong className="mono">{money ? compactNumber(total) : formatNumber(total, 0)}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="donut__legend">
        {rows.map((row, index) => {
          const share = Math.round((row.value / total) * 1000) / 10;
          const content = (
            <>
              <span className="donut__swatch" style={{ background: row.color ?? CHART_COLORS[index % CHART_COLORS.length] }} />
              <span className="donut__name">{row.name}</span>
              <span className="donut__value mono">{money ? formatMoney(row.value) : formatNumber(row.value, 0)}</span>
              <span className="donut__share mono">{share}%</span>
            </>
          );
          return (
            <li key={row.key}>
              {onSelect
                ? <button type="button" className="donut__item" onClick={() => onSelect(row)}>{content}</button>
                : <span className="donut__item">{content}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Vertical bar chart. `bars` is [{ key, name, color }]; `stacked` stacks them.
 * Clicking a bar calls `onSelect(row)` with the data row.
 */
export function BarChartCard({ data, xKey, bars, onSelect, money = false, stacked = false, height = 260 }) {
  const { t } = useTranslation();
  if (!data.length) return <p className="chart-empty">{t('charts.noData')}</p>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} interval={0} height={40}
            tickFormatter={(value) => (String(value).length > 10 ? `${String(value).slice(0, 9)}…` : value)} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={compactNumber} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(11, 37, 69, 0.05)' }} content={<ChartTooltip money={money} />} />
          {bars.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {bars.map((bar, index) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color}
              stackId={stacked ? 'stack' : undefined}
              radius={stacked && index < bars.length - 1 ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              maxBarSize={44}
              isAnimationActive={false}
              cursor={onSelect ? 'pointer' : undefined}
              onClick={onSelect ? (entry) => onSelect(rowOf(entry)) : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Dot (line-with-points) chart over months. `lines` is [{ key, name, color }].
 * Clicking a point (or anywhere in its column) calls `onSelect(row)`.
 */
export function DotChart({ data, xKey, lines, onSelect, money = false, height = 260, labelFormatter }) {
  const { t } = useTranslation();
  if (!data.length) return <p className="chart-empty">{t('charts.noData')}</p>;
  const handleClick = (state) => {
    if (!onSelect || !state) return;
    const index = state.activeIndex !== undefined && state.activeIndex !== null ? Number(state.activeIndex) : -1;
    const row = data[index] ?? data.find((entry) => entry[xKey] === state.activeLabel);
    if (row) onSelect(row);
  };
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} onClick={handleClick}
          style={onSelect ? { cursor: 'pointer' } : undefined}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={labelFormatter} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={compactNumber} />
          <Tooltip content={<ChartTooltip money={money} labelFormatter={labelFormatter} />} />
          {lines.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
              activeDot={{ r: 7 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Card wrapper for a chart with title, optional caption and header action. */
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
