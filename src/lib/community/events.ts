/**
 * CONTRACT – GET /public/events (admin: Events). WildApricot-style events: registration types (price, guest price,
 * who may register, code, limit, window), guests, waitlist, cancellation rule, reminders, member- or group-only events.
 * Pure code: used by the website (list, detail, registration) and the admin (editor, registrations).
 */
import { z } from 'zod';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use date and time, like 2026-11-08T18:30');
export const RegTypeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,30}$/),
  name: z.string().min(1).max(60),
  priceCents: z.number().int().min(0).max(10_000_00),
  guestPriceCents: z.number().int().min(0).max(10_000_00).default(0),
  availability: z.enum(['everyone', 'members', 'code', 'plans']).default('everyone'),
  code: z.string().max(30).optional(),
  planIds: z.array(z.string()).default([]),
  limit: z.number().int().min(0).max(100_000).default(0),                      // 0 = no limit for this type
  enabled: z.boolean().default(true),
  /* Zeffy-style ticket options (all optional) */
  description: z.string().max(300).default(''),                               // what the ticket includes
  category: z.string().max(40).default(''),                                   // buyers filter tickets by category
  salesStart: z.string().max(16).default(''),                                 // '' = when registration opens (early-bird / last-minute rates)
  salesEnd: z.string().max(16).default(''),                                   // '' = when registration closes
  payWhatYouCan: z.boolean().default(false),                                  // the price is the minimum; the buyer chooses the amount
  groupSize: z.number().int().min(1).max(20).default(1),                      // one ticket = this many seats (table, family, sponsor package)
  receiptCents: z.number().int().min(0).max(10_000_00).default(0),            // tax-deductible part of the price, shown on the receipt
}).refine((t) => t.availability !== 'code' || !!t.code, { path: ['code'], message: 'Enter the code people must type.' })
  .refine((t) => t.availability !== 'plans' || t.planIds.length > 0, { path: ['planIds'], message: 'Choose at least one plan.' })
  .refine((t) => !t.salesStart || !t.salesEnd || t.salesStart < t.salesEnd, { path: ['salesEnd'], message: 'Sales must end after they start.' })
  .refine((t) => t.payWhatYouCan || t.receiptCents <= t.priceCents * t.groupSize, { path: ['receiptCents'], message: 'The receipt amount cannot be more than the price.' });

/** A question on the registration form – asked once per order ("buyer") or once per ticket holder ("attendee"). */
export const QUESTION_KINDS = { text: 'Short answer', long: 'Paragraph', name: 'Full name', email: 'Email', phone: 'Phone', date: 'Date', single: 'One choice', multi: 'Several choices', checkbox: 'Checkbox (yes / no)' } as const;
export const QuestionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,30}$/),
  label: z.string().min(1).max(140),
  help: z.string().max(200).default(''),
  kind: z.enum(['text', 'long', 'name', 'email', 'phone', 'date', 'single', 'multi', 'checkbox']).default('text'),
  scope: z.enum(['buyer', 'attendee']).default('buyer'),
  required: z.boolean().default(false),
  options: z.array(z.object({ label: z.string().min(1).max(60), limit: z.number().int().min(0).max(100_000).default(0) })).max(20).default([]),   // limit 0 = no limit
  typeIds: z.array(z.string()).default([]),                                   // [] = every ticket type
}).refine((q) => !['single', 'multi'].includes(q.kind) || q.options.length >= 2, { path: ['options'], message: 'Add at least two choices.' });
/** Something extra sold with the ticket (meal, parking, t-shirt). */
export const AddOnSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,30}$/), name: z.string().min(1).max(60), description: z.string().max(200).default(''),
  priceCents: z.number().int().min(0).max(10_000_00), limit: z.number().int().min(0).max(100_000).default(0), maxPerOrder: z.number().int().min(1).max(20).default(10),
});
/** An event discount code (checked before the organization's own codes). */
export const EventDiscountSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9-]{3,20}$/, '3–20 letters, numbers or dashes'),
  kind: z.enum(['percent', 'amount']).default('percent'),
  value: z.number().int().min(1).max(10_000_00),                              // percent 1–100, or cents
  uses: z.number().int().min(0).max(100_000).default(0),                      // 0 = no limit
  used: z.number().int().min(0).default(0),                                   // BE: counted from registrations
  typeIds: z.array(z.string()).default([]),                                   // [] = every ticket type
  ends: z.string().max(16).default(''),
}).refine((d) => d.kind !== 'percent' || d.value <= 100, { path: ['value'], message: 'A percent is 1 to 100.' });

