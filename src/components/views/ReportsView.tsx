'use client';
/**
 * A9 Reports + voter list snapshot. Membership, dues, voter list (frozen snapshots with a fingerprint and versioned
 * corrections), Area Representatives, candidate eligibility and events. Every table downloads as a spreadsheet-safe CSV.
 * DEMO: computed in the browser from the sample members; snapshots are kept in this browser.
 * Live (B9): GET /admin/reports/{name}?year=, POST /admin/elections/{year}/voter-list (snapshot), GET …/voter-list/{v}.csv
 */
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Tabs } from '@/components/editor/bits';
import { useMembers } from './MembersView';
import { centerOf, YEAR, fmtDate, fmtMoney, recordDate, type Member, ORG_TZ } from '@/lib/members/members';
import type { EventsDoc } from '@/lib/community/events';
import {
  approvedAfterRecord, areaReps, candidates, countBy, csvOf, diffSnapshots, duesReport, eventsReport, membershipSummary, nonVoters, voterRows, voterSnapshot,
  type Pt, type Snapshot, type VoterRow,
} from '@/lib/reports/reports';
import { useAccess } from '@/lib/access/use-access';
import { currentAdminName, logAudit } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';

/** Live: the frozen versions kept by the server (rows and SHA-256 fingerprint checked there). */
async function loadLiveSnapshots(year: number): Promise<Snapshot[]> {
  const r = await be<{ recordDate: string; versions: { version: number; frozenAt: string; frozenBy: string; reason: string; fingerprint: string }[] }>('GET', `admin/voters/${year}`);
  if (!r.ok) return [];
  return Promise.all(r.data.versions.map(async (v) => {
    const d = await be<{ voters: VoterRow[] }>('GET', `admin/voters/${year}/${v.version}`);
    return { year, recordDate: r.data.recordDate, version: v.version, takenAt: v.frozenAt, takenBy: v.frozenBy, reason: v.reason, rows: d.ok ? d.data.voters : [], fingerprint: v.fingerprint };
  }));
}

