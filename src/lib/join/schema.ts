/**
 * Join application – validation shared by the browser (each step) and the server (/api/membership/applications).
 * Rules are built from admin settings (min age, plans, commitments, service area …) – never hard-coded.
 * Messages follow memory/09-content-style-guide.md (say what is wrong + how to fix).
 */
import { z } from 'zod';
import { ageOn, memberClass, type MembershipSettings } from '@/lib/content/membership';

export const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'] as const;

const name = (label: string) => z.string().trim().min(1, `Enter your ${label}.`).max(60, `${label[0].toUpperCase() + label.slice(1)} is too long.`)
  .regex(/^[\p{L}][\p{L}' .-]*$/u, `Use letters only in your ${label}.`);

export const todayISO = (tz = 'America/Chicago') =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const digits = (s: string) => s.replace(/\D/g, '');

export function makeJoinSchemas(settings: MembershipSettings, today = todayISO(settings.timezone)) {
  const account = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address, like name@example.com.').max(254),
    verified: z.literal(true, { errorMap: () => ({ message: 'Verify your email with the 6-digit code first.' }) }),
  });

  const about = z.object({
    firstName: name('first name'),
    middleName: z.string().trim().max(60).optional().or(z.literal('')),
    lastName: name('last name'),
    preferredName: z.string().trim().max(60).optional().or(z.literal('')),
    idNumber: z.string().trim().max(40, 'The ID number is too long.').optional().or(z.literal('')),   // asked when the form switches it on
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth.')
      .refine((d) => d < today, 'Date of birth must be in the past.')
      .refine((d) => ageOn(d, today) <= 120, 'Check the year of your date of birth.')
      .refine((d) => ageOn(d, today) >= settings.minMemberAge, `You must be at least ${settings.minMemberAge} to become a member.`),
    phone: z.string().refine((p) => digits(p).replace(/^1/, '').length === 10, 'Enter a 10-digit US phone number, like (713) 555-0123.'),
    street: z.string().trim().min(3, 'Enter your street address.').max(120),
    unit: z.string().trim().max(30).optional().or(z.literal('')),
    city: z.string().trim().min(2, 'Enter your city.').max(60),
    state: z.enum(US_STATES, { errorMap: () => ({ message: 'Choose your state.' }) }),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit ZIP code, like 77036.'),
    centerId: z.string().min(1, 'Find your Islamic Center to continue.'),
    zoneId: z.string().min(1),
    borderRequestCenterId: z.string().optional().or(z.literal('')),
  });

  const visiblePlans = settings.plans.filter((p) => p.visible);
  const plan = z.object({
    memberClass: z.enum(['natural', 'associate'], { errorMap: () => ({ message: 'Choose how you are joining.' }) }),
    planId: z.string().refine((id) => visiblePlans.some((p) => p.id === id), 'Choose a plan.'),
    years: z.number().int().min(1),
    spouse: z.object({
      firstName: z.string().trim().max(60).optional().or(z.literal('')),
      lastName: z.string().trim().max(60).optional().or(z.literal('')),
      email: z.string().trim().toLowerCase().max(254).optional().or(z.literal('')),
    }).optional(),
    // monthly plans: the amount they give each month (at least the plan's minimum) and, when offered, the fund
    monthlyCents: z.number().int().nonnegative().max(1_000_000).optional(),
    fund: z.string().trim().max(60).optional().or(z.literal('')),
    // "Pay for family members" (plan.familyMembers): other adults of the household, each their own member
    members: z.array(z.object({
      firstName: z.string().trim().max(60), lastName: z.string().trim().max(60),
      email: z.string().trim().toLowerCase().max(254), phone: z.string().max(30), dob: z.string().max(10),
    })).max(10).optional(),
  }).superRefine((v, ctx) => {
    const p = visiblePlans.find((x) => x.id === v.planId);
    if (!p) return;
    if (p.term === 'recurring' && (v.monthlyCents ?? 0) < p.priceCents) ctx.addIssue({ code: 'custom', path: ['monthlyCents'], message: `The monthly amount is at least $${(p.priceCents / 100).toFixed(p.priceCents % 100 ? 2 : 0)}.` });
    if (p.term === 'recurring' && p.fundChoices?.length && !p.fundChoices.includes(v.fund ?? '')) ctx.addIssue({ code: 'custom', path: ['fund'], message: 'Choose where your monthly gift goes.' });
    const ms = v.members ?? [];
    if (ms.length && !p.familyMembers) ctx.addIssue({ code: 'custom', path: ['members'], message: 'This plan is for one person – choose a plan that includes family members.' });
    if (p.familyMembers && ms.length > p.familyMembers.max) ctx.addIssue({ code: 'custom', path: ['members'], message: `Add up to ${p.familyMembers.max} family members.` });
    const seenE = new Set<string>(); const seenP = new Set<string>();
    ms.forEach((m, i) => {
      const at = (k: string) => ['members', i, k];
      if (!m.firstName) ctx.addIssue({ code: 'custom', path: at('firstName'), message: `Enter family member ${i + 1}'s first name.` });
      if (!m.lastName) ctx.addIssue({ code: 'custom', path: at('lastName'), message: `Enter family member ${i + 1}'s last name.` });
      if (!z.string().email().safeParse(m.email).success) ctx.addIssue({ code: 'custom', path: at('email'), message: `Enter family member ${i + 1}'s own email, like name@example.com – it is their sign-in.` });
      else if (seenE.has(m.email)) ctx.addIssue({ code: 'custom', path: at('email'), message: 'Each family member needs their own email address.' });
      seenE.add(m.email);
      const ph = digits(m.phone).replace(/^1(?=\d{10}$)/, '');
      if (ph.length !== 10) ctx.addIssue({ code: 'custom', path: at('phone'), message: `Enter family member ${i + 1}'s 10-digit mobile number.` });
      else if (seenP.has(ph)) ctx.addIssue({ code: 'custom', path: at('phone'), message: 'Each family member needs their own mobile number.' });
      seenP.add(ph);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.dob) || m.dob >= today) ctx.addIssue({ code: 'custom', path: at('dob'), message: `Enter family member ${i + 1}'s date of birth.` });
      else if (ageOn(m.dob, today) < settings.minMemberAge) ctx.addIssue({ code: 'custom', path: at('dob'), message: `Family members must be at least ${settings.minMemberAge} to join.` });
    });
    if (p.memberClass !== v.memberClass) ctx.addIssue({ code: 'custom', path: ['planId'], message: 'This plan does not match how you are joining. Choose another plan.' });
    if (v.years > p.maxYearsAhead) ctx.addIssue({ code: 'custom', path: ['years'], message: `You can pay up to ${p.maxYearsAhead} year(s) ahead for this plan.` });
    if (p.category === 'household') {
      const s = v.spouse ?? {};
      if (!s.firstName) ctx.addIssue({ code: 'custom', path: ['spouse', 'firstName'], message: "Enter your spouse's first name." });
      if (!s.lastName) ctx.addIssue({ code: 'custom', path: ['spouse', 'lastName'], message: "Enter your spouse's last name." });
      if (!s.email || !z.string().email().safeParse(s.email).success) ctx.addIssue({ code: 'custom', path: ['spouse', 'email'], message: "Enter your spouse's email so we can invite them, like name@example.com." });
    }
  });

  const pledge = z.object({
    commitments: z.array(z.string()),
    pledgeAccepted: z.literal(true, { errorMap: () => ({ message: 'Tick the box to continue.' }) }),
    signature: z.string().trim().max(120).optional().or(z.literal('')),   // asked when the form shows it
    emailConsent: z.boolean(),
    smsConsent: z.boolean(),
    identityConsent: z.boolean().optional(),
  });

  const payment = z.object({
    payer: z.enum(['self', 'relative']),
    payerRelationship: z.string().optional().or(z.literal('')),
    payerName: z.string().trim().max(120).optional().or(z.literal('')),
  }).superRefine((v, ctx) => {
    if (v.payer === 'relative') {
      if (!v.payerRelationship || !settings.payerRelationships.includes(v.payerRelationship))
        ctx.addIssue({ code: 'custom', path: ['payerRelationship'], message: 'Choose how the payer is related to you.' });
      if (!v.payerName) ctx.addIssue({ code: 'custom', path: ['payerName'], message: "Enter the payer's full name." });
    }
  });

  const application = z.object({ account, about, plan, pledge, payment, pledgeVersion: z.string(), emailConsentVersion: z.string(), smsConsentVersion: z.string(), identityConsentVersion: z.string().optional() })
    .superRefine((v, ctx) => {
      const full = `${v.about.firstName} ${v.about.lastName}`.toLowerCase().replace(/\s+/g, ' ');
      if ((v.pledge.signature ?? '').toLowerCase().replace(/\s+/g, ' ') !== full)   // the form fills the name in when it does not ask for a signature
        ctx.addIssue({ code: 'custom', path: ['pledge', 'signature'], message: `Type your name exactly as entered: ${v.about.firstName} ${v.about.lastName}.` });
      // each person keeps their own contact (their own sign-in and messages)
      const se = (v.plan.spouse?.email ?? '').trim().toLowerCase();
      if (se && se === v.account.email.trim().toLowerCase()) ctx.addIssue({ code: 'custom', path: ['plan', 'spouse', 'email'], message: 'Your spouse needs their own email address – not the same as yours.' });
      (v.plan.members ?? []).forEach((m, i) => {
        if (m.email && m.email === v.account.email.trim().toLowerCase()) ctx.addIssue({ code: 'custom', path: ['plan', 'members', i, 'email'], message: 'Each family member needs their own email – not the same as yours.' });
        if (digits(m.phone).slice(-10) && digits(m.phone).slice(-10) === digits(v.about.phone).slice(-10)) ctx.addIssue({ code: 'custom', path: ['plan', 'members', i, 'phone'], message: 'Each family member needs their own mobile number – not the same as yours.' });
      });
    });

  return { account, about, plan, pledge, payment, application };
}

