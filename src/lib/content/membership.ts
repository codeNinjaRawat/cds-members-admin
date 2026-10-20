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
  /** D13 – who the plan is for by age (a youth plan under 18, a senior plan 65+); empty = the organization's minimum member age. */
  ages: z.object({ min: z.number().int().min(0).max(120).optional(), max: z.number().int().min(0).max(120).optional() }).optional(),
  /** "Pay for family members": the applicant adds other adults of the household on the same payment – each gets their
   *  own member record, approval and sign-in. perMemberCents is per year (times the years chosen). */
  familyMembers: z.object({ max: z.number().int().min(1).max(10), perMemberCents: z.number().int().nonnegative() }).optional(),
  /** Monthly plans: the gift can go to one of these funds (the applicant picks one); empty = no choice. */
  fundChoices: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
  /** A short reminder shown with the plan on the join form (e.g. "Dues of $20 per member must be paid by June 30."). */
  note: z.string().trim().max(300).optional(),
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

/* ---------- P1–P3 membership rules: configuration, not code. ISGH's values are one preset; any organization sets its own. ---------- */
const MMDD = z.string().regex(/^\d{2}-\d{2}$/, 'Use MM-DD, like 06-30.');
/** "Monthly contributors are members": the year's contributions must reach a total by a cut-off date (ISGH: Check-o-matic, $40 by June 30). */
export const QualifyingGiftsRuleSchema = z.object({
  enabled: z.boolean().default(false),
  planId: z.string().default(''),                              // the plan these members hold
  label: z.string().max(60).default('Monthly contributors'),
  minMonthlyCents: z.number().int().nonnegative().default(1000),
  totalCents: z.number().int().nonnegative().default(4000),    // the year's contributions must reach this…
  cutoff: MMDD.default('06-30'),                               // …by this date to be a member (and vote) that year
  countsGifts: z.enum(['recurring', 'any']).default('recurring'),  // only recurring (bank draft / card) gifts, or any gift
  coversSpouse: z.boolean().default(true),                     // primary and spouse
  rollover: z.boolean().default(false),                        // contributions above the total never carry into next year
});
/** A gift above a threshold makes someone a lifetime member (ISGH: $25,000). */
export const LifetimeByDonationRuleSchema = z.object({
  enabled: z.boolean().default(false),
  planId: z.string().default(''),                              // the lifetime plan granted
  thresholdCents: z.number().int().nonnegative().default(2_500_000),
  window: z.enum(['single-gift', 'calendar-year', 'all-time']).default('all-time'),
  needsApproval: z.boolean().default(true),
});
/** Who a household plan covers. */
export const HouseholdRuleSchema = z.object({
  definition: z.enum(['spouse', 'spouse-children', 'relatives']).default('spouse'),
  label: z.string().max(80).default('Husband and wife'),
});
/** When an application becomes a membership. */
export const ApprovalRuleSchema = z.object({
  by: z.string().max(60).default('Board'),
  requireFullPayment: z.boolean().default(true),               // approval only after the dues are paid in full
  requireIdCheck: z.boolean().default(false),
});
/** J1/J2 – what the join form says about identity: the name must match the ID, the policy, the consent. Words are the organization's. */
export const IdentityPolicySchema = z.object({
  nameMustMatchId: z.boolean().default(true),
  nameNote: z.string().max(240).default('Enter your name exactly as it appears on your government-issued photo ID. It is used for the election rolls.'),
  policy: z.object({
    enabled: z.boolean().default(true),
    title: z.string().max(120).default('Identity Collection and Verification Policy'),
    url: z.string().max(300).default(''),                 // a page of your own; empty = the built-in page with the text below
    text: z.string().max(6000).default(''),
  }).default({}),
  consentRequired: z.boolean().default(true),
  consentText: z.string().max(400).default('I have read the Identity Collection and Verification Policy and agree that my identity may be verified as it describes.'),
  consentVersion: z.string().max(40).default('identity-v1'),
});
/** J3 – a plain "how to sign up" page the website links to. */
export const SignupGuideSchema = z.object({
  enabled: z.boolean().default(true),
  title: z.string().max(120).default('How to sign up'),
  intro: z.string().max(600).default('Becoming a member takes about ten minutes online. Here is what to expect.'),
  steps: z.array(z.object({ title: z.string().max(120), text: z.string().max(600) })).max(12).default([]),
  help: z.string().max(400).default(''),
});
export const LegalLinksSchema = z.object({ termsUrl: z.string().max(300).default(''), privacyUrl: z.string().max(300).default('') });
/**
 * V1 – Member classes are the organization's words and rules, not ours. The two keys stay fixed (`natural`,
 * `associate`) so records never change; what each one is called, whether it votes and whether the join form offers it
 * is configuration. ISGH (from the 10/17 call): "natural" = every Muslim in the community, no dues, no vote;
 * "associate" = the paid member who votes. Another organization may use the classes the other way round.
 */
