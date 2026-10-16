/**
 * CONTRACT – GET /public/membership/settings
 * Admin source: Settings Center › Membership & dues, Voting, Join form (defaults come from the ISGH Bylaws,
 * see memory/10-membership-rules.md and 13-admin-settings-and-feature-flags.md). Nothing here is hard-coded in UI.
 */
import { z } from 'zod';

export const PlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['individual', 'household']),
  memberClass: z.enum(['natural', 'associate']),
  term: z.enum(['calendar_year', 'lifetime', 'recurring']),
  priceCents: z.number().int().nonnegative(),
  unit: z.string(),                       // "per year", "one time", "per month"
  summary: z.string(),
  perks: z.array(z.string()).max(6),
  votingEligible: z.boolean(),
  featured: z.boolean().default(false),
  maxYearsAhead: z.number().int().min(1).max(10).default(1),
  multiYearDiscountPct: z.number().min(0).max(100).default(0),
  requiresApproval: z.boolean().default(true),
  visible: z.boolean().default(true),
  /** WildApricot-style options (all optional – plans without them behave as before) */
  termPrices: z.array(z.object({ years: z.number().int().min(1).max(10), priceCents: z.number().int().nonnegative() })).max(6).optional(), // fixed price for paying N years at once (e.g. Family 3 years $180)
  bundle: z.object({ maxMembers: z.number().int().min(2).max(20) }).optional(),   // household: one renewal date, one invoice to the coordinator
  renewal: z.object({
    anchor: z.enum(['calendar', 'join', 'date']).default('calendar'),            // calendar year, the join date, or a fixed date every year
    anchorDate: z.string().regex(/^\d{2}-\d{2}$/, 'Use MM-DD, like 12-15').optional(),
    mode: z.enum(['manual', 'automatic', 'both']).default('manual'),            // automatic = recurring card payment
    prorate: z.boolean().default(false),
    aheadLimitDays: z.number().int().min(0).max(365).default(0),                // 0 = members can renew any time
  }).optional(),
  allowLevelChange: z.boolean().optional(),                                   // undefined = yes
});

/** What happens around the renewal date (WildApricot: Renewal policy + Overdue settings). */
export const LifecycleSchema = z.object({
  selfRenew: z.boolean().default(true),                                         // members renew themselves online
  reminders: z.array(z.object({
    daysBefore: z.number().int().min(0).max(120),
    createInvoice: z.boolean().default(false),
    setPendingRenewal: z.boolean().default(false),
  })).max(6),
  notify: z.enum(['member', 'coordinator', 'both']).default('both'),            // for household (bundle) plans
  graceDays: z.number().int().min(0).max(120),
  graceAction: z.enum(['notify', 'change-level', 'none']).default('notify'),
  overdueDays: z.number().int().min(0).max(365),
  overdueAction: z.enum(['lapse', 'suspend', 'change-level', 'archive']).default('lapse'),
  overdueLevel: z.string().optional(),                                          // plan id for "change level"
  voidInvoice: z.boolean().default(true),
}).refine((l) => l.overdueDays >= l.graceDays, { path: ['overdueDays'], message: 'Overdue must come on or after the end of the grace period.' })
  .refine((l) => l.overdueAction !== 'change-level' || !!l.overdueLevel, { path: ['overdueLevel'], message: 'Choose the plan to move people to.' })
  .refine((l) => l.graceAction !== 'change-level' || !!l.overdueLevel, { path: ['overdueLevel'], message: 'Choose the plan to move people to when the grace period ends.' })
  .refine((l) => new Set(l.reminders.map((r) => r.daysBefore)).size === l.reminders.length, { path: ['reminders'], message: 'Two reminders are set for the same day.' });
export type Lifecycle = z.infer<typeof LifecycleSchema>;
export const DEFAULT_LIFECYCLE: Lifecycle = {
  selfRenew: true, notify: 'both',
  reminders: [{ daysBefore: 30, createInvoice: true, setPendingRenewal: true }, { daysBefore: 14, createInvoice: false, setPendingRenewal: false }, { daysBefore: 0, createInvoice: false, setPendingRenewal: false }],
  graceDays: 7, graceAction: 'notify', overdueDays: 14, overdueAction: 'lapse', voidInvoice: true,
};

