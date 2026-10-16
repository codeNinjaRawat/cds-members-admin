/**
 * F8 Fundraising – campaigns with a goal and a fund (Ramadan, building, Zakat), matching sponsors, monthly giving,
 * pledges, peer-to-peer pages that members start for a campaign (approved by staff before they show), and donor
 * insights (new, retained, LYBUNT = gave Last Year But Unfortunately Not This, SYBUNT = Some Year But Unfortunately
 * Not This). Money given to a campaign stays in the campaign's fund – Zakat stays Zakat.
 * DEMO (no API). Live: /admin/fundraising (document `fundraising`), gifts come from Donations (F3) with a campaign tag.
 * Synced to the admin by sync-contracts.mjs – edit here (web), never in the admin copy.
 */
import { z } from 'zod';

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-03-10.');
const CENTS = z.number().int().min(0).max(10_000_000_000);
export const MatchSchema = z.object({ sponsor: z.string().trim().min(2, 'Name the sponsor (or “Anonymous sponsor”).').max(80), ratio: z.number().min(0.25).max(3), capCents: CENTS.min(100, 'Set how much the sponsor will match.'), from: ISO, to: ISO });
export const CampaignSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/, 'Use lowercase words and dashes – this is the web address.'),
  name: z.string().trim().min(3, 'Give the campaign a name.').max(80),
  fund: z.string().min(2),
  goalCents: CENTS.min(10_000, 'Set a goal of at least $100.'),
  start: ISO, end: ISO,
  center: z.string().max(80),                       // '' = all of ISGH
  story: z.string().max(3000),
  status: z.enum(['draft', 'live', 'closed']),
  matching: z.array(MatchSchema).max(5),
  p2p: z.object({ enabled: z.boolean(), approval: z.boolean(), minGoalCents: CENTS }),
  monthly: z.boolean(),                             // offer monthly giving
  showDonors: z.boolean(),                          // show first names of donors who allow it
  featured: z.boolean(),
});
export const PageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/),
  campaignId: z.string(),
  owner: z.object({ name: z.string().trim().min(2).max(80), memberId: z.string().max(20) }),
  title: z.string().trim().min(3, 'Give the page a title.').max(80),
  story: z.string().max(1200),
  goalCents: CENTS,
  status: z.enum(['pending', 'approved', 'rejected', 'hidden']),
  createdOn: ISO,
  note: z.string().max(300),                        // why it was rejected or hidden
});
export const FundraisingSchema = z.object({
  campaigns: z.array(CampaignSchema).max(200),
  pages: z.array(PageSchema).max(2000),
  website: z.object({ enabled: z.boolean() }),
}).superRefine((d, ctx) => {
  const ids = new Set<string>();
  d.campaigns.forEach((c, i) => {
    const at = (f: string, message: string) => ctx.addIssue({ code: 'custom', path: ['campaigns', i, f], message });
    if (ids.has(c.id)) at('id', `Two campaigns use “${c.id}”.`); ids.add(c.id);
    if (c.end < c.start) at('end', 'The campaign ends before it starts.');
    c.matching.forEach((m, j) => { if (m.to < m.from) ctx.addIssue({ code: 'custom', path: ['campaigns', i, 'matching', j, 'to'], message: 'Matching ends before it starts.' }); if (m.from < c.start || m.to > c.end) ctx.addIssue({ code: 'custom', path: ['campaigns', i, 'matching', j, 'from'], message: 'Matching must be inside the campaign dates.' }); });
    if (c.p2p.enabled && c.p2p.minGoalCents > c.goalCents) at('p2p', 'A personal page goal cannot be above the campaign goal.');
  });
  d.pages.forEach((p, i) => {
    const c = d.campaigns.find((x) => x.id === p.campaignId);
    if (!c) ctx.addIssue({ code: 'custom', path: ['pages', i, 'campaignId'], message: 'This page’s campaign does not exist.' });
    else if (!c.p2p.enabled && p.status === 'approved') ctx.addIssue({ code: 'custom', path: ['pages', i, 'status'], message: `${c.name} does not take personal pages.` });
    else if (p.goalCents < c.p2p.minGoalCents) ctx.addIssue({ code: 'custom', path: ['pages', i, 'goalCents'], message: 'Below the campaign’s smallest page goal.' });
  });
});
export type Campaign = z.infer<typeof CampaignSchema>;
export type P2PPage = z.infer<typeof PageSchema>;
export type Fundraising = z.infer<typeof FundraisingSchema>;

