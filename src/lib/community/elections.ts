/**
 * Elections – nominations, the ballot and the results for one election year, run by the Election Commission.
 * Seats come from the organization's configuration (Elected officials: which seats are on the ballot in which years;
 * Masjids and zones: who votes where), the rules are editable (nomination window, seconder, self-nomination, standing
 * years, voting method, tie-break), ISGH's Bylaws values are the defaults: election on the second Sunday of December,
 * secret ballot, Board candidates ≥ 1 year in good standing (President / Vice President ≥ 2), one office per person.
 * Certified winners are sworn in: they become holders in Elected officials with the term dates, and the previous
 * holders go into the history.
 * DEMO (no API). Live: GET/PUT /admin/elections, POST /admin/elections/:year/swear-in. Synced to the admin by sync-contracts.mjs.
 */
import { z } from 'zod';
import { AT_LARGE, OFFICERS, areaRepSeats, ballotParity, electionDay, oathDay, type Holder, type Kind } from './officials';

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date.');
const ISO_OR_EMPTY = z.union([ISO, z.literal('')]);
const MEMBER_ID = z.union([z.literal(''), z.string().regex(/^[A-Z]{2,5}-\d{4,8}$/, 'Member IDs look like ABC-204781.')]);

export const ElectionRulesSchema = z.object({
  nominationsOpenDaysBefore: z.number().int().min(7).max(180).default(60),    // before Election Day
  nominationsCloseDaysBefore: z.number().int().min(1).max(120).default(21),
  seconderRequired: z.boolean().default(true),
  selfNominationAllowed: z.boolean().default(true),
  oneSeatPerPerson: z.boolean().default(true),                                // one elected office at a time (Bylaws)
  boardStandingYears: z.number().int().min(0).max(10).default(1),             // years in good standing before the election year
  officerStandingYears: z.number().int().min(0).max(10).default(2),           // President and Vice President
  residencyRequired: z.boolean().default(true),                               // live in the zone / center / ZIP of the seat
  method: z.enum(['in-person', 'online', 'both']).default('in-person'),
  secretBallot: z.boolean().default(true),
  tieBreak: z.enum(['runoff', 'drawing', 'commission']).default('runoff'),
  certifiedBy: z.string().max(60).default('Election Commission'),
});
export type ElectionRules = z.infer<typeof ElectionRulesSchema>;

/** A seat on the ballot. `voters` says who votes for it: everyone, a zone, a center, or the ZIP codes of an Area Representative seat. */
export const SeatSchema = z.object({
  key: z.string().min(2).max(120),
  label: z.string().min(2).max(140),
  kind: z.enum(['officer', 'zonal-director', 'associate-director', 'area-rep', 'secretary']),
  office: z.string().max(40).default(''),
  zone: z.string().max(40).default(''),
  center: z.string().max(80).default(''),
  zips: z.array(z.string().regex(/^\d{5}$/)).max(20).default([]),
  atLarge: z.enum(['', 'general', 'youth', 'female']).default(''),
  places: z.number().int().min(1).max(10).default(1),                         // Area Representatives: seats for this ZIP group
  voters: z.enum(['all', 'zone', 'center', 'zips']).default('all'),
  removed: z.boolean().default(false),                                        // taken off the ballot by the Commission (appointment, no vacancy…)
});
export type Seat = z.infer<typeof SeatSchema>;

export const NOMINATION_STATUS = { nominated: 'Nominated', accepted: 'Accepted', declined: 'Declined', withdrawn: 'Withdrawn', ineligible: 'Not eligible' } as const;
export const NominationSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/),
  seatKey: z.string().min(2).max(120),
  memberId: MEMBER_ID,
  name: z.string().trim().min(2, 'Enter the candidate’s name.').max(80),
  nominatedBy: z.string().trim().max(80).default(''),                          // name (member ID in the note is fine)
  secondedBy: z.string().trim().max(80).default(''),
  on: ISO,
  status: z.enum(Object.keys(NOMINATION_STATUS) as ['nominated', ...('accepted' | 'declined' | 'withdrawn' | 'ineligible')[]]),
  note: z.string().max(300).default(''),
});
export type Nomination = z.infer<typeof NominationSchema>;

