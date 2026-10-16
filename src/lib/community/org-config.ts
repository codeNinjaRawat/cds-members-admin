/**
 * CONTRACT – organization configuration (admin: Settings › Configuration). The switches and options that decide how
 * members, payments, the member card, the directory and security behave. WildApricot keeps these under
 * Settings › Global settings, Members › Membership fields / Card / Privacy, and Payment settings.
 */
import { z } from 'zod';

export const FieldSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'number', 'date', 'email', 'phone', 'choice', 'yesno', 'file']),
  options: z.array(z.string().max(60)).max(30).default([]),
  required: z.boolean().default(false),
  access: z.enum(['public', 'members', 'admins']).default('admins'),         // who can see the value
  memberEditable: z.boolean().default(false),
  inDirectory: z.boolean().default(false),
}).refine((f) => f.type !== 'choice' || f.options.length > 0, { path: ['options'], message: 'Add the choices.' })
  .refine((f) => !(f.access === 'admins' && (f.memberEditable || f.inDirectory)), { path: ['access'], message: 'An admin-only field cannot be edited by members or shown in the directory.' });

export const DiscountSchema = z.object({
  code: z.string().regex(/^[A-Z0-9-]{3,20}$/, 'Capital letters, numbers and dashes, 3–20 long'),
  kind: z.enum(['percent', 'amount']),
  value: z.number().min(0),
  appliesTo: z.enum(['plans', 'events', 'both']).default('plans'),
  planIds: z.array(z.string()).default([]),                                   // empty = all plans
  maxUses: z.number().int().min(0).default(0),                               // 0 = no limit
  used: z.number().int().min(0).default(0),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  oncePerPerson: z.boolean().default(true),                                  // the same email / member can use it once
  active: z.boolean().default(true),
}).refine((d) => d.kind !== 'percent' || d.value <= 100, { path: ['value'], message: 'A percent cannot be more than 100.' })
  .refine((d) => d.value > 0, { path: ['value'], message: 'A discount must take something off.' })
  .refine((d) => !d.startsOn || !d.endsOn || d.startsOn <= d.endsOn, { path: ['endsOn'], message: 'The last day must be on or after the first day.' })
  .refine((d) => d.kind !== 'amount' || Number.isInteger(Math.round(d.value * 100)) && Math.abs(d.value * 100 - Math.round(d.value * 100)) < 1e-6, { path: ['value'], message: 'Use dollars and cents, like 12.50.' });

/** Plain object (forms use its parts); OrgConfigSchema adds the cross-field checks. */
export const OrgConfigShape = z.object({
  members: z.object({
    directory: z.object({ enabled: z.boolean(), audience: z.enum(['members', 'public']).default('members'), optIn: z.boolean().default(true), showCenter: z.boolean().default(true), showPhone: z.boolean().default(false), showEmail: z.boolean().default(false) }),
    selfService: z.object({ editProfile: z.boolean(), renew: z.boolean(), changePlan: z.boolean(), cancelAutoRenew: z.boolean(), downloadReceipts: z.boolean() }),
    card: z.object({ enabled: z.boolean(), phoneImage: z.boolean().default(true), pdf: z.boolean().default(true), wallet: z.boolean().default(true), showPhoto: z.boolean().default(false), showCenter: z.boolean().default(true), showRenewal: z.boolean().default(true) }),
    duplicateCheck: z.boolean().default(true),                                // warn on same email / phone / name + DOB
    fields: z.array(FieldSchema).max(60),
  }),
  payments: z.object({
    card: z.boolean(), ach: z.boolean(), check: z.boolean(), cash: z.boolean(), payLater: z.boolean(),
    checkPendingStatus: z.boolean().default(true),                           // a check payment waits as "Check – waiting to clear"
    coverFees: z.object({ enabled: z.boolean(), percent: z.number().min(0).max(10).default(3), achPercent: z.number().min(0).max(5).default(0.8), achCapCents: z.number().int().min(0).max(100_00).default(500) }),
    payLaterDays: z.number().int().min(1).max(90).default(30),               // invoice due date for "pay later"
    invoicePrefix: z.string().regex(/^[A-Z0-9-]{2,10}$/).default('INV-'),
    receiptNote: z.string().max(300).default(''),
    refundPolicy: z.string().max(600).default(''),
  }).refine((p) => p.card || p.ach || p.check || p.cash || p.payLater, { path: ['card'], message: 'Turn on at least one way to pay.' }),
  discounts: z.object({ enabled: z.boolean(), codes: z.array(DiscountSchema).max(100) }),
  security: z.object({
    adminTwoStep: z.boolean(),
    sessionMinutes: z.number().int().min(15).max(720).default(120),
    idDocuments: z.object({ keepDays: z.number().int().min(0).max(3650).default(365), privateOnly: z.literal(true), needConsent: z.boolean().default(true) }),
  }),
  startPage: z.enum(['portal', 'profile', 'home', 'events']).default('portal'),
});
export const OrgConfigSchema = OrgConfigShape.superRefine((c, ctx) => {
  const seen = new Set<string>(); c.members.fields.forEach((f, i) => { if (seen.has(f.id)) ctx.addIssue({ code: 'custom', path: ['members', 'fields', i, 'id'], message: `Two fields use the id “${f.id}”.` }); seen.add(f.id); });
  const codes = new Set<string>(); c.discounts.codes.forEach((d, i) => { if (codes.has(d.code)) ctx.addIssue({ code: 'custom', path: ['discounts', 'codes', i, 'code'], message: `The code ${d.code} is used twice.` }); codes.add(d.code); });
});
export type OrgConfig = z.infer<typeof OrgConfigSchema>;
export type Discount = z.infer<typeof DiscountSchema>;
export type ProfileField = z.infer<typeof FieldSchema>;