const KEY = 'isgh-admin-voter-snapshots';
const readSnaps = (): Snapshot[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const chicagoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const n = (x: number) => x.toLocaleString('en-US');
function download(name: string, csv: string) {
  logAudit({ area: 'export', action: 'Report downloaded', detail: `${name} (${Math.max(0, csv.split('\r\n').length - 1)} rows)` });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export function ReportsView({ search = '' }: { search?: string }) {
  const all = useMembers();
  const mf = useMasjidFilter();
  const members = useMemo(() => all?.filter((m) => mf.keep(m.zone, centerOf(m), m.zip)) ?? null, [all, mf.zone, mf.masjid, mf.access.ready, mf.access.me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [year, setYear] = useState(() => Number(new URLSearchParams(search).get('year')) || YEAR);
  const [events, setEvents] = useState<EventsDoc | null>(null);
  useEffect(() => { void fetch('/api/store/events').then((r) => (r.ok ? r.json() : null)).then((j) => setEvents(j?.data ?? null)).catch(() => setEvents(null)); }, []);
  if (!members) return <div className="page"><p className="muted" role="status">Loading reports…</p></div>;
  return (
    <div className="page reports">
      <header className="page-head">
        <div><h1>Reports</h1><p className="page-intro">Membership, dues, the voter list and election numbers. Every table downloads as a spreadsheet.{LIVE ? (mf.narrowed ? ` ${members.length.toLocaleString('en-US')} members in ${mf.label}.` : ` ${members.length.toLocaleString('en-US')} members.`) : ` Demo data – ${mf.narrowed ? `${members.length.toLocaleString('en-US')} members in ${mf.label}` : '320 sample members'}.`}</p></div>
        <div className="page-actions">
          <MasjidPicker />
          <label className="rp-year">Year <select className="in pill-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>{[YEAR - 2, YEAR - 1, YEAR, YEAR + 1].map((y) => <option key={y}>{y}</option>)}</select></label>
          <button type="button" className="btn" onClick={() => window.print()}>Print</button>
        </div>
      </header>
      <Tabs label="Reports" tabs={[
        { id: 'overview', label: 'Membership', render: () => <Overview members={members} year={year} /> },
        { id: 'dues', label: 'Dues', render: () => <Dues members={members} year={year} /> },
        { id: 'voters', label: 'Voter list', render: () => <Voters members={members} year={year} /> },
        { id: 'area-reps', label: 'Area Representatives', render: () => <AreaReps members={members} year={year} /> },
        { id: 'candidates', label: 'Candidates', render: () => <Candidates members={members} year={year} /> },
        { id: 'events', label: 'Events', render: () => <Events doc={events} /> },
      ]} />
    </div>
  );
}

/* ---------- pieces ---------- */
const Tile = ({ label, value, note, id }: { label: string; value: string; note?: string; id?: string }) => <div className="m-kpi glass-pane rp-tile" data-tile={id}><span>{label}</span><b>{value}</b>{note && <small>{note}</small>}</div>;
function Section({ title, csv, children, intro }: { title: string; intro?: ReactNode; csv?: () => void; children: ReactNode }) {
  return (
    <section className="panel glass-pane rp-sec" aria-label={title}>
      <div className="rp-sec-head"><h2 className="panel-h">{title}</h2>{csv && <button type="button" className="btn sm" onClick={csv}>Download CSV<span className="sr-only"> – {title}</span></button>}</div>
      {intro && <p className="panel-intro">{intro}</p>}
      {children}
    </section>
  );
}
/** One series, one hue (the theme accent); hover or focus a bar for the exact value; the same numbers as a table below. */
function BarChart({ data, format, head }: { data: Pt[]; format: (v: number) => string; head: [string, string] }) {
  const [hi, setHi] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="chart rp-chart">
      <div className="rp-bars" role="img" aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}>
        {data.map((d, i) => (
          <div key={d.label} className="rp-bar" tabIndex={0} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onFocus={() => setHi(i)} onBlur={() => setHi(null)}>
            <div className="rp-track"><div className="rp-fill" style={{ height: `${(d.value / max) * 100}%` }} />{hi === i && <span className="rp-tip" role="tooltip">{d.label}: {format(d.value)}</span>}</div>
            <span className="rp-lab">{d.label}</span>
          </div>
        ))}
      </div>
      <details className="rp-table"><summary>Show as a table</summary>
        <table className="t-plain"><thead><tr><th>{head[0]}</th><th className="num">{head[1]}</th></tr></thead><tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td className="num">{format(d.value)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}
function Table({ head, rows, num = [], max = 200 }: { head: string[]; rows: (string | number)[][]; num?: number[]; max?: number }) {
  return (
    <div className="table-wrap rp-tbl"><table className="t-plain">
      <thead><tr>{head.map((h, i) => <th key={h} className={num.includes(i) ? 'num' : undefined}>{h}</th>)}</tr></thead>
      <tbody>{rows.slice(0, max).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={num.includes(j) ? 'num' : undefined}>{typeof c === 'number' ? n(c) : c}</td>)}</tr>)}</tbody>
    </table>{rows.length > max && <p className="muted">First {max} of {n(rows.length)} – download the CSV for all.</p>}</div>
  );
}

/* ---------- membership ---------- */
function Overview({ members, year }: { members: Member[]; year: number }) {
  const today = chicagoToday();
  const s = useMemo(() => membershipSummary(members, year, today), [members, year, today]);
  const voters = s.byZone.reduce((x, z) => x + z.voters, 0);
  return (
    <div className="rp-body">
      <div className="m-kpis">
        <Tile id="members" label="Members on record" value={n(s.total)} note="not counting archived" />
        <Tile id="active" label={`Active in ${year}`} value={n(s.byStatus.active + s.byStatus.life)} note={`${n(s.byStatus.life)} life members`} />
        <Tile id="voters" label={`Can vote in ${year}`} value={n(voters)} note={`record date ${fmtDate(recordDate(year))}`} />
        <Tile id="renewal" label="Renewal rate" value={pct(s.renewal.rate)} note={`${n(s.renewal.renewed)} of ${n(s.renewal.prev)} who paid in ${year - 1}`} />
      </div>
      <Section title="New members by month" intro="Board approvals in the last 12 months.">
        <BarChart data={s.newByMonth} format={(v) => `${v} new`} head={['Month', 'New members']} />
      </Section>
      <Section title="By zone" csv={() => download(`members-by-zone-${year}.csv`, csvOf(['Zone', 'Members', `Active ${year}`, `Can vote ${year}`], s.byZone.map((z) => [z.zone, z.members, z.active, z.voters])))}>
        <Table head={['Zone', 'Members', `Active ${year}`, `Can vote ${year}`]} rows={s.byZone.map((z) => [z.zone, z.members, z.active, z.voters])} num={[1, 2, 3]} />
      </Section>
      <Section title="By status and plan">
        <div className="rp-two">
          <Table head={['Status', 'Members']} rows={Object.entries(s.byStatus).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v])} num={[1]} />
          <Table head={['Plan', 'Members']} rows={s.byPlan.map((p) => [p.label, p.value])} num={[1]} />
        </div>
      </Section>
    </div>
  );
}

