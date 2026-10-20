/**
 * A4 Work queues – cases built from the members (demo or the API's). Decisions and who took a case: demo = this browser,
 * live = GET/PUT /admin/queues/state (shared by the office); the member changes go through the members API.
 */
import { LIVE, be } from '@/lib/live/live';
import { notice, LABELS_EVENT, ORG_TZ, orgToday } from '@/lib/members/members';
import { ageOn, centerOf, centersOf, fmtDate, fmtMoney, fullName, PLANS, YEAR, ZONES, type Member, type ZoneId } from '@/lib/members/members';
import { routeQueueCase, type AdminLike, type QueueKey, type QueuesSettings } from '@/lib/community/work';
import { centerRulesInWords, DEFAULT_CENTER_RULES, type CenterRules } from '@/lib/community/org-structure';

export type QueueId = QueueKey;
export const QUEUES: { id: QueueId; label: string; short: string; slaDays: number; intro: string }[] = [
  { id: 'applications', label: 'Applications', short: 'Applications', slaDays: 7, intro: 'New members waiting for review. Staff check each one, then the Board approves them together.' },
  { id: 'id', label: 'Photo ID checks', short: 'Photo ID', slaDays: 3, intro: 'Compare the photo ID with the application: name, date of birth and expiry.' },
  { id: 'center', label: 'Center changes', short: 'Center changes', slaDays: 14, intro: 'Members within 5 miles of a zone border may ask for a nearby Islamic Center. Approved changes stay for 5 years (Bylaws).' },
  { id: 'duplicates', label: 'Possible duplicates', short: 'Duplicates', slaDays: 7, intro: 'Two records that look like the same person. Merge them or mark them as different people.' },
  { id: 'payments', label: 'Payments to fix', short: 'Payments', slaDays: 3, intro: 'Declined cards, returned bank payments and pledged checks that have not arrived.' },
  // D5 – the two follow-up queues the client asked for on the review call
  { id: 'incomplete', label: 'Incomplete applications', short: 'Incomplete', slaDays: 5, intro: 'People who verified their email, maybe typed a phone number, and left before finishing. A call or a text usually brings them back.' },
  { id: 'missing', label: 'Missing information', short: 'Missing info', slaDays: 30, intro: 'Members whose record lacks something the office needs – a phone, an address, a date of birth or a checked ID. Chase them now, not in election season.' },
];
/** D5 – targets and names come from Settings › Help desk and tasks › Work queues when set there. */
export function applyQueueSettings(q: QueuesSettings | undefined) {
  for (const x of QUEUES) { const r = q?.routing[x.id]; if (r) { x.slaDays = r.targetDays; if (r.label) x.label = r.label; } }
}
/** Demo: a fixed day (the sample cases are dated around it). Live: today in the organization's clock. */
export let TODAY = LIVE ? new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ }) : '2026-10-13';
// the organization's clock arrives with its settings (loadOrgLabels → LABELS_EVENT)
if (typeof window !== 'undefined') window.addEventListener(LABELS_EVENT, () => { if (LIVE) TODAY = orgToday(); });
/** D14 – the center-change rules (Masjids and zones › Rules); applyCenterRules() loads the organization's. */
export let CENTER_RULES = DEFAULT_CENTER_RULES;
export function applyCenterRules(r: CenterRules | undefined) { if (r) CENTER_RULES = r; const q = QUEUES.find((x) => x.id === 'center'); if (q) q.intro = centerRulesInWords(CENTER_RULES); }
export const centerDeadline = (year = YEAR + 1) => (CENTER_RULES.requestDeadline ? `${year}-${CENTER_RULES.requestDeadline}` : '');
export const CENTER_REQUEST_DEADLINE = '2027-03-31';

export type Decision = { state: 'done' | 'ready' | 'needs-info'; outcome: string; note?: string; by: string; at: string };
export type QueueState = { decisions: Record<string, Decision>; assignee: Record<string, string> };

