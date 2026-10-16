/**
 * F6 Meeting minutes – every ISGH meeting the Bylaws require (Art. IX), its notice, who attended, quorum, decisions
 * and the minutes, plus a calendar check of the meetings that must happen.
 * - Council of each Islamic Center: at least monthly; quorum = majority of Area Representatives + Associate Director;
 *   special meetings on 48 hours' notice (may be remote). Administrative Secretary keeps the minutes; each Secretary
 *   attends at least 3 Council meetings a year.
 * - Board: at least monthly; quorum = majority of all nine; decisions by a majority of all Board members; special on 24 h.
 * - Executive Body with Associate Directors: January, March, June, September.
 * - Joint Board and Councils: March (semi-annual) and September (annual); quorum one third of elected office holders.
 * - General Assembly: September, two weeks' notice; quorum one fourth of eligible voting members.
 * DEMO (no API). Live: /admin/meetings. Synced to the admin by sync-contracts.mjs.
 */
import { z } from 'zod';

export const BODIES = {
  council: 'Council of Representatives', board: 'Board (Majlis-e-Shura)', 'exec-ad': 'Executive Body with Associate Directors',
  joint: 'Joint Board and Councils', 'zone-joint': 'Joint Councils of a zone', 'general-assembly': 'General Assembly',
} as const;
export type Body = keyof typeof BODIES;
export const MEETING_KINDS = { regular: 'Regular', special: 'Special', 'semi-annual': 'Semi-annual', annual: 'Annual' } as const;
export const AUDIENCE = { leaders: 'Elected leaders only', members: 'Members (member portal)', public: 'Everyone (website)' } as const;

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const DecisionSchema = z.object({
  text: z.string().trim().min(3, 'Write what was decided.').max(500),
  votesFor: z.number().int().min(0).max(100000), against: z.number().int().min(0).max(100000), abstain: z.number().int().min(0).max(100000),
  needs: z.enum(['majority', 'two-thirds']),
});
export const MeetingSchema = z.object({
  id: z.string().regex(/^MTG-\d{4}-\d{3,5}$/),
  body: z.enum(Object.keys(BODIES) as [Body, ...Body[]]),
  center: z.string().max(80),                       // council
  zone: z.string().max(40),                         // zone-joint
  kind: z.enum(['regular', 'special', 'semi-annual', 'annual']),
  date: ISO, start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  place: z.string().max(120), remote: z.boolean(),
  noticeSentAt: z.string().max(30),                 // ISO date-time, '' = not recorded
  calledBy: z.string().max(80),
  seats: z.number().int().min(1).max(100000),        // people entitled to vote (General Assembly: eligible voters)
  present: z.number().int().min(0).max(100000),
  attendees: z.array(z.object({ name: z.string().max(80), role: z.string().max(80), present: z.boolean(), remote: z.boolean() })).max(200),
  agenda: z.array(z.string().max(200)).max(40),
  decisions: z.array(DecisionSchema).max(60),
  notes: z.string().max(20000),
  actions: z.array(z.object({ text: z.string().max(300), owner: z.string().max(80), due: z.union([ISO, z.literal('')]) })).max(60),
  status: z.enum(['draft', 'approved', 'published']),
  approvedOn: z.union([ISO, z.literal('')]),
  audience: z.enum(['leaders', 'members', 'public']),
  recordedBy: z.string().max(80),
}).superRefine((m, ctx) => {
  if (m.body === 'council' && !m.center) ctx.addIssue({ code: 'custom', path: ['center'], message: 'Pick the Islamic Center.' });
  if (m.body === 'zone-joint' && !m.zone) ctx.addIssue({ code: 'custom', path: ['zone'], message: 'Pick the zone.' });
  if (m.present > m.seats && m.body !== 'general-assembly') ctx.addIssue({ code: 'custom', path: ['present'], message: 'More people present than seats.' });
  m.decisions.forEach((d, i) => { if (d.votesFor + d.against + d.abstain > m.present) ctx.addIssue({ code: 'custom', path: ['decisions', i, 'votesFor'], message: 'More votes than people present.' }); });
  if (m.status !== 'draft' && !m.approvedOn) ctx.addIssue({ code: 'custom', path: ['approvedOn'], message: 'Enter the date the minutes were approved.' });
});
export type Meeting = z.infer<typeof MeetingSchema>;
export type Decision = z.infer<typeof DecisionSchema>;

