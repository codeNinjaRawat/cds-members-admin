/**
 * A9 Reports + voter list snapshot. Pure functions over member records – the BE (B9) runs the same ones in SQL/TS.
 *   membershipSummary – status, plan, zone; new members by month; renewal rate year over year
 *   duesReport        – dues collected by month / method / plan, on time (by the record date) vs late, not renewed
 *   voterSnapshot     – the frozen list of eligible voters on the record date (Bylaws Art. I §2), with a fingerprint
 *   nonVoters         – everyone approved but not eligible, with the first reason (for appeals and outreach)
 *   diffSnapshots     – who was added / removed between two versions (every correction needs a reason)
 *   areaReps          – Area Representatives: one per 40 eligible voters in a ZIP area of a center (Art. II)
 *   candidates        – years in good standing: Board ≥ 1, President / Vice President ≥ 2 (Art. VII)
 *   eventsReport      – registrations, fill rate, waitlists
 * Privacy: voter lists carry ID, name, zone and center only – never birth dates, phones or emails.
 */
import type { EventsDoc } from '@/lib/community/events';
import { csvCell } from '@/lib/community/member-records';
import { PLANS, STATUS_LABEL, ZONES, centerOf, eligibility, fullName, recordDate, statusOf, type Member, type Status, type ZoneId } from '@/lib/members/members';

export type Pt = { label: string; value: number };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const live = (list: Member[]) => list.filter((m) => !m.archived);

/* ---------- membership ---------- */
export function membershipSummary(list: Member[], year: number, today: string) {
  const ms = live(list);
  const byStatus = Object.fromEntries((Object.keys(STATUS_LABEL) as Status[]).filter((s) => s !== 'archived').map((s) => [s, 0])) as Record<Status, number>;
  for (const m of ms) byStatus[statusOf(m, year)]++;
  const byPlan = (Object.keys(PLANS) as (keyof typeof PLANS)[]).map((p) => ({ label: PLANS[p].name, value: ms.filter((m) => m.plan === p).length }));
  const byZone = (Object.keys(ZONES) as ZoneId[]).map((z) => {
    const inZone = ms.filter((m) => m.zone === z);
    return { zone: ZONES[z], members: inZone.length, active: inZone.filter((m) => ['active', 'life'].includes(statusOf(m, year))).length, voters: inZone.filter((m) => eligibility(m, year).eligible).length };
  });
  // new members by month: the 12 months up to today (approval date)
  const [ty, tm] = today.split('-').map(Number);
  const newByMonth: Pt[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(ty, tm - 1 - (11 - i), 1)); const key = d.toISOString().slice(0, 7);
    return { label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, value: ms.filter((m) => m.approvedOn?.startsWith(key)).length };
  });
  const paid = (m: Member, y: number) => m.plan !== 'life' && m.payments.some((p) => p.year === y);
  const prev = ms.filter((m) => paid(m, year - 1));
  const renewed = prev.filter((m) => paid(m, year));
  return { total: ms.length, byStatus, byPlan, byZone, newByMonth, renewal: { prev: prev.length, renewed: renewed.length, rate: prev.length ? renewed.length / prev.length : 0 } };
}

