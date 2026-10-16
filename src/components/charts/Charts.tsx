'use client';
/**
 * Chart kit (no library – plain SVG/HTML, so it works offline and in demo mode).
 * Rules (dataviz method): color by job, validated categorical slots in fixed order (--viz-1..4, light + dark steps),
 * one y-axis, thin marks (2px lines, ≤24px bars, 4px rounded data ends, 2px surface gaps), hairline solid grid,
 * text in ink tokens never series color, legend for 2+ series, hover + keyboard tooltips, and a table view for every chart.
 */
import { useId, useMemo, useState, type ReactNode } from 'react';
import { compact, niceMax } from '@/lib/members/overview';

export type Fmt = (v: number) => string;
const fmtN: Fmt = (v) => v.toLocaleString('en-US');
const pctOf = (v: number, t: number) => (t ? `${Math.round((v / t) * 100)}%` : '0%');

/** Card frame shared by every chart: title, one-line takeaway, body, table view. */
export function ChartCard({ title, note, children, table, className = '', id }: { title: string; note?: ReactNode; children: ReactNode; table?: { head: string[]; rows: (string | number)[][] }; className?: string; id?: string }) {
  return (
    <section className={`viz-card glass-pane ${className}`} aria-labelledby={id ? `${id}-h` : undefined} data-chart={id}>
      <header className="viz-head"><h2 id={id ? `${id}-h` : undefined}>{title}</h2>{note && <p>{note}</p>}</header>
      {children}
      {table && (
        <details className="viz-table"><summary>Show as a table</summary>
          <table><thead><tr>{table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{typeof c === 'number' ? fmtN(c) : c}</td>)}</tr>)}</tbody></table>
        </details>
      )}
    </section>
  );
}

/** Stat tile: label · value · note, with an optional sparkline or meter. */
export function StatTile({ label, value, note, tone, spark, meter, hero, id }: { label: string; value: string; note?: ReactNode; tone?: 'up' | 'down'; spark?: number[]; meter?: { value: number; of: number }; hero?: boolean; id?: string }) {
  return (
    <section className={`viz-tile glass-pane${hero ? ' hero' : ''}`} data-tile={id}>
      <span className="viz-tile-label">{label}</span>
      <span className="viz-tile-row"><b className="viz-tile-value">{value}</b>{spark && spark.length > 1 && <Spark values={spark} />}</span>
      {note && <small className={`viz-tile-note${tone ? ` ${tone}` : ''}`}>{tone === 'up' ? '▲ ' : tone === 'down' ? '▼ ' : ''}{note}</small>}
      {meter && <span className="viz-meter" role="meter" aria-valuenow={meter.value} aria-valuemin={0} aria-valuemax={meter.of} aria-label={label}><span style={{ width: `${Math.min(100, (meter.value / Math.max(1, meter.of)) * 100)}%` }} /></span>}
    </section>
  );
}
function Spark({ values }: { values: number[] }) {
  const W = 120, H = 30, max = Math.max(...values) || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 3 - (v / max) * (H - 6)]);
  return (
    <svg className="viz-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={`M${pts.map((p) => p.join(',')).join(' L')}`} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" />
    </svg>
  );
}