/* ---------------- rules ---------------- */
/** Notice the Bylaws require, in hours (0 = a regular meeting on the fixed schedule). */
export function noticeHours(m: Pick<Meeting, 'body' | 'kind'>): number {
  if (m.body === 'general-assembly') return 14 * 24;
  if (m.kind !== 'special') return 0;
  if (m.body === 'council') return 48;
  if (m.body === 'board') return 24;
  if (m.body === 'joint' || m.body === 'zone-joint') return 14 * 24;
  return 0;
}
/** People needed for a quorum. */
export function quorumNeeded(m: Pick<Meeting, 'body' | 'seats'>): number {
  if (m.body === 'joint' || m.body === 'zone-joint') return Math.ceil(m.seats / 3);
  if (m.body === 'general-assembly') return Math.ceil(m.seats / 4);
  return Math.floor(m.seats / 2) + 1;               // Council, Board, Executive Body: majority
}
export const quorumMet = (m: Pick<Meeting, 'body' | 'seats' | 'present'>) => m.present >= quorumNeeded(m);
/** Did a decision pass? Board: majority of ALL Board members; others: of those present. */
export function decisionResult(m: Pick<Meeting, 'body' | 'seats' | 'present'>, d: Decision): { passed: boolean; need: number; why: string } {
  if (!quorumMet(m)) return { passed: false, need: 0, why: 'No quorum – nothing can be decided.' };
  const base = m.body === 'board' ? m.seats : m.present;
  const need = d.needs === 'two-thirds' ? Math.ceil((base * 2) / 3) : Math.floor(base / 2) + 1;
  return { passed: d.votesFor >= need, need, why: d.votesFor >= need ? `Passed (${d.votesFor} of ${need} needed)` : `Not passed (${d.votesFor} of ${need} needed)` };
}
export function noticeProblem(m: Meeting): string {
  const need = noticeHours(m); if (!need) return '';
  if (!m.noticeSentAt) return `Notice not recorded – ${need >= 48 ? `${need / 24} days` : `${need} hours`} needed.`;
  const hours = (Date.parse(`${m.date}T${m.start}:00`) - Date.parse(m.noticeSentAt)) / 3_600_000;
  return hours + 0.01 < need ? `Notice was ${Math.max(0, Math.floor(hours))} hours before the meeting; ${need >= 48 ? `${need / 24} days` : `${need} hours`} are required.` : '';
}

