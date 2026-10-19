/** v0 ticket model – still used by the BE (BE/src/http/server.ts, seed.ts) until it moves to the help desk tables (app.hd_*, lib/community/work.ts). The admin screens use lib/community/work.ts. */
/**
 * Tasks and tickets – the model (no React, shared with the API) – the general work list next to the system queues. A ticket comes in from the website (a
 * complaint or feedback form, a member's request) or is a task an admin writes for someone; every one has a masjid
 * (or the organization), an owner, a priority with a target, a status and a thread of updates. Masjid roles see their
 * masjid's tickets; who may be assigned comes from Admins and roles.
 * DEMO: seeded here and kept in this browser. Live: GET/POST /admin/tickets, PATCH /admin/tickets/:id, POST
 * /admin/tickets/:id/updates; website forms POST /public/tickets (complaint, feedback, request).
 */
import { currentAdminName } from '@/lib/access/audit';

export const TICKET_KINDS = { complaint: 'Complaint', feedback: 'Feedback', request: 'Member request', task: 'Task' } as const;
export type TicketKind = keyof typeof TICKET_KINDS;
export const TICKET_STATUS = { open: 'Open', 'in-progress': 'In progress', waiting: 'Waiting on them', done: 'Done' } as const;
export type TicketStatus = keyof typeof TICKET_STATUS;
export const PRIORITIES = { high: { label: 'High', days: 2 }, normal: { label: 'Normal', days: 7 }, low: { label: 'Low', days: 14 } } as const;
export type Priority = keyof typeof PRIORITIES;
export type TicketUpdate = { at: string; by: string; text: string; status?: TicketStatus };
export type Ticket = {
  id: string; kind: TicketKind; title: string; detail: string;
  from: { name: string; memberId: string; email: string };       // who raised it ('' for an admin task)
  center: string;                                                 // '' = the organization
  assignee: string;                                               // admin id or ''
  priority: Priority; due: string;                                // due = ISO date
  status: TicketStatus; createdAt: string; createdBy: string; source: 'website' | 'admin' | 'email' | 'phone';
  updates: TicketUpdate[];
};

export const TODAY = '2026-10-13';
const addDays = (d: string, n: number) => { const t = Date.parse(`${String(d ?? '').slice(0, 10)}T12:00:00Z`); if (Number.isNaN(t)) return String(d ?? ''); return new Date(t + n * 86_400_000).toISOString().slice(0, 10); };
export const dueFor = (priority: Priority, from = TODAY) => addDays(from, PRIORITIES[priority].days);
/** Days past the target (positive = late). */
export const lateBy = (t: Ticket, today = TODAY) => (t.status === 'done' ? 0 : Math.round((Date.parse(today) - Date.parse(t.due)) / 86400000));
export const isOpen = (t: Ticket) => t.status !== 'done';