export const EventSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/, 'Lowercase letters, numbers and dashes'),
  title: z.string().min(2).max(100),
  summary: z.string().max(300).default(''),
  category: z.enum(['community', 'education', 'governance', 'youth', 'sisters', 'fundraiser', 'religious']).default('community'),
  status: z.enum(['draft', 'published', 'cancelled']).default('draft'),
  start: iso,
  end: iso,
  location: z.object({
    name: z.string().max(100),
    address: z.string().max(160).default(''),
    center: z.string().max(80).optional(),                                    // Islamic Center (for center filters / scoped admins)
    onlineUrl: z.string().max(300).optional(),
  }),
  visibility: z.enum(['public', 'members', 'groups']).default('public'),
  groupIds: z.array(z.string()).default([]),
  registration: z.object({
    enabled: z.boolean().default(true),
    opens: iso.optional(),
    closes: iso.optional(),
    capacity: z.number().int().min(0).max(100_000).default(0),                // 0 = no limit
    waitlist: z.boolean().default(false),
    guests: z.object({ allowed: z.boolean().default(false), max: z.number().int().min(0).max(20).default(0) }),
    cancellation: z.object({
      policy: z.enum(['none', 'until', 'anytime']).default('until'), daysBefore: z.number().int().min(0).max(60).default(1),
      refund: z.enum(['full', 'minus-fee', 'none']).default('full'),            // paid registrations cancelled in time
      feeCents: z.number().int().min(0).max(100_00).default(0),
    }),
    types: z.array(RegTypeSchema).max(10),
  }),
  reminders: z.array(z.number().int().min(0).max(30)).max(4).default([1]),    // days before → "Event reminder" email
  /* Zeffy-style form builder */
  description: z.string().max(5000).default(''),                              // the event page text (paragraphs, blank line between)
  design: z.object({ bannerUrl: z.string().max(400).default(''), videoUrl: z.string().max(300).default(''), color: z.string().regex(/^(#[0-9a-fA-F]{6})?$/, 'A color like #0f766e').default('') })
    .default({ bannerUrl: '', videoUrl: '', color: '' }),
  questions: z.array(QuestionSchema).max(30).default([]),
  addOns: z.object({
    donation: z.object({ enabled: z.boolean().default(false), prompt: z.string().max(140).default(''), fund: z.string().max(60).default(''), suggested: z.array(z.number().int().min(100).max(10_000_00)).max(4).default([1000, 2500, 5000]) })
      .default({ enabled: false, prompt: '', fund: '', suggested: [1000, 2500, 5000] }),
    items: z.array(AddOnSchema).max(10).default([]),
  }).default({ donation: { enabled: false, prompt: '', fund: '', suggested: [1000, 2500, 5000] }, items: [] }),
  discounts: z.array(EventDiscountSchema).max(20).default([]),
  emails: z.object({ thankYouSubject: z.string().max(140).default(''), thankYouBody: z.string().max(3000).default(''), notify: z.array(z.string().email().max(254)).max(5).default([]) })
    .default({ thankYouSubject: '', thankYouBody: '', notify: [] }),
  goal: z.object({ cents: z.number().int().min(0).max(100_000_000_00).default(0), show: z.boolean().default(false) }).default({ cents: 0, show: false }),
  addOnCounts: z.record(z.string(), z.number().int().min(0)).default({}),      // BE: sold per add-on (limits)
  optionCounts: z.record(z.string(), z.number().int().min(0)).default({}),     // BE: picked per "question:choice" (choice limits)
  raisedCents: z.number().int().min(0).default(0),                            // BE: tickets + add-ons + gifts (goal thermometer)
  registered: z.number().int().min(0).default(0),                            // demo counts (BE: from registrations) – people incl. guests
  typeCounts: z.record(z.string(), z.number().int().min(0)).default({}),      // demo: people registered per type (type limits)
  waiting: z.number().int().min(0).default(0),
  sample: z.boolean().default(false),
  /** F9: events entered by center-limited admins wait for approval (they stay drafts until approved). */
  approval: z.object({
    state: z.enum(['none', 'pending', 'approved', 'changes']).default('none'),
    requestedBy: z.string().max(80).default(''), by: z.string().max(80).default(''), on: z.string().max(30).default(''), note: z.string().max(300).default(''),
  }).default({ state: 'none', requestedBy: '', by: '', on: '', note: '' }),
  /** F9: how the event is promoted (website feature, email, text message, social post). */
  promotion: z.object({
    featured: z.boolean().default(false),
    email: z.object({ audience: z.enum(['none', 'everyone', 'members', 'center', 'groups']).default('none'), sendOn: z.string().max(10).default(''), sent: z.boolean().default(false) }).default({ audience: 'none', sendOn: '', sent: false }),
    sms: z.object({ enabled: z.boolean().default(false), sendOn: z.string().max(10).default('') }).default({ enabled: false, sendOn: '' }),
    social: z.string().max(500).default(''),
  }).default({ featured: false, email: { audience: 'none', sendOn: '', sent: false }, sms: { enabled: false, sendOn: '' }, social: '' }),
}).refine((e) => e.end >= e.start, { path: ['end'], message: 'The event must end after it starts.' })
  .refine((e) => e.visibility !== 'groups' || e.groupIds.length > 0, { path: ['groupIds'], message: 'Choose at least one group.' })
  .refine((e) => !e.registration.enabled || e.registration.types.length > 0, { path: ['registration', 'types'], message: 'Add at least one registration type.' })
  .superRefine((e, ctx) => {
    const r = e.registration; const bad = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path: ['registration', ...path], message });
    if (r.opens && r.closes && r.opens >= r.closes) bad(['closes'], 'Registration must close after it opens.');
    if (r.closes && r.closes > e.start) bad(['closes'], 'Registration must close before the event starts.');
    if (r.opens && r.opens > e.start) bad(['opens'], 'Registration must open before the event starts.');
    if (r.guests.allowed && r.guests.max === 0) bad(['guests', 'max'], 'Allow at least 1 guest, or turn guests off.');
    if (r.capacity && r.guests.allowed && r.guests.max + 1 > r.capacity) bad(['guests', 'max'], 'One registration with the most guests would be bigger than the whole event.');
    r.types.forEach((t, i) => {
      if (r.capacity && t.limit > r.capacity) bad(['types', i, 'limit'], `More than the event holds (${r.capacity}).`);
      if (t.guestPriceCents > 0 && !r.guests.allowed) bad(['types', i, 'guestPriceCents'], 'Guests are not allowed, so a guest price is never used.');
    });
    const ids = r.types.map((t) => t.id); ids.forEach((id, i) => { if (ids.indexOf(id) !== i) bad(['types', i, 'id'], `Two registration types use “${id}”.`); });
    if (r.enabled && r.types.every((t) => !t.enabled)) bad(['types'], 'Turn on at least one registration type.');
    if (r.cancellation.refund === 'minus-fee' && !r.cancellation.feeCents) bad(['cancellation', 'feeCents'], 'Enter the fee kept when someone cancels.');
    if (new Set(e.reminders).size !== e.reminders.length) ctx.addIssue({ code: 'custom', path: ['reminders'], message: 'Two reminders on the same day.' });
    if (e.location.onlineUrl && !/^https:\/\//.test(e.location.onlineUrl)) ctx.addIssue({ code: 'custom', path: ['location', 'onlineUrl'], message: 'Use a secure link starting with https://' });
    const bad2 = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    if (e.design.videoUrl && !youTubeId(e.design.videoUrl)) bad2(['design', 'videoUrl'], 'Paste a YouTube link (youtube.com/watch?v=… or youtu.be/…).');
    if (e.design.bannerUrl && !/^(https:\/\/|\/)/.test(e.design.bannerUrl)) bad2(['design', 'bannerUrl'], 'Use an image address starting with https:// or /');
    const typeIds = r.types.map((t) => t.id);
    r.types.forEach((t, i) => { if (r.capacity && t.groupSize > r.capacity) bad(['types', i, 'groupSize'], `One ticket would be bigger than the event (${r.capacity}).`); });
    const qids = e.questions.map((q) => q.id);
    e.questions.forEach((q, i) => {
      if (qids.indexOf(q.id) !== i) bad2(['questions', i, 'id'], `Two questions use “${q.id}”.`);
      q.typeIds.forEach((tid) => { if (!typeIds.includes(tid)) bad2(['questions', i, 'typeIds'], `No ticket type “${tid}”.`); });
      if (q.scope === 'buyer' && q.typeIds.length) bad2(['questions', i, 'typeIds'], 'Only per-attendee questions can be tied to ticket types.');
    });
    const aids = e.addOns.items.map((a) => a.id); aids.forEach((id, i) => { if (aids.indexOf(id) !== i) bad2(['addOns', 'items', i, 'id'], `Two add-ons use “${id}”.`); });
    const codes = e.discounts.map((d) => d.code.toUpperCase());
    e.discounts.forEach((d, i) => {
      if (codes.indexOf(d.code.toUpperCase()) !== i) bad2(['discounts', i, 'code'], `The code ${d.code} is there twice.`);
      d.typeIds.forEach((tid) => { if (!typeIds.includes(tid)) bad2(['discounts', i, 'typeIds'], `No ticket type “${tid}”.`); });
    });
  });

export const EventsSchema = z.object({
  enabled: z.boolean().default(true),                                        // whole module on/off for this organization
  showPast: z.boolean().default(true),
  defaultReminderDays: z.number().int().min(0).max(30).default(1),
  /** F9: center-limited admins send events for approval; how many days ahead an event must be planned. */
  approval: z.object({ required: z.boolean().default(true), leadDays: z.number().int().min(0).max(90).default(10) }).default({ required: true, leadDays: 10 }),
  events: z.array(EventSchema).max(200),
}).superRefine((d, ctx) => { const seen = new Set<string>(); d.events.forEach((e, i) => { if (seen.has(e.id)) ctx.addIssue({ code: 'custom', path: ['events', i, 'id'], message: `Two events use the id “${e.id}”.` }); seen.add(e.id); }); });
export type EventItem = z.infer<typeof EventSchema>;
export type RegType = z.infer<typeof RegTypeSchema>;
export type EventsDoc = z.infer<typeof EventsSchema>;

/* ---------- rules ---------- */
export type Viewer = { signedIn: boolean; planId?: string; groupIds?: string[] };
export const canSee = (e: EventItem, v: Viewer) => e.status !== 'draft' && (e.visibility === 'public' || (v.signedIn && (e.visibility === 'members' || (e.groupIds ?? []).some((g) => v.groupIds?.includes(g)))));
export const upcoming = (d: EventsDoc, now: string) => d.events.filter((e) => e.end.slice(0, 10) >= now.slice(0, 10)).sort((a, b) => a.start.localeCompare(b.start));
export const past = (d: EventsDoc, now: string) => d.events.filter((e) => e.end.slice(0, 10) < now.slice(0, 10)).sort((a, b) => b.start.localeCompare(a.start));
export const spotsLeft = (e: EventItem) => (e.registration.capacity ? Math.max(0, e.registration.capacity - e.registered) : Infinity);
/** One registration takes a seat for the person and one for each guest. */
export const seatsFor = (guests: number) => 1 + Math.max(0, Math.floor(guests));

export type RegState = { open: boolean; reason?: string; full: boolean; waitlist: boolean };
export function registrationState(e: EventItem, now: string, seats = 1): RegState {
  const r = e.registration;
  if (e.status === 'cancelled') return { open: false, reason: 'This event was cancelled.', full: false, waitlist: false };
  if (!r.enabled) return { open: false, reason: 'No registration needed – just come.', full: false, waitlist: false };
  if (r.opens && now < r.opens) return { open: false, reason: `Registration opens ${fmtWhen(r.opens)}.`, full: false, waitlist: false };
  if ((r.closes && now > r.closes) || now > e.start) return { open: false, reason: 'Registration is closed.', full: false, waitlist: false };
  const left = spotsLeft(e);
  const full = left < seats;
  if (full && !r.waitlist) return { open: false, reason: left === 0 ? 'This event is full.' : `Only ${left} spot${left === 1 ? '' : 's'} left – fewer guests, please.`, full: true, waitlist: false };
  return { open: true, full, waitlist: full && r.waitlist };
}
export function typeAvailable(t: RegType, v: Viewer, code?: string, e?: Pick<EventItem, 'typeCounts'>, seats = 1): { ok: boolean; reason?: string } {
  if (!t.enabled) return { ok: false, reason: 'Not available.' };
  if (t.limit && e && (e.typeCounts?.[t.id] ?? 0) + seats > t.limit) return { ok: false, reason: (e.typeCounts?.[t.id] ?? 0) >= t.limit ? 'No places left for this type.' : `Only ${t.limit - (e.typeCounts?.[t.id] ?? 0)} places left for this type.` };
  if (t.availability === 'members' && !v.signedIn) return { ok: false, reason: 'For members – sign in first.' };
  if (t.availability === 'plans' && (!v.signedIn || !v.planId || !t.planIds.includes(v.planId))) return { ok: false, reason: 'For some membership plans only.' };
  if (t.availability === 'code') {
    if (!t.code) return (code ?? '').trim() ? { ok: true } : { ok: false, reason: 'Enter the registration code you were given.' }; // public copy has no code – the server checks it
    if ((code ?? '').trim().toUpperCase() !== t.code.toUpperCase()) return { ok: false, reason: 'Enter the registration code you were given.' };
  }
  return { ok: true };
}
export const priceFor = (t: RegType, guests: number) => t.priceCents + Math.max(0, guests) * t.guestPriceCents;

/* ---------- Zeffy-style order rules (shared by the website, the admin preview and the API) ---------- */
export type Question = z.infer<typeof QuestionSchema>;
export type AddOn = z.infer<typeof AddOnSchema>;
export type EventDiscount = z.infer<typeof EventDiscountSchema>;
/** Seats one order takes: every ticket (the person + guests) × the ticket's group size. */
export const seatsForType = (t: Pick<RegType, 'groupSize'>, guests: number) => seatsFor(guests) * Math.max(1, t.groupSize ?? 1);
/** Is this ticket type on sale right now (its own sale window – early bird, last minute)? */
export function typeOnSale(t: Pick<RegType, 'salesStart' | 'salesEnd'>, now: string): { ok: boolean; reason?: string } {
  if (t.salesStart && now < t.salesStart) return { ok: false, reason: `On sale from ${fmtWhen(t.salesStart)}.` };
  if (t.salesEnd && now > t.salesEnd) return { ok: false, reason: 'No longer on sale.' };
  return { ok: true };
}
export function youTubeId(url: string): string {
  const m = url.match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
/** Questions asked for this ticket type: buyer questions once, attendee questions once per ticket holder. */
export const questionsFor = (e: Pick<EventItem, 'questions'>, typeId: string) => ({
  buyer: e.questions.filter((q) => q.scope === 'buyer'),
  attendee: e.questions.filter((q) => q.scope === 'attendee' && (!q.typeIds.length || q.typeIds.includes(typeId))),
});
/** Answer keys: buyer `q.id`, attendee `q.id#2` (ticket holder 2). Multi-choice answers are joined with " | ". */
export const answerKey = (q: Pick<Question, 'id' | 'scope'>, holder = 1) => (q.scope === 'buyer' ? q.id : `${q.id}#${holder}`);
export function answerIssues(e: Pick<EventItem, 'questions' | 'optionCounts'>, typeId: string, holders: number, answers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}; const qs = questionsFor(e, typeId);
  const picked: Record<string, number> = {};
  const check = (q: Question, key: string) => {
    const v = (answers[key] ?? '').trim();
    if (!v) { if (q.required || q.kind === 'single') out[key] = 'Please answer this.'; return; }
    if (q.kind === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) out[key] = 'Enter an email address.';
    if (q.kind === 'phone' && v.replace(/\D/g, '').length < 7) out[key] = 'Enter a phone number.';
    if (q.kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) out[key] = 'Pick a date.';
    if (q.kind === 'checkbox' && !['yes', 'no'].includes(v)) out[key] = 'Answer yes or no.';
    if (q.kind === 'single' || q.kind === 'multi') {
      const chosen = q.kind === 'single' ? [v] : v.split(' | ');
      for (const c of chosen) {
        const o = q.options.find((x) => x.label === c); if (!o) { out[key] = 'Choose one of the options.'; continue; }
        const k = `${q.id}:${c}`; picked[k] = (picked[k] ?? 0) + 1;
        if (o.limit && (e.optionCounts?.[k] ?? 0) + picked[k] > o.limit) out[key] = `“${c}” is full.`;
      }
    }
  };
  qs.buyer.forEach((q) => check(q, answerKey(q)));
  for (let h = 1; h <= holders; h++) qs.attendee.forEach((q) => check(q, answerKey(q, h)));
  return out;
}
/** How many of a choice are left (choice limits), for the form. */
export const optionLeft = (e: Pick<EventItem, 'optionCounts'>, q: Question, label: string) => { const o = q.options.find((x) => x.label === label); return o?.limit ? Math.max(0, o.limit - (e.optionCounts?.[`${q.id}:${label}`] ?? 0)) : Infinity; };

export type OrderIn = { typeId: string; guests: number; amountCents?: number; addOns?: Record<string, number>; donationCents?: number; code?: string };
export type OrderTotal = { ok: boolean; message?: string; tickets: number; seats: number; ticketCents: number; addOnCents: number; donationCents: number; discountCents: number; totalCents: number; receiptCents: number; discount?: { code: string; message: string } ; unknownCode?: boolean };
/** The order total exactly as the website shows it and the API charges it. Discounts apply to tickets only. */
export function orderTotal(e: Pick<EventItem, 'registration' | 'addOns' | 'discounts' | 'addOnCounts'>, o: OrderIn, now: string): OrderTotal {
  const t = e.registration.types.find((x) => x.id === o.typeId);
  const base = { tickets: 0, seats: 0, ticketCents: 0, addOnCents: 0, donationCents: 0, discountCents: 0, totalCents: 0, receiptCents: 0 };
  if (!t) return { ok: false, message: 'Choose a ticket.', ...base };
  const guests = Math.max(0, Math.floor(o.guests || 0)); const tickets = 1 + guests;
  let ticketCents = priceFor(t, guests);
  if (t.payWhatYouCan) {
    const each = Math.round(o.amountCents ?? t.priceCents);
    if (each < t.priceCents) return { ok: false, message: `The smallest amount is ${usd(t.priceCents)} per ticket.`, ...base };
    if (each > 10_000_00) return { ok: false, message: 'That amount is too large for one ticket.', ...base };
    ticketCents = each * tickets;
  }
  let addOnCents = 0;
  for (const [id, qty0] of Object.entries(o.addOns ?? {})) {
    const qty = Math.max(0, Math.floor(qty0)); if (!qty) continue;
    const a = e.addOns.items.find((x) => x.id === id); if (!a) return { ok: false, message: 'An extra is no longer offered.', ...base };
    if (qty > a.maxPerOrder) return { ok: false, message: `At most ${a.maxPerOrder} × ${a.name} per order.`, ...base };
    if (a.limit && (e.addOnCounts?.[id] ?? 0) + qty > a.limit) return { ok: false, message: `Only ${Math.max(0, a.limit - (e.addOnCounts?.[id] ?? 0))} × ${a.name} left.`, ...base };
    addOnCents += a.priceCents * qty;
  }
  const donationCents = e.addOns.donation.enabled ? Math.max(0, Math.round(o.donationCents ?? 0)) : 0;
  if (donationCents > 100_000_00) return { ok: false, message: 'Please give large gifts on the Give page.', ...base };
  let discountCents = 0; let discount: OrderTotal['discount']; let unknownCode = false;
  const code = (o.code ?? '').trim().toUpperCase();
  if (code) {
    const d = e.discounts.find((x) => x.code.toUpperCase() === code);
    if (!d) unknownCode = true;
    else if (d.ends && now > d.ends) return { ok: false, message: 'This code has ended.', ...base };
    else if (d.uses && d.used >= d.uses) return { ok: false, message: 'This code has been used up.', ...base };
    else if (d.typeIds.length && !d.typeIds.includes(t.id)) return { ok: false, message: 'This code is not for this ticket.', ...base };
    else {
      discountCents = Math.min(ticketCents, d.kind === 'percent' ? Math.round(ticketCents * d.value / 100) : d.value);
      discount = { code: d.code.toUpperCase(), message: d.kind === 'percent' ? `${d.value}% off` : `${usd(d.value)} off` };
    }
  }
  const receiptCents = (t.payWhatYouCan ? Math.max(0, ticketCents - discountCents - t.priceCents * tickets + (t.receiptCents * tickets)) : Math.max(0, Math.min(t.receiptCents * tickets, ticketCents - discountCents))) + donationCents;
  return { ok: true, tickets, seats: seatsForType(t, guests), ticketCents, addOnCents, donationCents, discountCents, totalCents: ticketCents - discountCents + addOnCents + donationCents, receiptCents, discount, unknownCode };
}
export const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: c % 100 ? 2 : 0 });
export function canCancel(e: EventItem, now: string) {
  const c = e.registration.cancellation;
  if (c.policy === 'none') return false;
  if (c.policy === 'anytime') return now < e.start;
  const lastDay = new Date(Date.parse(`${e.start.slice(0, 10)}T00:00:00Z`) - c.daysBefore * 86_400_000).toISOString().slice(0, 10);
  return now.slice(0, 10) <= lastDay;
}

