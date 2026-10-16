/**
 * A11 Integrations – email gateway, SMS gateway, Stripe, Google sign-in (memory/20-integrations.md).
 * Providers stay swappable: the app talks to our adapters, the admin picks the provider and the mode here.
 * SECRETS NEVER LIVE IN THIS DOCUMENT – only the last 4 characters and when a key was set. The BE stores the secret
 * encrypted (secrets manager); the demo throws it away after checking its format.
 *   IntegrationsSchema – settings + rules (live mode needs keys and a webhook; Stripe key prefix matches the mode;
 *                        live texts need an approved 10DLC / toll-free registration; https redirect URIs …)
 *   readiness()        – a checklist per integration, including what other modules expect (texts on, ACH on…)
 *   checkKey()         – the shape of a provider's key, before it is ever sent anywhere
 *   fourEyes()         – a provider, mode or key change needs a second admin's approval
 *   fakeSend()         – the "fake" adapter used for test sends in demo / local / CI
 */
import { z } from 'zod';

export const EMAIL_PROVIDERS = { fake: 'Fake (demo – nothing is sent)', sendgrid: 'SendGrid', postmark: 'Postmark', ses: 'Amazon SES', resend: 'Resend', mailgun: 'Mailgun' } as const;
export const SMS_PROVIDERS = { fake: 'Fake (demo – nothing is sent)', twilio: 'Twilio', telnyx: 'Telnyx', vonage: 'Vonage', sns: 'Amazon SNS' } as const;
type EmailP = keyof typeof EMAIL_PROVIDERS; type SmsP = keyof typeof SMS_PROVIDERS;
const enumOf = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

