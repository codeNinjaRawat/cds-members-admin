'use client';
/**
 * A dashboard as the first page of every menu that did not have one: Work queues, Communication, Masjids and zones,
 * Events, Meetings and minutes, Elections, Website. Same frame everywhere (DashKit): filters that apply to that module,
 * headline numbers, two charts with a table view, what needs attention, the full report, Download CSV and Print.
 * DEMO data (no API). Live: GET /admin/<module>/dashboard?period=&zone=&masjid= returns the same numbers.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Attention, DashBar, DashPage, downloadCsv, inPeriod, PERIODS, FUTURE, todayCT, useScope } from '@/components/charts/DashKit';
import { ChartCard, Columns, ShareBar, StackedBars, StatTile } from '@/components/charts/Charts';
import { centerOf, eligibility, prefsOf, recordDate, statusOf, YEAR, ZONES, type Member, type ZoneId } from '@/lib/members/members';
import { useMembers } from './MembersView';
import { allCases, useQueueState } from './QueuesView';
import { QUEUES, daysWaiting, isOpen, sla } from '@/lib/queues/queues';
import { holdersAt, SEATS, useOrg } from './TeamViews';
import { centerForZip, structureWarnings, unservedZips } from '@/lib/community/org-structure';
import { AccessSchema, mockAccess, type AccessDoc } from '@/lib/access/access';
import { EventsSchema, mockEvents, type EventsDoc, CATEGORY_LABEL } from '@/lib/community/events';
import { eventWarnings, mockEventHistory, eventStats } from '@/lib/community/event-ops';
import { useMeetings } from '@/lib/minutes/use-meetings';
import { BODIES, calendarWarnings, quorumMet } from '@/lib/community/minutes';
import { electionDay } from '@/lib/community/officials';
import { DOC_KEYS, REGISTRY, type DocKey } from '@/lib/store/registry';

const n = (v: number) => v.toLocaleString('en-US');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtD = (s: string) => (s ? `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}` : '');
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
function useStore<T>(key: string, parse: (x: unknown) => T | null, fallback: T): T {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => { void fetch(`/api/store/${key}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = parse(j?.data); if (p) setV(p); }).catch(() => undefined); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}
const byId = (members: Member[]) => new Map(members.map((m) => [m.id, m]));

/* ================= Work queues ================= */
export function QueuesDashboard() {
  const s = useScope('90d');
  const members = useMembers() ?? [];
  const qs = useQueueState();
  const who = useMemo(() => byId(members), [members]);
  const cases = allCases().filter((c) => { const m = who.get(c.memberId); return !!m && s.keep(m.zone, centerOf(m), m.zip) && inPeriod(c.submitted, s.period, '2026-10-13'); });
  const open = cases.filter((c) => isOpen(c, qs));
  const late = open.filter((c) => sla(c).tone === 'late');
  const decided = cases.length - open.length;
  const oldest = [...open].sort((a, b) => daysWaiting(b) - daysWaiting(a));
  const buckets = [['0–2 days', 0, 2], ['3–7 days', 3, 7], ['8–14 days', 8, 14], ['15–30 days', 15, 30], ['Over 30 days', 31, 9999]] as const;
  const exp = () => downloadCsv('work-queues', ['Case', 'Queue', 'Member ID', 'Zone', 'Masjid', 'Submitted', 'Days waiting', 'Target days', 'State'],
    open.map((c) => { const m = who.get(c.memberId)!; const t = sla(c); return [c.id, QUEUES.find((q) => q.id === c.queue)!.label, c.memberId, ZONES[m.zone], centerOf(m), fmtD(c.submitted), t.days, t.target, t.tone === 'late' ? 'Past target' : t.tone === 'due' ? 'Due' : 'On time']; }));
  return (
    <DashPage title="Work queues dashboard" intro={<>{s.label} · cases sent in during the {PERIODS[s.period].toLowerCase()} · demo data</>}
      bar={<DashBar s={s} show={{ period: 'past', zone: true, masjid: true }} report={{ href: '/queues?tab=applications', label: 'Open the queues' }} onExport={exp} />}>
      <div className="mo-kpis">
        <StatTile id="open" hero label="Open cases" value={n(open.length)} note={`${n(cases.length)} came in · ${n(decided)} decided`} meter={{ value: decided, of: Math.max(1, cases.length) }} />
        <StatTile id="late" label="Past their target" value={n(late.length)} note={`${pct(late.length, open.length)}% of open cases`} tone={late.length ? 'down' : undefined} />
        <StatTile id="oldest" label="Oldest waiting" value={oldest[0] ? `${daysWaiting(oldest[0])} days` : '—'} note={oldest[0] ? QUEUES.find((q) => q.id === oldest[0].queue)!.label : 'nothing open'} />
        <StatTile id="photo" label="Photo IDs to check" value={n(open.filter((c) => c.queue === 'id').length)} note="voters need them before June 30" />
      </div>
      <ChartCard id="q-by" className="mo-wide" title="Open cases by queue" note="On time, due today or tomorrow, and past the target each queue promises."
        table={{ head: ['Queue', 'On time', 'Due', 'Past target'], rows: QUEUES.map((q) => { const l = open.filter((c) => c.queue === q.id); return [q.label, l.filter((c) => sla(c).tone === 'ok').length, l.filter((c) => sla(c).tone === 'due').length, l.filter((c) => sla(c).tone === 'late').length]; }) }}>
        <StackedBars label="Open cases by queue" parts={[{ name: 'On time', slot: 1 }, { name: 'Due today or tomorrow', slot: 4 }, { name: 'Past target', slot: 2 }]}
          rows={QUEUES.map((q) => { const l = open.filter((c) => c.queue === q.id); return { id: q.id, label: q.label, values: [l.filter((c) => sla(c).tone === 'ok').length, l.filter((c) => sla(c).tone === 'due').length, l.filter((c) => sla(c).tone === 'late').length] }; })} />
      </ChartCard>
      <Attention items={oldest.slice(0, 6).map((c) => ({ text: <><b>{QUEUES.find((q) => q.id === c.queue)!.short}</b> · {c.memberId} · waiting {daysWaiting(c)} days</>, href: `/queues?tab=${c.queue}`, tone: sla(c).tone === 'late' ? 'stop' : 'look' }))} title="Oldest first" empty="Nothing waiting. Alhamdulillah." />
      <ChartCard id="q-age" className="mo-half" title="How long cases wait" note="Open cases by days since they came in."
        table={{ head: ['Waiting', 'Cases'], rows: buckets.map(([l, a, b]) => [l, open.filter((c) => daysWaiting(c) >= a && daysWaiting(c) <= b).length]) }}>
        <Columns label="Open cases by waiting time" items={buckets.map(([l, a, b]) => ({ label: l, value: open.filter((c) => daysWaiting(c) >= a && daysWaiting(c) <= b).length }))} />
      </ChartCard>
      <ChartCard id="q-zone" className="mo-half" title="Open cases by zone" table={{ head: ['Zone', 'Open'], rows: (Object.keys(ZONES) as ZoneId[]).map((z) => [ZONES[z], open.filter((c) => who.get(c.memberId)?.zone === z).length]) }}>
        <Columns label="Open cases by zone" ramp={false} items={(Object.keys(ZONES) as ZoneId[]).filter((z) => !s.zone || z === s.zone).map((z) => ({ label: ZONES[z], value: open.filter((c) => who.get(c.memberId)?.zone === z).length }))} />
      </ChartCard>
    </DashPage>
  );
}

