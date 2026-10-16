/**
 * F5 Elected officials – who holds each ISGH office, for how long, and which seats are empty. Rules from the
 * Constitution (Art. V) and Bylaws (Art. V–VII, as of 28 September 2025):
 * - Majlis-e-Shura (Board): 4 officers at large (President, Vice President, General Secretary, Treasurer) + 5 Zonal
 *   Directors. Each Islamic Center: an Associate Director, a Council of Area Representatives (1 per 40 eligible voters
 *   in a ZIP code, max 2 per ZIP, 4 from a ZIP with 160+, small ZIPs grouped, at least 4 per center, +1 youth and
 *   +1 sister at large when more than 10) and an Administrative Body of 5 Secretaries (nominated by the Associate
 *   Director, confirmed by the Council).
 * - Two-year terms; elections on the second Sunday of December; the oath on the first Sunday of January (not the
 *   New Year weekend or Eid), or the second Sunday after the election, whichever is later. Seats alternate even/odd years.
 * - One elected office per person. Vacancies: the Board appoints (Board seats, Associate Directors), the Council
 *   appoints (Area Representatives), the Vice President becomes President. Appointees attend orientation within a week.
 * DEMO (no API). Live: GET/PUT /admin/officials, GET /public/leadership. Synced to the admin by sync-contracts.mjs.
 */
import { z } from 'zod';

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-01-03.');
const ISO_OR_EMPTY = z.union([ISO, z.literal('')]);
export const OFFICERS = { president: 'President', 'vice-president': 'Vice President', 'general-secretary': 'General Secretary', treasurer: 'Treasurer' } as const;
export const SECRETARIES = { administrative: 'Administrative Secretary', finance: 'Finance Secretary', education: 'Education Secretary', membership: 'Membership Secretary', youth: 'Youth Affairs Secretary' } as const;
export const KINDS = { officer: 'Board officer', 'zonal-director': 'Zonal Director', 'associate-director': 'Associate Director', 'area-rep': 'Area Representative', secretary: 'Secretary' } as const;
export const AT_LARGE = { general: 'At large', youth: 'Youth at large (18–24)', female: 'Sister at large' } as const;
export const HOW = { elected: 'Elected', appointed: 'Appointed to a vacancy', confirmed: 'Confirmed by the Council', acting: 'Acting (Board, temporary)' } as const;
export const VACANCY_REASONS = {
  resigned: 'Resigned', died: 'Passed away', removed: 'Removed from office', 'moved-away': 'No longer lives in the area',
  'lost-membership': 'Lost membership rights', employee: 'Became an ISGH employee', 'no-oath': 'Did not take the oath',
  'no-orientation': 'Did not attend orientation', illness: 'Long-term illness', other: 'Other',
} as const;
export type Kind = keyof typeof KINDS;

