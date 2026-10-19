'use client';
/**
 * Elections › Nominations, ballot and results – the Election Commission's desk for one election year.
 * Tabs: Nominations (record, check against the member record, accept / decline / withdraw) → Ballot (seats from the
 * configuration, candidates per seat, uncontested and empty seats, freeze the voter list, set the ballot) → Results
 * (count per seat, ties and the tie-break rule) → Certify and swear in (winners become the serving officials, the
 * previous holders go to the history) → Rules (editable; ISGH's Bylaws values are the defaults).
 * Demo: the draft. Live: rules and seats are published with the document; nominations, the voter list, statuses, counts,
 * certification and swearing-in go through /admin/elections and /admin/voters (the server checks the facts).
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, SwitchRow, Tabs, countIssues } from '@/components/editor/bits';
import { StatTile } from '@/components/charts/Charts';
import { useAccess } from '@/lib/access/use-access';
import { OrgStructureSchema, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { OfficialsSchema, electionDay, mockOfficials, oathDay, seatLabel, type Officials, type Term } from '@/lib/community/officials';
import { ELECTION_STATUS, NOMINATION_STATUS, ballot, electionWarnings, fmt, holdersFromResults, impliedWinners, nominationIssues, nominationWindow, nominationsOpen, seatsOnBallot, tally, turnout, type CandidateFacts, type Election, type ElectionsDoc, type Nomination } from '@/lib/community/elections';
import { centerOf, eligibility, fullName, type Member, ORG_TZ } from '@/lib/members/members';
import { standingYears } from '@/lib/reports/reports';
import { useMembers } from './MembersView';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

/* ---------- live mode: what the election service records goes through its steps (the server checks the facts) ---------- */
type Step = [string, string, unknown];
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** The steps that make this change on the server; `counts` = only vote counts were typed (sent after a pause). */
export function liveElectionSteps(b: Election | undefined, a: Election): { steps: Step[]; countsOnly: boolean } {
  const y = a.year; const steps: Step[] = [];
  if (!b) return { steps: [['POST', 'admin/elections', { year: y }]], countsOnly: false };
  for (const n of a.nominations.filter((n) => !b.nominations.some((x) => x.id === n.id))) {
    steps.push(['POST', `admin/elections/${y}/nominations`, { seatKey: n.seatKey, memberId: n.memberId, name: n.name, nominatedBy: n.nominatedBy, secondedBy: n.secondedBy, note: n.note }]);
  }
  for (const n of a.nominations) { const o = b.nominations.find((x) => x.id === n.id); if (o && (o.status !== n.status || o.secondedBy !== n.secondedBy)) steps.push(['POST', `admin/elections/${y}/nominations/${encodeURIComponent(n.id)}`, { status: n.status, note: n.note || (n.status === 'ineligible' ? 'Does not meet the requirements.' : n.status === 'declined' ? 'Declined the nomination.' : ''), secondedBy: n.secondedBy }]); }
  if (a.voters.frozenOn && !b.voters.frozenOn) steps.push(['POST', `admin/voters/${y}/freeze`, {}]);
  let countsOnly = false;
  for (const r of a.results) {
    const o = b.results.find((x) => x.seatKey === r.seatKey);
    if (r.winners.length && !o?.winners.length) steps.push(['POST', `admin/elections/${y}/results/${encodeURIComponent(r.seatKey)}/accept`, { winners: r.winners }]);
    else if (!r.winners.length && (!o || !same({ ...o, winners: [] }, r))) { steps.push(['POST', `admin/elections/${y}/results`, { seatKey: r.seatKey, ballotsCast: r.ballotsCast, spoiled: r.spoiled, counts: r.counts, note: r.note }]); countsOnly = true; }
  }
  const auto = a.status === 'nominations' && b.status === 'planning' && a.nominations.length > b.nominations.length;   // the first nomination opens them
  if (a.status !== b.status && !auto && !(a.status === 'counting' && countsOnly) && a.status !== 'closed') steps.push(['POST', `admin/elections/${y}/status`, { to: a.status, early: true, note: a.certification?.note ?? '' }]);
  if (a.swornInOn && !b.swornInOn) steps.push(['POST', `admin/elections/${y}/swear-in`, {}]);
  return { steps, countsOnly: countsOnly && steps.every((s) => s[1].endsWith('/results')) };
}
let countTimer: ReturnType<typeof setTimeout> | null = null;
async function runElectionSteps(steps: Step[]) {
  for (const [m, p, body] of steps) { const r = await be(m, p, body); if (!r.ok) { notice(r.message); return false; } }
  return true;
}

