/**
 * CONTRACT – communication settings (admin: Communication). System emails (on/off, subject, text, who gets them),
 * saved templates, merge fields, sending settings, text messages, tracking. The BE sends; the demo only previews.
 */
import { z } from 'zod';
import type { Lifecycle } from '@/lib/content/membership';
import { addDays, fmtDay, type ISODate } from '@/lib/content/renewal';

export const SYSTEM_EMAILS = {
  'application-received': { label: 'Application received', group: 'Applications', when: 'Right after someone applies' },
  'member-activated': { label: 'Membership active', group: 'Applications', when: 'When the application is approved and paid' },
  'bundle-member-activated': { label: 'Household member added', group: 'Applications', when: 'When a spouse is added to a family plan' },
  'renewal-reminder-1': { label: 'Renewal reminder 1', group: 'Renewals', when: 'First reminder before the renewal date' },
  'renewal-reminder-2': { label: 'Renewal reminder 2', group: 'Renewals', when: 'Second reminder before the renewal date' },
  'renewal-day': { label: 'Renewal date notice', group: 'Renewals', when: 'On the renewal date' },
  'grace-notice': { label: 'Grace period notice', group: 'Renewals', when: 'When the grace period ends' },
  'lapsed-notice': { label: 'Membership lapsed', group: 'Renewals', when: 'When the membership becomes overdue' },
  'renewal-confirmed': { label: 'Renewal confirmed', group: 'Renewals', when: 'After a renewal is paid' },
  'auto-renew-failed': { label: 'Automatic renewal failed', group: 'Payments', when: 'When a card payment for renewal fails' },
  'card-expiring': { label: 'Card expiring', group: 'Payments', when: '30 days before a saved card expires' },
  invoice: { label: 'Invoice', group: 'Payments', when: 'When an invoice is created' },
  receipt: { label: 'Payment receipt', group: 'Payments', when: 'After every payment' },
  'level-changed': { label: 'Plan changed', group: 'Applications', when: 'When a member moves to another plan' },
  'event-registered': { label: 'Event registration confirmed', group: 'Events', when: 'After someone registers for an event' },
  'event-waitlist': { label: 'Added to the waitlist', group: 'Events', when: 'When an event is full and the person is waitlisted' },
  'event-spot-open': { label: 'A spot opened up', group: 'Events', when: 'When someone cancels and the next person on the waitlist gets a spot' },
  'event-reminder': { label: 'Event reminder', group: 'Events', when: 'Days before the event (set on each event)' },
  'donation-receipt': { label: 'Donation receipt', group: 'Giving', when: 'After a gift (tax receipt)' },
} as const;
export type SystemEmailKey = keyof typeof SYSTEM_EMAILS;
export const SYSTEM_EMAIL_KEYS = Object.keys(SYSTEM_EMAILS) as SystemEmailKey[];

export const MACROS = [
  { key: 'Member.FirstName', label: 'First name' }, { key: 'Member.LastName', label: 'Last name' }, { key: 'Member.Id', label: 'Member ID' },
  { key: 'Member.Plan', label: 'Plan' }, { key: 'Member.RenewalDate', label: 'Renewal date' }, { key: 'Member.Center', label: 'Islamic Center' }, { key: 'Member.Zone', label: 'Zone' },
  { key: 'Org.Name', label: 'Organization name' }, { key: 'Org.ShortName', label: 'Short name' }, { key: 'Org.Phone', label: 'Phone' },
  { key: 'Link.Renew', label: 'Renew link' }, { key: 'Link.Profile', label: 'Profile link' }, { key: 'Link.Unsubscribe', label: 'Email preferences link' },
  { key: 'Invoice.Number', label: 'Invoice number' }, { key: 'Invoice.Amount', label: 'Amount' },
  { key: 'Event.Title', label: 'Event title' }, { key: 'Event.Date', label: 'Event date and time' }, { key: 'Event.Place', label: 'Event place' },
] as const;
export type MacroKey = (typeof MACROS)[number]['key'];

