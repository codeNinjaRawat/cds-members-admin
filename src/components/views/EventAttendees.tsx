'use client';
/**
 * Event registrations, waitlist and check-in (review step 6; WildApricot: Event registrants + check-in). DEMO: the list is
 * made from sample members to match the event's counts; check-ins are kept in this browser.
 * Live: GET /admin/events/{id}/registrations, POST /admin/registrations/{reg}/check-in (the waitlist moves up on the server).
 */
import { useEffect, useMemo, useState } from 'react';
import { type EventItem, fmtWhen, promoteFromWaitlist, spotsLeft } from '@/lib/community/events';
import { csvCell } from '@/lib/community/member-records';
import { demoMembers, fullName, membersWithEdits } from '@/lib/members/members';
import { useAccess } from '@/lib/access/use-access';
import { logAudit } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

/* ---------- live mode: registrations from the API (seats taken under a lock there; the waitlist moves up by itself) ---------- */
type ApiReg = { id: string; name: string; email: string; type_id: string; seats: number; paid_cents: number; created_at: string; status: string; guests: { id: string; name: string; checkedIn: boolean }[] };
type LiveRegs = { regs: Reg[]; waitlist: Reg[]; checked: string[] };
const toReg = (r: ApiReg): Reg => ({ id: r.id, name: r.name, email: r.email ?? '', typeId: r.type_id, seats: r.seats, paidCents: r.paid_cents ?? 0, at: String(r.created_at ?? '').slice(0, 10) });
export async function loadLiveRegistrations(eventId: string): Promise<LiveRegs | null> {
  const r = await be<{ registrations: ApiReg[] }>('GET', `admin/events/${encodeURIComponent(eventId)}/registrations`);
  if (!r.ok) { notice(`Registrations could not be loaded: ${r.message}`); return null; }
  const list = r.data.registrations;
  return { regs: list.filter((x) => x.status === 'confirmed' || x.status === 'pending-payment').map(toReg), waitlist: list.filter((x) => x.status === 'waitlist').map(toReg), checked: list.filter((x) => x.guests?.some((g) => g.checkedIn)).map((x) => x.id) };
}
/** Live: the real seat counts per event (the document's numbers are only the demo's). null = demo or still loading. */
export function useLiveEventCounts(): Record<string, { registered: number; waiting: number }> | null {
  const [c, setC] = useState<Record<string, { registered: number; waiting: number }> | null>(null);
  useEffect(() => { if (LIVE) void be<{ events: { id: string; registered: number; waiting: number }[] }>('GET', 'admin/events').then((r) => { if (r.ok) setC(Object.fromEntries(r.data.events.map((x) => [x.id, { registered: x.registered, waiting: x.waiting }]))); }); }, []);
  return c;
}
/** Check one registration in (all its people) or undo it – the API checks the day and the payment. */
export async function liveCheckIn(regId: string, undo: boolean): Promise<boolean> {
  const r = await be('POST', `admin/registrations/${encodeURIComponent(regId)}/check-in`, undo ? { undo: true } : {});
  if (!r.ok) notice(r.message); return r.ok;
}

type Reg = { id: string; name: string; email: string; typeId: string; seats: number; paidCents: number; at: string };
const KEY = 'isgh-admin-checkins';
const readCk = (): Record<string, string[]> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

/** Stable sample registrations whose seats add up to the event's count (and a waitlist of `waiting` people). */
export function demoRegistrations(e: EventItem): { regs: Reg[]; waitlist: Reg[] } {
  let h = 0; for (const ch of e.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = membersWithEdits().filter((m) => !m.archived && m.approvedOn);   // live: the API's members
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
  const demo = useMemo(() => (LIVE ? { regs: [], waitlist: [] } : demoRegistrations(e)), [e]);
  const [liveData, setLiveData] = useState<LiveRegs | null>(null);
  useEffect(() => { if (LIVE) void loadLiveRegistrations(e.id).then((d) => { if (d) { setLiveData(d); setCk(d.checked); } }); }, [e.id]);
  const { regs, waitlist } = LIVE ? liveData ?? { regs: [], waitlist: [] } : demo;
  const [ck, setCk] = useState<string[]>([]);
  const [promoted, setPromoted] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const access = useAccess();
  useEffect(() => { if (!LIVE) setCk(readCk()[e.id] ?? []); }, [e.id]);
  const toggle = async (id: string, on: boolean) => {
    if (!LIVE) return save(on ? ck.filter((x) => x !== id) : [...ck, id]);
    if (await liveCheckIn(id, on)) setCk((c) => (on ? c.filter((x) => x !== id) : [...c, id]));
  };
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
      {LIVE && !liveData && <p className="muted" role="status">Loading registrations…</p>}
      {!eventDay && <p className="muted ev-att-note">Check-in opens on the event day ({fmtWhen(e.start).split(',')[0]}).</p>}
      <div className="table-wrap ev-att-table"><table className="t-plain">
        <thead><tr><th>Name</th><th>Type</th><th className="num">People</th><th className="num">Paid</th><th>Check-in</th></tr></thead>
        <tbody>{shown.slice(0, 50).map((r) => { const on = ck.includes(r.id); return (
          <tr key={r.id} data-reg={r.id}><td><b>{r.name}</b><small className="block">{r.id} · {r.email}</small></td><td>{typeName(r.typeId)}</td><td className="num">{r.seats}</td><td className="num">{r.paidCents ? `$${(r.paidCents / 100).toFixed(2)}` : 'Free'}</td>
            <td><button type="button" className={`btn sm${on ? ' primary' : ''}`} disabled={!eventDay} aria-pressed={on} onClick={() => void toggle(r.id, on)}>{on ? 'Checked in' : 'Check in'}<span className="sr-only"> {r.name}</span></button></td></tr>
        ); })}</tbody>
      </table></div>
      {shown.length > 50 && <p className="muted">First 50 of {shown.length}. Search to find someone.</p>}
      {waitlist.length > 0 && (
        <div className="ev-wait">
          <p><b>Waitlist</b> – first come, first served. {open === Infinity || open === 0 ? 'No free spots right now.' : `${open} spot${open === 1 ? '' : 's'} free.`}</p>
          <ol>{waitlist.map((w) => <li key={w.id} className={promoted.includes(w.id) ? 'done' : ''}>{w.name} <small>({w.seats} {w.seats === 1 ? 'person' : 'people'})</small>{promoted.includes(w.id) && <span className="pill good">Spot offered</span>}</li>)}</ol>
          {LIVE ? <p className="muted">When someone cancels, the next person on the list gets the spot and an email.</p> : nextUp.length > 0 && access.can('events.manage') && <button type="button" className="btn sm primary" onClick={() => setPromoted([...promoted, ...nextUp])}>Offer {nextUp.length} spot{nextUp.length === 1 ? '' : 's'} (sends “A spot opened up”)</button>}
        </div>
      )}
    </section>
  );
}
