/**
 * Renewal engine (WildApricot "Renewal policy" + "Overdue" settings, made to actually run).
 * Pure functions on plain YYYY-MM-DD dates – no clock, no timezone drift. The website, the admin and the BE
 * (daily renewal job) all use this same file, so a member sees exactly what the staff and the server see.
 *
 *   termFor()      – what a payment buys: from / paid-through date (renewal date anchor, multi-year, extend vs. restart)
 *   priceFor()     – quote() plus the partial-year (prorated) first period
 *   canRenew()     – may the member renew today (self-renew switch, "renew early" limit, years-ahead limit)
 *   timeline()     – every dated step around one renewal date: reminders, invoices, grace, overdue action
 *   standingOn()   – the member's renewal status on a given day, and the next step
 *   duesCoverVote() / coverageOfYear() – Bylaws: own dues must cover the voting record date and be paid by it
 */
import { quote, type Lifecycle, type Plan } from './membership';

export type ISODate = string; // YYYY-MM-DD

/* ---------- date math (UTC days) ---------- */
const DAY = 86_400_000;
const toT = (s: ISODate) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromT = (t: number): ISODate => (Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '') as ISODate;   // bad date: '' instead of a crash
const pad = (n: number) => String(n).padStart(2, '0');
const yearOf = (s: ISODate) => Number(s.slice(0, 4));
export const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && fromT(toT(s)) === s;
export const addDays = (s: ISODate, n: number) => fromT(toT(s) + n * DAY);
/** b − a in whole days (positive when b is later). */
export const daysBetween = (a: ISODate, b: ISODate) => Math.round((toT(b) - toT(a)) / DAY);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based
/** Add months; the day is clamped to the month's length (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(s: ISODate, n: number): ISODate {
  const [y, m, d] = s.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n; const Y = Math.floor(idx / 12), M = (idx % 12) + 1;
  return `${Y}-${pad(M)}-${pad(Math.min(d, daysInMonth(Y, M)))}`;
}
export const addYears = (s: ISODate, n: number) => addMonths(s, 12 * n);
/** Houston format: MM/DD/YYYY. */
export const fmtDay = (s: ISODate) => `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}`;

/* ---------- the renewal date anchor ---------- */
export type AnchorKind = 'calendar' | 'join' | 'date';
/** Which renewal date a plan uses. Plans without renewal options keep the old behavior: calendar year, or join date for recurring. */
export function anchorOf(plan: Plan): { kind: AnchorKind; mmdd: string } | null {
  if (plan.term === 'lifetime') return null;
  const kind: AnchorKind = plan.renewal?.anchor ?? (plan.term === 'recurring' ? 'join' : 'calendar');
  if (kind === 'calendar') return { kind, mmdd: '12-31' };
  if (kind === 'date') { const v = plan.renewal?.anchorDate ?? ''; const [m, d] = v.split('-').map(Number); return { kind, mmdd: /^\d{2}-\d{2}$/.test(v) && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? v : '12-31' }; }
  return { kind, mmdd: '' };
}
/** The anchor day in a given year (02-29 falls back to 02-28 in other years). */
export function anchorIn(year: number, mmdd: string): ISODate {
  const [m, d] = mmdd.split('-').map(Number);
  return `${year}-${pad(m)}-${pad(Math.min(d, daysInMonth(year, m)))}`;
}

/* ---------- what a payment buys ---------- */
export type Term = { from: ISODate; through: ISODate | null; years: number; extended: boolean };
export type TermInput = {
  start: ISODate;                     // payment day (today)
  years?: number;                     // years paid now (clamped to the plan's limit)
  saleYear?: number;                  // membership year being sold (settings.year) – anchored plans end in this year at the earliest
  current?: ISODate | null;           // paid-through date the member already has
  extendWithinDays?: number;          // still extend from `current` if it ended at most this many days ago (use lifecycle.overdueDays)
};
export function termFor(plan: Plan, i: TermInput): Term {
  const years = plan.term === 'lifetime' ? 1 : Math.min(Math.max(1, Math.floor(i.years ?? 1)), plan.maxYearsAhead);
  const a = anchorOf(plan);
  if (!a) return { from: i.start, through: null, years: 1, extended: false };
  // Renewing before the end (or inside the allowed late window) adds time to the existing date – nobody loses paid days.
  const extended = !!i.current && daysBetween(i.current, i.start) <= (i.extendWithinDays ?? 0);
  if (extended && i.current) {
    const c = i.current;
    if (plan.term === 'recurring') return { from: addDays(c, 1), through: addMonths(c, years), years, extended };
    if (a.kind === 'join') return { from: addDays(c, 1), through: addYears(c, years), years, extended };
    return { from: addDays(c, 1), through: anchorIn(yearOf(c) + years, a.mmdd), years, extended };
  }
  if (plan.term === 'recurring') return { from: i.start, through: addDays(addMonths(i.start, years), -1), years, extended };
  if (a.kind === 'join') return { from: i.start, through: addDays(addYears(i.start, years), -1), years, extended };
  // anchored (calendar or fixed date): the first period ends on the next anchor on/after the start, never before the year being sold
  let y = Math.max(yearOf(i.start), i.saleYear ?? 0);
  if (anchorIn(y, a.mmdd) < i.start) y += 1;
  return { from: i.start, through: anchorIn(y + years - 1, a.mmdd), years, extended };
}