export const MembershipSettingsSchema = z.object({
  year: z.number().int(),                         // membership year being sold (calendar year)
  recordDate: z.string(),                         // voting record date ISO, e.g. 2027-06-30T23:59:59-05:00
  timezone: z.string().default('America/Chicago'),
  minVotingAge: z.number().int().default(18),
  minMemberAge: z.number().int().default(18),
  serviceArea: z.object({ states: z.array(z.string()), label: z.string() }),
  plans: z.array(PlanSchema),
  commitments: z.array(z.object({ id: z.string(), label: z.string(), help: z.string().optional() })),
  pledge: z.object({ version: z.string(), text: z.string() }),
  consents: z.object({
    email: z.object({ version: z.string(), text: z.string() }),
    sms: z.object({ version: z.string(), text: z.string() }),
  }),
  payerRelationships: z.array(z.string()),       // Bylaws: blood or marriage relatives only
  otp: z.object({ length: z.number().int().default(6), resendSeconds: z.number().int().default(60) }),
  flags: z.object({ sms: z.boolean(), familyPlan: z.boolean(), lifePlan: z.boolean(), idUpload: z.boolean() }),
  lifecycle: LifecycleSchema.optional(),
}).superRefine((s, ctx) => {
  const bad = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const ids = new Set<string>();
  s.plans.forEach((p, i) => {
    const at = (...k: (string | number)[]) => ['plans', i, ...k];
    if (ids.has(p.id)) bad(at('id'), `Another plan already uses the ID "${p.id}".`); ids.add(p.id);
    if (p.votingEligible && p.memberClass === 'associate') bad(at('votingEligible'), 'Associate members cannot vote (Constitution Art. III).');
    if (p.bundle && p.category !== 'household') bad(at('bundle'), 'Only household plans can cover more than one person.');
    if (p.term === 'lifetime') {
      if (p.renewal) bad(at('renewal'), 'Lifetime plans never renew – remove the renewal options.');
      if (p.termPrices?.length) bad(at('termPrices'), 'Lifetime plans are paid once – remove the multi-year prices.');
      if (p.maxYearsAhead > 1) bad(at('maxYearsAhead'), 'Lifetime plans are paid once – set years ahead to 1.');
      if (p.multiYearDiscountPct > 0) bad(at('multiYearDiscountPct'), 'Lifetime plans have no multi-year discount.');
    }
    const r = p.renewal;
    if (r?.anchor === 'date') {
      if (!r.anchorDate) bad(at('renewal', 'anchorDate'), 'Enter the renewal date, like 12-15.');
      else {
        const [m, d] = r.anchorDate.split('-').map(Number);
        const max = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
        if (!max || d < 1 || d > max) bad(at('renewal', 'anchorDate'), m === 2 && d === 29 ? 'February 29 is not in every year – use 02-28 or 03-01.' : `${r.anchorDate} is not a real date.`);
      }
    }
    if (r && r.anchor !== 'date' && r.anchorDate) bad(at('renewal', 'anchorDate'), 'A renewal date is only used with "fixed date".');
    if (r?.prorate && r.anchor === 'join') bad(at('renewal', 'prorate'), 'Partial-year pricing only works with a calendar year or fixed renewal date.');
    if (r && (r.mode === 'automatic' || r.mode === 'both') && p.priceCents === 0) bad(at('renewal', 'mode'), 'Automatic renewal needs a price above $0.');
    if (r && r.aheadLimitDays > 0 && s.lifecycle) for (const rem of s.lifecycle.reminders)
      if (rem.daysBefore > r.aheadLimitDays) bad(at('renewal', 'aheadLimitDays'), `The ${rem.daysBefore}-day reminder asks members to renew before ${p.name} renewal opens (${r.aheadLimitDays} days before).`);
    const seen = new Set<number>();
    (p.termPrices ?? []).forEach((t, j) => {
      if (seen.has(t.years)) bad(at('termPrices', j, 'years'), `There are two prices for ${t.years} year${t.years > 1 ? 's' : ''}.`); seen.add(t.years);
      if (t.years > p.maxYearsAhead) bad(at('termPrices', j, 'years'), `${t.years} years is more than the ${p.maxYearsAhead} years ahead this plan allows.`);
      if (t.years === 1 && t.priceCents !== p.priceCents) bad(at('termPrices', j, 'priceCents'), 'The 1-year price must match the yearly price.');
      if (t.years > 1 && t.priceCents > p.priceCents * t.years) bad(at('termPrices', j, 'priceCents'), `Paying ${t.years} years at once costs more than paying each year.`);
    });
  });
  const lc = s.lifecycle;
  if (lc?.overdueLevel) {
    const to = s.plans.find((p) => p.id === lc.overdueLevel);
    if (!to) bad(['lifecycle', 'overdueLevel'], `There is no plan with the ID "${lc.overdueLevel}".`);
    else if (to.priceCents > 0 && to.term !== 'lifetime') bad(['lifecycle', 'overdueLevel'], `Move people who did not pay to a free plan, not ${to.name} (it has dues).`);
  }
});

