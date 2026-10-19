'use client';
/**
 * Overview › "Command center" layout (Nightfall theme default; any theme can use it from My appearance).
 * Main column: KPI tiles with sparklines, renewals vs new members (2 series), members by zone donut,
 * recent members, application pipeline, dues and gifts by month. Side column: today's tasks, recent
 * activity, suggestions. Numbers from the records the admin loads (lib/dashboard/home-stats.ts) – demo or live. Palettes validated with the dataviz checker.
 */
import { MyWorkCard } from './MyWorkCard';
import { useAccess } from '@/lib/access/use-access';
import { useWidgets } from '@/lib/dashboards/widgets';
import { ORG_TZ } from '@/lib/members/members';
import { useHomeStats } from './useHomeStats';
import { useOrg } from '@/lib/platform/use-org';
import { LIVE } from '@/lib/live/live';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bars, Donut, TableView } from './OverviewView';
import { YearRibbon } from './YearRibbon';
import { ArtBand } from '@/components/shell/Photo';

const ICON = {
  members: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  apps: 'M7 3h7l5 5v13H7zM14 3v5h5M10 14l2 2 4-4', renew: 'M4 9h13l-3-3M20 15H7l3 3',
  giving: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
};
const ACT = { member: { c: 'ok', ic: 'M5 12l4 4 10-10' }, gift: { c: 'gold', ic: ICON.giving }, id: { c: 'violet', ic: 'M3 6h18v12H3zM8 12h4' }, office: { c: 'blue', ic: 'M4 10v4h3l7 4V6L7 10z' } } as const;
const k$ = (cents: number) => (cents >= 100_000 ? `$${(cents / 100_000).toFixed(1)}k` : `$${Math.round(cents / 100).toLocaleString('en-US')}`);
const vs = (now: number, before: number) => (before ? `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%` : '');
const when = (iso: string) => { const d = Math.round((Date.now() - Date.parse(iso)) / 86_400_000); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`; };

export function CommandCenter() {
  const access = useAccess();
  const { show, hiddenCount, roleName } = useWidgets('cc');   // D1 – cards per role
  const firstName = (access.me?.name ?? 'Admin').replace(/\s*\(demo\)$/, '');
  const st = useHomeStats();
  const { me } = useOrg();
  const kpis = [
    { id: 'members', label: 'Current members', value: st.current.toLocaleString('en-US'), change: st.currentChange === null ? '' : `${st.currentChange >= 0 ? '+' : ''}${st.currentChange}%`, note: 'vs a year ago', up: (st.currentChange ?? 0) > 0, spark: st.currentSpark, icon: ICON.members },
    { id: 'apps', label: 'Waiting for approval', value: String(st.pending), change: `${st.appsThisMonth} applied this month`, note: st.appsLastMonth ? `${st.appsLastMonth} last month` : 'applications', up: st.appsThisMonth > st.appsLastMonth, spark: st.appsSpark, icon: ICON.apps },
    { id: 'renew', label: 'Renewals this month', value: st.renewMonth.toLocaleString('en-US'), change: vs(st.renewMonth, st.renewals[10]) || '—', note: st.dates.opens ? `renewals open ${st.dates.opens.slice(5).replace('-', '/')}` : 'vs last month', up: st.renewMonth > st.renewals[10], spark: st.renewals, icon: ICON.renew },
    { id: 'fees', label: 'Membership fees this month', value: k$(st.feesMonth), change: vs(st.feesMonth, st.feesPrevMonth) || '—', note: 'dues only · vs last month', up: st.feesMonth > st.feesPrevMonth, spark: st.renewals.slice(6), icon: 'M3 7h18v10H3zM3 11h18M7 15h3' },
    { id: 'giving', label: 'Giving this month', value: k$(st.givingMonth), change: vs(st.givingMonth, st.givingPrevMonth) || '—', note: 'vs last month', up: st.givingMonth > st.givingPrevMonth, spark: st.giving6.map((g) => g.cents), icon: ICON.giving },
  ];
  const zones = st.zones;
  const peak = st.peak;
  const moneyK = st.money.map((c) => Math.round(c / 1000) / 100);
  const [now, setNow] = useState('');
  useEffect(() => { setNow(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ORG_TZ })); }, []);
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: ORG_TZ }));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page cc">
      <header className="page-head cc-head has-art">
        <ArtBand k="minarets-sunset" side="left" />
        <div>
          <h1 suppressHydrationWarning>Assalamu alaikum, {firstName} <span className="cc-greet" suppressHydrationWarning>· {greet}</span></h1>
          <p className="page-intro">What needs you today across membership, giving and the website.{LIVE ? '' : ' Demo records.'}</p>
        </div>
        <p className="cc-date" suppressHydrationWarning>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: ORG_TZ })}</p>
      </header>

      {show('cc.ribbon') && <YearRibbon />}

      <div className="cc-grid">
        <div className="cc-main">
          <div className="cc-kpis">
            {kpis.filter((k) => show(`cc.kpi.${k.id}`)).map((k, i) => (
              <section key={k.id} className={`cc-kpi glass-pane k${i}`} data-kpi={k.id}>
                <i className="cc-ico" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24"><path d={k.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></i>
                <span className="cc-kl">{k.label}</span>
                <div className="cc-kv"><b>{k.value}</b><em className={k.up ? 'up' : ''}>{k.up ? '↑ ' : ''}{k.change}</em></div>
                <small>{k.note}</small>
                <Spark values={k.spark} label={k.label} />
              </section>
            ))}
          </div>

          {(show('cc.trend') || show('cc.zones')) && <div className="cc-row2">
            {show('cc.trend') && <section className="d-card glass-pane cc-trend" aria-labelledby="tr-h">
              <div className="d-head"><h2 id="tr-h">Renewals and new members <small>last 12 months</small></h2>
                <ul className="cc-legend"><li><i className="s1" aria-hidden="true" />Renewals</li><li><i className="s2" aria-hidden="true" />New members</li></ul></div>
              <TwoLine a={st.renewals} b={st.newMembers} labels={st.labels} />
              <dl className="cc-facts">
                <div><dt>Busiest month</dt><dd>{st.renewals[peak] ? `${st.labels[peak]} · ${st.renewals[peak].toLocaleString('en-US')} renewals` : '—'}</dd></div>
                <div><dt>Renewals in 12 months</dt><dd>{st.renewals.reduce((a, b) => a + b, 0).toLocaleString('en-US')}</dd></div>
                <div><dt>New members in 12 months</dt><dd>{st.newMembers.reduce((a, b) => a + b, 0).toLocaleString('en-US')}</dd></div>
              </dl>
            </section>}
            {show('cc.zones') && <section className="d-card glass-pane cc-zones" aria-labelledby="z-h">
              <div className="d-head"><h2 id="z-h">Members by zone</h2></div>
              {zones.length ? <div className="z5"><Donut rows={zones} center="current members" money={false} /></div> : <p className="cc-note">No current members yet.</p>}
            </section>}
          </div>}

          {(show('cc.pipeline') || show('cc.money')) && <div className="cc-row3">
            {show('cc.pipeline') && <section className="d-card glass-pane" aria-labelledby="pp-h">
              <div className="d-head"><h2 id="pp-h">Application pipeline <small>applied in the last 90 days</small></h2></div>
              <ul className="pipe">
                {st.pipeline.map((p, i) => (
                  <li key={p.s}><div className="pipe-top"><span>{p.s}</span><b>{p.n}</b><small>{Math.round((p.n / (st.pipeline[0].n || 1)) * 100)}%</small></div>
                    <div className="pipe-bar"><span className={`p${i}`} style={{ width: `${(p.n / (st.pipeline[0].n || 1)) * 100}%` }} /></div></li>
                ))}
              </ul>
              <p className="cc-note">{(st.pipeline[0].n || 1) - st.pipeline[st.pipeline.length - 1].n} still on their way to approval.</p>
              <TableView rows={st.pipeline.map((p) => [p.s, String(p.n)])} head={['Stage', 'People']} />
            </section>}
            {show('cc.money') && <section className="d-card glass-pane cc-money" aria-labelledby="mm-h">
              <div className="d-head"><h2 id="mm-h">Dues and gifts by month <small>thousand dollars</small></h2>
                <div className="cc-total"><span>Last 12 months</span><b>{k$(st.money.reduce((s, x) => s + x, 0))}</b>{st.moneyChange !== null && <em className={st.moneyChange >= 0 ? 'up' : ''}>{st.moneyChange >= 0 ? '↑ ' : '↓ '}{Math.abs(st.moneyChange)}% vs prior year</em>}</div></div>
              <div className="cc-bars"><Bars data={st.labels.map((l, i) => ({ label: l, value: moneyK[i] }))} format={(v) => `$${v}k`} highlight={11} /></div>
            </section>}
          </div>}

          {show('cc.newest') && <section className="d-card glass-pane cc-newest" aria-labelledby="rm-h">
            <div className="d-head"><h2 id="rm-h">Newest members</h2><Link className="cc-more" href="/members">All members</Link></div>
            <ul className="cc-people">
              {!st.newest.length && <li><small>No members yet.</small></li>}
              {st.newest.map((r) => (
                <li key={r.id}>
                  <span className="av" aria-hidden="true">{r.initials}</span>
                  <b className="nm"><Link href={`/members/${r.id}`}>{r.name}</Link></b>
                  <span className="pl">{r.plan}</span>
                  <span className="zn">{r.zone}</span>
                  <span className={`st st-${r.status.toLowerCase().replace(/\s/g, '-')}`}>{r.status}</span>
                  <b className="amt">{r.amountCents ? k$(r.amountCents) : '—'}</b>
                  <small className="ago">{r.when === 'today' ? 'today' : `${r.when} ago`}</small>
                </li>
              ))}
            </ul>
          </section>}
          {hiddenCount > 0 && <p className="muted small dash-note">{hiddenCount} card{hiddenCount === 1 ? '' : 's'} hidden for the {roleName} role – Settings › Admins and roles › a role › Dashboard decides what each role sees.</p>}
        </div>

        <aside className="cc-side" aria-label="Today">
          {show('cc.mywork') && <MyWorkCard />}
          {show('cc.activity') && <section className="d-card glass-pane" aria-labelledby="ac-h">
            <div className="d-head"><h2 id="ac-h">Recent activity</h2></div>
            <ul className="activity">
              {!st.activity.length && <li><div><small>Nothing yet.</small></div></li>}
              {st.activity.map((a, i) => (
                <li key={`${a.on}-${i}`}><i className={`dot-ic ${ACT[a.kind].c}`} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24"><path d={ACT[a.kind].ic} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></i>
                  <div><b>{a.who}</b><small>{a.what}</small></div><span suppressHydrationWarning>{when(a.on)}</span></li>
              ))}
            </ul>
          </section>}
          {show('cc.suggest') && <section className="d-card glass-pane cc-suggest" aria-labelledby="sg-h">
            <span className="sg-mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 100 100"><g fill="currentColor"><rect x="22" y="22" width="56" height="56" /><rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)" /></g></svg></span>
            <h2 id="sg-h">Suggestions</h2>
            <ul>
              {st.suggestions.length ? st.suggestions.map((x) => <li key={x}>{x}</li>) : <li>Nothing urgent – the queues are clear.</li>}
            </ul>
            <Link className="btn primary sm" href="/membership">Open plans and dates</Link>
          </section>}
        </aside>
      </div>

      <footer className="cc-status glass-pane">
        <span><i className="on" aria-hidden="true" />{LIVE ? 'Live – connected to the server' : 'Demo mode – publishing to the local folder'}</span>
        <span suppressHydrationWarning>Refreshed {now}</span>
        <span>{me?.org.name ?? ''}</span>
      </footer>
    </div>
  );
}

/** Tiny single-series sparkline (decorative trend; the value and change are in text next to it). */
function Spark({ values, label }: { values: number[]; label: string }) {
  const W = 160, H = 40, min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - ((v - min) / (max - min || 1)) * (H - 10)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label} trend, last ${values.length} periods`}>
      <path d={`${d} L${W},${H} L0,${H} Z`} className="spark-fill" /><path d={d} className="spark-line" />
    </svg>
  );
}

