/**
 * F2 Zakat and Sadaqah – assistance cases from application to payout.
 * Flow (ISGH formal presentation, mirrored in the owner's Figma prototype):
 *   1 Intake (website, app, in person) → 2 routed to a zone and center by ZIP (F1 map) → 3 verification by the Local
 *   Zakat Coordinator (documents, income, hardship, home visit) and the decision Zakat / Sadaqah / not eligible →
 *   4 approvals in levels (L1 coordinator, L2 Central Committee Member, L3 Committee Chair; each up to its limit; the
 *   Chair can fast-track or approve above every limit) → 5 payout by the Zakat Operations Office → done.
 * Separation of duties: one person approves a case once, and whoever approves does not pay it out.
 * DEMO (no API). Live: /admin/zakat/cases… – the BE runs these same functions before saving.
 * Synced to the admin by admin/scripts/sync-contracts.mjs – edit here (web), never in the admin copy.
 */
import { z } from 'zod';

/* ---------------- settings (published document `zakat-settings`) ---------------- */
const CENTS = z.number().int().min(0).max(10_000_000);
export const ZakatSettingsSchema = z.object({
  levels: z.object({ 1: CENTS, 2: CENTS, 3: CENTS }),                 // approval limit per level
  maxRequestCents: z.object({ regular: CENTS, emergency: CENTS }),     // largest amount someone may ask for
  hours: z.object({ regular: z.number().int().min(1).max(240), emergency: z.number().int().min(1).max(72) }), // time per step
  recurringMaxMonths: z.number().int().min(1).max(12),
  sadaqah: z.object({ routing: z.boolean(), autoApproveUnderCents: CENTS }), // 0 = always goes through the levels
  homeVisitAboveCents: CENTS,                                         // a home visit is required above this amount (0 = always)
  channels: z.object({ website: z.boolean(), app: z.boolean(), inPerson: z.boolean() }),
}).superRefine((s, ctx) => {
  if (!(s.levels[1] < s.levels[2] && s.levels[2] < s.levels[3])) ctx.addIssue({ code: 'custom', path: ['levels'], message: 'Each level must allow more than the level before it.' });
  if (s.hours.emergency > s.hours.regular) ctx.addIssue({ code: 'custom', path: ['hours', 'emergency'], message: 'Emergency cases must be answered faster than regular ones.' });
  if (!s.channels.website && !s.channels.app && !s.channels.inPerson) ctx.addIssue({ code: 'custom', path: ['channels'], message: 'Keep at least one way to apply.' });
  if (s.sadaqah.autoApproveUnderCents > s.levels[1]) ctx.addIssue({ code: 'custom', path: ['sadaqah', 'autoApproveUnderCents'], message: 'Sadaqah fast approval cannot be above the Level 1 limit.' });
});
export type ZakatSettings = z.infer<typeof ZakatSettingsSchema>;
export const mockZakatSettings: ZakatSettings = {
  levels: { 1: 40_000, 2: 75_000, 3: 100_000 },
  maxRequestCents: { regular: 500_000, emergency: 500_000 },
  hours: { regular: 24, emergency: 12 },
  recurringMaxMonths: 6,
  sadaqah: { routing: true, autoApproveUnderCents: 0 },
  homeVisitAboveCents: 100_000,
  channels: { website: true, app: true, inPerson: true },
};

/* ---------------- cases ---------------- */
export const CATEGORIES = { rent: 'Rent or housing', utilities: 'Utilities', food: 'Food', medical: 'Medical', education: 'Education', debt: 'Debt', travel: 'Stranded traveler', other: 'Other' } as const;
export type Category = keyof typeof CATEGORIES;
export const STATUS = {
  new: 'New', verifying: 'Being verified', 'info-requested': 'Waiting for the applicant', 'awaiting-approval': 'Waiting for approval',
  approved: 'Approved – to pay', paid: 'Paid', rejected: 'Not approved',
} as const;
export type CaseStatus = keyof typeof STATUS;
export type Level = 1 | 2 | 3;