export const ResultSchema = z.object({
  seatKey: z.string().min(2).max(120),
  ballotsCast: z.number().int().min(0).default(0),
  spoiled: z.number().int().min(0).default(0),
  counts: z.array(z.object({ nominationId: z.string(), votes: z.number().int().min(0) })).max(30),
  winners: z.array(z.string()).max(10).default([]),                           // nomination ids, set when the count is accepted (tie-break applied)
  note: z.string().max(300).default(''),
});
export type Result = z.infer<typeof ResultSchema>;

export const ELECTION_STATUS = { planning: 'Planning', nominations: 'Nominations open', ballot: 'Ballot set', voting: 'Voting', counting: 'Counting', certified: 'Certified', closed: 'Closed' } as const;
export const ElectionSchema = z.object({
  year: z.number().int().min(1990).max(2200),
  electionDay: ISO,
  status: z.enum(Object.keys(ELECTION_STATUS) as ['planning', ...('nominations' | 'ballot' | 'voting' | 'counting' | 'certified' | 'closed')[]]),
  rules: ElectionRulesSchema,
  seats: z.array(SeatSchema).max(300),
  nominations: z.array(NominationSchema).max(3000),
  results: z.array(ResultSchema).max(300),
  voters: z.object({ frozenOn: ISO_OR_EMPTY.default(''), count: z.number().int().min(0).default(0) }).default({}),
  certification: z.object({ by: z.string().max(80).default(''), on: ISO_OR_EMPTY.default(''), note: z.string().max(300).default('') }).default({}),
  swornInOn: ISO_OR_EMPTY.default(''),
});
export type Election = z.infer<typeof ElectionSchema>;
export const ElectionsSchema = z.object({
  rules: ElectionRulesSchema.default({}),                                      // defaults for new elections
  elections: z.array(ElectionSchema).max(60),
}).superRefine((d, ctx) => {
  const years = new Set<number>();
  d.elections.forEach((e, i) => {
    if (years.has(e.year)) ctx.addIssue({ code: 'custom', path: ['elections', i, 'year'], message: `There are two elections for ${e.year}.` });
    years.add(e.year);
    if (e.rules.nominationsCloseDaysBefore >= e.rules.nominationsOpenDaysBefore) ctx.addIssue({ code: 'custom', path: ['elections', i, 'rules', 'nominationsCloseDaysBefore'], message: 'Nominations must close after they open.' });
    const ids = new Set<string>();
    e.nominations.forEach((n, j) => {
      if (ids.has(n.id)) ctx.addIssue({ code: 'custom', path: ['elections', i, 'nominations', j, 'id'], message: 'Duplicate nomination ID.' });
      ids.add(n.id);
      if (!e.seats.some((s) => s.key === n.seatKey)) ctx.addIssue({ code: 'custom', path: ['elections', i, 'nominations', j, 'seatKey'], message: 'This seat is not on the ballot.' });
      if (e.rules.seconderRequired && n.status === 'accepted' && !n.secondedBy) ctx.addIssue({ code: 'custom', path: ['elections', i, 'nominations', j, 'secondedBy'], message: 'A seconder is required before a nomination is accepted.' });
    });
    e.results.forEach((r, j) => {
      const sum = r.counts.reduce((a, c) => a + c.votes, 0);
      if (r.ballotsCast && sum + r.spoiled > r.ballotsCast) ctx.addIssue({ code: 'custom', path: ['elections', i, 'results', j, 'ballotsCast'], message: `Votes (${sum}) plus spoiled ballots (${r.spoiled}) exceed the ballots cast (${r.ballotsCast}).` });
      r.counts.forEach((c, k) => { if (!e.nominations.some((n) => n.id === c.nominationId)) ctx.addIssue({ code: 'custom', path: ['elections', i, 'results', j, 'counts', k], message: 'Count for a nomination that is not on the ballot.' }); });
    });
  });
});
export type ElectionsDoc = z.infer<typeof ElectionsSchema>;