/* ---------------- calendar check ---------------- */
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SECRETARY_ROLES = ['Administrative Secretary', 'Finance Secretary', 'Education Secretary', 'Membership Secretary', 'Youth Affairs Secretary'];
export type CalWarn = { level: 'stop' | 'look'; text: string; center?: string; meeting?: string };
/** Meetings the Bylaws require in `year`, checked up to `today` (only months that have ended). */
export function calendarWarnings(list: Meeting[], centers: string[], year: number, today: string): CalWarn[] {
  const out: CalWarn[] = [];
  const done = (m: number) => `${year}-${String(m).padStart(2, '0')}` < today.slice(0, 7);   // month ended
  const months = Array.from({ length: 12 }, (_, i) => i + 1).filter(done);
  const held = (pred: (x: Meeting) => boolean, m: number) => list.some((x) => pred(x) && x.date.startsWith(`${year}-${String(m).padStart(2, '0')}`));
  const none = months.length ? centers.filter((c) => !list.some((x) => x.body === 'council' && x.center === c && x.date.startsWith(String(year)))) : [];
  if (none.length > 1) out.push({ level: 'stop', text: `${none.length} centers have no Council meeting recorded in ${year}: ${none.join(', ')}. Councils meet at least once a month.` });
  for (const c of centers) {
    const miss = months.filter((m) => !held((x) => x.body === 'council' && x.center === c, m));
    if (miss.length && !(none.length > 1 && none.includes(c))) out.push({ level: 'stop', center: c, text: `${c}: no Council meeting in ${miss.map((m) => MONTH[m - 1]).join(', ')} (at least one a month).` });
    const left = 12 - Number(today.slice(5, 7)) + 1;
    for (const role of SECRETARY_ROLES) {
      const n = list.filter((x) => x.body === 'council' && x.center === c && x.date.startsWith(String(year)) && x.attendees.some((a) => a.role === role && a.present)).length;
      if (n < 3 && n + left < 3) out.push({ level: 'look', center: c, text: `${c}: the ${role} attended ${n} Council meeting${n === 1 ? '' : 's'} this year – at least 3 are required.` });
    }
  }
  const boardMiss = months.filter((m) => !held((x) => x.body === 'board', m));
  if (boardMiss.length) out.push({ level: 'stop', text: `Board: no meeting in ${boardMiss.map((m) => MONTH[m - 1]).join(', ')} (at least one a month).` });
  [1, 3, 6, 9].filter(done).forEach((m) => { if (!held((x) => x.body === 'exec-ad', m)) out.push({ level: 'stop', text: `Executive Body with Associate Directors: no meeting in ${MONTH[m - 1]}.` }); });
  if (done(3) && !held((x) => x.body === 'joint' && x.kind === 'semi-annual', 3) && !held((x) => x.body === 'joint' && x.kind === 'semi-annual', 4)) out.push({ level: 'stop', text: 'Semi-annual Joint Board and Councils meeting (March) not held – the audited financial statements are presented there.' });
  if (done(9) && !held((x) => x.body === 'joint' && x.kind === 'annual', 9) && !held((x) => x.body === 'joint' && x.kind === 'annual', 10)) out.push({ level: 'stop', text: 'Annual Joint Board and Councils meeting (September) not held.' });
  if (done(9) && !held((x) => x.body === 'general-assembly', 9) && !held((x) => x.body === 'general-assembly', 10)) out.push({ level: 'stop', text: 'Annual General Assembly (September) not held.' });
  for (const m of list.filter((x) => x.date.startsWith(String(year)) && x.date <= today)) {
    const n = noticeProblem(m); if (n) out.push({ level: 'stop', meeting: m.id, text: `${meetingTitle(m)} on ${fmt(m.date)}: ${n}` });
    if (!quorumMet(m)) out.push({ level: 'look', meeting: m.id, text: `${meetingTitle(m)} on ${fmt(m.date)}: no quorum (${m.present} of ${quorumNeeded(m)} needed) – decisions are not valid.` });
    if (m.remote && m.kind !== 'special') out.push({ level: 'look', meeting: m.id, text: `${meetingTitle(m)} on ${fmt(m.date)}: held remotely – the Bylaws allow remote meetings for special (urgent) meetings or disasters; record why.` });
    if (m.status === 'draft' && daysBetween(m.date, today) > 45) out.push({ level: 'look', meeting: m.id, text: `${meetingTitle(m)} on ${fmt(m.date)}: minutes still a draft after ${daysBetween(m.date, today)} days – approve them at the next meeting.` });
  }
  return out;
}