export const CaseSchema = z.object({
  id: z.string().regex(/^ZKT-\d{4}-\d{3,5}$/),
  createdAt: z.string(),                                     // ISO date-time
  channel: z.enum(['website', 'app', 'in-person']),
  urgent: z.boolean(),
  applicant: z.object({
    name: z.string().trim().min(2).max(80), phone: z.string().max(20).default(''), email: z.string().max(120).default(''),
    zip: z.string().regex(/^\d{5}$/, 'A ZIP code has 5 digits.'), household: z.number().int().min(1).max(20),
    monthlyIncomeCents: CENTS, memberId: z.string().optional(),
  }),
  category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
  reason: z.string().trim().min(10, 'Tell us in a sentence or two what the help is for.').max(2000),
  requestedCents: z.number().int().min(100, 'Enter the amount needed.'),
  months: z.number().int().min(1).max(12).default(1),        // recurring help: paid once a month
  zone: z.string().default(''), center: z.string().default(''),
  coordinator: z.string().default(''),                       // admin id assigned at the center
  status: z.enum(Object.keys(STATUS) as [CaseStatus, ...CaseStatus[]]),
  stepSince: z.string(),                                     // when the current step started (for the response time)
  fund: z.enum(['', 'zakat', 'sadaqah']).default(''),
  checks: z.object({ documents: z.boolean(), income: z.boolean(), hardship: z.boolean() }).default({ documents: false, income: false, hardship: false }),
  homeVisit: z.object({ on: z.string(), by: z.string(), note: z.string() }).nullable().default(null),
  approvals: z.array(z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]), by: z.string(), byName: z.string(), at: z.string(), decision: z.enum(['approve', 'reject', 'return']), amountCents: z.number().int().min(0).optional(), note: z.string().default(''), override: z.boolean().default(false) })).default([]),
  payouts: z.array(z.object({ at: z.string(), by: z.string(), byName: z.string(), amountCents: z.number().int().min(1), method: z.enum(['transfer', 'check', 'cash']), ref: z.string().default('') })).default([]),
  notes: z.array(z.object({ at: z.string(), byName: z.string(), text: z.string() })).default([]),
});
export type ZakatCase = z.infer<typeof CaseSchema>;
export type Actor = { id: string; name: string; level: number; can: (p: string) => boolean };

/* ---------------- rules ---------------- */
/** The level whose limit covers the amount; 4 = above every limit (needs the Chair's override). */
export const levelFor = (cents: number, s: ZakatSettings): 1 | 2 | 3 | 4 => (cents <= s.levels[1] ? 1 : cents <= s.levels[2] ? 2 : cents <= s.levels[3] ? 3 : 4);
/** Approvals since the case was last sent back. */
export function liveApprovals(c: ZakatCase) {
  const lastBack = c.approvals.map((a) => a.decision).lastIndexOf('return');
  return c.approvals.slice(lastBack + 1).filter((a) => a.decision === 'approve');
}
/** Amount per payment (the last approver may lower it). */
export const amountOf = (c: ZakatCase) => { const l = liveApprovals(c); return l.length ? (l[l.length - 1].amountCents ?? c.requestedCents) : c.requestedCents; };
/** Total the case pays (monthly help counts every month) – the approval limits apply to this total. */
export const totalOf = (c: ZakatCase) => amountOf(c) * c.months;
/** Which level must approve next (null = nothing to approve). */
export function nextLevel(c: ZakatCase, s: ZakatSettings): Level | null {
  if (c.status !== 'awaiting-approval') return null;
  const done = liveApprovals(c);
  const top = done.reduce((m, a) => Math.max(m, a.level), 0);
  return top >= 3 ? 3 : ((top + 1) as Level);                        // above level 3 the Chair approves with override
}
/** Is the case fully approved after these approvals? */
export function isFinal(c: ZakatCase, s: ZakatSettings): boolean {
  const done = liveApprovals(c);
  if (!done.length) return false;
  if (done.some((a) => a.override)) return true;
  const total = totalOf(c);
  if (c.fund === 'sadaqah' && s.sadaqah.autoApproveUnderCents > 0 && total <= s.sadaqah.autoApproveUnderCents) return true;
  const top = done.reduce((m, a) => Math.max(m, a.level), 0);
  const need = levelFor(total, s);
  return need <= 3 && top >= need;
}
const hoursFor = (c: ZakatCase, s: ZakatSettings) => (c.urgent ? s.hours.emergency : s.hours.regular);
export const dueAt = (c: ZakatCase, s: ZakatSettings) => new Date(Date.parse(c.stepSince) + hoursFor(c, s) * 3_600_000).toISOString();
export const isOverdue = (c: ZakatCase, s: ZakatSettings, now: string) => ['new', 'verifying', 'awaiting-approval', 'approved'].includes(c.status) && now > dueAt(c, s);
export const paidCents = (c: ZakatCase) => c.payouts.reduce((t, p) => t + p.amountCents, 0);