/** A subject is one line: a line break in a header could add hidden headers (header injection). */
const Subject = z.string().min(1, 'Write a subject').max(150).refine((v) => !/[\r\n]/.test(v), 'A subject must be one line.');
const EmailSchema = z.object({
  enabled: z.boolean(),
  subject: Subject,
  body: z.string().min(1, 'Write the message').max(5000),
  to: z.enum(['member', 'member-and-admins', 'admins']).default('member'),
});
export const TemplateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().min(1).max(80),
  category: z.enum(['announcement', 'newsletter', 'renewal', 'election', 'fundraising', 'religious', 'other']).default('announcement'),
  subject: Subject,
  body: z.string().min(1).max(10_000),
  archived: z.boolean().default(false),
});
/** Plain object (forms use its parts); CommunicationSchema adds the cross-field checks. */
export const CommunicationShape = z.object({
  sender: z.object({
    fromName: z.string().min(2).max(80),
    replyTo: z.string().email(),
    ccAdmins: z.array(z.string().email()).max(10).default([]),
    footer: z.string().max(600),                                              // must include a postal address (CAN-SPAM)
  }),
  tracking: z.object({ opens: z.boolean().default(true), clicks: z.boolean().default(true) }),
  sms: z.object({
    enabled: z.boolean().default(false),
    purposes: z.array(z.enum(['renewal-reminders', 'event-reminders', 'sign-in-codes', 'emergency'])).default(['sign-in-codes']),
    quietHours: z.object({ from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/) }),
    consentText: z.string().min(10).max(400),
  }),
  groupEmailsByLeaders: z.boolean().default(false),
  system: z.record(z.string(), EmailSchema),
  templates: z.array(TemplateSchema).max(200),
});
export const CommunicationSchema = CommunicationShape.superRefine((c, ctx) => {
  for (const k of SYSTEM_EMAIL_KEYS) if (!c.system[k]) ctx.addIssue({ code: 'custom', path: ['system', k], message: `Missing system email “${SYSTEM_EMAILS[k].label}”.` });
  for (const k of SYSTEM_EMAIL_KEYS) { const e = c.system[k]; if (!e) continue; for (const p of systemEmailProblems(k, e)) ctx.addIssue({ code: 'custom', path: ['system', k, p.field], message: p.message }); }
  c.templates.forEach((t, i) => { for (const m of `${t.subject}\n${t.body}`.matchAll(/\{(Invoice|Event)\.([A-Za-z]+)\}/g)) ctx.addIssue({ code: 'custom', path: ['templates', i, 'body'], message: `{${m[1]}.${m[2]}} has no value in a message to many people.` }); });
  if (!/\d{5}/.test(c.sender.footer)) ctx.addIssue({ code: 'custom', path: ['sender', 'footer'], message: 'Bulk email must show your postal address (with ZIP code).' });
  const all = [...Object.entries(c.system).map(([k, e]) => [`system.${k}`, e.subject + e.body] as const), ...c.templates.map((t, i) => [`templates.${i}`, t.subject + t.body] as const)];
  for (const [p, text] of all) for (const m of text.matchAll(/\{([A-Za-z.]+)\}/g)) if (!MACROS.some((x) => x.key === m[1])) ctx.addIssue({ code: 'custom', path: [...p.split('.'), 'body'], message: `Unknown merge field {${m[1]}}.` });
});
export type CommunicationDoc = z.infer<typeof CommunicationSchema>;
export type Template = z.infer<typeof TemplateSchema>;

/** Fill merge fields. Unknown or missing values are left visible as [Label] so nothing is sent half-empty silently. */
export function render(text: string, values: Partial<Record<MacroKey, string>>) {
  return text.replace(/\{([A-Za-z.]+)\}/g, (m, k: string) => values[k as MacroKey] ?? `[${MACROS.find((x) => x.key === k)?.label ?? k}]`);
}
export const SAMPLE_VALUES: Partial<Record<MacroKey, string>> = {
  'Member.FirstName': 'Aisha', 'Member.LastName': 'Rahman', 'Member.Id': 'HOU-104233', 'Member.Plan': 'Family', 'Member.RenewalDate': '12/15/2026',
  'Member.Center': 'Masjid Abubakr – HWY 3', 'Member.Zone': 'Southeast', 'Org.Name': 'Islamic Society of Greater Houston', 'Org.ShortName': 'ISGH', 'Org.Phone': '(713) 524-6615',
  'Link.Renew': 'https://member-web.nextgrow.pro/membership/renew', 'Link.Profile': 'https://member-web.nextgrow.pro/portal', 'Link.Unsubscribe': 'https://member-web.nextgrow.pro/email-preferences', 'Invoice.Number': 'INV-2026-00412', 'Invoice.Amount': '$75.00',
  'Event.Title': 'Family night at Katy', 'Event.Date': '11/07/2026, 6:30 PM', 'Event.Place': 'Masjid Aqsa – Katy',
};