/* ---------- dues ---------- */
export function duesReport(list: Member[], year: number) {
  const rd = recordDate(year);
  const pays = live(list).flatMap((m) => m.payments.filter((p) => p.year === year).map((p) => ({ m, p })));
  const sum = (xs: typeof pays) => xs.reduce((n, x) => n + x.p.amountCents, 0);
  const byMonth: Pt[] = MONTHS.map((label, i) => ({ label, value: sum(pays.filter((x) => x.p.paidOn.slice(0, 7) === `${year}-${String(i + 1).padStart(2, '0')}`)) }));
  const byMethod = (['card', 'check', 'cash'] as const).map((k) => ({ label: k === 'card' ? 'Card' : k === 'check' ? 'Check' : 'Cash', value: sum(pays.filter((x) => x.p.method === k)), count: pays.filter((x) => x.p.method === k).length }));
  const byPlan = (Object.keys(PLANS) as (keyof typeof PLANS)[]).map((k) => ({ label: PLANS[k].name, value: sum(pays.filter((x) => x.m.plan === k)), count: pays.filter((x) => x.m.plan === k).length }));
  const onTime = pays.filter((x) => x.p.paidOn <= rd), late = pays.filter((x) => x.p.paidOn > rd);
  const notRenewed = live(list).filter((m) => m.plan !== 'life' && m.standing === 'good' && m.approvedOn && m.payments.some((p) => p.year === year - 1) && !m.payments.some((p) => p.year === year));
  return {
    collectedCents: sum(pays), count: pays.length, byMonth, byMethod, byPlan,
    onTime: { count: onTime.length, cents: sum(onTime) }, late: { count: late.length, cents: sum(late) },
    paidByOther: pays.filter((x) => x.p.payer === 'other').length,
    notRenewed: notRenewed.map((m) => ({ id: m.id, name: fullName(m), zone: ZONES[m.zone], center: centerOf(m), phone: m.phone, email: m.email })),
  };
}