/** Problems with a new application (intake). */
export function intakeProblems(c: ZakatCase, s: ZakatSettings): string[] {
  const out: string[] = [];
  const r = CaseSchema.safeParse(c);
  if (!r.success) out.push(...r.error.issues.map((i) => i.message));
  const max = c.urgent ? s.maxRequestCents.emergency : s.maxRequestCents.regular;
  if (c.requestedCents * c.months > max) out.push(`The most anyone can ask for is ${usd(max)}${c.months > 1 ? ' in total' : ''}.`);
  if (c.months > s.recurringMaxMonths) out.push(`Monthly help can run at most ${s.recurringMaxMonths} months.`);
  const ch = c.channel === 'in-person' ? 'inPerson' : c.channel;
  if (!s.channels[ch]) out.push('That way of applying is switched off in Zakat settings.');
  return out;
}

export type Action = 'verify' | 'request-info' | 'approve' | 'reject' | 'return' | 'override' | 'pay';
/** What this person may do on this case now (the buttons shown, and what the BE allows). */
export function actionsFor(c: ZakatCase, a: Actor, s: ZakatSettings): Action[] {
  const out: Action[] = [];
  const iApproved = c.approvals.some((x) => x.by === a.id && x.decision === 'approve');   // ever (for payouts)
  const iApprovedNow = liveApprovals(c).some((x) => x.by === a.id);                          // since the case was last sent back
  if (['new', 'verifying', 'info-requested'].includes(c.status) && a.can('zakat.verify')) out.push('verify', 'request-info');
  if (c.status === 'awaiting-approval' && !iApprovedNow) {
    const need = nextLevel(c, s);
    if (need && a.can('zakat.approve') && a.level === need) out.push('approve', 'return', 'reject');
    if (a.can('zakat.override')) { out.push('override'); if (!out.includes('reject')) out.push('reject'); }
  }
  if (c.status === 'approved' && a.can('zakat.disburse') && !iApproved) out.push('pay');
  return Array.from(new Set(out));
}

/** Why someone cannot act (shown instead of a missing button). */
export function blockedReason(c: ZakatCase, a: Actor, s: ZakatSettings): string | null {
  if (c.status === 'awaiting-approval') {
    if (liveApprovals(c).some((x) => x.by === a.id)) return 'You already approved this case – another person approves the next step.';
    const need = nextLevel(c, s);
    if (a.can('zakat.approve') && need && a.level !== need) return `This case is waiting for a Level ${need} approver.`;
  }
  if (c.status === 'approved' && a.can('zakat.disburse') && c.approvals.some((x) => x.by === a.id && x.decision === 'approve')) return 'You approved this case, so someone else pays it out.';
  return null;
}