export const HolderSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/),
  kind: z.enum(Object.keys(KINDS) as [Kind, ...Kind[]]),
  office: z.string().max(40),                  // officer or secretary key, '' otherwise
  zone: z.string().max(40),                    // zonal director
  center: z.string().max(80),                  // associate director, area rep, secretary
  zips: z.array(z.string().regex(/^\d{5}$/, 'ZIP codes have 5 digits.')).max(20), // area rep: the ZIP (or grouped ZIPs) they represent
  atLarge: z.enum(['', 'general', 'youth', 'female']),
  name: z.string().trim().max(80),
  memberId: z.union([z.literal(''), z.string().regex(/^HOU-\d{6}$/, 'Member IDs look like HOU-204781.')]),
  publicEmail: z.union([z.literal(''), z.string().email('Check the email address.')]),   // office email shown on the website
  how: z.enum(['elected', 'appointed', 'confirmed', 'acting']),
  termStart: ISO_OR_EMPTY,
  termEnd: ISO_OR_EMPTY,
  oathOn: ISO_OR_EMPTY,
  orientationOn: ISO_OR_EMPTY,
  status: z.enum(['serving', 'vacant', 'ended']),
  vacancy: z.object({ reason: z.union([z.literal(''), z.enum(Object.keys(VACANCY_REASONS) as [keyof typeof VACANCY_REASONS, ...(keyof typeof VACANCY_REASONS)[]])]), on: ISO_OR_EMPTY }),
  boardTerms: z.number().int().min(0).max(20),  // full Board terms served before this one (term limits)
  showOnWebsite: z.boolean(),
});
export const OfficialsSchema = z.object({
  holders: z.array(HolderSchema).max(1500),
  eidDates: z.array(ISO).max(60),               // first day of each Eid (oath and election dates skip the 3 Eid days)
  website: z.object({ enabled: z.boolean(), showEmail: z.boolean(), findByZip: z.boolean() }),
}).superRefine((d, ctx) => {
  const ids = new Set<string>();
  const elected = new Map<string, number>();
  d.holders.forEach((h, i) => {
    const at = (f: string, message: string) => ctx.addIssue({ code: 'custom', path: ['holders', i, f], message });
    if (ids.has(h.id)) at('id', `Two entries use “${h.id}”.`);
    ids.add(h.id);
    if (h.kind === 'officer' && !(h.office in OFFICERS)) at('office', 'Pick the office.');
    if (h.kind === 'secretary' && !(h.office in SECRETARIES)) at('office', 'Pick the secretary post.');
    if (h.kind === 'zonal-director' && !h.zone) at('zone', 'Pick the zone.');
    if (['associate-director', 'area-rep', 'secretary'].includes(h.kind) && !h.center) at('center', 'Pick the Islamic Center.');
    if (h.kind === 'area-rep' && !h.atLarge && !h.zips.length) at('zips', 'Enter the ZIP code(s) this seat represents, or make it an at-large seat.');
    if (h.status === 'serving' && h.name.trim().length < 2) at('name', 'Enter the name of the person serving.');
    if (h.termStart && h.termEnd && h.termEnd <= h.termStart) at('termEnd', 'The term must end after it starts.');
    if (h.status === 'vacant' && !h.vacancy.reason) at('vacancy', 'Say why the seat is empty.');
    if (h.status === 'serving' && h.kind !== 'secretary' && h.memberId) {
      const prev = elected.get(h.memberId);
      if (prev !== undefined) at('memberId', `${h.name || h.memberId} already holds an elected office (${seatLabel(d.holders[prev])}). The Bylaws allow one at a time.`);
      else elected.set(h.memberId, i);
    }
  });
});
export type Holder = z.infer<typeof HolderSchema>;
export type Officials = z.infer<typeof OfficialsSchema>;

/* ---------------- dates ---------------- */
const D = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(D(s).getTime() + n * 86_400_000));
export const fmt = (s: string) => (s ? `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}` : '');
const sundayOnOrAfter = (s: string) => { const d = D(s); return addDays(s, (7 - d.getUTCDay()) % 7); };
const inEid = (s: string, eid: string[]) => eid.some((e) => s >= e && s <= addDays(e, 2));
/** Election day: second Sunday of December (the Election Commission may move it for Eid). */
export const electionDay = (year: number) => addDays(sundayOnOrAfter(`${year}-12-01`), 7);
/** Oath and start of term after the election of `year` (Bylaws Art. VII Sec. 6). */
export function oathDay(year: number, eid: string[] = [], election = electionDay(year)): string {
  let s = sundayOnOrAfter(`${year + 1}-01-01`);
  if (s <= `${year + 1}-01-03`) s = addDays(s, 7);                         // New Year holiday weekend
  while (inEid(s, eid)) s = addDays(s, 7);
  const second = addDays(sundayOnOrAfter(addDays(election, 1)), 7);        // second Sunday after the election
  return second > s ? second : s;
}
/** A two-year term won in the election of `year`. */
export const termFor = (year: number, eid: string[] = []) => ({ start: oathDay(year, eid), end: oathDay(year + 2, eid) });

const EVEN_ZONES = ['n', 'sw'];
/** Which years this seat is on the ballot (Bylaws Art. VII Sec. 1 B–C). */
export function ballotParity(h: Pick<Holder, 'kind' | 'office' | 'zone' | 'center'>, zoneOfCenter: (c: string) => string): 'even' | 'odd' | null {
  if (h.kind === 'officer') return h.office === 'president' || h.office === 'general-secretary' ? 'even' : 'odd';
  if (h.kind === 'zonal-director') return EVEN_ZONES.includes(h.zone) ? 'even' : 'odd';
  if (h.kind === 'associate-director') return EVEN_ZONES.includes(zoneOfCenter(h.center)) ? 'odd' : 'even';
  if (h.kind === 'area-rep') return EVEN_ZONES.includes(zoneOfCenter(h.center)) ? 'even' : 'odd';
  return null;                                                             // secretaries are appointed
}
/** The next December election in which this seat is chosen. */
export function nextElection(h: Pick<Holder, 'kind' | 'office' | 'zone' | 'center'>, zoneOfCenter: (c: string) => string, today: string): string | null {
  const p = ballotParity(h, zoneOfCenter); if (!p) return null;
  let y = Number(today.slice(0, 4)); if (electionDay(y) < today) y++;
  while ((y % 2 === 0) !== (p === 'even')) y++;
  return electionDay(y);
}

