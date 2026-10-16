/**
 * Reads a zod schema (the website's own contract) so the admin can build a form for ANY document
 * without hand-writing one screen per field. Same idea as Payload CMS / Keystatic / Sanity field config,
 * but driven by the contract that already exists – so the admin can never publish what the site rejects.
 */
import type { ZodTypeAny } from 'zod';

export type Kind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'enum' | 'literal' | 'record' | 'union' | 'unknown';
export type Info = {
  kind: Kind; schema: ZodTypeAny; optional: boolean; nullable: boolean; defaultValue?: unknown;
  maxLength?: number; regex?: string; min?: number; max?: number; int?: boolean;
  options?: string[]; literal?: unknown;
  shape?: Record<string, ZodTypeAny>; element?: ZodTypeAny; valueType?: ZodTypeAny;
  discriminator?: string; variants?: Record<string, ZodTypeAny>;
};

type Def = { typeName?: string; [k: string]: unknown };
const def = (s: ZodTypeAny) => (s as unknown as { _def: Def })._def;

export function inspect(schema: ZodTypeAny): Info {
  let s = schema, optional = false, nullable = false, defaultValue: unknown;
  for (let i = 0; i < 10; i++) {
    const d = def(s);
    if (d.typeName === 'ZodOptional') { optional = true; s = d.innerType as ZodTypeAny; continue; }
    if (d.typeName === 'ZodNullable') { nullable = true; s = d.innerType as ZodTypeAny; continue; }
    if (d.typeName === 'ZodDefault') { defaultValue = (d.defaultValue as () => unknown)(); s = d.innerType as ZodTypeAny; continue; }
    if (d.typeName === 'ZodEffects') { s = d.schema as ZodTypeAny; continue; }
    break;
  }
  const d = def(s);
  const base = { schema: s, optional, nullable, defaultValue };
  switch (d.typeName) {
    case 'ZodObject': return { ...base, kind: 'object', shape: (s as unknown as { shape: Record<string, ZodTypeAny> }).shape };
    case 'ZodArray': return { ...base, kind: 'array', element: d.type as ZodTypeAny, min: (d.minLength as { value: number } | null)?.value, max: (d.maxLength as { value: number } | null)?.value };
    case 'ZodString': {
      const checks = (d.checks as { kind: string; value?: number; regex?: RegExp }[]) ?? [];
      return { ...base, kind: 'string', maxLength: checks.find((c) => c.kind === 'max')?.value, min: checks.find((c) => c.kind === 'min')?.value, regex: checks.find((c) => c.kind === 'regex')?.regex?.source };
    }
    case 'ZodNumber': {
      const checks = (d.checks as { kind: string; value?: number }[]) ?? [];
      return { ...base, kind: 'number', min: checks.find((c) => c.kind === 'min')?.value, max: checks.find((c) => c.kind === 'max')?.value, int: checks.some((c) => c.kind === 'int') };
    }
    case 'ZodBoolean': return { ...base, kind: 'boolean' };
    case 'ZodEnum': return { ...base, kind: 'enum', options: d.values as string[] };
    case 'ZodLiteral': return { ...base, kind: 'literal', literal: d.value };
    case 'ZodRecord': return { ...base, kind: 'record', valueType: d.valueType as ZodTypeAny };
    case 'ZodDiscriminatedUnion': {
      const disc = d.discriminator as string;
      const variants: Record<string, ZodTypeAny> = {};
      for (const o of d.options as ZodTypeAny[]) {
        const lit = def((o as unknown as { shape: Record<string, ZodTypeAny> }).shape[disc]).value as string;
        variants[lit] = o;
      }
      return { ...base, kind: 'union', discriminator: disc, variants };
    }
    default: return { ...base, kind: 'unknown' };
  }
}

/** A sensible empty value for a new item (respects defaults, enums, literals, required children). */
export function emptyValue(schema: ZodTypeAny): unknown {
  const i = inspect(schema);
  if (i.defaultValue !== undefined) return i.defaultValue;
  if (i.optional) return undefined;
  switch (i.kind) {
    case 'object': {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(i.shape!)) { const val = emptyValue(v); if (val !== undefined) o[k] = val; }
      return o;
    }
    case 'array': return [];
    case 'string': return '';
    case 'number': return i.min ?? 0;
    case 'boolean': return false;
    case 'enum': return i.options![0];
    case 'literal': return i.literal;
    case 'record': return {};
    case 'union': { const first = Object.values(i.variants!)[0]; return emptyValue(first); }
    default: return null;
  }
}

