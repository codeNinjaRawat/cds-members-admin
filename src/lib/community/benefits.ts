/**
 * F4 Member benefits – partner businesses and the offers they give ISGH members (not the dues/event discount codes in
 * Configuration, which lower what ISGH charges). The admin approves each partner (with an optional suitability review:
 * halal, no interest-based products, family-friendly), writes offers, picks which plans may use them, and sees use.
 * Members see "My benefits" in the member portal. Partners check a member with the privacy-first Verify page
 * (status only – never address, phone or birth date).
 * DEMO (no API). Live: /admin/benefits (document `benefits`), /member/benefits, /member/benefits/{id}/use.
 * Synced to the admin by admin/scripts/sync-contracts.mjs – edit here (web), never in the admin copy.
 */
import { z } from 'zod';

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31.');
const ISO_OR_EMPTY = z.union([ISO, z.literal('')]);
export const PLAN_IDS = ['single', 'family', 'life', 'associate'] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const PLAN_NAME: Record<PlanId, string> = { single: 'Single', family: 'Family', life: 'Life', associate: 'Associate' };

export const CATEGORIES = {
  food: 'Halal food and groceries', health: 'Health and clinics', education: 'Education and tutoring', travel: 'Travel, Hajj and Umrah',
  home: 'Home and auto services', shopping: 'Shopping and books', professional: 'Legal, tax and professional', other: 'Other',
} as const;
export type Category = keyof typeof CATEGORIES;
export const PARTNER_STATUS = { proposed: 'Proposed', approved: 'Approved', paused: 'Paused', ended: 'Ended' } as const;
export const KIND = { percent: 'Percent off', amount: 'Dollars off', free: 'Something free', price: 'Member price' } as const;
export const REDEEM = { card: 'Show the member card', code: 'One code for everyone', unique: 'A personal code per member', link: 'Book or buy online' } as const;
export const LIMIT = { unlimited: 'Every visit', once: 'Once per member', monthly: 'Once a month', yearly: 'Once a year' } as const;