const e = (subject: string, body: string, enabled = true, to: 'member' | 'member-and-admins' | 'admins' = 'member') => ({ enabled, subject, body, to });
export const mockCommunication: CommunicationDoc = {
  sender: { fromName: 'ISGH Membership', replyTo: 'membership@isgh.org', ccAdmins: [], footer: 'Islamic Society of Greater Houston · 3110 Eastside St, Houston, TX 77098 · You get this because you are an ISGH member.' },
  tracking: { opens: true, clicks: true },
  sms: { enabled: false, purposes: ['sign-in-codes', 'renewal-reminders'], quietHours: { from: '21:00', to: '08:00' }, consentText: 'Text me reminders and alerts. Message and data rates may apply. Reply STOP to opt out.' },
  groupEmailsByLeaders: false,
  system: {
    'application-received': e('We received your application, {Member.FirstName}', 'Assalamu alaikum {Member.FirstName},\n\nThank you for applying for {Org.ShortName} membership ({Member.Plan}). We will check your information and let you know when your membership is active.'),
    'member-activated': e('Welcome to {Org.ShortName}, {Member.FirstName}', 'Your membership is active. Your member ID is {Member.Id}. Your card is in your member home: {Link.Profile}', true, 'member-and-admins'),
    'bundle-member-activated': e('You were added to a family membership', 'Assalamu alaikum {Member.FirstName}, you are now part of a {Org.ShortName} family membership. Set your password here: {Link.Profile}'),
    'renewal-reminder-1': e('Time to renew your {Org.ShortName} membership', 'Your membership renews on {Member.RenewalDate}. Renew now to keep your vote: {Link.Renew}'),
    'renewal-reminder-2': e('Reminder: renew by {Member.RenewalDate}', 'Your {Member.Plan} membership renews on {Member.RenewalDate}. Renew here: {Link.Renew}'),
    'renewal-day': e('Your membership renews today', 'Your membership renews today. Renew to stay active: {Link.Renew}'),
    'grace-notice': e('Your membership is past due', 'We have not received your renewal. Renew now so your membership does not lapse: {Link.Renew}'),
    'lapsed-notice': e('Your membership has lapsed', 'Your {Org.ShortName} membership has lapsed. You can renew any time: {Link.Renew}', true, 'member-and-admins'),
    'renewal-confirmed': e('Thank you for renewing, {Member.FirstName}', 'Your membership is renewed until {Member.RenewalDate}. JazakAllahu khairan.'),
    'auto-renew-failed': e('We could not renew your membership', 'Your card payment for renewal did not go through. Please update your card: {Link.Profile}', true, 'member-and-admins'),
    'card-expiring': e('Your saved card expires soon', 'Please update your card before your next renewal: {Link.Profile}'),
    invoice: e('Invoice {Invoice.Number} from {Org.ShortName}', 'Amount due: {Invoice.Amount}. Pay online: {Link.Renew}'),
    receipt: e('Receipt for your payment', 'We received {Invoice.Amount} for invoice {Invoice.Number}. Thank you.'),
    'level-changed': e('Your plan was changed', 'Your membership plan is now {Member.Plan}. Renewal date: {Member.RenewalDate}.'),
    'event-registered': e('You are registered: {Event.Title}', 'See you on {Event.Date} at {Event.Place}.'),
    'event-waitlist': e('You are on the waitlist: {Event.Title}', 'The event is full. We will email you if a spot opens.'),
    'event-spot-open': e('A spot opened up: {Event.Title}', 'Good news – you now have a spot for {Event.Title} on {Event.Date}.'),
    'event-reminder': e('Reminder: {Event.Title}', '{Event.Title} is on {Event.Date} at {Event.Place}. We look forward to seeing you.'),
    'donation-receipt': e('Receipt for your gift to {Org.ShortName}', 'JazakAllahu khairan for your gift of {Invoice.Amount}. No goods or services were provided in exchange for this gift. {Org.Name} is a 501(c)(3) nonprofit; keep this email as your tax receipt.', true),
  },
  templates: [
    { id: 'monthly-newsletter', name: 'Monthly newsletter', category: 'newsletter', subject: '{Org.ShortName} newsletter – what is new this month', body: 'Assalamu alaikum {Member.FirstName},\n\nHere is what is happening across our Islamic Centers this month…', archived: false },
    { id: 'agm-notice', name: 'Annual General Meeting notice', category: 'election', subject: 'Annual General Meeting – your voice matters', body: 'Dear {Member.FirstName},\n\nThe Annual General Meeting is on … at the ISGH Main Center.', archived: false },
    { id: 'zakat-appeal', name: 'Zakat appeal', category: 'fundraising', subject: 'Give your Zakat where it stays in Houston', body: 'Your Zakat helps families in need across Greater Houston…', archived: false },
    { id: 'ramadan-schedule', name: 'Ramadan schedule', category: 'religious', subject: 'Ramadan schedule at {Member.Center}', body: 'Taraweeh, iftar and Qiyam times for your center…', archived: false },
    { id: 'census-2020', name: '2020 Census (old)', category: 'other', subject: 'Be counted', body: 'Old message kept for history.', archived: true },
  ],
};