/* ---------------- Area Representative seats (Bylaws Art. V Sec. 2) ---------------- */
export type RepSeat = { label: string; zips: string[]; voters: number; seats: number; atLarge?: keyof typeof AT_LARGE };
const perZip = (n: number) => (n >= 160 ? 4 : Math.min(2, Math.floor(n / 40)));
/** Seats for one Islamic Center from its eligible voters per ZIP code. */
export function areaRepSeats(votersByZip: Record<string, number>): { rows: RepSeat[]; total: number } {
  const zips = Object.entries(votersByZip).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b));
  const big = zips.filter(([, n]) => n >= 40).map(([z, n]) => ({ zips: [z], voters: n }));
  const small = zips.filter(([, n]) => n < 40);
  const groups = [...big];
  if (small.length) {
    const sum = small.reduce((a, [, n]) => a + n, 0);
    if (sum >= 40 || !big.length) groups.push({ zips: small.map(([z]) => z), voters: sum });
    else { const host = big.reduce((m, g) => (g.voters < m.voters ? g : m)); host.zips.push(...small.map(([z]) => z)); host.voters += sum; } // join the smallest ZIP above 40
  }
  const rows: RepSeat[] = groups.map((g) => ({ label: g.zips.length > 1 ? `ZIPs ${g.zips.join(', ')}` : `ZIP ${g.zips[0]}`, zips: g.zips.sort(), voters: g.voters, seats: perZip(g.voters) }));
  let total = rows.reduce((a, r) => a + r.seats, 0);
  if (total < 4) { rows.push({ label: 'At large (to reach 4)', zips: [], voters: 0, seats: 4 - total, atLarge: 'general' }); total = 4; }
  if (total > 10) { rows.push({ label: AT_LARGE.youth, zips: [], voters: 0, seats: 1, atLarge: 'youth' }, { label: AT_LARGE.female, zips: [], voters: 0, seats: 1, atLarge: 'female' }); total += 2; }
  return { rows, total };
}

/* ---------------- labels, vacancies ---------------- */
export function seatLabel(h: Pick<Holder, 'kind' | 'office' | 'zone' | 'center' | 'zips' | 'atLarge'>, zoneName: (id: string) => string = (z) => z): string {
  if (h.kind === 'officer') return OFFICERS[h.office as keyof typeof OFFICERS] ?? 'Officer';
  if (h.kind === 'zonal-director') return `Zonal Director, ${zoneName(h.zone)}`;
  if (h.kind === 'associate-director') return `Associate Director, ${h.center}`;
  if (h.kind === 'secretary') return `${SECRETARIES[h.office as keyof typeof SECRETARIES] ?? 'Secretary'}, ${h.center}`;
  return `Area Representative, ${h.center} – ${h.atLarge ? AT_LARGE[h.atLarge] : h.zips.length > 1 ? `ZIPs ${h.zips.join(', ')}` : `ZIP ${h.zips[0] ?? ''}`}`;
}
/** Who fills an empty seat (Bylaws Art. VII Sec. 7, Art. VI Sec. 1). */
export function vacancyRule(h: Pick<Holder, 'kind' | 'office' | 'termStart'>, today: string): string {
  const firstYear = !!h.termStart && today < addDays(h.termStart, 365);
  if (h.kind === 'officer' && h.office === 'president') return 'The Vice President becomes President.';
  if (h.kind === 'officer' || h.kind === 'zonal-director') return `The Board appoints an eligible member by majority vote (at least five) for the rest of the year.${firstYear ? ' The seat goes on the ballot in December.' : ''}`;
  if (h.kind === 'associate-director') return `The Board appoints an eligible member for the rest of the year.${firstYear ? ' In December the seat is elected for a one-year term.' : ''}`;
  if (h.kind === 'area-rep') return 'The Associate Director nominates; the Area Representatives of the Council appoint by majority for the rest of the year.';
  return 'The Associate Director nominates and the Council confirms. After 60 days the Board may appoint an acting Secretary.';
}