/* ---------------- state changes (pure: return the new case) ---------------- */
const stamp = (c: ZakatCase, status: CaseStatus, now: string): ZakatCase => ({ ...c, status, stepSince: now });
export function decideEligibility(c: ZakatCase, fund: 'zakat' | 'sadaqah' | 'none', s: ZakatSettings, now: string, by: string): ZakatCase {
  if (fund === 'none') return { ...stamp(c, 'rejected', now), fund: '', notes: [...c.notes, { at: now, byName: by, text: 'Not eligible for Zakat or Sadaqah.' }] };
  if (fund === 'sadaqah' && !s.sadaqah.routing) throw new Error('Sadaqah routing is switched off.');
  return { ...stamp(c, 'awaiting-approval', now), fund };
}
export function verifyProblems(c: ZakatCase, s: ZakatSettings): string[] {
  const out: string[] = [];
  if (!c.checks.documents) out.push('Check the documents.');
  if (!c.checks.income) out.push('Check the income.');
  if (!c.checks.hardship) out.push('Confirm the hardship.');
  if (c.requestedCents * c.months > s.homeVisitAboveCents && !c.homeVisit) out.push(`A home visit is needed above ${usd(s.homeVisitAboveCents)}.`);
  return out;
}
export function approve(c: ZakatCase, a: Actor, s: ZakatSettings, now: string, amountCents: number, note: string, override = false): ZakatCase {
  if (!actionsFor(c, a, s).includes(override ? 'override' : 'approve')) throw new Error('You cannot approve this case now.');
  if (amountCents < 100 || amountCents > c.requestedCents) throw new Error('The approved amount must be between $1 and the amount asked for.');
  const level = (override ? 3 : a.level) as Level;
  const next = { ...c, approvals: [...c.approvals, { level, by: a.id, byName: a.name, at: now, decision: 'approve' as const, amountCents, note, override }] };
  return isFinal(next, s) ? stamp(next, 'approved', now) : { ...next, stepSince: now };
}
export function decline(c: ZakatCase, a: Actor, s: ZakatSettings, now: string, kind: 'reject' | 'return', note: string): ZakatCase {
  if (!actionsFor(c, a, s).includes(kind)) throw new Error('You cannot do that on this case now.');
  if (note.trim().length < 5) throw new Error('Give a short reason – it goes in the case history.');
  const entry = { level: (nextLevel(c, s) ?? 3) as Level, by: a.id, byName: a.name, at: now, decision: kind, note, override: false };
  return kind === 'reject' ? { ...stamp(c, 'rejected', now), approvals: [...c.approvals, entry] } : { ...stamp(c, 'verifying', now), approvals: [...c.approvals, entry] };
}
export function pay(c: ZakatCase, a: Actor, s: ZakatSettings, now: string, method: 'transfer' | 'check' | 'cash', ref: string): ZakatCase {
  if (!actionsFor(c, a, s).includes('pay')) throw new Error('You cannot pay out this case.');
  if (method !== 'cash' && ref.trim().length < 3) throw new Error('Add the transfer or check number.');
  const per = amountOf(c);
  const next = { ...c, payouts: [...c.payouts, { at: now, by: a.id, byName: a.name, amountCents: per, method, ref }] };
  return next.payouts.length >= c.months ? stamp(next, 'paid', now) : { ...next, stepSince: now };
}

/* ---------------- numbers for the overview and reports ---------------- */
export function zakatStats(cases: ZakatCase[], s: ZakatSettings, now: string) {
  const by = (st: CaseStatus) => cases.filter((c) => c.status === st).length;
  const done = cases.filter((c) => c.status === 'paid' || c.status === 'approved');
  const firstApproval = (c: ZakatCase) => c.approvals.find((a) => a.decision === 'approve')?.at;
  const turn = cases.map((c) => { const f = cases.length ? firstApproval(c) : undefined; return f ? (Date.parse(f) - Date.parse(c.createdAt)) / 3_600_000 : null; }).filter((x): x is number => x != null);
  return {
    total: cases.length, urgent: cases.filter((c) => c.urgent && !['paid', 'rejected'].includes(c.status)).length,
    overdue: cases.filter((c) => isOverdue(c, s, now)).length,
    byStatus: (Object.keys(STATUS) as CaseStatus[]).map((st) => ({ id: st, label: STATUS[st], count: by(st) })),
    requestedCents: cases.reduce((t, c) => t + c.requestedCents * c.months, 0),
    approvedCents: done.reduce((t, c) => t + totalOf(c), 0),
    paidCents: cases.reduce((t, c) => t + paidCents(c), 0),
    toPayCents: cases.filter((c) => c.status === 'approved').reduce((t, c) => t + totalOf(c) - paidCents(c), 0),
    zakat: cases.filter((c) => c.fund === 'zakat').length, sadaqah: cases.filter((c) => c.fund === 'sadaqah').length,
    avgHoursToFirstApproval: turn.length ? Math.round(turn.reduce((a, b) => a + b, 0) / turn.length) : null,
  };
}

