'use client';
/**
 * F2 Zakat and Sadaqah. Tabs follow the work: Dashboard (what needs me) → Applications → Approvals → Payouts → Reports.
 * Every case opens in a side panel that shows its steps and only the actions this person's role allows
 * (actionsFor in lib/community/zakat.ts – the BE checks the same). Center-limited roles see their centers only.
 * DEMO (no API): cases are saved in this browser.
 */
import { DashBar, exportPage, useScope as useDashScope } from '@/components/charts/DashKit';
import { ZONES } from '@/lib/members/members';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Tabs } from '@/components/editor/bits';
import { StatTile, ChartCard, Donut, Columns, StackedBars, ShareBar } from '@/components/charts/Charts';
import {
  CATEGORIES, STATUS, actionsFor, amountOf, approve, blockedReason, decideEligibility, decline, dueAt, intakeProblems, isOverdue, nextLevel,
  paidCents, pay, totalOf, usd, verifyProblems, zakatStats, type Actor, type CaseStatus, type Category, type ZakatCase, type ZakatSettings,
} from '@/lib/community/zakat';
import { centersIn, zoneForZip, type OrgStructure } from '@/lib/community/org-structure';
import { useAccess } from '@/lib/access/use-access';
import { nextCaseId, saveCase, useZakatCases, useZakatContext } from '@/lib/zakat/use-zakat';
import { csvCell } from '@/lib/community/member-records';

const nowIso = () => new Date().toISOString();
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: '2-digit', day: '2-digit', year: 'numeric' });
const fmtWhen = (iso: string) => `${fmtDay(iso)} ${new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })}`;
const ST_TONE: Record<CaseStatus, string> = { new: 'warn', verifying: '', 'info-requested': 'warn', 'awaiting-approval': '', approved: 'good', paid: 'good', rejected: 'bad' };
const NEXT: Record<CaseStatus, string> = { new: 'Assign and verify', verifying: 'Finish verification', 'info-requested': 'Waiting for documents', 'awaiting-approval': 'Approval', approved: 'Pay out', paid: 'Done', rejected: 'Closed' };
function dueText(c: ZakatCase, s: ZakatSettings, now: string) {
  if (['paid', 'rejected', 'info-requested'].includes(c.status)) return '';
  const h = Math.round((Date.parse(dueAt(c, s)) - Date.parse(now)) / 3_600_000);
  return h < 0 ? `${-h} h overdue` : `due in ${h} h`;
}