/* ---------------- gifts and pledges (records; live: Donations with a campaign tag) ---------------- */
export const GiftSchema = z.object({
  id: z.string().regex(/^G-\d{4,8}$/),
  campaignId: z.string(), pageId: z.string(),
  at: z.string(),
  amountCents: z.number().int().min(100),
  donor: z.object({ key: z.string().min(1), name: z.string().max(80), memberId: z.string().max(20), anonymous: z.boolean(), showName: z.boolean() }),
  monthly: z.boolean(),
  source: z.enum(['online', 'office', 'pledge']),
});
export type Gift = z.infer<typeof GiftSchema>;
export const PledgeSchema = z.object({ id: z.string(), campaignId: z.string(), donor: z.object({ key: z.string(), name: z.string() }), totalCents: z.number().int().min(100), dueBy: ISO });
export type Pledge = z.infer<typeof PledgeSchema>;

/* ---------------- rules ---------------- */
export const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: c % 100 ? 2 : 0 });
export const fmt = (s: string) => (s ? `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}` : '');
const day = (s: string) => s.slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

export type CampaignState = 'draft' | 'scheduled' | 'live' | 'ended' | 'closed';
export function campaignState(c: Campaign, today: string): CampaignState {
  if (c.status === 'draft') return 'draft';
  if (c.status === 'closed') return 'closed';
  if (today < c.start) return 'scheduled';
  if (today > c.end) return 'ended';
  return 'live';
}
export const STATE_LABEL: Record<CampaignState, string> = { draft: 'Draft', scheduled: 'Starts later', live: 'Live', ended: 'Ended – close it', closed: 'Closed' };