type Doc = { draft: ElectionsDoc; setDraft: (f: ElectionsDoc | ((d: ElectionsDoc) => ElectionsDoc)) => void; issues: Record<string, string>; reload?: () => Promise<void> };
const todayCT = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
function useStore<T>(key: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => { void fetch(`/api/store/${key}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = schema.safeParse(j?.data); if (p.success) setV(p.data as T); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [v, setV];
}

export function ElectionsRunView() {
  return (
    <DocEditor<ElectionsDoc> storeKey="elections" title="Nominations, ballot and results" preview={false}
      intro="The Election Commission's desk: who is nominated for which seat, whether they qualify, the ballot, the count and the certified winners – who then become the serving officials. Seats come from Elected officials and Masjids and zones; every rule can be changed.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function Body({ doc }: { doc: Doc }) {
  const access = useAccess();
  const members = useMembers() ?? [];
  const [map] = useStore<OrgStructure>('org-structure', OrgStructureSchema, mockOrgStructure);
  const [officials, setOfficials] = useStore<Officials>('officials', OfficialsSchema, mockOfficials);
  const today = todayCT();
  const canRun = access.can('voters.freeze');
  const years = doc.draft.elections.map((e) => e.year).sort((a, b) => b - a);
  const [year, setYear] = useState<number>(years[0] ?? Number(today.slice(0, 4)));
  const i = doc.draft.elections.findIndex((e) => e.year === year);
  const e = doc.draft.elections[i];
  const localSet = (f: (x: Election) => void) => doc.setDraft((d) => { const c = structuredClone(d); f(c.elections[i]); return c; });
  /** Demo: change the draft. Live: recorded facts go through the election steps, then the document is read again. */
  const set = (f: (x: Election) => void) => {
    if (!LIVE || !e) return localSet(f);
    const after = structuredClone(e); f(after);
    const { steps, countsOnly } = liveElectionSteps(e, after);
    if (!steps.length) return localSet(f);                                    // rules, seats, notes: publish as usual
    if (countsOnly) { localSet(f); if (countTimer) clearTimeout(countTimer); countTimer = setTimeout(() => { void runElectionSteps(steps); }, 900); return; }
    void runElectionSteps(steps).then(() => doc.reload?.());
  };
  const votersByCenter = useMemo(() => { const o: Record<string, Record<string, number>> = {}; for (const m of members) { if (m.archived || !eligibility(m, year).eligible) continue; const c = centerOf(m); (o[c] ??= {})[m.zip] = (o[c][m.zip] ?? 0) + 1; } return o; }, [members, year]);
  const eligibleCount = useMemo(() => members.filter((m) => !m.archived && eligibility(m, year).eligible).length, [members, year]);
  const facts = (memberId: string): CandidateFacts | null => {
    const m = members.find((x) => x.id === memberId); if (!m) return null;
    const held = officials.holders.find((h) => h.status === 'serving' && h.memberId === memberId && h.kind !== 'secretary' && h.termEnd > oathDay(year));
    return { eligibleVoter: !m.archived && eligibility(m, year).eligible, standingYears: standingYears(m, year, Math.max(2000, m.joined)), zone: m.zone, center: centerOf(m), zip: m.zip, holdsOffice: held ? seatLabel(held, (z) => map.zones.find((x) => x.id === z)?.name ?? z) : undefined };
  };
  const start = () => {
    const y = Number(today.slice(0, 4)) + (electionDay(Number(today.slice(0, 4))) < today ? 1 : 0);
    const el: Election = { year: y, electionDay: electionDay(y), status: 'planning', rules: structuredClone(doc.draft.rules), seats: seatsOnBallot(y, map, votersByCenter), nominations: [], results: [], voters: { frozenOn: '', count: 0 }, certification: { by: '', on: '', note: '' }, swornInOn: '' };
    if (LIVE) { void runElectionSteps([['POST', 'admin/elections', { year: y }]]).then(() => doc.reload?.()).then(() => setYear(y)); return; }   // the server works out the seats
    doc.setDraft((d) => ({ ...d, elections: [...d.elections.filter((x) => x.year !== y), el] })); setYear(y);
  };
  if (!e) return (
    <Panel title="No election yet"><p className="muted">Start the next election: the seats on the ballot are read from Elected officials (which seats are chosen in which year) and Masjids and zones (Area Representative seats from the eligible voters per ZIP code).</p>{canRun && <button type="button" className="btn primary" onClick={start}>Start the {Number(today.slice(0, 4)) + (electionDay(Number(today.slice(0, 4))) < today ? 1 : 0)} election</button>}</Panel>
  );
  const warns = electionWarnings(e, today);
  const w = nominationWindow(e);
  return (
    <div className="ex">
      <div className="bn-bar ex-bar">
        <label className="sr-only" htmlFor="ex-year">Election year</label>
        <select id="ex-year" className="in pill-select" value={year} onChange={(ev) => setYear(Number(ev.target.value))}>{years.map((y) => <option key={y} value={y}>Election {y}</option>)}</select>
        <span className={`pill ${e.status === 'certified' ? 'good' : ''}`} data-status={e.status}>{ELECTION_STATUS[e.status]}</span>
        <span className="muted small">Election Day {fmt(e.electionDay)} · nominations {fmt(w.open)} – {fmt(w.close)} · oath {fmt(oathDay(e.year, officials.eidDates))}</span>
        {canRun && !years.includes(Number(today.slice(0, 4)) + 1) && e.status === 'certified' && <button type="button" className="btn sm" onClick={start}>Start the next election</button>}
      </div>
      <div className="zk-kpis">
        <StatTile id="ex-seats" label="Seats on the ballot" value={String(e.seats.filter((s) => !s.removed).length)} note={`${e.seats.filter((s) => !s.removed).reduce((a, s) => a + s.places, 0)} places`} />
        <StatTile id="ex-noms" label="Nominations" value={String(e.nominations.filter((n) => n.status !== 'withdrawn' && n.status !== 'declined').length)} note={`${e.nominations.filter((n) => n.status === 'accepted').length} accepted · ${e.nominations.filter((n) => n.status === 'nominated').length} to check`} />
        <StatTile id="ex-voters" label="Voter list" value={e.voters.frozenOn ? String(e.voters.count) : 'Open'} note={e.voters.frozenOn ? `frozen ${fmt(e.voters.frozenOn)}` : `${eligibleCount} eligible today`} />
        <StatTile id="ex-turnout" label="Turnout" value={e.results.length ? `${turnout(e).pct}%` : '—'} note={e.results.length ? `${turnout(e).cast} of ${turnout(e).voters}` : 'after the count'} />
      </div>
      {warns.length > 0 && <ul className="notice warn-note ex-warns" role="alert">{warns.map((x) => <li key={x}>{x}</li>)}</ul>}
      <Tabs label="Election" tabs={[
        { id: 'nominations', label: 'Nominations', badge: countIssues(doc.issues, [`elections.${i}.nominations`]) || e.nominations.filter((n) => n.status === 'nominated').length || undefined, render: () => <Nominations e={e} set={set} facts={facts} members={members} canRun={canRun} today={today} /> },
        { id: 'ballot', label: 'Ballot', render: () => <Ballot e={e} set={set} canRun={canRun} today={today} eligibleCount={eligibleCount} map={map} votersByCenter={votersByCenter} /> },
        { id: 'results', label: 'Results', badge: countIssues(doc.issues, [`elections.${i}.results`]), render: () => <Results e={e} set={set} canRun={canRun} /> },
        { id: 'certify', label: 'Certify and swear in', render: () => <Certify e={e} set={set} canRun={canRun && access.can('officials.manage')} today={today} officials={officials} onSworn={(o) => { setOfficials(o); if (LIVE) void doc.reload?.(); }} zoneName={(z) => map.zones.find((x) => x.id === z)?.name ?? z} /> },
        { id: 'rules', label: 'Rules', badge: countIssues(doc.issues, [`elections.${i}.rules`, 'rules']), render: () => <Rules e={e} set={set} doc={doc} /> },
      ]} />
    </div>
  );
}

/* ---------------- Nominations ---------------- */
function Nominations({ e, set, facts, members, canRun, today }: { e: Election; set: (f: (x: Election) => void) => void; facts: (id: string) => CandidateFacts | null; members: Member[]; canRun: boolean; today: string }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ seatKey: e.seats.find((s) => !s.removed)?.key ?? '', memberId: '', name: '', nominatedBy: '', secondedBy: '', note: '' });
  const m = f.memberId ? members.find((x) => x.id === f.memberId.toUpperCase()) : undefined;
  const preview = nominationIssues({ id: 'new', seatKey: f.seatKey, memberId: f.memberId.toUpperCase(), name: f.name || (m ? fullName(m) : ''), nominatedBy: f.nominatedBy, secondedBy: f.secondedBy }, e, f.memberId ? facts(f.memberId.toUpperCase()) : null);
  const open = nominationsOpen(e, today);
  const add = (ev: FormEvent) => {
    ev.preventDefault();
    const name = f.name.trim() || (m ? fullName(m) : ''); if (!name) return;
    const id = `n-${e.year}-${Date.now().toString(36)}`;
    set((x) => { x.nominations.push({ id, seatKey: f.seatKey, memberId: f.memberId.toUpperCase(), name, nominatedBy: f.nominatedBy.trim(), secondedBy: f.secondedBy.trim(), on: today, status: preview.length ? 'ineligible' : 'nominated', note: f.note.trim() }); if (x.status === 'planning') x.status = 'nominations'; });
    setAdding(false); setF({ ...f, memberId: '', name: '', note: '' });
  };
  const status = (id: string, st: Nomination['status']) => set((x) => { const n = x.nominations.find((q) => q.id === id); if (n) n.status = st; });
  const bySeat = e.seats.filter((s) => !s.removed).map((s) => ({ s, list: e.nominations.filter((n) => n.seatKey === s.key) }));
  return (
    <div className="ex-noms">
      <div className="row-between">
        <p className="muted">{open ? `Nominations are open until ${fmt(nominationWindow(e).close)}.` : today < nominationWindow(e).open ? `Nominations open ${fmt(nominationWindow(e).open)}.` : `Nominations closed ${fmt(nominationWindow(e).close)}.`} Each nomination is checked against the member record: eligible voter, years in good standing, residence, one office per person{e.rules.seconderRequired ? ', a seconder' : ''}.</p>
        {canRun && <button type="button" className="btn primary sm" onClick={() => setAdding(true)}>Record a nomination</button>}
      </div>
      {adding && (
        <form className="glass-pane ex-add" onSubmit={add} aria-label="New nomination">
          <div className="field-row three">
            <label className="sf-field"><span className="sf-label">Seat</span><select className="in" aria-label="Seat" value={f.seatKey} onChange={(ev) => setF({ ...f, seatKey: ev.target.value })}>{e.seats.filter((s) => !s.removed).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
            <label className="sf-field"><span className="sf-label">Member ID</span><input className="in" aria-label="Candidate member ID" placeholder="HOU-204781" value={f.memberId} onChange={(ev) => setF({ ...f, memberId: ev.target.value.trim().toUpperCase() })} /><small className="sf-hint">{m ? `${fullName(m)} · ${centerOf(m)} · ZIP ${m.zip}` : 'Links the member record for the checks.'}</small></label>
            <label className="sf-field"><span className="sf-label">Name</span><input className="in" aria-label="Candidate name" value={f.name} placeholder={m ? fullName(m) : ''} onChange={(ev) => setF({ ...f, name: ev.target.value })} /></label>
          </div>
          <div className="field-row three">
            <label className="sf-field"><span className="sf-label">Nominated by</span><input className="in" aria-label="Nominated by" value={f.nominatedBy} onChange={(ev) => setF({ ...f, nominatedBy: ev.target.value })} /></label>
            <label className="sf-field"><span className="sf-label">Seconded by{e.rules.seconderRequired ? '' : ' (optional)'}</span><input className="in" aria-label="Seconded by" value={f.secondedBy} onChange={(ev) => setF({ ...f, secondedBy: ev.target.value })} /></label>
            <label className="sf-field"><span className="sf-label">Note</span><input className="in" aria-label="Nomination note" value={f.note} onChange={(ev) => setF({ ...f, note: ev.target.value })} /></label>
          </div>
          {preview.length > 0 && (f.memberId || f.name) && <ul className="notice warn-note of-mine" role="alert">{preview.map((p) => <li key={p}>{p}</li>)}</ul>}
          <div className="row-actions"><button type="button" className="btn sm" onClick={() => setAdding(false)}>Cancel</button><button className="btn sm primary" disabled={!f.seatKey || (!f.name.trim() && !m)}>{preview.length ? 'Record as not eligible' : 'Record nomination'}</button></div>
        </form>
      )}
      {bySeat.map(({ s, list }) => (
        <section key={s.key} className="glass-pane zk-list ex-seat" aria-label={s.label} data-seat={s.key}>
          <h2>{s.label} <span className="pill">{list.filter((n) => n.status === 'accepted').length} accepted{s.places > 1 ? ` · ${s.places} places` : ''}</span></h2>
          {!list.length ? <p className="muted">No nominations yet.</p> : (
            <ul className="zk-rows">{list.map((n) => { const issues = nominationIssues(n, e, n.memberId ? facts(n.memberId) : null); return (
              <li key={n.id} className={`ex-nom st-${n.status}`} data-nomination={n.id}>
                <div><b>{n.name}</b>{n.memberId && <small> · {n.memberId}</small>}<small className="block ex-nom-meta">Nominated by {n.nominatedBy || '—'}{n.secondedBy ? `, seconded by ${n.secondedBy}` : e.rules.seconderRequired ? ' · no seconder yet' : ''} · {fmt(n.on)}{n.note ? ` · ${n.note}` : ''}</small>
                  {issues.length > 0 && n.status !== 'withdrawn' && n.status !== 'declined' && <ul className="ex-issues">{issues.map((x) => <li key={x}>{x}</li>)}</ul>}</div>
                <div className="row-actions"><span className={`pill ${n.status === 'accepted' ? 'good' : n.status === 'ineligible' ? 'warn' : ''}`}>{NOMINATION_STATUS[n.status]}</span>
                  {canRun && n.status !== 'accepted' && n.status !== 'withdrawn' && n.status !== 'declined' && <button type="button" className="btn sm" disabled={issues.length > 0} title={issues.length ? issues.join(' ') : undefined} onClick={() => status(n.id, 'accepted')}>Accept<span className="sr-only"> {n.name}</span></button>}
                  {canRun && n.status === 'nominated' && issues.length > 0 && <button type="button" className="btn sm ghost" onClick={() => status(n.id, 'ineligible')}>Mark not eligible<span className="sr-only"> {n.name}</span></button>}
                  {canRun && (n.status === 'nominated' || n.status === 'accepted') && <button type="button" className="btn sm ghost" onClick={() => status(n.id, 'declined')}>Declined<span className="sr-only"> {n.name}</span></button>}
                  {canRun && n.status === 'accepted' && <button type="button" className="btn sm ghost" onClick={() => status(n.id, 'withdrawn')}>Withdraw<span className="sr-only"> {n.name}</span></button>}
                  {canRun && (n.status === 'withdrawn' || n.status === 'declined' || n.status === 'ineligible') && <button type="button" className="btn sm ghost" onClick={() => status(n.id, 'nominated')}>Reopen<span className="sr-only"> {n.name}</span></button>}</div>
              </li>
            ); })}</ul>
          )}
        </section>
      ))}
    </div>
  );
}

/* ---------------- Ballot ---------------- */
function Ballot({ e, set, canRun, today, eligibleCount, map, votersByCenter }: { e: Election; set: (f: (x: Election) => void) => void; canRun: boolean; today: string; eligibleCount: number; map: OrgStructure; votersByCenter: Record<string, Record<string, number>> }) {
  const b = ballot(e);
  const locked = ['ballot', 'voting', 'counting', 'certified', 'closed'].includes(e.status);
  return (
    <div className="ex-ballot">
      <div className="row-between">
        <p className="muted">{e.seats.filter((s) => !s.removed).length} seats · {b.filter((x) => x.uncontested).length} uncontested · {b.filter((x) => x.empty).length} without a candidate. Voting: {e.rules.method === 'both' ? 'in person and online' : e.rules.method}{e.rules.secretBallot ? ', secret ballot' : ''}.</p>
        <span className="row-actions">
          {canRun && !locked && <button type="button" className="btn sm" onClick={() => set((x) => { const fresh = seatsOnBallot(x.year, map, votersByCenter); const removed = new Set(x.seats.filter((s) => s.removed).map((s) => s.key)); x.seats = fresh.map((s) => ({ ...s, removed: removed.has(s.key) })); })}>Refresh seats from the configuration</button>}
          {canRun && !e.voters.frozenOn && <button type="button" className="btn sm" onClick={() => set((x) => { x.voters = { frozenOn: today, count: eligibleCount }; })}>Freeze the voter list ({eligibleCount})</button>}
          {canRun && !locked && <button type="button" className="btn sm primary" disabled={b.some((x) => x.empty)} title={b.some((x) => x.empty) ? 'Every seat needs an accepted candidate (or take the seat off the ballot).' : undefined} onClick={() => set((x) => { x.status = 'ballot'; })}>Set the ballot</button>}
          {canRun && e.status === 'ballot' && <button type="button" className="btn sm primary" onClick={() => set((x) => { x.status = 'voting'; })}>Open voting</button>}
          {canRun && e.status === 'voting' && <button type="button" className="btn sm primary" onClick={() => set((x) => { x.status = 'counting'; })}>Close voting – count</button>}
        </span>
      </div>
      <div className="table-wrap"><table className="t-plain zk-table ex-table">
        <thead><tr><th>Seat</th><th>Who votes</th><th className="num">Places</th><th>Candidates</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{e.seats.map((s) => { const row = b.find((x) => x.seat.key === s.key); return (
          <tr key={s.key} className={s.removed ? 'off' : row?.empty ? 'ex-empty' : ''} data-ballot-seat={s.key}>
            <td>{s.label}{s.removed && <span className="pill"> Off the ballot</span>}</td>
            <td>{s.voters === 'all' ? 'All voting members' : s.voters === 'zone' ? 'Voters of the zone' : s.voters === 'center' ? 'Members of the center' : `Voters in ZIP ${s.zips.join(', ')}`}</td>
            <td className="num">{s.places}</td>
            <td>{row && !s.removed ? (row.candidates.length ? row.candidates.map((c) => c.name).join(', ') + (row.uncontested ? ' (uncontested)' : '') : <span className="zn-missing">No candidate</span>) : '—'}</td>
            <td className="num">{canRun && !locked && <button type="button" className="btn sm ghost" onClick={() => set((x) => { const q = x.seats.find((y) => y.key === s.key); if (q) q.removed = !q.removed; })}>{s.removed ? 'Put back' : 'Take off'}<span className="sr-only"> {s.label}</span></button>}</td>
          </tr>
        ); })}</tbody>
      </table></div>
    </div>
  );
}

/* ---------------- Results ---------------- */
function Results({ e, set, canRun }: { e: Election; set: (f: (x: Election) => void) => void; canRun: boolean }) {
  const canCount = ['counting', 'certified', 'closed'].includes(e.status) || e.results.length > 0;
  if (!canCount) return <p className="notice">Counting starts when voting is closed (Ballot tab).</p>;
  const upCount = (seatKey: string, patch: { nominationId?: string; votes?: number; ballotsCast?: number; spoiled?: number }) => set((x) => {
    let r = x.results.find((q) => q.seatKey === seatKey); if (!r) { r = { seatKey, ballotsCast: 0, spoiled: 0, counts: [], winners: [], note: '' }; x.results.push(r); }
    if (patch.nominationId !== undefined) { const c = r.counts.find((q) => q.nominationId === patch.nominationId); if (c) c.votes = patch.votes ?? 0; else r.counts.push({ nominationId: patch.nominationId, votes: patch.votes ?? 0 }); }
    if (patch.ballotsCast !== undefined) r.ballotsCast = patch.ballotsCast; if (patch.spoiled !== undefined) r.spoiled = patch.spoiled;
    r.winners = [];
  });
  return (
    <div className="ex-results">
      {e.seats.filter((s) => !s.removed).map((s) => { const t = tally(e, s.key)!; const r = e.results.find((q) => q.seatKey === s.key); return (
        <section key={s.key} className={`glass-pane zk-list ex-count${t.decided ? ' decided' : ''}`} aria-label={s.label} data-count={s.key}>
          <h2>{s.label} {t.decided ? <span className="pill good">Counted</span> : t.tie ? <span className="pill warn">Tie</span> : null}</h2>
          <div className="field-row three ex-cast">
            <label className="sf-field"><span className="sf-label">Ballots cast</span><input className="in in-num" type="number" min={0} aria-label={`Ballots cast ${s.label}`} value={r?.ballotsCast ?? 0} disabled={!canRun || t.decided} onChange={(ev) => upCount(s.key, { ballotsCast: Number(ev.target.value || 0) })} /></label>
            <label className="sf-field"><span className="sf-label">Spoiled</span><input className="in in-num" type="number" min={0} aria-label={`Spoiled ballots ${s.label}`} value={r?.spoiled ?? 0} disabled={!canRun || t.decided} onChange={(ev) => upCount(s.key, { spoiled: Number(ev.target.value || 0) })} /></label>
          </div>
          <div className="table-wrap"><table className="t-plain zk-table ex-table"><thead><tr><th>Candidate</th><th className="num">Votes</th><th className="num">Share</th><th></th></tr></thead>
            <tbody>{t.rows.map((row) => (
              <tr key={row.nomination.id} className={row.winner ? 'ex-winner' : ''}>
                <td>{row.nomination.name}</td>
                <td className="num"><input className="in in-num" type="number" min={0} aria-label={`Votes for ${row.nomination.name}`} value={row.votes} disabled={!canRun || t.decided} onChange={(ev) => upCount(s.key, { nominationId: row.nomination.id, votes: Number(ev.target.value || 0) })} /></td>
                <td className="num">{Math.round(row.share * 100)}%</td>
                <td>{row.winner ? <span className="pill good">{s.places > 1 ? 'Elected' : 'Winner'}</span> : ''}</td>
              </tr>
            ))}</tbody></table></div>
          {t.tie && <p className="notice warn-note">Tie for the last place. Rule: {e.rules.tieBreak === 'runoff' ? 'a run-off between the tied candidates' : e.rules.tieBreak === 'drawing' ? 'decided by drawing lots' : 'the Election Commission decides'}. Enter the outcome below, then accept the count.</p>}
          {t.tie && canRun && !t.decided && <div className="row-actions">{t.rows.filter((x) => x.votes > 0).map((x) => <button key={x.nomination.id} type="button" className="btn sm" onClick={() => set((q) => { const rr = q.results.find((y) => y.seatKey === s.key)!; rr.winners = [...t.rows.filter((z) => z.winner && z.nomination.id !== x.nomination.id).map((z) => z.nomination.id), x.nomination.id].slice(0, s.places); rr.note = `Tie resolved (${e.rules.tieBreak}) for ${x.nomination.name}.`; })}>Tie-break: {x.nomination.name}</button>)}</div>}
          {canRun && !t.decided && !t.tie && r && impliedWinners(t).length > 0 && <div className="row-actions"><button type="button" className="btn sm primary" onClick={() => set((q) => { const rr = q.results.find((y) => y.seatKey === s.key)!; rr.winners = impliedWinners(t); })}>Accept the count<span className="sr-only"> {s.label}</span></button></div>}
          {canRun && t.decided && e.status !== 'certified' && <div className="row-actions"><button type="button" className="btn sm ghost" onClick={() => set((q) => { const rr = q.results.find((y) => y.seatKey === s.key); if (rr) rr.winners = []; })}>Reopen the count</button></div>}
          {r?.note && <p className="muted small">{r.note}</p>}
        </section>
      ); })}
    </div>
  );
}

/* ---------------- Certify and swear in ---------------- */
function Certify({ e, set, canRun, today, officials, onSworn, zoneName }: { e: Election; set: (f: (x: Election) => void) => void; canRun: boolean; today: string; officials: Officials; onSworn: (o: Officials) => void; zoneName: (z: string) => string }) {
  const [by, setBy] = useState(e.rules.certifiedBy);
  const [msg, setMsg] = useState('');
  const seats = e.seats.filter((s) => !s.removed);
  const allCounted = seats.every((s) => (e.results.find((r) => r.seatKey === s.key)?.winners.length ?? 0) > 0);
  const winners = holdersFromResults(e, officials.eidDates);
  const swear = async () => {
    if (LIVE) {   // the server swears them in: the officials document and the history change together
      const r = await be<{ swornIn: unknown[] }>('POST', `admin/elections/${e.year}/swear-in`, {});
      if (!r.ok) { setMsg(r.message); return; }
      setMsg(`${r.data.swornIn.length} official${r.data.swornIn.length === 1 ? '' : 's'} sworn in.`); onSworn(officials); return;   // the page reads both documents again
    }
    const start = oathDay(e.year, officials.eidDates);
    const next = structuredClone(officials);
    const archived: Term[] = [];
    for (const h of winners) {
      next.holders.filter((x) => x.status === 'serving' && x.kind === h.kind && x.office === h.office && x.zone === h.zone && x.center === h.center && (h.kind !== 'area-rep' || (x.atLarge === h.atLarge && x.zips.join() === h.zips.join()))).forEach((x) => {
        x.status = 'ended';
        if (x.name) archived.push({ id: `a-${x.id}-${start.replace(/-/g, '')}`.slice(0, 60), year: x.termStart ? Number(x.termStart.slice(0, 4)) - 1 : e.year - 2, kind: x.kind, office: x.office, zone: x.zone, center: x.center, zips: x.zips, atLarge: x.atLarge, title: seatLabel(x, zoneName).split(', ')[0], name: x.name, memberId: x.memberId, how: x.how, termStart: x.termStart, termEnd: x.termEnd || start, endReason: 'completed', notes: `Succeeded after the ${e.year} election.`, source: 'archived', showOnWebsite: x.showOnWebsite });
      });
      next.holders.push(h);
    }
    next.history = [...next.history, ...archived];
    const r = await fetch('/api/store/officials', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: next, note: `Sworn in after the ${e.year} election` }) }).catch(() => null);
    if (!r || !r.ok) { setMsg('Could not save the officials document – check your access.'); return; }
    onSworn(next); set((x) => { x.swornInOn = today; x.status = 'closed'; }); setMsg(`${winners.length} official${winners.length === 1 ? '' : 's'} sworn in; ${archived.length} previous term${archived.length === 1 ? '' : 's'} moved to the history.`);
  };
  return (
    <div className="ex-certify">
      <Panel title="Certify the results" intro={allCounted ? 'Every seat is counted. Certifying freezes the results; the winners are then sworn in on the oath day.' : `${seats.filter((s) => !(e.results.find((r) => r.seatKey === s.key)?.winners.length)).length} seat(s) still without an accepted count.`}>
        <ul className="ex-winners">{seats.map((s) => { const t = tally(e, s.key)!; const names = t.rows.filter((x) => x.winner).map((x) => x.nomination.name); return <li key={s.key} data-winner-seat={s.key}><b>{s.label}</b><span>{names.length ? names.join(', ') : '—'}</span></li>; })}</ul>
        {e.certification.on ? <p className="notice ok">Certified by {e.certification.by} on {fmt(e.certification.on)}.</p> : (
          canRun && <div className="field-row"><label className="sf-field narrow"><span className="sf-label">Certified by</span><input className="in" aria-label="Certified by" value={by} onChange={(ev) => setBy(ev.target.value)} /></label>
            <button type="button" className="btn primary" disabled={!allCounted || !by.trim()} onClick={() => set((x) => { x.certification = { by: by.trim(), on: today, note: '' }; x.status = 'certified'; })}>Certify the results</button></div>
        )}
      </Panel>
      <Panel title="Swear in the winners" intro={`Oath day ${fmt(oathDay(e.year, officials.eidDates))}. The winners become the serving holders in Elected officials with their term dates; the officials they replace go into the history with the end date.`}>
        {e.swornInOn ? <p className="notice ok">Sworn in {fmt(e.swornInOn)}.</p> : canRun ? <button type="button" className="btn primary" disabled={e.status !== 'certified' || !winners.length} onClick={() => void swear()}>Swear in {winners.length} winner{winners.length === 1 ? '' : 's'}</button> : <p className="muted">Needs the officials.manage permission.</p>}
        {msg && <p className="muted" role="status">{msg}</p>}
      </Panel>
    </div>
  );
}

/* ---------------- Rules ---------------- */
function Rules({ e, set, doc }: { e: Election; set: (f: (x: Election) => void) => void; doc: Doc }) {
  const r = e.rules;
  const i = doc.draft.elections.findIndex((x) => x.year === e.year);
  const err = (k: string) => doc.issues[`elections.${i}.rules.${k}`];
  const Num = ({ k, label, hint }: { k: keyof typeof r; label: string; hint?: string }) => <label className="sf-field"><span className="sf-label">{label}</span><input className="in in-num" type="number" aria-label={label} value={Number(r[k])} onChange={(ev) => set((x) => { (x.rules as unknown as Record<string, number>)[k] = Number(ev.target.value || 0); })} />{hint && <small className="sf-hint">{hint}</small>}{err(k) && <small className="sf-err">{err(k)}</small>}</label>;
  return (
    <div className="cv">
      <Panel title="Nominations" intro="ISGH's Bylaws values are the defaults; another organization changes them here. Changes apply to this election.">
        <div className="field-row three"><Num k="nominationsOpenDaysBefore" label="Open (days before Election Day)" /><Num k="nominationsCloseDaysBefore" label="Close (days before Election Day)" /><Num k="boardStandingYears" label="Years in good standing – Board seats" /></div>
        <div className="field-row three"><Num k="officerStandingYears" label="Years in good standing – President and Vice President" /></div>
        <SwitchRow id="ex-sec" label="A seconder is required" checked={r.seconderRequired} onChange={(v) => set((x) => { x.rules.seconderRequired = v; })} />
        <SwitchRow id="ex-self" label="Members may nominate themselves" checked={r.selfNominationAllowed} onChange={(v) => set((x) => { x.rules.selfNominationAllowed = v; })} />
        <SwitchRow id="ex-one" label="One elected seat per person" checked={r.oneSeatPerPerson} onChange={(v) => set((x) => { x.rules.oneSeatPerPerson = v; })} />
        <SwitchRow id="ex-res" label="Candidates must live in the zone / center / ZIP of the seat" checked={r.residencyRequired} onChange={(v) => set((x) => { x.rules.residencyRequired = v; })} />
      </Panel>
      <Panel title="Voting and counting">
        <div className="field-row three">
          <label className="sf-field"><span className="sf-label">Voting method</span><select className="in" aria-label="Voting method" value={r.method} onChange={(ev) => set((x) => { x.rules.method = ev.target.value as typeof r.method; })}><option value="in-person">In person (paper ballot)</option><option value="online">Online</option><option value="both">In person and online</option></select></label>
          <label className="sf-field"><span className="sf-label">Tie-break</span><select className="in" aria-label="Tie-break" value={r.tieBreak} onChange={(ev) => set((x) => { x.rules.tieBreak = ev.target.value as typeof r.tieBreak; })}><option value="runoff">Run-off between the tied candidates</option><option value="drawing">Drawing lots</option><option value="commission">The Election Commission decides</option></select></label>
          <label className="sf-field"><span className="sf-label">Results certified by</span><input className="in" aria-label="Results certified by" value={r.certifiedBy} onChange={(ev) => set((x) => { x.rules.certifiedBy = ev.target.value; })} /></label>
        </div>
        <SwitchRow id="ex-secret" label="Secret ballot" checked={r.secretBallot} onChange={(v) => set((x) => { x.rules.secretBallot = v; })} />
        <p className="muted small">Online voting needs identity-verified members and one vote per member – planned as its own phase (the method here only records how this election is run).</p>
      </Panel>
      <Panel title="Defaults for the next elections"><p className="muted small">New elections start from the rules saved here: <button type="button" className="linkish" onClick={() => doc.setDraft((d) => ({ ...d, rules: structuredClone(e.rules) }))}>use this election’s rules as the defaults</button>.</p></Panel>
    </div>
  );
}