/* ---------- words people understand (not field names) ---------- */
const LABELS: Record<string, string> = {
  href: 'Link', cta: 'Button', ctas: 'Buttons', org: 'Organization', nav: 'Main menu', faq: 'Questions and answers',
  q: 'Question', a: 'Answer', dob: 'Date of birth', otp: 'Email code', sms: 'Text messages', url: 'Link',
  src: 'Image file or link', alt: 'Description for screen readers', focal: 'Focus point', creditUrl: 'Credit link',
  tel: 'Phone for dialing', id: 'ID', zakatEligible: 'Zakat eligible', giveUrl: 'Give link', zakatUrl: 'Zakat link',
  showSamples: 'Show sample items', showProgress: 'Show progress bars', rotateVerses: 'Rotate verses automatically',
  heartLine: 'Heart line (hadith)', bento: 'Membership tiles', joinImages: 'Photos on Become a member', classicHero: 'Classic layout hero',
  houston: 'Houston band', closing: 'Closing call to action', life: 'What membership supports', recordDate: 'Voting record date',
  serviceArea: 'Service area', payerRelationships: 'Who may pay for a member', minVotingAge: 'Minimum voting age', minMemberAge: 'Minimum member age',
  multiYearDiscountPct: 'Multi-year discount (%)', maxYearsAhead: 'Years that can be paid ahead', priceCents: 'Price', goalCents: 'Goal', raisedCents: 'Raised so far',
  amountCents: 'Amount', mapHint: 'Map hint', hoursLabel: 'Office hours text', mapUrl: 'Map link', taxNote: 'Tax note', shortName: 'Short name', productName: 'Site name',
  logoLight: 'Logo for light backgrounds', logoDark: 'Logo for dark backgrounds', logoAlt: 'Logo text alternative', faviconIco: 'Favicon (.ico)', appleTouchIcon: 'Apple touch icon',
  ogImage: 'Share image (1200×630)', themeColor: 'Browser bar color', version: 'Version', startsAt: 'Show from', endsAt: 'Show until', walletImage: 'Wallet tile photo',
  stockPhoto: 'This is a stock photo', verifiedBy: 'Verified by', updatedAt: 'Last updated', featured: 'Featured', sample: 'Sample (demo) item',
  // WildApricot-style options (events, groups, communication, configuration, renewals)
  guestPriceCents: 'Price per guest', planIds: 'Plans', groupIds: 'Groups', onlineUrl: 'Online link', daysBefore: 'Days before',
  ccAdmins: 'Copy every email to', replyTo: 'Reply-to email', fromName: 'From name', quietHours: 'Quiet hours (no texts)', consentText: 'Consent text',
  selfService: 'Members can do it themselves', editProfile: 'Edit their profile', cancelAutoRenew: 'Turn off automatic renewal', downloadReceipts: 'Download receipts',
  phoneImage: 'Card image for phones', pdf: 'Printable PDF card', wallet: 'Apple Wallet and Google Wallet', checkPendingStatus: 'Check payments wait to clear',
  coverFees: 'Ask members to cover card fees', payLater: 'Pay later (invoice)', ach: 'Bank transfer (ACH)', adminTwoStep: 'Admins must use 2-step sign-in',
  sessionMinutes: 'Sign out after (minutes idle)', idDocuments: 'Photo ID files', keepDays: 'Keep for (days)', needConsent: 'Ask for consent first', startPage: 'Page after sign-in',
  memberEditable: 'Members can edit it', inDirectory: 'Show in the member directory', maxUses: 'Uses allowed', endsOn: 'Last day', selfRenew: 'Members renew online',
  graceDays: 'Grace period (days after the renewal date)', graceAction: 'At the end of the grace period', overdueDays: 'Overdue after (days)', overdueAction: 'When overdue',
  overdueLevel: 'Move to plan', voidInvoice: 'Void the unpaid renewal invoice', setPendingRenewal: 'Set status to “Pending renewal”', createInvoice: 'Create the renewal invoice',
  termPrices: 'Price for paying several years at once', bundle: 'Household (bundle)', maxMembers: 'People in the household', anchorDate: 'Renewal date (MM-DD)',
  aheadLimitDays: 'Can renew this many days early', allowLevelChange: 'Members can change plan', prorate: 'Charge less for a part year', duplicateCheck: 'Warn about possible duplicates',
  showPast: 'Show past events', defaultReminderDays: 'Default reminder (days before)', joinPolicy: 'Who can add people', showInProfile: 'Show on member profiles',
  leadersCanEmail: 'Leaders can email the group', pageAccess: 'Can be used to limit pages and events', memberIds: 'Members (IDs)', refund: 'Refund when someone cancels in time', feeCents: 'Fee kept (cents)', typeCounts: 'Registered per type (demo)', startsOn: 'First day', oncePerPerson: 'Once per person', achPercent: 'Bank transfer fee (%)', achCapCents: 'Bank transfer fee cap (cents)', payLaterDays: 'Pay-later invoices due after (days)', match: 'People must match', include: 'Always in (member IDs)', exclude: 'Never in (member IDs)', groupEmailsByLeaders: 'Group leaders can send emails',
  invoicePrefix: 'Invoice number prefix', receiptNote: 'Note on receipts', refundPolicy: 'Refund policy', showCenter: 'Show the Islamic Center', showPhone: 'Show phone', showEmail: 'Show email',
  showPhoto: 'Show photo', showRenewal: 'Show renewal date', optIn: 'Members must opt in', audience: 'Who can see it', registered: 'Registered (demo)', waiting: 'On the waitlist (demo)',
};
export function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const HINTS: Record<string, string> = {
  match: 'All rules: people must match every rule. Any rule: one is enough (for example renewal due OR in grace).', include: 'Exceptions – these people are in even if the rule says no.', exclude: 'Exceptions – these people are never in, even if the rule matches.',
  href: 'A page on this site, like /about, or a full link starting with https://',
  alt: 'Say what the photo shows. Required for people using screen readers.',
  focal: 'Which part of the photo to keep in view when cropped, like "50% 30%" (left-right, top-bottom).',
  startsAt: 'Date and time with Houston offset, like 2026-11-01T00:00:00-05:00',
  endsAt: 'Date and time with Houston offset, like 2027-06-30T23:59:59-05:00',
  recordDate: 'Bylaws Art. I §3: dues paid after this date do not give a vote that year.',
  arabic: 'Paste the exact Arabic text from the source. Have it reviewed before publishing.',
  english: 'Use the exact wording of the named translation.',
  ref: 'Surah:ayah, like 2:261',
  version: 'Change this when you upload a new file, so browsers load the new one.',
  sample: 'Sample items are labeled on the site and hidden when "Show sample items" is off.',
  consent: 'Personal stories need written consent or must be anonymized.',
  privacy: 'Anonymized cases never show names, faces or addresses.',
  anchorDate: 'ISGH renews everyone on December 15 (WildApricot). Leave empty for the calendar year.',
  aheadLimitDays: '0 = any time. WildApricot calls this “Limit renewals”.',
  graceDays: 'Members can still renew without losing anything during this time.',
  overdueDays: 'Counted from the renewal date. Must be on or after the grace period.',
  capacity: '0 = no limit.', limit: '0 = no limit for this type.', waitlist: 'When the event is full, people can join a waitlist and get the next free spot.',
  footer: 'Bulk email must include your postal address (CAN-SPAM).', percent: 'Shown as an optional extra at checkout, e.g. 3% to cover card fees.',
  maxUses: '0 = no limit.', keepDays: 'After this many days the ID image is deleted; the “verified” mark stays.',
  checkPendingStatus: 'Members paying by check show as “Check – waiting to clear” until an admin marks it received.',
};
export const hintFor = (key: string) => HINTS[key];

/** Long text → textarea. */
export const isLongText = (key: string, info: Info) =>
  (!/(href|url|src|Url|email|tel|slug|id)$/.test(key) && (info.maxLength ?? 0) > 120) || /^(text|intro|summary|lead|story|body|excerpt|english|arabic|consent|tagline|a)$/.test(key);
export const isCents = (key: string) => /Cents$/.test(key);
export const isColor = (value: unknown) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
export const isImageShape = (info: Info) => info.kind === 'object' && !!info.shape?.src && !!info.shape?.alt;

/** Title for an array item card, from its most human field. */
export function itemTitle(v: unknown, index: number): string {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['title', 'label', 'name', 'q', 'text', 'value', 'ref', 'id', 'slug', 'type']) {
      if (typeof o[k] === 'string' && o[k]) return String(o[k]).slice(0, 70);
    }
  }
  if (typeof v === 'string' && v) return v.slice(0, 70);
  return `Item ${index + 1}`;
}