/* ---------------- document `benefits` ---------------- */
export const PartnerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/, 'Use lowercase letters, numbers and dashes.'),
  name: z.string().trim().min(2, 'Enter the business name.').max(80),
  category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
  center: z.string().max(80),                                         // nearest Islamic Center ('' = all of Houston)
  address: z.string().max(160),
  phone: z.union([z.literal(''), z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/, 'Use a phone like (713) 555-0100.')]),
  website: z.union([z.literal(''), z.string().url('Use a full address like https://example.com').startsWith('https://', 'Use an https:// address.')]),
  contact: z.object({ name: z.string().max(80), email: z.union([z.literal(''), z.string().email('Check the email address.')]) }), // staff only
  status: z.enum(['proposed', 'approved', 'paused', 'ended']),
  agreementUntil: ISO_OR_EMPTY,
  reviewed: z.object({ by: z.string().max(80), on: ISO_OR_EMPTY }),   // suitability review (halal, no interest, family-friendly)
  notes: z.string().max(500).default(''),
});
export const OfferSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  partnerId: z.string(),
  title: z.string().trim().min(3, 'Give the offer a short title.').max(80),
  details: z.string().max(400),
  kind: z.enum(['percent', 'amount', 'free', 'price']),
  value: z.number().int().min(0).max(10_000_000),                   // percent (1–100) or cents
  redeem: z.enum(['card', 'code', 'unique', 'link']),
  code: z.string().max(20),
  url: z.string().max(300),
  plans: z.array(z.enum(PLAN_IDS)).min(1, 'Pick at least one plan.'),
  goodStanding: z.boolean(),                                          // only members whose dues for this year are paid
  limit: z.enum(['unlimited', 'once', 'monthly', 'yearly']),
  from: ISO,
  until: ISO,
  status: z.enum(['draft', 'live', 'paused']),
  featured: z.boolean().default(false),
});
export const BenefitsSchema = z.object({
  enabled: z.boolean(),                                               // show "My benefits" to members
  requireReview: z.boolean(),                                         // a partner needs a suitability review before offers go live
  showLocked: z.boolean(),                                            // members also see offers for other plans (marked "for Family members")
  partners: z.array(PartnerSchema).max(300),
  offers: z.array(OfferSchema).max(600),
}).superRefine((d, ctx) => {
  const pid = new Set<string>();
  d.partners.forEach((p, i) => {
    if (pid.has(p.id)) ctx.addIssue({ code: 'custom', path: ['partners', i, 'id'], message: `Two partners use “${p.id}”.` });
    pid.add(p.id);
    if (p.status === 'approved' && !p.agreementUntil) ctx.addIssue({ code: 'custom', path: ['partners', i, 'agreementUntil'], message: 'An approved partner needs an agreement end date.' });
  });
  const oid = new Set<string>();
  d.offers.forEach((o, i) => {
    const at = (f: string, message: string) => ctx.addIssue({ code: 'custom', path: ['offers', i, f], message });
    if (oid.has(o.id)) at('id', `Two offers use “${o.id}”.`);
    oid.add(o.id);
    const p = d.partners.find((x) => x.id === o.partnerId);
    if (!p) { at('partnerId', 'Pick the partner who gives this offer.'); return; }
    if (o.kind === 'percent' && (o.value < 1 || o.value > 100)) at('value', 'A percent must be between 1 and 100.');
    if ((o.kind === 'amount' || o.kind === 'price') && o.value < 1) at('value', 'Enter an amount.');
    if (o.redeem === 'code' && !/^[A-Z0-9-]{3,20}$/.test(o.code)) at('code', 'Codes use 3–20 capital letters, numbers or dashes.');
    if (o.redeem === 'link' && !/^https:\/\/\S+\.\S+/.test(o.url)) at('url', 'Use a full https:// address.');
    if (o.until < o.from) at('until', 'The end date is before the start date.');
    if (o.status === 'live') {
      if (p.status !== 'approved') at('status', `${p.name} is not approved yet – the offer cannot go live.`);
      else if (d.requireReview && !p.reviewed.on) at('status', `${p.name} has not had the suitability review yet.`);
      if (p.agreementUntil && o.until > p.agreementUntil) at('until', `The offer runs past the partner agreement (ends ${fmt(p.agreementUntil)}).`);
    }
  });
});
export type Partner = z.infer<typeof PartnerSchema>;
export type Offer = z.infer<typeof OfferSchema>;
export type Benefits = z.infer<typeof BenefitsSchema>;

/* ---------------- redemptions (operational, not part of the document) ---------------- */
export const RedemptionSchema = z.object({
  id: z.string().regex(/^R-\d{4,8}$/),
  at: z.string(),
  offerId: z.string(),
  memberId: z.string(),
  center: z.string(),
  via: z.enum(['portal', 'partner', 'office']),                       // member tapped "Use", partner checked the card, office recorded it
});
export type Redemption = z.infer<typeof RedemptionSchema>;

/* ---------------- rules ---------------- */
export const fmt = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '');
const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: c % 100 ? 2 : 0 });
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function discountLabel(o: Pick<Offer, 'kind' | 'value' | 'title'>): string {
  if (o.kind === 'percent') return `${o.value}% off`;
  if (o.kind === 'amount') return `${usd(o.value)} off`;
  if (o.kind === 'price') return `Member price ${usd(o.value)}`;
  return 'Free';
}

export type PartnerState = 'proposed' | 'approved' | 'paused' | 'ended' | 'expired' | 'review';
export function partnerState(p: Partner, d: Pick<Benefits, 'requireReview'>, today: string): PartnerState {
  if (p.status !== 'approved') return p.status;
  if (p.agreementUntil && p.agreementUntil < today) return 'expired';
  if (d.requireReview && !p.reviewed.on) return 'review';
  return 'approved';
}
export const PARTNER_STATE_LABEL: Record<PartnerState, string> = { proposed: 'Proposed', approved: 'Approved', paused: 'Paused', ended: 'Ended', expired: 'Agreement ended', review: 'Needs review' };