type Base = { id: string; queue: QueueId; memberId: string; submitted: string };
export type AppCase = Base & { queue: 'applications' };
export type IdCase = Base & { queue: 'id'; doc: 'Texas driver license' | 'Texas ID card' | 'US passport' | 'Permanent resident card'; nameOnId: string; dobOnId: string; expires: string };
export type CenterCase = Base & { queue: 'center'; toZone: ZoneId; toCenter: string; miles: number; reason: string };
export type DupCase = Base & { queue: 'duplicates'; other: { name: string; email: string; phone: string; dob: string; source: string; created: string }; reasons: string[]; score: number };
export type PayCase = Base & { queue: 'payments'; kind: 'card_declined' | 'bank_returned' | 'check_pending'; amountCents: number; detail: string; attempts: number };
export type IncompleteCase = Base & { queue: 'incomplete'; stepReached: 'About you' | 'Plan' | 'Pledge' | 'Review and pay'; lastSeen: string; reminders: number; hasPhone: boolean };
export type MissingFieldKey = 'phone' | 'address' | 'dob' | 'id' | 'email';
export type MissingCase = Base & { queue: 'missing'; fields: MissingFieldKey[]; lastAsked: string };
export type Case = AppCase | IdCase | CenterCase | DupCase | PayCase | IncompleteCase | MissingCase;
export const MISSING_LABEL: Record<MissingFieldKey, string> = { phone: 'Mobile number', address: 'Home address', dob: 'Date of birth', id: 'Photo ID check', email: 'Email address' };

function addDays(d: string, n: number) { const t = new Date(`${(d ?? '').slice(0, 10)}T12:00:00Z`); if (Number.isNaN(t.getTime())) return d ?? ''; t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }   // empty / bad date (e.g. no birth date on file): unchanged, never a crash
export const daysWaiting = (c: Case) => Math.max(0, Math.round((Date.parse(TODAY) - Date.parse(c.submitted)) / 86400000));
export const sla = (c: Case) => { const d = daysWaiting(c); const t = QUEUES.find((q) => q.id === c.queue)!.slaDays; return { days: d, target: t, tone: d > t ? 'late' : d >= t - 1 ? 'due' : 'ok' } as const; };
const NEXT_ZONE: Record<ZoneId, ZoneId> = { n: 'nw', nw: 'sw', sw: 's', s: 'se', se: 'n' };

