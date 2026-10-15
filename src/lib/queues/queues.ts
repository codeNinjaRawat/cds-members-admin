/**
 * A4 Work queues – DEMO cases built from the demo members (no API).
 * Live: GET /admin/queues/:queue?state=&assignee= · POST /admin/queues/:queue/:id/{decide|assign} (BE B3/B4/B6, scoped by role A10).
 */
import { ageOn, centerOf, centersOf, fmtDate, fmtMoney, fullName, PLANS, YEAR, ZONES, type Member, type ZoneId } from '@/lib/members/members';

export type QueueId = 'applications' | 'id' | 'center' | 'duplicates' | 'payments';
export const QUEUES: { id: QueueId; label: string; short: string; slaDays: number; intro: string }[] = [
  { id: 'applications', label: 'Applications', short: 'Applications', slaDays: 7, intro: 'New members waiting for review. Staff check each one, then the Board approves them together.' },
  { id: 'id', label: 'Photo ID checks', short: 'Photo ID', slaDays: 3, intro: 'Compare the photo ID with the application: name, date of birth and expiry.' },
  { id: 'center', label: 'Center changes', short: 'Center changes', slaDays: 14, intro: 'Members within 5 miles of a zone border may ask for a nearby Islamic Center. Approved changes stay for 5 years (Bylaws).' },
  { id: 'duplicates', label: 'Possible duplicates', short: 'Duplicates', slaDays: 7, intro: 'Two records that look like the same person. Merge them or mark them as different people.' },
  { id: 'payments', label: 'Payments to fix', short: 'Payments', slaDays: 3, intro: 'Declined cards, returned bank payments and pledged checks that have not arrived.' },
];
export const TODAY = '2026-10-13';
export const CENTER_REQUEST_DEADLINE = '2027-03-31';

export type Decision = { state: 'done' | 'ready' | 'needs-info'; outcome: string; note?: string; by: string; at: string };
export type QueueState = { decisions: Record<string, Decision>; assignee: Record<string, string> };

type Base = { id: string; queue: QueueId; memberId: string; submitted: string };
export type AppCase = Base & { queue: 'applications' };
export type IdCase = Base & { queue: 'id'; doc: 'Texas driver license' | 'Texas ID card' | 'US passport' | 'Permanent resident card'; nameOnId: string; dobOnId: string; expires: string };
export type CenterCase = Base & { queue: 'center'; toZone: ZoneId; toCenter: string; miles: number; reason: string };
export type DupCase = Base & { queue: 'duplicates'; other: { name: string; email: string; phone: string; dob: string; source: string; created: string }; reasons: string[]; score: number };
export type PayCase = Base & { queue: 'payments'; kind: 'card_declined' | 'bank_returned' | 'check_pending'; amountCents: number; detail: string; attempts: number };
export type Case = AppCase | IdCase | CenterCase | DupCase | PayCase;