/* ---------------- dates ---------------- */
const addDays = (s: string, n: number) => { const t = Date.parse(`${String(s ?? '').slice(0, 10)}T12:00:00Z`); if (Number.isNaN(t)) return String(s ?? ''); return new Date(t + n * 86_400_000).toISOString().slice(0, 10); };
export const fmt = (s: string) => (s ? `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}` : '');
export const nominationWindow = (e: Pick<Election, 'electionDay' | 'rules'>) => ({ open: addDays(e.electionDay, -e.rules.nominationsOpenDaysBefore), close: addDays(e.electionDay, -e.rules.nominationsCloseDaysBefore) });
export const nominationsOpen = (e: Pick<Election, 'electionDay' | 'rules'>, today: string) => { const w = nominationWindow(e); return today >= w.open && today <= w.close; };

/* ---------------- seats from the configuration ---------------- */
type MapLite = { zones: { id: string; name: string; active: boolean }[]; centers: { name: string; zone: string; active: boolean }[] };
/** Every seat chosen in the election of `year`: officers and directors by parity, Associate Directors and Area Representative seats per center. */
export function seatsOnBallot(year: number, map: MapLite, votersByCenter: Record<string, Record<string, number>>): Seat[] {
  const zoneOf = (c: string) => map.centers.find((x) => x.name === c)?.zone ?? '';
  const zn = (id: string) => map.zones.find((z) => z.id === id)?.name ?? id;
  const even = year % 2 === 0;
  const on = (h: Parameters<typeof ballotParity>[0]) => { const p = ballotParity(h, zoneOf); return p === (even ? 'even' : 'odd'); };
  const out: Seat[] = [];
  (Object.keys(OFFICERS) as (keyof typeof OFFICERS)[]).forEach((o) => { if (on({ kind: 'officer', office: o, zone: '', center: '' })) out.push({ key: `officer:${o}`, label: OFFICERS[o], kind: 'officer', office: o, zone: '', center: '', zips: [], atLarge: '', places: 1, voters: 'all', removed: false }); });
  map.zones.filter((z) => z.active).forEach((z) => { if (on({ kind: 'zonal-director', office: '', zone: z.id, center: '' })) out.push({ key: `zd:${z.id}`, label: `Zonal Director, ${z.name}`, kind: 'zonal-director', office: '', zone: z.id, center: '', zips: [], atLarge: '', places: 1, voters: 'zone', removed: false }); });
  map.centers.filter((c) => c.active).forEach((c) => {
    if (on({ kind: 'associate-director', office: '', zone: '', center: c.name })) out.push({ key: `ad:${c.name}`, label: `Associate Director, ${c.name}`, kind: 'associate-director', office: '', zone: c.zone, center: c.name, zips: [], atLarge: '', places: 1, voters: 'center', removed: false });
    if (on({ kind: 'area-rep', office: '', zone: '', center: c.name })) areaRepSeats(votersByCenter[c.name] ?? {}).rows.forEach((r) => out.push({ key: `ar:${c.name}:${r.atLarge ?? r.zips.join('+')}`, label: `Area Representative, ${c.name} – ${r.atLarge ? AT_LARGE[r.atLarge] : r.label}`, kind: 'area-rep', office: '', zone: c.zone, center: c.name, zips: r.zips, atLarge: r.atLarge ?? '', places: r.seats, voters: r.atLarge ? 'center' : 'zips', removed: false }));
  });
  void zn;
  return out.filter((x) => x.places >= 1);   // an Area Representative group with no voters yet (a year far ahead) has no seat
}