export function ZakatView() {
  const access = useAccess();
  const all = useZakatCases();
  const { settings: s, map } = useZakatContext();
  const [open, setOpen] = useState<string | null>(null);
  const [intake, setIntake] = useState(false);
  const now = nowIso();
  const cases = useMemo(() => all.filter((c) => access.inScope(c.zone, c.center)), [all, access.ready, access.me?.id, access.dashIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const me: Actor = { id: access.me?.id ?? '', name: access.me?.name ?? '', level: access.zakatLevel, can: (p) => access.can(p as never) };
  const mine = cases.filter((c) => actionsFor(c, me, s).length > 0);
  const openCase = cases.find((c) => c.id === open);
  const viewOnly = !['zakat.intake', 'zakat.verify', 'zakat.approve', 'zakat.override', 'zakat.disburse'].some((p) => access.can(p as never));
  const scope = access.role?.centerScoped ? access.me?.centers.join(', ') : '';
  return (
    <div className={`page zk${openCase ? ' has-peek' : ''}`}>
      <header className="page-head">
        <div>
          <h1>Zakat and Sadaqah</h1>
          <p className="page-intro">Help for people in need – from application to payout. {scope ? `You see cases at ${scope}.` : 'All zones.'} Demo cases, saved in this browser.</p>
        </div>
        <div className="page-actions">
          {access.can('zakat.intake') && <button type="button" className="btn primary" onClick={() => setIntake(true)}>New application</button>}
        </div>
      </header>
      {viewOnly && <p className="notice glass-pane zk-viewonly" role="note">{access.role?.name}: you can see every case and report here, but you cannot approve, change or pay anything.</p>}
      <Tabs label="Zakat and Sadaqah" tabs={[
        { id: 'overview', label: 'Dashboard', render: () => <Dashboard cases={cases} mine={mine} s={s} now={now} onOpen={setOpen} me={me} /> },
        { id: 'cases', label: 'Applications', render: () => <CaseList cases={cases} s={s} now={now} onOpen={setOpen} map={map} /> },
        { id: 'approvals', label: 'Approvals', badge: cases.filter((c) => c.status === 'awaiting-approval' && actionsFor(c, me, s).some((a) => a === 'approve' || a === 'override')).length || undefined, render: () => <Approvals cases={cases} s={s} now={now} me={me} onOpen={setOpen} /> },
        { id: 'payouts', label: 'Payouts', badge: access.can('zakat.disburse') ? cases.filter((c) => c.status === 'approved' && actionsFor(c, me, s).includes('pay')).length || undefined : undefined, render: () => <Payouts cases={cases} s={s} onOpen={setOpen} me={me} /> },
        { id: 'reports', label: 'Reports', render: () => <Reports cases={cases} s={s} now={now} map={map} /> },
      ]} />
      {openCase && <CasePanel c={openCase} s={s} me={me} map={map} onClose={() => setOpen(null)} />}
      {intake && <IntakeDialog s={s} map={map} all={all} onClose={() => setIntake(false)} onSaved={(id) => { setIntake(false); setOpen(id); }} />}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ cases: allCases, mine: allMine, s, now, onOpen, me }: { cases: ZakatCase[]; mine: ZakatCase[]; s: ZakatSettings; now: string; onOpen: (id: string) => void; me: Actor }) {
  const sc = useDashScope('12m');
  const cases = allCases.filter((c) => sc.match(c.createdAt, c.center, c.zone));
  const mine = allMine.filter((c) => sc.match(c.createdAt, c.center, c.zone));
  const zoneName = (z: string) => (ZONES as Record<string, string>)[z] ?? (z || 'Not routed');
  const exp = () => exportPage('zakat-dashboard', [
    { title: 'Where cases are', head: ['Step', 'Cases'], rows: (['new', 'verifying', 'awaiting-approval', 'approved', 'paid', 'rejected'] as CaseStatus[]).map((f) => [STATUS[f], cases.filter((c) => c.status === f || (f === 'verifying' && c.status === 'info-requested')).length]) },
    { title: 'By zone', head: ['Zone', 'Cases', 'Urgent', 'Paid out'], rows: Array.from(new Set(cases.map((c) => c.zone))).sort().map((z) => { const l = cases.filter((c) => c.zone === z); return [zoneName(z), l.length, l.filter((c) => c.urgent).length, usd(l.reduce((a, c) => a + paidCents(c), 0))]; }) },
  ]);
  const st = zakatStats(cases, s, now);
  const flow: CaseStatus[] = ['new', 'verifying', 'awaiting-approval', 'approved', 'paid'];
  const sorted = [...mine].sort((a, b) => Number(b.urgent) - Number(a.urgent) || Number(isOverdue(b, s, now)) - Number(isOverdue(a, s, now)) || a.stepSince.localeCompare(b.stepSince));
  return (
    <div className="zk-dash">
      <DashBar s={sc} show={{ period: 'past', zone: true, masjid: true }} report={{ href: '/zakat?tab=reports', label: 'Zakat reports' }} onExport={exp} />
      <div className="zk-kpis">
        <StatTile id="open" label="Open cases" value={String(cases.filter((c) => !['paid', 'rejected'].includes(c.status)).length)} note={`${st.total} in total`} />
        <StatTile id="urgent" label="Urgent" value={String(st.urgent)} note={`answered within ${s.hours.emergency} hours`} />
        <StatTile id="overdue" label="Past the response time" value={String(st.overdue)} tone={st.overdue ? 'down' : undefined} note={st.overdue ? 'needs attention now' : 'all on time'} />
        <StatTile id="paid" label="Paid out" value={usd(st.paidCents)} note={`${usd(st.toPayCents)} approved, still to pay`} />
      </div>
      <section className="zk-flow glass-pane" aria-label="Where cases are">
        {flow.map((f, i) => (
          <a key={f} className="zk-flow-step" href={`?tab=cases&status=${f}`} onClick={(e) => { e.preventDefault(); const u = new URL(location.href); u.searchParams.set('tab', 'cases'); u.searchParams.set('status', f); history.replaceState(null, '', u); window.dispatchEvent(new Event('isgh:tab')); }}>
            <b>{cases.filter((c) => c.status === f || (f === 'verifying' && c.status === 'info-requested')).length}</b><span>{STATUS[f]}</span>{i < flow.length - 1 && <i aria-hidden="true">›</i>}
          </a>
        ))}
      </section>
      <section className="zk-mine glass-pane" aria-labelledby="zk-mine-h">
        <h2 id="zk-mine-h">Needs you {sorted.length ? <span className="pill">{sorted.length}</span> : null}</h2>
        {!sorted.length ? <p className="muted">{me.can('zakat.view') && !me.can('zakat.verify') && !me.can('zakat.approve') && !me.can('zakat.disburse') && !me.can('zakat.intake') ? 'Your role is view only.' : 'Nothing is waiting for you. JazakAllahu khairan.'}</p> : (
          <ul className="zk-rows">{sorted.slice(0, 8).map((c) => <CaseRow key={c.id} c={c} s={s} now={now} onOpen={onOpen} action={actionLabel(actionsFor(c, me, s))} />)}</ul>
        )}
      </section>
    </div>
  );
}
const actionLabel = (a: string[]) => (a.includes('pay') ? 'Pay out' : a.includes('approve') ? 'Approve' : a.includes('override') ? 'Approve (Chair)' : a.includes('verify') ? 'Verify' : '');
function CaseRow({ c, s, now, onOpen, action }: { c: ZakatCase; s: ZakatSettings; now: string; onOpen: (id: string) => void; action?: string }) {
  const due = dueText(c, s, now);
  return (
    <li><button type="button" className="zk-row" data-case={c.id} onClick={() => onOpen(c.id)}>
      <span className="zk-row-main"><b>{c.applicant.name}</b><small>{c.id} · {CATEGORIES[c.category]} · {c.center || 'not routed'}</small></span>
      <span className="zk-row-amt">{usd(totalOf(c))}{c.months > 1 && <small>{c.months} months</small>}</span>
      <span className="zk-row-tags">{c.urgent && <span className="pill bad">Urgent</span>}<span className={`pill ${ST_TONE[c.status]}`}>{STATUS[c.status]}</span>{due && <small className={isOverdue(c, s, now) ? 'zk-late' : ''}>{due}</small>}</span>
      {action && <span className="zk-row-act">{action} ›</span>}
    </button></li>
  );
}

/* ---------------- Applications ---------------- */
function CaseList({ cases, s, now, onOpen, map }: { cases: ZakatCase[]; s: ZakatSettings; now: string; onOpen: (id: string) => void; map: OrgStructure }) {
  const init = typeof window === 'undefined' ? null : new URLSearchParams(location.search).get('status');
  const [status, setStatus] = useState<string>(init ?? '');
  const [fund, setFund] = useState(''); const [q, setQ] = useState(''); const [urgent, setUrgent] = useState(false);
  const mf = useMasjidFilter();
  const list = cases.filter((c) => (!status || c.status === status || (status === 'verifying' && c.status === 'info-requested')) && mf.keep(c.zone, c.center, c.applicant.zip) && (!fund || c.fund === fund) && (!urgent || c.urgent)
    && (!q || `${c.id} ${c.applicant.name} ${c.reason} ${c.center}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const csv = () => {
    const rows = [['Case', 'Received', 'Applicant', 'Zone', 'Center', 'Category', 'Urgent', 'Fund', 'Status', 'Total', 'Paid'], ...list.map((c) => [c.id, fmtDay(c.createdAt), c.applicant.name, map.zones.find((z) => z.id === c.zone)?.name ?? c.zone, c.center, CATEGORIES[c.category], c.urgent ? 'Yes' : 'No', c.fund, STATUS[c.status], usd(totalOf(c)), usd(paidCents(c))])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `zakat-cases-${now.slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <section className="zk-list glass-pane" aria-label="Applications">
      <div className="zk-filters">
        <label className="m-search"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" /></svg><span className="sr-only">Search cases</span><input className="in" type="search" placeholder="Name, case number or reason" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="in pill-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{(Object.keys(STATUS) as CaseStatus[]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}</select>
        <MasjidPicker unrouted />
        <select className="in pill-select" aria-label="Fund" value={fund} onChange={(e) => setFund(e.target.value)}><option value="">Zakat and Sadaqah</option><option value="zakat">Zakat</option><option value="sadaqah">Sadaqah</option></select>
        <label className="check"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> <span>Urgent only</span></label>
        <button type="button" className="btn sm ghost" onClick={csv} disabled={!list.length}>Download CSV</button>
      </div>
      <p className="m-count">{list.length} case{list.length === 1 ? '' : 's'}</p>
      <div className="table-wrap"><table className="t-plain zk-table">
        <thead><tr><th>Applicant</th><th>For</th><th className="num">Amount</th><th>Center</th><th>Status</th><th>Next step</th></tr></thead>
        <tbody>{list.map((c) => (
          <tr key={c.id} data-case={c.id} onClick={() => onOpen(c.id)} className={isOverdue(c, s, now) ? 'late' : ''}>
            <td><button type="button" className="linkish zk-name" onClick={(e) => { e.stopPropagation(); onOpen(c.id); }}>{c.applicant.name}</button><small className="block">{c.id} · {fmtDay(c.createdAt)}</small></td>
            <td>{CATEGORIES[c.category]}{c.urgent && <span className="pill bad sm">Urgent</span>}</td>
            <td className="num">{usd(totalOf(c))}{c.months > 1 && <small className="block">{usd(amountOf(c))} × {c.months}</small>}</td>
            <td>{c.center || <span className="zn-missing">Not routed</span>}</td>
            <td><span className={`pill ${ST_TONE[c.status]}`}>{STATUS[c.status]}</span>{c.fund && <small className="block">{c.fund === 'zakat' ? 'Zakat' : 'Sadaqah'}</small>}</td>
            <td>{c.status === 'awaiting-approval' ? `Level ${nextLevel(c, s)}` : NEXT[c.status]}<small className={`block${isOverdue(c, s, now) ? ' zk-late' : ''}`}>{dueText(c, s, now)}</small></td>
          </tr>
        ))}{!list.length && <tr><td colSpan={6} className="empty">No cases match.</td></tr>}</tbody>
      </table></div>
    </section>
  );
}

/* ---------------- Approvals ---------------- */
function Approvals({ cases, s, now, me, onOpen }: { cases: ZakatCase[]; s: ZakatSettings; now: string; me: Actor; onOpen: (id: string) => void }) {
  const waiting = cases.filter((c) => c.status === 'awaiting-approval');
  const mine = waiting.filter((c) => actionsFor(c, me, s).some((a) => a === 'approve' || a === 'override'));
  const others = waiting.filter((c) => !mine.includes(c));
  return (
    <div className="zk-appr">
      <section className="zk-levels glass-pane" aria-label="Approval levels">
        {([1, 2, 3] as const).map((l) => (
          <div key={l} className={`zk-level${me.level === l ? ' me' : ''}`} data-level={l}>
            <b>Level {l}</b><span>{l === 1 ? 'Local Zakat Coordinator' : l === 2 ? 'Central Committee Member' : 'Committee Chair'}</span>
            <small>Up to {usd(s.levels[l])}{l === 3 ? ' · can override and fast-track' : ''}</small>
            <em>{waiting.filter((c) => nextLevel(c, s) === l).length} waiting</em>
            {me.level === l && <span className="pill good sm">You</span>}
          </div>
        ))}
        <p className="zk-levels-note">Monthly help counts the total of all months. Each person approves a case once. Above {usd(s.levels[3])} the Chair approves with an override.</p>
      </section>
      <section className="glass-pane zk-list" aria-label="Waiting for you">
        <h2>Waiting for you</h2>
        {mine.length ? <ul className="zk-rows">{mine.map((c) => <CaseRow key={c.id} c={c} s={s} now={now} onOpen={onOpen} action={actionLabel(actionsFor(c, me, s))} />)}</ul> : <p className="muted">{me.level || me.can('zakat.override') ? 'Nothing waiting at your level.' : 'Your role does not approve cases.'}</p>}
      </section>
      {others.length > 0 && <section className="glass-pane zk-list" aria-label="Waiting for others"><h2>Waiting for others</h2><ul className="zk-rows">{others.map((c) => <CaseRow key={c.id} c={c} s={s} now={now} onOpen={onOpen} action={`Level ${nextLevel(c, s)}`} />)}</ul></section>}
    </div>
  );
}

/* ---------------- Payouts ---------------- */
function Payouts({ cases, s, onOpen, me }: { cases: ZakatCase[]; s: ZakatSettings; onOpen: (id: string) => void; me: Actor }) {
  const ready = cases.filter((c) => c.status === 'approved');
  const done = cases.flatMap((c) => c.payouts.map((p) => ({ c, p }))).sort((a, b) => b.p.at.localeCompare(a.p.at));
  return (
    <div className="zk-pay">
      <section className="glass-pane zk-list" aria-label="Ready to pay">
        <h2>Ready to pay <span className="pill">{ready.length}</span></h2>
        {!me.can('zakat.disburse') && <p className="muted">Only the Zakat Operations Office pays out. You can see what is waiting.</p>}
        <div className="table-wrap"><table className="t-plain zk-table">
          <thead><tr><th>Applicant</th><th className="num">This payment</th><th>Payments</th><th>Fund</th><th /></tr></thead>
          <tbody>{ready.map((c) => (
            <tr key={c.id} data-case={c.id}><td><b>{c.applicant.name}</b><small className="block">{c.id} · {c.center}</small></td><td className="num">{usd(amountOf(c))}</td><td>{c.payouts.length} of {c.months}</td><td>{c.fund === 'zakat' ? 'Zakat' : 'Sadaqah'}</td>
              <td className="row-actions"><button type="button" className={`btn sm${actionsFor(c, me, s).includes('pay') ? ' primary' : ''}`} onClick={() => onOpen(c.id)}>{actionsFor(c, me, s).includes('pay') ? 'Pay out' : 'Open'}<span className="sr-only"> {c.applicant.name}</span></button></td></tr>
          ))}{!ready.length && <tr><td colSpan={5} className="empty">Nothing waiting to be paid.</td></tr>}</tbody>
        </table></div>
      </section>
      <section className="glass-pane zk-list" aria-label="Paid">
        <h2>Paid</h2>
        <div className="table-wrap"><table className="t-plain zk-table">
          <thead><tr><th>When</th><th>Applicant</th><th className="num">Amount</th><th>How</th><th>By</th></tr></thead>
          <tbody>{done.map(({ c, p }, i) => <tr key={i}><td>{fmtDay(p.at)}</td><td>{c.applicant.name}<small className="block">{c.id}</small></td><td className="num">{usd(p.amountCents)}</td><td>{p.method === 'transfer' ? 'Bank transfer' : p.method === 'check' ? 'Check' : 'Cash'}{p.ref && <small className="block">{p.ref}</small>}</td><td>{p.byName}</td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}

/* ---------------- Reports ---------------- */
function Reports({ cases, s, now, map }: { cases: ZakatCase[]; s: ZakatSettings; now: string; map: OrgStructure }) {
  const st = zakatStats(cases, s, now);
  const cats = (Object.keys(CATEGORIES) as Category[]).map((k) => ({ label: CATEGORIES[k].split(' ')[0], value: cases.filter((c) => c.category === k).length })).filter((x) => x.value > 0);
  const zones = map.zones.map((z) => ({ id: z.id, label: z.name.replace(' Zone', ''), values: [cases.filter((c) => c.zone === z.id).reduce((t, c) => t + paidCents(c), 0) / 100, cases.filter((c) => c.zone === z.id && c.status === 'approved').reduce((t, c) => t + totalOf(c) - paidCents(c), 0) / 100] })).filter((z) => z.values[0] + z.values[1] > 0);
  const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
  return (
    <div className="zk-reports">
      <div className="zk-kpis">
        <StatTile label="Asked for" value={usd(st.requestedCents)} note={`${st.total} cases`} />
        <StatTile label="Approved" value={usd(st.approvedCents)} />
        <StatTile label="Paid out" value={usd(st.paidCents)} />
        <StatTile label="Average time to first approval" value={st.avgHoursToFirstApproval == null ? '—' : `${st.avgHoursToFirstApproval} h`} note={`target ${s.hours.regular} h (urgent ${s.hours.emergency} h)`} />
      </div>
      <div className="zk-charts">
        <ChartCard id="zk-status" className="zk-wide" title="Where every case stands" note={`${cases.filter((c) => c.status === 'rejected').length} not approved (not shown in the bar).`} table={{ head: ['Status', 'Cases'], rows: st.byStatus.map((b) => [b.label, b.count]) }}>
          <ShareBar label="Open cases by stage" items={[
            { id: 'intake', label: 'Received or being verified', value: cases.filter((c) => ['new', 'verifying', 'info-requested'].includes(c.status)).length },
            { id: 'approval', label: 'Waiting for approval', value: cases.filter((c) => c.status === 'awaiting-approval').length },
            { id: 'topay', label: 'Approved – to pay', value: cases.filter((c) => c.status === 'approved').length },
            { id: 'paid', label: 'Paid', value: cases.filter((c) => c.status === 'paid').length },
          ]} />
        </ChartCard>
        <ChartCard id="zk-fund" title="Zakat or Sadaqah" note="Cases decided after verification." table={{ head: ['Fund', 'Cases'], rows: [['Zakat', st.zakat], ['Sadaqah', st.sadaqah]] }}>
          <Donut label="Cases by fund" centerLabel="decided" items={[{ id: 'zakat', label: 'Zakat', value: st.zakat }, { id: 'sadaqah', label: 'Sadaqah', value: st.sadaqah }]} />
        </ChartCard>
        <ChartCard id="zk-cat" title="What people ask help for" table={{ head: ['Need', 'Cases'], rows: cats.map((c) => [c.label, c.value]) }}>
          <Columns label="Cases by need" items={cats} ramp={false} />
        </ChartCard>
        <ChartCard id="zk-zone" className="zk-wide" title="Money by zone" note="Paid, and approved but not paid yet." table={{ head: ['Zone', 'Paid', 'To pay'], rows: zones.map((z) => [z.label, money(z.values[0]), money(z.values[1])]) }}>
          <StackedBars label="Money by zone" parts={[{ name: 'Paid', slot: 1 }, { name: 'To pay', slot: 2 }]} rows={zones} format={money} />
        </ChartCard>
      </div>
    </div>
  );
}

/* ---------------- one case ---------------- */
function CasePanel({ c, s, me, map, onClose }: { c: ZakatCase; s: ZakatSettings; me: Actor; map: OrgStructure; onClose: () => void }) {
  const now = nowIso();
  const acts = actionsFor(c, me, s);
  const blocked = blockedReason(c, me, s);
  const [err, setErr] = useState('');
  const [amount, setAmount] = useState(String(amountOf(c) / 100));
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<'transfer' | 'check' | 'cash'>('transfer');
  const [ref, setRef] = useState('');
  const [visit, setVisit] = useState({ on: now.slice(0, 10), note: '' });
  const run = (f: () => ZakatCase, action: string, detail = '') => { try { const next = f(); saveCase(next, action, detail); setErr(''); setNote(''); setRef(''); } catch (e) { setErr((e as Error).message); } };
  const cents = Math.round(Number(amount) * 100);
  const zone = map.zones.find((z) => z.id === c.zone);
  const vp = verifyProblems(c, s);
  return (
    <aside className="m-peek zk-case glass-float" aria-label={`Case ${c.id}`} data-open-case={c.id}>
      <div className="m-peek-top"><span className="m-peek-pos">{c.id} · received {fmtWhen(c.createdAt)} · {c.channel === 'in-person' ? 'in person' : c.channel}</span>
        <button type="button" className="icon-btn" aria-label="Close case" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /></svg></button></div>
      <div><h2 className="zk-case-h">{c.applicant.name}</h2>
        <p className="m-peek-status">{c.urgent && <span className="pill bad">Urgent</span>}<span className={`pill ${ST_TONE[c.status]}`}>{STATUS[c.status]}</span>{c.fund && <span className="pill">{c.fund === 'zakat' ? 'Zakat' : 'Sadaqah'}</span>}<small className={isOverdue(c, s, now) ? 'zk-late' : 'muted'}>{dueText(c, s, now)}</small></p></div>
      <dl className="m-peek-facts">
        <div><dt>Needs help with</dt><dd>{CATEGORIES[c.category]} – {c.reason}</dd></div>
        <div><dt>Amount</dt><dd>{usd(totalOf(c))}{c.months > 1 ? ` (${usd(amountOf(c))} a month for ${c.months} months)` : ''}{amountOf(c) !== c.requestedCents && <small className="block">Asked for {usd(c.requestedCents * c.months)}</small>}</dd></div>
        <div><dt>Household and income</dt><dd>{c.applicant.household} people · {usd(c.applicant.monthlyIncomeCents)} a month</dd></div>
        <div><dt>Placed in</dt><dd>{zone?.name ?? 'No zone'} · {c.center || 'no center yet'} <small className="block">ZIP {c.applicant.zip}</small></dd></div>
        {c.applicant.phone && <div><dt>Phone</dt><dd><a href={`tel:+1${c.applicant.phone.replace(/\D/g, '')}`}>{c.applicant.phone}</a></dd></div>}
      </dl>

      <ol className="zk-steps" aria-label="Steps">
        <Step done title="Received" text={`${c.channel === 'website' ? 'Website' : c.channel === 'app' ? 'Mobile app' : 'In person'} · ${fmtWhen(c.createdAt)}`} />
        <Step done={!!c.fund || c.status === 'rejected'} title="Verified" text={c.fund ? `${c.fund === 'zakat' ? 'Zakat' : 'Sadaqah'} · documents, income, hardship checked${c.homeVisit ? ` · home visit ${c.homeVisit.on}` : ''}` : `${[c.checks.documents && 'documents', c.checks.income && 'income', c.checks.hardship && 'hardship'].filter(Boolean).join(', ') || 'not started'}`} />
        {c.approvals.map((a, i) => <Step key={i} done tone={a.decision === 'approve' ? 'ok' : 'bad'} title={`${a.decision === 'approve' ? (a.override ? 'Approved by override' : `Level ${a.level} approved`) : a.decision === 'return' ? `Sent back at level ${a.level}` : 'Not approved'}`} text={`${a.byName} · ${fmtWhen(a.at)}${a.amountCents != null && a.decision === 'approve' ? ` · ${usd(a.amountCents)}` : ''}${a.note ? ` · “${a.note}”` : ''}`} />)}
        {c.status === 'awaiting-approval' && <Step title={`Level ${nextLevel(c, s)} approval`} text={`Waiting · ${dueText(c, s, now)}`} />}
        {c.payouts.map((p, i) => <Step key={`p${i}`} done tone="ok" title={`Paid ${c.months > 1 ? `(${i + 1} of ${c.months})` : ''}`} text={`${usd(p.amountCents)} by ${p.method === 'transfer' ? 'bank transfer' : p.method} ${p.ref} · ${p.byName} · ${fmtDay(p.at)}`} />)}
        {c.status === 'approved' && <Step title="Payout" text={`${c.payouts.length} of ${c.months} paid`} />}
      </ol>
      {c.notes.length > 0 && <ul className="zk-notes">{c.notes.map((n, i) => <li key={i}><b>{n.byName}</b> · {fmtDay(n.at)}<span className="block">{n.text}</span></li>)}</ul>}

      {blocked && <p className="notice warn-note">{blocked}</p>}
      {err && <p className="sf-err" role="alert">{err}</p>}

      {acts.includes('verify') && (
        <section className="zk-act" aria-label="Verify">
          <h3>Verify</h3>
          {(['documents', 'income', 'hardship'] as const).map((k) => (
            <label key={k} className="check"><input type="checkbox" checked={c.checks[k]} onChange={(e) => run(() => ({ ...c, status: c.status === 'new' ? 'verifying' : c.status, coordinator: c.coordinator || me.id, checks: { ...c.checks, [k]: e.target.checked } }), 'Verification updated', k)} /> <span>{k === 'documents' ? 'Documents checked' : k === 'income' ? 'Income checked' : 'Hardship confirmed'}</span></label>
          ))}
          {c.homeVisit ? <p className="muted">Home visit {c.homeVisit.on}: {c.homeVisit.note}</p> : (
            <div className="zk-visit"><input className="in" type="date" aria-label="Home visit date" value={visit.on} max={now.slice(0, 10)} onChange={(e) => setVisit({ ...visit, on: e.target.value })} /><input className="in" aria-label="Home visit note" placeholder="What you saw" value={visit.note} onChange={(e) => setVisit({ ...visit, note: e.target.value })} />
              <button type="button" className="btn sm" disabled={visit.note.trim().length < 5} onClick={() => run(() => ({ ...c, homeVisit: { on: visit.on, by: me.name, note: visit.note } }), 'Home visit recorded')}>Record home visit</button></div>
          )}
          {vp.length > 0 && <ul className="zk-todo">{vp.map((p) => <li key={p}>{p}</li>)}</ul>}
          <div className="row-actions">
            <button type="button" className="btn primary" disabled={vp.length > 0} onClick={() => run(() => decideEligibility(c, 'zakat', s, now, me.name), 'Decided: Zakat')}>Zakat eligible</button>
            {s.sadaqah.routing && <button type="button" className="btn" disabled={vp.length > 0} onClick={() => run(() => decideEligibility(c, 'sadaqah', s, now, me.name), 'Decided: Sadaqah')}>Route to Sadaqah</button>}
            <button type="button" className="btn ghost" onClick={() => run(() => decideEligibility(c, 'none', s, now, me.name), 'Decided: not eligible')}>Not eligible</button>
          </div>
          {acts.includes('request-info') && <div className="zk-visit"><input className="in" aria-label="What is missing" placeholder="What the applicant must send" value={note} onChange={(e) => setNote(e.target.value)} /><button type="button" className="btn sm" disabled={note.trim().length < 5} onClick={() => run(() => ({ ...c, status: 'info-requested', stepSince: now, notes: [...c.notes, { at: now, byName: me.name, text: note }] }), 'Asked the applicant for more', note)}>Ask the applicant</button></div>}
        </section>
      )}
      {(acts.includes('approve') || acts.includes('override')) && (
        <section className="zk-act" aria-label="Approve">
          <h3>{acts.includes('approve') ? `Level ${me.level} approval` : 'Chair: approve now'}</h3>
          <div className="field-row">
            <label className="sf-field"><span className="sf-label">{c.months > 1 ? 'Amount a month' : 'Amount'}</span><span className="in-money"><i>$</i><input className="in" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></span></label>
            <label className="sf-field"><span className="sf-label">Note <span className="sf-opt">needed to send back or decline</span></span><input className="in" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <p className="sf-hint">{c.months > 1 ? `Total ${usd(cents * c.months)}. ` : ''}{acts.includes('approve') ? `Your limit is ${usd(s.levels[me.level as 1 | 2 | 3])}${cents * c.months > s.levels[me.level as 1 | 2 | 3] ? ' – the next level approves after you.' : ' – your approval completes it.'}` : 'An override completes the approval at any amount and level.'}</p>
          <div className="row-actions">
            {acts.includes('approve') && <button type="button" className="btn primary" onClick={() => run(() => approve(c, me, s, now, cents, note), 'Approved', `Level ${me.level}, ${usd(cents)}`)}>Approve {usd(cents * c.months)}</button>}
            {acts.includes('override') && <button type="button" className={`btn${acts.includes('approve') ? '' : ' primary'}`} onClick={() => run(() => approve(c, me, s, now, cents, note || 'Chair override', true), 'Approved by override', usd(cents))}>Approve with override</button>}
            {acts.includes('return') && <button type="button" className="btn ghost" onClick={() => run(() => decline(c, me, s, now, 'return', note), 'Sent back', note)}>Send back</button>}
            {acts.includes('reject') && <button type="button" className="btn ghost danger-ghost" onClick={() => run(() => decline(c, me, s, now, 'reject', note), 'Not approved', note)}>Decline</button>}
          </div>
        </section>
      )}
      {acts.includes('pay') && (
        <section className="zk-act" aria-label="Pay out">
          <h3>Pay {usd(amountOf(c))}{c.months > 1 ? ` (payment ${c.payouts.length + 1} of ${c.months})` : ''}</h3>
          <div className="field-row">
            <label className="sf-field"><span className="sf-label">How</span><select className="in" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="transfer">Bank transfer</option><option value="check">Check</option><option value="cash">Cash</option></select></label>
            <label className="sf-field"><span className="sf-label">{method === 'check' ? 'Check number' : method === 'transfer' ? 'Transfer reference' : 'Receipt (optional)'}</span><input className="in" value={ref} onChange={(e) => setRef(e.target.value)} /></label>
          </div>
          <button type="button" className="btn primary" onClick={() => run(() => pay(c, me, s, now, method, ref), 'Paid out', `${usd(amountOf(c))} by ${method} ${ref}`)}>Record payment</button>
        </section>
      )}
    </aside>
  );
}
function Step({ title, text, done, tone }: { title: string; text: string; done?: boolean; tone?: 'ok' | 'bad' }) {
  return <li className={`${done ? 'done' : 'todo'}${tone ? ` ${tone}` : ''}`}><b>{title}</b><span>{text}</span></li>;
}

/* ---------------- new application ---------------- */
function IntakeDialog({ s, map, all, onClose, onSaved }: { s: ZakatSettings; map: OrgStructure; all: ZakatCase[]; onClose: () => void; onSaved: (id: string) => void }) {
  const now = nowIso();
  const [f, setF] = useState({ channel: 'in-person' as ZakatCase['channel'], urgent: false, name: '', phone: '', zip: '', household: '1', income: '', category: 'rent' as Category, reason: '', amount: '', months: '1', center: '' });
  const [errs, setErrs] = useState<string[]>([]);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const zone = /^\d{5}$/.test(f.zip) ? zoneForZip(map, f.zip) : null;
  const centers = zone ? centersIn(map, zone.id) : [];
  const save = (e: FormEvent) => {
    e.preventDefault();
    const id = nextCaseId(all, Number(now.slice(0, 4)));
    const c: ZakatCase = { id, createdAt: now, channel: f.channel, urgent: f.urgent, applicant: { name: f.name, phone: f.phone, email: '', zip: f.zip, household: Number(f.household) || 1, monthlyIncomeCents: Math.round(Number(f.income || 0) * 100) },
      category: f.category, reason: f.reason, requestedCents: Math.round(Number(f.amount || 0) * 100), months: Number(f.months) || 1, zone: zone?.id ?? '', center: f.center || centers[0]?.name || '', coordinator: '',
      status: 'new', stepSince: now, fund: '', checks: { documents: false, income: false, hardship: false }, homeVisit: null, approvals: [], payouts: [], notes: [] };
    const p = [...intakeProblems(c, s), ...(zone ? [] : ['That ZIP code is not in any zone yet (Zones and centers › ZIP codes).'])];
    setErrs(p);
    if (p.length) return;
    saveCase(c, 'Application received', `${f.channel}, ${usd(c.requestedCents * c.months)}`);
    onSaved(id);
  };
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  return (
    <dialog ref={open} className="modal glass-float zn-dialog" aria-label="New application" onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={save} noValidate>
        <h2>New application</h2>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Received by</span><select className="in" value={f.channel} onChange={(e) => set({ channel: e.target.value as ZakatCase['channel'] })}>{s.channels.inPerson && <option value="in-person">In person / phone</option>}{s.channels.website && <option value="website">Website</option>}{s.channels.app && <option value="app">Mobile app</option>}</select></label>
          <label className="check zk-urgent"><input type="checkbox" checked={f.urgent} onChange={(e) => set({ urgent: e.target.checked })} /> <span>Urgent – eviction, utility cut-off, medical</span></label>
        </div>
        <div className="field-row">
          <Field label="Applicant name"><input className="in" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Phone"><input className="in" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        </div>
        <div className="field-row">
          <Field label="Home ZIP code"><input className="in" inputMode="numeric" maxLength={5} value={f.zip} onChange={(e) => set({ zip: e.target.value.replace(/\D/g, ''), center: '' })} />
            {f.zip.length === 5 && <small className={zone ? 'sf-hint' : 'sf-err'}>{zone ? `Goes to ${zone.name}` : 'This ZIP code is not in any zone yet.'}</small>}</Field>
          <Field label="Islamic Center"><select className="in" value={f.center || centers[0]?.name || ''} onChange={(e) => set({ center: e.target.value })} disabled={!centers.length}>{centers.length ? centers.map((c) => <option key={c.id}>{c.name}</option>) : <option value="">Enter the ZIP code first</option>}</select></Field>
        </div>
        <div className="field-row">
          <Field label="People in the household"><input className="in" type="number" min="1" max="20" value={f.household} onChange={(e) => set({ household: e.target.value })} /></Field>
          <Field label="Monthly income"><span className="in-money"><i>$</i><input className="in" type="number" min="0" value={f.income} onChange={(e) => set({ income: e.target.value })} /></span></Field>
        </div>
        <div className="field-row">
          <Field label="Help with"><select className="in" value={f.category} onChange={(e) => set({ category: e.target.value as Category })}>{(Object.keys(CATEGORIES) as Category[]).map((k) => <option key={k} value={k}>{CATEGORIES[k]}</option>)}</select></Field>
          <Field label="Amount needed"><span className="in-money"><i>$</i><input className="in" type="number" min="1" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></span></Field>
        </div>
        <Field label={`Months of help (1 = one time; up to ${s.recurringMaxMonths})`}><input className="in in-num" type="number" min="1" max="12" value={f.months} onChange={(e) => set({ months: e.target.value })} /></Field>
        <Field label="What the help is for"><textarea className="in in-area" rows={3} value={f.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
        {errs.length > 0 && <ul className="notice warn-note" role="alert">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">Save application</button></div>
      </form>
    </dialog>
  );
}
const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="sf-field"><span className="sf-label">{label}</span>{children}</label>;
