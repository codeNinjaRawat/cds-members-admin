'use client';
/**
 * A2 overview – "smoked glass" dashboard (owner reference, 2026-10-13). Every number comes from the records the admin
 * loads (members and their dues, the work queues, gifts, membership settings – lib/dashboard/home-stats.ts): demo
 * records in demo mode, the API's in live mode.
 * Charts follow the dataviz rules: one series per chart (accent), categorical donut with validated palette +
 * direct labels + legend, hover tooltips, a table view for every chart, no dual axes.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DOC_KEYS, REGISTRY, type DocKey } from '@/lib/store/registry';
import { useAppearance } from '@/lib/appearance/appearance';
import { CommandCenter } from './CommandCenter';
import { MyWorkCard } from './MyWorkCard';
import { MasjidHome, ZoneHome } from './MasjidHome';
import { useAccess } from '@/lib/access/use-access';
import { useWidgets } from '@/lib/dashboards/widgets';
import type { QueueRow } from '@/lib/dashboard/home-stats';
import { ORG_TZ, YEAR } from '@/lib/members/members';
import { LIVE } from '@/lib/live/live';
import { useHomeStats } from './useHomeStats';

/* ---------------- the numbers ---------------- */
const PALETTE = [{ dark: '#3987e5', light: '#2a78d6' }, { dark: '#d95926', light: '#eb6834' }, { dark: '#199e70', light: '#1baf7a' }, { dark: '#c98500', light: '#eda100' }]; // validated categorical slots 1–4
const EDIT: Record<DocKey, string> = { 'work-settings': '/settings/work', records: '/records', elections: '/elections/run', 'sign-in': '/settings/sign-in', fundraising: '/fundraising?tab=campaigns', 'finance-settings': '/finance?tab=rules', 'prayer-times': '/prayer-times?tab=settings', officials: '/officials?tab=rules', benefits: '/benefits?tab=rules', 'donation-settings': '/donations/settings', 'zakat-settings': '/zakat/settings', 'org-structure': '/zones', integrations: '/settings/integrations', 'admin-access': '/settings/admins', 'site-config': '/website/menus', home: '/website/home', 'membership-settings': '/membership', giving: '/website/giving', pages: '/website/pages', news: '/website/news', themes: '/website/theme', 'join-form': '/membership/form', events: '/events', groups: '/groups', communication: '/communication', 'org-config': '/settings/configuration' };
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const md = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const mdy = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const pctText = (p: number | null, what: string) => (p === null ? `nothing to compare ${what}` : `${p >= 0 ? '+' : ''}${p}% ${what}`);

/** Overview: layout follows My appearance › Overview layout (focus | command). */
export function OverviewView() {
  const [a] = useAppearance();
  const access = useAccess();
  // M5: the home page follows the dashboard (role) the person is working in
  if (access.ready && access.me && access.role?.centerScoped) return <MasjidHome key={`${access.me.id}-${access.dashIndex}`} />;
  if (access.ready && access.me && access.role?.zoneScoped) return <ZoneHome key={`${access.me.id}-${access.dashIndex}`} />;
  return a.dash === 'command' ? <CommandCenter /> : <FocusOverview />;
}