/* ---------- dues ---------- */
function Dues({ members, year }: { members: Member[]; year: number }) {
  const d = useMemo(() => duesReport(members, year), [members, year]);
  const contact = useAccess().can('members.contact');
  return (
    <div className="rp-body">
      <div className="m-kpis">
        <Tile id="collected" label={`${year} dues collected`} value={fmtMoney(d.collectedCents)} note={`${n(d.count)} payments`} />
        <Tile id="ontime" label="Paid by the record date" value={n(d.onTime.count)} note={`by ${fmtDate(recordDate(year))} – counts for the vote`} />
        <Tile id="late" label="Paid after it" value={n(d.late.count)} note="renews, but no vote that year" />
        <Tile id="not-renewed" label="Not renewed yet" value={n(d.notRenewed.length)} note={`paid ${year - 1}, not ${year}`} />
      </div>
      <Section title={`Dues by month, ${year}`}><BarChart data={d.byMonth} format={(v) => fmtMoney(v)} head={['Month', 'Dues']} /></Section>
      <Section title="By payment method and plan">
        <div className="rp-two">
          <Table head={['Method', 'Payments', 'Amount']} rows={d.byMethod.map((m) => [m.label, m.count, fmtMoney(m.value)])} num={[1, 2]} />
          <Table head={['Plan', 'Payments', 'Amount']} rows={d.byPlan.map((m) => [m.label, m.count, fmtMoney(m.value)])} num={[1, 2]} />
        </div>
        {d.paidByOther > 0 && <p className="notice warn-note">{n(d.paidByOther)} payment{d.paidByOther === 1 ? ' was' : 's were'} made by someone who is not a relative – those renew the membership but do not count for the vote (Bylaws).</p>}
      </Section>
      <Section title="Not renewed yet" intro="Paid last year, not this year. Use it for calls and the renewal reminder group."
        csv={!contact ? undefined : () => download(`not-renewed-${year}.csv`, csvOf(['Member ID', 'Name', 'Zone', 'Islamic Center', 'Phone', 'Email'], d.notRenewed.map((r) => [r.id, r.name, r.zone, r.center, r.phone, r.email])))}>
        <Table head={['Member', 'Zone', 'Islamic Center', 'Phone']} rows={d.notRenewed.map((r) => [`${r.name} (${r.id})`, r.zone, r.center, contact ? r.phone : '—'])} max={50} />
      </Section>
    </div>
  );
}

