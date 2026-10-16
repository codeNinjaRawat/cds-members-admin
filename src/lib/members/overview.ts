/**
 * Members overview – every number the dashboard shows, computed in one pure function (white-box tested).
 * DEMO: runs over the browser's member list. Live: GET /admin/members/overview?zone= returns the same shape
 * (server side, inside the admin's zone scope – BE/memory/api-contract-reports.md).
 */
import { ageOn, eligibility, PLANS, statusOf, YEAR, ZONES, type Member, type PlanId, type Status, type ZoneId } from './members';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const AGE_BANDS = ['18–29', '30–39', '40–49', '50–59', '60–69', '70+'] as const;
export type Overview = {
  total: number; joinedThisYear: number; voters: number; pending: number;
  renewal: { renewed: number; due: number };
  duesCents: number; duesLastYearSameDate: number;
  /** Dues payments received in each calendar month, this year and last year. Future months are null. */
  monthly: { year: number; counts: (number | null)[] }[];
  cumulativeCents: number[];
  plans: { id: PlanId; label: string; count: number }[];
  methods: { id: 'card' | 'check' | 'cash'; label: string; count: number }[];
  zones: { id: ZoneId; label: string; voters: number; others: number }[];
  ages: { band: (typeof AGE_BANDS)[number]; count: number }[];
  joins: { year: number; count: number }[];
  statuses: { id: Status; label: string; count: number }[];
};

const band = (age: number): (typeof AGE_BANDS)[number] => (age < 30 ? '18–29' : age < 40 ? '30–39' : age < 50 ? '40–49' : age < 60 ? '50–59' : age < 70 ? '60–69' : '70+');

export function memberOverview(all: Member[], opts: { today: string; zone?: ZoneId | '' }): Overview {
  const { today } = opts;
  const list = all.filter((m) => !m.archived && (!opts.zone || m.zone === opts.zone));
  const rows = list.map((m) => ({ m, status: statusOf(m), vote: eligibility(m) }));
  const current = rows.filter((r) => r.status !== 'resigned' && r.status !== 'expelled');
  const month = Number(today.slice(5, 7));
  const sameDateLastYear = `${YEAR - 1}${today.slice(4)}`;

  const pays = list.flatMap((m) => m.payments);
  const thisYear = pays.filter((p) => p.year === YEAR && p.paidOn <= today);
  const monthly = [YEAR - 1, YEAR].map((y) => ({
    year: y,
    counts: MONTHS.map((_, i) => (y === YEAR && i + 1 > month ? null : pays.filter((p) => p.paidOn.startsWith(`${y}-${String(i + 1).padStart(2, '0')}`) && p.paidOn <= today).length)),
  }));
  let run = 0;
  const cumulativeCents = MONTHS.slice(0, month).map((_, i) => (run += thisYear.filter((p) => Number(p.paidOn.slice(5, 7)) === i + 1 && p.paidOn.startsWith(String(YEAR))).reduce((s, p) => s + p.amountCents, 0)));

  // Due to renew: approved, in good standing, not Life, not pending.
  const due = current.filter((r) => r.m.plan !== 'life' && r.m.approvedOn && r.m.standing === 'good');
  const joinsFrom = YEAR - 14;
  const statusOrder: Status[] = ['active', 'life', 'expired', 'pending'];
  return {
    total: current.length,
    joinedThisYear: current.filter((r) => r.m.joined === YEAR).length,
    voters: rows.filter((r) => r.vote.eligible).length,
    pending: rows.filter((r) => r.status === 'pending').length,
    renewal: { renewed: due.filter((r) => r.m.payments.some((p) => p.year === YEAR)).length, due: due.length },
    duesCents: thisYear.reduce((s, p) => s + p.amountCents, 0),
    duesLastYearSameDate: pays.filter((p) => p.year === YEAR - 1 && p.paidOn <= sameDateLastYear).reduce((s, p) => s + p.amountCents, 0),
    monthly, cumulativeCents,
    plans: (Object.keys(PLANS) as PlanId[]).map((id) => ({ id, label: PLANS[id].name, count: current.filter((r) => r.m.plan === id).length })),
    methods: (['card', 'check', 'cash'] as const).map((id) => ({ id, label: id === 'card' ? 'Card' : id === 'check' ? 'Check' : 'Cash', count: thisYear.filter((p) => p.method === id).length })),
    zones: (Object.keys(ZONES) as ZoneId[]).map((id) => {
      const z = current.filter((r) => r.m.zone === id);
      return { id, label: ZONES[id], voters: z.filter((r) => r.vote.eligible).length, others: z.filter((r) => !r.vote.eligible).length };
    }),
    ages: AGE_BANDS.map((b) => ({ band: b, count: current.filter((r) => band(ageOn(r.m.dob, today)) === b).length })),
    joins: Array.from({ length: YEAR - joinsFrom + 1 }, (_, i) => joinsFrom + i).map((y) => ({ year: y, count: current.filter((r) => r.m.joined === y).length })),
    statuses: statusOrder.map((id) => ({ id, label: id === 'expired' ? 'Not renewed' : id === 'pending' ? 'Pending approval' : id === 'life' ? 'Life' : 'Active', count: current.filter((r) => r.status === id).length })),
  };
}

/** Axis top, rounded so 0 · half · top are clean numbers (e.g. 66 → 80 with ticks 40 / 80). */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)); const f = v / p;
  return ([1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((c) => f <= c) ?? 10) * p;
}
export const compact = (v: number) => (v >= 10000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '')}K` : v.toLocaleString('en-US'));
export const money = (cents: number) => { const d = cents / 100; return d >= 10000 ? `$${compact(Math.round(d))}` : d.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); };