/** Apply a discount code to an amount (server recomputes). */
export function applyDiscount(cfg: OrgConfig, code: string, amountCents: number, target: { kind: 'plan' | 'event'; planId?: string; usedBefore?: boolean }, today: string): { ok: boolean; cents: number; message: string } {
  if (!cfg.discounts.enabled) return { ok: false, cents: amountCents, message: 'Discount codes are not used here.' };
  const d = cfg.discounts.codes.find((x) => x.code === code.trim().toUpperCase());
  if (!d || !d.active) return { ok: false, cents: amountCents, message: 'That code is not valid.' };
  if (d.startsOn && today < d.startsOn) return { ok: false, cents: amountCents, message: 'That code is not active yet.' };
  if (d.endsOn && today > d.endsOn) return { ok: false, cents: amountCents, message: 'That code has expired.' };
  if (d.oncePerPerson && target.usedBefore) return { ok: false, cents: amountCents, message: 'You have already used that code.' };
  if (d.maxUses && d.used >= d.maxUses) return { ok: false, cents: amountCents, message: 'That code has been used up.' };
  if ((target.kind === 'plan' && d.appliesTo === 'events') || (target.kind === 'event' && d.appliesTo === 'plans')) return { ok: false, cents: amountCents, message: `That code is for ${d.appliesTo === 'events' ? 'events' : 'membership'} only.` };
  if (target.kind === 'plan' && d.planIds.length && (!target.planId || !d.planIds.includes(target.planId))) return { ok: false, cents: amountCents, message: 'That code is not for this plan.' };
  const off = d.kind === 'percent' ? Math.round((amountCents * d.value) / 100) : Math.round(d.value * 100);
  return { ok: true, cents: Math.max(0, amountCents - off), message: `${d.code}: ${d.kind === 'percent' ? `${d.value}% off` : `$${d.value} off`}` };
}
/** Optional gift to cover processing fees, rounded to the cent. Bank transfers cost less (and are capped); nothing on $0 or offline payments. */
export function feeCover(cfg: OrgConfig, amountCents: number, method: 'card' | 'ach' | string = 'card') {
  const c = cfg.payments.coverFees;
  if (!c.enabled || amountCents <= 0) return 0;
  if (method === 'ach') return Math.min(Math.round((amountCents * c.achPercent) / 100), c.achCapCents || Infinity);
  return method === 'card' ? Math.round((amountCents * c.percent) / 100) : 0;
}
/** Where a discount code stands today (admin list). */
export function codeStatus(d: Discount, today: string): 'active' | 'off' | 'scheduled' | 'expired' | 'used-up' {
  if (!d.active) return 'off';
  if (d.startsOn && today < d.startsOn) return 'scheduled';
  if (d.endsOn && today > d.endsOn) return 'expired';
  if (d.maxUses && d.used >= d.maxUses) return 'used-up';
  return 'active';
}
export const payMethods = (cfg: OrgConfig) => (['card', 'ach', 'check', 'cash', 'payLater'] as const).filter((m) => cfg.payments[m]);
export const PAY_LABEL = { card: 'Card (Stripe)', ach: 'Bank transfer (ACH)', check: 'Check', cash: 'Cash at a center', payLater: 'Pay later (invoice)' } as const;