/* ---------------- checks ---------------- */
/** What the admin knows about a person from the member records. */
export type PersonFacts = { zip: string; zone: string; center: string; eligibleVoter: boolean; memberSinceYear: number };
export type Warn = { level: 'stop' | 'look'; holder?: string; text: string };

export function officialsWarnings(
  d: Officials, map: { zones: { id: string; name: string; director: { name: string } }[]; centers: { name: string; zone: string; active: boolean }[] },
  facts: (memberId: string) => PersonFacts | null, voters: Record<string, Record<string, number>>, today: string,
): Warn[] {
  const out: Warn[] = [];
  const zn = (id: string) => map.zones.find((z) => z.id === id)?.name ?? id;
  const serving = d.holders.filter((h) => h.status === 'serving');
  const label = (h: Holder) => seatLabel(h, zn);
  // empty seats
  (Object.keys(OFFICERS) as (keyof typeof OFFICERS)[]).forEach((o) => { if (!serving.some((h) => h.kind === 'officer' && h.office === o)) out.push({ level: 'stop', text: `${OFFICERS[o]}: nobody is serving.` }); });
  map.zones.forEach((z) => { if (!serving.some((h) => h.kind === 'zonal-director' && h.zone === z.id)) out.push({ level: 'stop', text: `Zonal Director, ${z.name}: nobody is serving.` }); });
  map.centers.filter((c) => c.active).forEach((c) => {
    const gaps: string[] = [];
    const ad = serving.find((h) => h.kind === 'associate-director' && h.center === c.name);
    if (!ad) gaps.push('no Associate Director');
    const need = areaRepSeats(voters[c.name] ?? {}).total; const have = serving.filter((h) => h.kind === 'area-rep' && h.center === c.name).length;
    if (have < need) gaps.push(`${have} of ${need} Area Representatives`);
    const missing = (Object.keys(SECRETARIES) as (keyof typeof SECRETARIES)[]).filter((s) => !serving.some((h) => h.kind === 'secretary' && h.center === c.name && h.office === s));
    if (missing.length && ad?.termStart && today > addDays(ad.termStart, 60)) gaps.push(`${missing.length} Secretary post${missing.length === 1 ? '' : 's'} not confirmed after 60 days (the Board may appoint acting Secretaries)`);
    if (gaps.length) out.push({ level: ad ? 'look' : 'stop', text: `${c.name}: ${gaps.join(', ')}.` });
  });
  // the people serving
  for (const h of serving) {
    if (h.termEnd && h.termEnd < today && h.kind !== 'secretary') out.push({ level: 'stop', holder: h.id, text: `${label(h)}: the term ended ${fmt(h.termEnd)}.` });
    if (h.kind !== 'secretary' && h.termStart && h.termStart <= today && !h.oathOn) out.push({ level: 'look', holder: h.id, text: `${label(h)}: no oath of office recorded.` });
    if (h.how === 'appointed' && h.termStart && !h.orientationOn && today > addDays(h.termStart, 7)) out.push({ level: 'stop', holder: h.id, text: `${label(h)}: appointed without ISGH orientation within a week – the seat must be declared vacant.` });
    if (!h.memberId) { if (h.kind !== 'secretary') out.push({ level: 'look', holder: h.id, text: `${label(h)}: link the member record to check eligibility.` }); continue; }
    const f = facts(h.memberId);
    if (!f) { out.push({ level: 'look', holder: h.id, text: `${label(h)}: member ${h.memberId} not found.` }); continue; }
    if (h.kind !== 'secretary' && !f.eligibleVoter) out.push({ level: 'stop', holder: h.id, text: `${label(h)}: ${h.name} is not an eligible voting member – only eligible voters may hold office.` });
    if (h.kind === 'zonal-director' && f.zone !== h.zone) out.push({ level: 'stop', holder: h.id, text: `${label(h)}: ${h.name} does not live in the zone.` });
    if (h.kind === 'associate-director' && f.center !== h.center) out.push({ level: 'stop', holder: h.id, text: `${label(h)}: ${h.name} does not live in a ZIP code of this center.` });
    if (h.kind === 'area-rep' && !h.atLarge && !h.zips.includes(f.zip)) out.push({ level: 'stop', holder: h.id, text: `${label(h)}: ${h.name} lives in ${f.zip}, not in the ZIP code(s) of this seat.` });
    if (h.kind === 'area-rep' && h.atLarge && f.center !== h.center) out.push({ level: 'stop', holder: h.id, text: `${label(h)}: ${h.name} is not a member of this center.` });
    const years = Number((h.termStart || today).slice(0, 4)) - f.memberSinceYear;
    if ((h.kind === 'officer' || h.kind === 'zonal-director') && years < 1) out.push({ level: 'stop', holder: h.id, text: `${label(h)}: Board members need one year of membership.` });
    if (h.kind === 'officer' && ['president', 'vice-president'].includes(h.office) && years < 2) out.push({ level: 'stop', holder: h.id, text: `${label(h)}: the President and Vice President need two years of membership.` });
  }
  for (const h of serving.filter((x) => (x.kind === 'officer' || x.kind === 'zonal-director') && x.boardTerms >= 1)) {
    if (h.boardTerms + 1 >= 5) out.push({ level: 'look', holder: h.id, text: `${label(h)}: ${h.name} reaches five Board terms – no further Board elections.` });
    else out.push({ level: 'look', holder: h.id, text: `${label(h)}: second consecutive term – ${h.name} cannot run for this seat again next time.` });
  }
  // zones map and officials agree on the Zonal Director
  map.zones.forEach((z) => { const h = serving.find((x) => x.kind === 'zonal-director' && x.zone === z.id); if (h && z.director.name && z.director.name !== h.name) out.push({ level: 'look', holder: h.id, text: `${z.name}: the zones map lists “${z.director.name}” as director; officials list “${h.name}”.` }); });
  return out;
}

