'use client';
/**
 * Members › People – everyone the organization knows, one row per person. Everyone starts as a CONTACT (installed the
 * app, came to an event, gave once, left their details on "My masjid"); a contact becomes an APPLICANT when they start
 * the join form, a MEMBER when approved, and a DONOR when a gift is recorded – the same row with more facts, never a
 * second person. The office sees the funnel, filters by stage, tags people, emails a contact, and turns a contact into
 * a member with one click (the Add member form starts with their details). Live: GET /admin/people(+/:id), PATCH /admin/people/:id,
 * POST /admin/contacts/:id/message, DELETE /admin/contacts/:id.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '@/components/charts/DashKit';
import { StatTile } from '@/components/charts/Charts';
import { useAccess } from '@/lib/access/use-access';
import { be, LIVE } from '@/lib/live/live';
import { AddMemberDialog } from './AddMemberDialog';

type Person = { contactId: string; masjidId: string | null; firstName: string; lastName: string; email: string; phone: string; source: string; note: string; tags: string[]; createdAt: string; lastSeenAt: string;
  stage: 'contact' | 'applicant' | 'member' | 'donor' | 'applicant+donor' | 'member+donor'; becameMemberAt: string | null; firstGiftAt: string | null;
  member: { id: string; status: string | null; plan: string | null; approvedOn: string | null } | null; giving: { count: number; cents: number; lastOn: string | null }; events: number };
type Funnel = { people: number; contacts: number; applicants: number; members: number; donors: number; both: number };
type Kind = 'all' | 'contacts' | 'applicants' | 'members' | 'donors';

const DEMO: Person[] = [
  { contactId: 'c-1', masjidId: 'nw', firstName: 'Akhter', lastName: 'Alam', email: 'akhter@example.com', phone: '7135550101', source: 'app', note: '', tags: ['youth'], createdAt: '2026-10-19T14:02:00Z', lastSeenAt: '2026-10-20T09:10:00Z', stage: 'contact', becameMemberAt: null, firstGiftAt: null, member: null, giving: { count: 0, cents: 0, lastOn: null }, events: 1 },
  { contactId: 'c-2', masjidId: 'sw', firstName: 'Mariam', lastName: 'Siddiqui', email: 'mariam.s@example.com', phone: '2815550144', source: 'donation', note: 'Asked about Sunday school', tags: [], createdAt: '2026-10-18T19:30:00Z', lastSeenAt: '2026-10-18T19:30:00Z', stage: 'donor', becameMemberAt: null, firstGiftAt: '2026-10-18T19:30:00Z', member: null, giving: { count: 2, cents: 15000, lastOn: '2026-10-18' }, events: 0 },
  { contactId: 'c-3', masjidId: 'nw', firstName: 'Yusuf', lastName: 'Rahman', email: 'yusuf.rahman@example.com', phone: '8325550147', source: 'member', note: '', tags: [], createdAt: '2026-10-17T11:00:00Z', lastSeenAt: '2026-10-17T11:00:00Z', stage: 'member+donor', becameMemberAt: '2026-10-17T11:00:00Z', firstGiftAt: '2026-09-01T00:00:00Z', member: { id: 'HOU-100231', status: 'active', plan: 'single', approvedOn: '2026-10-17' }, giving: { count: 1, cents: 5000, lastOn: '2026-09-01' }, events: 2 },
];
const phone = (p: string) => (p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const usd = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0 })}`;
const STAGE: Record<Person['stage'], { label: string; cls: string }> = {
  contact: { label: 'Contact', cls: 'st-contact' }, applicant: { label: 'Applied', cls: 'st-applicant' }, member: { label: 'Member', cls: 'st-member' }, donor: { label: 'Donor', cls: 'st-donor' },
  'applicant+donor': { label: 'Applied · Donor', cls: 'st-applicant' }, 'member+donor': { label: 'Member · Donor', cls: 'st-member' },
};
const SOURCE: Record<string, string> = { app: 'App', website: 'Website', office: 'Office', import: 'Import', member: 'Member record', donation: 'Gift', event: 'Event' };

export function PeopleView() {
  const access = useAccess();
  const canEdit = access.can('members.edit'), canMessage = access.can('comms.send');
  const [list, setList] = useState<Person[] | null>(LIVE ? null : DEMO);
  const [funnel, setFunnel] = useState<Funnel | null>(LIVE ? null : { people: 3, contacts: 1, applicants: 0, members: 1, donors: 2, both: 1 });
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [editing, setEditing] = useState<{ id: string; note: string; tags: string } | null>(null);
  const [message, setMessage] = useState<Person | null>(null);
  const [adding, setAdding] = useState<Person | null>(null);

  async function load() {
    if (!LIVE) return;
    const r = await be<{ people: Person[]; funnel: Funnel }>('GET', 'admin/people');
    if (r.ok) { setList(r.data.people); setFunnel(r.data.funnel); } else setError(r.message);
  }
  useEffect(() => { void load(); }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (list ?? []).filter((p) => (kind === 'all' || (kind === 'contacts' ? p.stage === 'contact' : kind === 'applicants' ? p.stage.startsWith('applicant') : kind === 'members' ? p.stage.startsWith('member') : p.giving.count > 0))
      && (!t || `${p.firstName} ${p.lastName} ${p.email} ${p.phone} ${p.masjidId ?? ''} ${p.tags.join(' ')}`.toLowerCase().includes(t)));
  }, [list, q, kind]);

  async function save(p: Person) {
    if (!editing) return;
    const tags = editing.tags.split(',').map((x) => x.trim()).filter(Boolean);
    if (LIVE) { const r = await be<Person>('PATCH', `admin/people/${p.contactId}`, { note: editing.note, tags }); if (!r.ok) { setError(r.message); return; } }
    setList((l) => (l ?? []).map((x) => (x.contactId === p.contactId ? { ...x, note: editing.note, tags } : x))); setEditing(null);
  }
  async function remove(p: Person) {
    if (!window.confirm(`Remove ${p.firstName} ${p.lastName} from People? Their app forgets them too. A member record is not touched.`)) return;
    if (LIVE) { const r = await be('DELETE', `admin/contacts/${p.contactId}`); if (!r.ok) { setError(r.message); return; } }
    setList((l) => (l ?? []).filter((x) => x.contactId !== p.contactId));
  }
  const exp = () => downloadCsv('people', ['First name', 'Last name', 'Email', 'Mobile', 'Masjid', 'Stage', 'Member', 'Gifts', 'Given', 'Last gift', 'Events', 'Source', 'Tags', 'Added', 'Last seen', 'Note'],
    shown.map((p) => [p.firstName, p.lastName, p.email, phone(p.phone), p.masjidId ?? '', STAGE[p.stage].label, p.member?.id ?? '', String(p.giving.count), (p.giving.cents / 100).toFixed(2), p.giving.lastOn ?? '', String(p.events), SOURCE[p.source] ?? p.source, p.tags.join('; '), p.createdAt.slice(0, 10), p.lastSeenAt.slice(0, 10), p.note]), 'members');
  const f = funnel ?? { people: 0, contacts: 0, applicants: 0, members: 0, donors: 0, both: 0 };
  const pct = (n: number) => (f.people ? `${Math.round((n / f.people) * 100)}% of people` : '');

  return (
    <div className="page cm">
      <header className="page-head">
        <div>
          <h1>People</h1>
          <p className="page-intro">Everyone the organization knows, one row each. A person starts as a <b>contact</b> (the app, an event, a gift, “My masjid”), <b>applies</b> on the join form, becomes a <b>member</b> when approved, and is a <b>donor</b> once a gift is recorded – the same row, with more facts.</p>
        </div>
        <div className="page-actions"><button type="button" className="btn" onClick={exp} disabled={!shown.length}>Download CSV</button></div>
      </header>
      {error && <p className="notice bad" role="alert">{error}</p>}
      <div className="mo-kpis cm-kpis">
        <StatTile id="pp-all" hero label="People" value={f.people.toLocaleString('en-US')} note="contacts, applicants, members and donors" />
        <StatTile id="pp-contacts" label="Contacts only" value={f.contacts.toLocaleString('en-US')} note={pct(f.contacts) || 'not a member, not a donor – your outreach list'} />
        <StatTile id="pp-members" label="Members" value={f.members.toLocaleString('en-US')} note={pct(f.members)} />
        <StatTile id="pp-donors" label="Donors" value={f.donors.toLocaleString('en-US')} note={f.both ? `${f.both.toLocaleString('en-US')} are also members` : pct(f.donors)} />
      </div>
      <section className="glass-pane zk-list cm-list" aria-label="People">
        <div className="chip-row" role="group" aria-label="Show">
          {([['all', 'All'], ['contacts', 'Contacts only'], ['applicants', 'Applied'], ['members', 'Members'], ['donors', 'Donors']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
          <label className="sr-only" htmlFor="pp-q">Search</label><input id="pp-q" className="in sm cm-search" placeholder="Name, email, mobile, masjid, tag" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list === null ? <p className="muted">Loading people…</p> : !shown.length ? <p className="muted">Nobody {q ? 'matches' : 'here yet'}.</p> : (
          <div className="table-wrap"><table className="t-plain zk-table cm-table pp-table">
            <thead><tr><th>Person</th><th>Stage</th><th>Mobile</th><th>Masjid</th><th>Giving</th><th>Since</th><th>Tags · note</th><th /></tr></thead>
            <tbody>{shown.map((p) => (
              <tr key={p.contactId}>
                <td><strong>{p.firstName} {p.lastName}</strong><br /><a href={`mailto:${p.email}`}>{p.email}</a><br /><small className="muted">{SOURCE[p.source] ?? p.source}{p.events ? ` · ${p.events} event${p.events === 1 ? '' : 's'}` : ''}</small></td>
                <td><span className={`pill ${STAGE[p.stage].cls}`}>{STAGE[p.stage].label}</span>{p.member && <><br /><Link href={`/members/${encodeURIComponent(p.member.id)}`}>{p.member.id}</Link>{p.member.status ? <small className="muted"> · {p.member.status}</small> : null}</>}</td>
                <td>{p.phone ? <a href={`tel:${p.phone}`}>{phone(p.phone)}</a> : <span className="muted">—</span>}</td>
                <td>{p.masjidId ?? <span className="muted">—</span>}</td>
                <td>{p.giving.count ? <>{usd(p.giving.cents)}<br /><small className="muted">{p.giving.count} gift{p.giving.count === 1 ? '' : 's'} · last {when(p.giving.lastOn)}</small></> : <span className="muted">—</span>}</td>
                <td>{when(p.createdAt)}{p.lastSeenAt.slice(0, 10) !== p.createdAt.slice(0, 10) && <><br /><small className="muted">seen {when(p.lastSeenAt)}</small></>}</td>
                <td>{editing?.id === p.contactId ? (
                  <span className="row-edit"><input className="in sm" value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} aria-label="Tags, comma separated" placeholder="tags, comma separated" />
                    <input className="in sm" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} aria-label="Note" placeholder="note" />
                    <button type="button" className="btn sm primary" onClick={() => void save(p)}>Save</button> <button type="button" className="btn sm" onClick={() => setEditing(null)}>Cancel</button></span>
                ) : <>{p.tags.map((t) => <span key={t} className="pill pp-tag">{t}</span>)}{p.note && <small className="block-hint">{p.note}</small>}{!p.tags.length && !p.note && <span className="muted">—</span>}</>}</td>
                <td className="actions">
                  {canEdit && editing?.id !== p.contactId && <button type="button" className="btn sm" onClick={() => setEditing({ id: p.contactId, note: p.note, tags: p.tags.join(', ') })}>Tag / note<span className="sr-only"> for {p.firstName}</span></button>}
                  {!p.member && canEdit && LIVE && <button type="button" className="btn sm primary" onClick={() => setAdding(p)}>Make a member</button>}
                  {!p.member && canMessage && LIVE && <button type="button" className="btn sm" onClick={() => setMessage(p)}>Email</button>}
                  {canEdit && <button type="button" className="btn sm danger" onClick={() => void remove(p)}>Remove<span className="sr-only"> {p.firstName}</span></button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      {adding && <AddMemberDialog initial={{ first: adding.firstName, last: adding.lastName, email: adding.email, phone: adding.phone }} onClose={() => setAdding(null)} onAdded={() => { setAdding(null); void load(); }} />}
      {message && <ContactMessageDialog p={message} onClose={() => setMessage(null)} onSent={() => { setMessage(null); }} />}
    </div>
  );
}

function ContactMessageDialog({ p, onClose, onSent }: { p: Person; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(`Assalamu alaikum ${p.firstName},\n\n`);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const send = async () => {
    if (!subject.trim() || !body.trim()) return setErr('Write a subject and the message.');
    setBusy(true); const r = await be('POST', `admin/contacts/${p.contactId}/message`, { subject: subject.trim(), body: body.trim() }); setBusy(false);
    if (!r.ok) setErr(r.message); else onSent();
  };
  return (
    <dialog ref={open} className="modal glass-float" aria-label="Email a contact" onClose={onClose} onCancel={onClose}>
      <form method="dialog" className="m-form" onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
        <h2>Email {p.firstName} {p.lastName}</h2>
        <p className="muted small">To {p.email}. A plain email from the office – not a bulk message, so no preference link; kept in the audit log.</p>
        <label className="sf-field"><span className="sf-label">Subject</span><input className="in" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} /></label>
        <label className="sf-field"><span className="sf-label">Message</span><textarea className="in" rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} /></label>
        {err && <p className="sf-err" role="alert">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send email'}</button></div>
      </form>
    </dialog>
  );
}