export const MemberClassSchema = z.object({
  label: z.string().trim().min(2).max(40),
  blurb: z.string().max(200).default(''),
  canVote: z.boolean().default(true),
  offered: z.boolean().default(true),                           // shown as a choice on the join form
});
export const MemberClassesSchema = z.object({
  natural: MemberClassSchema.default({ label: 'Member', blurb: 'Can vote and hold office when eligible.', canVote: true, offered: true }),
  associate: MemberClassSchema.default({ label: 'Associate member', blurb: 'For friends of the community. No voting or office.', canVote: false, offered: true }),
  reference: z.string().max(80).default('Constitution Art. III'),  // quoted in the plan editor's message
});
export type MemberClasses = z.infer<typeof MemberClassesSchema>;
export type MemberClassKey = 'natural' | 'associate';
export const DEFAULT_CLASSES: MemberClasses = MemberClassesSchema.parse({});
/** The class rule for a plan or a person (falls back to the defaults for settings saved before V1). */
export function memberClass(rules: { classes?: Partial<MemberClasses> } | undefined, key: string) {
  const c = (rules?.classes as MemberClasses | undefined)?.[key as MemberClassKey] ?? DEFAULT_CLASSES[key as MemberClassKey] ?? DEFAULT_CLASSES.natural;
  return { ...c, key: key as MemberClassKey, reference: rules?.classes?.reference ?? DEFAULT_CLASSES.reference };
}
/** The message the plan editor and the eligibility check show when a class does not vote. */
export const noVoteMessage = (rules: { classes?: Partial<MemberClasses> } | undefined, key: string) => { const c = memberClass(rules, key); return `${c.label} members cannot vote${c.reference ? ` (${c.reference})` : ''}.`; };