/* ---------------- website ---------------- */
export type PublicOfficial = { seat: string; kind: Kind; office: string; zone: string; center: string; zips: string[]; atLarge: string; name: string; email: string; termEnd: string };
/** Only what the public website may show: serving people the admin chose to list; email only when allowed. */
export function publicOfficials(d: Officials, today = ''): PublicOfficial[] {
  if (!d.website.enabled) return [];
  return d.holders.filter((h) => h.status === 'serving' && h.showOnWebsite && h.name && !(today && h.kind !== 'secretary' && h.termEnd && h.termEnd < today)).map((h) => ({
    seat: seatLabel(h), kind: h.kind, office: h.office, zone: h.zone, center: h.center, zips: h.zips, atLarge: h.atLarge, name: h.name,
    email: d.website.showEmail ? h.publicEmail : '', termEnd: h.kind === 'secretary' ? '' : h.termEnd,
  }));
}
/** "Who represents me?" from a ZIP code. */
export function findMyRepresentatives(list: PublicOfficial[], zoneOfZip: (zip: string) => string | null, zip: string) {
  const z5 = zip.trim().slice(0, 5);
  const reps = list.filter((p) => p.kind === 'area-rep' && p.zips.includes(z5));
  const center = reps[0]?.center ?? '';
  const zone = zoneOfZip(z5) ?? '';
  return {
    zone, center, areaReps: reps,
    atLarge: list.filter((p) => p.kind === 'area-rep' && p.atLarge && p.center === center),
    associateDirector: list.find((p) => p.kind === 'associate-director' && p.center === center) ?? null,
    zonalDirector: list.find((p) => p.kind === 'zonal-director' && p.zone === zone) ?? null,
  };
}