/* ---------- voter list ---------- */
function Voters({ members, year }: { members: Member[]; year: number }) {
  const today = chicagoToday(); const rd = recordDate(year);
  const mayFreeze = useAccess().can('voters.freeze');
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [zone, setZone] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { if (LIVE) void loadLiveSnapshots(year).then(setSnaps); else setSnaps(readSnaps()); }, [year]);
  const mine = snaps.filter((s) => s.year === year).sort((a, b) => b.version - a.version);
  const latest = mine[0];
  const now = useMemo(() => voterRows(members, year), [members, year]);
  const non = useMemo(() => nonVoters(members, year), [members, year]);
  const late = useMemo(() => approvedAfterRecord(members, year), [members, year]);
  const diff = latest ? diffSnapshots(latest, { ...latest, rows: now }) : null;
  const take = async () => {
    setErr('');
    if (LIVE) {   // the server freezes the list from its own records and keeps the fingerprint
      const r = await be<{ version: number; voters: number }>('POST', `admin/voters/${year}/freeze`, reason ? { reason } : {});
      if (!r.ok) { setErr(r.message); return; }
      setReason(''); setSnaps(await loadLiveSnapshots(year)); return;
    }
    try {
      const s = await voterSnapshot(members, year, currentAdminName(), new Date().toISOString(), snaps, reason);
      const next = [...snaps, s]; setSnaps(next); setReason('');
      logAudit({ area: 'voters', action: `Voter list ${year} version ${s.version} frozen`, detail: `${s.rows.length} voters · fingerprint ${s.fingerprint.slice(0, 16)} · ${s.reason}` });
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* full */ }
    } catch (e) { setErr((e as Error).message); }
  };
  const list = latest?.rows ?? [];
  const shown = list.filter((r) => (!zone || r.zone === zone) && (!q || `${r.name} ${r.id} ${r.center}`.toLowerCase().includes(q.toLowerCase())));
  const before = today <= rd;
  return (
    <div className="rp-body">
      <div className="m-kpis">
        <Tile id="eligible-now" label="Eligible right now" value={n(now.length)} note={`rules on ${fmtDate(rd)}`} />
        <Tile id="snapshot" label="Frozen list" value={latest ? `Version ${latest.version}` : 'Not taken'} note={latest ? `${n(latest.rows.length)} voters · ${fmtDate(latest.takenAt.slice(0, 10))}` : 'take it after the record date'} />
        <Tile id="non-voters" label="Members who cannot vote" value={n(non.length)} note="approved, in good standing" />
      </div>
      <Section title={`Voter list ${year}`} intro={<>Bylaws Art. I §2: approved, 18 or older, own dues paid by {fmtDate(rd)} (or Life), living in a zone, in good standing. The frozen list does not change when records change later – a correction is a new version with a reason. The fingerprint lets anyone check the list was not edited.</>}>
        {before && <p className="notice warn-note" role="note">The record date ({fmtDate(rd)}) has not passed yet – members can still pay on time. Take the snapshot after it.</p>}
        {!latest ? (
          <div className="row-actions">{mayFreeze ? <button type="button" className="btn primary" disabled={before} onClick={take}>Freeze the voter list ({n(now.length)} voters)</button> : <p className="muted">Only the Election Commission can freeze the voter list.</p>}</div>
        ) : (<>
          <div className="table-wrap"><table className="t-plain rp-versions"><thead><tr><th>Version</th><th>Taken</th><th>By</th><th className="num">Voters</th><th>Reason</th><th>Fingerprint (SHA-256)</th></tr></thead>
            <tbody>{mine.map((s) => <tr key={s.version} data-version={s.version}><td>{s.version}</td><td>{fmtDate(s.takenAt.slice(0, 10))}</td><td>{s.takenBy}</td><td className="num">{n(s.rows.length)}</td><td>{s.reason}</td><td><code title={s.fingerprint}>{s.fingerprint.slice(0, 16)}…</code></td></tr>)}</tbody></table></div>
          {diff && (diff.added.length || diff.removed.length) ? (
            <div className="notice rp-diff" role="status">
              <b>Since version {latest.version}: {diff.added.length} now eligible, {diff.removed.length} no longer eligible.</b>
              <ul>{[...diff.added.slice(0, 5).map((r) => `+ ${r.name} (${r.id})`), ...diff.removed.slice(0, 5).map((r) => `− ${r.name} (${r.id})`)].map((t) => <li key={t}>{t}</li>)}</ul>
              <label className="sf-field"><span className="sf-label">Reason for a new version (goes on the list)</span><input className="in" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Election Commission decision on appeals, 11/02/2026" /></label>
              {err && <p className="sf-err" role="alert">{err}</p>}
              {mayFreeze ? <button type="button" className="btn primary" onClick={take}>Save version {latest.version + 1}</button> : <p className="muted">Only the Election Commission can save a new version.</p>}
            </div>
          ) : <p className="muted rp-diff-none">No changes since version {latest.version}.</p>}
          <div className="filters rp-filters">
            <label className="sr-only" htmlFor="vl-q">Search the list</label><input id="vl-q" className="in" type="search" placeholder="Name, member ID or center" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="sr-only" htmlFor="vl-z">Zone</label><select id="vl-z" className="in pill-select" value={zone} onChange={(e) => setZone(e.target.value)}><option value="">All zones</option>{countBy(list, 'zone').map((z) => <option key={z.label} value={z.label}>{z.label} ({z.value})</option>)}</select>
            <button type="button" className="btn sm" onClick={() => download(`voter-list-${year}-v${latest.version}-${latest.fingerprint.slice(0, 8)}.csv`, csvOf(['Member ID', 'Name', 'Zone', 'Islamic Center'], list.map((r) => [r.id, r.name, r.zone, r.center])))}>Download version {latest.version} (CSV)</button>
          </div>
          <Table head={['Member ID', 'Name', 'Zone', 'Islamic Center']} rows={shown.map((r) => [r.id, r.name, r.zone, r.center])} max={100} />
          <p className="muted">The list shows member ID, name, zone and center only – no birth dates, phones or emails.</p>
        </>)}
      </Section>
      {late.length > 0 && <Section title="Approved after the record date" intro="These members meet every rule today but were approved by the Board after the record date. The Election Commission decides whether they vote this year.">
        <Table head={['Member', 'Approved']} rows={late.map((r) => [`${r.name} (${r.id})`, fmtDate(r.approvedOn)])} />
      </Section>}
      <Section title="Members who cannot vote" intro="Approved members in good standing who miss a rule – for appeals before the final list and for outreach next year."
        csv={() => download(`non-voters-${year}.csv`, csvOf(['Member ID', 'Name', 'Zone', 'Islamic Center', 'Rule', 'Why'], non.map((r) => [r.id, r.name, r.zone, r.center, r.rule, r.reason])))}>
        <Table head={['Member', 'Zone', 'Rule not met', 'Why']} rows={non.map((r) => [`${r.name} (${r.id})`, r.zone, r.rule, r.reason])} max={50} />
      </Section>
    </div>
  );
}

