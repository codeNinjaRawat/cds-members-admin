'use client';
/**
 * Overview › "Command center" layout (Nightfall theme default; any theme can use it from My appearance).
 * Main column: KPI tiles with sparklines, renewals vs new members (2 series), members by zone donut,
 * recent members, application pipeline, dues and gifts by month. Side column: today's tasks, recent
 * activity, suggestions. DEMO numbers (live: /admin/stats). Palettes validated with the dataviz checker.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bars, Donut, TableView } from './OverviewView';

const MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const RENEW = [40, 96, 612, 488, 401, 523, 891, 1467, 96, 71, 64, 58];
const NEW = [22, 18, 64, 51, 47, 58, 92, 138, 41, 33, 37, 44];
const KPIS = [
  { id: 'members', label: 'Active members', value: '4,812', change: '+3.2%', note: 'vs last October', up: true, spark: [4410, 4460, 4520, 4560, 4600, 4640, 4700, 4790, 4795, 4800, 4806, 4812], icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6' },
  { id: 'apps', label: 'New applications', value: '37', change: '+24%', note: 'this month', up: true, spark: [12, 18, 15, 22, 19, 27, 25, 31, 29, 33, 35, 37], icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 14l2 2 4-4' },
  { id: 'renew', label: 'Renewals this month', value: '58', change: 'Quiet season', note: 'opens Nov 1', up: false, spark: RENEW, icon: 'M4 9h13l-3-3M20 15H7l3 3' },
  { id: 'giving', label: 'Giving this month', value: '$36.2k', change: '+16%', note: 'vs September', up: true, spark: [41, 38, 22, 25, 31, 36], icon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' },
];
const ZONES = [{ f: 'Southwest', v: 1490 }, { f: 'North', v: 1012 }, { f: 'Northwest', v: 905 }, { f: 'Southeast', v: 801 }, { f: 'South', v: 604 }];
const RECENT = [
  { n: 'Amina Khan', i: 'AK', plan: 'Family', zone: 'Southwest', st: 'Active', amt: '$40', when: '12 min' },
  { n: 'Yusuf Rahman', i: 'YR', plan: 'Single', zone: 'North', st: 'ID check', amt: '$25', when: '2 h' },
  { n: 'Fatima Siddiqui', i: 'FS', plan: 'Family', zone: 'Northwest', st: 'Needs info', amt: '$40', when: '1 day' },
  { n: 'Omar Hassan', i: 'OH', plan: 'Life', zone: 'South', st: 'Board review', amt: '$1,000', when: '1 day' },
  { n: 'Maryam Ali', i: 'MA', plan: 'Single', zone: 'Southeast', st: 'Active', amt: '$25', when: '2 days' },
];
const PIPE = [{ s: 'Applied', n: 37 }, { s: 'Email verified', n: 33 }, { s: 'ID checked', n: 21 }, { s: 'Board review', n: 12 }, { s: 'Active', n: 9 }];
const MONEY = [{ m: 'Nov', v: 18 }, { m: 'Dec', v: 22 }, { m: 'Jan', v: 46 }, { m: 'Feb', v: 39 }, { m: 'Mar', v: 52 }, { m: 'Apr', v: 44 }, { m: 'May', v: 61 }, { m: 'Jun', v: 74 }, { m: 'Jul', v: 22 }, { m: 'Aug', v: 25 }, { m: 'Sep', v: 31 }, { m: 'Oct', v: 36 }];
const TASKS = [
  { id: 't1', t: 'Approve 12 applications waiting for Board review', d: 'Today', time: '5:00 PM', tag: 'Membership' },
  { id: 't2', t: 'Check 2027 dues and reminder text', d: 'Today', time: 'Before Nov 1', tag: 'Plans and rules' },
  { id: 't3', t: 'Verify 4 new “Who still needs help” cases', d: 'Tomorrow', time: '10:00 AM', tag: 'Giving' },
  { id: 't4', t: 'Turn off sample items before launch', d: 'This week', time: '', tag: 'Giving' },
];
const ACTIVITY = [
  { who: 'Amina Khan', what: 'joined – Family plan', when: '12 min ago', c: 'ok', ic: 'M5 12l4 4 10-10' },
  { who: 'Southwest zone', what: 'Zakat gift of $250 recorded', when: '1 h ago', c: 'gold', ic: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' },
  { who: 'Website', what: 'Announcement bar published', when: '3 h ago', c: 'blue', ic: 'M4 10v4h3l7 4V6L7 10z' },
  { who: 'Yusuf Rahman', what: 'uploaded a photo ID', when: '5 h ago', c: 'violet', ic: 'M3 6h18v12H3zM8 12h4' },
  { who: 'Election commission', what: 'record date confirmed: June 30', when: 'Yesterday', c: 'blue', ic: 'M8 3v4M16 3v4M3 9h18M5 5h14v16H5z' },
];

export function CommandCenter() {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem('isgh-admin-tasks') || '[]')); } catch { /* */ } }, []);
  const toggle = (id: string) => setDone((d) => { const n = d.includes(id) ? d.filter((x) => x !== id) : [...d, id]; try { localStorage.setItem('isgh-admin-tasks', JSON.stringify(n)); } catch { /* */ } return n; });
  const [now, setNow] = useState('');
  useEffect(() => { setNow(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })); }, []);
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page cc">
      <header className="page-head">
        <div>
          <h1 suppressHydrationWarning>Assalamu alaikum, Akhter <span className="cc-greet" suppressHydrationWarning>· {greet}</span></h1>
          <p className="page-intro">Here is what needs you today across membership, giving and the website. Demo numbers.</p>
        </div>
        <div className="page-actions">
          <span className="date-pill" suppressHydrationWarning>
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v4M16 3v4M3 9h18M5 5h14v16H5z" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })}
          </span>
        </div>
      </header>

      <div className="cc-grid">
        <div className="cc-main">
          <div className="cc-kpis">
            {KPIS.map((k, i) => (
              <section key={k.id} className={`cc-kpi glass-pane k${i}`}>
                <i className="cc-ico" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24"><path d={k.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></i>
                <span className="cc-kl">{k.label}</span>
                <div className="cc-kv"><b>{k.value}</b><em className={k.up ? 'up' : ''}>{k.up ? '↑ ' : ''}{k.change}</em></div>
                <small>{k.note}</small>
                <Spark values={k.spark} label={k.label} />
              </section>
            ))}
          </div>

          <div className="cc-row2">
            <section className="d-card glass-pane cc-trend" aria-labelledby="tr-h">
              <div className="d-head"><h2 id="tr-h">Renewals and new members <small>last 12 months</small></h2>
                <ul className="cc-legend"><li><i className="s1" aria-hidden="true" />Renewals</li><li><i className="s2" aria-hidden="true" />New members</li></ul></div>
              <TwoLine a={RENEW} b={NEW} labels={MONTHS} />
            </section>
            <section className="d-card glass-pane cc-zones" aria-labelledby="z-h">
              <div className="d-head"><h2 id="z-h">Members by zone</h2></div>
              <div className="z5"><Donut rows={ZONES} center="active members" money={false} /></div>
            </section>
          </div>

          <div className="cc-row3">
            <section className="d-card glass-pane" aria-labelledby="rm-h">
              <div className="d-head"><h2 id="rm-h">Recent members</h2><span className="soon-link" title="Members module (A3)">View all · A3</span></div>
              <ul className="cc-people">
                {RECENT.map((r) => (
                  <li key={r.n}><span className="av" aria-hidden="true">{r.i}</span>
                    <div><b>{r.n}</b><small>{r.plan} · {r.zone}</small></div>
                    <span className={`st st-${r.st.toLowerCase().replace(/\s/g, '-')}`}>{r.st}</span>
                    <div className="amt"><b>{r.amt}</b><small>{r.when}</small></div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="d-card glass-pane" aria-labelledby="pp-h">
              <div className="d-head"><h2 id="pp-h">Application pipeline <small>this month</small></h2></div>
              <ul className="pipe">
                {PIPE.map((p, i) => (
                  <li key={p.s}><div className="pipe-top"><span>{p.s}</span><b>{p.n}</b><small>{Math.round((p.n / PIPE[0].n) * 100)}%</small></div>
                    <div className="pipe-bar"><span className={`p${i}`} style={{ width: `${(p.n / PIPE[0].n) * 100}%` }} /></div></li>
                ))}
              </ul>
              <TableView rows={PIPE.map((p) => [p.s, String(p.n)])} head={['Stage', 'People']} />
            </section>
            <section className="d-card glass-pane" aria-labelledby="mm-h">
              <div className="d-head"><h2 id="mm-h">Dues and gifts by month <small>thousand dollars</small></h2></div>
              <div className="cc-bars"><Bars data={MONEY.map((x) => ({ label: x.m, value: x.v }))} format={(v) => `$${v}k`} /></div>
              <div className="cc-total"><span>Last 12 months</span><b>${MONEY.reduce((s, x) => s + x.v, 0)}k</b><em className="up">↑ 9% vs prior year</em></div>
            </section>
          </div>
        </div>

        <aside className="cc-side" aria-label="Today">
          <section className="d-card glass-pane" aria-labelledby="tk-h">
            <div className="d-head"><h2 id="tk-h">Today’s tasks <small>{TASKS.length - done.length} open</small></h2></div>
            <ul className="tasks">
              {TASKS.map((t) => (
                <li key={t.id} className={done.includes(t.id) ? 'done' : ''}>
                  <label><input type="checkbox" checked={done.includes(t.id)} onChange={() => toggle(t.id)} /><span className="box" aria-hidden="true" />
                    <span className="tt"><b>{t.t}</b><small>{t.tag}</small></span></label>
                  <span className="when"><b>{t.d}</b><small>{t.time}</small></span>
                </li>
              ))}
            </ul>
          </section>
          <section className="d-card glass-pane" aria-labelledby="ac-h">
            <div className="d-head"><h2 id="ac-h">Recent activity</h2></div>
            <ul className="activity">
              {ACTIVITY.map((a) => (
                <li key={a.who + a.when}><i className={`dot-ic ${a.c}`} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24"><path d={a.ic} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></i>
                  <div><b>{a.who}</b><small>{a.what}</small></div><span>{a.when}</span></li>
              ))}
            </ul>
          </section>
          <section className="d-card glass-pane cc-suggest" aria-labelledby="sg-h">
            <span className="sg-mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 100 100"><g fill="currentColor"><rect x="22" y="22" width="56" height="56" /><rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)" /></g></svg></span>
            <h2 id="sg-h">Suggestions</h2>
            <ul>
              <li>Send the “Renew before June 30” email to 1,204 members whose 2026 dues are paid but 2027 is not.</li>
              <li>128 photo IDs are waiting – voters need them checked before June 30.</li>
              <li>Southwest zone grew 11% – consider a second membership table at Jumuah.</li>
            </ul>
            <Link className="btn primary sm" href="/membership">Open plans and dates</Link>
          </section>
        </aside>
      </div>

      <footer className="cc-status glass-pane">
        <span><i className="on" aria-hidden="true" />Demo mode – publishing to the local folder</span>
        <span suppressHydrationWarning>Refreshed {now} CT</span>
        <span>Islamic Society of Greater Houston</span>
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
  const W = 640, H = 300, P = { l: 40, r: 14, t: 18, b: 26 };
  const [h, setH] = useState<number | null>(null);
  const max = Math.max(...a, ...b) * 1.1;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (labels.length - 1);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const smooth = (arr: number[]) => arr.map((v, i) => [x(i), y(v)] as const).reduce((acc, p, i, ps) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const p0 = ps[i - 2] ?? ps[i - 1], p1 = ps[i - 1], p3 = ps[i + 1] ?? p;
    return `${acc} C${p1[0] + (p[0] - p0[0]) / 6},${Math.min(H - P.b, p1[1] + (p[1] - p0[1]) / 6)} ${p[0] - (p3[0] - p1[0]) / 6},${Math.min(H - P.b, p[1] - (p3[1] - p1[1]) / 6)} ${p[0]},${p[1]}`;
  }, '');
  const la = smooth(a), lb = smooth(b);
  const ticks = [0, 500, 1000, 1500].filter((t) => t < max);
  return (
    <figure className="chart">
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Renewals and new members by month. Renewals peak in June at ${Math.max(...a)}.`} onMouseLeave={() => setH(null)}>
          <defs><linearGradient id="tl-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="tl-stop" stopOpacity=".38" /><stop offset="1" className="tl-stop" stopOpacity="0" /></linearGradient></defs>
          {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" /><text x={P.l - 6} y={y(t) + 4} className="axis" textAnchor="end">{t >= 1000 ? `${t / 1000}k` : t}</text></g>)}
          <path d={`${la} L${x(a.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`} fill="url(#tl-fill)" />
          <path d={la} className="tl s1" /><path d={lb} className="tl s2" />
          {labels.map((l, i) => <text key={l} x={x(i)} y={H - 6} className="axis" textAnchor="middle">{l}</text>)}
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