/* ---------------- demo data (fictional people; member IDs match demo records only by shape) ---------------- */
const T25 = termFor(2025); // Jan 2026 – Jan 2028
const T24 = termFor(2024); // Jan 2025 – Jan 2027
const H = (p: Partial<Holder> & Pick<Holder, 'id' | 'kind' | 'name'>): Holder => ({
  office: '', zone: '', center: '', zips: [], atLarge: '', memberId: '', publicEmail: '', how: 'elected', termStart: T25.start, termEnd: T25.end,
  oathOn: T25.start, orientationOn: '', status: 'serving', vacancy: { reason: '', on: '' }, boardTerms: 0, showOnWebsite: true, ...p,
});
const t24 = { termStart: T24.start, termEnd: T24.end, oathOn: T24.start };
export const mockOfficials: Officials = {
  eidDates: ['2026-03-20', '2026-05-27', '2027-03-10', '2027-05-16', '2028-02-27', '2028-05-05'],
  website: { enabled: true, showEmail: true, findByZip: true },
  holders: [
    H({ id: 'president', kind: 'officer', office: 'president', name: 'Yusuf Karim', publicEmail: 'president@isgh.org', ...t24, boardTerms: 1 }),
    H({ id: 'vice-president', kind: 'officer', office: 'vice-president', name: 'Salman Qadir', publicEmail: 'vp@isgh.org' }),
    H({ id: 'general-secretary', kind: 'officer', office: 'general-secretary', name: 'Hamza Rauf', publicEmail: 'gs@isgh.org', ...t24 }),
    H({ id: 'treasurer', kind: 'officer', office: 'treasurer', name: 'Bilal Ansari', publicEmail: 'treasurer@isgh.org' }),
    H({ id: 'zd-n', kind: 'zonal-director', zone: 'n', name: 'North Zone Director', publicEmail: 'dir.nz@isgh.org', ...t24 }),
    H({ id: 'zd-nw', kind: 'zonal-director', zone: 'nw', name: 'Northwest Zone Director', publicEmail: 'dir.nwz@isgh.org' }),
    H({ id: 'zd-sw', kind: 'zonal-director', zone: 'sw', name: 'Southwest Zone Director', publicEmail: 'dir.swz@isgh.org', ...t24 }),
    H({ id: 'zd-s', kind: 'zonal-director', zone: 's', name: 'South Zone Director', publicEmail: 'dir.sz@isgh.org' }),
    H({ id: 'zd-se', kind: 'zonal-director', zone: 'se', name: '', status: 'vacant', vacancy: { reason: 'resigned', on: '2026-08-20' }, oathOn: '' }),
    // Southwest Islamic Center 1 – a complete center
    H({ id: 'ad-sw-1', kind: 'associate-director', center: 'Southwest Islamic Center 1', name: 'Imran Malik', publicEmail: 'ad.sw1@isgh.org' }),
    ...(Object.keys(SECRETARIES) as (keyof typeof SECRETARIES)[]).map((s, i) => H({ id: `sec-sw-1-${s}`, kind: 'secretary', office: s, center: 'Southwest Islamic Center 1', name: ['Omar Siddiqui', 'Faisal Haq', 'Sana Mirza', 'Adeel Shah', 'Zara Hussain'][i], how: 'confirmed', termEnd: '', oathOn: '' })),
    H({ id: 'ar-sw-1-a', kind: 'area-rep', center: 'Southwest Islamic Center 1', zips: ['77036'], name: 'Kamran Butt', ...t24 }),
    H({ id: 'ar-sw-1-b', kind: 'area-rep', center: 'Southwest Islamic Center 1', zips: ['77036'], name: 'Asma Latif', ...t24 }),
    H({ id: 'ar-sw-1-c', kind: 'area-rep', center: 'Southwest Islamic Center 1', zips: ['77072'], name: 'Tariq Noor', ...t24 }),
    H({ id: 'ar-sw-1-d', kind: 'area-rep', center: 'Southwest Islamic Center 1', zips: [], atLarge: 'general', name: 'Nadia Farooq', ...t24 }),
    // North Islamic Center 1 – appointed Associate Director, one secretary missing
    H({ id: 'ad-n-1', kind: 'associate-director', center: 'North Islamic Center 1', name: 'Rashid Alvi', how: 'appointed', termStart: '2026-04-12', termEnd: T24.end, oathOn: '2026-04-19', orientationOn: '2026-04-15' }),
    ...(['administrative', 'finance', 'education', 'membership'] as const).map((s, i) => H({ id: `sec-n-1-${s}`, kind: 'secretary', office: s, center: 'North Islamic Center 1', name: ['Junaid Siddiqui', 'Hina Saeed', 'Mariam Chaudhry', 'Usman Ghani'][i], how: 'confirmed', termEnd: '', oathOn: '' })),
    H({ id: 'ar-n-1-a', kind: 'area-rep', center: 'North Islamic Center 1', zips: ['77014'], name: 'Waleed Anwar' }),
    H({ id: 'ar-n-1-b', kind: 'area-rep', center: 'North Islamic Center 1', zips: ['77067', '77090'], name: 'Sadia Rehman' }),
    H({ id: 'ar-n-1-c', kind: 'area-rep', center: 'North Islamic Center 1', zips: [], atLarge: 'general', name: '', status: 'vacant', vacancy: { reason: 'moved-away', on: '2026-06-01' }, oathOn: '' }),
    // a term that should have ended (data entry left behind)
    H({ id: 'ad-se-2', kind: 'associate-director', center: 'Southeast Islamic Center 2', name: 'Ahmed Jaffer', termStart: '2024-01-07', termEnd: '2026-01-04', oathOn: '2024-01-07' }),
  ],
};
