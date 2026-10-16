/**
 * F3 Donations and Check-o-matic – every gift (online platforms and in person), which fund and center it belongs to,
 * reconciliation with the platforms' payouts, receipts, and the Check-o-matic rule (a gift of $40 or more to General
 * or Sadaqah at a masjid can lead to membership – how far it goes is the admin's choice; the Bylaws default is safest).
 * DEMO (no API). Live: /admin/donations… and the platform webhooks (Stripe, PayPal, Medina, Bloomerang) – the BE runs
 * these same functions. Synced to the admin by admin/scripts/sync-contracts.mjs – edit here (web), never in the admin copy.
 */
import { z } from 'zod';

const CENTS = z.number().int().min(0).max(100_000_000);
export const PLATFORMS = { stripe: 'Stripe (website card)', paypal: 'PayPal', medina: 'Medina kiosk', bloomerang: 'Bloomerang', cash: 'Cash', check: 'Check' } as const;
export type Platform = keyof typeof PLATFORMS;
export const ONLINE: Platform[] = ['stripe', 'paypal', 'medina', 'bloomerang'];

/* ---------------- settings (published document `donation-settings`) ---------------- */
export const FundSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(2).max(60),
  restricted: z.boolean(),                                  // money that may only be spent on its purpose
  route: z.enum(['given', 'main', 'all']),                  // which center gets it: the one given to, the main center, shared
  zakat: z.boolean().default(false),                        // Zakat-eligible fund (feeds F2 payouts)
  active: z.boolean().default(true),
});
export const DonationSettingsSchema = z.object({
  funds: z.array(FundSchema).min(1).max(40),
  mainCenter: z.string().max(80),
  platforms: z.record(z.enum(['stripe', 'paypal', 'medina', 'bloomerang']), z.object({ enabled: z.boolean(), lastSync: z.string().default('') })),
  receiptAboveCents: CENTS,                                 // written acknowledgment (IRS: $250 or more)
  checkomatic: z.object({
    mode: z.enum(['off', 'supporter', 'application', 'member']),
    minCents: CENTS,
    funds: z.array(z.string()).max(10),
    countsAsDues: z.boolean(),                              // may the gift count as the member's own dues (and so the vote)?
  }),
}).superRefine((s, ctx) => {
  const ids = new Set<string>();
  s.funds.forEach((f, i) => { if (ids.has(f.id)) ctx.addIssue({ code: 'custom', path: ['funds', i, 'id'], message: `Two funds use “${f.id}”.` }); ids.add(f.id); });
  s.checkomatic.funds.forEach((f, i) => { if (!ids.has(f)) ctx.addIssue({ code: 'custom', path: ['checkomatic', 'funds', i], message: `There is no fund “${f}”.` }); });
  if (s.checkomatic.mode !== 'off' && !s.checkomatic.funds.length) ctx.addIssue({ code: 'custom', path: ['checkomatic', 'funds'], message: 'Pick at least one fund that counts.' });
  if (s.checkomatic.countsAsDues && s.checkomatic.mode !== 'member') ctx.addIssue({ code: 'custom', path: ['checkomatic', 'countsAsDues'], message: 'Only when a gift makes someone a member can it count as dues.' });
  if (s.funds.filter((f) => f.zakat && f.active).length === 0) ctx.addIssue({ code: 'custom', path: ['funds'], message: 'Keep one active Zakat fund – Zakat payouts are paid from it.' });
});
export type Fund = z.infer<typeof FundSchema>;
export type DonationSettings = z.infer<typeof DonationSettingsSchema>;
export const CHECKOMATIC_MODES = {
  off: 'Off – gifts never change membership (Bylaws default)',
  supporter: 'Supporter – the donor is thanked and listed, no membership',
  application: 'Application – the donor gets a membership application that the Board approves',
  member: 'Member – the donor becomes a member until June 30 (no Board step)',
} as const;
export const mockDonationSettings: DonationSettings = {
  funds: [
    { id: 'general', name: 'General operating', restricted: false, route: 'given', zakat: false, active: true },
    { id: 'zakat', name: 'Zakat', restricted: true, route: 'main', zakat: true, active: true },
    { id: 'sadaqah', name: 'Sadaqah', restricted: true, route: 'given', zakat: false, active: true },
    { id: 'building', name: 'Building and expansion', restricted: true, route: 'given', zakat: false, active: true },
    { id: 'ramadan', name: 'Ramadan programs', restricted: true, route: 'main', zakat: false, active: true },
    { id: 'education', name: 'Education', restricted: true, route: 'all', zakat: false, active: true },
  ],
  mainCenter: 'Southwest Islamic Center 1',
  platforms: { stripe: { enabled: true, lastSync: '2026-10-15T14:00:00.000Z' }, paypal: { enabled: true, lastSync: '2026-10-15T13:45:00.000Z' }, medina: { enabled: true, lastSync: '2026-10-15T13:30:00.000Z' }, bloomerang: { enabled: false, lastSync: '' } },
  receiptAboveCents: 25_000,
  checkomatic: { mode: 'application', minCents: 4_000, funds: ['general', 'sadaqah'], countsAsDues: false },
};