const T = (p: Partial<Ticket> & Pick<Ticket, 'id' | 'kind' | 'title'>): Ticket => ({
  detail: '', from: { name: '', memberId: '', email: '' }, center: '', assignee: '', priority: 'normal', due: dueFor('normal', addDays(TODAY, -2)), status: 'open', createdAt: `${addDays(TODAY, -2)}T10:00:00`, createdBy: 'Website', source: 'website', updates: [], ...p,
});
/** Fictional demo tickets – the kinds of things that reach a membership office. */
export const demoTickets = (): Ticket[] => [
  T({ id: 'T-1041', kind: 'complaint', title: 'Parking blocked during Jumu’ah', detail: 'Cars parked across the exit for the second week. Someone could get hurt in an emergency.', from: { name: 'Member (website form)', memberId: 'HOU-200341', email: 'member@example.com' }, center: 'Southwest Islamic Center 1', priority: 'high', due: dueFor('high', addDays(TODAY, -3)), createdAt: `${addDays(TODAY, -3)}T13:20:00`, status: 'in-progress', assignee: 'membership-office', updates: [{ at: `${addDays(TODAY, -2)}T09:00:00`, by: 'Membership office', text: 'Spoke with the volunteers; cones will be placed at the exit from this Friday.', status: 'in-progress' }] }),
  T({ id: 'T-1042', kind: 'feedback', title: 'Weekend school registration page is hard to find', detail: 'Took me ten minutes to find where to register my children. A link on the home page would help.', from: { name: 'Visitor', memberId: '', email: 'visitor@example.com' }, center: 'North Islamic Center 1', priority: 'low', due: dueFor('low', addDays(TODAY, -5)), createdAt: `${addDays(TODAY, -5)}T19:45:00` }),
  T({ id: 'T-1043', kind: 'request', title: 'Change of address and new phone number', detail: 'We moved to 77036 last month. Please update my record and my wife’s.', from: { name: 'Member (website form)', memberId: 'HOU-205032', email: 'member2@example.com' }, center: 'Southwest Islamic Center 1', priority: 'normal', due: dueFor('normal', addDays(TODAY, -9)), createdAt: `${addDays(TODAY, -9)}T08:10:00` }),
  T({ id: 'T-1044', kind: 'task', title: 'Call members whose cards were declined this month', detail: 'Nine members in Payments to fix. Offer to update the card or pay by check at the center.', center: '', assignee: 'treasurer', priority: 'normal', due: dueFor('normal', addDays(TODAY, -1)), createdAt: `${addDays(TODAY, -1)}T11:00:00`, createdBy: 'Mohammad (demo)', source: 'admin' }),
  T({ id: 'T-1045', kind: 'task', title: 'Confirm Eid dates with the Imams for the oath calendar', detail: 'Elected officials › Rules needs the 2027 Eid dates before December.', center: '', assignee: 'ec-chair', priority: 'low', due: dueFor('low', TODAY), createdAt: `${TODAY}T09:30:00`, createdBy: 'Mohammad (demo)', source: 'admin' }),
  T({ id: 'T-1046', kind: 'request', title: 'Membership card for my son who turned 18', detail: 'He is on our family plan and would like his own card and login.', from: { name: 'Member (phone)', memberId: 'HOU-201226', email: '' }, center: 'Southwest Islamic Center 1', priority: 'normal', due: dueFor('normal', addDays(TODAY, -4)), createdAt: `${addDays(TODAY, -4)}T15:00:00`, createdBy: 'Front office', source: 'phone', status: 'waiting', assignee: 'treasurer', updates: [{ at: `${addDays(TODAY, -3)}T10:00:00`, by: 'ISGH Treasurer', text: 'Asked for his date of birth and photo ID by email.', status: 'waiting' }] }),
  T({ id: 'T-1047', kind: 'complaint', title: 'Donation receipt shows the wrong amount', detail: 'Gave $500 on the website; the receipt says $50.', from: { name: 'Donor (website form)', memberId: '', email: 'donor@example.com' }, center: '', priority: 'high', due: dueFor('high', addDays(TODAY, -6)), createdAt: `${addDays(TODAY, -6)}T17:30:00`, status: 'done', assignee: 'treasurer', updates: [{ at: `${addDays(TODAY, -5)}T09:00:00`, by: 'ISGH Treasurer', text: 'Receipt corrected and re-sent; the kiosk had logged the gift twice.', status: 'done' }] }),
  T({ id: 'T-1048', kind: 'feedback', title: 'Thank you for the new prayer timetable', detail: 'The printable month view is exactly what our elders asked for.', from: { name: 'Member (website form)', memberId: 'HOU-209623', email: 'member3@example.com' }, center: 'North Islamic Center 1', priority: 'low', due: dueFor('low', addDays(TODAY, -1)), createdAt: `${addDays(TODAY, -1)}T20:15:00`, status: 'done', updates: [{ at: `${TODAY}T08:00:00`, by: 'Mohammad (demo)', text: 'Passed on to the prayer-times team.', status: 'done' }] }),
];