/* ======================= system emails: rules (review step 4) ======================= */
type Prefix = 'Member' | 'Org' | 'Link' | 'Invoice' | 'Event';
const BASE: Prefix[] = ['Member', 'Org', 'Link'];
/** Merge fields that have a value in each email. {Event.Title} in a renewal email would be empty – refused. */
export function contextOf(k: SystemEmailKey): Prefix[] {
  if (k.startsWith('event-')) return [...BASE, 'Event'];
  if (['invoice', 'receipt', 'auto-renew-failed', 'donation-receipt', 'renewal-confirmed'].includes(k)) return [...BASE, 'Invoice'];
  return BASE;
}
/** What each email must contain to do its job. */
export const MUST_INCLUDE: Partial<Record<SystemEmailKey, MacroKey[]>> = {
  'renewal-reminder-1': ['Link.Renew'], 'renewal-reminder-2': ['Link.Renew'], 'renewal-day': ['Link.Renew'], 'grace-notice': ['Link.Renew'], 'lapsed-notice': ['Link.Renew'],
  invoice: ['Invoice.Number', 'Invoice.Amount'], receipt: ['Invoice.Amount'], 'donation-receipt': ['Invoice.Amount'],
  'auto-renew-failed': ['Link.Profile'], 'event-registered': ['Event.Title', 'Event.Date'], 'event-reminder': ['Event.Title', 'Event.Date'], 'event-spot-open': ['Event.Title'],
};
/** Receipts are records people rely on (and the IRS needs for gifts) – they cannot be switched off or sent only to admins. */
export const ALWAYS_ON: SystemEmailKey[] = ['receipt', 'donation-receipt'];
/** Emails whose whole point is to reach the member. */
export const MEMBER_MUST_GET: SystemEmailKey[] = ['receipt', 'donation-receipt', 'invoice', 'auto-renew-failed', 'event-registered', 'event-spot-open', 'renewal-confirmed', 'application-received'];
export function systemEmailProblems(k: SystemEmailKey, e: { enabled: boolean; subject: string; body: string; to: string }): { field: 'enabled' | 'subject' | 'body' | 'to'; message: string }[] {
  const out: { field: 'enabled' | 'subject' | 'body' | 'to'; message: string }[] = [];
  const ctx = contextOf(k); const text = `${e.subject}\n${e.body}`;
  for (const m of text.matchAll(/\{([A-Za-z]+)\.([A-Za-z]+)\}/g)) if (MACROS.some((x) => x.key === `${m[1]}.${m[2]}`) && !ctx.includes(m[1] as Prefix)) out.push({ field: 'body', message: `{${m[1]}.${m[2]}} has no value in “${SYSTEM_EMAILS[k].label}”.` });
  for (const need of MUST_INCLUDE[k] ?? []) if (!text.includes(`{${need}}`)) out.push({ field: 'body', message: `Add {${need}} – this email needs the ${MACROS.find((x) => x.key === need)!.label.toLowerCase()}.` });
  if (k === 'donation-receipt' && !/goods or services/i.test(e.body)) out.push({ field: 'body', message: 'A gift receipt must say whether any goods or services were given in return (IRS rule for gifts of $250 or more), e.g. “No goods or services were provided in exchange for this gift.”' });
  if (ALWAYS_ON.includes(k) && !e.enabled) out.push({ field: 'enabled', message: `“${SYSTEM_EMAILS[k].label}” cannot be switched off – people need it as a record.` });
  if (MEMBER_MUST_GET.includes(k) && e.to === 'admins') out.push({ field: 'to', message: 'This email is for the member – send it to the member (and admins if you like).' });
  return out;
}