/* ================= Communication ================= */
const SENDS = [ // demo delivery results (live: GET /admin/messages/stats)
  { on: '2026-10-14', what: 'Renewal reminder 1', kind: 'Automatic', to: 1840, delivered: 1812, opened: 1105 },
  { on: '2026-10-12', what: 'Monthly newsletter (October)', kind: 'Sent by staff', to: 4102, delivered: 4066, opened: 1952 },
  { on: '2026-10-12', what: 'Event reminder – Weekend school open house', kind: 'Automatic', to: 96, delivered: 96, opened: 71 },
  { on: '2026-09-28', what: 'Zakat appeal', kind: 'Sent by staff', to: 3980, delivered: 3921, opened: 1490 },
  { on: '2026-09-12', what: 'Monthly newsletter (September)', kind: 'Sent by staff', to: 4060, delivered: 4019, opened: 1888 },
  { on: '2026-08-15', what: 'Annual General Meeting notice', kind: 'Sent by staff', to: 4012, delivered: 3990, opened: 2394 },
  { on: '2026-06-20', what: 'Last call: pay by June 30 to vote', kind: 'Sent by staff', to: 1310, delivered: 1301, opened: 949 },
  { on: '2026-05-01', what: 'Renewal reminder 2', kind: 'Automatic', to: 1652, delivered: 1630, opened: 912 },
];
export function CommsDashboard() {
  const s = useScope('90d');
  const members = (useMembers() ?? []).filter((m) => !m.archived && s.keep(m.zone, centerOf(m), m.zip));
  const sends = SENDS.filter((x) => inPeriod(x.on, s.period));
  const sum = (k: 'to' | 'delivered' | 'opened') => sends.reduce((a, x) => a + x[k], 0);
  const prefs = members.map(prefsOf);
  const reach = [
    { id: 'email', label: 'Get email', value: prefs.filter((p) => p.email).length },
    { id: 'sms', label: 'Allow texts', value: prefs.filter((p) => p.sms).length },
    { id: 'none', label: 'No email (mail or phone only)', value: prefs.filter((p) => !p.email).length },
  ];
  const exp = () => downloadCsv('messages', ['Sent', 'Message', 'Kind', 'To', 'Delivered', 'Opened', 'Open rate'], sends.map((x) => [fmtD(x.on), x.what, x.kind, x.to, x.delivered, x.opened, `${pct(x.opened, x.delivered)}%`]));
  return (
    <DashPage title="Communication dashboard" intro={<>{s.label} · {PERIODS[s.period].toLowerCase()} · demo data</>}
      bar={<DashBar s={s} show={{ period: 'past', zone: true, masjid: true }} report={{ href: '/communication?tab=log', label: 'Delivery log' }} onExport={exp} />}>
      <div className="mo-kpis">
        <StatTile id="sent" hero label="Messages sent" value={n(sends.length)} note={`${n(sum('to'))} emails in all`} />
        <StatTile id="deliv" label="Delivered" value={`${pct(sum('delivered'), sum('to'))}%`} meter={{ value: sum('delivered'), of: Math.max(1, sum('to')) }} note={`${n(sum('to') - sum('delivered'))} bounced`} />
        <StatTile id="open" label="Opened" value={`${pct(sum('opened'), sum('delivered'))}%`} meter={{ value: sum('opened'), of: Math.max(1, sum('delivered')) }} note="of delivered" />
        <StatTile id="reach" label="Members we can email" value={n(reach[0].value)} note={`${pct(reach[0].value, members.length)}% of ${n(members.length)} members`} />
      </div>
      <ChartCard id="c-sends" className="mo-wide" title="Opened, delivered, not delivered" note="Each message in the period; newest first."
        table={{ head: ['Message', 'Opened', 'Delivered, not opened', 'Not delivered'], rows: sends.map((x) => [x.what, x.opened, x.delivered - x.opened, x.to - x.delivered]) }}>
        <StackedBars label="Delivery per message" parts={[{ name: 'Opened', slot: 1 }, { name: 'Delivered, not opened', slot: 4 }, { name: 'Not delivered', slot: 2 }]}
          rows={sends.map((x, i) => ({ id: `${i}`, label: x.what, values: [x.opened, x.delivered - x.opened, x.to - x.delivered] }))} />
      </ChartCard>
      <Attention items={[
        ...(reach[2].value ? [{ text: `${n(reach[2].value)} members get no email – reach them by phone or at the masjid.`, href: '/members' }] : []),
        ...sends.filter((x) => pct(x.opened, x.delivered) < 40).map((x) => ({ text: `“${x.what}” was opened by ${pct(x.opened, x.delivered)}% – try a clearer subject.`, href: '/communication?tab=log' })),
        { text: 'Renewal reminder 2 goes out 14 days after renewals open.', href: '/communication?tab=system' },
      ]} />
      <ChartCard id="c-reach" className="mo-half" title="How members can be reached" table={{ head: ['Channel', 'Members'], rows: reach.map((r) => [r.label, r.value]) }}>
        <ShareBar label="How members can be reached" items={reach} />
      </ChartCard>
      <ChartCard id="c-kind" className="mo-half" title="Automatic and staff messages" table={{ head: ['Kind', 'Messages'], rows: ['Automatic', 'Sent by staff'].map((k) => [k, sends.filter((x) => x.kind === k).length]) }}>
        <Columns label="Messages by kind" ramp={false} items={['Automatic', 'Sent by staff'].map((k) => ({ label: k, value: sends.filter((x) => x.kind === k).length }))} />
      </ChartCard>
    </DashPage>
  );
}