/* ---------------- helpers ---------------- */
export const fmt = (s: string) => (s ? `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}` : '');
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
export function meetingTitle(m: Pick<Meeting, 'body' | 'center' | 'zone' | 'kind'>): string {
  const k = m.kind === 'regular' ? '' : `${MEETING_KINDS[m.kind]} `;
  if (m.body === 'council') return `${k}Council meeting – ${m.center}`;
  if (m.body === 'zone-joint') return `${k}joint Councils – ${m.zone}`;
  return `${k}${BODIES[m.body]}`.replace(/^(\w)/, (c) => c.toUpperCase());
}
/** Minutes a member may read: published and meant for members or everyone; no attendance list or notes from drafts. */
export function memberMinutes(list: Meeting[], forPublic = false) {
  return list.filter((m) => m.status === 'published' && (m.audience === 'public' || (!forPublic && m.audience === 'members')))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((m) => ({ id: m.id, title: meetingTitle(m), date: m.date, center: m.center, body: m.body, decisions: m.decisions.map((d) => ({ text: d.text, result: decisionResult(m, d).passed ? 'Passed' : 'Not passed' })), notes: m.notes, approvedOn: m.approvedOn }));
}
export function nextMeetingId(list: Pick<Meeting, 'id'>[], year: number) {
  const n = list.filter((m) => m.id.startsWith(`MTG-${year}-`)).reduce((a, m) => Math.max(a, Number(m.id.split('-')[2])), 0) + 1;
  return `MTG-${year}-${String(n).padStart(3, '0')}`;
}