/** quote() + the partial first period when the plan prorates. Only new (not extended) anchored terms are prorated. */
export function priceFor(plan: Plan, i: TermInput) {
  const t = termFor(plan, i);
  const q = quote(plan, t.years);
  const a = anchorOf(plan);
  let prorateCents = 0;
  if (plan.renewal?.prorate && a && a.kind !== 'join' && plan.term !== 'recurring' && !t.extended && t.through) {
    const firstEnd = anchorIn(yearOf(t.through) - (t.years - 1), a.mmdd);
    const periodStart = addDays(anchorIn(yearOf(firstEnd) - 1, a.mmdd), 1);
    const full = daysBetween(periodStart, firstEnd) + 1, used = daysBetween(t.from, firstEnd) + 1;
    if (used < full) prorateCents = plan.priceCents - Math.round((plan.priceCents * used) / full);
  }
  return { ...q, term: t, prorateCents, totalCents: Math.max(0, q.totalCents - prorateCents) };
}

/* ---------- may they renew now ---------- */
export type RenewCheck = { ok: boolean; reason: string; opensOn: ISODate | null };
export function canRenew(plan: Plan, paidThrough: ISODate | null, today: ISODate, lc?: Lifecycle): RenewCheck {
  if (plan.term === 'lifetime') return { ok: false, reason: 'Lifetime plans never renew.', opensOn: null };
  if (lc && !lc.selfRenew) return { ok: false, reason: 'Renewals are done by the office for this organization.', opensOn: null };
  if (!paidThrough || paidThrough < today) return { ok: true, reason: 'Renewal is open.', opensOn: null };
  const ahead = plan.renewal?.aheadLimitDays ?? 0;
  const opensOn = ahead ? addDays(paidThrough, -ahead) : null;
  if (opensOn && today < opensOn) return { ok: false, reason: `Renewal opens ${fmtDay(opensOn)} (${ahead} days before ${fmtDay(paidThrough)}).`, opensOn };
  // years-ahead limit: paid-through may not go beyond today + maxYearsAhead periods
  const limit = anchorOf(plan)?.kind === 'join' || plan.term === 'recurring' ? addYears(today, plan.maxYearsAhead) : anchorIn(yearOf(today) + plan.maxYearsAhead, anchorOf(plan)!.mmdd);
  if (paidThrough >= limit) return { ok: false, reason: `Already paid ${plan.maxYearsAhead === 1 ? 'for the full year' : `the most years allowed (${plan.maxYearsAhead})`}.`, opensOn };
  return { ok: true, reason: 'Renewal is open.', opensOn };
}

/* ---------- the dated steps around one renewal date ---------- */
export type StepKind = 'reminder' | 'pending' | 'ends' | 'grace-ends' | 'overdue';
export type Step = { on: ISODate; kind: StepKind; label: string; invoice?: boolean };
const ACTION_LABEL = { lapse: 'Membership lapses', suspend: 'Account is suspended', 'change-level': 'Moved to another plan', archive: 'Record is archived' } as const;
export function timeline(plan: Plan, lc: Lifecycle, paidThrough: ISODate, levelName?: (id: string) => string | undefined): Step[] {
  const steps: Step[] = [];
  const moved = (lc.overdueLevel && levelName?.(lc.overdueLevel)) || lc.overdueLevel || 'another plan';
  for (const r of lc.reminders) {
    const on = addDays(paidThrough, -r.daysBefore);
    const when = r.daysBefore === 0 ? 'on the renewal date' : `${r.daysBefore} day${r.daysBefore === 1 ? '' : 's'} before`;
    steps.push({ on, kind: 'reminder', label: `Reminder email ${when}${r.createInvoice ? ' with an invoice' : ''}`, invoice: r.createInvoice || undefined });
    if (r.setPendingRenewal) steps.push({ on, kind: 'pending', label: 'Marked "renewal due"' });
  }
  steps.push({ on: paidThrough, kind: 'ends', label: 'Last paid day' });
  if (lc.graceDays > 0) {
    const g = { notify: 'Grace period ends – overdue notice', 'change-level': `Grace period ends – moved to ${moved}`, none: 'Grace period ends' }[lc.graceAction];
    steps.push({ on: addDays(paidThrough, lc.graceDays), kind: 'grace-ends', label: g });
  }
  const o = lc.overdueAction === 'change-level' ? `Moved to ${moved}` : ACTION_LABEL[lc.overdueAction];
  steps.push({ on: addDays(paidThrough, Math.max(lc.overdueDays, 1)), kind: 'overdue', label: `${o}${lc.voidInvoice ? ' · unpaid invoice voided' : ''}` });
  const order: Record<StepKind, number> = { reminder: 0, pending: 1, ends: 2, 'grace-ends': 3, overdue: 4 };
  return steps.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : order[a.kind] - order[b.kind]));
}