/** What the website may show: registration codes never leave the server (anyone could read them in the page). */
export function publicEvent(e: EventItem): EventItem {
  return { ...e, approval: { state: 'none', requestedBy: '', by: '', on: '', note: '' }, promotion: { ...e.promotion, email: { ...e.promotion.email, audience: 'none' }, social: '' }, registration: { ...e.registration, types: e.registration.types.map(({ code: _code, ...t }) => t as RegType) },
    discounts: [], emails: { ...e.emails, notify: [] } };
}
export const publicEvents = (d: EventsDoc): EventsDoc => ({ ...d, events: d.events.filter((e) => e.status !== 'draft').map(publicEvent) });

/** What a cancellation gives back for a paid registration. */
export function refundFor(e: EventItem, paidCents: number, now: string): { allowed: boolean; refundCents: number; text: string } {
  if (!canCancel(e, now)) return { allowed: false, refundCents: 0, text: e.registration.cancellation.policy === 'none' ? 'Registrations cannot be cancelled.' : 'It is too late to cancel online.' };
  const c = e.registration.cancellation;
  const refund = c.refund ?? 'full', fee = c.feeCents ?? 0;
  const refundCents = !paidCents || refund === 'none' ? 0 : refund === 'full' ? paidCents : Math.max(0, paidCents - fee);
  return { allowed: true, refundCents, text: !paidCents ? 'You can cancel.' : refund === 'none' ? 'You can cancel, but payments are not refunded.' : refund === 'full' ? 'You can cancel for a full refund.' : `You can cancel; a ${(fee / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} fee is kept.` };
}
/** After a cancellation frees `freed` seats: who on the waitlist (in order, each with their party size) now gets a spot. */
export function promoteFromWaitlist(freed: number, waitlist: { id: string; seats: number }[]): string[] {
  const out: string[] = []; let left = freed;
  for (const w of waitlist) { if (w.seats <= left) { out.push(w.id); left -= w.seats; } else break; } // first come, first served – nobody skips ahead
  return out;
}

