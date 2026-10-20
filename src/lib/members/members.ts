/**
 * A3 Members – DEMO data + Bylaws eligibility (no API; owner: "keep everything dummy").
 * Live (BE B3/B4/B5/B6): GET /admin/members (server paging/sort/filter), GET /admin/members/:id,
 * POST /admin/members/:id/{approve|id-verified|payments|center|notes}. Same shapes as below.
 *
 * Eligibility (Bylaws Art. I Sec. 2) for membership year Y, evaluated in America/Chicago on the record date (June 30 of Y):
 *   Board-approved · age 18+ on the record date · own dues for Y paid on/before the record date (or by a relative by blood
 *   or marriage) – Life members are exempt · residency (zone + Islamic Center) set · not resigned or expelled.
 */

import { DEFAULT_LIFECYCLE, memberClass, MembershipSettingsSchema, mockMembershipSettings, noVoteMessage, qualifiesByGifts, type Lifecycle, type MembershipRules, type MembershipSettings, type Plan } from '@/lib/content/membership';
import { coverageOfYear, duesCoverVote, standingOn, type Standing } from '@/lib/content/renewal';
import { csvCell, fieldsFor, showValue, type FieldValues } from '@/lib/community/member-records';
import type { ProfileField } from '@/lib/community/org-config';
import type { Prefs } from '@/lib/community/campaigns';
import { currentAdminName } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';

export type PlanId = 'single' | 'family' | 'life' | 'associate';
export type ZoneId = 'n' | 'nw' | 'sw' | 's' | 'se';
export type Payment = { year: number; paidOn: string; amountCents: number; method: 'card' | 'check' | 'cash'; payer: 'self' | 'spouse' | 'parent' | 'other'; ref: string };
export type JoinProgress = { step?: string; stepLabel?: string; furthest?: string; furthestIndex?: number; total?: number; startedAt?: string; lastSeen?: string; reminders?: number; lastReminded?: string; finishedAt?: string; draft?: Record<string, unknown> };
export type AuditEntry = { at: string; by: string; action: string; detail: string };
export type Member = {
  id: string; first: string; last: string; email: string; phone: string; dob: string;
  street: string; city: string; state?: string; zip: string; zone: ZoneId; center: string; centerOverride?: { center: string; reason: string; lockedUntil?: string };
  plan: PlanId; joined: number; appliedOn: string; approvedOn: string | null;
  idCheck: 'verified' | 'pending' | 'not_started'; standing: 'good' | 'resigned' | 'expelled';
  /** Live data: the end of the member's current paid membership term (null = none / lifetime). Absent in demo data. */
  paidThrough?: string | null;
  /** Live data: the database's status from the membership terms (a suspended lifetime member is 'expired'). */
  termStatus?: string;
  /** Never became a member: 'applied' = applied, waiting for a decision · 'incomplete' = never finished (no membership, never verified). */
  joinStage?: 'applied' | 'incomplete';
  /** the website join form for someone who has not finished: where they are and everything they typed (saved as they go) */
  join?: JoinProgress;
  spouseId?: string; payments: Payment[]; notes: { at: string; by: string; text: string }[]; audit: AuditEntry[];
  commitment: 'programs' | 'contribution' | 'volunteer';
  /** Extra profile fields (Admin › Configuration › Profile fields), by field ID. */
  extra?: FieldValues;
  /** Archived records are kept for history but hidden from lists, cannot sign in and never vote. */
  archived?: { on: string; reason: string; by: string };
  /** Staff decided these look-alike records are different people. */
  notDuplicateOf?: string[];
  source?: 'import';
  /** Email / text choices (website › Email preferences). Missing = the demo default from prefsOf(). */
  prefs?: Prefs;
};
export type Status = 'pending' | 'active' | 'life' | 'expired' | 'resigned' | 'expelled' | 'archived';

export const ZONES: Record<ZoneId, string> = { n: 'North', nw: 'Northwest', sw: 'Southwest', s: 'South', se: 'Southeast' };
export const PLANS: Record<PlanId, { name: string; cents: number }> = { single: { name: 'Single', cents: 2500 }, family: { name: 'Family', cents: 4000 }, life: { name: 'Life', cents: 100000 }, associate: { name: 'Associate', cents: 2500 } };
/** Zone and plan names are this organization's own (Masjids and zones, Membership plans) – the values above are ISGH's
 *  starter labels for the demo. loadOrgLabels() replaces them in place, so every screen shows the right names. */