/* ---------- line (one or two series, monotone curve, crosshair tooltip) ---------- */
export type Series = { id: string; name: string; values: (number | null)[]; slot: number; area?: boolean };
/** Monotone cubic (Fritsch–Carlson): smooth, but never overshoots the data. */
function monotone(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  const n = pts.length, d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let out = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (pts[i + 1][0] - pts[i][0]) / 3;
    out += ` C${pts[i][0] + h},${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return out;
}

export function LineChart({ labels, series, format = fmtN, height = 240, label }: { labels: string[]; series: Series[]; format?: Fmt; height?: number; label: string }) {
  const W = 640, H = height, P = { l: 44, r: 72, t: 14, b: 28 };
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v != null))));
  const step = (W - P.l - P.r) / Math.max(1, labels.length - 1);
  const x = (i: number) => P.l + i * step;
  const y = (v: number) => H - P.b - (v / top) * (H - P.t - P.b);
  const ticks = [0, top / 2, top];
  const every = labels.length > 12 ? Math.ceil(labels.length / 8) : 1;
  const lines = useMemo(() => series.map((s) => {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)] as [number, number])).filter((p): p is [number, number] => !!p);
    const last = s.values.reduce<number>((b, v, i) => (v == null ? b : i), -1);
    return { s, pts, d: monotone(pts), last };
  }), [series, top, W, H]); // eslint-disable-line react-hooks/exhaustive-deps
  const multi = series.length > 1;
  return (
    <figure className="viz-fig">
      {multi && <ul className="viz-legend" aria-label="Legend">{series.map((s) => <li key={s.id}><i className={`key-line vs${s.slot}`} aria-hidden="true" />{s.name}</li>)}</ul>}
      <div className="viz-box" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}. ${series.map((s) => `${s.name}: ${s.values.map((v, i) => (v == null ? '' : `${labels[i]} ${format(v)}`)).filter(Boolean).join(', ')}`).join('. ')}`}>
          <defs>{series.filter((s) => s.area).map((s) => (
            <linearGradient key={s.id} id={`${gid}-${s.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className={`stop vs${s.slot}`} stopOpacity=".22" /><stop offset="1" className={`stop vs${s.slot}`} stopOpacity="0" /></linearGradient>
          ))}</defs>
          {ticks.map((t) => <g key={t}><line className="viz-grid" x1={P.l} x2={W - P.r + 8} y1={y(t)} y2={y(t)} /><text className="viz-axis" x={P.l - 8} y={y(t) + 4} textAnchor="end">{compact(t)}</text></g>)}
          <line className="viz-base" x1={P.l} x2={W - P.r + 8} y1={H - P.b} y2={H - P.b} />
          {labels.map((l, i) => (i % every === 0 || i === labels.length - 1) && <text key={l} className="viz-axis" x={x(i)} y={H - 8} textAnchor="middle">{l}</text>)}
          {lines.map(({ s, pts, d }) => s.area && pts.length > 1 && <path key={`a${s.id}`} d={`${d} L${pts[pts.length - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`} fill={`url(#${gid}-${s.id})`} />)}
          {lines.map(({ s, d }) => <path key={s.id} d={d} className={`viz-line vs${s.slot}`} />)}
          {hover != null && <line className="viz-cross" x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} />}
          {lines.map(({ s, last }) => {
            const i = hover ?? last; const v = s.values[i];
            return v == null ? null : <circle key={`d${s.id}`} cx={x(i)} cy={y(v)} r="4.5" className={`viz-dot vs${s.slot}`} />;
          })}
          {hover == null && lines.map(({ s, last }) => last >= 0 && (!multi || s.area) && (
            <text key={`l${s.id}`} className="viz-end" x={x(last) + (multi ? 0 : 10)} y={y(s.values[last]!) + (multi ? -12 : 4)} textAnchor={multi ? 'middle' : 'start'}>{format(s.values[last]!)}</text>
          ))}
          {labels.map((l, i) => <rect key={`h${l}`} className="viz-hit" x={x(i) - step / 2} y={0} width={step} height={H} tabIndex={0} aria-label={`${l}: ${series.map((s) => `${s.name} ${s.values[i] == null ? 'no data' : format(s.values[i]!)}`).join(', ')}`}
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />)}
        </svg>
        {hover != null && (
          <div className="viz-tip" role="status" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(P.t / H) * 100}%` }} data-side={x(hover) > W * 0.62 ? 'left' : 'right'}>
            <span className="viz-tip-h">{labels[hover]}</span>
            {series.map((s) => <span key={s.id} className="viz-tip-row"><i className={`key-line vs${s.slot}`} aria-hidden="true" /><b>{s.values[hover] == null ? '—' : format(s.values[hover]!)}</b>{s.name}</span>)}
          </div>
        )}
      </div>
    </figure>
  );
}

/* ---------- donut (part-to-whole, ≤ 4 slices here) ---------- */
export function Donut({ items, centerLabel, format = fmtN, label }: { items: { id: string; label: string; value: number }[]; centerLabel: string; format?: Fmt; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((s, r) => s + r.value, 0);
  const R = 74, SW = 22, C = 2 * Math.PI * R, GAP = 2.5; // 2px-ish surface gap between slices
  let acc = 0;
  const shown = hover == null ? null : items[hover];
  return (
    <figure className="viz-fig viz-donut">
      <div className="viz-donut-ring">
        <svg viewBox="0 0 200 200" role="img" aria-label={`${label}: ${items.map((r) => `${r.label} ${format(r.value)} (${pctOf(r.value, total)})`).join(', ')}`}>
          <circle cx="100" cy="100" r={R} className="viz-donut-track" strokeWidth={SW} />
          {items.map((r, i) => {
            const len = total ? (r.value / total) * C : 0; const off = acc; acc += len;
            const seg = Math.max(0, len - GAP);
            return r.value > 0 && <circle key={r.id} cx="100" cy="100" r={R} className={`viz-slice vs${i + 1}${hover === i ? ' hot' : ''}${hover != null && hover !== i ? ' dim' : ''}`} strokeWidth={SW}
              strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-off - GAP / 2} transform="rotate(-90 100 100)"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
          })}
          <text x="100" y="98" textAnchor="middle" className="viz-donut-v">{shown ? pctOf(shown.value, total) : format(total)}</text>
          <text x="100" y="120" textAnchor="middle" className="viz-donut-l">{shown ? shown.label : centerLabel}</text>
        </svg>
      </div>
      <ul className="viz-legend col" aria-label="Legend">
        {items.map((r, i) => (
          <li key={r.id}>
            <button type="button" className={hover === i ? 'on' : ''} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              <i className={`key-sq vs${i + 1}`} aria-hidden="true" /><span>{r.label}</span><b>{format(r.value)}</b><small>{pctOf(r.value, total)}</small>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ---------- horizontal stacked bars (2 parts per row) ---------- */
export function StackedBars({ rows, parts, format = fmtN, label }: { rows: { id: string; label: string; values: number[] }[]; parts: { name: string; slot: number }[]; format?: Fmt; label: string }) {
  const [tip, setTip] = useState<{ r: number; p: number } | null>(null);
  const max = niceMax(Math.max(1, ...rows.map((r) => r.values.reduce((a, b) => a + b, 0))));
  return (
    <figure className="viz-fig" aria-label={label}>
      <ul className="viz-legend" aria-label="Legend">{parts.map((p) => <li key={p.name}><i className={`key-sq vs${p.slot}`} aria-hidden="true" />{p.name}</li>)}</ul>
      <div className="viz-hbars" role="list">
        {rows.map((r, ri) => {
          const tot = r.values.reduce((a, b) => a + b, 0);
          return (
            <div key={r.id} className="viz-hrow" role="listitem" data-row={r.id}>
              <span className="viz-hlabel">{r.label}</span>
              <span className="viz-htrack">
                {r.values.map((v, pi) => v > 0 && (
                  <span key={pi} className={`viz-hseg vs${parts[pi].slot}${tip && tip.r === ri && tip.p === pi ? ' hot' : ''}`} style={{ width: `${(v / max) * 100}%` }} tabIndex={0}
                    aria-label={`${r.label}, ${parts[pi].name}: ${format(v)}`} onMouseEnter={() => setTip({ r: ri, p: pi })} onMouseLeave={() => setTip(null)} onFocus={() => setTip({ r: ri, p: pi })} onBlur={() => setTip(null)}>
                    {tip && tip.r === ri && tip.p === pi && <span className="viz-tip small" role="status"><b>{format(v)}</b>{parts[pi].name} · {pctOf(v, tot)}</span>}
                  </span>
                ))}
                <span className="viz-hval">{format(tot)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

/* ---------- columns (ordered bands, one-hue ordinal ramp) ---------- */
export function Columns({ items, format = fmtN, label, ramp = true }: { items: { label: string; value: number }[]; format?: Fmt; label: string; ramp?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(1, ...items.map((d) => d.value)));
  return (
    <figure className="viz-fig">
      <div className="viz-cols" role="img" aria-label={`${label}: ${items.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`} style={{ ['--n' as string]: items.length }}>
        {[1, 0.5].map((t) => <span key={t} className="viz-cols-grid" style={{ bottom: `calc(1.6rem + ${t} * (230px - 3.2rem))` }}><em>{compact(top * t)}</em></span>)}
        {items.map((d, i) => (
          <div key={d.label} className={`viz-col${hover === i ? ' hot' : ''}`} tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <span className="viz-col-plot"><span className={`viz-col-bar${ramp ? ` r${i}` : ' vs1'}`} style={{ height: `${(d.value / top) * 100}%` }}><b>{format(d.value)}</b></span></span>
            <span className="viz-col-label">{d.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/* ---------- one 100% bar (status mix) ---------- */
export function ShareBar({ items, format = fmtN, label }: { items: { id: string; label: string; value: number }[]; format?: Fmt; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((s, r) => s + r.value, 0);
  return (
    <figure className="viz-fig">
      <div className="viz-share" role="img" aria-label={`${label}: ${items.map((r) => `${r.label} ${format(r.value)} (${pctOf(r.value, total)})`).join(', ')}`}>
        {items.map((r, i) => r.value > 0 && <span key={r.id} className={`vs${i + 1}${hover === i ? ' hot' : ''}${hover != null && hover !== i ? ' dim' : ''}`} style={{ flexGrow: r.value }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />)}
      </div>
      <ul className="viz-legend wide" aria-label="Legend">
        {items.map((r, i) => (
          <li key={r.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}><i className={`key-sq vs${i + 1}`} aria-hidden="true" /><span>{r.label}</span><b>{format(r.value)}</b><small>{pctOf(r.value, total)}</small></li>
        ))}
      </ul>
    </figure>
  );
}