/* ---------- renewal status on a day ---------- */
export type RenewalStatus = 'lifetime' | 'active' | 'renewal-due' | 'grace' | 'overdue' | 'lapsed' | 'suspended' | 'archived' | 'moved' | 'never-paid';
export const RENEWAL_LABEL: Record<RenewalStatus, string> = {
  lifetime: 'Lifetime', active: 'Active', 'renewal-due': 'Renewal due', grace: 'In grace period', overdue: 'Overdue',
  lapsed: 'Lapsed', suspended: 'Suspended', archived: 'Archived', moved: 'Moved to another plan', 'never-paid': 'Not paid yet',
};
export type Standing = { status: RenewalStatus; label: string; paidThrough: ISODate | null; daysLeft: number | null; next: Step | null; movedTo?: string };
export function standingOn(plan: Plan, lc: Lifecycle, paidThrough: ISODate | null, today: ISODate): Standing {
  const mk = (status: RenewalStatus, extra: Partial<Standing> = {}): Standing => ({ status, label: RENEWAL_LABEL[status], paidThrough, daysLeft: paidThrough ? daysBetween(today, paidThrough) : null, next: null, ...extra });
  if (plan.term === 'lifetime') return mk('lifetime');
  if (!paidThrough) return mk('never-paid');
  const steps = timeline(plan, lc, paidThrough);
  const next = steps.find((s) => s.on > today) ?? null;
  const late = daysBetween(paidThrough, today); // > 0 once the last paid day has passed
  if (late <= 0) {
    const pendingOn = steps.find((s) => s.kind === 'pending')?.on;
    return mk(pendingOn && today >= pendingOn ? 'renewal-due' : 'active', { next });
  }
  if (late <= lc.graceDays) return mk('grace', { next });
  if (lc.graceAction === 'change-level' && lc.graceDays > 0) return mk('moved', { next, movedTo: lc.overdueLevel });
  if (late < Math.max(lc.overdueDays, 1)) return mk('overdue', { next });
  const s = ({ lapse: 'lapsed', suspend: 'suspended', 'change-level': 'moved', archive: 'archived' } as const)[lc.overdueAction];
  return mk(s, { next: null, movedTo: s === 'moved' ? lc.overdueLevel : undefined });
}

/* ---------- Bylaws: dues and the vote ---------- */
/** The period a "dues for year Y" payment covers. Calendar: Jan 1 – Dec 31. Fixed date (12-15): 12/16/Y-1 – 12/15/Y. */
export function coverageOfYear(plan: Plan, year: number): { from: ISODate; through: ISODate | null } {
  const a = anchorOf(plan);
  if (!a) return { from: `${year}-01-01`, through: null };
  if (a.kind === 'date') return { from: addDays(anchorIn(year - 1, a.mmdd), 1), through: anchorIn(year, a.mmdd) };
  return { from: `${year}-01-01`, through: `${year}-12-31` }; // calendar, and join-date plans recorded by year
}
/**
 * Own dues count for a vote only when the plan can vote, the paid period covers the record date
 * AND the money arrived on or before it (paying later renews the membership, not that year's vote).
 */
export function duesCoverVote(plan: Plan, pay: { paidThrough: ISODate | null; paidOn: ISODate | null } | null, recordDate: ISODate): { ok: boolean; reason: string } {
  const rd = recordDate.slice(0, 10);
  if (!plan.votingEligible) return { ok: false, reason: `The ${plan.name} plan does not include a vote.` };
  if (plan.term === 'lifetime') return { ok: true, reason: 'Lifetime plan – no yearly dues.' };
  if (!pay || !pay.paidOn) return { ok: false, reason: `No dues on record that cover ${fmdOrEmpty(rd)}.` };
  if (!pay.paidThrough || pay.paidThrough < rd) return { ok: false, reason: `Paid through ${pay.paidThrough ? fmtDay(pay.paidThrough) : '—'} – dues must cover ${fmtDay(rd)}.` };
  if (pay.paidOn.slice(0, 10) > rd) return { ok: false, reason: `Paid ${fmtDay(pay.paidOn.slice(0, 10))} – after the record date ${fmtDay(rd)} (renews membership, no vote this year).` };
  return { ok: true, reason: `Paid ${fmtDay(pay.paidOn.slice(0, 10))}, covers through ${fmtDay(pay.paidThrough)}.` };
}
const fmdOrEmpty = (s: string) => (isISODate(s) ? fmtDay(s) : s);