export type JoinSchemas = ReturnType<typeof makeJoinSchemas>;
export type JoinApplication = z.infer<JoinSchemas['application']>;

/** zod error → { "field.path": "message" } (first message per field) */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = i.path.join('.'); if (!out[k]) out[k] = i.message; }
  return out;
}

/** Voting-eligibility preview shown before paying (final decision is made by the BE rules engine). */
export function votingPreview(settings: MembershipSettings, input: { dob: string; memberClass: string; planId: string; commitments: string[]; state: string; payer: string }, today = todayISO(settings.timezone)) {
  const plan = settings.plans.find((p) => p.id === input.planId);
  const reasons: string[] = [];
  const cls = memberClass(settings.rules, input.memberClass);
  if (!cls.canVote) reasons.push(`${cls.label}s do not vote or hold office.`);
  else if (!plan?.votingEligible) reasons.push(`The ${plan?.name ?? 'chosen'} plan does not include a vote.`);
  if (today > settings.recordDate.slice(0, 10)) reasons.push(`The ${settings.year} voting deadline (June 30) has passed. Your membership still starts now.`);
  if (input.dob && ageOn(input.dob, settings.recordDate) < settings.minVotingAge) reasons.push(`You must be ${settings.minVotingAge} by June 30 to vote.`);
  if (input.commitments.length === 0) reasons.push('Choose at least one commitment to be eligible to vote.');
  if (!settings.serviceArea.states.includes(input.state)) reasons.push(`Voting members must live in ${settings.serviceArea.label}.`);
  return { eligible: reasons.length === 0, reasons };
}