/* ---------------- eligibility of a nomination ---------------- */
export type CandidateFacts = { eligibleVoter: boolean; standingYears: number; zone: string; center: string; zip: string; holdsOffice?: string };
/** Why a nomination may not stand (empty = fine). Residency and standing come from the member record; one office per person from Elected officials and this ballot. */
export function nominationIssues(n: Pick<Nomination, 'seatKey' | 'memberId' | 'name' | 'nominatedBy' | 'secondedBy' | 'id'>, e: Pick<Election, 'seats' | 'nominations' | 'rules' | 'year'>, facts: CandidateFacts | null): string[] {
  const out: string[] = [];
  const seat = e.seats.find((s) => s.key === n.seatKey);
  if (!seat) return ['This seat is not on the ballot.'];
  if (seat.removed) out.push('This seat was taken off the ballot.');
  if (!n.memberId) out.push('Link the member record so eligibility can be checked.');
  else if (!facts) out.push(`Member ${n.memberId} not found.`);
  else {
    if (!facts.eligibleVoter) out.push('Not an eligible voting member this year.');
    const need = seat.kind === 'officer' && (seat.office === 'president' || seat.office === 'vice-president') ? e.rules.officerStandingYears : seat.kind === 'officer' || seat.kind === 'zonal-director' ? e.rules.boardStandingYears : 0;
    if (facts.standingYears < need) out.push(`Needs ${need} year${need === 1 ? '' : 's'} in good standing – has ${facts.standingYears}.`);
    if (e.rules.residencyRequired) {
      if (seat.kind === 'zonal-director' && facts.zone !== seat.zone) out.push('Does not live in the zone.');
      if ((seat.kind === 'associate-director' || (seat.kind === 'area-rep' && seat.atLarge)) && facts.center !== seat.center) out.push('Not a member of this center.');
      if (seat.kind === 'area-rep' && !seat.atLarge && !seat.zips.includes(facts.zip)) out.push(`Lives in ${facts.zip}, not in the ZIP code(s) of this seat.`);
    }
    if (e.rules.oneSeatPerPerson && facts.holdsOffice) out.push(`Already holds an elected office (${facts.holdsOffice}) whose term continues.`);
  }
  if (e.rules.oneSeatPerPerson) { const other = e.nominations.find((x) => x.id !== n.id && x.memberId && x.memberId === n.memberId && x.seatKey !== n.seatKey && x.status !== 'withdrawn' && x.status !== 'declined'); if (other) out.push(`Also nominated for ${e.seats.find((s) => s.key === other.seatKey)?.label ?? other.seatKey} – one seat per person.`); }
  if (!e.rules.selfNominationAllowed && n.nominatedBy && n.nominatedBy.trim().toLowerCase() === n.name.trim().toLowerCase()) out.push('Self-nomination is not allowed.');
  if (e.nominations.some((x) => x.id !== n.id && x.seatKey === n.seatKey && x.memberId && x.memberId === n.memberId && x.status !== 'withdrawn' && x.status !== 'declined')) out.push('Already nominated for this seat.');
  return out;
}

/* ---------------- the ballot ---------------- */
export type BallotSeat = { seat: Seat; candidates: Nomination[]; uncontested: boolean; empty: boolean };
/** Accepted nominations per seat, in alphabetical order; a seat with as many candidates as places is uncontested. */
export function ballot(e: Pick<Election, 'seats' | 'nominations'>): BallotSeat[] {
  return e.seats.filter((s) => !s.removed).map((seat) => {
    const candidates = e.nominations.filter((n) => n.seatKey === seat.key && n.status === 'accepted').sort((a, b) => a.name.localeCompare(b.name));
    return { seat, candidates, uncontested: candidates.length > 0 && candidates.length <= seat.places, empty: candidates.length === 0 };
  });
}