export const mockOrgConfig: OrgConfig = {
  members: {
    directory: { enabled: false, audience: 'members', optIn: true, showCenter: true, showPhone: false, showEmail: false },
    selfService: { editProfile: true, renew: true, changePlan: true, cancelAutoRenew: true, downloadReceipts: true },
    card: { enabled: true, phoneImage: true, pdf: true, wallet: true, showPhoto: false, showCenter: true, showRenewal: true },
    duplicateCheck: true,
    fields: [
      { id: 'tx-id-number', label: 'Texas driver license / ID number', type: 'text', options: [], required: false, access: 'admins', memberEditable: false, inDirectory: false },
      { id: 'profession', label: 'Profession or skills', type: 'text', options: [], required: false, access: 'members', memberEditable: true, inDirectory: true },
      { id: 'entered-by', label: 'Entered by', type: 'text', options: [], required: false, access: 'admins', memberEditable: false, inDirectory: false },
      { id: 'payment-processed', label: 'Payment processed', type: 'yesno', options: [], required: false, access: 'admins', memberEditable: false, inDirectory: false },
      { id: 'follow-up', label: 'Follow up', type: 'text', options: [], required: false, access: 'admins', memberEditable: false, inDirectory: false },
      { id: 'paper-form', label: 'Paper membership form', type: 'file', options: [], required: false, access: 'admins', memberEditable: false, inDirectory: false },
    ],
  },
  payments: { card: true, ach: false, check: true, cash: false, payLater: false, checkPendingStatus: true, coverFees: { enabled: true, percent: 3, achPercent: 0.8, achCapCents: 500 }, payLaterDays: 30, invoicePrefix: 'INV-', receiptNote: 'ISGH is a 501(c)(3) nonprofit. Dues are not tax-deductible; gifts are.', refundPolicy: 'Dues are not refundable.' },
  discounts: { enabled: false, codes: [{ code: 'NEWMUSLIM', kind: 'percent', value: 100, appliesTo: 'plans', planIds: ['single'], maxUses: 0, used: 0, oncePerPerson: true, active: true }] },
  security: { adminTwoStep: true, sessionMinutes: 120, idDocuments: { keepDays: 365, privateOnly: true, needConsent: true } },
  startPage: 'portal',
};

/* ---------- review step 8: security, card, self-service, start page ---------- */
/** Where members land after signing in (Configuration › Start page). */
export const START_PATH: Record<OrgConfig['startPage'], string> = { portal: '/portal', profile: '/portal#det-h', home: '/', events: '/events' };
/** Settings that are allowed but risky – shown in Configuration › Security so the Board decides knowingly. */
export function securityWarnings(cfg: OrgConfig): string[] {
  const w: string[] = [];
  const s = cfg.security, d = cfg.members.directory;
  if (!s.adminTwoStep) w.push('Two-step sign-in for admins is off. Admins can see every member’s details – turn it on.');
  if (s.sessionMinutes > 240) w.push(`Admins stay signed in for ${Math.round(s.sessionMinutes / 60)} hours without activity. On shared center computers, 2 hours or less is safer.`);
  if (s.idDocuments.keepDays === 0) w.push('Photo IDs are kept forever. Set how long to keep them (for example 365 days after the check).');
  else if (s.idDocuments.keepDays > 730) w.push(`Photo IDs are kept ${s.idDocuments.keepDays} days. Keep them only as long as you need them.`);
  if (!s.idDocuments.needConsent) w.push('Members are not asked to agree before uploading a photo ID.');
  if (d.enabled && d.audience === 'public' && !d.optIn) w.push('The member directory is public and lists everyone without asking them first.');
  if (d.enabled && (d.showPhone || d.showEmail) && !d.optIn) w.push('Phones or emails are shown in the directory without members opting in.');
  const pub = cfg.members.fields.filter((f) => f.access === 'public');
  if (pub.length) w.push(`Shown to anyone on the website: ${pub.map((f) => f.label).join(', ')}.`);
  return w;
}
/** Photo IDs whose keep period is over (the BE deletes the file and keeps only "verified on <date> by <admin>"). */
export function idPurgeDue(checkedOn: string | null, keepDays: number, today: string): boolean {
  if (!checkedOn || keepDays === 0) return false;
  return Date.parse(`${today}T12:00:00Z`) - Date.parse(`${checkedOn.slice(0, 10)}T12:00:00Z`) > keepDays * 86_400_000;
}