export type OfferState = 'draft' | 'paused' | 'scheduled' | 'live' | 'expired' | 'partner-off';
export function offerState(o: Offer, d: Benefits, today: string): OfferState {
  if (o.status === 'draft') return 'draft';
  if (o.status === 'paused') return 'paused';
  const p = d.partners.find((x) => x.id === o.partnerId);
  if (!p || partnerState(p, d, today) !== 'approved') return 'partner-off';
  if (o.until < today) return 'expired';
  if (o.from > today) return 'scheduled';
  return 'live';
}
export const OFFER_STATE_LABEL: Record<OfferState, string> = { draft: 'Draft', paused: 'Paused', scheduled: 'Starts later', live: 'Live', expired: 'Ended', 'partner-off': 'Partner not active' };

/** What the BE knows about the signed-in member (no personal details needed). */
export type MemberFacts = { id: string; plan: PlanId; active: boolean; goodStanding: boolean };

export function eligibility(o: Offer, m: MemberFacts): { ok: boolean; why: string } {
  if (!m.active) return { ok: false, why: 'Benefits are for active members.' };
  if (!o.plans.includes(m.plan)) return { ok: false, why: `For ${listPlans(o.plans)} members.` };
  if (o.goodStanding && !m.goodStanding && m.plan !== 'life') return { ok: false, why: 'Pay this year’s dues to use this offer.' };
  return { ok: true, why: '' };
}
export const listPlans = (p: PlanId[]) => {
  const n = PLAN_IDS.filter((x) => p.includes(x)).map((x) => PLAN_NAME[x]);
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};

/** May this member use the offer again today? */
export function usage(o: Offer, memberId: string, reds: Redemption[], today: string): { ok: boolean; why: string; used: number } {
  const mine = reds.filter((r) => r.offerId === o.id && r.memberId === memberId);
  const day = (r: Redemption) => r.at.slice(0, 10);
  if (o.limit === 'once' && mine.length) return { ok: false, why: `Used on ${fmt(day(mine[0]))} – this offer is once per member.`, used: mine.length };
  if (o.limit === 'monthly' && mine.some((r) => day(r).slice(0, 7) === today.slice(0, 7))) return { ok: false, why: 'Already used this month – again next month.', used: mine.length };
  if (o.limit === 'yearly' && mine.some((r) => day(r).slice(0, 4) === today.slice(0, 4))) return { ok: false, why: `Already used in ${today.slice(0, 4)} – again next year.`, used: mine.length };
  return { ok: true, why: '', used: mine.length };
}

/** A personal code that only this member gets for this offer (the BE stores it; the partner can check it). */
export function memberCode(memberId: string, offerId: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${memberId}:${offerId}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';                      // no 0/O/1/I – easy to read out at a counter
  let s = ''; for (let i = 0; i < 6; i++) { s += A[h % 32]; h = Math.floor(h / 32) ^ (i * 2654435761 >>> 0); h >>>= 0; }
  return `ISGH-${s}`;
}

/** The offers a member sees, best first: usable, then used up, then (if shown) for other plans. */
export function memberOffers(d: Benefits, m: MemberFacts, reds: Redemption[], today: string) {
  if (!d.enabled) return [];
  return d.offers
    .filter((o) => offerState(o, d, today) === 'live')
    .map((o) => {
      const partner = d.partners.find((p) => p.id === o.partnerId)!;
      const el = eligibility(o, m);
      const use = el.ok ? usage(o, m.id, reds, today) : { ok: false, why: el.why, used: 0 };
      return { offer: o, partner, eligible: el.ok, canUse: el.ok && use.ok, why: el.ok ? use.why : el.why, used: use.used };
    })
    .filter((x) => x.eligible || (d.showLocked && m.active))
    .sort((a, b) => Number(b.canUse) - Number(a.canUse) || Number(b.eligible) - Number(a.eligible) || Number(b.offer.featured) - Number(a.offer.featured) || a.offer.until.localeCompare(b.offer.until));
}

