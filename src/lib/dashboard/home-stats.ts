/**
 * The home dashboards' numbers (Overview, Command center), worked out from the records the admin already loads – the
 * members (with their dues payments and history), the work queues, the gifts and the membership settings. Demo mode
 * gets the demo records, live mode the API's – so a dashboard never shows numbers the records do not have.
 */
import { centerOf, eligibility, fullName, PLANS, statusOf, ZONES, type Member, type ZoneId } from '@/lib/members/members';
import type { Case, QueueState } from '@/lib/queues/queues';
import type { Donation, DonationSettings } from '@/lib/community/donations';
import type { MembershipSettings } from '@/lib/content/membership';
import { canRenew } from '@/lib/content/renewal';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = (iso: string) => iso.slice(0, 7);
const addMonths = (ymStr: string, n: number) => { const [y, m] = ymStr.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const addDays = (iso: string, n: number) => { const t = Date.parse(`${String(iso ?? '').slice(0, 10)}T12:00:00Z`); if (Number.isNaN(t)) return String(iso ?? ''); return new Date(t + n * 86_400_000).toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
export const ago = (iso: string, today: string) => { const d = daysBetween(iso, today); return d <= 0 ? 'today' : d === 1 ? '1 day' : d < 60 ? `${d} days` : `${Math.round(d / 30)} months`; };
const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

export type QueueRow = { id: string; memberId: string; name: string; plan: string; zone: string; status: 'New' | 'ID check' | 'Needs info' | 'Approved'; age: string; on: string };
export type Activity = { who: string; what: string; on: string; kind: 'member' | 'gift' | 'id' | 'office' };

export function homeStats(input: { members: Member[]; cases: Case[]; queue: QueueState; gifts: Donation[]; giving: DonationSettings; settings: MembershipSettings; today: string; year: number }) {
  const { today, year, settings } = input;
  const members = input.members.filter((m) => !m.archived);
  const status = (m: Member) => statusOf(m, year);
  const current = members.filter((m) => ['active', 'life'].includes(status(m)));
  const gifts = input.gifts.filter((g) => !g.refunded && g.at.slice(0, 10) <= today);   // nothing dated in the future
  const fundName = (id: string) => input.giving.funds.find((f) => f.id === id)?.name ?? (id ? id : 'Not assigned yet');

  /* the last 12 months, ending this month */
  const end = ym(today); const months = Array.from({ length: 12 }, (_, i) => addMonths(end, i - 11));
  const labels = months.map((x) => MON[Number(x.slice(5, 7)) - 1]);
  const dues = members.flatMap((m) => m.payments.filter((p) => p.paidOn.slice(0, 10) <= today).map((p) => ({ ...p, m })));
  const per = <T,>(list: T[], on: (x: T) => string | null | undefined, val: (x: T) => number = () => 1) => months.map((mo) => list.filter((x) => (on(x) ?? '').startsWith(mo)).reduce((s, x) => s + val(x), 0));
  // a renewal = dues from someone who had already paid before (a new member's first dues are not a renewal)
  const firstPaid = new Map(members.map((m) => [m.id, m.payments.reduce((a, p) => (!a || p.paidOn < a ? p.paidOn : a), '')]));
  const renewals = per(dues.filter((p) => p.paidOn !== firstPaid.get(p.m.id)), (p) => p.paidOn);
  const newMembers = per(members, (m) => m.approvedOn);
  const duesCents = per(dues, (p) => p.paidOn, (p) => p.amountCents);
  const giftCents = per(gifts, (g) => g.at, (g) => g.amountCents);
  const money = months.map((_, i) => duesCents[i] + giftCents[i]);
  const priorMoney = (() => { const prev = months.map((mo) => addMonths(mo, -12)); return prev.reduce((s, mo) => s + dues.filter((p) => p.paidOn.startsWith(mo)).reduce((a, p) => a + p.amountCents, 0) + gifts.filter((g) => g.at.startsWith(mo)).reduce((a, g) => a + g.amountCents, 0), 0); })();

  /* members: total over the year (approved by each month's end), by zone, by masjid, growth */
  const currentSpark = months.map((mo) => current.filter((m) => (m.approvedOn ?? '9999') <= `${mo}-31`).length);
  const zoneIds = Object.keys(ZONES) as ZoneId[];
  const zones = zoneIds.map((z) => ({ f: ZONES[z], v: current.filter((m) => m.zone === z).length })).filter((z) => z.v > 0).sort((a, b) => b.v - a.v);
  const byCenter = new Map<string, number>(); current.forEach((m) => { const c = centerOf(m); if (c) byCenter.set(c, (byCenter.get(c) ?? 0) + 1); });
  const busiestCenter = [...byCenter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const grow = zoneIds.map((z) => { const now = members.filter((m) => m.zone === z && m.approvedOn?.startsWith(String(year))).length; const was = members.filter((m) => m.zone === z && m.approvedOn?.startsWith(String(year - 1))).length; return { z: ZONES[z], now, was, pct: change(now, was) }; })
    .filter((g) => g.now > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || b.now - a.now)[0] ?? null;

  /* work queues */
  const open = (c: Case) => input.queue.decisions[c.id]?.state !== 'done';
  const byId = new Map(members.map((m) => [m.id, m]));
  const apps = input.cases.filter((c) => c.queue === 'applications');
  const centerWaiting = input.cases.filter((c) => c.queue === 'center' && open(c)).length;
  const idWaiting = input.cases.filter((c) => c.queue === 'id' && open(c)).length;
  const queueRows: QueueRow[] = apps.flatMap<QueueRow>((c) => { const m = byId.get(c.memberId); if (!m) return [];
    const d = input.queue.decisions[c.id]; const st: QueueRow['status'] = d?.state === 'needs-info' ? 'Needs info' : m.idCheck === 'pending' ? 'ID check' : 'New';
    return open(c) ? [{ id: c.id, memberId: m.id, name: `${m.first} ${m.last.slice(0, 1)}.`, plan: PLANS[m.plan]?.name ?? m.plan, zone: ZONES[m.zone] ?? m.zone, status: st, age: ago(c.submitted, today), on: c.submitted }] : []; })
    .concat(members.filter((m) => m.approvedOn && daysBetween(m.approvedOn, today) <= 7).map((m) => ({ id: `ok-${m.id}`, memberId: m.id, name: `${m.first} ${m.last.slice(0, 1)}.`, plan: PLANS[m.plan]?.name ?? m.plan, zone: ZONES[m.zone] ?? m.zone, status: 'Approved' as const, age: ago(m.approvedOn!, today), on: m.approvedOn! })))
    .sort((a, b) => b.on.localeCompare(a.on));
  // started joining but did not finish = not an application yet (Work queues › Incomplete applications)
  const unfinished = members.filter((m) => m.joinStage === 'incomplete' && !m.archived);
  const pending = members.filter((m) => status(m) === 'pending' && m.joinStage !== 'incomplete').length;

  /* KPIs */
  const approvedRecently = members.filter((m) => m.approvedOn && m.appliedOn && daysBetween(m.approvedOn, today) <= 365 && daysBetween(m.appliedOn, m.approvedOn) >= 0);
  const avgApprovalDays = approvedRecently.length ? approvedRecently.reduce((s, m) => s + daysBetween(m.appliedOn, m.approvedOn!), 0) / approvedRecently.length : null;
  const inLast = (iso: string, from: number, to: number) => { const d = daysBetween(iso, today); return d >= from && d < to; };
  const renewWeek = dues.filter((p) => inLast(p.paidOn, 0, 7)).length; const renewPrevWeek = dues.filter((p) => inLast(p.paidOn, 7, 14)).length;
  const votingYear = Number(settings.recordDate.slice(0, 4)) || year;
  const voters = current.filter((m) => eligibility(m, votingYear, settings.plans, settings.rules).eligible).length;
  const appsThisMonth = members.filter((m) => m.appliedOn.startsWith(end)).length; const appsLastMonth = members.filter((m) => m.appliedOn.startsWith(addMonths(end, -1))).length;

  /* giving */
  const thisYearGifts = gifts.filter((g) => g.at.startsWith(String(year)));
  const fundTotals = new Map<string, number>(); thisYearGifts.forEach((g) => fundTotals.set(fundName(g.fund), (fundTotals.get(fundName(g.fund)) ?? 0) + g.amountCents));
  const fundList = [...fundTotals.entries()].sort((a, b) => b[1] - a[1]);
  const funds = (fundList.length > 4 ? [...fundList.slice(0, 3), ['Other funds', fundList.slice(3).reduce((s, [, v]) => s + v, 0)] as [string, number]] : fundList).map(([f, v]) => ({ f, v: Math.round(v / 100) }));
  const giving6 = months.slice(6).map((mo, i) => ({ label: labels[i + 6], cents: gifts.filter((g) => g.at.startsWith(mo)).reduce((s, g) => s + g.amountCents, 0) }));

  /* the application pipeline: everyone who applied in the last 90 days, how far they got */
  const recentApps = members.filter((m) => daysBetween(m.appliedOn, today) <= 90 && m.joinStage !== 'incomplete');
  const pipeline = [
    { s: 'Applied', n: recentApps.length },
    { s: 'Dues paid', n: recentApps.filter((m) => m.payments.length > 0).length },
    { s: 'Photo ID checked', n: recentApps.filter((m) => m.idCheck === 'verified').length },
    { s: 'Approved', n: recentApps.filter((m) => !!m.approvedOn).length },
  ];

  /* newest members and what happened lately */
  const newest = [...members].filter((m) => m.approvedOn || (status(m) === 'pending' && m.joinStage !== 'incomplete')).sort((a, b) => (b.approvedOn ?? b.appliedOn).localeCompare(a.approvedOn ?? a.appliedOn)).slice(0, 5).map((m) => {
    const last = [...m.payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn))[0];
    const st = status(m); return { id: m.id, name: fullName(m), initials: `${m.first[0] ?? ''}${m.last[0] ?? ''}`, plan: PLANS[m.plan]?.name ?? m.plan, zone: ZONES[m.zone] ?? m.zone,
      status: st === 'pending' ? (m.idCheck === 'pending' ? 'ID check' : 'Board review') : st === 'life' ? 'Life' : 'Active', amountCents: last?.amountCents ?? 0, when: ago(m.approvedOn ?? m.appliedOn, today) };
  });
  const activity: Activity[] = [
    ...members.flatMap((m) => (m.audit ?? []).slice(-3).map((a) => ({ who: fullName(m), what: a.action.charAt(0).toLowerCase() + a.action.slice(1), on: a.at, kind: (/id/i.test(a.action) ? 'id' : 'member') as Activity['kind'] }))),
    ...gifts.slice(0, 40).map((g) => ({ who: g.donor.anonymous ? 'Anonymous' : g.donor.name, what: `gave ${(g.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} – ${fundName(g.fund)}`, on: g.at, kind: 'gift' as const })),
  ].filter((a) => a.on && a.on.slice(0, 10) <= today).sort((a, b) => b.on.localeCompare(a.on)).slice(0, 6);

  /* key dates from the settings: the record date, when renewals open, when this year's memberships end */
  const calendarPlan = settings.plans.find((p) => p.term === 'calendar_year' && p.visible) ?? settings.plans.find((p) => p.term === 'calendar_year');
  const yearEnd = `${year}-12-31`;
  const opens = calendarPlan ? canRenew(calendarPlan, yearEnd, today, settings.lifecycle).opensOn ?? null : null;
  const recordDate = settings.recordDate.slice(0, 10);

  /* suggestions from the records */
  const paidThisNotNext = current.filter((m) => m.payments.some((p) => p.year === year) && !m.payments.some((p) => p.year === votingYear) && votingYear > year).length;
  const suggestions = [
    paidThisNotNext ? `${paidThisNotNext.toLocaleString('en-US')} members paid for ${year} but not yet for ${votingYear} – a renewal reminder before ${recordDate.slice(5, 7)}/${recordDate.slice(8, 10)} keeps their vote.` : '',
    unfinished.length ? `${unfinished.length.toLocaleString('en-US')} ${unfinished.length === 1 ? 'person' : 'people'} started joining but did not finish – Work queues › Incomplete applications shows where each one stopped.` : '',
    idWaiting ? `${idWaiting.toLocaleString('en-US')} photo ID${idWaiting === 1 ? '' : 's'} waiting to be checked.` : '',
    centerWaiting ? `${centerWaiting} masjid-change request${centerWaiting === 1 ? '' : 's'} waiting.` : '',
    grow?.pct && grow.pct > 0 ? `${grow.z} zone: ${grow.now} new members in ${year} (${grow.pct > 0 ? '+' : ''}${grow.pct}% on ${year - 1}).` : '',
  ].filter(Boolean);

  return {
    labels, renewals, newMembers, money, moneyChange: change(money.reduce((a, b) => a + b, 0), priorMoney), giving6, funds,
    current: current.length, currentSpark, currentChange: change(current.length, currentSpark[0]), zones, busiestCenter, grow, centerWaiting, idWaiting,
    queueRows, pending, appsThisMonth, appsLastMonth, appsSpark: per(members, (m) => m.appliedOn),
    avgApprovalDays, renewWeek, renewPrevWeek, renewMonth: renewals[11], votingYear, voters, votersPct: current.length ? Math.round((voters / current.length) * 100) : 0,
    givingMonth: giftCents[11], givingPrevMonth: giftCents[10], feesMonth: duesCents[11], feesPrevMonth: duesCents[10], pipeline, newest, activity, suggestions,
    dates: { recordDate, opens, yearEnd, daysTo: (iso: string) => Math.max(0, daysBetween(today, iso)) },
    peak: renewals.indexOf(Math.max(...renewals)), nextWeek: addDays(today, 7),
  };
}
export type HomeStats = ReturnType<typeof homeStats>;