export const MembershipRulesSchema = z.object({
  qualifyingGifts: QualifyingGiftsRuleSchema.default({}),
  lifetimeByDonation: LifetimeByDonationRuleSchema.default({}),
  household: HouseholdRuleSchema.default({}),
  approval: ApprovalRuleSchema.default({}),
  classes: MemberClassesSchema.default({}),
});
export type MembershipRules = z.infer<typeof MembershipRulesSchema>;

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
  rules: MembershipRulesSchema.default({}),
  identity: IdentityPolicySchema.default({}),
  guide: SignupGuideSchema.default({}),
  legal: LegalLinksSchema.default({}),
}).superRefine((s, ctx) => {
  const bad = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const ids = new Set<string>();
  s.plans.forEach((p, i) => {
    const at = (...k: (string | number)[]) => ['plans', i, ...k];
    if (ids.has(p.id)) bad(at('id'), `Another plan already uses the ID "${p.id}".`); ids.add(p.id);
    if (p.votingEligible && !memberClass(s.rules, p.memberClass).canVote) bad(at('votingEligible'), noVoteMessage(s.rules, p.memberClass));
    if (p.bundle && p.category !== 'household') bad(at('bundle'), 'Only household plans can cover more than one person.');
    if (p.ages && p.ages.min !== undefined && p.ages.max !== undefined && p.ages.min > p.ages.max) bad(at('ages', 'max'), 'The oldest age must be at least the youngest age.');
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
  const q = s.rules.qualifyingGifts;
  if (q.enabled) {
    if (!s.plans.some((p) => p.id === q.planId)) bad(['rules', 'qualifyingGifts', 'planId'], 'Choose the plan these contributors hold.');
    if (q.totalCents < q.minMonthlyCents) bad(['rules', 'qualifyingGifts', 'totalCents'], 'The yearly total cannot be less than one monthly contribution.');
    const [m, d] = q.cutoff.split('-').map(Number); if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) bad(['rules', 'qualifyingGifts', 'cutoff'], `${q.cutoff} is not a real date.`);
  }
  const lbd = s.rules.lifetimeByDonation;
  if (lbd.enabled) {
    const to = s.plans.find((p) => p.id === lbd.planId);
    if (!to) bad(['rules', 'lifetimeByDonation', 'planId'], 'Choose the lifetime plan the donor receives.');
    else if (to.term !== 'lifetime') bad(['rules', 'lifetimeByDonation', 'planId'], `${to.name} is not a lifetime plan.`);
    if (lbd.thresholdCents <= 0) bad(['rules', 'lifetimeByDonation', 'thresholdCents'], 'Enter the gift amount.');
  }
  const lc = s.lifecycle;
  if (lc?.overdueLevel) {
    const to = s.plans.find((p) => p.id === lc.overdueLevel);
    if (!to) bad(['lifecycle', 'overdueLevel'], `There is no plan with the ID "${lc.overdueLevel}".`);
    else if (to.priceCents > 0 && to.term !== 'lifetime') bad(['lifecycle', 'overdueLevel'], `Move people who did not pay to a free plan, not ${to.name} (it has dues).`);
  }
});

export type Plan = z.infer<typeof PlanSchema>;
export type MembershipSettings = z.infer<typeof MembershipSettingsSchema>;
export type IdentityPolicy = z.infer<typeof IdentityPolicySchema>;

export const DEFAULT_IDENTITY_TEXT = [
  'Why we collect it. Membership and the right to vote are limited to people who live in our service area and are who they say they are. We check identity so that the election rolls are correct and each person holds one membership.',
  'What we collect. Your legal name, date of birth and home address as they appear on a government-issued photo ID (driver license, state ID or passport), and a photo of that ID.',
  'How it is used. Only to confirm your identity and address for membership and voting. It is not shared outside the membership office and is never sold or used for marketing.',
  'How it is kept. ID images are stored encrypted, viewed only by staff with the Photo ID check permission, and deleted after the check or after 90 days, whichever comes first. Your name, date of birth and address stay on your member record.',
  'Your choices. You may bring your ID to the office instead of uploading it. Without an identity check you can still take part in programs, but you cannot vote.',
].join('\n\n');
export const DEFAULT_GUIDE_STEPS = [
  { title: 'Pick a plan', text: 'Choose the plan that fits you – one person, a household, or lifetime. Monthly contributors may qualify through their giving.' },
  { title: 'Tell us about you', text: 'Your legal name as on your ID, date of birth, phone and home address. Your address places you in your zone and Islamic Center.' },
  { title: 'Verify your identity', text: 'Upload or scan a government-issued photo ID, or bring it to the office. Read the identity policy first.' },
  { title: 'Commit and sign', text: 'Choose how you will take part, accept the pledge and sign with your name.' },
  { title: 'Pay the dues', text: 'Card, bank draft, check or in person. Membership starts once the application is approved and the dues are paid in full.' },
  { title: 'Approval', text: 'The membership office checks your ID and the Board approves applications at its meeting. You get an email when you are a member.' },
];

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
    // D10 demo – monthly contributors (hidden from the website; the rule below makes them members)
    { id: 'monthly', name: 'Monthly contributor', category: 'household', memberClass: 'natural', term: 'recurring', priceCents: 1000, unit: 'per month, at least',
      summary: 'Give monthly; once the year’s contributions reach the yearly total you and your spouse are members.', perks: ['Membership with your monthly gift'],
      votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: false, bundle: { maxMembers: 2 }, renewal: { anchor: 'calendar', mode: 'automatic', prorate: false, aheadLimitDays: 0 }, allowLevelChange: true },
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
  rules: { qualifyingGifts: { enabled: true, planId: 'monthly', label: 'Monthly contributors', minMonthlyCents: 1000, totalCents: 4000, cutoff: '06-30', countsGifts: 'recurring', coversSpouse: true, rollover: false }, lifetimeByDonation: { enabled: false, planId: 'life', thresholdCents: 2_500_000, window: 'all-time', needsApproval: true }, household: { definition: 'spouse', label: 'Husband and wife' }, approval: { by: 'Board', requireFullPayment: false, requireIdCheck: false }, classes: DEFAULT_CLASSES },
  identity: { nameMustMatchId: true, nameNote: 'Enter your name exactly as it appears on your government-issued photo ID. It is used for the election rolls.', policy: { enabled: true, title: 'Identity Collection and Verification Policy', url: '', text: DEFAULT_IDENTITY_TEXT }, consentRequired: true, consentText: 'I have read the Identity Collection and Verification Policy and agree that my identity may be verified as it describes.', consentVersion: 'identity-v1' },
  guide: { enabled: true, title: 'How to sign up', intro: 'Becoming a member takes about ten minutes online. Here is what to expect.', steps: DEFAULT_GUIDE_STEPS, help: 'Questions? Call the membership office or visit any Islamic Center.' },
  legal: { termsUrl: '/pages/terms', privacyUrl: '/pages/privacy' },
};