/** Matching money per sponsor: each gift in the sponsor's window is matched at the ratio until the cap runs out (in gift order). */
export function matching(c: Campaign, gifts: Gift[]) {
  const mine = gifts.filter((g) => g.campaignId === c.id).sort((a, b) => a.at.localeCompare(b.at));
  return c.matching.map((m) => {
    let left = m.capCents; let matched = 0;
    for (const g of mine) { const d = day(g.at); if (d < m.from || d > m.to || left <= 0) continue; const add = Math.min(left, Math.round(g.amountCents * m.ratio)); matched += add; left -= add; }
    return { sponsor: m.sponsor, ratio: m.ratio, capCents: m.capCents, matchedCents: matched, leftCents: left, full: left <= 0 };
  });
}
export function progress(c: Campaign, gifts: Gift[], pledges: Pledge[], today: string) {
  const mine = gifts.filter((g) => g.campaignId === c.id);
  const given = mine.reduce((a, g) => a + g.amountCents, 0);
  const matched = matching(c, gifts).reduce((a, m) => a + m.matchedCents, 0);
  const pledged = pledges.filter((p) => p.campaignId === c.id).reduce((a, p) => a + p.totalCents, 0);
  const total = given + matched;
  return {
    givenCents: given, matchedCents: matched, totalCents: total, pct: Math.round((total / c.goalCents) * 100),
    donors: new Set(mine.map((g) => g.donor.key)).size, gifts: mine.length, monthly: new Set(mine.filter((g) => g.monthly).map((g) => g.donor.key)).size,
    avgCents: mine.length ? Math.round(given / mine.length) : 0, pledgedCents: pledged,
    daysLeft: Math.max(0, daysBetween(today, c.end)), reached: total >= c.goalCents,
  };
}
export function pageProgress(p: P2PPage, gifts: Gift[]) {
  const mine = gifts.filter((g) => g.pageId === p.id);
  const total = mine.reduce((a, g) => a + g.amountCents, 0);
  return { totalCents: total, donors: new Set(mine.map((g) => g.donor.key)).size, pct: p.goalCents ? Math.round((total / p.goalCents) * 100) : 0 };
}
/** Pledge: how much of it has been paid (gifts from the same donor to the same campaign marked as pledge payments). */
export function pledgeStatus(p: Pledge, gifts: Gift[], today: string) {
  const paid = gifts.filter((g) => g.campaignId === p.campaignId && g.donor.key === p.donor.key && g.source === 'pledge').reduce((a, g) => a + g.amountCents, 0);
  return { paidCents: paid, leftCents: Math.max(0, p.totalCents - paid), done: paid >= p.totalCents, late: paid < p.totalCents && today > p.dueBy };
}
/** What the public may see of a gift: never amounts with names, never anonymous names. */
export function publicDonorWall(c: Campaign, gifts: Gift[], n = 12) {
  if (!c.showDonors) return [];
  return gifts.filter((g) => g.campaignId === c.id && g.donor.showName && !g.donor.anonymous && g.donor.name).sort((a, b) => b.at.localeCompare(a.at)).slice(0, n)
    .map((g) => ({ name: g.donor.name.split(' ')[0], when: day(g.at) }));
}
/** Donor insights for a year (all campaigns). */
export function donorInsights(gifts: Gift[], year: number) {
  const by = new Map<string, { name: string; years: Set<number>; total: number; last: string }>();
  for (const g of gifts) { const y = Number(g.at.slice(0, 4)); const r = by.get(g.donor.key) ?? { name: g.donor.anonymous ? 'Anonymous' : g.donor.name, years: new Set<number>(), total: 0, last: '' }; r.years.add(y); if (y === year) r.total += g.amountCents; if (g.at > r.last) r.last = g.at; by.set(g.donor.key, r); }
  const list = Array.from(by.entries()).map(([key, r]) => ({ key, ...r }));
  const thisY = list.filter((r) => r.years.has(year)), lastY = list.filter((r) => r.years.has(year - 1));
  const retained = thisY.filter((r) => r.years.has(year - 1));
  const isNew = thisY.filter((r) => Math.min(...r.years) === year);
  const lybunt = lastY.filter((r) => !r.years.has(year));
  const sybunt = list.filter((r) => !r.years.has(year) && !r.years.has(year - 1) && Math.max(...r.years) < year - 1);
  return {
    donors: thisY.length, newDonors: isNew.length, retained: retained.length,
    retentionPct: lastY.length ? Math.round((retained.length / lastY.length) * 100) : 0,
    lybunt: lybunt.sort((a, b) => b.last.localeCompare(a.last)).map((r) => ({ key: r.key, name: r.name, lastGift: day(r.last) })),
    sybunt: sybunt.sort((a, b) => b.last.localeCompare(a.last)).map((r) => ({ key: r.key, name: r.name, lastGift: day(r.last) })),
    monthlyDonors: new Set(gifts.filter((g) => g.monthly && g.at.startsWith(String(year))).map((g) => g.donor.key)).size,
    top: thisY.sort((a, b) => b.total - a.total).slice(0, 5).map((r) => ({ name: r.name, totalCents: r.total })),
  };
}
export function fundraisingWarnings(d: Fundraising, gifts: Gift[], pledges: Pledge[], today: string, activeFunds: string[]): { text: string; campaign?: string; page?: string }[] {
  const out: { text: string; campaign?: string; page?: string }[] = [];
  for (const c of d.campaigns) {
    const st = campaignState(c, today);
    if (st === 'ended') out.push({ campaign: c.id, text: `${c.name} ended ${fmt(c.end)} – close it so the page shows the final total.` });
    if ((st === 'live' || st === 'scheduled') && !activeFunds.includes(c.fund)) out.push({ campaign: c.id, text: `${c.name}: the fund “${c.fund}” is not an active donation fund.` });
    if (st === 'live') {
      const p = progress(c, gifts, pledges, today);
      if (p.reached) out.push({ campaign: c.id, text: `${c.name} reached its goal (${usd(p.totalCents)} of ${usd(c.goalCents)}) – thank donors or raise the goal.` });
      for (const m of matching(c, gifts)) if (m.full) out.push({ campaign: c.id, text: `${c.name}: ${m.sponsor}’s match is used up – stop saying gifts are matched.` });
      if (p.daysLeft <= 7 && p.pct < 75) out.push({ campaign: c.id, text: `${c.name}: ${p.daysLeft} days left at ${p.pct}% – time for a reminder.` });
    }
  }
  const waiting = d.pages.filter((p) => p.status === 'pending');
  if (waiting.length) out.push({ page: waiting[0].id, text: `${waiting.length} personal fundraising page${waiting.length === 1 ? '' : 's'} waiting for approval.` });
  const late = pledges.filter((p) => pledgeStatus(p, gifts, today).late);
  if (late.length) out.push({ text: `${late.length} pledge${late.length === 1 ? '' : 's'} past due – send a gentle reminder.` });
  return out;
}
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'campaign';

