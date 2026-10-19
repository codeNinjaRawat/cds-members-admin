'use client';
/**
 * F6 Meetings and minutes. Meetings (record, attendance, quorum, decisions, approve and publish) → Calendar check
 * (the meetings the Bylaws require: Council monthly, Board monthly, Executive Body with Associate Directors quarterly,
 * Joint meetings in March and September, General Assembly in September). Council minutes: center-limited admins with
 * "Prayer times and meeting minutes"; Board, Joint and General Assembly minutes: admins with "Manage settings".
 * Records are saved as they are written (not published as a document). DEMO: this browser only.
 */
import { ORG_TZ } from '@/lib/members/members';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Tabs } from '@/components/editor/bits';
import {
  AUDIENCE, BODIES, MEETING_KINDS, calendarWarnings, decisionResult, fmt, meetingTitle, nextMeetingId, noticeHours, noticeProblem, quorumMet, quorumNeeded,
  type Body, type Meeting,
} from '@/lib/community/minutes';
import { OfficialsSchema, mockOfficials, SECRETARIES, type Officials } from '@/lib/community/officials';
import { OrgStructureSchema, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { useAccess } from '@/lib/access/use-access';
import { saveMeeting, useMeetings } from '@/lib/minutes/use-meetings';

const todayCT = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS = { draft: 'Draft', approved: 'Approved', published: 'Published' } as const;

function useStore<T>(key: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, fallback: T) {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => { void fetch(`/api/store/${key}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = schema.safeParse(j?.data); if (p.success) setV(p.data as T); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export function MinutesView() {
  const access = useAccess();
  const all = useMeetings();
  const map = useStore<OrgStructure>('org-structure', OrgStructureSchema, mockOrgStructure);
  const officials = useStore<Officials>('officials', OfficialsSchema, mockOfficials);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Meeting | null>(null);
  const zoneOf = (c: string) => map.centers.find((x) => x.name === c)?.zone ?? '';
  const visible = all.filter((m) => m.body !== 'council' || access.inScope(zoneOf(m.center), m.center));
  const myCenters = map.centers.filter((c) => c.active && access.inScope(c.zone, c.name)).map((c) => c.name);
  const canEdit = (m: Pick<Meeting, 'body' | 'center'>) => (m.body === 'council' ? access.can('center.content') && myCenters.includes(m.center) : access.can('settings.manage'));
  const current = draft && draft.id === open ? draft : visible.find((m) => m.id === open) ?? null;
  const startNew = () => {
    const center = myCenters[0] ?? '';
    const m: Meeting = { id: nextMeetingId(all, Number(todayCT().slice(0, 4))), body: access.can('settings.manage') && !access.role?.centerScoped ? 'board' : 'council', center, zone: '', kind: 'regular', date: todayCT(), start: '19:30', place: '', remote: false, noticeSentAt: '', calledBy: '', seats: 9, present: 0, attendees: [], agenda: [], decisions: [], notes: '', actions: [], status: 'draft', approvedOn: '', audience: 'leaders', recordedBy: access.me?.name ?? '' };
    setDraft(withRoster(m, officials)); setOpen(m.id);
  };
  return (
    <div className={`page mn${current ? ' has-peek' : ''}`}>
      <header className="page-head">
        <div><h1>Meetings and minutes</h1><p className="page-intro">Every meeting the Bylaws call for – notice, attendance, quorum, decisions and the minutes – and a check that the required meetings happen. {access.role?.centerScoped ? `Council meetings of ${access.me?.centers.join(', ')}.` : ''} Demo records, saved in this browser.</p></div>
        <div className="page-actions">{(access.can('center.content') || access.can('settings.manage')) && <button type="button" className="btn primary" onClick={startNew}>Record a meeting</button>}</div>
      </header>
      <Tabs label="Meetings and minutes" tabs={[
        { id: 'meetings', label: 'Meetings', render: () => <List list={visible} onOpen={(id) => { setDraft(null); setOpen(id); }} /> },
        { id: 'calendar', label: 'Calendar check', render: () => <Calendar list={visible} centers={myCenters} onOpen={(id) => { setDraft(null); setOpen(id); }} showOrg={!access.role?.centerScoped} /> },
      ]} />
      {current && <MeetingPanel key={current.id} m={current} isNew={!all.some((x) => x.id === current.id)} canEdit={canEdit(current)} centers={myCenters} officials={officials} onClose={() => { setOpen(null); setDraft(null); }} />}
    </div>
  );
}

/** Fill seats and attendance from Elected officials (Council: Associate Director + Area Representatives; Secretaries attend). */
function withRoster(m: Meeting, o: Officials): Meeting {
  const serving = o.holders.filter((h) => h.status === 'serving' && h.name);
  if (m.body === 'council') {
    const voters = serving.filter((h) => h.center === m.center && (h.kind === 'associate-director' || h.kind === 'area-rep'));
    const secs = serving.filter((h) => h.center === m.center && h.kind === 'secretary');
    return { ...m, seats: Math.max(1, voters.length), present: 0, attendees: [...voters.map((h) => ({ name: h.name, role: h.kind === 'associate-director' ? 'Associate Director' : 'Area Representative', present: false, remote: false })), ...secs.map((h) => ({ name: h.name, role: SECRETARIES[h.office as keyof typeof SECRETARIES], present: false, remote: false }))], calledBy: voters.find((h) => h.kind === 'associate-director')?.name ?? '' };
  }
  if (m.body === 'board') return { ...m, seats: 9, attendees: serving.filter((h) => h.kind === 'officer' || h.kind === 'zonal-director').map((h) => ({ name: h.name, role: h.kind === 'officer' ? 'Officer' : 'Zonal Director', present: false, remote: false })), present: 0 };
  return { ...m, attendees: [] };
}
const VOTING_ROLES = ['Associate Director', 'Area Representative', 'Officer', 'Zonal Director'];

/* ---------------- list ---------------- */
function List({ list, onOpen }: { list: Meeting[]; onOpen: (id: string) => void }) {
  const [body, setBody] = useState(''); const [center, setCenter] = useState(''); const [status, setStatus] = useState('');
  const rows = list.filter((m) => (!body || m.body === body) && (!center || m.center === center) && (!status || m.status === status)).sort((a, b) => b.date.localeCompare(a.date));
  const centers = Array.from(new Set(list.filter((m) => m.center).map((m) => m.center))).sort();
  return (
    <section className="glass-pane zk-list" aria-label="Meetings">
      <div className="bn-bar"><h2>Meetings <span className="pill">{rows.length}</span></h2>
        <select className="in pill-select" aria-label="Body" value={body} onChange={(e) => setBody(e.target.value)}><option value="">Every body</option>{Object.entries(BODIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="in pill-select" aria-label="Center" value={center} onChange={(e) => setCenter(e.target.value)}><option value="">Every center</option>{centers.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="in pill-select" aria-label="Minutes status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Every status</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <ul className="zk-rows">{rows.map((m) => {
        const q = quorumMet(m); const np = noticeProblem(m);
        return (
          <li key={m.id}><button type="button" className="zk-row mn-row" data-meeting={m.id} onClick={() => onOpen(m.id)}>
            <span className="zk-row-main"><b>{meetingTitle(m)}</b><small>{fmt(m.date)} · {m.place || (m.remote ? 'Remote' : '—')} · {m.decisions.length} decision{m.decisions.length === 1 ? '' : 's'}</small></span>
            <span className="zk-row-tags"><span className={`pill ${q ? 'good' : 'bad'}`}>{q ? 'Quorum' : 'No quorum'}</span>{np && <span className="pill bad">Notice</span>}{m.remote && <span className="pill">Remote</span>}</span>
            <span className="zk-row-tags"><span className={`pill ${m.status === 'published' ? 'good' : m.status === 'draft' ? 'warn' : ''}`}>{STATUS[m.status]}</span><small>{AUDIENCE[m.audience]}</small></span>
            <span className="zk-row-act">Open ›</span>
          </button></li>
        );
      })}</ul>
      {!rows.length && <p className="muted">No meetings match.</p>}
    </section>
  );
}

/* ---------------- calendar ---------------- */
function Calendar({ list, centers, onOpen, showOrg }: { list: Meeting[]; centers: string[]; onOpen: (id: string) => void; showOrg: boolean }) {
  const t = todayCT(); const y = Number(t.slice(0, 4));
  const warns = calendarWarnings(list, centers, y, t).filter((w) => showOrg || w.center || (w.meeting && list.find((m) => m.id === w.meeting)?.body === 'council'));
  const cell = (pred: (m: Meeting) => boolean, mo: number) => {
    const key = `${y}-${String(mo + 1).padStart(2, '0')}`; const ended = key < t.slice(0, 7);
    const found = list.filter((m) => pred(m) && m.date.startsWith(key));
    return <td key={mo} className={`mn-cell ${found.length ? 'ok' : ended ? 'miss' : 'later'}`}>{found.length ? <button type="button" className="mn-dot" onClick={() => onOpen(found[0].id)} aria-label={`${MONTHS[mo]}: ${found.length} meeting${found.length > 1 ? 's' : ''}`}>{found.length > 1 ? found.length : '✓'}</button> : ended ? <span aria-label={`${MONTHS[mo]}: missing`}>✕</span> : ''}</td>;
  };
  return (
    <div className="mn-cal">
      <section className="glass-pane zk-list" aria-label="Required meetings">
        <h2>Required meetings in {y}</h2>
        <p className="muted">✓ held · ✕ missed (month ended) · empty = still to come. Council and Board: at least monthly. Executive Body with Associate Directors: Jan, Mar, Jun, Sep. Joint meetings: March and September. General Assembly: September.</p>
        <div className="table-wrap"><table className="t-plain zk-table mn-grid">
          <thead><tr><th>Meeting</th>{MONTHS.map((m) => <th key={m}>{m}</th>)}</tr></thead>
          <tbody>
            {showOrg && <tr data-row="board"><td>Board</td>{MONTHS.map((_, i) => cell((m) => m.body === 'board', i))}</tr>}
            {showOrg && <tr data-row="exec-ad"><td>Executive Body + ADs</td>{MONTHS.map((_, i) => ([0, 2, 5, 8].includes(i) ? cell((m) => m.body === 'exec-ad', i) : <td key={i} className="mn-cell na" />))}</tr>}
            {showOrg && <tr data-row="joint"><td>Joint Board and Councils</td>{MONTHS.map((_, i) => ([2, 8].includes(i) ? cell((m) => m.body === 'joint', i) : <td key={i} className="mn-cell na" />))}</tr>}
            {showOrg && <tr data-row="ga"><td>General Assembly</td>{MONTHS.map((_, i) => (i === 8 ? cell((m) => m.body === 'general-assembly', i) : <td key={i} className="mn-cell na" />))}</tr>}
            {centers.map((c) => <tr key={c} data-row={c}><td>{c.replace(' Islamic Center', '')} Council</td>{MONTHS.map((_, i) => cell((m) => m.body === 'council' && m.center === c, i))}</tr>)}
          </tbody>
        </table></div>
      </section>
      <section className="glass-pane zk-list of-warns" aria-label="To fix">
        <h2>To fix <span className="pill">{warns.length}</span></h2>
        <ul>{warns.map((w, i) => <li key={i} className={w.level}>{w.meeting ? <button type="button" className="linkish" onClick={() => onOpen(w.meeting!)}>{w.text}</button> : w.text}</li>)}</ul>
        {!warns.length && <p className="muted">Everything required so far has been held.</p>}
      </section>
    </div>
  );
}

/* ---------------- one meeting ---------------- */
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return <label className="sf-field"><span className="sf-label">{label}</span>{children}{hint && <small className="sf-hint">{hint}</small>}</label>;
}
function MeetingPanel({ m: init, isNew, canEdit, centers, officials, onClose }: { m: Meeting; isNew: boolean; canEdit: boolean; centers: string[]; officials: Officials; onClose: () => void }) {
  const [m, setM] = useState<Meeting>(init);
  const [errs, setErrs] = useState<string[]>([]);
  const [saved, setSaved] = useState('');
  const up = (p: Partial<Meeting>) => { setM((x) => ({ ...x, ...p })); setSaved(''); };
  const present = useMemo(() => (m.attendees.length ? m.attendees.filter((a) => a.present && VOTING_ROLES.includes(a.role)).length : m.present), [m.attendees, m.present]);
  const mm = { ...m, present };
  const save = (patch: Partial<Meeting> = {}, action = isNew ? 'Meeting recorded' : 'Minutes updated') => { const next = { ...mm, ...patch }; const e = saveMeeting(next, action); setErrs(e); if (!e.length) { setM(next); setSaved(action); } };
  const np = noticeProblem(mm);
  const need = noticeHours(mm);
  return (
    <aside className="m-peek zk-case mn-peek glass-float" aria-label={meetingTitle(m)} data-open-meeting={m.id}>
      <div className="m-peek-top"><span className="m-peek-pos">{m.id}</span><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /></svg></button></div>
      <div><h2 className="zk-case-h">{meetingTitle(m)}</h2>
        <p className="m-peek-status"><span className={`pill ${quorumMet(mm) ? 'good' : 'bad'}`}>{quorumMet(mm) ? 'Quorum' : 'No quorum'} · {present} of {quorumNeeded(mm)} needed</span><span className={`pill ${m.status === 'published' ? 'good' : m.status === 'draft' ? 'warn' : ''}`}>{STATUS[m.status]}</span></p></div>
      {np && <p className="notice warn-note" role="alert">{np}</p>}
      <fieldset className="m-form bn-form of-peek" disabled={!canEdit}>
        <div className="field-row">
          <Field label="Meeting of"><select className="in" aria-label="Meeting of" value={m.body} onChange={(e) => setM((x) => withRoster({ ...x, body: e.target.value as Body }, officials))}>{Object.entries(BODIES).filter(([k]) => k === 'council' || !centers.length || canEdit).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Kind"><select className="in" aria-label="Kind of meeting" value={m.kind} onChange={(e) => up({ kind: e.target.value as Meeting['kind'] })}>{Object.entries(MEETING_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        {m.body === 'council' && <Field label="Islamic Center"><select className="in" aria-label="Islamic Center" value={m.center} onChange={(e) => setM((x) => withRoster({ ...x, center: e.target.value }, officials))}>{!centers.includes(m.center) && <option value={m.center}>{m.center || 'Choose…'}</option>}{centers.map((c) => <option key={c}>{c}</option>)}</select></Field>}
        <div className="field-row">
          <Field label="Date"><input className="in" type="date" aria-label="Meeting date" value={m.date} onChange={(e) => up({ date: e.target.value })} /></Field>
          <Field label="Starts"><input className="in" type="time" aria-label="Start time" value={m.start} onChange={(e) => up({ start: e.target.value })} /></Field>
        </div>
        <Field label="Place"><input className="in" aria-label="Place" value={m.place} onChange={(e) => up({ place: e.target.value })} /></Field>
        <label className="check"><input type="checkbox" checked={m.remote} onChange={(e) => up({ remote: e.target.checked })} /> <span>Held remotely (video or phone){m.remote && m.kind !== 'special' ? ' – the Bylaws allow this for special (urgent) meetings' : ''}</span></label>
        {need > 0 && <Field label="Notice sent" hint={`${need >= 48 ? `${need / 24} days` : `${need} hours`} before the meeting at the latest.`}><input className="in" type="datetime-local" aria-label="Notice sent" value={m.noticeSentAt} onChange={(e) => up({ noticeSentAt: e.target.value })} /></Field>}
        <div className="field-row">
          <Field label="Called by"><input className="in" aria-label="Called by" value={m.calledBy} onChange={(e) => up({ calledBy: e.target.value })} /></Field>
          <Field label={m.body === 'general-assembly' ? 'Eligible voting members' : 'Voting seats'}><input className="in in-num" type="number" min="1" aria-label="Voting seats" value={m.seats} onChange={(e) => up({ seats: Number(e.target.value || 1) })} /></Field>
          {!m.attendees.length && <Field label="Present (voting)"><input className="in in-num" type="number" min="0" aria-label="Present" value={m.present} onChange={(e) => up({ present: Number(e.target.value || 0) })} /></Field>}
        </div>
        {m.attendees.length > 0 && <fieldset className="mn-att"><legend className="sf-label">Attendance</legend>
          {m.attendees.map((a, i) => <label key={i} className="check"><input type="checkbox" aria-label={`Present: ${a.name}`} checked={a.present} onChange={(e) => up({ attendees: m.attendees.map((x, j) => (j === i ? { ...x, present: e.target.checked } : x)) })} /> <span>{a.name} <small>{a.role}{VOTING_ROLES.includes(a.role) ? '' : ' · no vote'}</small></span></label>)}
        </fieldset>}
        <Field label="Agenda (one item per line)"><textarea className="in" rows={3} aria-label="Agenda" value={m.agenda.join('\n')} onChange={(e) => up({ agenda: e.target.value.split('\n') })} /></Field>
        <div className="mn-dec"><span className="sf-label">Decisions</span>
          {m.decisions.map((d, i) => { const r = decisionResult(mm, d); const ud = (p: Partial<typeof d>) => up({ decisions: m.decisions.map((x, j) => (j === i ? { ...x, ...p } : x)) }); return (
            <div key={i} className="mn-dec-row" data-decision={i}>
              <textarea className="in" rows={2} aria-label={`Decision ${i + 1}`} value={d.text} onChange={(e) => ud({ text: e.target.value })} />
              <div className="mn-votes">
                <label>For <input className="in in-num" type="number" min="0" aria-label={`Decision ${i + 1} for`} value={d.votesFor} onChange={(e) => ud({ votesFor: Number(e.target.value || 0) })} /></label>
                <label>Against <input className="in in-num" type="number" min="0" aria-label={`Decision ${i + 1} against`} value={d.against} onChange={(e) => ud({ against: Number(e.target.value || 0) })} /></label>
                <label>Abstain <input className="in in-num" type="number" min="0" aria-label={`Decision ${i + 1} abstain`} value={d.abstain} onChange={(e) => ud({ abstain: Number(e.target.value || 0) })} /></label>
                <select className="in" aria-label={`Decision ${i + 1} majority`} value={d.needs} onChange={(e) => ud({ needs: e.target.value as typeof d.needs })}><option value="majority">Simple majority</option><option value="two-thirds">Two-thirds</option></select>
              </div>
              <span className={`pill ${r.passed ? 'good' : 'bad'}`}>{r.why}</span>
            </div>
          ); })}
          <button type="button" className="btn sm" onClick={() => up({ decisions: [...m.decisions, { text: '', votesFor: 0, against: 0, abstain: 0, needs: 'majority' }] })}>Add a decision</button>
        </div>
        <Field label="Minutes"><textarea className="in" rows={6} aria-label="Minutes text" value={m.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
      </fieldset>
      {errs.length > 0 && <ul className="notice warn-note" role="alert">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
      {saved && <p className="notice ok" role="status">{saved}.</p>}
      {canEdit && <div className="zk-act mn-flow">
        <button type="button" className="btn primary" onClick={() => save()}>{isNew ? 'Save meeting' : 'Save changes'}</button>
        {m.status === 'draft' && !isNew && <div className="mn-approve"><Field label="Minutes approved on"><input className="in" type="date" aria-label="Approved on" value={m.approvedOn || todayCT()} onChange={(e) => up({ approvedOn: e.target.value })} /></Field><button type="button" className="btn" onClick={() => save({ status: 'approved', approvedOn: m.approvedOn || todayCT() }, 'Minutes approved')}>Mark approved</button></div>}
        {m.status !== 'draft' && <div className="mn-approve"><Field label="Who can read them"><select className="in" aria-label="Who can read the minutes" value={m.audience} onChange={(e) => up({ audience: e.target.value as Meeting['audience'] })}>{Object.entries(AUDIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <button type="button" className="btn" onClick={() => save({ status: 'published' }, 'Minutes published')}>{m.status === 'published' ? 'Update who can read' : 'Publish minutes'}</button></div>}
      </div>}
      {!canEdit && <p className="muted small">View only – {m.body === 'council' ? 'Council minutes are kept by the center’s admins.' : 'Board, Joint and General Assembly minutes are kept by the General Secretary’s office.'}</p>}
    </aside>
  );
}