function FocusOverview() {
  const { show, hiddenCount, roleName } = useWidgets('ov');   // D1 – cards this role does not need stay out of the way
  const st = useHomeStats();
  const [docs, setDocs] = useState<Record<string, { source: string; version: number }>>({});
  useEffect(() => {
    void Promise.all(DOC_KEYS.map((k) => fetch(`/api/store/${k}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => [k, j] as const).catch(() => [k, null] as const)))
      .then((rows) => setDocs(Object.fromEntries(rows.filter(([, j]) => j))));
  }, []);
  const published = Object.values(docs).filter((d) => d.source === 'published').length;

  return (
    <div className="page dash">
      <header className="page-head">
        <div>
          <h1>Membership and renewals {!LIVE && <span className="live-pill"><i aria-hidden="true" />Demo data</span>}</h1>
          <p className="page-intro">Applications waiting, the renewals before the {md(st.dates.recordDate)} record date, members by zone and giving – in one view.</p>
        </div>
        <div className="page-actions">
          <span className="date-chip" suppressHydrationWarning>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: ORG_TZ })}</span>
        </div>
      </header>

      <div className="dash-grid">
        {show('ov.queue') && <Queue rows={st.queueRows} />}
        {show('ov.mywork') && <MyWorkCard />}
        {show('ov.curve') && <section className="d-card d-curve glass-pane" aria-labelledby="curve-h">
          <div className="d-head"><h2 id="curve-h">Renewal curve <small>dues paid per month</small></h2></div>
          <Spline data={st.labels.map((l, i) => ({ label: l, value: st.renewals[i] }))} unit="renewals" peakNote={st.renewals[st.peak] ? `${st.labels[st.peak]} – busiest` : undefined} />
          <dl className="strip">
            <div><dt>Last 12 months</dt><dd>{st.renewals.reduce((s, r) => s + r, 0).toLocaleString('en-US')}</dd></div>
            <div><dt>Busiest month</dt><dd>{st.renewals[st.peak] ? `${st.labels[st.peak]} · ${st.renewals[st.peak].toLocaleString('en-US')}` : '—'}</dd></div>
            <div><dt>This week</dt><dd>{st.renewWeek.toLocaleString('en-US')}</dd></div>
          </dl>
        </section>}
        {show('ov.zones') && <section className="d-card d-zones glass-pane" aria-labelledby="zones-h">
          <div className="d-head"><h2 id="zones-h">Members by zone <small>active</small></h2></div>
          {st.zones.length ? <Allocation rows={st.zones.map((z) => ({ label: z.f, value: z.v }))} /> : <p className="cc-note">No current members yet.</p>}
          <ul className="mini-rows">
            <li><span>Busiest masjid</span><b>{st.busiestCenter || '—'}</b></li>
            <li><span>Most new members</span><b>{st.grow ? `${st.grow.z} · ${st.grow.now}${st.grow.pct !== null ? ` (${st.grow.pct >= 0 ? '+' : ''}${st.grow.pct}%)` : ''}` : '—'}</b></li>
            <li><span>Masjid-change requests</span><b>{st.centerWaiting} waiting</b></li>
          </ul>
        </section>}
        {show('ov.kpis') && <div className="d-kpis">
          <Kpi icon="clock" label="Average approval time" value={st.avgApprovalDays === null ? '—' : `${st.avgApprovalDays.toFixed(1)} days`} change="from applying to approval, last 12 months" />
          <Kpi icon="repeat" label="Renewals this week" value={st.renewWeek.toLocaleString('en-US')} change={pctText(st.renewPrevWeek ? Math.round(((st.renewWeek - st.renewPrevWeek) / st.renewPrevWeek) * 100) : null, 'vs last week')} good={st.renewWeek > st.renewPrevWeek} />
          <Kpi icon="vote" label={`Eligible to vote in ${st.votingYear}`} value={`${st.votersPct}%`} change={`${st.voters.toLocaleString('en-US')} of ${st.current.toLocaleString('en-US')} current members`} />
        </div>}
        {show('ov.funds') && <section className="d-card d-funds glass-pane" aria-labelledby="funds-h">
          <div className="d-head"><h2 id="funds-h">Giving by fund <small>this year</small></h2></div>
          {st.funds.length ? <Donut rows={st.funds.map((f, i) => ({ ...f, ...PALETTE[i % PALETTE.length] }))} /> : <p className="cc-note">No gifts recorded this year yet.</p>}
        </section>}
        {show('ov.gmonth') && <section className="d-card d-gmonth glass-pane" aria-labelledby="gm-h">
          <div className="d-head"><h2 id="gm-h">Giving by month <small>thousand dollars</small></h2></div>
          <Bars data={st.giving6.map((g) => ({ label: g.label, value: Math.round(g.cents / 1000) / 100 }))} format={(v) => `$${v}k`} />
        </section>}
        {show('ov.dates') && <section className="d-card d-dates glass-pane" aria-labelledby="dates-h">
          <div className="d-head"><h2 id="dates-h">Key dates</h2></div>
          <div className="count"><b>{st.dates.daysTo(st.dates.recordDate)}</b><span>days to {mdy(st.dates.recordDate)}<br />last day to pay and vote</span></div>
          <ul className="mini-rows">
            <li><span>Renewal opens</span><b>{st.dates.opens ? `${md(st.dates.opens)} · ${st.dates.daysTo(st.dates.opens)} days` : 'Open now'}</b></li>
            <li><span>{YEAR} memberships end</span><b>{md(st.dates.yearEnd)} · {st.dates.daysTo(st.dates.yearEnd)} days</b></li>
          </ul>
        </section>}
        {show('ov.site') && <section className="d-card d-site glass-pane" aria-labelledby="site-h">
          <div className="d-head"><h2 id="site-h">Website content <small>{published} of {DOC_KEYS.length} published from admin</small></h2></div>
          <ul className="doc-chips">
            {DOC_KEYS.map((k) => (
              <li key={k}><Link href={EDIT[k]} className={docs[k]?.source === 'published' ? 'on' : ''}>
                <i aria-hidden="true" />{REGISTRY[k].label}<small>{docs[k]?.source === 'published' ? `v${docs[k].version}` : 'built-in'}</small>
              </Link></li>
            ))}
          </ul>
        </section>}
      </div>
      {hiddenCount > 0 ? <p className="muted small dash-note">{`${hiddenCount} card${hiddenCount === 1 ? '' : 's'} hidden for the ${roleName} role – Settings › Admins and roles › Dashboard decides what each role sees.`}</p> : null}
    </div>
  );
}

/* ---------------- application queue ---------------- */
type Status = QueueRow['status'];
function Queue({ rows }: { rows: QueueRow[] }) {
  const [f, setF] = useState<'All' | Status>('All');
  const all = rows.filter((q) => f === 'All' || q.status === f);
  const list = all.slice(0, 5);
  const count = (s: Status) => rows.filter((q) => q.status === s).length;
  return (
    <section className="d-card d-queue glass-pane" aria-labelledby="q-h">
      <div className="d-head"><h2 id="q-h">Application queue <small>newest first</small></h2><span className="live-dot" title="Updates as people apply">Live</span></div>
      <div className="chip-row" role="group" aria-label="Filter applications">
        {(['All', 'New', 'ID check', 'Needs info', 'Approved'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={f === s} onClick={() => setF(s)}>{s}{s !== 'All' && <span>{count(s)}</span>}</button>
        ))}
      </div>
      {!list.length && <p className="cc-note">Nothing waiting{f === 'All' ? '' : ` in “${f}”`}.</p>}
      <ul className="q-list" aria-live="polite">
        {list.map((q) => (
          <li key={q.id}>
            <div><b><Link href={`/members/${q.memberId}`}>{q.name}</Link></b><span className="mono">{q.memberId}</span><small>{q.plan} · {q.zone} · {q.age === 'today' ? 'today' : `${q.age} ago`}</small></div>
            <span className={`st st-${q.status.replace(' ', '-').toLowerCase()}`}>{q.status}</span>
          </li>
        ))}
      </ul>
      <p className="q-foot">{all.length > 5 ? `+${all.length - 5} more · ` : ''}<Link href="/queues?tab=applications">Open the work queue</Link> to approve or ask for more information.</p>
    </section>
  );
}

const KPI_ICON = { clock: 'M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z', repeat: 'M4 9h13l-3-3M20 15H7l3 3', vote: 'M5 12l4 4 10-10' } as const;
function Kpi({ label, value, change, good, icon }: { label: string; value: string; change: string; good?: boolean; icon: keyof typeof KPI_ICON }) {
  return (
    <section className="d-kpi glass-pane">
      <i className="kpi-ico" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24"><path d={KPI_ICON[icon]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></i>
      <span>{label}</span><b>{value}</b>
      <small className={good ? 'up' : ''}>{good && <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}{change}</small>
    </section>
  );
}

/* ---------------- charts ---------------- */
type Pt = { label: string; value: number };
/** Smooth line (Catmull-Rom → Bézier) with soft area, peak callout, hover crosshair + tooltip, table view. */
function Spline({ data, unit, peakNote }: { data: Pt[]; unit: string; peakNote?: string }) {
  const W = 600, H = 230, P = { l: 36, r: 12, t: 26, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...data.map((d) => d.value)) * 1.12;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (data.length - 1);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const path = useMemo(() => pts.reduce((acc, p, i) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const p0 = pts[i - 2] ?? pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] ?? p;
    const c1 = [p1[0] + (p[0] - p0[0]) / 6, p1[1] + (p[1] - p0[1]) / 6], c2 = [p[0] - (p3[0] - p1[0]) / 6, p[1] - (p3[1] - p1[1]) / 6];
    return `${acc} C${c1[0]},${Math.min(H - P.b, c1[1])} ${c2[0]},${Math.min(H - P.b, c2[1])} ${p[0]},${p[1]}`;
  }, ''), [pts]);
  const peak = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  const top = max / 1.12; const unitStep = top >= 1000 ? 100 : top >= 100 ? 10 : 1;
  const ticks = [0, 0.5, 1].map((t) => Math.round((top * t) / unitStep) * unitStep);
  const show = hover ?? peak;
  return (
    <figure className="chart">
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${unit} by month: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}. Peak ${data[peak].label}.`} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="sp-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent-ink)" stopOpacity=".35" /><stop offset="1" stopColor="var(--accent-ink)" stopOpacity="0" /></linearGradient>
          </defs>
          {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" /><text x={P.l - 6} y={y(t) + 4} className="axis" textAnchor="end">{t >= 1000 ? `${t / 1000}k` : t}</text></g>)}
          <path d={`${path} L${x(data.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`} fill="url(#sp-fill)" />
          <path d={path} className="line" />
          {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r="3.5" className="pt" />)}
          {data.map((d, i) => <text key={d.label} x={x(i)} y={H - 6} className="axis" textAnchor="middle">{d.label}</text>)}
          <line x1={x(show)} x2={x(show)} y1={P.t - 6} y2={H - P.b} className="cross" />
          <circle cx={x(show)} cy={y(data[show].value)} r="6" className="knob" />
          {data.map((d, i) => (
            <rect key={i} x={x(i) - (W - P.l - P.r) / (data.length - 1) / 2} y={0} width={(W - P.l - P.r) / (data.length - 1)} height={H} fill="transparent"
              onMouseEnter={() => setHover(i)} tabIndex={0} onFocus={() => setHover(i)} aria-label={`${d.label}: ${d.value} ${unit}`} />
          ))}
        </svg>
        <div className="tipbox" style={{ left: `${(x(show) / W) * 100}%`, top: `${(y(data[show].value) / H) * 100}%` }} role="status">
          <b>{data[show].value.toLocaleString('en-US')} {unit}</b>{show === peak && peakNote ? ` (peak) · ${peakNote}` : ` · ${data[show].label}`}
        </div>
      </div>
      <TableView rows={data.map((d) => [d.label, d.value.toLocaleString('en-US')])} head={['Month', unit]} />
    </figure>
  );
}

export function Bars({ data, format, highlight }: { data: Pt[]; format: (v: number) => string; highlight?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0.01, ...data.map((d) => d.value));
  return (
    <figure className="chart">
      <div className="gbars" role="img" aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className={`gbar${i === highlight ? ' now' : ''}`} tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`${d.label}: ${format(d.value)}`}>
            <div className="gbar-track"><div className="gbar-fill" style={{ height: `${(d.value / max) * 100}%` }}>{hover === i && <span className="gbar-tip">{format(d.value)}</span>}</div></div>
            <span>{d.label}</span>
          </div>
        ))}
      </div>
      <TableView rows={data.map((d) => [d.label, format(d.value)])} head={['Month', 'Giving']} />
    </figure>
  );
}