/** Deterministic demo cases (same on server and client). */
export function buildCases(members: Member[], opts: { followUps?: QueuesSettings['followUps'] } = {}): Case[] {
  const out: Case[] = [];
  const good = members.filter((m) => m.standing === 'good');
  const fu = opts.followUps ?? { incomplete: { enabled: true, afterHours: 24, giveUpDays: 30 }, missing: { enabled: true, fields: ['phone', 'address', 'dob', 'id'] as MissingFieldKey[] } };
  // incomplete applications – people who verified their email and stopped (demo: every 13th pending record); they are not in Applications yet
  const pending = good.filter((m) => !m.approvedOn);
  const stopped = new Set<string>();
  if (fu.incomplete.enabled) pending.filter((_, i) => i % 4 === 2).slice(0, 6).forEach((m, i) => {
    stopped.add(m.id);
    const steps: IncompleteCase['stepReached'][] = ['About you', 'Plan', 'Review and pay', 'Pledge', 'About you', 'Plan'];
    out.push({ id: `inc-${m.id}`, queue: 'incomplete', memberId: m.id, submitted: addDays(TODAY, -[1, 2, 4, 9, 13, 27][i]), stepReached: steps[i], lastSeen: addDays(TODAY, -[1, 2, 4, 9, 13, 27][i]), reminders: [0, 0, 1, 1, 2, 2][i], hasPhone: i % 3 !== 2 });
  });
  // applications – everyone not yet approved (and not stopped half-way)
  pending.filter((m) => !stopped.has(m.id)).forEach((m) => out.push({ id: `app-${m.id}`, queue: 'applications', memberId: m.id, submitted: m.appliedOn }));
  // missing information – approved members whose record lacks what the office asks for (demo: a deterministic sample with the gaps the setting lists)
  if (fu.missing.enabled && fu.missing.fields.length) good.filter((m) => m.approvedOn).filter((_, i) => i % 61 === 17).slice(0, 7).forEach((m, i) => {
    const want = fu.missing.fields as MissingFieldKey[];
    const real = want.filter((f) => (f === 'phone' && !m.phone) || (f === 'address' && !m.street) || (f === 'dob' && !m.dob) || (f === 'email' && !m.email) || (f === 'id' && m.idCheck !== 'verified'));
    const fields = real.length ? real : [want[i % want.length], ...(i % 2 ? [want[(i + 1) % want.length]] : [])].filter((f, k, a) => a.indexOf(f) === k);
    out.push({ id: `mis-${m.id}`, queue: 'missing', memberId: m.id, submitted: addDays(TODAY, -[3, 12, 20, 33, 41, 6, 15][i]), fields, lastAsked: i % 3 === 0 ? addDays(TODAY, -[3, 12, 20, 33, 41, 6, 15][i]) : '' });
  });
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

/** Live data: only real work, nothing invented. Applications = applied and waiting; Not finished = people who never
 *  completed (e.g. imported contacts with no membership, never verified); Photo ID = applicants not checked yet;
 *  Missing information = members whose record really lacks a phone, address, birth date or email. Centre changes,
 *  duplicates and failed payments come from the API once those requests exist – never made up. */
export function buildLiveCases(members: Member[], opts: { followUps?: QueuesSettings['followUps'] } = {}): Case[] {
  const out: Case[] = [];
  const good = members.filter((m) => m.standing === 'good' && !m.archived);
  const fu = opts.followUps ?? { incomplete: { enabled: true, afterHours: 24, giveUpDays: 30 }, missing: { enabled: true, fields: ['phone', 'address', 'dob', 'email'] as MissingFieldKey[] } };
  const day = (s?: string | null) => String(s ?? '').slice(0, 10) || TODAY;
  // possible duplicates: an applicant whose email, mobile number, or name + birth date is already on another record
  const digits = (p: string) => p.replace(/\D/g, '').slice(-10);
  const nameDob = (x: Member) => (x.dob && !x.dob.startsWith('1900') ? `${x.first.trim().toLowerCase()} ${x.last.trim().toLowerCase()}|${x.dob.slice(0, 10)}` : '');
  const index = new Map<string, Member[]>();
  const add = (k: string, x: Member) => { if (!k) return; const l = index.get(k); if (l) l.push(x); else index.set(k, [x]); };
  for (const x of members) if (!x.archived) { add(x.email ? `e:${x.email.trim().toLowerCase()}` : '', x); add(digits(x.phone ?? '').length === 10 ? `p:${digits(x.phone)}` : '', x); add(nameDob(x) ? `n:${nameDob(x)}` : '', x); }
  for (const m of good.filter((x) => !x.approvedOn)) {
    if (m.joinStage === 'incomplete') { if (fu.incomplete.enabled) out.push({ id: `inc-${m.id}`, queue: 'incomplete', memberId: m.id, submitted: day(m.appliedOn), stepReached: 'About you', lastSeen: day(m.appliedOn), reminders: 0, hasPhone: !!m.phone }); continue; }
    out.push({ id: `app-${m.id}`, queue: 'applications', memberId: m.id, submitted: day(m.appliedOn) });
    const hits = new Map<string, { o: Member; why: string[] }>();
    const look = (k: string, why: string) => { for (const o of index.get(k) ?? []) if (o.id !== m.id) { const h = hits.get(o.id) ?? { o, why: [] }; h.why.push(why); hits.set(o.id, h); } };
    if (m.email) look(`e:${m.email.trim().toLowerCase()}`, 'Same email address');
    if (digits(m.phone ?? '').length === 10) look(`p:${digits(m.phone)}`, 'Same mobile number');
    if (nameDob(m)) look(`n:${nameDob(m)}`, 'Same name and date of birth');
    for (const { o, why } of hits.values()) out.push({ id: `dup-${m.id}-${o.id}`, queue: 'duplicates', memberId: m.id, submitted: day(m.appliedOn),
      other: { name: `${o.first} ${o.last} (${o.id})`, email: o.email, phone: o.phone, dob: o.dob, source: o.source === 'import' ? 'imported record' : o.approvedOn ? 'member' : 'another application', created: day(o.approvedOn ?? o.appliedOn) },
      reasons: why, score: Math.min(100, why.length * 40 + (why.includes('Same name and date of birth') ? 20 : 0)) });
    if (m.idCheck !== 'verified') out.push({ id: `id-${m.id}`, queue: 'id', memberId: m.id, submitted: day(m.appliedOn), doc: 'Texas driver license', nameOnId: '', dobOnId: '', expires: '' });
  }
  if (fu.missing.enabled && fu.missing.fields.length) for (const m of good.filter((x) => x.approvedOn)) {
    const fields = (fu.missing.fields as MissingFieldKey[]).filter((f) => (f === 'phone' && !m.phone) || (f === 'address' && !m.street) || (f === 'dob' && (!m.dob || m.dob.startsWith('1900'))) || (f === 'email' && !m.email));
    if (fields.length) out.push({ id: `mis-${m.id}`, queue: 'missing', memberId: m.id, submitted: day(m.approvedOn), fields, lastAsked: '' });
  }
  return out;
}

/* ---------- rule checks shown with each case ---------- */
export type Rule = { label: string; ok: boolean | null; note: string }; // null = needs a human look
/** open duplicate cases per applicant (set by the view from the current cases) */
let dupCount: (memberId: string) => number = () => 0;
export function setDuplicateCounter(f: (memberId: string) => number) { dupCount = f; }
export function rulesFor(c: Case, m: Member): Rule[] {
  if (c.queue === 'applications') return [
    { label: 'Email verified', ok: true, note: 'Code confirmed at sign-up' },
    { label: 'Photo ID verified', ok: m.idCheck === 'verified', note: m.idCheck === 'verified' ? 'Checked' : 'Waiting in Photo ID checks' },
    { label: `18 or older on ${fmtDate(`${YEAR + 1}-06-30`)}`, ok: ageOn(m.dob, `${YEAR + 1}-06-30`) >= 18, note: `Born ${fmtDate(m.dob)}` },
    { label: 'Lives in the service area', ok: !!ZONES[m.zone], note: ZONES[m.zone] ? `${ZONES[m.zone]} zone · ${centerOf(m)}` : `${[m.city, m.state].filter(Boolean).join(', ') || 'No address'} – outside every zone (can join, cannot vote)` },
    { label: 'Pledge and commitment signed', ok: m.commitment ? true : null, note: m.commitment ? 'Signed on the join form' : 'Not on the record – ask before approval' },
    { label: 'Not an existing or former member', ok: dupCount(m.id) ? false : true, note: dupCount(m.id) ? `${dupCount(m.id)} possible match${dupCount(m.id) > 1 ? 'es' : ''} – see Possible duplicates` : 'No other record with this email, mobile number, or name and birth date' },
  ];
  if (c.queue === 'id') {
    if (!c.nameOnId) return [{ label: 'Photo ID on file', ok: false, note: 'No ID document uploaded yet – ask the applicant to upload one or bring it to the center.' }, { label: 'Photo is clear and matches the person', ok: null, note: 'Check once the ID is here' }];
    const nameOk = c.nameOnId.toLowerCase() === fullName(m).toLowerCase();
    return [
      { label: 'Name matches the application', ok: nameOk, note: nameOk ? fullName(m) : `ID says “${c.nameOnId}”, application says “${fullName(m)}”` },
      { label: 'Date of birth matches', ok: c.dobOnId === m.dob, note: c.dobOnId === m.dob ? fmtDate(m.dob) : `ID ${fmtDate(c.dobOnId)} · application ${fmtDate(m.dob)}` },
      { label: 'ID has not expired', ok: c.expires >= TODAY, note: `Expires ${fmtDate(c.expires)}` },
      { label: 'Photo is clear and matches the selfie', ok: null, note: 'Look at both pictures' },
    ];
  }
  if (c.queue === 'center') { const r = CENTER_RULES; const dl = centerDeadline(); return [
    ...(r.borderChoice !== 'none' ? [{ label: `Within ${r.borderMiles} miles of the zone border`, ok: c.miles <= r.borderMiles, note: `${c.miles.toFixed(1)} miles (map estimate)` }] : []),
    ...(dl ? [{ label: `Asked before the deadline (${fmtDate(dl)})`, ok: c.submitted <= dl, note: `Asked ${fmtDate(c.submitted)}` }] : []),
    { label: 'Member in good standing', ok: m.standing === 'good', note: 'Approved member' },
    ...(r.lockYears ? [{ label: `No change in the last ${r.lockYears} years`, ok: !m.centerOverride || !m.centerOverride.lockedUntil || m.centerOverride.lockedUntil < TODAY, note: m.centerOverride?.lockedUntil ? `Locked until ${fmtDate(m.centerOverride.lockedUntil)}${r.unlockOnMove ? ' – unless they moved' : ''}` : 'First request' }] : []),
    ...(r.needsProof ? [{ label: 'Proof of address seen', ok: null, note: 'A license, bill or lease with the address – required by the rules' }] : []),
  ]; }
  if (c.queue === 'duplicates') return c.reasons.map((r) => ({ label: r, ok: null, note: '' }));
  if (c.queue === 'incomplete') return [
    { label: 'Email verified', ok: true, note: 'Code confirmed at sign-up' },
    { label: 'Reached', ok: null, note: `Stopped at “${c.stepReached}” · last seen ${fmtDate(c.lastSeen)}` },
    { label: 'A way to reach them', ok: c.hasPhone, note: c.hasPhone ? `${m.phone} · ${m.email}` : `Email only (${m.email}) – no phone yet` },
    { label: 'Reminders sent', ok: c.reminders < 3 ? null : false, note: c.reminders ? `${c.reminders} automatic reminder${c.reminders > 1 ? 's' : ''}` : 'None yet' },
  ];
  if (c.queue === 'missing') return [
    ...c.fields.map((f) => ({ label: MISSING_LABEL[f], ok: false as const, note: f === 'id' ? 'No checked ID on file' : 'Not on the record' })),
    { label: 'Asked before', ok: null, note: c.lastAsked ? `Asked ${fmtDate(c.lastAsked)}` : 'Not asked yet' },
  ];
  return [
    { label: 'Amount due', ok: null, note: `${fmtMoney(c.amountCents)} · ${PLANS[m.plan].name} plan ${YEAR}` },
    { label: 'Attempts', ok: c.attempts < 3, note: `${c.attempts} of 3` },
    { label: 'Vote this year', ok: null, note: `Paying now renews membership; the ${YEAR} vote needed payment by ${fmtDate(`${YEAR}-06-30`)}` },
  ];
}

/* ---------- decisions and who took a case: demo = this browser, live = shared by the office (GET/PUT /admin/queues/state) ---------- */
const KEY = 'isgh-admin-queues';
export const QUEUES_EVENT = 'isgh:queues';
let me = 'Mohammad (demo)';
/** Who is working the queue (demo: a sample name; live: the signed-in admin's id). */
export const queueMe = () => me;
export const setQueueMe = (id: string) => { me = id; };
let live: QueueState | null = null; let liveLoading: Promise<void> | null = null;
export function loadLiveQueueState(force = false): Promise<void> {
  if (!force && live) return Promise.resolve();
  if (!force && liveLoading) return liveLoading;
  liveLoading = be<QueueState>('GET', 'admin/queues/state').then((r) => { liveLoading = null; live = r.ok ? { decisions: r.data.decisions ?? {}, assignee: r.data.assignee ?? {} } : live ?? { decisions: {}, assignee: {} }; window.dispatchEvent(new Event(QUEUES_EVENT)); });
  return liveLoading;
}
export function readQueueState(): QueueState {
  if (LIVE) { if (typeof window !== 'undefined' && !live) void loadLiveQueueState(); return structuredClone(live ?? { decisions: {}, assignee: {} }); }
  try { return { decisions: {}, assignee: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { decisions: {}, assignee: {} }; }
}
export function writeQueueState(s: QueueState) {
  if (LIVE) {
    const before = live ?? { decisions: {}, assignee: {} }; live = structuredClone(s); window.dispatchEvent(new Event(QUEUES_EVENT));
    const ids = new Set([...Object.keys(before.decisions), ...Object.keys(s.decisions), ...Object.keys(before.assignee), ...Object.keys(s.assignee)]);
    void (async () => {
      for (const id of ids) {
        const body: Record<string, unknown> = {};
        if (JSON.stringify(before.decisions[id] ?? null) !== JSON.stringify(s.decisions[id] ?? null)) body.decision = s.decisions[id] ?? null;
        if ((before.assignee[id] ?? '') !== (s.assignee[id] ?? '')) body.assignee = s.assignee[id] ?? '';
        if (Object.keys(body).length) { const r = await be('PUT', `admin/queues/state/${encodeURIComponent(id)}`, body); if (!r.ok) notice(`Queue: ${r.message}`); }
      }
      await loadLiveQueueState(true);
    })();
    return;
  }
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ } window.dispatchEvent(new Event(QUEUES_EVENT));
}
export const isOpen = (c: Case, s: QueueState) => s.decisions[c.id]?.state !== 'done';

/* ---------- D5 – who a case is on by default, and escalation ---------- */
/** The person the case is on: taken by hand (state), else the routing rule for its queue at the member's masjid. */
export function assigneeOf(c: Case, s: QueueState, q: QueuesSettings | undefined, admins: AdminLike[], center = ''): { id: string; byRule: boolean } {
  const taken = s.assignee[c.id]; if (taken) return { id: taken, byRule: false };
  return { id: routeQueueCase(q?.routing[c.queue], center, admins, c.id), byRule: true };
}
/** Past its target and the queue names a role to tell → escalated to that role. */
export function escalation(c: Case, s: QueueState, q: QueuesSettings | undefined): string {
  if (!isOpen(c, s) || sla(c).tone !== 'late') return '';
  return q?.routing[c.queue]?.escalateTo ?? '';
}
/** D5 reporting – decided cases: days from arrival to decision, per person. */
export function throughput(cases: Case[], s: QueueState) {
  const rows = new Map<string, { by: string; decided: number; days: number[]; late: number }>();
  for (const c of cases) {
    const d = s.decisions[c.id]; if (!d || d.state !== 'done') continue;
    const by = d.by || 'Unassigned'; const r = rows.get(by) ?? { by, decided: 0, days: [], late: 0 }; rows.set(by, r);
    const took = Math.max(0, Math.round((Date.parse(d.at.slice(0, 10)) - Date.parse(c.submitted)) / 86400000));
    r.decided += 1; r.days.push(took); if (took > (QUEUES.find((q) => q.id === c.queue)?.slaDays ?? 7)) r.late += 1;
  }
  return [...rows.values()].map((r) => ({ by: r.by, decided: r.decided, late: r.late, avgDays: r.days.length ? Math.round((r.days.reduce((a, b) => a + b, 0) / r.days.length) * 10) / 10 : 0 })).sort((a, b) => b.decided - a.decided);
}
