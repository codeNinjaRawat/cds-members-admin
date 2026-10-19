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
  memberId: z.union([z.literal(''), z.string().regex(/^[A-Z]{2,5}-\d{4,8}$/, 'Member IDs look like ABC-204781.')]),
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
/**
 * E1 – one past (or current) term of one position: the history of who held what, year by year. Uploaded from a
 * spreadsheet or added by hand. `title` keeps the position exactly as the organization writes it, so an organization
 * with other offices than ISGH's (kind 'other') keeps its history too.
 */
export const END_REASONS = { completed: 'Completed the term', ...VACANCY_REASONS } as const;
export const TermSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/),
  year: z.number().int().min(1900).max(2200),  // election year – the year the term was decided
  kind: z.enum([...(Object.keys(KINDS) as [Kind, ...Kind[]]), 'other']),
  office: z.string().max(40),
  zone: z.string().max(40),
  center: z.string().max(80),
  zips: z.array(z.string().regex(/^\d{5}$/)).max(20),
  atLarge: z.enum(['', 'general', 'youth', 'female']),
  title: z.string().trim().max(80),            // the position as written (shown for 'other'; kept for every row)
  name: z.string().trim().min(2, 'Enter the name.').max(80),
  memberId: z.union([z.literal(''), z.string().regex(/^[A-Z]{2,5}-\d{4,8}$/, 'Member IDs look like ABC-204781.')]),
  how: z.enum(['elected', 'appointed', 'confirmed', 'acting']),
  termStart: ISO_OR_EMPTY,
  termEnd: ISO_OR_EMPTY,
  endReason: z.union([z.literal(''), z.enum(Object.keys(END_REASONS) as [keyof typeof END_REASONS, ...(keyof typeof END_REASONS)[]])]),
  notes: z.string().max(240),
  source: z.enum(['upload', 'manual', 'archived']),
  showOnWebsite: z.boolean(),
});
export type Term = z.infer<typeof TermSchema>;