/* ---------------- results ---------------- */
export type Tally = { seat: Seat; rows: { nomination: Nomination; votes: number; share: number; winner: boolean }[]; ballotsCast: number; spoiled: number; tie: boolean; decided: boolean };
/** Count a seat: the top `places` candidates win; a tie on the last place is flagged (tie-break by the rules). */
export function tally(e: Pick<Election, 'seats' | 'nominations' | 'results'>, seatKey: string): Tally | null {
  const seat = e.seats.find((s) => s.key === seatKey); if (!seat) return null;
  const r = e.results.find((x) => x.seatKey === seatKey);
  const cands = e.nominations.filter((n) => n.seatKey === seatKey && n.status === 'accepted');
  const votes = (id: string) => r?.counts.find((c) => c.nominationId === id)?.votes ?? 0;
  const valid = cands.reduce((a, c) => a + votes(c.id), 0);
  const sorted = [...cands].sort((a, b) => votes(b.id) - votes(a.id) || a.name.localeCompare(b.name));
  const cut = sorted[seat.places - 1] ? votes(sorted[seat.places - 1].id) : 0;
  const tie = !!r && sorted.length > seat.places && votes(sorted[seat.places].id) === cut && cut > 0;
  const decided = !!r && r.winners.length > 0;
  return {
    seat, ballotsCast: r?.ballotsCast ?? 0, spoiled: r?.spoiled ?? 0, tie, decided,
    rows: sorted.map((n, i) => ({ nomination: n, votes: votes(n.id), share: valid ? votes(n.id) / valid : 0, winner: decided ? r!.winners.includes(n.id) : !tie && !!r && i < seat.places && votes(n.id) > 0 })),
  };
}
/** The winners a count implies when there is no tie (used when the Commission accepts a count). */
export const impliedWinners = (t: Tally) => (t.tie ? [] : t.rows.filter((x) => x.winner).map((x) => x.nomination.id));

/** Turnout for the election: ballots cast for the widest seat (all voters) over the frozen voter count. */
export function turnout(e: Election): { cast: number; voters: number; pct: number } {
  const widest = e.seats.find((s) => s.voters === 'all' && !s.removed);
  const cast = widest ? e.results.find((r) => r.seatKey === widest.key)?.ballotsCast ?? 0 : Math.max(0, ...e.results.map((r) => r.ballotsCast));
  return { cast, voters: e.voters.count, pct: e.voters.count ? Math.round((cast / e.voters.count) * 100) : 0 };
}

/* ---------------- warnings and the swearing-in ---------------- */
export function electionWarnings(e: Election, today: string): string[] {
  const out: string[] = [];
  const w = nominationWindow(e);
  if (e.status === 'nominations' && today > w.close) out.push(`Nominations closed ${fmt(w.close)} – set the ballot.`);
  if (e.status === 'planning' && today >= w.open) out.push(`Nominations should be open since ${fmt(w.open)}.`);
  const b = ballot(e);
  b.filter((s) => s.empty).forEach((s) => out.push(`${s.seat.label}: no accepted candidate.`));
  if (['ballot', 'voting', 'counting', 'certified'].includes(e.status) && !e.voters.frozenOn) out.push('The voter list is not frozen yet (Election Commission).');
  e.seats.filter((s) => !s.removed).forEach((s) => { const t = tally(e, s.key); if (t?.tie && !t.decided) out.push(`${s.label}: tie – ${e.rules.tieBreak === 'runoff' ? 'hold a run-off' : e.rules.tieBreak === 'drawing' ? 'decide by drawing lots' : 'the Commission decides'}.`); });
  if (e.status === 'counting' && e.seats.filter((s) => !s.removed).every((s) => e.results.find((r) => r.seatKey === s.key)?.winners.length)) out.push('Every seat is counted – certify the results.');
  if (e.status === 'certified' && !e.swornInOn) out.push(`Certified – swear the winners in on ${fmt(oathDay(e.year))} (they become the serving officials).`);
  return out;
}
/** Holders for Elected officials from the certified results (term from the oath rule; secretaries are not elected). */
export function holdersFromResults(e: Election, eid: string[] = []): Holder[] {
  const start = oathDay(e.year, eid); const end = oathDay(e.year + 2, eid);
  const out: Holder[] = [];
  for (const r of e.results) {
    const seat = e.seats.find((s) => s.key === r.seatKey); if (!seat || seat.removed) continue;
    for (const id of r.winners) {
      const n = e.nominations.find((x) => x.id === id); if (!n) continue;
      out.push({ id: `${seat.kind}-${e.year}-${n.id}`.slice(0, 60), kind: seat.kind as Kind, office: seat.office, zone: seat.zone, center: seat.center, zips: seat.zips, atLarge: seat.atLarge, name: n.name, memberId: n.memberId, publicEmail: '', how: 'elected', termStart: start, termEnd: end, oathOn: '', orientationOn: '', status: 'serving', vacancy: { reason: '', on: '' }, boardTerms: 0, showOnWebsite: true });
    }
  }
  return out;
}