export const usd = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 });

/* ---------------- demo cases (fictional people; ZIP codes match the F1 demo map) ---------------- */
const H = (iso: string, h: number) => new Date(Date.parse(iso) + h * 3_600_000).toISOString();
const T0 = '2026-10-15T15:00:00.000Z';
type Seed = { n: number; name: string; zip: string; zone: string; center: string; cat: Category; ask: number; months?: number; urgent?: boolean; ch: ZakatCase['channel']; ago: number; status: CaseStatus; fund?: 'zakat' | 'sadaqah'; ap?: [Level, string, string, number?][]; paid?: number; visit?: boolean; reason: string };
const SEEDS: Seed[] = [
  { n: 1, name: 'Applicant A. Rahim', zip: '77014', zone: 'n', center: 'North Islamic Center 1', cat: 'rent', ask: 250_000, urgent: true, ch: 'website', ago: 30, status: 'verifying', reason: 'Eviction notice for unpaid rent after a job loss; family of five.' },
  { n: 2, name: 'Applicant S. Abdi', zip: '77067', zone: 'n', center: 'North Islamic Center 1', cat: 'rent', ask: 50_000, months: 3, ch: 'website', ago: 70, status: 'awaiting-approval', fund: 'zakat', ap: [[1, 'lzc-north', 'North zakat coordinator']], visit: true, reason: 'Rent help for three months while waiting for disability benefits.' },
  { n: 3, name: 'Applicant O. Yusuf', zip: '77036', zone: 'sw', center: 'Southwest Islamic Center 2', cat: 'utilities', ask: 120_000, ch: 'in-person', ago: 140, status: 'approved', fund: 'sadaqah', ap: [[1, 'lzc-sw', 'Southwest zakat coordinator', 100_000], [2, 'zakat-ccm', 'Central Committee Member', 100_000], [3, 'zakat-chair', 'Zakat Committee Chair', 100_000]], visit: true, reason: 'Electricity and water about to be cut off; two small children.' },
  { n: 4, name: 'Applicant M. Ali', zip: '77090', zone: 'n', center: 'North Islamic Center 3', cat: 'medical', ask: 300_000, urgent: true, ch: 'app', ago: 330, status: 'paid', fund: 'zakat', ap: [[3, 'zakat-chair', 'Zakat Committee Chair', 300_000]], paid: 1, visit: true, reason: 'Hospital bill after emergency surgery; no insurance.' },
  { n: 5, name: 'Applicant I. Khalil', zip: '77581', zone: 's', center: 'South Islamic Center 2', cat: 'food', ask: 30_000, ch: 'website', ago: 460, status: 'paid', fund: 'zakat', ap: [[1, 'lzc-south', 'South zakat coordinator']], paid: 1, reason: 'Groceries for a family of six for one month.' },
  { n: 6, name: 'Applicant K. Rahman', zip: '77068', zone: 'n', center: 'North Islamic Center 2', cat: 'education', ask: 200_000, ch: 'website', ago: 5, status: 'new', reason: 'School fees and books for three children this semester.' },
  { n: 7, name: 'Applicant Y. Ahmed', zip: '77584', zone: 's', center: 'South Islamic Center 3', cat: 'debt', ask: 500_000, urgent: true, ch: 'in-person', ago: 210, status: 'rejected', fund: 'sadaqah', reason: 'Credit card debt from a failed business.' },
  { n: 8, name: 'Applicant F. Hassan', zip: '77072', zone: 'sw', center: 'Southwest Islamic Center 2', cat: 'education', ask: 150_000, ch: 'app', ago: 50, status: 'awaiting-approval', fund: 'zakat', ap: [[1, 'lzc-sw', 'Southwest zakat coordinator', 90_000]], visit: true, reason: 'College tuition balance for the final semester.' },
  { n: 9, name: 'Applicant H. Omar', zip: '77449', zone: 'nw', center: 'Northwest Islamic Center 1', cat: 'travel', ask: 60_000, urgent: true, ch: 'in-person', ago: 9, status: 'awaiting-approval', fund: 'zakat', ap: [[1, 'lzc-nw', 'Northwest zakat coordinator']], reason: 'Stranded traveler: lost wallet and documents, needs a bus ticket and a hotel.' },
  { n: 10, name: 'Applicant N. Saeed', zip: '77502', zone: 'se', center: 'Southeast Islamic Center 1', cat: 'rent', ask: 80_000, months: 6, ch: 'website', ago: 900, status: 'approved', fund: 'zakat', ap: [[1, 'lzc-se', 'Southeast zakat coordinator', 60_000], [2, 'zakat-ccm', 'Central Committee Member', 60_000], [3, 'zakat-chair', 'Zakat Committee Chair', 60_000]], paid: 2, visit: true, reason: 'Widow with two children; rent support for six months.' },
  { n: 11, name: 'Applicant R. Bashir', zip: '77040', zone: 'nw', center: 'Northwest Islamic Center 2', cat: 'utilities', ask: 25_000, ch: 'website', ago: 26, status: 'info-requested', reason: 'Gas bill overdue.' },
  { n: 12, name: 'Applicant L. Musa', zip: '77478', zone: 'sw', center: 'Southwest Islamic Center 1', cat: 'medical', ask: 40_000, ch: 'app', ago: 3, status: 'new', urgent: true, reason: 'Medicine for a child with asthma; pharmacy needs payment today.' },
];
export const mockZakatCases: ZakatCase[] = SEEDS.map((x) => {
  const created = H(T0, -x.ago);
  const approvals = (x.ap ?? []).map(([level, by, byName, amount], i) => ({ level, by, byName, at: H(created, 6 + i * 10), decision: 'approve' as const, amountCents: amount ?? x.ask, note: '', override: level === 3 && ((amount ?? x.ask) * (x.months ?? 1) > 100_000 || (x.urgent === true && i === 0)) }));
  const per = approvals.length ? approvals[approvals.length - 1].amountCents! : x.ask;
  const payouts = Array.from({ length: x.paid ?? 0 }, (_, i) => ({ at: H(created, 40 + i * 720), by: 'zakat-ops', byName: 'Zakat Operations Office', amountCents: per, method: (i % 2 ? 'check' : 'transfer') as 'check' | 'transfer', ref: `ZOP-${1040 + x.n * 3 + i}` }));
  const last = payouts.length ? payouts[payouts.length - 1].at : approvals.length ? approvals[approvals.length - 1].at : H(created, x.status === 'new' ? 0 : 2);
  return {
    id: `ZKT-2026-${String(x.n).padStart(3, '0')}`, createdAt: created, channel: x.ch, urgent: !!x.urgent,
    applicant: { name: x.name, phone: `(713) 555-02${String(x.n).padStart(2, '0')}`, email: '', zip: x.zip, household: 2 + (x.n % 5), monthlyIncomeCents: 90_000 + x.n * 11_000 },
    category: x.cat, reason: x.reason, requestedCents: x.ask, months: x.months ?? 1, zone: x.zone, center: x.center,
    coordinator: x.status === 'new' ? '' : `lzc-${x.zone === 'n' ? 'north' : x.zone === 's' ? 'south' : x.zone}`,
    status: x.status, stepSince: last, fund: x.fund ?? '',
    checks: x.status === 'new' || x.status === 'verifying' || x.status === 'info-requested' ? { documents: x.status === 'verifying', income: false, hardship: false } : { documents: true, income: true, hardship: true },
    homeVisit: x.visit ? { on: H(created, 4).slice(0, 10), by: 'Local Zakat Coordinator', note: 'Visited the home; situation confirmed.' } : null,
    approvals, payouts,
    notes: x.status === 'rejected' ? [{ at: H(created, 20), byName: 'Zakat Committee Chair', text: 'Business debt is outside the Zakat and Sadaqah guidelines.' }] : x.status === 'info-requested' ? [{ at: H(created, 8), byName: 'Northwest zakat coordinator', text: 'Asked for the latest gas bill and proof of income.' }] : [],
  };
});