export const OfficialsSchema = z.object({
  holders: z.array(HolderSchema).max(1500),
  history: z.array(TermSchema).max(5000).default([]),   // E1 – past terms, per year and position
  eidDates: z.array(ISO).max(60),               // first day of each Eid (oath and election dates skip the 3 Eid days)
  website: z.object({ enabled: z.boolean(), showEmail: z.boolean(), findByZip: z.boolean(), pastLeadership: z.boolean().default(false) }),
}).superRefine((d, ctx) => {
  d.history.forEach((t, i) => { if (t.termStart && t.termEnd && t.termEnd <= t.termStart) ctx.addIssue({ code: 'custom', path: ['history', i, 'termEnd'], message: 'The term must end after it starts.' }); });
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
const iso = (d: Date) => (Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10));   // empty date on file: '' instead of a crash
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

/* ---------------- E1 term history: upload, grouping, export ---------------- */
export const HISTORY_COLUMNS = [
  { key: 'year', label: 'Year', required: true, aliases: ['year', 'electionyear', 'term', 'termyear'] },
  { key: 'position', label: 'Position', required: true, aliases: ['position', 'office', 'seat', 'title', 'role', 'post'] },
  { key: 'name', label: 'Name', required: true, aliases: ['name', 'fullname', 'holder', 'member', 'person', 'electedmember'] },
  { key: 'zone', label: 'Zone', required: false, aliases: ['zone', 'zonename', 'region'] },
  { key: 'center', label: 'Islamic Center', required: false, aliases: ['center', 'islamiccenter', 'masjid', 'centre', 'mosque', 'location'] },
  { key: 'zips', label: 'ZIP codes', required: false, aliases: ['zips', 'zip', 'zipcodes', 'zipcode', 'area'] },
  { key: 'memberId', label: 'Member ID', required: false, aliases: ['memberid', 'id', 'membernumber', 'memberno'] },
  { key: 'how', label: 'How', required: false, aliases: ['how', 'elected', 'electedappointed', 'method', 'by'] },
  { key: 'termStart', label: 'Term starts', required: false, aliases: ['termstarts', 'termstart', 'start', 'startdate', 'from', 'oath', 'oathdate'] },
  { key: 'termEnd', label: 'Term ends', required: false, aliases: ['termends', 'termend', 'end', 'enddate', 'to', 'until'] },
  { key: 'endReason', label: 'End reason', required: false, aliases: ['endreason', 'reason', 'left', 'whyended', 'outcome'] },
  { key: 'notes', label: 'Notes', required: false, aliases: ['notes', 'note', 'comment', 'comments', 'remarks'] },
] as const;
export type HistoryKey = (typeof HISTORY_COLUMNS)[number]['key'];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** A date typed as 10/05/2024, 2024-10-05 or 5 Oct 2024 → ISO, '' when empty, null when it cannot be read. */
export function readDate(v: string): string | null {
  const s = v.trim(); if (!s) return '';
  const ok = (y: string, mo: string, d: string) => (Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31 ? `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` : null);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return ok(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return ok(m[3], m[1], m[2]);
  const d = new Date(s); if (!Number.isNaN(d.getTime()) && /\d{4}/.test(s)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return null;
}

/** The seat a position title describes. Titles the organization uses that ISGH's Bylaws do not know become 'other'. */
export function matchPosition(title: string, zoneName: string, centerName: string, map: { zones: { id: string; name: string }[]; centers: { name: string; aka?: string; zone: string }[] }): Pick<Term, 'kind' | 'office' | 'zone' | 'center' | 'atLarge'> & { problem?: string } {
  const t = norm(title);
  const zoneBy = (s: string) => map.zones.find((z) => norm(z.name) === norm(s) || norm(z.name).replace('zone', '') === norm(s).replace('zone', ''))?.id ?? '';
  const centerBy = (s: string) => map.centers.find((c) => norm(c.name) === norm(s) || (c.aka && norm(c.aka) === norm(s)))?.name ?? '';
  const zone = zoneBy(zoneName); const center = centerBy(centerName);
  const inTitle = (keys: string[]) => keys.some((k) => t.includes(k));
  const officer = (Object.entries(OFFICERS) as [keyof typeof OFFICERS, string][]).find(([, v]) => t === norm(v) || t === `isgh${norm(v)}`);
  if (officer) return { kind: 'officer', office: officer[0], zone: '', center: '', atLarge: '' };
  const sec = (Object.entries(SECRETARIES) as [keyof typeof SECRETARIES, string][]).find(([, v]) => t.includes(norm(v)));
  if (sec) return center ? { kind: 'secretary', office: sec[0], zone: '', center, atLarge: '' } : { kind: 'secretary', office: sec[0], zone: '', center: '', atLarge: '', problem: 'Name the Islamic Center of this Secretary.' };
  if (inTitle(['zonaldirector', 'zonedirector', 'directorzone']) || (t.includes('director') && !t.includes('associate'))) {
    const z = zone || map.zones.find((x) => t.includes(norm(x.name).replace('zone', '')))?.id || '';
    return z ? { kind: 'zonal-director', office: '', zone: z, center: '', atLarge: '' } : { kind: 'zonal-director', office: '', zone: '', center: '', atLarge: '', problem: 'Name the zone of this Zonal Director.' };
  }
  if (inTitle(['associatedirector'])) return center ? { kind: 'associate-director', office: '', zone: '', center, atLarge: '' } : { kind: 'associate-director', office: '', zone: '', center: '', atLarge: '', problem: 'Name the Islamic Center of this Associate Director.' };
  if (inTitle(['arearep', 'representative', 'councilmember'])) {
    const atLarge: Term['atLarge'] = t.includes('youth') ? 'youth' : t.includes('sister') || t.includes('female') ? 'female' : t.includes('atlarge') ? 'general' : '';
    return center ? { kind: 'area-rep', office: '', zone: '', center, atLarge } : { kind: 'area-rep', office: '', zone: '', center: '', atLarge, problem: 'Name the Islamic Center of this Area Representative.' };
  }
  return { kind: 'other', office: '', zone, center, atLarge: '' };
}

export type HistoryRow = { line: number; status: 'ok' | 'error' | 'duplicate'; errors: string[]; record?: Term };
export type HistoryPlan = { columns: { header: string; key: HistoryKey | '' }[]; missing: string[]; rows: HistoryRow[]; tooMany: boolean };
/** Read a CSV of past terms (one row per year × position × person) and check every row; nothing is saved here. */
export function planHistoryImport(text: string, ctx: { map: { zones: { id: string; name: string }[]; centers: { name: string; aka?: string; zone: string }[] }; existing: Term[]; memberIds?: Set<string>; termYears?: number }, parse: (t: string) => string[][]): HistoryPlan {
  const all = parse(text);
  const head = all[0] ?? [];
  const columns = head.map((h) => ({ header: h, key: (HISTORY_COLUMNS.find((c) => (c.aliases as readonly string[]).includes(norm(h)))?.key ?? '') as HistoryKey | '' }));
  const missing = HISTORY_COLUMNS.filter((c) => c.required && !columns.some((x) => x.key === c.key)).map((c) => c.label);
  const body = all.slice(1); const tooMany = body.length > 2000;
  const at = (r: string[], k: HistoryKey) => { const i = columns.findIndex((c) => c.key === k); return i >= 0 ? (r[i] ?? '').trim() : ''; };
  const seats = new Map<string, number>(); const people = new Map<string, number>();
  const seatKey = (t: Pick<Term, 'year' | 'kind' | 'office' | 'zone' | 'center' | 'title' | 'atLarge' | 'zips'>) => [t.year, t.kind, t.office, t.zone, t.center, t.kind === 'other' ? norm(t.title) : '', t.atLarge, t.zips.join('+')].join('|');
  ctx.existing.forEach((t) => { seats.set(seatKey(t), 0); });
  const rows: HistoryRow[] = body.slice(0, 2000).map((r, k) => {
    const line = k + 2; const errors: string[] = [];
    if (missing.length) return { line, status: 'error', errors: ['Missing columns.'] };
    const title = at(r, 'position'); const name = at(r, 'name');
    const yearRaw = at(r, 'year'); const yearMatch = yearRaw.match(/\d{4}/);
    const termStart = readDate(at(r, 'termStart')); const termEnd = readDate(at(r, 'termEnd'));
    if (termStart === null) errors.push('Term starts: use a date like 01/07/2024.');
    if (termEnd === null) errors.push('Term ends: use a date like 01/04/2026.');
    const year = yearMatch ? Number(yearMatch[0]) : termStart ? Number(termStart.slice(0, 4)) - 1 : NaN;
    if (!Number.isInteger(year) || year < 1900 || year > 2200) errors.push('Year: enter the election year, like 2024.');
    if (!title) errors.push('Position is empty.');
    if (name.length < 2) errors.push('Name is empty.');
    const pos = matchPosition(title, at(r, 'zone'), at(r, 'center'), ctx.map);
    const centerRaw = at(r, 'center'); const zoneRaw = at(r, 'zone');
    if (centerRaw && !pos.center && pos.kind !== 'other') errors.push(`Islamic Center “${centerRaw}” is not in Masjids and zones.`);
    else if (zoneRaw && pos.kind === 'zonal-director' && !pos.zone) errors.push(`Zone “${zoneRaw}” is not in Masjids and zones.`);
    else if (pos.problem) errors.push(pos.problem);
    const zips = at(r, 'zips').split(/[\s,;]+/).filter(Boolean); if (zips.some((z) => !/^\d{5}$/.test(z))) errors.push('ZIP codes have 5 digits.');
    const howRaw = norm(at(r, 'how')); const how: Term['how'] = howRaw.startsWith('app') ? 'appointed' : howRaw.startsWith('act') ? 'acting' : howRaw.startsWith('con') ? 'confirmed' : 'elected';
    const reasonRaw = norm(at(r, 'endReason')); const endReason = (Object.entries(END_REASONS).find(([k, v]) => reasonRaw && (norm(v) === reasonRaw || norm(k) === reasonRaw || norm(v).includes(reasonRaw)))?.[0] ?? (reasonRaw ? 'other' : '')) as Term['endReason'];
    const memberId = at(r, 'memberId').toUpperCase(); if (memberId && !/^[A-Z]{2,5}-\d{4,8}$/.test(memberId)) errors.push('Member IDs look like ABC-204781.');
    if (memberId && ctx.memberIds && !ctx.memberIds.has(memberId)) errors.push(`Member ${memberId} is not in the member records.`);
    if (termStart && termEnd && termEnd <= termStart) errors.push('The term must end after it starts.');
    if (errors.length) return { line, status: 'error', errors };
    const yrs = ctx.termYears ?? 2;
    const record: Term = {
      id: `t-${year}-${norm(title).slice(0, 12) || 'x'}-${norm(name).slice(0, 10)}-${line}`, year, kind: pos.kind, office: pos.office, zone: pos.zone, center: pos.center, zips: zips.slice(0, 20), atLarge: pos.atLarge,
      title, name, memberId, how, termStart: termStart || (pos.kind === 'secretary' ? '' : oathDay(year)), termEnd: termEnd || (pos.kind === 'secretary' ? '' : oathDay(year + yrs)), endReason, notes: at(r, 'notes').slice(0, 240), source: 'upload', showOnWebsite: true,
    };
    // the same seat twice in one year (from the file or already saved), one person in two elected offices the same year
    const sk = seatKey(record); const pk = `${year}|${memberId || norm(name)}`;
    const dup: string[] = [];
    if (seats.has(sk) && !(pos.kind === 'area-rep' && !pos.atLarge)) dup.push(`${seatLabelOfTerm(record)} already has a holder for ${year}${seats.get(sk) ? ` (row ${seats.get(sk)})` : ''}.`);
    if (record.kind !== 'secretary' && record.kind !== 'other' && people.has(pk)) dup.push(`${name} already holds an elected office in ${year} (row ${people.get(pk)}).`);
    if (!seats.has(sk)) seats.set(sk, line);
    if (record.kind !== 'secretary' && record.kind !== 'other' && !people.has(pk)) people.set(pk, line);
    return dup.length ? { line, status: 'duplicate', errors: dup, record } : { line, status: 'ok', errors: [], record };
  });
  return { columns, missing, rows, tooMany };
}
export function seatLabelOfTerm(t: Pick<Term, 'kind' | 'office' | 'zone' | 'center' | 'zips' | 'atLarge' | 'title'>, zoneName: (id: string) => string = (z) => z): string {
  return t.kind === 'other' ? [t.title, t.center || (t.zone ? zoneName(t.zone) : '')].filter(Boolean).join(', ') : seatLabel({ ...t, kind: t.kind }, zoneName);
}
/** "2024 – 2026" from the election year and the term dates. */
export const termLabel = (t: Pick<Term, 'year' | 'termStart' | 'termEnd'>) => (t.termEnd ? `${t.termStart ? t.termStart.slice(0, 4) : t.year + 1} – ${t.termEnd.slice(0, 4)}` : String(t.year));
/** Terms grouped by election year, newest first; positions in Bylaws order inside each year. */
export function historyByYear(history: Term[]): { year: number; terms: Term[] }[] {
  const order: Record<string, number> = { officer: 0, 'zonal-director': 1, 'associate-director': 2, secretary: 3, 'area-rep': 4, other: 5 };
  const offs = Object.keys(OFFICERS);
  const years = Array.from(new Set(history.map((t) => t.year))).sort((a, b) => b - a);
  return years.map((year) => ({ year, terms: history.filter((t) => t.year === year).sort((a, b) => order[a.kind] - order[b.kind] || offs.indexOf(a.office) - offs.indexOf(b.office) || a.center.localeCompare(b.center) || a.title.localeCompare(b.title) || a.name.localeCompare(b.name)) }));
}
/** The same seat through the years ("President: 2024 …, 2022 …"). Current holders are listed first as the open term. */
export function historyByPosition(history: Term[], current: Holder[] = [], zoneName: (id: string) => string = (z) => z): { seat: string; kind: Term['kind']; terms: Term[] }[] {
  const now: Term[] = current.filter((h) => h.status === 'serving' && h.name).map((h) => ({ id: `now-${h.id}`, year: h.termStart ? Number(h.termStart.slice(0, 4)) - 1 : 0, kind: h.kind, office: h.office, zone: h.zone, center: h.center, zips: h.zips, atLarge: h.atLarge, title: seatLabel(h, zoneName), name: h.name, memberId: h.memberId, how: h.how, termStart: h.termStart, termEnd: h.termEnd, endReason: '', notes: '', source: 'archived', showOnWebsite: h.showOnWebsite }));
  const key = (t: Term) => (t.kind === 'area-rep' ? `Area Representatives, ${t.center}` : seatLabelOfTerm(t, zoneName));
  const groups = new Map<string, { seat: string; kind: Term['kind']; terms: Term[] }>();
  [...now, ...history].forEach((t) => { const k = key(t); if (!groups.has(k)) groups.set(k, { seat: k, kind: t.kind, terms: [] }); groups.get(k)!.terms.push(t); });
  const order: Record<string, number> = { officer: 0, 'zonal-director': 1, 'associate-director': 2, secretary: 3, 'area-rep': 4, other: 5 };
  const offs = Object.values(OFFICERS) as string[];
  return Array.from(groups.values()).map((g) => ({ ...g, terms: g.terms.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name)) })).sort((a, b) => order[a.kind] - order[b.kind] || (a.kind === 'officer' ? offs.indexOf(a.seat) - offs.indexOf(b.seat) : 0) || a.seat.localeCompare(b.seat));
}
/** Full Board terms a person already served, counted from the history (for term limits) – by member ID, else by name. */
export function boardTermsServed(history: Term[], who: { memberId: string; name: string }, before = 9999): number {
  return history.filter((t) => (t.kind === 'officer' || t.kind === 'zonal-director') && t.year < before && (who.memberId && t.memberId ? t.memberId === who.memberId : norm(t.name) === norm(who.name)) && t.endReason !== 'resigned' && t.endReason !== 'removed').length;
}
/** The history as rows for a CSV in the same layout as the upload template. */
export function historyRows(history: Term[], zoneName: (id: string) => string = (z) => z): string[][] {
  return history.map((t) => [String(t.year), t.kind === 'other' ? t.title : seatLabelOfTerm(t, zoneName).split(', ')[0], t.name, t.zone ? zoneName(t.zone) : '', t.center, t.zips.join(' '), t.memberId, HOW[t.how], fmt(t.termStart), fmt(t.termEnd), t.endReason ? END_REASONS[t.endReason] : '', t.notes]);
}
export const HISTORY_TEMPLATE_ROWS: string[][] = [
  ['2022', 'President', 'Example Name A', '', '', '', '', 'Elected', '01/08/2023', '01/05/2025', 'Completed the term', ''],
  ['2022', 'Zonal Director', 'Example Name B', 'North Zone', '', '', '', 'Elected', '01/08/2023', '01/05/2025', '', ''],
  ['2022', 'Associate Director', 'Example Name C', '', 'North Islamic Center 1', '', '', 'Elected', '01/08/2023', '01/05/2025', '', ''],
  ['2022', 'Area Representative', 'Example Name D', '', 'North Islamic Center 1', '77014', '', 'Elected', '', '', '', 'Dates filled in from the election year when empty'],
];
/** What the public website may show of past leadership (names and seats only; Board and center heads, not Area Reps). */
export function publicPastLeadership(d: Officials, zoneName: (id: string) => string = (z) => z): { year: number; terms: { seat: string; name: string; term: string }[] }[] {
  if (!d.website.enabled || !d.website.pastLeadership) return [];
  return historyByYear(d.history.filter((t) => t.showOnWebsite && t.kind !== 'area-rep' && t.kind !== 'secretary')).map((g) => ({ year: g.year, terms: g.terms.map((t) => ({ seat: seatLabelOfTerm(t, zoneName), name: t.name, term: termLabel(t) })) }));
}

/** Member portal: every past term the organization shows (Area Representatives and Secretaries too – members may want to know who
 *  represented them), still never member IDs or emails. Not tied to the website's "past leadership" switch. */
export function memberPastLeadership(d: Officials, zoneName: (id: string) => string = (z) => z): { year: number; terms: { seat: string; name: string; term: string; kind: string }[] }[] {
  return historyByYear(d.history.filter((t) => t.showOnWebsite)).map((g) => ({ year: g.year, terms: g.terms.map((t) => ({ seat: seatLabelOfTerm(t, zoneName), name: t.name, term: termLabel(t), kind: t.kind })) }));
}

/* ---------------- demo data (fictional people; member IDs match demo records only by shape) ---------------- */
const T25 = termFor(2025); // Jan 2026 – Jan 2028
const T24 = termFor(2024); // Jan 2025 – Jan 2027
const H = (p: Partial<Holder> & Pick<Holder, 'id' | 'kind' | 'name'>): Holder => ({
  office: '', zone: '', center: '', zips: [], atLarge: '', memberId: '', publicEmail: '', how: 'elected', termStart: T25.start, termEnd: T25.end,
  oathOn: T25.start, orientationOn: '', status: 'serving', vacancy: { reason: '', on: '' }, boardTerms: 0, showOnWebsite: true, ...p,
});
const t24 = { termStart: T24.start, termEnd: T24.end, oathOn: T24.start };
const PT = (year: number, p: Partial<Term> & Pick<Term, 'kind' | 'name'>): Term => ({
  id: `h-${year}-${p.kind}-${(p.office || p.zone || p.center || p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}-${p.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8)}`,
  year, office: '', zone: '', center: '', zips: [], atLarge: '', title: '', memberId: '', how: 'elected', termStart: oathDay(year), termEnd: oathDay(year + 2), endReason: 'completed', notes: '', source: 'archived', showOnWebsite: true, ...p,
});
/** E1 demo history – two earlier election cycles (fictional names). */
export const mockHistory: Term[] = [
  PT(2022, { kind: 'officer', office: 'president', title: 'President', name: 'Yusuf Karim' }),
  PT(2022, { kind: 'officer', office: 'general-secretary', title: 'General Secretary', name: 'Nasir Baig' }),
  PT(2022, { kind: 'zonal-director', zone: 'n', title: 'Zonal Director', name: 'Rizwan Qureshi' }),
  PT(2022, { kind: 'zonal-director', zone: 'sw', title: 'Zonal Director', name: 'Saira Hashmi' }),
  PT(2022, { kind: 'associate-director', center: 'Northwest Islamic Center 1', title: 'Associate Director', name: 'Danish Iqbal', how: 'elected', termEnd: '2024-06-30', endReason: 'moved-away', notes: 'Seat filled by appointment for the rest of 2024.' }),
  PT(2022, { kind: 'associate-director', center: 'Northwest Islamic Center 1', title: 'Associate Director', name: 'Farhan Zaidi', how: 'appointed', termStart: '2024-07-07', termEnd: oathDay(2024) }),
  PT(2021, { kind: 'officer', office: 'vice-president', title: 'Vice President', name: 'Salman Qadir' }),
  PT(2021, { kind: 'officer', office: 'treasurer', title: 'Treasurer', name: 'Lubna Akram' }),
  PT(2021, { kind: 'zonal-director', zone: 'se', title: 'Zonal Director', name: 'Haroon Pasha' }),
  PT(2021, { kind: 'associate-director', center: 'Southwest Islamic Center 1', title: 'Associate Director', name: 'Imran Malik' }),
  PT(2020, { kind: 'officer', office: 'president', title: 'President', name: 'Nasir Baig' }),
  PT(2020, { kind: 'officer', office: 'general-secretary', title: 'General Secretary', name: 'Yusuf Karim' }),
  PT(2020, { kind: 'zonal-director', zone: 'n', title: 'Zonal Director', name: 'Rizwan Qureshi' }),
  PT(2020, { kind: 'area-rep', center: 'Southwest Islamic Center 1', zips: ['77036'], title: 'Area Representative', name: 'Kamran Butt' }),
  PT(2020, { kind: 'other', title: 'Election Commissioner', name: 'Shireen Dawood', how: 'appointed', termStart: '2020-09-01', termEnd: '2021-01-31' }),
];
export const mockOfficials: Officials = {
  eidDates: ['2026-03-20', '2026-05-27', '2027-03-10', '2027-05-16', '2028-02-27', '2028-05-05'],
  website: { enabled: true, showEmail: true, findByZip: true, pastLeadership: true },
  history: mockHistory,
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