/** The part of the document that may reach members' browsers: no staff contacts, notes or reviewer names, no drafts,
 *  no partners that are not approved. The BE sends only this from GET /member/benefits. */
export function memberSafe(d: Benefits): Benefits {
  const partners = d.partners.filter((p) => p.status === 'approved').map((p) => ({ ...p, contact: { name: '', email: '' }, notes: '', reviewed: { by: '', on: p.reviewed.on } }));
  return { ...d, partners, offers: d.offers.filter((o) => o.status === 'live' && partners.some((p) => p.id === o.partnerId)) };
}

/** What a partner sees when checking a member (Verify page): status only, never contact details. */
export function partnerView(m: { firstName: string; lastName: string; active: boolean; validThrough: string | null }) {
  return { name: `${m.firstName} ${m.lastName.slice(0, 1)}.`, status: m.active ? 'Active member' : 'Not active', validThrough: m.validThrough ? fmt(m.validThrough) : (m.active ? 'Lifetime' : '') };
}

/** Things for the benefits team to look at. */
export function benefitWarnings(d: Benefits, today: string): { text: string; partner?: string; offer?: string }[] {
  const out: { text: string; partner?: string; offer?: string }[] = [];
  for (const p of d.partners) {
    const st = partnerState(p, d, today);
    if (p.status === 'proposed') out.push({ partner: p.id, text: `${p.name} is waiting for approval.` });
    if (st === 'review') out.push({ partner: p.id, text: `${p.name} needs the suitability review before its offers can show.` });
    if (st === 'expired') out.push({ partner: p.id, text: `${p.name}: the agreement ended ${fmt(p.agreementUntil)} – its offers are hidden.` });
    else if (p.status === 'approved' && p.agreementUntil && p.agreementUntil <= addDays(today, 30)) out.push({ partner: p.id, text: `${p.name}: the agreement ends ${fmt(p.agreementUntil)} – renew or let it end.` });
    if (st === 'approved' && !d.offers.some((o) => o.partnerId === p.id && offerState(o, d, today) === 'live')) out.push({ partner: p.id, text: `${p.name} is approved but has no live offer.` });
  }
  for (const o of d.offers) {
    const st = offerState(o, d, today);
    if (st === 'live' && o.until <= addDays(today, 21)) out.push({ offer: o.id, text: `“${o.title}” ends ${fmt(o.until)}.` });
  }
  return out;
}

export function benefitStats(d: Benefits, reds: Redemption[], today: string) {
  const live = d.offers.filter((o) => offerState(o, d, today) === 'live');
  const month = today.slice(0, 7);
  const thisMonth = reds.filter((r) => r.at.slice(0, 7) === month);
  const months = Array.from({ length: 6 }, (_, i) => { const dt = new Date(Date.parse(`${month}-15T12:00:00Z`)); dt.setUTCMonth(dt.getUTCMonth() - (5 - i)); return dt.toISOString().slice(0, 7); });
  const catOf = (offerId: string) => { const o = d.offers.find((x) => x.id === offerId); return d.partners.find((p) => p.id === o?.partnerId)?.category ?? 'other'; };
  const byCategory = (Object.keys(CATEGORIES) as Category[]).map((c) => ({ id: c, label: CATEGORIES[c], value: reds.filter((r) => catOf(r.offerId) === c).length })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const top = d.offers.map((o) => ({ id: o.id, label: o.title, value: reds.filter((r) => r.offerId === o.id).length })).filter((x) => x.value).sort((a, b) => b.value - a.value).slice(0, 6);
  return {
    liveOffers: live.length,
    partners: d.partners.filter((p) => partnerState(p, d, today) === 'approved').length,
    waiting: d.partners.filter((p) => p.status === 'proposed' || partnerState(p, d, today) === 'review').length,
    usesThisMonth: thisMonth.length,
    membersThisMonth: new Set(thisMonth.map((r) => r.memberId)).size,
    byMonth: months.map((m) => ({ id: m, label: new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), value: reds.filter((r) => r.at.slice(0, 7) === m).length })),
    byCategory, top,
    byVia: (['portal', 'partner', 'office'] as const).map((v) => ({ id: v, label: v === 'portal' ? 'Member portal' : v === 'partner' ? 'Partner checked the card' : 'Office', value: reds.filter((r) => r.via === v).length })),
  };
}