/* ---------- Area Representatives ---------- */
function AreaReps({ members, year }: { members: Member[]; year: number }) {
  const [ratio, setRatio] = useState(40);
  const [round, setRound] = useState<'down' | 'up'>('down');
  const a = useMemo(() => areaReps(members, year, Math.max(1, ratio), round), [members, year, ratio, round]);
  return (
    <div className="rp-body">
      <div className="m-kpis">
        <Tile id="reps" label="Area Representatives" value={n(a.totalReps)} note={`one per ${ratio} eligible voters`} />
        <Tile id="rep-voters" label="Eligible voters counted" value={n(a.totalVoters)} note={`in ${a.rows.length} ZIP areas`} />
      </div>
      <Section title="Area Representatives by center" intro={<>Bylaws Art. II: one Area Representative per 40 eligible voting members in a ZIP area of a center. Whether a partial group (for example 70 voters) gets a second seat is the Election Commission’s call – choose the rounding below.</>}
        csv={() => download(`area-representatives-${year}.csv`, csvOf(['Zone', 'Islamic Center', 'ZIP', 'Eligible voters', 'Representatives'], a.rows.map((r) => [r.zone, r.center, r.zip, r.voters, r.reps])))}>
        <div className="filters rp-filters">
          <label>Voters per representative <input className="in narrow" type="number" min={1} max={500} value={ratio} onChange={(e) => setRatio(Number(e.target.value) || 40)} /></label>
          <label>Partial groups <select className="in pill-select" value={round} onChange={(e) => setRound(e.target.value as 'down' | 'up')}><option value="down">Round down (a full 40 needed)</option><option value="up">Round up (any part counts)</option></select></label>
        </div>
        <Table head={['Zone', 'Islamic Center', 'Eligible voters', 'Representatives']} rows={a.byCenter.map((c) => [c.zone, c.center, c.voters, c.reps])} num={[2, 3]} />
        <details className="rp-table"><summary>By ZIP area ({a.rows.length})</summary>
          <Table head={['Islamic Center', 'ZIP', 'Voters', 'Reps', 'Voters to next seat']} rows={a.rows.map((r) => [r.center, r.zip, r.voters, r.reps, r.toNext])} num={[2, 3, 4]} max={400} />
        </details>
      </Section>
    </div>
  );
}