/* ================= Masjids and zones ================= */
export function MasjidsDashboard() {
  const s = useScope('12m');
  const org = useOrg();
  const access = useStore<AccessDoc>('admin-access', (x) => { const p = AccessSchema.safeParse(x); return p.success ? p.data : null; }, mockAccess);
  const all = (useMembers() ?? []).filter((m) => !m.archived);
  const masjids = org.centers.filter((c) => c.active && s.keep(c.zone, c.name));
  const rows = masjids.map((c) => {
    const ms = all.filter((m) => centerOf(m) === c.name);
    const h = holdersAt(access, c.name);
    const filled = SEATS.filter((x) => h.some(({ x: a }) => a.roleId === x)).length;
    return { c, members: ms.length, current: ms.filter((m) => ['active', 'life'].includes(statusOf(m))).length, ad: h.filter(({ x }) => x.roleId === 'associate-director').map(({ a }) => a.name).join(', '), filled };
  }).sort((a, b) => b.members - a.members);
  const zonesShown = org.zones.filter((z) => masjids.some((c) => c.zone === z.id));
  const open = zonesShown.flatMap((z) => unservedZips(org, z.id));
  const warns = structureWarnings(org, todayCT()).filter((w) => (!w.zone || zonesShown.some((z) => z.id === w.zone)) && (!w.center || masjids.some((c) => c.id === w.center)));
  const exp = () => downloadCsv('masjids', ['Masjid', 'Zone', 'Service-area ZIP codes', 'Members', 'Renewed', 'Associate Director', 'Seats filled'], rows.map((r) => [r.c.name, org.zones.find((z) => z.id === r.c.zone)?.name ?? '', r.c.zips.join(' '), r.members, r.current, r.ad || 'Vacant', `${r.filled}/${SEATS.length}`]));
  return (
    <DashPage title="Masjids and zones dashboard" intro={<>{s.label} · {n(masjids.length)} masjids · demo data</>}
      bar={<DashBar s={s} show={{ zone: true }} report={{ href: '/masjids', label: 'Masjid working bodies' }} onExport={exp} />}>
      <div className="mo-kpis">
        <StatTile id="masjids" hero label="Masjids" value={n(masjids.length)} note={`in ${zonesShown.length} zone${zonesShown.length === 1 ? '' : 's'}`} />
        <StatTile id="members" label="Members" value={n(rows.reduce((a, r) => a + r.members, 0))} note={`${pct(rows.reduce((a, r) => a + r.current, 0), rows.reduce((a, r) => a + r.members, 0))}% renewed`} />
        <StatTile id="noad" label="Without an Associate Director" value={n(rows.filter((r) => !r.ad).length)} note="nobody runs it in the system" tone={rows.some((r) => !r.ad) ? 'down' : undefined} />
        <StatTile id="zips" label="ZIP codes without a masjid" value={n(open.length)} note={open.length ? open.slice(0, 3).join(', ') : 'every ZIP has a home masjid'} />
      </div>
      <ChartCard id="m-members" className="mo-wide" title="Members by masjid" note="Renewed for this year and not yet."
        table={{ head: ['Masjid', 'Renewed', 'Not yet'], rows: rows.map((r) => [r.c.name, r.current, r.members - r.current]) }}>
        <StackedBars label="Members by masjid" parts={[{ name: 'Renewed', slot: 1 }, { name: 'Not yet', slot: 2 }]} rows={rows.slice(0, 12).map((r) => ({ id: r.c.id, label: r.c.name, values: [r.current, r.members - r.current] }))} />
      </ChartCard>
      <Attention items={warns.slice(0, 8).map((w) => ({ text: w.text, href: w.zone ? '/zones?tab=zips' : '/zones?tab=centers' }))} />
      <ChartCard id="m-seats" className="mo-half" title="Working body seats filled" note="Associate Director and three secretaries per masjid."
        table={{ head: ['Seats filled', 'Masjids'], rows: [0, 1, 2, 3, 4].map((k) => [`${k} of 4`, rows.filter((r) => r.filled === k).length]) }}>
        <Columns label="Masjids by seats filled" items={[0, 1, 2, 3, 4].map((k) => ({ label: `${k} of 4`, value: rows.filter((r) => r.filled === k).length }))} />
      </ChartCard>
      <ChartCard id="m-zones" className="mo-half" title="Members by zone" table={{ head: ['Zone', 'Members'], rows: zonesShown.map((z) => [z.name, rows.filter((r) => r.c.zone === z.id).reduce((a, r) => a + r.members, 0)]) }}>
        <Columns label="Members by zone" ramp={false} items={zonesShown.map((z) => ({ label: z.name.replace(/ Zone$/, ''), value: rows.filter((r) => r.c.zone === z.id).reduce((a, r) => a + r.members, 0) }))} />
      </ChartCard>
    </DashPage>
  );
}