/* ---------------- demo ---------------- */
export const mockFundraising: Fundraising = {
  website: { enabled: true },
  campaigns: [
    { id: 'expansion-phase-2', name: 'Southwest masjid expansion – phase 2', fund: 'building', goalCents: 75_000_000, start: '2026-09-01', end: '2026-12-31', center: 'Southwest Islamic Center 1', story: 'Our prayer hall is full every Jumu’ah. Phase 2 adds space for 400 more worshippers and a sisters’ entrance.', status: 'live',
      matching: [{ sponsor: 'A local family (anonymous)', ratio: 1, capCents: 5_000_000, from: '2026-10-01', to: '2026-10-31' }], p2p: { enabled: true, approval: true, minGoalCents: 50_000 }, monthly: true, showDonors: true, featured: true },
    { id: 'ramadan-1448-iftar', name: 'Ramadan 1448 iftar and food boxes', fund: 'ramadan', goalCents: 18_000_000, start: '2027-02-08', end: '2027-03-10', center: '', story: 'Daily iftar at every center and food boxes for families in need.', status: 'live',
      matching: [{ sponsor: 'Demo Halal Foods (sponsor)', ratio: 0.5, capCents: 2_000_000, from: '2027-02-28', to: '2027-03-09' }], p2p: { enabled: true, approval: true, minGoalCents: 25_000 }, monthly: false, showDonors: true, featured: false },
    { id: 'zakat-winter-2026', name: 'Winter Zakat for families', fund: 'zakat', goalCents: 12_000_000, start: '2026-10-01', end: '2026-12-15', center: '', story: 'Zakat given here goes only to verified Zakat-eligible families (rent, utilities, winter needs).', status: 'live',
      matching: [], p2p: { enabled: false, approval: true, minGoalCents: 0 }, monthly: true, showDonors: false, featured: false },
    { id: 'school-laptops-2026', name: 'Weekend school laptops', fund: 'education', goalCents: 1_500_000, start: '2026-05-01', end: '2026-08-31', center: 'North Islamic Center 1', story: '30 laptops for the weekend school computer class.', status: 'live',
      matching: [], p2p: { enabled: false, approval: true, minGoalCents: 0 }, monthly: false, showDonors: true, featured: false },
    { id: 'ramadan-1447-iftar', name: 'Ramadan 1447 iftar', fund: 'ramadan', goalCents: 15_000_000, start: '2026-02-18', end: '2026-03-20', center: '', story: '', status: 'closed', matching: [], p2p: { enabled: true, approval: true, minGoalCents: 25_000 }, monthly: false, showDonors: true, featured: false },
  ],
  pages: [
    { id: 'aisha-runs-for-the-masjid', campaignId: 'expansion-phase-2', owner: { name: 'Aisha R.', memberId: 'HOU-204781' }, title: 'Aisha runs 10K for the new prayer hall', story: 'I am running the city 10K in November. Every mile for the masjid!', goalCents: 300_000, status: 'approved', createdOn: '2026-09-12', note: '' },
    { id: 'youth-car-wash', campaignId: 'expansion-phase-2', owner: { name: 'SW1 Youth Group', memberId: '' }, title: 'Youth car wash Saturdays', story: 'Every Saturday in October, 10 AM to 2 PM, in the masjid parking lot.', goalCents: 150_000, status: 'approved', createdOn: '2026-09-20', note: '' },
    { id: 'imran-birthday', campaignId: 'expansion-phase-2', owner: { name: 'Imran S.', memberId: 'HOU-100562' }, title: 'My birthday for the masjid', story: 'Instead of gifts, please give to the expansion.', goalCents: 100_000, status: 'pending', createdOn: '2026-10-13', note: '' },
    { id: 'family-iftar-1447', campaignId: 'ramadan-1447-iftar', owner: { name: 'Hussain family', memberId: '' }, title: 'Feed 100 fasting people', story: '', goalCents: 100_000, status: 'approved', createdOn: '2026-02-20', note: '' },
  ],
};
const NAMES = ['Bilal', 'Maryam', 'Omar', 'Hana', 'Yusuf', 'Zainab', 'Ali', 'Fatima', 'Ibrahim', 'Sara', 'Khalid', 'Noor', 'Hamza', 'Amina', 'Tariq', 'Layla', 'Idris', 'Huda', 'Musa', 'Rania'];
export const mockGifts: Gift[] = (() => {
  const out: Gift[] = []; let n = 7000;
  const push = (campaignId: string, pageId: string, at: string, amountCents: number, i: number, monthly = false, source: Gift['source'] = 'online') => out.push({ id: `G-${n++}`, campaignId, pageId, at, amountCents, monthly, source, donor: { key: `d${i % 40}`, name: `${NAMES[i % 20]} ${['K.', 'S.', 'R.', 'A.'][i % 4]}`, memberId: i % 5 === 0 ? `HOU-2${String(100000 + i).slice(1)}` : '', anonymous: i % 9 === 0, showName: i % 3 !== 0 } });
  // last two years (donor history for retention)
  for (let i = 0; i < 34; i++) push('ramadan-1447-iftar', i % 6 === 0 ? 'family-iftar-1447' : '', `2026-0${2 + (i % 2)}-${String(18 + (i % 10)).padStart(2, '0')}T20:00:00Z`, 5_000 + (i % 7) * 2_500, i + 2);
  for (let i = 0; i < 30; i++) out.push({ id: `G-${n++}`, campaignId: 'ramadan-1447-iftar', pageId: '', at: `2025-03-${String(1 + (i % 28)).padStart(2, '0')}T20:00:00Z`, amountCents: 4_000 + (i % 5) * 3_000, monthly: false, source: 'online', donor: { key: `d${(i * 3) % 46}`, name: `${NAMES[(i * 3) % 20]} ${['K.', 'S.', 'R.', 'A.'][i % 4]}`, memberId: '', anonymous: false, showName: true } });
  for (let i = 0; i < 18; i++) out.push({ id: `G-${n++}`, campaignId: 'ramadan-1447-iftar', pageId: '', at: `2024-03-${String(10 + (i % 15)).padStart(2, '0')}T20:00:00Z`, amountCents: 5_000, monthly: false, source: 'online', donor: { key: `d${40 + (i % 9)}`, name: `${NAMES[(i + 5) % 20]} B.`, memberId: '', anonymous: false, showName: true } });
  // this campaign season
  for (let i = 0; i < 60; i++) push('expansion-phase-2', i % 8 === 0 ? 'aisha-runs-for-the-masjid' : i % 11 === 0 ? 'youth-car-wash' : '', `2026-${i < 25 ? '09' : '10'}-${String(1 + (i % 14)).padStart(2, '0')}T18:00:00Z`, [10_000, 25_000, 50_000, 100_000, 250_000][i % 5], i, i % 6 === 0, i % 13 === 0 ? 'office' : 'online');
  for (let i = 0; i < 14; i++) push('zakat-winter-2026', '', `2026-10-${String(1 + i).padStart(2, '0')}T15:00:00Z`, 20_000 + (i % 4) * 15_000, i + 3, i % 4 === 0);
  for (let i = 0; i < 9; i++) push('school-laptops-2026', '', `2026-06-${String(3 + i * 2).padStart(2, '0')}T15:00:00Z`, 20_000 + i * 5_000, i + 11);
  push('expansion-phase-2', '', '2026-10-05T18:00:00Z', 200_000, 1, false, 'pledge');
  return out;
})();
export const mockPledges: Pledge[] = [
  { id: 'P-1', campaignId: 'expansion-phase-2', donor: { key: 'd1', name: 'Maryam S.' }, totalCents: 1_000_000, dueBy: '2026-12-31' },
  { id: 'P-2', campaignId: 'expansion-phase-2', donor: { key: 'd7', name: 'Fatima A.' }, totalCents: 500_000, dueBy: '2026-09-30' },
];