/* ---------- voter list ---------- */
export type VoterRow = { id: string; name: string; zone: string; center: string };
export type Snapshot = { year: number; recordDate: string; version: number; takenAt: string; takenBy: string; reason: string; rows: VoterRow[]; fingerprint: string };
/** SHA-256 of the sorted member IDs – anyone can recompute it to prove the list was not changed afterwards. */
export async function fingerprint(ids: string[]): Promise<string> {
  const data = new TextEncoder().encode([...ids].sort().join('\n'));
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** Eligible voters whose Board approval came after the record date – the Election Commission decides on these. */
export const approvedAfterRecord = (list: Member[], year: number) => live(list).filter((m) => eligibility(m, year).eligible && m.approvedOn && m.approvedOn > recordDate(year)).map((m) => ({ id: m.id, name: fullName(m), approvedOn: m.approvedOn! }));
export const voterRows = (list: Member[], year: number): VoterRow[] =>
  live(list).filter((m) => eligibility(m, year).eligible).map((m) => ({ id: m.id, name: fullName(m), zone: ZONES[m.zone], center: centerOf(m) }))
    .sort((a, b) => a.zone.localeCompare(b.zone) || a.center.localeCompare(b.center) || a.name.localeCompare(b.name));
export async function voterSnapshot(list: Member[], year: number, by: string, at: string, previous: Snapshot[] = [], reason = ''): Promise<Snapshot> {
  const rows = voterRows(list, year);
  const version = previous.filter((s) => s.year === year).length + 1;
  if (version > 1 && reason.trim().length < 10) throw new Error('A new version of the voter list needs a reason (at least 10 characters).');
  return { year, recordDate: recordDate(year), version, takenAt: at, takenBy: by, reason: version === 1 ? 'First snapshot after the record date' : reason.trim(), rows, fingerprint: await fingerprint(rows.map((r) => r.id)) };
}
export function diffSnapshots(a: Snapshot, b: Snapshot) {
  const A = new Set(a.rows.map((r) => r.id)), B = new Set(b.rows.map((r) => r.id));
  return { added: b.rows.filter((r) => !A.has(r.id)), removed: a.rows.filter((r) => !B.has(r.id)) };
}
export const countBy = <K extends keyof VoterRow>(rows: VoterRow[], k: K) =>
  Object.entries(rows.reduce<Record<string, number>>((o, r) => ((o[r[k]] = (o[r[k]] ?? 0) + 1), o), {})).sort((x, y) => y[1] - x[1]).map(([label, value]) => ({ label, value }));
/** Approved members in good standing who cannot vote – with the first rule they miss (appeals, outreach before next year). */
export function nonVoters(list: Member[], year: number) {
  return live(list).filter((m) => m.approvedOn && m.standing === 'good').map((m) => ({ m, e: eligibility(m, year) })).filter((x) => !x.e.eligible)
    .map(({ m, e }) => { const c = e.checks.find((x) => !x.ok)!; return { id: m.id, name: fullName(m), zone: ZONES[m.zone], center: centerOf(m), rule: c.label, reason: c.reason }; });
}

/* ---------- Area Representatives ---------- */
/** Bylaws Art. II: one Area Representative per 40 eligible voting members in a ZIP area of a center. Rounding is the Election Commission's call. */
export function areaReps(list: Member[], year: number, ratio = 40, rounding: 'down' | 'up' = 'down') {
  const map = new Map<string, { center: string; zone: string; zip: string; voters: number }>();
  for (const m of live(list)) if (eligibility(m, year).eligible) {
    const key = `${centerOf(m)}|${m.zip}`;
    const cur = map.get(key) ?? { center: centerOf(m), zone: ZONES[m.zone], zip: m.zip, voters: 0 };
    cur.voters++; map.set(key, cur);
  }
  const rows = [...map.values()].map((r) => ({ ...r, reps: rounding === 'down' ? Math.floor(r.voters / ratio) : Math.ceil(r.voters / ratio), toNext: ratio - (r.voters % ratio || ratio) }))
    .sort((a, b) => a.zone.localeCompare(b.zone) || a.center.localeCompare(b.center) || a.zip.localeCompare(b.zip));
  const byCenter = Object.values(rows.reduce<Record<string, { center: string; zone: string; voters: number; reps: number }>>((o, r) => {
    o[r.center] ??= { center: r.center, zone: r.zone, voters: 0, reps: 0 }; o[r.center].voters += r.voters; o[r.center].reps += r.reps; return o;
  }, {})).sort((a, b) => a.zone.localeCompare(b.zone) || a.center.localeCompare(b.center));
  return { rows, byCenter, totalReps: rows.reduce((n, r) => n + r.reps, 0), totalVoters: rows.reduce((n, r) => n + r.voters, 0) };
}

/* ---------- candidates ---------- */
/** Years in a row (before the election year) the member was an eligible voter. */
export function standingYears(m: Member, year: number, earliest = 2000) {
  let n = 0;
  for (let y = year - 1; y >= earliest; y--) { if (eligibility(m, y).eligible && !!m.approvedOn && m.approvedOn <= recordDate(y)) n++; else break; } // a year counts only if already approved by that record date
  return n;
}
/** Board seats need ≥ 1 year in good standing, President / Vice President ≥ 2 (Art. VII). Citizenship / residency is checked by the Election Commission on paper. */
export function candidates(list: Member[], year: number) {
  return live(list).filter((m) => eligibility(m, year).eligible).map((m) => {
    const yrs = standingYears(m, year, Math.max(2000, m.joined));
    return { id: m.id, name: fullName(m), zone: ZONES[m.zone], center: centerOf(m), years: yrs, board: yrs >= 1, officer: yrs >= 2 };
  }).sort((a, b) => b.years - a.years || a.name.localeCompare(b.name));
}

/* ---------- events ---------- */
export function eventsReport(doc: EventsDoc | null, now: string) {
  return (doc?.events ?? []).filter((e) => e.status !== 'draft' && e.registration.enabled).map((e) => {
    const cap = e.registration.capacity; const minPrice = Math.min(...e.registration.types.filter((t) => t.enabled).map((t) => t.priceCents));
    return { id: e.id, title: e.title, date: e.start.slice(0, 10), past: e.end < now, registered: e.registered, capacity: cap, fill: cap ? e.registered / cap : null, waiting: e.waiting, estCents: Number.isFinite(minPrice) ? minPrice * e.registered : 0, status: e.status };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- CSV ---------- */
export const csvOf = (head: string[], rows: (string | number)[][]) => [head.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