/**
 * ISGH's levels as they are in WildApricot today (seen 14 Oct 2026). Admin › Membership › "Use ISGH's current levels"
 * loads them into the draft so the Board can review before publishing. Renewal anchored on December 15.
 */
const dec15 = { anchor: 'date' as const, anchorDate: '12-15', mode: 'manual' as const, prorate: false, aheadLimitDays: 0 };
export const ISGH_WILDAPRICOT_LEVELS: Plan[] = [
  { id: 'individual', name: 'Individual', category: 'individual', memberClass: 'associate', term: 'calendar_year', priceCents: 2000, unit: 'per year', summary: 'One adult member.', perks: ['A vote in ISGH elections', 'Digital member card'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, renewal: { ...dec15, mode: 'automatic' }, allowLevelChange: true },
  { id: 'family', name: 'Family', category: 'household', memberClass: 'associate', term: 'calendar_year', priceCents: 7500, unit: 'per year', summary: 'You and your spouse.', perks: ['A vote for each of you', 'One renewal for both'], votingEligible: true, featured: true, maxYearsAhead: 5, multiYearDiscountPct: 0, requiresApproval: true, visible: false,
    termPrices: [{ years: 1, priceCents: 7500 }, { years: 3, priceCents: 18000 }, { years: 5, priceCents: 28500 }], bundle: { maxMembers: 2 }, renewal: dec15, allowLevelChange: true },
  { id: 'life-individual', name: 'Lifetime (individual)', category: 'individual', memberClass: 'associate', term: 'lifetime', priceCents: 100000, unit: 'one time', summary: 'Never renew again.', perks: ['Lifetime membership'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, allowLevelChange: false },
  { id: 'life-family', name: 'Lifetime (family)', category: 'household', memberClass: 'associate', term: 'lifetime', priceCents: 150000, unit: 'one time', summary: 'You and your spouse, for life.', perks: ['Lifetime membership for both'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, bundle: { maxMembers: 2 }, allowLevelChange: false },
  { id: 'checkomatic', name: 'Check-o-matic', category: 'individual', memberClass: 'associate', term: 'calendar_year', priceCents: 1000, unit: 'per year', summary: 'Monthly bank draft donors (existing members only).', perks: ['Membership with your monthly gift'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: false, renewal: dec15, allowLevelChange: true },
  { id: 'checkomatic-family', name: 'Check-o-matic (family)', category: 'household', memberClass: 'associate', term: 'calendar_year', priceCents: 1000, unit: 'per year', summary: 'Monthly bank draft donors, you and your spouse.', perks: ['Membership with your monthly gift'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: false, bundle: { maxMembers: 2 }, renewal: dec15, allowLevelChange: true },
  { id: 'unverified', name: 'Unverified', category: 'individual', memberClass: 'natural', term: 'lifetime', priceCents: 0, unit: 'holding level', summary: 'Waiting for ID or information checks. Not shown to the public.', perks: ['No vote until verified'], votingEligible: false, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: false, allowLevelChange: true },
];

/**
 * ISGH's membership as isgh.org/membership shows it (seen 17 Oct 2026): three categories – Check-o-matic (monthly
 * contributors, primary and spouse; the year's contributions must reach $40 by June 30), Individual $20 a year, and
 * Lifetime ($1,000 individual, $1,500 family, or by a $25,000 gift). Admin › Plans › "Start from a preset".
 */
export const ISGH_CURRENT_LEVELS: Plan[] = [
  { id: 'checkomatic', name: 'Checkomatic (primary and spouse)', category: 'household', memberClass: 'associate', term: 'recurring', priceCents: 1000, unit: 'per month, at least', summary: 'Give monthly by bank draft or card; you and your spouse are members for the year once the contributions reach the yearly total.', perks: ['A vote for each of you', 'No separate dues', 'Contributions support all centers'], votingEligible: true, featured: true, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, bundle: { maxMembers: 2 }, renewal: { anchor: 'calendar', mode: 'automatic', prorate: false, aheadLimitDays: 0 }, allowLevelChange: true },
  { id: 'individual', name: 'Individual', category: 'individual', memberClass: 'associate', term: 'calendar_year', priceCents: 2000, unit: 'per year', summary: 'One adult member, January to December.', perks: ['A vote in the elections', 'Digital member card'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, renewal: { anchor: 'calendar', mode: 'manual', prorate: false, aheadLimitDays: 0 }, allowLevelChange: true },
  { id: 'life-individual', name: 'Lifetime (individual)', category: 'individual', memberClass: 'associate', term: 'lifetime', priceCents: 100000, unit: 'one time', summary: 'Never renew again.', perks: ['Lifetime membership', 'Other voting rules still apply'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, allowLevelChange: false },
  { id: 'life-family', name: 'Lifetime (family)', category: 'household', memberClass: 'associate', term: 'lifetime', priceCents: 150000, unit: 'one time', summary: 'You and your spouse, for life.', perks: ['Lifetime membership for both'], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: true, bundle: { maxMembers: 2 }, allowLevelChange: false },
];
export const ISGH_CURRENT_RULES: MembershipRules = {
  qualifyingGifts: { enabled: true, planId: 'checkomatic', label: 'Checkomatic', minMonthlyCents: 1000, totalCents: 4000, cutoff: '06-30', countsGifts: 'recurring', coversSpouse: true, rollover: false },
  lifetimeByDonation: { enabled: true, planId: 'life-individual', thresholdCents: 2_500_000, window: 'all-time', needsApproval: true },
  household: { definition: 'spouse', label: 'Husband and wife' },
  approval: { by: 'Board', requireFullPayment: true, requireIdCheck: false },
  // 10/17 call (membership lead and leadership): "natural cannot vote" – natural is every Muslim in the community; the paid member is the associate member.
  classes: { natural: { label: 'Natural member', blurb: 'Every Muslim in the community. No dues and no vote.', canVote: false, offered: false }, associate: { label: 'Associate member', blurb: 'Pays dues; votes and may hold office when eligible.', canVote: true, offered: true }, reference: 'Constitution Art. III' },
};
export const DEFAULT_RULES: MembershipRules = mockMembershipSettings.rules;
/** Starting points for the plan list. Every organization edits from here; nothing in the product depends on a preset. */
export const PLAN_PRESETS: { id: string; name: string; blurb: string; plans: Plan[]; rules: MembershipRules }[] = [
  { id: 'isgh-2026', name: 'ISGH today (isgh.org, 2026)', blurb: 'Three categories: Checkomatic (monthly contributors, primary and spouse – $40 by June 30), Individual $20 a year, Lifetime $1,000 / $1,500 or by a $25,000 gift.', plans: ISGH_CURRENT_LEVELS, rules: ISGH_CURRENT_RULES },
  { id: 'wildapricot', name: 'ISGH in Wild Apricot (older levels)', blurb: 'The 7 levels as set up in Wild Apricot: Individual $20, Family $75 (3 years $180, 5 years $285), Lifetime $1,000 / $1,500, Check-o-matic and Unverified – renewing December 15.', plans: ISGH_WILDAPRICOT_LEVELS, rules: { ...ISGH_CURRENT_RULES, qualifyingGifts: { ...ISGH_CURRENT_RULES.qualifyingGifts, planId: 'checkomatic' } } },
  { id: 'bylaws', name: 'Bylaws minimums (demo)', blurb: 'Single $25, Family $40, Life $1,000 and Associate $25 – the demo set.', plans: mockMembershipSettings.plans, rules: DEFAULT_RULES },
];

/** Does a member on the qualifying-contributions plan count for a year? Gifts: when, how much, recurring or not. */
export function qualifiesByGifts(rule: MembershipRules['qualifyingGifts'], gifts: { on: string; cents: number; recurring?: boolean }[], year: number) {
  const by = `${year}-${rule.cutoff}`;
  const counted = gifts.filter((g) => g.on.slice(0, 4) === String(year) && g.on <= by && (rule.countsGifts === 'any' || g.recurring !== false));
  const total = counted.reduce((a, g) => a + g.cents, 0);
  return { ok: total >= rule.totalCents, total, needed: Math.max(0, rule.totalCents - total), by, gifts: counted.length };
}
/** Has a donor reached the lifetime-by-donation threshold? */
export function lifetimeByDonationReached(rule: MembershipRules['lifetimeByDonation'], gifts: { on: string; cents: number }[], year: number) {
  const pool = rule.window === 'calendar-year' ? gifts.filter((g) => g.on.slice(0, 4) === String(year)) : gifts;
  const total = rule.window === 'single-gift' ? Math.max(0, ...pool.map((g) => g.cents)) : pool.reduce((a, g) => a + g.cents, 0);
  return { ok: rule.enabled && total >= rule.thresholdCents, total, needed: Math.max(0, rule.thresholdCents - total) };
}
/** Plain words for the website and the join form. */
export function rulesInWords(s: Pick<MembershipSettings, 'rules' | 'plans'>): string[] {
  const out: string[] = []; const q = s.rules.qualifyingGifts; const l = s.rules.lifetimeByDonation;
  const plan = (id: string) => s.plans.find((p) => p.id === id)?.name ?? id;
  const md = (x: string) => new Date(`2001-${x}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  if (q.enabled) out.push(`${plan(q.planId)}: give at least ${formatUSD(q.minMonthlyCents)} a month; once the year's ${q.countsGifts === 'recurring' ? 'monthly contributions' : 'contributions'} reach ${formatUSD(q.totalCents)} by ${md(q.cutoff)}, ${q.coversSpouse ? 'you and your spouse are members' : 'you are a member'} for that year${q.rollover ? '' : ' (nothing carries into the next year)'}.`);
  if (l.enabled) out.push(`A ${l.window === 'single-gift' ? 'single gift' : l.window === 'calendar-year' ? 'year of giving' : 'lifetime of giving'} of ${formatUSD(l.thresholdCents)} or more makes you a ${plan(l.planId)} member${l.needsApproval ? ', once the ' + (s.rules.approval.by || 'Board') + ' confirms it' : ''}.`);
  if (s.plans.some((p) => p.category === 'household' && p.visible)) out.push(`Household plans cover ${s.rules.household.label.toLowerCase() || 'husband and wife'}.`);
  const cl = s.rules.classes; if (cl) for (const k of ['natural', 'associate'] as const) { const c = memberClass(s.rules, k); if (c.offered && !c.canVote) out.push(`${c.label}s do not vote or hold office.`); }
  if (s.rules.approval.requireFullPayment) out.push(`Membership starts when the ${s.rules.approval.by || 'Board'} approves the application and the dues are paid in full.`);
  return out;
}

/** D11 – what the giving page tells a monthly donor: the rule in short, or null when it is off. */
export type MonthlyOffer = { label: string; monthlyCents: number; totalCents: number; cutoff: string; planName: string; spouse: boolean };
export function monthlyOffer(s: Pick<MembershipSettings, 'rules' | 'plans'>): MonthlyOffer | null {
  const q = s.rules.qualifyingGifts; if (!q.enabled) return null;
  return { label: q.label || 'Monthly contributors', monthlyCents: q.minMonthlyCents, totalCents: q.totalCents, cutoff: q.cutoff, planName: s.plans.find((p) => p.id === q.planId)?.name ?? 'member', spouse: q.coversSpouse };
}
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
/** Extra household adults on one application (plan.familyMembers) – per member per year. */
export const familyCents = (plan: Plan | undefined, members: number, years: number) => (plan?.familyMembers ? Math.max(0, Math.min(members, plan.familyMembers.max)) * plan.familyMembers.perMemberCents * Math.max(1, years) : 0);

export function quote(plan: Plan, years: number) {
  const y = plan.term === 'calendar_year' ? Math.min(Math.max(1, years), plan.maxYearsAhead) : 1;
  const gross = plan.priceCents * y;
  // a fixed price for this many years (WildApricot 3-/5-year levels) wins over the percentage discount
  const fixed = plan.termPrices?.find((t) => t.years === y);
  const discount = fixed ? Math.max(0, gross - fixed.priceCents) : y > 1 ? Math.round((gross * plan.multiYearDiscountPct) / 100) : 0;
  return { years: y, grossCents: gross, discountCents: discount, totalCents: gross - discount };
}