export function Donut({ rows, center = 'total this year', money = true }: { rows: { f: string; v: number }[]; center?: string; money?: boolean }) {
  const total = rows.reduce((s, r) => s + r.v, 0);
  const [hover, setHover] = useState<number | null>(null);
  const R = 70, C = 2 * Math.PI * R, GAP = 4;
  let acc = 0;
  return (
    <figure className="chart donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 200 200" role="img" aria-label={rows.map((r) => `${r.f} ${Math.round((r.v / total) * 100)}%`).join(', ')}>
          <circle cx="100" cy="100" r={R} className="donut-track" />
          {rows.map((r, i) => {
            const len = (r.v / total) * C; const off = acc; acc += len;
            return <circle key={r.f} cx="100" cy="100" r={R} className={`seg-c c${i}${hover === i ? ' hot' : ''}`} strokeDasharray={`${Math.max(0, len - GAP)} ${C - Math.max(0, len - GAP)}`} strokeDashoffset={-off}
              transform="rotate(-90 100 100)" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
          })}
          <text x="100" y="96" textAnchor="middle" className="donut-total">{money ? usd(hover === null ? total : rows[hover].v) : (hover === null ? total : rows[hover].v).toLocaleString('en-US')}</text>
          <text x="100" y="118" textAnchor="middle" className="donut-sub">{hover === null ? center : rows[hover].f}</text>
        </svg>
      </div>
      <ul className="legend">
        {rows.map((r, i) => (
          <li key={r.f} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <i className={`c${i}`} aria-hidden="true" /><span>{r.f}</span><b>{Math.round((r.v / total) * 100)}%</b><small>{money ? usd(r.v) : r.v.toLocaleString('en-US')}</small>
          </li>
        ))}
      </ul>
      <TableView rows={rows.map((r) => [r.f, money ? usd(r.v) : r.v.toLocaleString('en-US')])} head={['Name', money ? 'Amount' : 'Count']} />
    </figure>
  );
}

function Allocation({ rows }: { rows: Pt[] }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="alloc">
      {rows.map((r) => {
        const pct = Math.round((r.value / total) * 100);
        return (
          <li key={r.label}>
            <div className="alloc-top"><span>{r.label}</span><b>{r.value.toLocaleString('en-US')}</b><small>{pct}%</small></div>
            <div className="alloc-bar" role="meter" aria-label={`${r.label}: ${pct}% of members`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, pct * 2.5)}%` }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

export function TableView({ rows, head }: { rows: string[][]; head: string[] }) {
  return (
    <details className="table-view"><summary>Show as a table</summary>
      <table><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, n) => <tr key={`${r[0]}-${n}`}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table>
    </details>
  );
}