/* ---------------- demo data (fictional businesses, marked "demo") ---------------- */
const P = (id: string, name: string, category: Category, center: string, status: Partner['status'], agreementUntil: string, reviewedOn: string, extra: Partial<Partner> = {}): Partner => ({
  id, name, category, center, address: '', phone: '', website: '', contact: { name: '', email: '' }, status, agreementUntil,
  reviewed: { by: reviewedOn ? 'Benefits committee' : '', on: reviewedOn }, notes: '', ...extra,
});
export const mockBenefits: Benefits = {
  enabled: true, requireReview: true, showLocked: true,
  partners: [
    P('crescent-grocers', 'Crescent Grocers (demo)', 'food', 'Southwest Islamic Center 1', 'approved', '2027-06-30', '2026-01-12', { address: '1000 Demo Blvd, Houston, TX 77036', phone: '(713) 555-0110', contact: { name: 'Store manager', email: 'manager@crescent.example.org' } }),
    P('olive-grill', 'Olive Tree Grill (demo)', 'food', 'North Islamic Center 1', 'approved', '2026-11-05', '2026-02-03'),
    P('family-clinic', 'Sunrise Family Clinic (demo)', 'health', '', 'approved', '2027-12-31', '2026-03-20', { website: 'https://clinic.example.org' }),
    P('quran-tutors', 'Bright Path Tutoring (demo)', 'education', 'Northwest Islamic Center 1', 'approved', '2027-05-31', '2026-04-02'),
    P('safar-travel', 'Safar Travel (demo)', 'travel', '', 'approved', '2027-03-31', '', { notes: 'Hajj and Umrah packages – review the payment plan terms (no interest).' }),
    P('bayou-auto', 'Gulf Coast Auto Care (demo)', 'home', 'Southeast Islamic Center 1', 'approved', '2026-09-30', '2025-10-01'),
    P('noor-books', 'Noor Books and Gifts (demo)', 'shopping', '', 'approved', '2027-08-31', '2026-05-15', { website: 'https://books.example.org' }),
    P('tax-help', 'Main Street Tax Help (demo)', 'professional', 'South Islamic Center 2', 'proposed', '', ''),
  ],
  offers: [
    { id: 'grocers-10', partnerId: 'crescent-grocers', title: '10% off groceries', details: 'On any purchase. Not with other sales.', kind: 'percent', value: 10, redeem: 'card', code: '', url: '', plans: ['single', 'family', 'life', 'associate'], goodStanding: false, limit: 'unlimited', from: '2026-01-15', until: '2027-06-30', status: 'live', featured: true },
    { id: 'grocers-ramadan', partnerId: 'crescent-grocers', title: 'Free dates box in Ramadan', details: 'One box per family during Ramadan 2027.', kind: 'free', value: 0, redeem: 'unique', code: '', url: '', plans: ['family', 'life'], goodStanding: true, limit: 'yearly', from: '2027-02-01', until: '2027-03-31', status: 'live', featured: false },
    { id: 'grill-15', partnerId: 'olive-grill', title: '15% off dine-in', details: 'Sunday to Thursday.', kind: 'percent', value: 15, redeem: 'card', code: '', url: '', plans: ['single', 'family', 'life', 'associate'], goodStanding: false, limit: 'unlimited', from: '2026-02-10', until: '2026-10-31', status: 'live', featured: false },
    { id: 'clinic-visit', partnerId: 'family-clinic', title: 'Member price for a first visit', details: 'For patients without insurance.', kind: 'price', value: 4_900, redeem: 'link', code: '', url: 'https://clinic.example.org/book', plans: ['single', 'family', 'life'], goodStanding: true, limit: 'yearly', from: '2026-04-01', until: '2027-12-31', status: 'live', featured: true },
    { id: 'tutor-trial', partnerId: 'quran-tutors', title: 'First month of tutoring $40 off', details: 'Math, reading and Quran classes.', kind: 'amount', value: 4_000, redeem: 'code', code: 'ISGH40', url: '', plans: ['family', 'life'], goodStanding: true, limit: 'once', from: '2026-04-15', until: '2027-05-31', status: 'live', featured: false },
    { id: 'umrah-200', partnerId: 'safar-travel', title: '$200 off an Umrah package', details: 'Waiting for the suitability review.', kind: 'amount', value: 20_000, redeem: 'unique', code: '', url: '', plans: ['single', 'family', 'life'], goodStanding: true, limit: 'once', from: '2026-11-01', until: '2027-03-31', status: 'draft', featured: false },
    { id: 'auto-oil', partnerId: 'bayou-auto', title: 'Oil change for $29', details: 'Most cars.', kind: 'price', value: 2_900, redeem: 'card', code: '', url: '', plans: ['single', 'family', 'life', 'associate'], goodStanding: false, limit: 'monthly', from: '2025-10-01', until: '2026-09-30', status: 'live', featured: false },
    { id: 'books-20', partnerId: 'noor-books', title: '20% off books online', details: 'Islamic books, children’s books and gifts.', kind: 'percent', value: 20, redeem: 'code', code: 'ISGHREAD', url: '', plans: ['single', 'family', 'life', 'associate'], goodStanding: false, limit: 'unlimited', from: '2026-05-20', until: '2027-08-31', status: 'live', featured: false },
    { id: 'books-eid', partnerId: 'noor-books', title: 'Free gift wrap for Eid', details: 'In the store, the week before Eid.', kind: 'free', value: 0, redeem: 'card', code: '', url: '', plans: ['single', 'family', 'life', 'associate'], goodStanding: false, limit: 'unlimited', from: '2026-05-20', until: '2027-08-31', status: 'paused', featured: false },
  ],
};

