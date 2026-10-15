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
});

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
};

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
  const discount = y > 1 ? Math.round((gross * plan.multiYearDiscountPct) / 100) : 0;
  return { years: y, grossCents: gross, discountCents: discount, totalCents: gross - discount };
}