export type Plan = z.infer<typeof PlanSchema>;
export type MembershipSettings = z.infer<typeof MembershipSettingsSchema>;

export const mockMembershipSettings: MembershipSettings = {
  year: 2027,
  recordDate: '2027-06-30T23:59:59-05:00',
  timezone: 'America/Chicago',
  minVotingAge: 18,
  minMemberAge: 18,
  serviceArea: { states: ['TX'], label: 'Greater Houston' },
  plans: [
    { id: 'single', name: 'Single', category: 'individual', memberClass: 'natural', term: 'calendar_year', priceCents: 2500, unit: 'per year',
      summary: 'One adult member.', perks: ['A vote in ISGH elections', 'Member rates on programs', 'Digital member card'],
      votingEligible: true, featured: false, maxYearsAhead: 3, multiYearDiscountPct: 10, requiresApproval: true, visible: true },
    { id: 'family', name: 'Family', category: 'household', memberClass: 'natural', term: 'calendar_year', priceCents: 4000, unit: 'per year',
      summary: 'You and your spouse.', perks: ['A vote for each of you', 'One renewal for both', 'Two digital member cards'],
      votingEligible: true, featured: true, maxYearsAhead: 3, multiYearDiscountPct: 10, requiresApproval: true, visible: true },
    { id: 'life', name: 'Life', category: 'individual', memberClass: 'natural', term: 'lifetime', priceCents: 100000, unit: 'one time',
      summary: 'Never renew again.', perks: ['Lifetime membership', 'Supports all 22 centers', 'Other voting rules still apply'],
      votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true },
    { id: 'associate', name: 'Associate', category: 'individual', memberClass: 'associate', term: 'calendar_year', priceCents: 2500, unit: 'per year',
      summary: 'For friends of the community who are not Muslim.', perks: ['Join programs and events', 'Community updates', 'No voting or office'],
      votingEligible: false, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true },
  ],
  commitments: [
    { id: 'programs', label: 'Take part regularly in an ISGH program', help: 'Weekend or adult school, funeral services, Quran study, or Dawah.' },
    { id: 'contribution', label: 'Contribute a fair share (at least 1% of yearly income)' },
    { id: 'volunteer', label: 'Volunteer in other approved ISGH activities' },
  ],
  pledge: {
    version: 'bylaws-2025-09-28',
    text: 'I pledge to abide by the Constitution and Bylaws of the Islamic Society of Greater Houston and its Code of Ethics.',
  },
  consents: {
    email: { version: 'email-v1', text: 'Email me renewal reminders, election notices and ISGH news. I can unsubscribe at any time.' },
    sms: { version: 'sms-v1', text: 'Text me reminders and alerts. Message and data rates may apply. Reply STOP to opt out.' },
  },
  payerRelationships: ['Spouse', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Grandchild', 'Other relative by blood or marriage'],
  otp: { length: 6, resendSeconds: 60 },
  flags: { sms: false, familyPlan: true, lifePlan: true, idUpload: true },
  lifecycle: DEFAULT_LIFECYCLE,
};

/**
 * ISGH's levels as they are in WildApricot today (seen 14 Oct 2026). Admin › Membership › "Use ISGH's current levels"
 * loads them into the draft so the Board can review before publishing. Renewal anchored on December 15.
 */
const dec15 = { anchor: 'date' as const, anchorDate: '12-15', mode: 'manual' as const, prorate: false, aheadLimitDays: 0 };
export const ISGH_WILDAPRICOT_LEVELS: Plan[] = [
  { id: 'individual', name: 'Individual', category: 'individual', memberClass: 'natural', term: 'calendar_year', priceCents: 2000, unit: 'per year', summary: 'One adult member.', perks: ['A vote in ISGH elections', 'Digital member card'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, renewal: { ...dec15, mode: 'automatic' }, allowLevelChange: true },
  { id: 'family', name: 'Family', category: 'household', memberClass: 'natural', term: 'calendar_year', priceCents: 7500, unit: 'per year', summary: 'You and your spouse.', perks: ['A vote for each of you', 'One renewal for both'], votingEligible: true, featured: true, maxYearsAhead: 5, multiYearDiscountPct: 0, requiresApproval: true, visible: false,
    termPrices: [{ years: 1, priceCents: 7500 }, { years: 3, priceCents: 18000 }, { years: 5, priceCents: 28500 }], bundle: { maxMembers: 2 }, renewal: dec15, allowLevelChange: true },
  { id: 'life-individual', name: 'Lifetime (individual)', category: 'individual', memberClass: 'natural', term: 'lifetime', priceCents: 100000, unit: 'one time', summary: 'Never renew again.', perks: ['Lifetime membership'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, allowLevelChange: false },
  { id: 'life-family', name: 'Lifetime (family)', category: 'household', memberClass: 'natural', term: 'lifetime', priceCents: 150000, unit: 'one time', summary: 'You and your spouse, for life.', perks: ['Lifetime membership for both'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, bundle: { maxMembers: 2 }, allowLevelChange: false },
  { id: 'checkomatic', name: 'Check-o-matic', category: 'individual', memberClass: 'natural', term: 'calendar_year', priceCents: 1000, unit: 'per year', summary: 'Monthly bank draft donors (existing members only).', perks: ['Membership with your monthly gift'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: false, renewal: dec15, allowLevelChange: true },
  { id: 'checkomatic-family', name: 'Check-o-matic (family)', category: 'household', memberClass: 'natural', term: 'calendar_year', priceCents: 1000, unit: 'per year', summary: 'Monthly bank draft donors, you and your spouse.', perks: ['Membership with your monthly gift'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: false, bundle: { maxMembers: 2 }, renewal: dec15, allowLevelChange: true },
  { id: 'unverified', name: 'Unverified', category: 'individual', memberClass: 'natural', term: 'lifetime', priceCents: 0, unit: 'holding level', summary: 'Waiting for ID or information checks. Not shown to the public.', perks: ['No vote until verified'], votingEligible: false, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: false, allowLevelChange: true },
];

/* ---------- helpers shared by UI and API ---------- */
export const formatUSD = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/** Age in whole years on a given date (date-only comparison, no timezone drift). */
export function ageOn(dobISO: string, onISO: string): number {
  const [by, bm, bd] = dobISO.slice(0, 10).split('-').map(Number);
  const [y, m, d] = onISO.slice(0, 10).split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

/** Price for a plan and number of years (server recomputes; never trust the client). */
export function quote(plan: Plan, years: number) {
  const y = plan.term === 'calendar_year' ? Math.min(Math.max(1, years), plan.maxYearsAhead) : 1;
  const gross = plan.priceCents * y;
  // a fixed price for this many years (WildApricot 3-/5-year levels) wins over the percentage discount
  const fixed = plan.termPrices?.find((t) => t.years === y);
  const discount = fixed ? Math.max(0, gross - fixed.priceCents) : y > 1 ? Math.round((gross * plan.multiYearDiscountPct) / 100) : 0;
  return { years: y, grossCents: gross, discountCents: discount, totalCents: gross - discount };
}
