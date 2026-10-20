'use client';
/**
 * Every module's dashboard shares one frame so they read the same way:
 *   DashPage  – title, one-line scope ("Southwest Zone · last 3 months · demo data") and the toolbar
 *   DashBar   – filters on the left (time, zone, masjid – only the ones that apply), on the right: the full report,
 *               Download CSV (exactly the numbers on screen, after filters) and Print
 *   useScope  – the filter state; masjid- and zone-limited roles are locked to their own area
 * Exports never contain more than the role may see (inScope), and contact details only with members.contact.
 */
import { LIVE } from '@/lib/live/live';
import { ORG_TZ } from '@/lib/members/members';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useAccess } from '@/lib/access/use-access';
import { logAudit } from '@/lib/access/audit';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';

export type Period = '30d' | '90d' | 'year' | '12m' | 'all';
export const PERIODS: Record<Period, string> = { '30d': 'Last 30 days', '90d': 'Last 3 months', year: 'This year', '12m': 'Last 12 months', all: 'All time' };
export const FUTURE: Record<Period, string> = { '30d': 'Next 30 days', '90d': 'Next 3 months', year: 'Rest of the year', '12m': 'Next 12 months', all: 'Everything ahead' };
/** Today in the organization's time zone (the name stays from when every organization was in Houston). */
export const todayCT = () => (LIVE ? new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ }) : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }));
const add = (d: string, n: number) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/** Is a date inside the period (past periods look back from today; `ahead` looks forward instead). */
export function inPeriod(date: string, p: Period, today = todayCT(), ahead = false) {
  const d = date.slice(0, 10);
  if (p === 'all') return ahead ? d >= today : d <= today;
  if (ahead) { const end = p === '30d' ? add(today, 30) : p === '90d' ? add(today, 90) : p === 'year' ? `${today.slice(0, 4)}-12-31` : add(today, 365); return d >= today && d <= end; }
  const start = p === '30d' ? add(today, -30) : p === '90d' ? add(today, -90) : p === 'year' ? `${today.slice(0, 4)}-01-01` : add(today, -365);
  return d >= start && d <= today;
}

export function useScope(initial: Period = '12m') {
  const f = useMasjidFilter();
  const access = f.access;
  const [period, setPeriod] = useState<Period>(initial);
  const { zone, masjid, lockedZone, lockedMasjid, zoneOf } = f;
  /** Does a record (zone, masjid, zip) pass the filters and the role's scope? */
  const keep = (z: string, center?: string, zip?: string) => f.keep(z, center, zip);
  const label = f.label === 'All masjids' ? 'All zones' : f.label;
  /** Does a dated record at a masjid pass the time, zone and masjid filters? (records with no date skip the time filter) */
  const match = (date: string | undefined, center: string, zoneId?: string) => (!date || inPeriod(date, period)) && f.keep(zoneId || '', center);
  return { period, setPeriod, zone, setZone: f.setZone, masjid, setMasjid: f.setMasjid, lockedZone, lockedMasjid, keep, match, zoneOf, label, access, filter: f };
}
export type Scope = ReturnType<typeof useScope>;

/** CSV the way spreadsheets expect (UTF-8 BOM, quoted cells, CRLF). */
export function downloadCsv(name: string, head: string[], rows: (string | number)[][], area = 'export') {
  const cell = (v: string | number) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
  const text = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = `${name}-${todayCT()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  logAudit({ area: area as 'export', action: 'Downloaded CSV', detail: `${name} · ${rows.length} rows` });
}

/**
 * "Download CSV" for a whole dashboard: the headline numbers, then every chart's table, exactly as filtered on screen.
 * Dashboards show totals only, so the file never holds more than the role already sees (no names, emails or phones).
 */
export function exportPage(name: string, extra: { title: string; head: string[]; rows: (string | number)[][] }[] = [], root: ParentNode | null = document.querySelector('main') ?? document) {
  if (!root) return;
  const txt = (e: Element | null) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rows: (string | number)[][] = [['Headline numbers', '', ''], ['Measure', 'Value', 'Note']];
  root.querySelectorAll('.viz-tile').forEach((t) => rows.push([txt(t.querySelector('.viz-tile-label')), txt(t.querySelector('.viz-tile-value')), txt(t.querySelector('.viz-tile-note')).replace(/^[▲▼] /, '')]));
  root.querySelectorAll('.viz-card').forEach((c) => {
    const table = c.querySelector('details.viz-table table'); if (!table) return;
    rows.push([], [txt(c.querySelector('.viz-head h2'))]);
    table.querySelectorAll('tr').forEach((tr) => rows.push(Array.from(tr.children).map((td) => txt(td))));
  });
  extra.forEach((x) => rows.push([], [x.title], x.head, ...x.rows));
  downloadCsv(name, [txt(root.querySelector('h1')) || name, `Downloaded ${todayCT()}`, LIVE ? '' : 'demo data'], rows);
}

export function DashBar({ s, show, report, onExport, extra }: {
  s: Scope; show: { period?: 'past' | 'ahead'; zone?: boolean; masjid?: boolean };
  report?: { href: string; label: string }; onExport?: () => void; extra?: ReactNode;
}) {
  return (
    <div className="dbar glass-pane" role="toolbar" aria-label="Filters and exports">
      <div className="dbar-filters">
        {show.period && (
          <div className="seg dbar-period" role="radiogroup" aria-label="Time">
            {(Object.keys(PERIODS) as Period[]).filter((p) => p !== 'all').map((p) => (
              <button key={p} type="button" role="radio" aria-checked={s.period === p} onClick={() => s.setPeriod(p)}>{(show.period === 'ahead' ? FUTURE : PERIODS)[p]}</button>
            ))}
          </div>
        )}
        {(show.zone || show.masjid) && <MasjidPicker f={s.filter} />}
        {extra}
      </div>
      <div className="dbar-actions">
        {report && <Link className="btn sm" href={report.href}>{report.label}</Link>}
        {onExport && <button type="button" className="btn sm" onClick={onExport}>Download CSV</button>}
        <button type="button" className="btn sm ghost" onClick={() => window.print()}>Print</button>
      </div>
    </div>
  );
}

/** Page frame for a module dashboard. */
export function DashPage({ title, intro, bar, children, className = '' }: { title: string; intro: ReactNode; bar: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`page mo dash ${className}`}>
      <header className="page-head mo-head"><div><h1>{title}</h1><p className="page-intro">{intro}</p></div></header>
      {bar}
      <div className="mo-grid">{children}</div>
    </div>
  );
}

/** "Needs attention" list used on every dashboard. */
export function Attention({ items, empty = 'Nothing needs attention.', title = 'Needs attention', className = 'mo-side' }: { items: { text: ReactNode; href?: string; tone?: 'stop' | 'look' }[]; empty?: string; title?: string; className?: string }) {
  return (
    <section className={`viz-card glass-pane dash-att ${className}`} aria-label={title}>
      <header className="viz-head"><h2>{title}</h2>{items.length > 0 && <p>{items.length} item{items.length === 1 ? '' : 's'}</p>}</header>
      {items.length ? <ul>{items.map((x, i) => <li key={i} className={x.tone ?? 'look'}>{x.href ? <Link href={x.href}>{x.text}</Link> : x.text}</li>)}</ul> : <p className="muted">{empty}</p>}
    </section>
  );
}