/* ---------------- donations ---------------- */
export const DonationSchema = z.object({
  id: z.string().regex(/^D-\d{4,8}$/),
  at: z.string(),
  donor: z.object({ name: z.string().trim().min(2).max(80), email: z.string().max(120).default(''), memberId: z.string().default(''), anonymous: z.boolean().default(false) }),
  amountCents: z.number().int().min(100, 'Enter the amount.').max(100_000_000),
  feeCents: z.number().int().min(0).default(0),
  fund: z.string().default(''),                             // '' = not known yet (needs reconciling)
  center: z.string().default(''),
  platform: z.enum(Object.keys(PLATFORMS) as [Platform, ...Platform[]]),
  ref: z.string().max(60).default(''),                      // platform transaction id, check number, receipt book number
  payout: z.string().max(60).default(''),                   // platform payout (bank deposit) it arrived in; '' = not yet
  recurring: z.boolean().default(false),
  refunded: z.boolean().default(false),
  receiptSent: z.boolean().default(false),
  enteredBy: z.string().default(''),
});
export type Donation = z.infer<typeof DonationSchema>;
export type ReconState = 'matched' | 'unmatched' | 'pending' | 'refunded';
export const RECON_LABEL: Record<ReconState, string> = { matched: 'Matched', unmatched: 'Needs a fund or donor', pending: 'Waiting for the deposit', refunded: 'Refunded' };

/** Matched = fund and donor known and the money is in the bank; unmatched = we do not know the fund or the donor;
 *  pending = an online gift not yet in a platform deposit (cash and checks are deposited when entered). */
export function reconState(d: Donation): ReconState {
  if (d.refunded) return 'refunded';
  if (!d.fund || (!d.donor.memberId && !d.donor.email && !d.donor.anonymous && d.donor.name.startsWith('Unknown'))) return 'unmatched';
  if (ONLINE.includes(d.platform) && !d.payout) return 'pending';
  return 'matched';
}
/** Which center the money is booked to (fund routing). */
export function routedCenter(d: Donation, s: DonationSettings): string {
  const f = s.funds.find((x) => x.id === d.fund);
  if (!f) return d.center;
  return f.route === 'main' ? s.mainCenter : f.route === 'all' ? 'All centers' : d.center;
}
export const netOf = (d: Donation) => (d.refunded ? 0 : d.amountCents - d.feeCents);
export const needsReceipt = (d: Donation, s: DonationSettings) => !d.refunded && !d.donor.anonymous && d.amountCents >= s.receiptAboveCents && !d.receiptSent;

/** Problems with a gift entered by hand (cash or check at a center). */
export function entryProblems(d: Donation, s: DonationSettings): string[] {
  const out: string[] = [];
  const r = DonationSchema.safeParse(d);
  if (!r.success) out.push(...r.error.issues.map((i) => i.message));
  if (!d.fund) out.push('Pick the fund the gift is for.');
  else if (!s.funds.some((f) => f.id === d.fund && f.active)) out.push('That fund is not active.');
  if (!d.center) out.push('Pick the center that received it.');
  if (d.platform === 'check' && !/^\d{2,10}$/.test(d.ref)) out.push('Enter the check number.');
  if (!['cash', 'check'].includes(d.platform)) out.push('Only cash and checks are entered by hand – online gifts arrive by themselves.');
  return out;
}

/** Check-o-matic: does this gift lead to membership (and until when)? Membership year ends June 30. */
export function checkomatic(d: Donation, s: DonationSettings): { qualifies: boolean; until: string; why: string } {
  const c = s.checkomatic;
  const y = Number(d.at.slice(0, 4)), m = Number(d.at.slice(5, 7));
  const until = `${m >= 7 ? y + 1 : y}-06-30`;
  if (c.mode === 'off') return { qualifies: false, until: '', why: 'Check-o-matic is off.' };
  if (d.refunded) return { qualifies: false, until: '', why: 'Refunded.' };
  if (!c.funds.includes(d.fund)) return { qualifies: false, until: '', why: 'This fund does not count.' };
  if (d.amountCents < c.minCents) return { qualifies: false, until: '', why: `Less than ${usd(c.minCents)}.` };
  if (d.donor.anonymous) return { qualifies: false, until: '', why: 'Anonymous gift.' };
  return { qualifies: true, until, why: c.mode === 'member' ? `Member until ${fmt(until)}.` : c.mode === 'application' ? 'Membership application for the Board.' : 'Listed as a supporter.' };
}
/** People who qualified, newest gift first, with whether they are already members. */
export function checkomaticDonors(list: Donation[], s: DonationSettings) {
  const by = new Map<string, { key: string; name: string; email: string; memberId: string; total: number; last: Donation; until: string }>();
  for (const d of list) {
    const q = checkomatic(d, s); if (!q.qualifies) continue;
    const key = d.donor.memberId || d.donor.email || d.donor.name;
    const cur = by.get(key);
    if (!cur) by.set(key, { key, name: d.donor.name, email: d.donor.email, memberId: d.donor.memberId, total: d.amountCents, last: d, until: q.until });
    else { cur.total += d.amountCents; if (d.at > cur.last.at) { cur.last = d; cur.until = q.until > cur.until ? q.until : cur.until; } }
  }
  return Array.from(by.values()).sort((a, b) => b.last.at.localeCompare(a.last.at));
}