/* ---------------- demo (fictional) ---------------- */
export const DEFAULT_ELECTION_RULES: ElectionRules = ElectionRulesSchema.parse({});
const Y = 2026;
const N = (id: string, seatKey: string, name: string, memberId: string, status: Nomination['status'], extra: Partial<Nomination> = {}): Nomination => ({ id, seatKey, memberId, name, nominatedBy: 'Faisal Haq', secondedBy: 'Sana Mirza', on: '2026-10-16', status, note: '', ...extra });
export const mockElections: ElectionsDoc = {
  rules: DEFAULT_ELECTION_RULES,
  elections: [{
    year: Y, electionDay: electionDay(Y), status: 'nominations', rules: DEFAULT_ELECTION_RULES,
    seats: [
      { key: 'officer:president', label: 'President', kind: 'officer', office: 'president', zone: '', center: '', zips: [], atLarge: '', places: 1, voters: 'all', removed: false },
      { key: 'officer:general-secretary', label: 'General Secretary', kind: 'officer', office: 'general-secretary', zone: '', center: '', zips: [], atLarge: '', places: 1, voters: 'all', removed: false },
      { key: 'zd:n', label: 'Zonal Director, North Zone', kind: 'zonal-director', office: '', zone: 'n', center: '', zips: [], atLarge: '', places: 1, voters: 'zone', removed: false },
      { key: 'zd:sw', label: 'Zonal Director, Southwest Zone', kind: 'zonal-director', office: '', zone: 'sw', center: '', zips: [], atLarge: '', places: 1, voters: 'zone', removed: false },
      { key: 'ad:Southeast Islamic Center 1', label: 'Associate Director, Southeast Islamic Center 1', kind: 'associate-director', office: '', zone: 'se', center: 'Southeast Islamic Center 1', zips: [], atLarge: '', places: 1, voters: 'center', removed: false },
      { key: 'ar:Southwest Islamic Center 1:77036', label: 'Area Representative, Southwest Islamic Center 1 – ZIP 77036', kind: 'area-rep', office: '', zone: 'sw', center: 'Southwest Islamic Center 1', zips: ['77036'], atLarge: '', places: 2, voters: 'zips', removed: false },
    ],
    nominations: [
      N('n-1', 'officer:president', 'Adnan Ansari', 'HOU-201334', 'accepted', { note: 'Long-standing member of Southwest Islamic Center 2.' }),
      N('n-2', 'officer:president', 'Huda Rahman', 'HOU-201412', 'accepted'),
      N('n-3', 'officer:general-secretary', 'Rashid Aziz', 'HOU-201128', 'accepted'),
      N('n-4', 'officer:general-secretary', 'Lubna Akram', '', 'nominated', { secondedBy: '' }),
      N('n-5', 'zd:n', 'Sara Aziz', 'HOU-200976', 'nominated'),
      N('n-6', 'zd:sw', 'Ahmed Abdullah', 'HOU-200341', 'accepted'),
      N('n-7', 'ar:Southwest Islamic Center 1:77036', 'Mustafa Abdullah', 'HOU-202426', 'accepted'),
      N('n-8', 'ar:Southwest Islamic Center 1:77036', 'Zaid Ibrahim', 'HOU-204387', 'accepted'),
      N('n-9', 'ar:Southwest Islamic Center 1:77036', 'Tariq Noor', '', 'declined', { note: 'Moving in January.' }),
    ],
    results: [],
    voters: { frozenOn: '', count: 0 }, certification: { by: '', on: '', note: '' }, swornInOn: '',
  }],
};