/* ---------------- website view (no gift records leave the server) ---------------- */
export type PublicCampaign = ReturnType<typeof publicCampaigns>[number];
export function publicCampaigns(d: Fundraising, gifts: Gift[], pledges: Pledge[], today: string) {
  if (!d.website.enabled) return [];
  return d.campaigns.filter((c) => c.status !== 'draft').map((c) => {
    const st = campaignState(c, today); const p = progress(c, gifts, pledges, today);
    const m = matching(c, gifts).find((x) => !x.full && today >= c.matching.find((y) => y.sponsor === x.sponsor)!.from && today <= c.matching.find((y) => y.sponsor === x.sponsor)!.to);
    return {
      id: c.id, name: c.name, story: c.story, center: c.center, fund: c.fund, start: c.start, end: c.end, state: st, featured: c.featured, monthly: c.monthly,
      goalCents: c.goalCents, totalCents: p.totalCents, matchedCents: p.matchedCents, pct: p.pct, donors: p.donors, daysLeft: p.daysLeft,
      matchNow: m ? { sponsor: m.sponsor, ratio: m.ratio, leftCents: m.leftCents } : null,
      p2p: c.p2p.enabled && st === 'live', minPageGoalCents: c.p2p.minGoalCents,
      wall: publicDonorWall(c, gifts),
      pages: d.pages.filter((x) => x.campaignId === c.id && x.status === 'approved').map((x) => ({ id: x.id, title: x.title, owner: x.owner.name, story: x.story, goalCents: x.goalCents, ...pageProgress(x, gifts) })),
    };
  }).sort((a, b) => Number(b.state === 'live') - Number(a.state === 'live') || Number(b.featured) - Number(a.featured) || b.end.localeCompare(a.end));
}