export function donationStats(list: Donation[], s: DonationSettings) {
  const live = list.filter((d) => !d.refunded);
  const sum = (l: Donation[]) => l.reduce((t, d) => t + d.amountCents, 0);
  const state = (st: ReconState) => list.filter((d) => reconState(d) === st);
  return {
    count: live.length, grossCents: sum(live), feesCents: live.reduce((t, d) => t + d.feeCents, 0), netCents: live.reduce((t, d) => t + netOf(d), 0),
    byFund: s.funds.map((f) => ({ id: f.id, label: f.name, cents: sum(live.filter((d) => d.fund === f.id)) })).filter((x) => x.cents > 0),
    byPlatform: (Object.keys(PLATFORMS) as Platform[]).map((p) => ({ id: p, label: PLATFORMS[p], cents: sum(live.filter((d) => d.platform === p)) })).filter((x) => x.cents > 0),
    recon: (['matched', 'unmatched', 'pending', 'refunded'] as ReconState[]).map((st) => ({ id: st, label: RECON_LABEL[st], count: state(st).length })),
    receiptsDue: list.filter((d) => needsReceipt(d, s)).length,
    recurring: live.filter((d) => d.recurring).length,
    checkomatic: checkomaticDonors(list, s).length,
  };
}

export const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: c % 100 ? 2 : 0 });
const fmt = (d: string) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;

/* ---------------- demo gifts (fictional donors; centers match the F1 demo map) ---------------- */
const CENTERS = ['North Islamic Center 1', 'North Islamic Center 2', 'Northwest Islamic Center 1', 'Southwest Islamic Center 1', 'Southwest Islamic Center 2', 'South Islamic Center 2', 'Southeast Islamic Center 1'];
const FUNDS = ['general', 'general', 'zakat', 'sadaqah', 'sadaqah', 'building', 'ramadan', 'education'];
const PLAT: Platform[] = ['stripe', 'stripe', 'stripe', 'paypal', 'medina', 'medina', 'cash', 'check'];
const AMTS = [2_500, 5_000, 4_000, 10_000, 25_000, 50_000, 3_000, 100_000, 7_500, 20_000, 150_000, 4_500];
export const mockDonations: Donation[] = Array.from({ length: 48 }, (_, i) => {
  const plat = PLAT[i % PLAT.length];
  const amount = AMTS[(i * 7) % AMTS.length];
  const fee = ONLINE.includes(plat) ? Math.round(amount * 0.029) + 30 : 0;
  const day = new Date(Date.parse('2026-10-15T18:00:00Z') - (i * 31 + (i % 5) * 7) * 3_600_000).toISOString();
  const unknown = i === 5;                           // i 17 has a donor but no fund
  const member = i % 9 === 0 ? ['HOU-200341', 'HOU-202593', 'HOU-204557', 'HOU-209623', 'HOU-211663', 'HOU-201226'][(i / 9) % 6] : ''; // a few gifts from demo members
  return {
    id: `D-${String(10480 + i)}`, at: day,
    donor: { name: unknown ? 'Unknown donor (Medina kiosk)' : `Donor ${String.fromCharCode(65 + (i % 26))}. ${['Karim', 'Siddiqui', 'Patel', 'Hussain', 'Mirza', 'Osman', 'Farah', 'Qureshi'][i % 8]}`, email: unknown ? '' : `donor${i}@example.org`, memberId: unknown ? '' : member, anonymous: i === 9 },
    amountCents: amount, feeCents: fee, fund: i === 17 ? '' : FUNDS[i % FUNDS.length], center: CENTERS[i % CENTERS.length], platform: plat,
    ref: plat === 'check' ? String(1040 + i) : plat === 'cash' ? `RB-${300 + i}` : `${plat.slice(0, 2).toUpperCase()}-${88000 + i * 13}`,
    payout: ONLINE.includes(plat) ? (i < 6 ? '' : `PO-${2026}${String(1000 + Math.floor(i / 6))}`) : `DEP-${700 + Math.floor(i / 8)}`,
    recurring: i % 7 === 0, refunded: i === 23, receiptSent: amount >= 25_000 && i % 4 !== 0, enteredBy: ['cash', 'check'].includes(plat) ? 'Front office' : '',
  };
});