export const LABELS_EVENT = 'ms:labels';
/** Live: the organization's published Masjids and zones (null until loaded – demo screens use the demo structure). */
export let ORG_STRUCTURE: unknown = null;
export async function loadOrgLabels(): Promise<boolean> {
  const get = (k: string) => fetch(`/api/store/${k}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<{ data?: unknown } | null>;
  const [org, ms] = await Promise.all([get('org-structure'), get('membership-settings')]);
  const zones = (org?.data as { zones?: { id: string; name: string }[] } | undefined)?.zones;
  const centers = (org?.data as { centers?: { name: string; zone: string; active?: boolean }[] } | undefined)?.centers;
  if (org?.data && Array.isArray(centers) && centers.length) ORG_STRUCTURE = org.data;   // the published Masjids and zones (live)
  if (Array.isArray(centers) && centers.length) { for (const k of Object.keys(CENTERS)) delete CENTERS[k]; for (const c of centers) if (c.active !== false) (CENTERS[c.zone] ??= []).push(c.name); }
  const plans = (ms?.data as { plans?: { id: string; name: string; priceCents: number }[] } | undefined)?.plans;
  const before = JSON.stringify([ZONES, PLANS, CENTERS, YEAR, ORG_TZ, RECORD_MD]);
  const set = ms?.data as { timezone?: string; recordDate?: string } | undefined;
  if (typeof set?.timezone === 'string' && set.timezone) { try { new Intl.DateTimeFormat('en-US', { timeZone: set.timezone }); ORG_TZ = set.timezone; } catch { /* keep */ } }
  if (typeof set?.recordDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(set.recordDate)) RECORD_MD = set.recordDate.slice(5, 10);
  if (LIVE) YEAR = Number(orgToday().slice(0, 4));   // live: the organization's own calendar year (demo data stays in 2026)
  if (Array.isArray(zones) && zones.length) { for (const k of Object.keys(ZONES)) delete (ZONES as Record<string, string>)[k]; for (const z of zones) (ZONES as Record<string, string>)[z.id] = z.name; }
  if (Array.isArray(plans) && plans.length) { for (const k of Object.keys(PLANS)) delete (PLANS as Record<string, unknown>)[k]; for (const p of plans) (PLANS as Record<string, { name: string; cents: number }>)[p.id] = { name: p.name, cents: p.priceCents }; }
  const changed = JSON.stringify([ZONES, PLANS, CENTERS, YEAR, ORG_TZ, RECORD_MD]) !== before;
  if (changed && typeof window !== 'undefined') window.dispatchEvent(new Event(LABELS_EVENT));
  return changed;
}
const CENTERS: Record<string, string[]> = {};   // filled by loadOrgLabels from Masjids and zones
export const centersOf = (z: ZoneId) => CENTERS[z] ?? [1, 2, 3, 4].map((n) => `${ZONES[z]} Islamic Center ${n}`);
export const STATUS_LABEL: Record<Status, string> = { pending: 'Pending approval', active: 'Active', life: 'Life', expired: 'Not renewed', resigned: 'Resigned', expelled: 'Expelled', archived: 'Archived' };
export const COMMITMENT_LABEL = { programs: 'Takes part in one of our programs', contribution: 'Contributes at least 1% of yearly income', volunteer: 'Volunteers in approved activities' };

/** Current membership year (a calendar year) and the voting record date (month and day from Membership settings).
 *  Demo: 2026, June 30, Houston's clock. Live: loadOrgLabels() sets them from the organization's settings and today. */
export let YEAR = 2026;
export let ORG_TZ = 'America/Chicago';
let RECORD_MD = '06-30';
export const recordDate = (y: number) => `${y}-${RECORD_MD}`;
/** Today in the organization's time zone (demo: the demo data's date). */
export const orgToday = () => (LIVE ? new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ }) : '2026-10-12');

/* ---------- deterministic demo data ---------- */
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FIRST_M = ['Ahmed', 'Omar', 'Yusuf', 'Ibrahim', 'Bilal', 'Hamza', 'Khalid', 'Imran', 'Tariq', 'Faisal', 'Zaid', 'Hassan', 'Mustafa', 'Adnan', 'Salman', 'Idris', 'Kareem', 'Nabil', 'Rashid', 'Sami'];
const FIRST_F = ['Aisha', 'Fatima', 'Maryam', 'Amina', 'Khadija', 'Zainab', 'Sara', 'Hana', 'Noor', 'Layla', 'Safiya', 'Huda', 'Rania', 'Asma', 'Iman', 'Samira', 'Yasmin', 'Sumayya', 'Hafsa', 'Nadia'];
const LAST = ['Khan', 'Rahman', 'Siddiqui', 'Hassan', 'Ali', 'Ahmed', 'Qureshi', 'Malik', 'Chaudhry', 'Hussain', 'Abdullah', 'Farooqui', 'Sheikh', 'Mirza', 'Osman', 'Haddad', 'Nasser', 'Saleh', 'Mahmoud', 'Yilmaz', 'Diallo', 'Bakr', 'Jaber', 'Karim', 'Ansari', 'Patel', 'Mohamed', 'Ibrahim', 'Aziz', 'Rashid'];
const STREETS = ['Beechnut St', 'Bellaire Blvd', 'Hillcroft St', 'Westheimer Rd', 'Bissonnet St', 'Wilcrest Dr', 'Kirkwood Rd', 'Gessner Rd', 'Aldine Mail Rte', 'Kuykendahl Rd', 'Spring Cypress Rd', 'Tidwell Rd', 'Airline Dr', 'Cullen Blvd', 'Almeda Rd', 'Fuqua St', 'Telephone Rd', 'Spencer Hwy', 'Fairmont Pkwy', 'Red Bluff Rd', 'Barker Cypress Rd', 'Fry Rd', 'Mason Rd', 'Eldridge Pkwy'];
const AREA: Record<ZoneId, { city: string; zips: string[] }[]> = {
  n: [{ city: 'Houston', zips: ['77014', '77067', '77090', '77068'] }, { city: 'Spring', zips: ['77379', '77388', '77373'] }],
  nw: [{ city: 'Houston', zips: ['77040', '77041', '77064', '77084'] }, { city: 'Katy', zips: ['77449', '77450', '77494'] }, { city: 'Cypress', zips: ['77429', '77433'] }],
  sw: [{ city: 'Houston', zips: ['77036', '77072', '77074', '77081', '77099'] }, { city: 'Sugar Land', zips: ['77478', '77479'] }, { city: 'Missouri City', zips: ['77489'] }],
  s: [{ city: 'Houston', zips: ['77045', '77047', '77075', '77089'] }, { city: 'Pearland', zips: ['77581', '77584'] }],
  se: [{ city: 'Pasadena', zips: ['77502', '77504', '77505'] }, { city: 'Houston', zips: ['77034', '77062'] }, { city: 'League City', zips: ['77573'] }],
};
const AREA_CODES = ['713', '281', '832', '346'];
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const TODAY = '2026-10-12';
function addDays(d: string, n: number) { const t = Date.parse(`${String(d ?? '').slice(0, 10)}T12:00:00Z`); if (Number.isNaN(t)) return String(d ?? ''); const s = new Date(t + n * 86_400_000).toISOString().slice(0, 10); return s > TODAY ? TODAY : s; }

let cache: Member[] | null = null;
export function demoMembers(): Member[] {
  if (cache) return cache;
  const r = rng(20261013);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const zoneW: [ZoneId, number][] = [['sw', .31], ['n', .21], ['nw', .19], ['se', .17], ['s', .12]];
  const zoneOf = () => { let x = r(); for (const [z, w] of zoneW) { if ((x -= w) < 0) return z; } return 'sw'; };
  const out: Member[] = [];
  for (let i = 0; i < 320; i++) {
    const female = r() < .5;
    const first = pick(female ? FIRST_F : FIRST_M), last = pick(LAST);
    const zone = zoneOf(); const area = pick(AREA[zone]); const zip = pick(area.zips);
    const by = 1950 + Math.floor(r() * 56); // some are 17–18 in 2026 (age rule)
    const dob = iso(by, 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28));
    const pr = r();
    const plan: PlanId = pr < .07 ? 'life' : pr < .1 ? 'associate' : pr < .52 ? 'family' : 'single';
    const joined = 2008 + Math.floor(r() * 19);
    const pending = joined >= 2026 && r() < .55;
    const appliedOn = iso(joined, 1 + Math.floor(r() * (joined === 2026 ? 9 : 12)), 1 + Math.floor(r() * 28));
    const approvedOn = pending ? null : addDays(appliedOn, 14 + Math.floor(r() * 30));
    const idCheck = pending ? (r() < .5 ? 'pending' : 'not_started') : r() < .93 ? 'verified' : 'pending';
    const standing = r() < .012 ? 'expelled' : r() < .02 ? 'resigned' : 'good';
    const payments: Payment[] = [];
    if (!pending) {
      for (let y = Math.max(joined, 2022); y <= YEAR; y++) {
        if (plan === 'life') { if (y === Math.max(joined, 2022)) payments.push({ year: y, paidOn: iso(y, 3, 12), amountCents: 100000, method: 'card', payer: 'self', ref: `LIFE-${1000 + i}` }); continue; }
        const miss = y === YEAR ? r() < .24 : r() < .1; if (miss) continue;
        const late = r() < .1; // paid after June 30 → renews, but no vote that year
        const m = late ? 7 + Math.floor(r() * 4) : 1 + Math.floor(r() * 6);
        const payer = r() < .9 ? 'self' : r() < .6 ? 'spouse' : r() < .5 ? 'parent' : 'other';
        payments.push({ year: y, paidOn: iso(y, m, 1 + Math.floor(r() * 28)), amountCents: PLANS[plan].cents, method: r() < .8 ? 'card' : r() < .6 ? 'check' : 'cash', payer, ref: `DUES-${y}-${pad(i, 4)}` });
      }
    }
    void r(); const n = demoCenterNo(zone, zip);            // M1: the home masjid follows the ZIP code (service areas)
    out.push({
      id: `HOU-${200000 + i * 37 + Math.floor(r() * 30)}`, first, last,
      email: `${first}.${last}${i % 7 === 0 ? i : ''}@example.com`.toLowerCase(),
      phone: `(${pick(AREA_CODES)}) 555-${pad(100 + Math.floor(r() * 99), 4)}`,
      dob, street: `${1000 + Math.floor(r() * 15000)} ${pick(STREETS)}`, city: area.city, zip, zone, center: `${ZONES[zone]} Islamic Center ${n}`,
      plan, joined, appliedOn, approvedOn, idCheck, standing, payments, notes: [], commitment: pick(['programs', 'contribution', 'volunteer'] as const),
      audit: [{ at: `${appliedOn}T10:00:00`, by: 'Website', action: 'Applied', detail: `${PLANS[plan].name} plan` },
        ...(approvedOn ? [{ at: `${approvedOn}T16:30:00`, by: 'Board', action: 'Approved', detail: 'Board meeting minutes' }] : [])],
    });
  }
  // a few household links + a center override + a near-border request
  for (let i = 0; i + 1 < out.length; i += 9) if (out[i].plan === 'family' && out[i + 1].plan === 'family') { out[i].spouseId = out[i + 1].id; out[i + 1].spouseId = out[i].id; out[i + 1].last = out[i].last; out[i + 1].zone = out[i].zone; out[i + 1].center = out[i].center; out[i + 1].zip = out[i].zip; out[i + 1].city = out[i].city; out[i + 1].street = out[i].street; }
  // applicants waiting for review applied recently (work queue A4 ages them from this date)
  out.filter((m) => !m.approvedOn).forEach((m, i) => { m.appliedOn = addDays('2026-10-13', -[1, 3, 9, 2, 6, 12, 4, 8, 5, 2, 15, 7][i % 12]); m.joined = 2026; m.audit[0] = { ...m.audit[0], at: `${m.appliedOn}T10:00:00` }; });
  out[3].centerOverride = { center: centersOf(out[3].zone === 'sw' ? 's' : 'sw')[0], reason: 'Lives 3.2 miles from the zone border – Board approved the request', lockedUntil: '2030-12-31' };
  // the two demo accounts used on the website
  Object.assign(out[0], { first: 'Aisha', last: 'Rahman', email: 'aisha@example.com', plan: 'family', standing: 'good', idCheck: 'verified' });
  Object.assign(out[1], { first: 'Imran', last: 'Siddiqui', email: 'member@example.com', plan: 'life', standing: 'good', idCheck: 'verified', approvedOn: '2012-04-18', joined: 2012,
    payments: [{ year: 2012, paidOn: '2012-04-18', amountCents: 100000, method: 'check', payer: 'self', ref: 'LIFE-0001' }] });
  // real member lists rarely share an email or phone – keep the demo honest so duplicate checks only flag true look-alikes
  const seenE = new Set<string>(), seenP = new Set<string>();
  out.forEach((m, i) => {
    if (seenE.has(m.email)) m.email = m.email.replace('@', `${i}@`);
    seenE.add(m.email);
    if (seenP.has(m.phone) && !(m.spouseId && out.find((x) => x.id === m.spouseId)?.phone === m.phone)) m.phone = `${m.phone.slice(0, 5)} 555-${pad(1000 + i, 4)}`;
    seenP.add(m.phone);
  });
  cache = out;
  return out;
}

/* ---------- derived ---------- */
export const sexOf = (first: string): 'm' | 'f' => (FIRST_F.includes(first) ? 'f' : 'm');
export const fullName = (m: Member) => `${m.first} ${m.last}`;
/** "Houston, TX 77081" from the record – the member's own state (never assumed). */
export const cityLine = (m: Pick<Member, 'city' | 'state' | 'zip'>) => [m.city, [m.state, m.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
export const initials = (m: Member) => (m.first[0] + m.last[0]).toUpperCase();
/** M1 demo: which of the zone's 4 masjids serves a ZIP (round-robin over the zone's ZIP list – same as mockOrgStructure). */
export function demoCenterNo(zone: ZoneId, zip: string) { const i = AREA[zone].flatMap((a) => a.zips).indexOf(zip.slice(0, 5)); return i < 0 ? 1 : (i % 4) + 1; }
/** Zone for a ZIP code we know (demo map); null when the ZIP is outside the service area or unknown. */
export function zoneForZip(zip: string): ZoneId | null {
  for (const z of Object.keys(AREA) as ZoneId[]) if (AREA[z].some((a) => a.zips.includes(zip.slice(0, 5)))) return z;
  return null;
}
/** Contact choices. Demo default (stable per member): almost all get email, about a third agreed to texts, a few left newsletters or appeals. */
export function prefsOf(m: Member): Prefs {
  if (m.prefs) return m.prefs;
  let h = 0; for (const ch of m.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const optOut: Prefs['optOut'] = [];
  if (h % 11 === 0) optOut.push('newsletter');
  if (h % 13 === 0) optOut.push('fundraising');
  return { email: h % 29 !== 0, sms: h % 3 === 0, optOut };
}
export const centerOf = (m: Member) => m.centerOverride?.center ?? m.center;
export const lastPayment = (m: Member) => m.payments.reduce<Payment | null>((a, p) => (!a || p.paidOn > a.paidOn ? p : a), null);
export function ageOn(dob: string, on: string) { const [y, mo, d] = dob.split('-').map(Number); const [Y, M, D] = on.split('-').map(Number); return Y - y - (M < mo || (M === mo && D < d) ? 1 : 0); }

export function statusOf(m: Member, year = YEAR): Status {
  if (m.archived) return 'archived';
  if (m.standing !== 'good') return m.standing;
  if (!m.approvedOn) return 'pending';
  if (m.plan === 'life') return m.termStatus && m.termStatus !== 'life' && !m.payments.length ? 'expired' : 'life';   // live: no lifetime term (e.g. suspended) = not current
  if (m.payments.some((p) => p.year === year)) return 'active';
  // live data: a membership term (e.g. imported from Wild Apricot) counts too – paid through today (this year) or the year's end
  if (m.paidThrough) return m.paidThrough >= (year === YEAR ? orgToday() : `${year}-12-31`) ? 'active' : 'expired';
  return 'expired';
}

/* ---------- renewal engine (shared contract lib/content/renewal.ts) ---------- */
/** The published plan behind a member's plan ID (admin › Membership rules). Unknown IDs fall back to a non-voting yearly plan. */
/** The organization's published plans and rules (live admin: loaded with the members). Screens that do not pass plans
 *  or rules use these – never the demo set once the organization's are known. The API always passes its own. */
let orgSettings: MembershipSettings | null = null;
export const setOrgMembershipSettings = (s: MembershipSettings | null) => { orgSettings = s; };
const curPlans = () => orgSettings?.plans ?? mockMembershipSettings.plans;
const curRules = () => orgSettings?.rules ?? mockMembershipSettings.rules;
const curLifecycle = () => orgSettings?.lifecycle ?? mockMembershipSettings.lifecycle ?? DEFAULT_LIFECYCLE;
export function planDef(m: Pick<Member, 'plan'>, plans: Plan[] = curPlans()): Plan {
  return plans.find((p) => p.id === m.plan) ?? { ...mockMembershipSettings.plans[0], id: m.plan, name: PLANS[m.plan]?.name ?? m.plan, votingEligible: false };
}
/** Paid-through date from the latest dues year on record (null for Life or never paid). */
export function paidThroughOf(m: Member, plans?: Plan[]): string | null {
  const plan = planDef(m, plans);
  if (plan.term === 'lifetime' || !m.payments.length) return null;
  return coverageOfYear(plan, Math.max(...m.payments.map((p) => p.year))).through;
}
/** Renewal status on a day (Active · Renewal due · Grace · Overdue · Lapsed …) from the plan's renewal date and the lifecycle rules. */
export function renewalOf(m: Member, today: string, plans?: Plan[], lc: Lifecycle = curLifecycle()): Standing {
  return standingOn(planDef(m, plans), lc, paidThroughOf(m, plans), today);
}

export type Check = { id: string; label: string; ok: boolean; reason: string; fix?: 'approve' | 'payment' | 'center' };
/** A1 – what the approval rule still needs before this application may be approved (empty = may approve). */
/** year = the membership year being sold (the organization's settings – e.g. 2027 once renewals for it are open) */
export function approvalBlockers(m: Member, rules: MembershipRules = curRules(), year = orgSettings?.year ?? YEAR, plans?: Plan[]): string[] {
  const out: string[] = [];
  const plan = planDef(m, plans);
  if (rules.approval.requireFullPayment) {
    const need = plan.term === 'lifetime' ? plan.priceCents : quoteCents(plan);
    const paid = m.payments.filter((p) => plan.term === 'lifetime' || p.year === year).reduce((a, p) => a + p.amountCents, 0);
    if (need > 0 && paid < need) out.push(`Dues not paid in full: ${fmtUsd(paid)} of ${fmtUsd(need)} for ${plan.term === 'lifetime' ? plan.name : year}.`);
  }
  if (rules.approval.requireIdCheck && m.idCheck !== 'verified') out.push('Photo ID not verified yet.');
  return out;
}
const quoteCents = (p: Plan) => (p.term === 'recurring' ? 0 : p.priceCents);
const fmtUsd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: c % 100 ? 2 : 0 });
export function eligibility(m: Member, year = YEAR, plans?: Plan[], rules: MembershipRules = curRules()): { eligible: boolean; checks: Check[]; summary: string } {
  const rd = recordDate(year);
  const age = ageOn(m.dob, rd);
  const plan = planDef(m, plans);
  const pay = m.payments.find((p) => p.year === year);
  const life = plan.term === 'lifetime' && m.payments.some((p) => p.amountCents >= plan.priceCents);
  // P2 – "monthly contributors are members": the year's contributions must reach the total by the cut-off (rule in Membership rules)
  const q = rules?.qualifyingGifts; const byGifts = q?.enabled && plan.id === q.planId ? qualifiesByGifts(q, m.payments.map((p) => ({ on: p.paidOn, cents: p.amountCents, recurring: true })), year) : null;
  // Bylaws: own dues must COVER the record date and be paid ON OR BEFORE it (works for calendar-year and fixed-date renewals)
  const dues = duesCoverVote(plan, pay ? { paidThrough: coverageOfYear(plan, pay.year).through, paidOn: pay.paidOn } : null, rd);
  const cls = memberClass(rules, plan.memberClass); const canVote = plan.votingEligible && cls.canVote;
  const checks: Check[] = [
    { id: 'approved', label: 'Application approved by the Board', ok: !!m.approvedOn, reason: m.approvedOn ? `Approved ${fmtDate(m.approvedOn)}` : 'Waiting for Board approval', fix: m.approvedOn ? undefined : 'approve' },
    { id: 'muslim', label: 'Voting member class', ok: canVote, reason: !cls.canVote ? noVoteMessage(rules, plan.memberClass) : canVote ? cls.label : `The ${plan.name} plan does not include a vote` },
    { id: 'age', label: `18 or older on ${fmtDate(rd)}`, ok: age >= 18, reason: `Age ${age} on the record date` },
    life
      ? { id: 'dues', label: `Dues for ${year}`, ok: true, reason: 'Life member – no yearly dues' }
      : byGifts
      ? { id: 'dues', label: `${q!.label || 'Monthly contributions'} for ${year}: ${fmtUsd(q!.totalCents)} by ${fmtDate(byGifts.by)}`, ok: byGifts.ok, reason: byGifts.ok ? `${fmtUsd(byGifts.total)} given by ${fmtDate(byGifts.by)}` : `${fmtUsd(byGifts.total)} given – ${fmtUsd(byGifts.needed)} short of ${fmtUsd(q!.totalCents)} by ${fmtDate(byGifts.by)}`, fix: byGifts.ok ? undefined : 'payment' }
      : { id: 'dues', label: `Own dues for ${year} paid by ${fmtDate(rd)}`, ok: !!pay && (dues.ok || !canVote) && pay.paidOn <= rd && pay.payer !== 'other',
          reason: !pay ? `No ${year} dues on record` : pay.paidOn > rd ? `Paid ${fmtDate(pay.paidOn)} – after the record date (renews membership, no vote this year)` : canVote && !dues.ok ? dues.reason : pay.payer === 'other' ? 'Paid by someone who is not a relative – the Bylaws need own dues or a relative by blood or marriage' : `Paid ${fmtDate(pay.paidOn)}${pay.payer === 'self' ? '' : ` by ${pay.payer}`}`,
          fix: !pay ? 'payment' : undefined },
    { id: 'residency', label: 'Lives in a zone and has an Islamic Center', ok: !!centerOf(m), reason: `${ZONES[m.zone]} zone · ${centerOf(m)}${m.centerOverride ? ' (approved change)' : ''}`, fix: 'center' },
    { id: 'standing', label: 'In good standing', ok: m.standing === 'good' && !m.archived, reason: m.archived ? `Archived ${fmtDate(m.archived.on)} – restore the record first` : m.standing === 'good' ? 'No resignation or expulsion' : m.standing === 'resigned' ? 'Resigned – must apply again' : 'Expelled (ethics) – must apply again' },
  ];
  const eligible = checks.every((c) => c.ok);
  const first = checks.find((c) => !c.ok);
  return { eligible, checks, summary: eligible ? `Can vote in ${year}` : first ? first.reason : '' };
}

/* ---------- Houston formats ---------- */
export const fmtDate = (d: string) => { const [y, m, day] = d.slice(0, 10).split('-').map(Number); return `${pad(m)}/${pad(day)}/${y}`; };
export const fmtMoney = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: c % 100 ? 2 : 0 });
export const digits = (s: string) => s.replace(/\D/g, '');

/* ---------- demo edits (this browser only) ---------- */
const EDITS = 'isgh-admin-member-edits';
type Edits = Record<string, Partial<Member>>;
const readEdits = (): Edits => { try { return JSON.parse(localStorage.getItem(EDITS) || '{}'); } catch { return {}; } };
export const MEMBERS_EVENT = 'isgh:members';
const IMPORTS = 'isgh-admin-member-imports';
const readImports = (): Member[] => { try { return JSON.parse(localStorage.getItem(IMPORTS) || '[]'); } catch { return []; } };
export function membersWithEdits(): Member[] {
  if (LIVE) { if (typeof window !== 'undefined' && !live) void loadLiveMembers(); return live ?? []; }
  const e = typeof window === 'undefined' ? {} : readEdits();
  const all = [...demoMembers(), ...(typeof window === 'undefined' ? [] : readImports())];
  return all.map((m) => (e[m.id] ? { ...m, ...e[m.id] } : m));
}
/** Add imported members (demo: this browser only; live: POST /admin/members for each – the server checks duplicates again). */
export function addImportedMembers(list: Member[]) {
  if (LIVE) { void importLive(list); return; }
  try { localStorage.setItem(IMPORTS, JSON.stringify([...readImports(), ...list])); } catch { /* storage full */ }
  window.dispatchEvent(new Event(MEMBERS_EVENT));
}

/* ---------- live mode: the members in this admin's scope from the API; every change goes to its endpoint ---------- */
/** Messages for the admin about live saves (AdminShell shows them). */
export const NOTICE_EVENT = 'ms:notice';
export const notice = (text: string, tone: 'ok' | 'error' = 'error') => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NOTICE_EVENT, { detail: { text, tone } })); };
let live: Member[] | null = null; let liveLoading: Promise<void> | null = null;
export function loadLiveMembers(force = false): Promise<void> {
  if (!force && live) return Promise.resolve();
  if (!force && liveLoading) return liveLoading;
  const settings = fetch('/api/store/membership-settings', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).then((j) => { const p = MembershipSettingsSchema.safeParse(j?.data); if (p.success) setOrgMembershipSettings(p.data); }).catch(() => {});
  liveLoading = Promise.all([be<{ members: Member[] }>('GET', 'admin/members?view=any&limit=all'), settings]).then(([r]) => {
    liveLoading = null;
    if (r.ok) live = r.data.members; else if (r.status !== 401) notice(`Members could not be loaded: ${r.message}`);
    window.dispatchEvent(new Event(MEMBERS_EVENT));
  });
  return liveLoading;
}
export async function refreshLive(id: string) {
  const r = await be<{ member: Member }>('GET', `admin/members/${encodeURIComponent(id)}`);
  if (r.ok && live) { const i = live.findIndex((x) => x.id === id); live = i >= 0 ? live.map((x, j) => (j === i ? r.data.member : x)) : [...live, r.data.member]; }
  window.dispatchEvent(new Event(MEMBERS_EVENT));
}
const PATCH_KEYS = ['first', 'last', 'email', 'phone', 'dob', 'street', 'city', 'zip', 'plan', 'commitment', 'standing'] as const;
const samePay = (p: Payment, q: Payment) => p.year === q.year && p.paidOn.slice(0, 10) === q.paidOn.slice(0, 10) && p.amountCents === q.amountCents;
/** What changed between the server's copy and the edited one → the API calls that make the same change. */
export function liveSteps(before: Member, m: Member, action: string, detail: string): [string, string, unknown][] {
  const id = encodeURIComponent(m.id); const steps: [string, string, unknown][] = [];
  const patch: Record<string, unknown> = {};
  for (const k of PATCH_KEYS) if (m[k] !== before[k]) patch[k] = m[k];
  if (JSON.stringify(m.extra ?? {}) !== JSON.stringify(before.extra ?? {})) patch.extra = m.extra ?? {};
  if (Object.keys(patch).length) steps.push(['PATCH', `admin/members/${id}`, patch]);
  if (m.centerOverride && m.centerOverride.center !== (before.centerOverride?.center ?? before.center)) steps.push(['POST', `admin/members/${id}/center`, { center: m.centerOverride.center, reason: m.centerOverride.reason || detail || action }]);
  for (const p of m.payments.filter((p) => !before.payments.some((q) => samePay(p, q)))) steps.push(['POST', `admin/members/${id}/payments`, { year: p.year, amountCents: p.amountCents, method: p.method, paidOn: p.paidOn.slice(0, 10), ref: p.ref, payer: p.payer }]);
  if (m.idCheck !== before.idCheck) steps.push(['POST', `admin/members/${id}/id-check`, m.idCheck === 'verified' ? { status: 'verified' } : { status: 'rejected', reason: detail || action }]);
  if (!before.approvedOn && m.approvedOn) steps.push(['POST', `admin/members/${id}/approve`, { ref: detail || action }]);
  for (const n of m.notes.slice(before.notes.length)) steps.push(['POST', `admin/members/${id}/notes`, { text: n.text }]);
  for (const other of (m.notDuplicateOf ?? []).filter((x) => !(before.notDuplicateOf ?? []).includes(x))) steps.push(['POST', 'admin/duplicates/decide', { a: m.id, b: other, decision: 'not-duplicate' }]);
  if (!before.archived && m.archived) steps.push(['POST', `admin/members/${id}/archive`, { reason: m.archived.reason || detail || action }]);
  if (before.archived && !m.archived) steps.push(['POST', `admin/members/${id}/restore`, { reason: detail || action }]);
  if (!steps.length) steps.push(['POST', `admin/members/${id}/activity`, { action, detail }]);   // nothing on the record changed: keep the step in its history
  return steps;
}
async function saveLive(m: Member, action: string, detail: string) {
  const before = live?.find((x) => x.id === m.id);
  if (!before) { notice('This member is not loaded yet – try again in a moment.'); return; }
  for (const [method, path, body] of liveSteps(before, m, action, detail)) {
    const r = await be(method, path, body);
    if (!r.ok) { notice(`${action}: ${r.message}`); break; }
  }
  await refreshLive(m.id);
}
/** Live: add members one by one – gently. Nothing given is dropped: a value the API cannot take as it is (a phone
 *  that is not 10 digits, a placeholder birth date) is kept as a note instead; notes and past payments follow the
 *  record. Someone who looks like a person already on file is held back with the reason, never added twice silently. */
async function importLive(list: Member[]) {
  let added = 0; const problems: string[] = []; const held: string[] = [];
  const digits10 = (p: string) => (p ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  for (const m of list) {
    const phone = digits10(m.phone); const dob = m.dob && !m.dob.startsWith('1900') ? m.dob.slice(0, 10) : '';
    const kept: string[] = [];
    if (m.phone && phone.length !== 10) kept.push(`Phone as given: ${m.phone}`);
    const r = await be<{ id: string }>('POST', 'admin/members', { first: m.first, last: m.last, email: m.email, phone: phone.length === 10 ? phone : '', dob, street: m.street, city: m.city, state: m.state || undefined, zip: m.zip, plan: m.plan, commitment: m.commitment, approved: !!m.approvedOn, extra: m.extra ?? {} });
    if (!r.ok) {
      const dup = r.status === 409 && Array.isArray(r.data.detail) ? (r.data.detail as { id: string; reasons?: string[] }[]) : [];
      if (dup.length) held.push(`${m.first} ${m.last} looks like ${dup.map((x) => `${x.id} (${(x.reasons ?? []).join(', ').toLowerCase()})`).join(' or ')}`);
      else problems.push(`${m.first} ${m.last}: ${r.message}`);
      continue;
    }
    added++;
    const id = r.data.id;
    for (const n of [...kept, ...(m.notes ?? []).map((x) => x.text)].filter((t) => t && t.trim())) { const nr = await be('POST', `admin/members/${encodeURIComponent(id)}/notes`, { text: n.slice(0, 4000) }); if (!nr.ok) problems.push(`${m.first} ${m.last}: a note was not saved (${nr.message})`); }
    for (const p of m.payments ?? []) {
      const pr = await be('POST', `admin/members/${encodeURIComponent(id)}/payments`, { year: p.year, amountCents: p.amountCents, method: p.method, paidOn: p.paidOn.slice(0, 10), ref: p.ref || `IMPORT-${id}-${p.year}`, payer: p.payer });
      if (!pr.ok) problems.push(`${m.first} ${m.last}: ${p.year} payment not saved (${pr.message})`);
    }
  }
  await loadLiveMembers(true);
  const parts = [`${added} member${added === 1 ? '' : 's'} added.`, held.length ? `Held back as possible duplicates (check them in Members, then add by hand if they are different people): ${held.slice(0, 3).join(' · ')}${held.length > 3 ? ` (and ${held.length - 3} more)` : ''}.` : '', problems.length ? `Needs a look – ${problems.slice(0, 3).join(' · ')}${problems.length > 3 ? ` (and ${problems.length - 3} more)` : ''}` : ''];
  notice(parts.filter(Boolean).join(' '), problems.length || held.length ? 'error' : 'ok');
}
/** Next free member ID for imports (HOU-9xxxxx so they never clash with existing numbers). */
export function nextImportId(existing: { id: string }[], n = 0) {
  const max = existing.filter((m) => /^HOU-9\d{5}$/.test(m.id)).reduce((a, m) => Math.max(a, Number(m.id.slice(4))), 900000);
  return `HOU-${max + 1 + n}`;
}
export function saveMember(m: Member, action: string, detail: string) {
  if (LIVE) { void saveLive(m, action, detail); return; }
  const e = readEdits();
  const audit = [...m.audit, { at: new Date().toISOString(), by: currentAdminName(), action, detail }];
  const { id, ...rest } = { ...m, audit };
  e[id] = rest;
  try { localStorage.setItem(EDITS, JSON.stringify(e)); } catch { /* storage full */ }
  window.dispatchEvent(new Event(MEMBERS_EVENT));
}
/** Undo support for work queues: take the saved edit of one member, and put it back later. */
export function snapshotMemberEdit(id: string): Partial<Member> | null { return LIVE ? null : readEdits()[id] ?? null; }
export function restoreMemberEdit(id: string, snap: Partial<Member> | null) {
  if (LIVE) { notice('Saved decisions cannot be undone here – change the record instead.'); return; }
  const e = readEdits(); if (snap) e[id] = snap; else delete e[id];
  try { localStorage.setItem(EDITS, JSON.stringify(e)); } catch { /* */ }
  window.dispatchEvent(new Event(MEMBERS_EVENT));
}
export function resetMemberEdits() { if (LIVE) return; try { localStorage.removeItem(EDITS); localStorage.removeItem(IMPORTS); } catch { /* */ } window.dispatchEvent(new Event(MEMBERS_EVENT)); }

/* ---------- CSV export (current view only) ---------- */
/**
 * Spreadsheet-safe CSV (cells that would run as formulas are neutralized). Extra profile fields are added as columns;
 * admin-only fields only when `adminOnly` is asked for (they can hold ID numbers). File fields are never exported.
 */
export function toCsv(rows: Member[], fields: ProfileField[] = [], adminOnly = false) {
  const extra = (adminOnly ? fields : fieldsFor(fields, 'member')).filter((f) => f.type !== 'file');
  const head = ['Member ID', 'First name', 'Last name', 'Email', 'Phone', 'Plan', 'Zone', 'Islamic Center', 'Status', `Voting ${YEAR}`, 'Last paid', ...extra.map((f) => f.label)];
  const lines = rows.map((m) => { const lp = lastPayment(m); return [m.id, m.first, m.last, m.email, m.phone, PLANS[m.plan].name, ZONES[m.zone], centerOf(m), STATUS_LABEL[statusOf(m)], eligibility(m).eligible ? 'Yes' : 'No', lp ? fmtDate(lp.paidOn) : '', ...extra.map((f) => (m.extra?.[f.id] === undefined ? '' : showValue(f, m.extra[f.id])))].map(csvCell).join(','); });
  return [head.map(csvCell).join(','), ...lines].join('\r\n');
}