/* ---------- candidates ---------- */
function Candidates({ members, year }: { members: Member[]; year: number }) {
  const c = useMemo(() => candidates(members, year), [members, year]);
  const [only, setOnly] = useState<'all' | 'board' | 'officer'>('all');
  const shown = c.filter((r) => only === 'all' || (only === 'board' ? r.board : r.officer));
  return (
    <div className="rp-body">
      <div className="m-kpis">
        <Tile id="can-run-board" label="Can run for the Board" value={n(c.filter((r) => r.board).length)} note="1+ year in good standing" />
        <Tile id="can-run-officer" label="Can run for President / VP" value={n(c.filter((r) => r.officer).length)} note="2+ years in good standing" />
        <Tile id="new-voters" label="Voters, not yet eligible to run" value={n(c.filter((r) => !r.board).length)} note="first year in good standing" />
      </div>
      <Section title={`Who can run in ${year}`} intro="Years in good standing = years in a row before this election in which the member could vote (approved by that year’s record date, dues paid on time). US citizenship or permanent residence is checked by the Election Commission on paper."
        csv={() => download(`candidate-eligibility-${year}.csv`, csvOf(['Member ID', 'Name', 'Zone', 'Islamic Center', 'Years in good standing', 'Board', 'President / VP'], c.map((r) => [r.id, r.name, r.zone, r.center, r.years, r.board ? 'Yes' : 'No', r.officer ? 'Yes' : 'No'])))}>
        <div className="seg" role="radiogroup" aria-label="Show">{(['all', 'board', 'officer'] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={only === k} onClick={() => setOnly(k)}>{k === 'all' ? 'All voters' : k === 'board' ? 'Board' : 'President / VP'}</button>)}</div>
        <Table head={['Member', 'Zone', 'Years in good standing', 'Board', 'President / VP']} rows={shown.map((r) => [`${r.name} (${r.id})`, r.zone, r.years, r.board ? 'Yes' : 'No', r.officer ? 'Yes' : 'No'])} num={[2]} max={100} />
      </Section>
    </div>
  );
}

/* ---------- events ---------- */
function Events({ doc }: { doc: EventsDoc | null }) {
  const now = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 16);
  const rows = eventsReport(doc, now);
  return (
    <div className="rp-body">
      <Section title="Events with registration" intro="Registrations, how full each event is and waitlists. Estimated income uses the lowest price (the BE reports actual payments)."
        csv={() => download('events-report.csv', csvOf(['Event', 'Date', 'Registered', 'Capacity', 'Full', 'Waitlist', 'Estimated income'], rows.map((r) => [r.title, r.date, r.registered, r.capacity || '', r.fill === null ? '' : pct(r.fill), r.waiting, (r.estCents / 100).toFixed(2)])))}>
        {!rows.length ? <p className="muted">No events with registration yet.</p> :
          <Table head={['Event', 'Date', 'Registered', 'Capacity', 'Full', 'Waitlist', 'Est. income']} rows={rows.map((r) => [r.title, fmtDate(r.date), r.registered, r.capacity || 'No limit', r.fill === null ? '—' : pct(r.fill), r.waiting, fmtMoney(r.estCents)])} num={[2, 3, 4, 5, 6]} />}
      </Section>
    </div>
  );
}