/** Which system email goes out for each renewal step (lifecycle from Membership › Renewals). Reminders: earliest = 1, on the day = renewal date notice, others = 2. */
export type RenewalMail = { daysFromRenewal: number; key: SystemEmailKey; enabled: boolean; why: string };
export function renewalEmails(lc: Lifecycle, comm: Pick<CommunicationDoc, 'system'>): RenewalMail[] {
  const on = (k: SystemEmailKey) => !!comm.system[k]?.enabled;
  const rem = [...lc.reminders].sort((a, b) => b.daysBefore - a.daysBefore);
  const out: RenewalMail[] = rem.map((r, i) => {
    const key: SystemEmailKey = r.daysBefore === 0 ? 'renewal-day' : i === 0 ? 'renewal-reminder-1' : 'renewal-reminder-2';
    return { daysFromRenewal: -r.daysBefore, key, enabled: on(key), why: r.daysBefore === 0 ? 'Reminder on the renewal date' : `Reminder ${r.daysBefore} days before${r.createInvoice ? ' (with the invoice)' : ''}` };
  });
  if (rem.some((r) => r.createInvoice)) { const d = rem.find((r) => r.createInvoice)!.daysBefore; out.push({ daysFromRenewal: -d, key: 'invoice', enabled: on('invoice'), why: 'Renewal invoice created' }); }
  if (lc.graceDays > 0 && lc.graceAction === 'notify') out.push({ daysFromRenewal: lc.graceDays, key: 'grace-notice', enabled: on('grace-notice'), why: 'Grace period ends' });
  if (lc.graceDays > 0 && lc.graceAction === 'change-level') out.push({ daysFromRenewal: lc.graceDays, key: 'level-changed', enabled: on('level-changed'), why: 'Moved to another plan after the grace period' });
  const od = Math.max(lc.overdueDays, 1);
  if (lc.overdueAction === 'change-level') out.push({ daysFromRenewal: od, key: 'level-changed', enabled: on('level-changed'), why: 'Moved to another plan when overdue' });
  else if (lc.overdueAction !== 'archive') out.push({ daysFromRenewal: od, key: 'lapsed-notice', enabled: on('lapsed-notice'), why: lc.overdueAction === 'suspend' ? 'Account suspended' : 'Membership lapses' });
  return out.sort((a, b) => a.daysFromRenewal - b.daysFromRenewal);
}
/** Warnings: a renewal step whose email is off (members would hear nothing), and a renewal email that no step uses. */
export function renewalEmailWarnings(lc: Lifecycle, comm: Pick<CommunicationDoc, 'system'>): string[] {
  const plan = renewalEmails(lc, comm); const w: string[] = [];
  for (const m of plan) if (!m.enabled) w.push(`${m.why}: “${SYSTEM_EMAILS[m.key].label}” is switched off, so members get no email then.`);
  const used = new Set(plan.map((m) => m.key));
  for (const k of ['renewal-reminder-1', 'renewal-reminder-2', 'renewal-day', 'grace-notice', 'lapsed-notice'] as SystemEmailKey[]) if (comm.system[k]?.enabled && !used.has(k)) w.push(`“${SYSTEM_EMAILS[k].label}” is on but no renewal step sends it (see Membership › Renewals).`);
  if (lc.reminders.filter((r) => r.daysBefore > 0).length > 2) w.push('More than two reminders before the renewal date: the later ones all use “Renewal reminder 2”.');
  return w;
}
/** The renewal emails with real dates for one paid-through date. */
export const renewalEmailDates = (lc: Lifecycle, comm: Pick<CommunicationDoc, 'system'>, paidThrough: ISODate) =>
  renewalEmails(lc, comm).map((m) => ({ ...m, on: addDays(paidThrough, m.daysFromRenewal), label: SYSTEM_EMAILS[m.key].label, onText: fmtDay(addDays(paidThrough, m.daysFromRenewal)) }));

/** HTML version: member data is escaped (a name like <script> stays text), line breaks become paragraphs. Use this for every HTML email. */
export function renderHtml(text: string, values: Partial<Record<MacroKey, string>>) {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safe = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, esc(v ?? '')])) as Partial<Record<MacroKey, string>>;
  return esc(text).split(/\n{2,}/).map((p) => `<p>${render(p, safe).replace(/\n/g, '<br>')}</p>`).join('');
}