/** "Add to calendar" file (RFC 5545). Times are Houston local time with a fixed TZID; text is escaped. */
export function toIcs(e: EventItem, org: { name: string; domain: string }, stamp: string): string {
  const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const dt = (v: string) => v.replace(/[-:]/g, '') + '00';
  const fold = (line: string) => line.length <= 75 ? line : line.match(/.{1,74}/g)!.join('\r\n ');
  const loc = [e.location.name, e.location.address].filter(Boolean).join(', ');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${esc(org.name)}//Events//EN`, 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${e.id}@${org.domain}`, `DTSTAMP:${stamp}`, `DTSTART;TZID=America/Chicago:${dt(e.start)}`, `DTEND;TZID=America/Chicago:${dt(e.end)}`,
    `SUMMARY:${esc(e.title)}`, ...(e.summary ? [`DESCRIPTION:${esc(e.summary)}`] : []), ...(loc ? [`LOCATION:${esc(loc)}`] : []),
    ...(e.status === 'cancelled' ? ['STATUS:CANCELLED'] : []), 'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n');
}

export const fmtWhen = (s: string) => {
  const [d, t] = s.split('T'); const [y, m, day] = d.split('-').map(Number); const [hh, mm] = (t ?? '00:00').split(':').map(Number);
  const h12 = ((hh + 11) % 12) + 1;
  return `${String(m).padStart(2, '0')}/${String(day).padStart(2, '0')}/${y}, ${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
};
export const fmtRange = (e: EventItem) => {
  const a = fmtWhen(e.start), b = fmtWhen(e.end);
  return e.start.slice(0, 10) === e.end.slice(0, 10) ? `${a} – ${b.split(', ')[1]}` : `${a} – ${b}`;
};
export const CATEGORY_LABEL: Record<EventItem['category'], string> = { community: 'Community', education: 'Education', governance: 'Meetings and elections', youth: 'Youth', sisters: 'Sisters', fundraiser: 'Fundraiser', religious: 'Religious' };

export const TYPE_DEFAULTS = { description: '', category: '', salesStart: '', salesEnd: '', payWhatYouCan: false, groupSize: 1, receiptCents: 0 } as const;
const free = (id = 'general', name = 'General admission'): RegType => ({ id, name, priceCents: 0, guestPriceCents: 0, availability: 'everyone', planIds: [], limit: 0, enabled: true, ...TYPE_DEFAULTS });
const baseReg = { enabled: true, capacity: 0, waitlist: false, guests: { allowed: false, max: 0 }, cancellation: { policy: 'until' as const, daysBefore: 1, refund: 'full' as const, feeCents: 0 }, types: [free()] };

/** A new draft event with every default filled in (the builder starts from this). */
export function newEvent(id: string, day: string, place: { name: string; center?: string }, reminderDays = 1): EventItem {
  return EventSchema.parse({ id, title: 'New event', status: 'draft', start: `${day}T18:00`, end: `${day}T20:00`, location: { name: place.name, address: '', ...(place.center ? { center: place.center } : {}) },
    registration: { ...baseReg, types: [free()] }, reminders: [reminderDays] });
}

/** Built-in sample events (marked sample) until the organization adds its own. */
export const mockEvents: EventsDoc = EventsSchema.parse({
  enabled: true, showPast: true, defaultReminderDays: 1,
  events: [
    { id: 'shura-november-2026', title: 'Shura meeting – November', summary: 'Monthly Shura meeting. Members may attend; the meeting is also streamed for members.', category: 'governance', status: 'published',
      start: '2026-11-11T19:30', end: '2026-11-11T21:30', location: { name: 'ISGH Main Center', address: '3110 Eastside St, Houston, TX 77098', onlineUrl: 'https://isgh.org/livestream' },
      visibility: 'members', groupIds: [], registration: { ...baseReg, enabled: false, types: [free()] }, reminders: [1], registered: 0, waiting: 0, typeCounts: {}, sample: true },
    { id: 'candidates-forum-2026', title: 'Meet the candidates – 2026 elections', summary: 'Hear from the final candidates before Election Day on December 13. Questions from members.', category: 'governance', status: 'published',
      start: '2026-11-22T14:00', end: '2026-11-22T17:00', location: { name: 'ISGH Main Center', address: '3110 Eastside St, Houston, TX 77098' },
      visibility: 'public', groupIds: [], registration: { ...baseReg, capacity: 400, waitlist: true, types: [free('member', 'Member'), { ...free('guest', 'Guest (not a member)'), limit: 50 }] }, reminders: [7, 1], registered: 212, waiting: 0, typeCounts: {}, sample: true,
      promotion: { featured: true, email: { audience: 'members', sendOn: '2026-11-08', sent: false }, sms: { enabled: true, sendOn: '2026-11-21' }, social: '' } },
    { id: 'family-night-katy', title: 'Family night at Katy', summary: 'Dinner, games for children and a short talk. Bring the whole family.', category: 'community', status: 'published',
      start: '2026-11-07T18:30', end: '2026-11-07T21:00', location: { name: 'Masjid Aqsa – Katy', address: 'Katy, TX', center: 'Katy' },
      visibility: 'public', groupIds: [], registration: { ...baseReg, capacity: 120, waitlist: true, guests: { allowed: true, max: 4 }, cancellation: { policy: 'until', daysBefore: 2, refund: 'full', feeCents: 0 },
        types: [{ ...free('adult', 'Adult'), priceCents: 1000, guestPriceCents: 500 }, { ...free('member-adult', 'Adult – member price'), priceCents: 500, guestPriceCents: 500, availability: 'members' }] }, reminders: [2], registered: 120, waiting: 6, typeCounts: {}, sample: true,
      promotion: { featured: false, email: { audience: 'center', sendOn: '2026-10-20', sent: false }, sms: { enabled: false, sendOn: '' }, social: '' } },
    { id: 'nominee-orientation-2026', title: 'Election nominee orientation', summary: 'Required for every 2026 nominee (Bylaws Art. VII §4(H)). Watch online or attend in person, then sign the acknowledgment.', category: 'governance', status: 'published',
      start: '2026-11-01T11:00', end: '2026-11-01T13:00', location: { name: 'ISGH Main Center and online', address: '3110 Eastside St, Houston, TX 77098', onlineUrl: 'https://isghelection.org' },
      visibility: 'groups', groupIds: ['nominees-2026'], registration: { ...baseReg, cancellation: { policy: 'none', daysBefore: 0, refund: 'none', feeCents: 0 }, types: [{ ...free('nominee', 'Nominee'), availability: 'code', code: 'EC2026' }] }, reminders: [3, 1], registered: 41, waiting: 0, typeCounts: {}, sample: true },
    { id: 'weekend-school-open-house', title: 'Weekend school open house', summary: 'Meet the teachers and register your children for the spring term.', category: 'education', status: 'published',
      start: '2026-10-04T10:00', end: '2026-10-04T12:00', location: { name: 'Masjid Al-Mustafa – Bear Creek', address: 'Houston, TX', center: 'Bear Creek' },
      visibility: 'public', groupIds: [], registration: { ...baseReg, enabled: false }, reminders: [1], registered: 0, waiting: 0, typeCounts: {}, sample: true },
    { id: 'quran-class-southwest-1', title: 'Saturday Quran class', summary: 'Weekly tajweed class for adults. Beginners welcome; bring a mushaf.', category: 'education', status: 'published',
      start: '2026-11-14T11:00', end: '2026-11-14T12:30', location: { name: 'Southwest Islamic Center 1', address: 'Houston, TX', center: 'Southwest Islamic Center 1' },
      visibility: 'public', groupIds: [], registration: { ...baseReg, enabled: false }, reminders: [1], registered: 0, waiting: 0, typeCounts: {}, sample: true },
    { id: 'sisters-halaqa-southwest-1', title: 'Sisters’ halaqa and brunch', summary: 'A morning halaqa on the Seerah followed by brunch. Childcare in the next room.', category: 'sisters', status: 'draft',
      start: '2026-11-14T10:00', end: '2026-11-14T12:00', location: { name: 'Southwest Islamic Center 1', address: 'Houston, TX', center: 'Southwest Islamic Center 1' },
      visibility: 'public', groupIds: [], registration: { ...baseReg, capacity: 60, types: [{ ...free('adult', 'Adult'), priceCents: 500 }] }, reminders: [2], registered: 0, waiting: 0, typeCounts: {}, sample: true,
      approval: { state: 'pending', requestedBy: 'Center office – Southwest 1', by: '', on: '2026-10-12', note: '' },
      promotion: { featured: false, email: { audience: 'center', sendOn: '2026-11-03', sent: false }, sms: { enabled: false, sendOn: '' }, social: '' } },
    { id: 'youth-games-north-1', title: 'Youth games afternoon', summary: 'Basketball and board games for ages 12–17.', category: 'youth', status: 'draft',
      start: '2026-11-13T13:00', end: '2026-11-13T15:30', location: { name: 'North Islamic Center 1', address: 'Houston, TX', center: 'North Islamic Center 1' },
      visibility: 'public', groupIds: [], registration: { ...baseReg, enabled: false }, reminders: [1], registered: 0, waiting: 0, typeCounts: {}, sample: true,
      approval: { state: 'pending', requestedBy: 'Center office – North 1', by: '', on: '2026-10-14', note: '' } },
  ],
});
