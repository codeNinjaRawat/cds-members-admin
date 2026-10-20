'use client';
/**
 * Members › Contacts – people who use the member app as visitors of a masjid (no account). The app asks first name,
 * last name, email and mobile once ("My masjid"); each becomes one contact here. The office sees who they are, which
 * masjid they chose, whether a member record already has that email, keeps a note, exports the list, and can invite
 * them to join (an email; the app's join form already starts with their details). Needs "See members"; notes and removal
 * need "Edit members". Live only: GET /admin/contacts, PATCH /admin/contacts/:id {note}, DELETE /admin/contacts/:id.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '@/components/charts/DashKit';
import { StatTile } from '@/components/charts/Charts';
import { useAccess } from '@/lib/access/use-access';
import { be, LIVE } from '@/lib/live/live';

export type Contact = { contactId: string; masjidId: string | null; firstName: string; lastName: string; email: string; phone: string; source: string; note: string; createdAt: string; lastSeenAt: string; memberId: string | null };

const DEMO: Contact[] = [
  { contactId: 'c-1', masjidId: 'nw', firstName: 'Akhter', lastName: 'Alam', email: 'akhter@example.com', phone: '7135550101', source: 'app', note: '', createdAt: '2026-10-19T14:02:00Z', lastSeenAt: '2026-10-20T09:10:00Z', memberId: null },
  { contactId: 'c-2', masjidId: 'sw', firstName: 'Mariam', lastName: 'Siddiqui', email: 'mariam.s@example.com', phone: '2815550144', source: 'app', note: 'Asked about Sunday school', createdAt: '2026-10-18T20:40:00Z', lastSeenAt: '2026-10-18T20:40:00Z', memberId: null },
  { contactId: 'c-3', masjidId: 'nw', firstName: 'Yusuf', lastName: 'Rahman', email: 'yusuf.rahman@example.com', phone: '8325550147', source: 'app', note: '', createdAt: '2026-10-17T11:00:00Z', lastSeenAt: '2026-10-17T11:00:00Z', memberId: 'ISGH-26-04817' },
];
const phone = (p: string) => (p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p);
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function ContactsView() {
  const access = useAccess();
  const canEdit = access.can('members.edit');
  const [list, setList] = useState<Contact[] | null>(LIVE ? null : DEMO);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'members'>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  async function load() {
    if (!LIVE) return;
    const r = await be<{ contacts: Contact[] }>('GET', 'admin/contacts');
    if (r.ok) setList(r.data.contacts); else setError(r.message);
  }
  useEffect(() => { void load(); }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (list ?? []).filter((c) => (filter === 'all' || (filter === 'members' ? !!c.memberId : !c.memberId)) && (!t || `${c.firstName} ${c.lastName} ${c.email} ${c.phone} ${c.masjidId ?? ''}`.toLowerCase().includes(t)));
  }, [list, q, filter]);
  const nMembers = (list ?? []).filter((c) => c.memberId).length;

  async function saveNote(c: Contact) {
    if (LIVE) { const r = await be<Contact>('PATCH', `admin/contacts/${c.contactId}`, { note: noteDraft }); if (!r.ok) { setError(r.message); return; } }
    setList((l) => (l ?? []).map((x) => (x.contactId === c.contactId ? { ...x, note: noteDraft } : x))); setEditing(null);
  }
  async function remove(c: Contact) {
    if (!window.confirm(`Remove ${c.firstName} ${c.lastName} from contacts? Their app forgets them too.`)) return;
    if (LIVE) { const r = await be('DELETE', `admin/contacts/${c.contactId}`); if (!r.ok) { setError(r.message); return; } }
    setList((l) => (l ?? []).filter((x) => x.contactId !== c.contactId));
  }
  const exp = () => downloadCsv('contacts', ['First name', 'Last name', 'Email', 'Mobile', 'Masjid', 'Source', 'Member', 'Added', 'Last seen', 'Note'],
    shown.map((c) => [c.firstName, c.lastName, c.email, phone(c.phone), c.masjidId ?? '', c.source, c.memberId ?? '', c.createdAt.slice(0, 10), c.lastSeenAt.slice(0, 10), c.note]), 'members');

  return (
    <div className="page cm">
      <header className="page-head">
        <div>
          <h1>Contacts <span className="pill">visitors</span></h1>
          <p className="page-intro">People who use the member app as visitors of a masjid – no account, just the name, email and mobile they left on “My masjid”. Their donations, tickets and the membership form start filled in. A contact whose email already belongs to a member record shows that member.</p>
        </div>
        <div className="page-actions"><button type="button" className="btn" onClick={exp} disabled={!shown.length}>Download CSV</button></div>
      </header>
      {error && <p className="notice bad" role="alert">{error}</p>}
      <div className="mo-kpis cm-kpis">
        <StatTile id="ct-all" hero label="Contacts" value={String(list?.length ?? 0)} note="left their details in the app" />
        <StatTile id="ct-new" label="Not members yet" value={String((list?.length ?? 0) - nMembers)} note="your outreach list" />
        <StatTile id="ct-members" label="Already members" value={String(nMembers)} note="same email as a member record" />
      </div>
      <section className="glass-pane zk-list cm-list" aria-label="Contacts">
        <div className="chip-row" role="group" aria-label="Show">
          {([['all', 'All'], ['new', 'Not members'], ['members', 'Members']] as const).map(([f, l]) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l}</button>)}
          <label className="sr-only" htmlFor="ct-q">Search</label><input id="ct-q" className="in sm cm-search" placeholder="Name, email, mobile, masjid" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list === null ? <p className="muted">Loading…</p> : !shown.length ? <p className="muted">No contacts{q ? ' match' : ' yet – they appear when someone taps “My masjid” in the app'}.</p> : (
          <div className="table-wrap"><table className="t-plain zk-table cm-table">
            <thead><tr><th>Contact</th><th>Mobile</th><th>Masjid</th><th>Added</th><th>Membership</th><th>Note</th><th /></tr></thead>
            <tbody>{shown.map((c) => (
              <tr key={c.contactId}>
                <td><strong>{c.firstName} {c.lastName}</strong><br /><a href={`mailto:${c.email}`}>{c.email}</a></td>
                <td><a href={`tel:${c.phone}`}>{phone(c.phone)}</a></td>
                <td>{c.masjidId ?? <span className="muted">—</span>}</td>
                <td>{when(c.createdAt)}{c.lastSeenAt.slice(0, 10) !== c.createdAt.slice(0, 10) && <><br /><span className="muted">seen {when(c.lastSeenAt)}</span></>}</td>
                <td>{c.memberId ? <Link href={`/members/${encodeURIComponent(c.memberId)}`}>{c.memberId}</Link> : <span className="pill">Not a member</span>}</td>
                <td>{editing === c.contactId ? (
                  <span className="row-edit"><input className="in sm" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} aria-label="Note" /> <button type="button" className="btn sm primary" onClick={() => void saveNote(c)}>Save</button> <button type="button" className="btn sm" onClick={() => setEditing(null)}>Cancel</button></span>
                ) : (c.note || <span className="muted">—</span>)}</td>
                <td className="actions">
                  {canEdit && editing !== c.contactId && <button type="button" className="btn sm" onClick={() => { setEditing(c.contactId); setNoteDraft(c.note); }}>Note<span className="sr-only"> for {c.firstName} {c.lastName}</span></button>}
                  {!c.memberId && <a className="btn sm primary" href={`mailto:${c.email}?subject=${encodeURIComponent('Become a member')}&body=${encodeURIComponent(`Assalamu alaikum ${c.firstName},\n\nThank you for visiting us. You can become a member in a few minutes from the app (Membership) or on our website.\n\n`)}`}>Invite to join</a>}
                  {canEdit && <button type="button" className="btn sm danger" onClick={() => void remove(c)}>Remove<span className="sr-only"> {c.firstName} {c.lastName}</span></button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