function addDays(d: string, n: number) { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
export const daysWaiting = (c: Case) => Math.max(0, Math.round((Date.parse(TODAY) - Date.parse(c.submitted)) / 86400000));
export const sla = (c: Case) => { const d = daysWaiting(c); const t = QUEUES.find((q) => q.id === c.queue)!.slaDays; return { days: d, target: t, tone: d > t ? 'late' : d >= t - 1 ? 'due' : 'ok' } as const; };
const NEXT_ZONE: Record<ZoneId, ZoneId> = { n: 'nw', nw: 'sw', sw: 's', s: 'se', se: 'n' };

/** Deterministic demo cases (same on server and client). */
export function buildCases(members: Member[]): Case[] {
  const out: Case[] = [];
  const good = members.filter((m) => m.standing === 'good');
  // applications – everyone not yet approved
  good.filter((m) => !m.approvedOn).forEach((m) => out.push({ id: `app-${m.id}`, queue: 'applications', memberId: m.id, submitted: m.appliedOn }));
  // photo ID – not verified yet
  const docs: IdCase['doc'][] = ['Texas driver license', 'Texas ID card', 'US passport', 'Permanent resident card'];
  good.filter((m) => m.idCheck !== 'verified').forEach((m, i) => {
    const mismatchName = i % 7 === 3, mismatchDob = i % 9 === 5, expired = i % 8 === 6;
    out.push({ id: `id-${m.id}`, queue: 'id', memberId: m.id, submitted: addDays(TODAY, -[0, 1, 2, 4, 1, 3, 6, 2][i % 8]), doc: docs[i % 4],
      nameOnId: mismatchName ? `${m.first.replace(/a/, 'e')} ${m.last}` : `${m.first} ${m.last}`.toUpperCase(),
      dobOnId: mismatchDob ? addDays(m.dob, 365) : m.dob, expires: expired ? '2026-08-31' : `${2027 + (i % 6)}-0${1 + (i % 9)}-15` });
  });
  // center change requests – 7 approved members near a border
  const reasons = ['Our family prays there every Friday and the children attend its weekend school.', 'It is 6 minutes from home; our assigned center is 25 minutes away.', 'I volunteer there every week.', 'Moved inside the same ZIP; the new street is right at the bayou.', 'My parents are members there and we bring them.', 'The new center has the Quran program for my son.', 'Closer to work for Fajr and Isha.'];
  good.filter((m) => m.approvedOn && !m.centerOverride).filter((_, i) => i % 41 === 7).slice(0, 7).forEach((m, i) => {
    const toZone = NEXT_ZONE[m.zone];
    out.push({ id: `ctr-${m.id}`, queue: 'center', memberId: m.id, submitted: addDays(TODAY, -[2, 5, 11, 16, 1, 8, 20][i]), toZone, toCenter: centersOf(toZone)[i % 4], miles: [3.2, 1.4, 4.8, 6.3, 2.1, 5.0, 0.9][i], reason: reasons[i] });
  });
  // possible duplicates – 5 look-alike records (a second sign-up)
  good.filter((m) => m.approvedOn).filter((_, i) => i % 53 === 11).slice(0, 5).forEach((m, i) => {
    const variants = [
      { name: `${m.first} ${m.last}`, email: m.email.replace('@example.com', '@gmial.com'), phone: m.phone, dob: m.dob, reasons: ['Same mobile number', 'Same date of birth', 'Email differs by a typo'], score: 96 },
      { name: `${m.first.slice(0, -1)} ${m.last}`, email: `${m.first[0]}${m.last}@example.com`.toLowerCase(), phone: m.phone, dob: m.dob, reasons: ['Same mobile number', 'Same date of birth', 'Name spelled differently'], score: 91 },
      { name: `${m.first} ${m.last}`, email: `${m.first}.${m.last}.home@example.com`.toLowerCase(), phone: '(281) 555-0199', dob: m.dob, reasons: ['Same name', 'Same date of birth'], score: 78 },
      { name: `${m.first} ${m.last}`, email: `${m.last}.family@example.com`.toLowerCase(), phone: '(832) 555-0123', dob: addDays(m.dob, 9000), reasons: ['Same name', 'Same home address'], score: 52 },
      { name: `${m.first} ${m.last}`, email: m.email, phone: '(713) 555-0110', dob: m.dob, reasons: ['Same email', 'Same name', 'Same date of birth'], score: 99 },
    ][i];
    out.push({ id: `dup-${m.id}`, queue: 'duplicates', memberId: m.id, submitted: addDays(TODAY, -[1, 4, 8, 2, 10][i]),
      other: { name: variants.name, email: variants.email, phone: variants.phone, dob: variants.dob, source: i % 2 ? 'Paper form entered at the center' : 'Website sign-up', created: addDays(TODAY, -[1, 4, 8, 2, 10][i]) },
      reasons: variants.reasons, score: variants.score });
  });
  // payments to fix – members with no current-year dues
  const kinds: { kind: PayCase['kind']; detail: string }[] = [
    { kind: 'card_declined', detail: 'Card declined – not enough funds' }, { kind: 'card_declined', detail: 'Card expired (09/2026)' },
    { kind: 'bank_returned', detail: 'Bank payment returned – account closed' }, { kind: 'check_pending', detail: 'Pledged to pay by check at the center' },
    { kind: 'card_declined', detail: 'Card declined by the bank – member should call their bank' }, { kind: 'check_pending', detail: 'Check promised at Jumu’ah' },
    { kind: 'bank_returned', detail: 'Bank payment returned – not enough funds' }, { kind: 'card_declined', detail: 'Wrong security code (CVC)' },
  ];
  good.filter((m) => m.approvedOn && m.plan !== 'life' && !m.payments.some((p) => p.year === YEAR)).slice(0, 8).forEach((m, i) =>
    out.push({ id: `pay-${m.id}`, queue: 'payments', memberId: m.id, submitted: addDays(TODAY, -[0, 2, 5, 14, 1, 9, 3, 4][i]), amountCents: PLANS[m.plan].cents, attempts: 1 + (i % 3), ...kinds[i] }));
  return out;
}

/* ---------- rule checks shown with each case ---------- */
export type Rule = { label: string; ok: boolean | null; note: string }; // null = needs a human look
export function rulesFor(c: Case, m: Member): Rule[] {
  if (c.queue === 'applications') return [
    { label: 'Email verified', ok: true, note: 'Code confirmed at sign-up' },
    { label: 'Photo ID verified', ok: m.idCheck === 'verified', note: m.idCheck === 'verified' ? 'Checked' : 'Waiting in Photo ID checks' },
    { label: `18 or older on ${fmtDate(`${YEAR + 1}-06-30`)}`, ok: ageOn(m.dob, `${YEAR + 1}-06-30`) >= 18, note: `Born ${fmtDate(m.dob)}` },
    { label: 'Lives in Greater Houston', ok: true, note: `${ZONES[m.zone]} zone · ${centerOf(m)}` },
    { label: 'Pledge and commitment signed', ok: true, note: 'Signed on the join form' },
    { label: 'Not an existing or former member', ok: true, note: 'No match in duplicates' },
  ];
  if (c.queue === 'id') {
    const nameOk = c.nameOnId.toLowerCase() === fullName(m).toLowerCase();
    return [
      { label: 'Name matches the application', ok: nameOk, note: nameOk ? fullName(m) : `ID says “${c.nameOnId}”, application says “${fullName(m)}”` },
      { label: 'Date of birth matches', ok: c.dobOnId === m.dob, note: c.dobOnId === m.dob ? fmtDate(m.dob) : `ID ${fmtDate(c.dobOnId)} · application ${fmtDate(m.dob)}` },
      { label: 'ID has not expired', ok: c.expires >= TODAY, note: `Expires ${fmtDate(c.expires)}` },
      { label: 'Photo is clear and matches the selfie', ok: null, note: 'Look at both pictures' },
    ];
  }
  if (c.queue === 'center') return [
    { label: 'Within 5 miles of the zone border', ok: c.miles <= 5, note: `${c.miles.toFixed(1)} miles (map estimate)` },
    { label: `Asked before the deadline (${fmtDate(CENTER_REQUEST_DEADLINE)})`, ok: c.submitted <= CENTER_REQUEST_DEADLINE, note: `Asked ${fmtDate(c.submitted)}` },
    { label: 'Member in good standing', ok: m.standing === 'good', note: 'Approved member' },
    { label: 'No change in the last 5 years', ok: !m.centerOverride, note: m.centerOverride ? `Locked until ${fmtDate(m.centerOverride.lockedUntil ?? '')}` : 'First request' },
  ];
  if (c.queue === 'duplicates') return c.reasons.map((r) => ({ label: r, ok: null, note: '' }));
  return [
    { label: 'Amount due', ok: null, note: `${fmtMoney(c.amountCents)} · ${PLANS[m.plan].name} plan ${YEAR}` },
    { label: 'Attempts', ok: c.attempts < 3, note: `${c.attempts} of 3` },
    { label: 'Vote this year', ok: null, note: `Paying now renews membership; the ${YEAR} vote needed payment by ${fmtDate(`${YEAR}-06-30`)}` },
  ];
}

/* ---------- demo state (this browser) ---------- */
const KEY = 'isgh-admin-queues';
export const QUEUES_EVENT = 'isgh:queues';
export function readQueueState(): QueueState { try { return { decisions: {}, assignee: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { decisions: {}, assignee: {} }; } }
export function writeQueueState(s: QueueState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ } window.dispatchEvent(new Event(QUEUES_EVENT)); }
export const isOpen = (c: Case, s: QueueState) => s.decisions[c.id]?.state !== 'done';
