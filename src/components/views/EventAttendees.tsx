'use client';
/**
 * Event registrations, waitlist and check-in (review step 6; WildApricot: Event registrants + check-in). DEMO: the list is
 * made from sample members to match the event's counts; check-ins are kept in this browser.
 * Live: GET /admin/events/{id}/registrations, POST …/{reg}/check-in, POST …/waitlist/promote (server: promoteFromWaitlist).
 */
import { useEffect, useMemo, useState } from 'react';
import { type EventItem, fmtWhen, promoteFromWaitlist, spotsLeft } from '@/lib/community/events';
import { csvCell } from '@/lib/community/member-records';
import { demoMembers, fullName } from '@/lib/members/members';
import { useAccess } from '@/lib/access/use-access';
import { logAudit } from '@/lib/access/audit';

type Reg = { id: string; name: string; email: string; typeId: string; seats: number; paidCents: number; at: string };
const KEY = 'isgh-admin-checkins';
const readCk = (): Record<string, string[]> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

/** Stable sample registrations whose seats add up to the event's count (and a waitlist of `waiting` people). */
export function demoRegistrations(e: EventItem): { regs: Reg[]; waitlist: Reg[] } {
  let h = 0; for (const ch of e.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = demoMembers().filter((m) => !m.archived && m.approvedOn);
  const types = e.registration.types.filter((t) => t.enabled);
  const make = (total: number, prefix: string, offset: number) => {
    const out: Reg[] = []; let left = total, i = 0;
    while (left > 0 && i < 2000) {
      const m = pool[(h + offset + i * 7) % pool.length];
      const maxG = e.registration.guests.allowed ? Math.min(e.registration.guests.max, left - 1) : 0;
      const seats = 1 + (maxG > 0 ? (h + i) % (maxG + 1) : 0);
      const t = types[(h + i) % types.length];
      out.push({ id: `${prefix}${String(i + 1).padStart(4, '0')}`, name: fullName(m), email: m.email, typeId: t.id, seats, paidCents: t.priceCents + (seats - 1) * t.guestPriceCents, at: `2026-10-${String(1 + ((h + i) % 14)).padStart(2, '0')}` });
      left -= seats; i++;
    }
    return out;
  };
  return { regs: make(e.registered, 'R', 0), waitlist: make(e.waiting, 'W', 5000) };
}

export function EventAttendees({ e, now }: { e: EventItem; now: string }) {
  const { regs, waitlist } = useMemo(() => demoRegistrations(e), [e]);
  const [ck, setCk] = useState<string[]>([]);
  const [promoted, setPromoted] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const access = useAccess();
  useEffect(() => { setCk(readCk()[e.id] ?? []); }, [e.id]);
  const save = (ids: string[]) => { setCk(ids); try { localStorage.setItem(KEY, JSON.stringify({ ...readCk(), [e.id]: ids })); } catch { /* */ } };
  const today = now.slice(0, 10);
  const eventDay = today >= e.start.slice(0, 10) && today <= e.end.slice(0, 10);
  const people = regs.reduce((n, r) => n + r.seats, 0);
  const inPeople = regs.filter((r) => ck.includes(r.id)).reduce((n, r) => n + r.seats, 0);
  const shown = regs.filter((r) => !q || `${r.name} ${r.email} ${r.id}`.toLowerCase().includes(q.toLowerCase()));
  const typeName = (id: string) => e.registration.types.find((t) => t.id === id)?.name ?? id;
  const open = Number.isFinite(spotsLeft(e)) ? spotsLeft(e) : Infinity;
  const nextUp = promoteFromWaitlist(open === Infinity ? 0 : open, waitlist.filter((w) => !promoted.includes(w.id)).map((w) => ({ id: w.id, seats: w.seats })));
  const exportCsv = () => {
    const head = ['Confirmation', 'Name', 'Email', 'Type', 'People', 'Paid', 'Registered on', 'Checked in'];
    const rows = regs.map((r) => [r.id, r.name, r.email, typeName(r.typeId), r.seats, (r.paidCents / 100).toFixed(2), r.at, ck.includes(r.id) ? 'Yes' : 'No']);
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `${e.id}-registrations.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <section className="ev-att" aria-label="Registrations and check-in">
      <div className="ev-att-head">
        <p role="status"><b>{regs.length.toLocaleString('en-US')}</b> registrations · <b>{people.toLocaleString('en-US')}</b> people{e.registration.capacity ? ` of ${e.registration.capacity}` : ''} · <b data-in={inPeople}>{inPeople}</b> checked in{waitlist.length ? ` · ${waitlist.length} on the waitlist` : ''}</p>
        <div className="row-actions">
          <label className="sr-only" htmlFor={`att-q-${e.id}`}>Find a registration</label>
          <input id={`att-q-${e.id}`} className="in" type="search" placeholder="Name, email or confirmation" value={q} onChange={(x) => setQ(x.target.value)} />
          {access.can('members.contact') && <button type="button" className="btn sm" onClick={() => { logAudit({ area: 'export', action: 'Registrations exported', detail: `${e.title} (${regs.length})` }); exportCsv(); }} disabled={!regs.length}>Export list</button>}
        </div>
      </div>
      {!eventDay && <p className="muted ev-att-note">Check-in opens on the event day ({fmtWhen(e.start).split(',')[0]}).</p>}
      <div className="table-wrap ev-att-table"><table className="t-plain">
        <thead><tr><th>Name</th><th>Type</th><th className="num">People</th><th className="num">Paid</th><th>Check-in</th></tr></thead>
        <tbody>{shown.slice(0, 50).map((r) => { const on = ck.includes(r.id); return (
          <tr key={r.id} data-reg={r.id}><td><b>{r.name}</b><small className="block">{r.id} · {r.email}</small></td><td>{typeName(r.typeId)}</td><td className="num">{r.seats}</td><td className="num">{r.paidCents ? `$${(r.paidCents / 100).toFixed(2)}` : 'Free'}</td>
            <td><button type="button" className={`btn sm${on ? ' primary' : ''}`} disabled={!eventDay} aria-pressed={on} onClick={() => save(on ? ck.filter((x) => x !== r.id) : [...ck, r.id])}>{on ? 'Checked in' : 'Check in'}<span className="sr-only"> {r.name}</span></button></td></tr>
        ); })}</tbody>
      </table></div>
      {shown.length > 50 && <p className="muted">First 50 of {shown.length}. Search to find someone.</p>}
      {waitlist.length > 0 && (
        <div className="ev-wait">
          <p><b>Waitlist</b> – first come, first served. {open === Infinity || open === 0 ? 'No free spots right now.' : `${open} spot${open === 1 ? '' : 's'} free.`}</p>
          <ol>{waitlist.map((w) => <li key={w.id} className={promoted.includes(w.id) ? 'done' : ''}>{w.name} <small>({w.seats} {w.seats === 1 ? 'person' : 'people'})</small>{promoted.includes(w.id) && <span className="pill good">Spot offered</span>}</li>)}</ol>
          {nextUp.length > 0 && access.can('events.manage') && <button type="button" className="btn sm primary" onClick={() => setPromoted([...promoted, ...nextUp])}>Offer {nextUp.length} spot{nextUp.length === 1 ? '' : 's'} (sends “A spot opened up”)</button>}
        </div>
      )}
    </section>
  );
}