/** Two series on ONE axis (same unit: people per month), legend above, hover shows both values. */
function TwoLine({ a, b, labels }: { a: number[]; b: number[]; labels: string[] }) {
  const W = 640, H = 280, P = { l: 46, r: 14, t: 14, b: 30 };
  const [h, setH] = useState<number | null>(null);
  const max = Math.max(4, ...a, ...b) * 1.1;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (labels.length - 1);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const smooth = (arr: number[]) => arr.map((v, i) => [x(i), y(v)] as const).reduce((acc, p, i, ps) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const p0 = ps[i - 2] ?? ps[i - 1], p1 = ps[i - 1], p3 = ps[i + 1] ?? p;
    return `${acc} C${p1[0] + (p[0] - p0[0]) / 6},${Math.min(H - P.b, p1[1] + (p[1] - p0[1]) / 6)} ${p[0] - (p3[0] - p1[0]) / 6},${Math.min(H - P.b, p[1] - (p3[1] - p1[1]) / 6)} ${p[0]},${p[1]}`;
  }, '');
  const la = smooth(a), lb = smooth(b);
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((t) => max / t <= 4) ?? 10000;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step).filter((t) => t < max);
  return (
    <figure className="chart">
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Renewals and new members by month. Renewals peak in June at ${Math.max(...a)}.`} onMouseLeave={() => setH(null)}>
          <defs><linearGradient id="tl-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="tl-stop" stopOpacity=".38" /><stop offset="1" className="tl-stop" stopOpacity="0" /></linearGradient></defs>
          {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" /><text x={P.l - 8} y={y(t) + 5} className="axis tl-axis" textAnchor="end">{t >= 1000 ? `${t / 1000}k` : t}</text></g>)}
          <path d={`${la} L${x(a.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`} fill="url(#tl-fill)" />
          <path d={la} className="tl s1" /><path d={lb} className="tl s2" />
          {labels.map((l, i) => <text key={l} x={x(i)} y={H - 4} className="axis tl-axis" textAnchor="middle">{l}</text>)}
          {h !== null && <g><line x1={x(h)} x2={x(h)} y1={P.t} y2={H - P.b} className="cross" /><circle cx={x(h)} cy={y(a[h])} r="5" className="tl-dot s1" /><circle cx={x(h)} cy={y(b[h])} r="5" className="tl-dot s2" /></g>}
          {labels.map((l, i) => <rect key={i} x={x(i) - (W - P.l - P.r) / (labels.length - 1) / 2} y="0" width={(W - P.l - P.r) / (labels.length - 1)} height={H} fill="transparent" tabIndex={0}
            onMouseEnter={() => setH(i)} onFocus={() => setH(i)} aria-label={`${l}: ${a[i]} renewals, ${b[i]} new members`} />)}
        </svg>
        {h !== null && <div className="tipbox" style={{ left: `${(x(h) / W) * 100}%`, top: `${(y(Math.max(a[h], b[h])) / H) * 100}%` }} role="status">
          <b>{labels[h]}</b> · <i className="s1" />{a[h].toLocaleString('en-US')} renewals · <i className="s2" />{b[h]} new</div>}
      </div>
      <TableView rows={labels.map((l, i) => [l, String(a[i]), String(b[i])])} head={['Month', 'Renewals', 'New members']} />
    </figure>
  );
}