/* ================= Events ================= */
export function EventsDashboard() {
  const s = useScope('90d');
  const doc = useStore<EventsDoc>('events', (x) => { const p = EventsSchema.safeParse(x); return p.success ? p.data : null; }, mockEvents);
  const t = todayCT();
  const placeOk = (center?: string) => !s.masjid || center === s.masjid;
  const ahead = doc.events.filter((e) => e.status !== 'cancelled' && placeOk(e.location.center) && inPeriod(e.start, s.period, t, true));
  const past = mockEventHistory.filter((x) => placeOk(x.center) && inPeriod(x.date, s.period, '2026-09-30'));
  const st = eventStats(past);
  const waiting = doc.events.filter((e) => e.approval.state === 'pending' && placeOk(e.location.center));
  const warns = eventWarnings(doc, t).filter((w) => !w.event || placeOk(doc.events.find((e) => e.id === w.event)?.location.center));
  const reg = ahead.filter((e) => e.registration.enabled);
  // short periods: one column per week from today; longer ones: one per month (empty weeks and months still show)
  const weekly = s.period === '30d' || s.period === '90d';
  const plus = (d: string, k: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
  const byMonth = weekly
    ? Array.from({ length: s.period === '30d' ? 5 : 13 }, (_, i) => { const a = plus(t, i * 7), z = plus(t, i * 7 + 6); return { label: `${MONTH[Number(a.slice(5, 7)) - 1]} ${Number(a.slice(8))}`, value: ahead.filter((e) => e.start.slice(0, 10) >= a && e.start.slice(0, 10) <= z).length }; })
    : Array.from({ length: s.period === 'year' ? 13 - Number(t.slice(5, 7)) : 12 }, (_, i) => { const m0 = Number(t.slice(5, 7)) - 1 + i; const m = `${Number(t.slice(0, 4)) + Math.floor(m0 / 12)}-${String((m0 % 12) + 1).padStart(2, '0')}`; return { label: `${MONTH[m0 % 12]} ${m.slice(0, 4)}`, value: ahead.filter((e) => e.start.startsWith(m)).length }; });
  const exp = () => downloadCsv('events', ['Date', 'Event', 'Place', 'Kind', 'Status', 'Registered', 'Capacity'], ahead.map((e) => [fmtD(e.start), e.title, e.location.center || e.location.name, CATEGORY_LABEL[e.category], e.approval.state === 'pending' ? 'Waiting for approval' : e.status, e.registration.enabled ? e.registered : '', e.registration.capacity || '']));
  return (
    <DashPage title="Events dashboard" intro={<>{s.masjid || 'All places'} · {FUTURE[s.period].toLowerCase()} ahead, {PERIODS[s.period].toLowerCase()} behind · demo data</>}
      bar={<DashBar s={s} show={{ period: 'ahead', masjid: true }} report={{ href: '/events/plan?tab=analytics', label: 'Event analytics' }} onExport={exp} />}>
      <div className="mo-kpis">
        <StatTile id="ahead" hero label="Coming up" value={n(ahead.length)} note={`${n(ahead.filter((e) => e.status === 'published').length)} on the website`} />
        <StatTile id="reg" label="Registered" value={n(reg.reduce((a, e) => a + e.registered, 0))} note={`${pct(reg.reduce((a, e) => a + e.registered, 0), reg.reduce((a, e) => a + (e.registration.capacity || 0), 0))}% of seats`} meter={{ value: reg.reduce((a, e) => a + e.registered, 0), of: Math.max(1, reg.reduce((a, e) => a + (e.registration.capacity || 0), 0)) }} />
        <StatTile id="wait" label="Waiting for approval" value={n(waiting.length)} note="sent by masjid offices" />
        <StatTile id="show" label="Showed up (past events)" value={`${st.attendancePct}%`} note={`${n(st.attended)} of ${n(st.registered)} registered`} />
      </div>
      <ChartCard id="e-month" className="mo-wide" title={weekly ? 'Events coming up by week' : 'Events coming up by month'} note={weekly ? 'Each column is a week starting on the date shown.' : undefined} table={{ head: [weekly ? 'Week of' : 'Month', 'Events'], rows: byMonth.map((m) => [m.label, m.value]) }}>
        {ahead.length ? <Columns label="Events by month" ramp={false} items={byMonth} /> : <p className="muted">No events in this period.</p>}
      </ChartCard>
      <Attention items={warns.slice(0, 8).map((w) => ({ text: w.text, href: w.text.includes('approval') ? '/events/plan?tab=approvals' : '/events/plan?tab=calendar', tone: w.text.includes('Jumu') || w.text.includes('Same place') ? 'stop' : 'look' }))} />
      <ChartCard id="e-seats" className="mo-half" title="Seats taken" note="Events with registration and a capacity."
        table={{ head: ['Event', 'Registered', 'Free seats'], rows: reg.filter((e) => e.registration.capacity).map((e) => [e.title, e.registered, Math.max(0, e.registration.capacity - e.registered)]) }}>
        <StackedBars label="Seats taken" parts={[{ name: 'Registered', slot: 1 }, { name: 'Free seats', slot: 2 }]} rows={reg.filter((e) => e.registration.capacity).map((e) => ({ id: e.id, label: e.title, values: [Math.min(e.registered, e.registration.capacity), Math.max(0, e.registration.capacity - e.registered)] }))} />
      </ChartCard>
      <ChartCard id="e-kind" className="mo-half" title="People who came, by kind (past)" table={{ head: ['Kind', 'People'], rows: st.byCategory.map((c) => [CATEGORY_LABEL[c.id as keyof typeof CATEGORY_LABEL] ?? c.id, c.attended]) }}>
        <ShareBar label="People by kind of event" items={st.byCategory.slice(0, 4).map((c) => ({ id: c.id, label: CATEGORY_LABEL[c.id as keyof typeof CATEGORY_LABEL] ?? c.id, value: c.attended }))} />
      </ChartCard>
    </DashPage>
  );
}

/* ================= Meetings and minutes ================= */
export function MeetingsDashboard() {
  const s = useScope('year');
  const org = useOrg();
  const list = useMeetings();
  const t = todayCT();
  const keepM = (m: { body: string; center: string; zone: string }) => (m.body === 'council' ? s.keep(org.centers.find((c) => c.name === m.center)?.zone ?? '', m.center) : !s.masjid && (!s.zone || m.zone === s.zone || m.body !== 'zone-joint'));
  const ms = list.filter((m) => keepM(m) && inPeriod(m.date, s.period, t));
  const held = ms.filter((m) => m.date <= t);
  const quorum = held.filter((m) => quorumMet(m)).length;
  const toApprove = held.filter((m) => m.status === 'draft');
  const centers = org.centers.filter((c) => c.active && s.keep(c.zone, c.name)).map((c) => c.name);
  const warns = calendarWarnings(list, centers, Number(t.slice(0, 4)), t).filter((w) => !s.masjid || w.center === s.masjid || !w.center);
  const months = MONTH.map((mo, i) => ({ label: mo, value: held.filter((m) => Number(m.date.slice(5, 7)) === i + 1).length }));
  const exp = () => downloadCsv('meetings', ['Meeting', 'Body', 'Masjid', 'Date', 'Present', 'Seats', 'Quorum', 'Decisions', 'Minutes'], ms.map((m) => [m.id, BODIES[m.body], m.center, fmtD(m.date), m.present, m.seats, quorumMet(m) ? 'Yes' : 'No', m.decisions.length, m.status]));
  return (
    <DashPage title="Meetings dashboard" intro={<>{s.label} · {PERIODS[s.period].toLowerCase()} · demo records</>}
      bar={<DashBar s={s} show={{ period: 'past', zone: true, masjid: true }} report={{ href: '/minutes?tab=calendar', label: 'Required meetings check' }} onExport={exp} />}>
      <div className="mo-kpis">
        <StatTile id="held" hero label="Meetings held" value={n(held.length)} note={`${n(ms.length - held.length)} planned`} />
        <StatTile id="quorum" label="Had a quorum" value={`${pct(quorum, held.length)}%`} meter={{ value: quorum, of: Math.max(1, held.length) }} note={`${n(quorum)} of ${n(held.length)}`} />
        <StatTile id="dec" label="Decisions recorded" value={n(held.reduce((a, m) => a + m.decisions.length, 0))} />
        <StatTile id="draft" label="Minutes to approve" value={n(toApprove.length)} note="still drafts" tone={toApprove.length ? 'down' : undefined} />
      </div>
      <ChartCard id="mt-month" className="mo-wide" title="Meetings held by month" table={{ head: ['Month', 'Meetings'], rows: months.map((m) => [m.label, m.value]) }}>
        <Columns label="Meetings by month" ramp={false} items={months} />
      </ChartCard>
      <Attention items={[...toApprove.slice(0, 3).map((m) => ({ text: `Approve the minutes: ${BODIES[m.body]}${m.center ? ` – ${m.center}` : ''} (${fmtD(m.date)})`, href: '/minutes?tab=meetings', tone: 'look' as const })), ...warns.slice(0, 6).map((w) => ({ text: w.text, href: '/minutes?tab=calendar', tone: w.level }))]} />
      <ChartCard id="mt-body" className="mo-half" title="Meetings by body" table={{ head: ['Body', 'Meetings'], rows: (Object.keys(BODIES) as (keyof typeof BODIES)[]).map((b) => [BODIES[b], held.filter((m) => m.body === b).length]) }}>
        <ShareBar label="Meetings by body" items={(Object.keys(BODIES) as (keyof typeof BODIES)[]).map((b) => ({ id: b, label: BODIES[b], value: held.filter((m) => m.body === b).length })).filter((x) => x.value).sort((a, b) => b.value - a.value).slice(0, 4)} />
      </ChartCard>
      <ChartCard id="mt-att" className="mo-half" title="Attendance" note="People present as a share of seats, per meeting." table={{ head: ['Meeting', 'Present', 'Seats'], rows: held.map((m) => [`${BODIES[m.body]} ${fmtD(m.date)}`, m.present, m.seats]) }}>
        <StackedBars label="Attendance per meeting" parts={[{ name: 'Present', slot: 1 }, { name: 'Absent', slot: 2 }]} rows={held.filter((m) => m.body !== 'general-assembly').slice(0, 8).map((m) => ({ id: m.id, label: `${m.center || BODIES[m.body]} ${fmtD(m.date).slice(0, 5)}`, values: [m.present, Math.max(0, m.seats - m.present)] }))} />
      </ChartCard>
    </DashPage>
  );
}

/* ================= Elections ================= */
export function ElectionsDashboard() {
  const s = useScope('year');
  const ms = (useMembers() ?? []).filter((m) => !m.archived && s.keep(m.zone, centerOf(m), m.zip));
  const t = todayCT();
  const el = ms.map((m) => ({ m, e: eligibility(m) }));
  const voters = el.filter((x) => x.e.eligible);
  const why = new Map<string, number>(); el.filter((x) => !x.e.eligible).forEach((x) => { const c = x.e.checks.find((k) => !k.ok); if (c) why.set(c.label, (why.get(c.label) ?? 0) + 1); });
  const reasons = Array.from(why.entries()).sort((a, b) => b[1] - a[1]);
  const couldStill = el.filter((x) => !x.e.eligible && x.e.checks.filter((k) => !k.ok).every((k) => k.id === 'dues')).length;
  const frozen = t > recordDate(YEAR); const rd = recordDate(YEAR + (frozen ? 1 : 0)); const ed = electionDay(Number(t.slice(0, 4)));
  const zones = (Object.keys(ZONES) as ZoneId[]).filter((z) => ms.some((m) => m.zone === z));
  const exp = () => downloadCsv('voters-by-masjid', ['Zone', 'Masjid', 'Members', 'Can vote', 'Share'], Array.from(new Set(ms.map(centerOf))).sort().map((c) => { const l = el.filter((x) => centerOf(x.m) === c); const v = l.filter((x) => x.e.eligible).length; return [ZONES[l[0].m.zone], c, l.length, v, `${pct(v, l.length)}%`]; }));
  return (
    <DashPage title="Elections dashboard" intro={<>{s.label} · voting year {YEAR} · demo data</>}
      bar={<DashBar s={s} show={{ zone: true, masjid: true }} report={{ href: '/reports?tab=voters', label: 'Voter list' }} onExport={exp} />}>
      <div className="mo-kpis">
        <StatTile id="voters" hero label={`Can vote in ${YEAR}`} value={n(voters.length)} note={`${pct(voters.length, ms.length)}% of ${n(ms.length)} members`} meter={{ value: voters.length, of: Math.max(1, ms.length) }} />
        <StatTile id="still" label={frozen ? 'Missed only by dues' : 'Could still qualify'} value={n(couldStill)} note={frozen ? `own ${YEAR} dues not paid by ${fmtD(recordDate(YEAR))}` : 'only their own dues are missing'} tone={frozen && couldStill ? 'down' : undefined} />
        {frozen
          ? <StatTile id="rd" label="Voter list" value="Frozen" note={`record date ${fmtD(recordDate(YEAR))} passed · next ${fmtD(rd)}`} />
          : <StatTile id="rd" label="Days to the record date" value={n(Math.max(0, days(t, rd)))} note={`${fmtD(rd)} – pay own dues by then`} />}
        <StatTile id="ed" label="Days to Election Day" value={n(Math.max(0, days(t, ed)))} note={fmtD(ed)} />
      </div>
      <ChartCard id="el-zone" className="mo-wide" title="Voters by zone" note="Members who can vote and those who cannot yet."
        table={{ head: ['Zone', 'Can vote', 'Cannot yet'], rows: zones.map((z) => { const l = el.filter((x) => x.m.zone === z); const v = l.filter((x) => x.e.eligible).length; return [ZONES[z], v, l.length - v]; }) }}>
        <StackedBars label="Voters by zone" parts={[{ name: 'Can vote', slot: 1 }, { name: 'Cannot yet', slot: 2 }]} rows={zones.map((z) => { const l = el.filter((x) => x.m.zone === z); const v = l.filter((x) => x.e.eligible).length; return { id: z, label: ZONES[z], values: [v, l.length - v] }; })} />
      </ChartCard>
      <Attention title={frozen ? 'Before Election Day' : 'Before the record date'} items={[
        ...(couldStill ? [{ text: frozen ? `${n(couldStill)} members missed the vote only because of their own dues – remind them early for ${YEAR + 1}.` : `${n(couldStill)} members only need to pay their own dues to vote – send the reminder.`, href: '/communication?tab=send' }] : []),
        { text: frozen ? 'Voter list is frozen – the Election Commission confirms it before the ballots.' : 'Freeze the voter list after the record date (Election Commission).', href: '/reports?tab=voters' },
        { text: 'Check candidates and Area Representative seats per masjid.', href: '/reports?tab=candidates' },
      ]} />
      <ChartCard id="el-why" className="mo-half" title={frozen ? `Why members cannot vote in ${YEAR}` : 'Why members cannot vote yet'} note="The first rule each member does not meet." table={{ head: ['Rule', 'Members'], rows: reasons.map(([k, v]) => [k, v]) }}>
        <ShareBar label="Why members cannot vote" items={reasons.slice(0, 4).map(([k, v]) => ({ id: k, label: k, value: v }))} />
      </ChartCard>
      <ChartCard id="el-masjid" className="mo-half" title="Masjids with the most voters" table={{ head: ['Masjid', 'Can vote'], rows: Array.from(new Set(ms.map(centerOf))).map((c) => [c, voters.filter((x) => centerOf(x.m) === c).length]) }}>
        <Columns label="Voters by masjid" ramp={false} items={Array.from(new Set(ms.map(centerOf))).map((c) => ({ label: c.replace(' Islamic Center', ''), value: voters.filter((x) => centerOf(x.m) === c).length })).sort((a, b) => b.value - a.value).slice(0, 6)} />
      </ChartCard>
    </DashPage>
  );
}

/* ================= Website ================= */
const WEB_KEYS: DocKey[] = ['site-config', 'home', 'pages', 'news', 'themes', 'giving', 'events', 'membership-settings', 'join-form', 'officials', 'prayer-times', 'fundraising'];
export function WebsiteDashboard() {
  const s = useScope('all');
  const [docs, setDocs] = useState<Record<string, { source: string; version: number; publishedAt?: string; by?: string; data?: unknown }>>({});
  useEffect(() => { void Promise.all(WEB_KEYS.map((k) => fetch(`/api/store/${k}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => [k, j] as const).catch(() => [k, null] as const))).then((rows) => setDocs(Object.fromEntries(rows.filter(([, j]) => j)))); }, []);
  const rows = WEB_KEYS.map((k) => ({ k, label: REGISTRY[k].label, d: docs[k] }));
  const published = rows.filter((r) => r.d?.source === 'published');
  const last = [...published].sort((a, b) => String(b.d?.publishedAt ?? '').localeCompare(String(a.d?.publishedAt ?? '')))[0];
  const pages = docs.pages?.data && typeof docs.pages.data === 'object' ? Object.keys(docs.pages.data as object).length : 0;
  const news = Array.isArray(docs.news?.data) ? (docs.news!.data as unknown[]).length : 0;
  const exp = () => downloadCsv('website-content', ['Content', 'State', 'Version', 'Published', 'By'], rows.map((r) => [r.label, r.d?.source === 'published' ? 'Published' : 'Built-in', r.d?.version ?? 0, r.d?.publishedAt ? fmtD(String(r.d.publishedAt).slice(0, 10)) : '', r.d?.by ?? '']));
  void s;
  return (
    <DashPage title="Website dashboard" intro="What the website shows and what you have changed from the built-in content · demo store"
      bar={<DashBar s={s} show={{}} report={{ href: '/website/pages', label: 'Pages' }} onExport={exp} />}>
      <div className="mo-kpis">
        <StatTile id="pub" hero label="Changed and published" value={`${published.length} of ${rows.length}`} meter={{ value: published.length, of: rows.length }} note="the rest use the built-in content" />
        <StatTile id="pages" label="Pages" value={n(pages)} note="built from blocks" />
        <StatTile id="news" label="News posts" value={n(news)} />
        <StatTile id="last" label="Last published" value={last?.d?.publishedAt ? fmtD(String(last.d.publishedAt).slice(0, 10)) : '—'} note={last ? `${last.label}${last.d?.by ? ` by ${last.d.by}` : ''}` : 'nothing yet'} />
      </div>
      <section className="viz-card glass-pane mo-wide web-list" aria-label="Website content">
        <header className="viz-head"><h2>Website content</h2><p>Open one to change it; changes go live when you publish.</p></header>
        <ul>{rows.map((r) => (
          <li key={r.k} data-doc={r.k}><span className={`dot ${r.d?.source === 'published' ? 'on' : ''}`} aria-hidden="true" /><b className="web-name">{r.label}</b>
            <small>{r.d?.source === 'published' ? `version ${r.d.version}${r.d.publishedAt ? ` · ${fmtD(String(r.d.publishedAt).slice(0, 10))}` : ''}` : 'built-in'}</small></li>
        ))}</ul>
      </section>
      <Attention items={[
        ...rows.filter((r) => r.d?.source !== 'published' && ['site-config', 'home', 'membership-settings'].includes(r.k)).map((r) => ({ text: `${r.label} still uses the built-in content – review it before launch.` })),
        { text: 'Turn off sample items in Giving before launch.', href: '/website/giving?tab=settings' },
      ]} />
      <ChartCard id="w-share" className="mo-half" title="Published or built-in" table={{ head: ['State', 'Items'], rows: [['Published', published.length], ['Built-in', rows.length - published.length]] }}>
        <ShareBar label="Published or built-in" items={[{ id: 'pub', label: 'Published', value: published.length }, { id: 'built', label: 'Built-in', value: rows.length - published.length }]} />
      </ChartCard>
      <section className="viz-card glass-pane mo-half" aria-label="Quick links">
        <header className="viz-head"><h2>Quick links</h2></header>
        <div className="web-links">{[['/website/home', 'Home page'], ['/website/menus', 'Menus and footer'], ['/website/announcement', 'Announcement bar'], ['/website/news', 'News'], ['/website/theme', 'Theme'], ['/website/giving', 'Giving page']].map(([h, l]) => <Link key={h} className="btn sm" href={h}>{l}</Link>)}</div>
      </section>
    </DashPage>
  );
}
void centerForZip;