const DEMO_MEMBERS = ['HOU-204781', 'HOU-100562', 'HOU-200341', 'HOU-202593', 'HOU-204557', 'HOU-209623', 'HOU-211663', 'HOU-201226'];
const USED = ['grocers-10', 'grocers-10', 'grocers-10', 'grill-15', 'grill-15', 'clinic-visit', 'tutor-trial', 'auto-oil', 'books-20', 'books-20'];
export const mockRedemptions: Redemption[] = Array.from({ length: 64 }, (_, i) => {
  const at = new Date(Date.parse('2026-10-15T17:00:00Z') - (i * 67 + (i % 7) * 11) * 3_600_000).toISOString();
  const offerId = USED[(i * 3) % USED.length];
  return {
    id: `R-${String(5000 + i)}`, at, offerId, memberId: DEMO_MEMBERS[(i * 5) % DEMO_MEMBERS.length],
    center: mockBenefits.partners.find((p) => p.id === mockBenefits.offers.find((o) => o.id === offerId)?.partnerId)?.center || 'Southwest Islamic Center 1',
    via: (i % 5 === 0 ? 'office' : i % 3 === 0 ? 'partner' : 'portal') as Redemption['via'],
  };
}).filter((r, i, all) => r.offerId !== 'tutor-trial' || !all.slice(i + 1).some((x) => x.offerId === 'tutor-trial' && x.memberId === r.memberId)); // once per member: keep the first use