/* ---------------- demo meetings (fictional; 2026, today 10/15/2026) ---------------- */
const base = (p: Partial<Meeting> & Pick<Meeting, 'id' | 'body' | 'date'>): Meeting => ({
  center: '', zone: '', kind: 'regular', start: '19:30', place: '', remote: false, noticeSentAt: '', calledBy: '', seats: 5, present: 5, attendees: [], agenda: [],
  decisions: [], notes: '', actions: [], status: 'published', approvedOn: '', audience: 'members', recordedBy: 'Administrative Secretary', ...p,
});
const sw1Council = (n: number) => [
  { name: 'Imran Malik', role: 'Associate Director', present: true, remote: false },
  ...['Kamran Butt', 'Asma Latif', 'Tariq Noor', 'Nadia Farooq'].map((name, i) => ({ name, role: 'Area Representative', present: (n + i) % 5 !== 0, remote: false })),
  { name: 'Omar Siddiqui', role: 'Administrative Secretary', present: true, remote: false },
  { name: 'Faisal Haq', role: 'Finance Secretary', present: n % 3 === 0, remote: false },
  { name: 'Sana Mirza', role: 'Education Secretary', present: n % 2 === 0, remote: false },
  { name: 'Adeel Shah', role: 'Membership Secretary', present: n % 4 === 1, remote: false },
  { name: 'Zara Hussain', role: 'Youth Affairs Secretary', present: n === 9, remote: false },
];
const pad = (n: number) => String(n).padStart(2, '0');
let seq = 0;
const nid = () => `MTG-2026-${String(++seq).padStart(3, '0')}`;
export const mockMeetings: Meeting[] = [
  ...Array.from({ length: 9 }, (_, i) => i + 1).map((m) => {
    const att = sw1Council(m); const present = att.filter((a) => a.present && ['Associate Director', 'Area Representative'].includes(a.role)).length;
    return base({ id: nid(), body: 'council', center: 'Southwest Islamic Center 1', date: `2026-${pad(m)}-${pad(10 + (m % 5))}`, place: 'Southwest Islamic Center 1, conference room', calledBy: 'Imran Malik', seats: 5, present, attendees: att,
      agenda: ['Approve last month’s minutes', 'Finance report', m === 8 ? 'Weekend school budget' : 'Programs and facilities'],
      decisions: m === 8 ? [{ text: 'Approve the 2026–27 weekend school budget of $48,000.', votesFor: present - 1, against: 1, abstain: 0, needs: 'majority' }] : [{ text: 'Approve last month’s minutes.', votesFor: present, against: 0, abstain: 0, needs: 'majority' }],
      notes: m === 8 ? 'The Education Secretary presented the weekend school plan. The Council approved the budget.' : 'Routine monthly meeting.',
      status: m === 9 ? 'draft' : 'published', approvedOn: m === 9 ? '' : `2026-${pad(m + 1)}-12` });
  }),
  // North 1: July and August missed; one special remote meeting with short notice
  ...[1, 2, 3, 4, 5, 6, 9].map((m) => base({ id: nid(), body: 'council', center: 'North Islamic Center 1', date: `2026-${pad(m)}-08`, seats: 4, present: 3, calledBy: 'Rashid Alvi', attendees: [{ name: 'Rashid Alvi', role: 'Associate Director', present: true, remote: false }, { name: 'Waleed Anwar', role: 'Area Representative', present: true, remote: false }, { name: 'Sadia Rehman', role: 'Area Representative', present: true, remote: false }, { name: 'Junaid Akhtar', role: 'Administrative Secretary', present: true, remote: false }], status: m >= 6 ? 'draft' : 'published', approvedOn: m >= 6 ? '' : `2026-${pad(m + 1)}-08`, audience: 'leaders' })),
  base({ id: nid(), body: 'council', kind: 'special', center: 'North Islamic Center 1', date: '2026-09-20', start: '20:00', remote: true, noticeSentAt: '2026-09-19T14:00', calledBy: 'Rashid Alvi', seats: 4, present: 3, agenda: ['Roof repair after the storm'], decisions: [{ text: 'Approve emergency roof repair up to $12,000.', votesFor: 3, against: 0, abstain: 0, needs: 'majority' }], status: 'draft', audience: 'leaders' }),
  // Board: monthly, June missed
  ...[1, 2, 3, 4, 5, 7, 8, 9].map((m) => base({ id: nid(), body: 'board', date: `2026-${pad(m)}-${pad(3 + m)}`, start: '19:00', place: 'ISGH Headquarters, 3110 Eastside St', seats: 9, present: m === 4 ? 4 : 8, calledBy: 'President', recordedBy: 'General Secretary', audience: m % 2 ? 'members' : 'leaders', approvedOn: `2026-${pad(m + 1)}-05`,
    decisions: m === 4 ? [{ text: 'Approve the new parking lot contract.', votesFor: 4, against: 0, abstain: 0, needs: 'majority' }] : [{ text: 'Approve last month’s minutes.', votesFor: 8, against: 0, abstain: 0, needs: 'majority' }] })),
  ...[1, 3, 6, 9].map((m) => base({ id: nid(), body: 'exec-ad', date: `2026-${pad(m)}-18`, seats: 24, present: 17, place: 'ISGH Headquarters', recordedBy: 'General Secretary', audience: 'leaders', approvedOn: `2026-${pad(m + 1)}-20` })),
  base({ id: nid(), body: 'joint', kind: 'semi-annual', date: '2026-03-22', start: '10:00', seats: 120, present: 61, place: 'ISGH Headquarters', notes: 'The audited financial statements for 2025 were presented.', approvedOn: '2026-09-27', audience: 'public' }),
  base({ id: nid(), body: 'joint', kind: 'annual', date: '2026-09-27', start: '10:00', seats: 120, present: 47, place: 'ISGH Headquarters', notes: 'Annual update of the financial plan and the main center budget.', status: 'draft', audience: 'members' }),
  base({ id: nid(), body: 'general-assembly', kind: 'annual', date: '2026-09-27', start: '14:00', seats: 6800, present: 1910, noticeSentAt: '2026-09-10T09:00', place: 'ISGH Headquarters and online', notes: 'Annual progress report with a financial segment presented by the Board.', approvedOn: '2026-10-04', audience: 'public',
    decisions: [{ text: 'Accept the annual progress report.', votesFor: 1702, against: 41, abstain: 60, needs: 'majority' }] }),
];