const Secret = z.object({ last4: z.string().regex(/^[A-Za-z0-9_-]{4}$/), setAt: z.string(), setBy: z.string() }).optional();
const domainRe = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export const IntegrationsShape = z.object({
  email: z.object({
    enabled: z.boolean(),
    provider: enumOf(EMAIL_PROVIDERS),
    mode: z.enum(['test', 'live']),
    domain: z.string().trim().toLowerCase().regex(domainRe, 'Use a domain like isgh.org'),
    fromTransactional: z.string().trim().toLowerCase().email(),               // receipts, codes, reminders
    fromBulk: z.string().trim().toLowerCase().email(),                        // newsletters, announcements
    apiKey: Secret,
    webhookSecret: Secret,
    dns: z.object({ spf: z.enum(['unknown', 'ok', 'missing']), dkim: z.enum(['unknown', 'ok', 'missing']), dmarc: z.enum(['unknown', 'ok', 'missing']) }),
  }),
  sms: z.object({
    enabled: z.boolean(),
    provider: enumOf(SMS_PROVIDERS),
    mode: z.enum(['test', 'live']),
    from: z.string().regex(/^\+1\d{10}$|^\d{5,6}$/, 'Use a US number like +17135550100 (or a short code)'),
    registration: z.object({ type: z.enum(['10dlc', 'toll-free', 'short-code', 'none']), status: z.enum(['not-started', 'pending', 'approved', 'rejected']) }),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).default(['US']),   // anything else is blocked (SMS pumping)
    apiKey: Secret,
    webhookSecret: Secret,
  }),
  stripe: z.object({
    enabled: z.boolean(),
    mode: z.enum(['test', 'live']),
    publishableKey: z.string().regex(/^pk_(test|live)_[A-Za-z0-9]{8,}$/, 'Starts with pk_test_ or pk_live_').or(z.literal('')),
    secretKey: Secret,
    webhookSecret: Secret,
    ach: z.boolean().default(false),
    applePayDomainVerified: z.boolean().default(false),
    statementDescriptor: z.string().regex(/^[A-Za-z0-9 .\-]{5,22}$/, '5–22 letters, numbers, spaces, dots or dashes'),
  }),
  google: z.object({
    enabled: z.boolean(),
    clientId: z.string().regex(/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/, 'Looks like 1234-abc.apps.googleusercontent.com').or(z.literal('')),
    clientSecret: Secret,
    redirectUris: z.array(z.string().url()).max(10),
  }),
  fallback: z.object({ emailProvider: enumOf(EMAIL_PROVIDERS).nullable().default(null), smsProvider: enumOf(SMS_PROVIDERS).nullable().default(null) }),
  lastChange: z.object({ summary: z.string(), requestedBy: z.string(), approvedBy: z.string(), at: z.string() }).optional(),
});
export const IntegrationsSchema = IntegrationsShape.superRefine((d, ctx) => {
  const bad = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  // email
  if (d.email.mode === 'live' && d.email.provider === 'fake') bad(['email', 'provider'], 'Live mode needs a real email provider.');
  if (d.email.mode === 'live' && !d.email.apiKey) bad(['email', 'apiKey'], 'Set the API key before going live.');
  if (d.email.mode === 'live' && !d.email.webhookSecret) bad(['email', 'webhookSecret'], 'Set the webhook secret – bounces and complaints must reach us.');
  for (const k of ['fromTransactional', 'fromBulk'] as const) { const dom = d.email[k].split('@')[1] ?? ''; if (dom !== d.email.domain && !dom.endsWith(`.${d.email.domain}`)) bad(['email', k], `Send from ${d.email.domain} or one of its subdomains (SPF and DKIM only cover your own domain).`); }
  if (d.email.fromBulk === d.email.fromTransactional) bad(['email', 'fromBulk'], 'Use a different address (ideally a subdomain like news.isgh.org) for bulk email, so a newsletter complaint never blocks receipts.');
  // sms
  if (d.sms.mode === 'live' && d.sms.provider === 'fake') bad(['sms', 'provider'], 'Live mode needs a real text-message provider.');
  if (d.sms.mode === 'live' && !d.sms.apiKey) bad(['sms', 'apiKey'], 'Set the API key before going live.');
  if (d.sms.mode === 'live' && d.sms.registration.status !== 'approved') bad(['sms', 'registration', 'status'], 'US carriers block texts from numbers without an approved 10DLC or toll-free registration.');
  if (d.sms.mode === 'live' && d.sms.registration.type === 'none') bad(['sms', 'registration', 'type'], 'Choose how the number is registered (10DLC, toll-free or short code).');
  if (d.sms.registration.type === 'toll-free' && !/^\+18(00|33|44|55|66|77|88)\d{7}$/.test(d.sms.from)) bad(['sms', 'from'], 'A toll-free registration needs a toll-free number (800, 833, 844, 855, 866, 877 or 888).');
  if (d.sms.countries.some((c) => c !== 'US' && c !== 'CA')) bad(['sms', 'countries'], 'Only the US (and Canada) – other countries invite SMS pumping fraud.');
  // stripe
  if (d.stripe.publishableKey && !d.stripe.publishableKey.startsWith(`pk_${d.stripe.mode}_`)) bad(['stripe', 'publishableKey'], `In ${d.stripe.mode} mode the key starts with pk_${d.stripe.mode}_.`);
  if (d.stripe.enabled && (!d.stripe.publishableKey || !d.stripe.secretKey)) bad(['stripe', 'secretKey'], 'Set both Stripe keys, or switch Stripe off.');
  if (d.stripe.mode === 'live' && !d.stripe.webhookSecret) bad(['stripe', 'webhookSecret'], 'Set the webhook secret – payments are confirmed by Stripe webhooks, never by the browser.');
  // google
  if (d.google.enabled && (!d.google.clientId || !d.google.clientSecret)) bad(['google', 'clientId'], 'Set the client ID and secret, or switch Google sign-in off.');
  d.google.redirectUris.forEach((u, i) => { if (!/^https:\/\//.test(u) && !/^http:\/\/localhost(:\d+)?\//.test(u)) bad(['google', 'redirectUris', i], 'Use https (http only for localhost).'); });
  // fallback
  if (d.fallback.emailProvider && d.fallback.emailProvider === d.email.provider) bad(['fallback', 'emailProvider'], 'The backup must be a different provider.');
  if (d.fallback.smsProvider && d.fallback.smsProvider === d.sms.provider) bad(['fallback', 'smsProvider'], 'The backup must be a different provider.');
  if (d.lastChange && d.lastChange.approvedBy === d.lastChange.requestedBy) bad(['lastChange', 'approvedBy'], 'A second admin must approve – not the person who made the change.');
});
export type IntegrationsDoc = z.infer<typeof IntegrationsSchema>;

/* ---------- keys ---------- */
const KEY_SHAPES: Record<string, { re: RegExp; hint: string }> = {
  'email:sendgrid': { re: /^SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$/, hint: 'SendGrid keys start with SG.' },
  'email:postmark': { re: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, hint: 'A Postmark server token looks like a UUID.' },
  'email:ses': { re: /^[A-Za-z0-9/+=]{40}$/, hint: 'An AWS secret access key is 40 characters.' },
  'email:resend': { re: /^re_[A-Za-z0-9_]{16,}$/, hint: 'Resend keys start with re_' },
  'email:mailgun': { re: /^(key-)?[0-9a-f]{32}(-[0-9a-f]{8}-[0-9a-f]{8})?$/, hint: 'A Mailgun key is 32 hex characters.' },
  'sms:twilio': { re: /^[0-9a-f]{32}$/, hint: 'A Twilio auth token is 32 hex characters.' },
  'sms:telnyx': { re: /^KEY[0-9A-F]{32}_[A-Za-z0-9]{22}$/, hint: 'Telnyx keys start with KEY' },
  'sms:vonage': { re: /^[A-Za-z0-9]{16}$/, hint: 'A Vonage API secret is 16 characters.' },
  'sms:sns': { re: /^[A-Za-z0-9/+=]{40}$/, hint: 'An AWS secret access key is 40 characters.' },
  'stripe:test': { re: /^(sk|rk)_test_[A-Za-z0-9]{16,}$/, hint: 'In test mode use sk_test_… (or a restricted rk_test_… key).' },
  'stripe:live': { re: /^(sk|rk)_live_[A-Za-z0-9]{16,}$/, hint: 'In live mode use sk_live_… (or a restricted rk_live_… key).' },
  webhook: { re: /^(whsec_)?[A-Za-z0-9+/=_-]{16,}$/, hint: 'Paste the signing secret from the provider’s webhook page.' },
  google: { re: /^GOCSPX-[A-Za-z0-9_-]{20,}$/, hint: 'Google client secrets start with GOCSPX-' },
};
/** Checks a pasted key's shape and returns what may be kept (last 4 only). The key itself is never stored here. */
export function checkKey(kind: string, key: string, by: string, at: string): { ok: true; secret: { last4: string; setAt: string; setBy: string } } | { ok: false; message: string } {
  const k = key.trim();
  if (/\s/.test(k) || !k) return { ok: false, message: 'Paste the key without spaces.' };
  const shape = KEY_SHAPES[kind];
  if (shape && !shape.re.test(k)) return { ok: false, message: shape.hint };
  return { ok: true, secret: { last4: k.slice(-4).replace(/[^A-Za-z0-9_-]/g, 'x'), setAt: at, setBy: by } };
}
export const masked = (s?: { last4: string }) => (s ? `••••${s.last4}` : 'Not set');

/* ---------- four eyes ---------- */
/** What changed that needs a second admin: provider, mode, keys, sender, Stripe account. */
export function sensitiveChanges(before: IntegrationsDoc, after: IntegrationsDoc): string[] {
  const out: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (before.email.provider !== after.email.provider) out.push(`Email provider ${before.email.provider} → ${after.email.provider}`);
  if (before.email.mode !== after.email.mode) out.push(`Email mode → ${after.email.mode}`);
  if (!same(before.email.apiKey, after.email.apiKey) || !same(before.email.webhookSecret, after.email.webhookSecret)) out.push('Email keys');
  if (before.email.fromTransactional !== after.email.fromTransactional || before.email.fromBulk !== after.email.fromBulk) out.push('Email senders');
  if (before.sms.provider !== after.sms.provider) out.push(`Text provider ${before.sms.provider} → ${after.sms.provider}`);
  if (before.sms.mode !== after.sms.mode) out.push(`Text mode → ${after.sms.mode}`);
  if (!same(before.sms.apiKey, after.sms.apiKey) || before.sms.from !== after.sms.from) out.push('Text number or key');
  if (before.stripe.mode !== after.stripe.mode) out.push(`Stripe mode → ${after.stripe.mode}`);
  if (before.stripe.publishableKey !== after.stripe.publishableKey || !same(before.stripe.secretKey, after.stripe.secretKey) || !same(before.stripe.webhookSecret, after.stripe.webhookSecret)) out.push('Stripe keys');
  if (before.google.clientId !== after.google.clientId || !same(before.google.clientSecret, after.google.clientSecret)) out.push('Google sign-in keys');
  return out;
}
/** null = fine. The server checks this too: sensitive changes need lastChange approved by another active admin. */
export function fourEyes(before: IntegrationsDoc, after: IntegrationsDoc, actorId: string, approvers: string[]): string | null {
  const changes = sensitiveChanges(before, after);
  if (!changes.length) return null;
  const lc = after.lastChange;
  if (!lc || lc.summary !== changes.join('; ')) return `These changes need a second admin's approval: ${changes.join('; ')}.`;
  if (lc.requestedBy !== actorId) return 'The change must be requested by the admin who publishes it.';
  if (lc.approvedBy === actorId || !approvers.includes(lc.approvedBy)) return 'Choose another admin who may manage integrations to approve.';
  return null;
}

/* ---------- readiness ---------- */
export type Check = { label: string; state: 'ok' | 'warn' | 'missing'; help?: string };
export type Ready = { id: 'email' | 'sms' | 'stripe' | 'google'; title: string; status: 'live' | 'test' | 'off' | 'problem'; checks: Check[] };
type Needs = { smsOn: boolean; smsPurposes: string[]; cardOn: boolean; achOn: boolean; googleOnSite: boolean };
export function readiness(d: IntegrationsDoc, needs: Needs): Ready[] {
  const st = (on: boolean, mode: 'test' | 'live', checks: Check[]): Ready['status'] => (!on ? 'off' : checks.some((c) => c.state === 'missing') ? 'problem' : mode);
  const e = d.email;
  const emailChecks: Check[] = [
    { label: `Provider: ${EMAIL_PROVIDERS[e.provider as EmailP]}`, state: e.provider === 'fake' ? (e.mode === 'live' ? 'missing' : 'warn') : 'ok', help: e.provider === 'fake' ? 'Nothing is sent while the fake provider is chosen.' : undefined },
    { label: 'API key', state: e.apiKey ? 'ok' : e.provider === 'fake' ? 'warn' : 'missing' },
    { label: 'Bounce and complaint webhook', state: e.webhookSecret ? 'ok' : 'warn', help: 'Without it, bad addresses keep being mailed and hurt deliverability.' },
    ...(['spf', 'dkim', 'dmarc'] as const).map((k): Check => ({ label: `${k.toUpperCase()} record for ${e.domain}`, state: e.dns[k] === 'ok' ? 'ok' : e.dns[k] === 'missing' ? 'missing' : 'warn', help: k === 'dmarc' ? 'Gmail and Yahoo require DMARC for bulk senders.' : undefined })),
    { label: 'Separate sender for bulk email', state: e.fromBulk.split('@')[1] !== e.fromTransactional.split('@')[1] ? 'ok' : 'warn', help: 'A subdomain like news.isgh.org keeps receipts flowing if a newsletter gets complaints.' },
  ];
  const s = d.sms;
  const smsChecks: Check[] = [
    { label: `Provider: ${SMS_PROVIDERS[s.provider as SmsP]}`, state: s.provider === 'fake' ? (s.mode === 'live' ? 'missing' : 'warn') : 'ok' },
    { label: 'API key', state: s.apiKey ? 'ok' : s.provider === 'fake' ? 'warn' : 'missing' },
    { label: `Carrier registration (${s.registration.type === 'none' ? 'not chosen' : s.registration.type})`, state: s.registration.status === 'approved' ? 'ok' : s.registration.status === 'rejected' ? 'missing' : 'warn', help: 'US carriers filter texts from unregistered numbers. Registration takes days to weeks – start early.' },
    { label: 'STOP / HELP replies webhook', state: s.webhookSecret ? 'ok' : 'warn', help: 'STOP must opt the member out at once.' },
    ...(needs.smsOn && !s.enabled ? [{ label: `Communication sends texts (${needs.smsPurposes.join(', ') || 'on'}) but this integration is off`, state: 'missing' as const }] : []),
  ];
  const p = d.stripe;
  const stripeChecks: Check[] = [
    { label: 'Publishable and secret keys', state: p.publishableKey && p.secretKey ? 'ok' : 'missing' },
    { label: 'Webhook signing secret', state: p.webhookSecret ? 'ok' : p.mode === 'live' ? 'missing' : 'warn', help: 'Webhooks are the source of truth for payments.' },
    { label: 'Apple Pay domain verified', state: p.applePayDomainVerified ? 'ok' : 'warn' },
    ...(needs.achOn && !p.ach ? [{ label: 'Configuration offers bank transfer (ACH) but ACH is off in Stripe', state: 'missing' as const }] : []),
    ...(needs.cardOn && !p.enabled ? [{ label: 'Configuration offers card payments but Stripe is off', state: 'missing' as const }] : []),
  ];
  const g = d.google;
  const googleChecks: Check[] = [
    { label: 'Client ID and secret', state: g.clientId && g.clientSecret ? 'ok' : 'missing' },
    { label: 'Redirect addresses', state: g.redirectUris.length ? 'ok' : 'missing', help: 'Add the website’s /api/auth/google/callback address.' },
    ...(needs.googleOnSite && !g.enabled ? [{ label: 'The website shows "Continue with Google" but this integration is off', state: 'missing' as const }] : []),
  ];
  return [
    { id: 'email', title: 'Email', status: st(e.enabled, e.mode, emailChecks), checks: emailChecks },
    { id: 'sms', title: 'Text messages', status: st(s.enabled, s.mode, smsChecks) === 'off' && needs.smsOn ? 'problem' : st(s.enabled, s.mode, smsChecks), checks: smsChecks },
    { id: 'stripe', title: 'Stripe payments', status: st(p.enabled, p.mode, stripeChecks) === 'off' && needs.cardOn ? 'problem' : st(p.enabled, p.mode, stripeChecks), checks: stripeChecks },
    { id: 'google', title: 'Google sign-in', status: st(g.enabled, 'live', googleChecks) === 'off' && needs.googleOnSite ? 'problem' : st(g.enabled, 'live', googleChecks), checks: googleChecks },
  ];
}
export const webhookUrl = (adminOrigin: string, org: string, id: 'email' | 'sms' | 'stripe') => `${adminOrigin.replace(/\/$/, '')}/api/webhooks/${org}/${id}`;

/* ---------- fake adapter (test sends) ---------- */
export type SendResult = { ok: boolean; id?: string; message: string };
export function fakeSend(kind: 'email' | 'sms' | 'stripe', to: string, d: IntegrationsDoc, nowHHMM: string, quiet?: { from: string; to: string }): SendResult {
  const id = `${kind}_test_${Math.abs([...`${to}${nowHHMM}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`;
  if (kind === 'email') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, message: 'Enter an email address.' };
    if (!d.email.enabled) return { ok: false, message: 'Email is switched off.' };
    return { ok: true, id, message: d.email.provider === 'fake' ? `Fake provider: an email to ${to} was logged, not sent (${id}).` : `Sent through ${EMAIL_PROVIDERS[d.email.provider as EmailP]} in ${d.email.mode} mode (${id}).` };
  }
  if (kind === 'sms') {
    if (!/^\+1\d{10}$/.test(to)) return { ok: false, message: 'Enter a US mobile number like +17135550100.' };
    if (!d.sms.enabled) return { ok: false, message: 'Text messages are switched off.' };
    if (quiet && (quiet.from <= quiet.to ? nowHHMM >= quiet.from && nowHHMM < quiet.to : nowHHMM >= quiet.from || nowHHMM < quiet.to)) return { ok: false, message: `It is quiet hours (${quiet.from}–${quiet.to}) – test texts are held too.` };
    return { ok: true, id, message: d.sms.provider === 'fake' ? `Fake provider: a text to ${to} was logged, not sent (${id}).` : `Sent through ${SMS_PROVIDERS[d.sms.provider as SmsP]} in ${d.sms.mode} mode (${id}).` };
  }
  if (d.stripe.mode !== 'test') return { ok: false, message: 'Test payments only run in test mode – switch Stripe to test first.' };
  if (!d.stripe.publishableKey || !d.stripe.secretKey) return { ok: false, message: 'Set the Stripe test keys first.' };
  return { ok: true, id: `pi_test_${id.slice(-8)}`, message: `Test payment of $1.00 with card 4242 4242 4242 4242 succeeded (pi_test_${id.slice(-8)}). No real money moved.` };
}

/* ---------- demo ---------- */
export const mockIntegrations: IntegrationsDoc = {
  email: { enabled: true, provider: 'fake', mode: 'test', domain: 'isgh.org', fromTransactional: 'membership@isgh.org', fromBulk: 'news@news.isgh.org', dns: { spf: 'ok', dkim: 'unknown', dmarc: 'missing' } },
  sms: { enabled: false, provider: 'fake', mode: 'test', from: '+17135550100', registration: { type: '10dlc', status: 'not-started' }, countries: ['US'] },
  stripe: { enabled: true, mode: 'test', publishableKey: 'pk_test_51ISGHdemo0000', secretKey: { last4: 'demo', setAt: '2026-10-13', setBy: 'Mohammad (demo)' }, ach: false, applePayDomainVerified: false, statementDescriptor: 'ISGH MEMBERSHIP' },
  google: { enabled: false, clientId: '', redirectUris: [] },
  fallback: { emailProvider: null, smsProvider: null },
};
