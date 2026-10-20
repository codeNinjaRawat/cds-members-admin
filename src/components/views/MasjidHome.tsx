'use client';
/**
 * M5 Home pages by dashboard. The admin overview ("/") follows the role the person is working in:
 *   masjid roles (Associate Director, secretaries)  → MasjidHome: one masjid – its members, dues, voters, ZIP areas and
 *                                                     Area Representatives, the working body, what needs attention
 *   area roles (Area Representative)                → MasjidHome limited to their ZIP codes
 *   zone roles (Zone director)                      → ZoneHome: every masjid of the zone side by side
 * Same frame as the organization Overview (greeting, year ribbon, KPI cards with trends, side column) – but every
 * number here comes from the masjid's own member records, queues, events, meetings and Zakat cases. Nobody sees
 * outside their area (inScope). Demo data; live: GET /admin/masjids/{id}/home.
 */
import Link from 'next/link';
import { MyWorkCard } from './MyWorkCard';
import { useEffect, useMemo, useState } from 'react';
import { ChartCard, LineChart, StackedBars, StatTile } from '@/components/charts/Charts';
import { Attention } from '@/components/charts/DashKit';
import { useAccess } from '@/lib/access/use-access';
import { AccessSchema, type AccessDoc } from '@/lib/access/access';
import { centerOf, eligibility, fmtDate, fmtMoney, fullName, initials, PLANS, statusOf, YEAR, ZONES, type Member, type ZoneId, ORG_TZ } from '@/lib/members/members';
import { EventsSchema, mockEvents, type EventsDoc } from '@/lib/community/events';
import { dayTimes, clock, mockPrayerSettings, PrayerSettingsSchema, PRAYER_NAME, IQAMAH_PRAYERS, type PrayerSettings } from '@/lib/community/prayer';
import type { Center, OrgStructure } from '@/lib/community/org-structure';
import { calendarWarnings } from '@/lib/community/minutes';
import { useMeetings } from '@/lib/minutes/use-meetings';
import { useZakatCases } from '@/lib/zakat/use-zakat';
import { isOpen, QUEUES, sla } from '@/lib/queues/queues';
import { useMembers } from './MembersView';
import { LIVE } from '@/lib/live/live';
import { allCases, useQueueState } from './QueuesView';
import { SEATS, holdersAt, useOrg } from './TeamViews';
import { YearRibbon } from './YearRibbon';
import { ArtBand } from '@/components/shell/Photo';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
const n = (v: number) => v.toLocaleString('en-US');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function useDocs() {
  const [access, setAccess] = useState<AccessDoc | null>(null);
  const [events, setEvents] = useState<EventsDoc>(mockEvents);
  const [prayer, setPrayer] = useState<PrayerSettings>(mockPrayerSettings);
  useEffect(() => {
    void fetch('/api/store/prayer-times', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = PrayerSettingsSchema.safeParse(j?.data); if (p.success) setPrayer(p.data); }).catch(() => undefined);
    void fetch('/api/store/admin-access', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = AccessSchema.safeParse(j?.data); if (p.success) setAccess(p.data); }).catch(() => undefined);
    void fetch('/api/store/events', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = EventsSchema.safeParse(j?.data); if (p.success) setEvents(p.data); }).catch(() => undefined);
  }, []);
  return { access, events, prayer };
}
/** Numbers for a set of members (one masjid, or the ZIP codes of one Area Representative). */
export function masjidNumbers(list: Member[]) {
  const live = list.filter((m) => !m.archived);
  const st = live.map((m) => statusOf(m));
  return {
    members: live.length,
    current: st.filter((s) => s === 'active' || s === 'life').length,
    pending: st.filter((s) => s === 'pending').length,
    notRenewed: st.filter((s) => s === 'expired').length,
    voters: live.filter((m) => eligibility(m).eligible).length,
  };
}
/** Dues paid by these members, month by month, for one year (cents); months after `upTo` are null (not here yet). */
function duesByMonth(list: Member[], year: number, upTo: string) {
  const month = Number(upTo.slice(5, 7));
  return MONTHS.map((_, i) => (year === Number(upTo.slice(0, 4)) && i + 1 > month ? null
    : list.flatMap((m) => m.payments).filter((p) => p.paidOn.startsWith(`${year}-${String(i + 1).padStart(2, '0')}`) && p.paidOn <= upTo).reduce((s, p) => s + p.amountCents, 0) / 100));
}
const cumulative = (xs: (number | null)[]) => { let r = 0; return xs.filter((x): x is number => x !== null).map((x) => (r += x)); };

/** "/" for masjid and area roles. */
export function MasjidHome() {
  const access = useAccess();
  const org = useOrg();
  const members = useMembers() ?? [];
  const { access: published, events, prayer } = useDocs();
  const qs = useQueueState();
  const meetings = useMeetings();
  const zakat = useZakatCases();
  const doc = published ?? access.doc;
  const me = access.me!;
  const role = access.role!;
  const t = today();
  const masjids = org.centers.filter((c) => me.centers.includes(c.name));
  const [sel, setSel] = useState(0);
  const m: Center | undefined = masjids[sel] ?? masjids[0];
  const mine = useMemo(() => members.filter((x) => m && centerOf(x) === m.name && access.inScope(x.zone, centerOf(x), x.zip)), [members, m, access.ready, access.me?.id, access.dashIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState('');
  useEffect(() => { setNow(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ORG_TZ })); }, []);
  if (!m) return <div className="page"><p className="cv-empty">Your role has no masjid yet. Ask the organization admin.</p></div>;

  const k = masjidNumbers(mine);
  const zips = role.areaScoped ? me.zips : m.zips;
  const holders = holdersAt(doc, m.name);
  const repFor = (zip: string) => holders.filter(({ x }) => x.roleId === 'area-representative' && x.zips.includes(zip)).map(({ a }) => a.name);
  const vacant = SEATS.filter((s) => !holders.some(({ x }) => x.roleId === s));
  const noRep = zips.filter((z) => !repFor(z).length);
  const upcoming = events.events.filter((e) => e.location.center === m.name && e.status !== 'cancelled' && e.end.slice(0, 10) >= t).sort((a, b) => a.start.localeCompare(b.start));
  const waitingApproval = upcoming.filter((e) => e.approval.state === 'pending');
  const day = dayTimes(prayer, m.name, t, m.jumuah.map((j) => j.khutbah));   // the published Prayer times settings
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: ORG_TZ }));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = me.name.replace(/\s*\(demo\)$/, '').split(' ')[0];

  // money and trends – from the members' own payment records
  const thisYear = duesByMonth(mine, YEAR, t), lastYear = duesByMonth(mine, YEAR - 1, `${YEAR - 1}${t.slice(4)}`);
  const duesNow = cumulative(thisYear).at(-1) ?? 0, duesThen = cumulative(lastYear).at(-1) ?? 0;
  const renewedByMonth = cumulative(MONTHS.map((_, i) => (i + 1 > Number(t.slice(5, 7)) ? null : mine.filter((x) => x.payments.some((p) => p.year === YEAR && p.paidOn.slice(5, 7) === String(i + 1).padStart(2, '0'))).length)));
  const grew = cumulative(MONTHS.map((_, i) => (i + 1 > Number(t.slice(5, 7)) ? null : mine.filter((x) => x.approvedOn?.startsWith(`${YEAR}-${String(i + 1).padStart(2, '0')}`)).length)));
  const joinedThisYear = mine.filter((x) => x.approvedOn?.startsWith(String(YEAR))).length;

  // work waiting at this masjid
  const ids = new Set(mine.map((x) => x.id));
  const open = allCases().filter((c) => ids.has(c.memberId) && isOpen(c, qs));
  const late = open.filter((c) => sla(c).tone === 'late').length;
  const byQueue = (q: string) => open.filter((c) => c.queue === q).length;
  const zakatOpen = zakat.filter((c) => c.center === m.name && !['paid', 'rejected'].includes(c.status));
  const meetingWarns = role.areaScoped ? [] : calendarWarnings(meetings, [m.name], Number(t.slice(0, 4)), t).filter((w) => w.center === m.name);
  const newest = [...mine].filter((x) => x.approvedOn).sort((a, b) => b.approvedOn!.localeCompare(a.approvedOn!)).slice(0, 6);

  const roleName = (id: string) => doc.roles.find((r) => r.id === id)?.name ?? id;
  const attention = [
    byQueue('applications') && access.can('members.view') ? { text: <><b>{n(byQueue('applications'))}</b> application{byQueue('applications') === 1 ? '' : 's'} waiting for the Board</>, href: '/queues?tab=applications', tone: 'look' as const } : null,
    byQueue('id') ? { text: <><b>{n(byQueue('id'))}</b> photo ID{byQueue('id') === 1 ? '' : 's'} to check – voters need them before June 30</>, href: '/queues?tab=id', tone: late ? 'stop' as const : 'look' as const } : null,
    byQueue('center') ? { text: <><b>{n(byQueue('center'))}</b> member{byQueue('center') === 1 ? '' : 's'} asking to move masjid</>, href: '/queues?tab=center', tone: 'look' as const } : null,
    byQueue('payments') ? { text: <><b>{n(byQueue('payments'))}</b> payment{byQueue('payments') === 1 ? '' : 's'} to fix</>, href: '/queues?tab=payments', tone: 'stop' as const } : null,
    k.notRenewed ? { text: <><b>{n(k.notRenewed)}</b> member{k.notRenewed === 1 ? ' has' : 's have'} not renewed for {YEAR}</>, href: '/members?view=not-renewed', tone: 'look' as const } : null,
    waitingApproval.length ? { text: <><b>{n(waitingApproval.length)}</b> event{waitingApproval.length === 1 ? '' : 's'} waiting for approval</>, href: '/events/plan?tab=approvals', tone: 'look' as const } : null,
    zakatOpen.length && access.can('zakat.view') ? { text: <><b>{n(zakatOpen.length)}</b> open Zakat case{zakatOpen.length === 1 ? '' : 's'} at this masjid{zakatOpen.some((c) => c.urgent) ? ' – one is urgent' : ''}</>, href: '/zakat?tab=cases', tone: zakatOpen.some((c) => c.urgent) ? 'stop' as const : 'look' as const } : null,
    ...meetingWarns.map((w) => { const months = (w.text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g) ?? []).length; return { text: months > 2 ? <>No Council meeting recorded in <b>{months}</b> months of {t.slice(0, 4)} – Councils meet at least once a month</> : w.text.replace(`${m.name}: `, ''), href: '/minutes?tab=calendar', tone: w.level }; }),
    !role.areaScoped && vacant.length ? { text: <>Vacant: {vacant.map(roleName).join(', ')}</>, href: access.can('team.manage') ? '/team' : undefined, tone: 'look' as const } : null,
    !role.areaScoped && noRep.length ? { text: <><b>{noRep.length}</b> ZIP code{noRep.length === 1 ? '' : 's'} without an Area Representative ({noRep.join(', ')})</>, href: access.can('team.manage') ? '/team' : undefined, tone: 'look' as const } : null,
  ].filter(Boolean) as { text: React.ReactNode; href?: string; tone?: 'stop' | 'look' }[];

  const links = ([
    ['/members', 'members.view', 'Members'], ['/team', 'team.manage', 'Working body'], ['/events', 'events.checkin', 'Events'],
    ['/prayer-times', 'members.view', 'Prayer times'], ['/minutes', 'members.view', 'Meetings and minutes'], ['/donations', 'donations.view', 'Donations'], ['/finance', 'finance.view', 'Finance'], ['/zakat', 'zakat.view', 'Zakat cases'],
  ] as const).filter(([, p]) => access.can(p));
  const kpi = (id: string, icon: string, label: string, value: string, change: string, up: boolean | null, note: string, spark: number[]) => (
    <section key={id} className="cc-kpi glass-pane" data-tile={id}>
      <i className="cc-ico" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24"><path d={icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></i>
      <span className="cc-kl">{label}</span>
      <div className="cc-kv"><b>{value}</b><em className={up ? 'up' : ''}>{up ? '↑ ' : ''}{change}</em></div>
      <small>{note}</small>
      {spark.length > 1 && <Spark values={spark} label={label} />}
    </section>
  );
  const ICONS = { people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6', renew: 'M4 9h13l-3-3M20 15H7l3 3', money: 'M3 6h18v12H3zM3 10h18M7 15h4', vote: 'M4 12h16v8H4zM8 12V5h8v7M10.5 8.5l1.2 1.2 2.3-2.4' };

  return (
    <div className="page cc mh" data-masjid={m.id}>
      <header className="page-head">
        <div>
          <h1 suppressHydrationWarning>Assalamu alaikum, {firstName} <span className="cc-greet" suppressHydrationWarning>· {greet}</span></h1>
          <p className="page-intro">{role.areaScoped ? 'Your ZIP codes' : 'Your masjid'} at a glance – members, dues, who serves and what needs you.{LIVE ? '' : ' Demo data.'}</p>
        </div>
        <p className="cc-date" suppressHydrationWarning>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: ORG_TZ })}</p>
      </header>

      <section className="mh-hero glass-pane has-art" aria-label={m.name}>
        <ArtBand k="mosque-sunset" side="left" />
        <div>
          <p className="eyebrow">{role.areaScoped ? 'My area' : 'Masjid'} · {role.name}</p>
          <h2 className="mh-name">{m.name}</h2>
          <p className="muted">{org.zones.find((z) => z.id === m.zone)?.name}{m.address.city ? ` · ${m.address.city}` : ''} · {role.areaScoped ? `your ZIP codes ${zips.join(', ')}` : `ZIP codes ${zips.join(', ') || 'not set'}`}{m.jumuah.length ? ` · Jumu’ah ${m.jumuah.map((j) => clock(Number(j.khutbah.slice(0, 2)) * 60 + Number(j.khutbah.slice(3)))).join(' and ')}` : ''}</p>
        </div>
        {masjids.length > 1 && <label className="sf-field"><span className="sr-only">Masjid</span><select className="in pill-select" value={sel} onChange={(e) => setSel(Number(e.target.value))}>{masjids.map((c, i) => <option key={c.id} value={i}>{c.name}</option>)}</select></label>}
        <div className="mh-prayer" aria-label="Today’s iqamah">
          {day.iqamah ? IQAMAH_PRAYERS.map((p) => <span key={p}><small>{PRAYER_NAME[p]}</small><b>{clock(day.iqamah![p])}</b></span>) : <span className="muted">No iqamah times set</span>}
          <Link className="mh-prayer-link" href="/prayer-times">Prayer times</Link>
        </div>
      </section>

      <YearRibbon />

      <div className="cc-grid">
        <div className="cc-main">
          <div className="cc-kpis">
            {kpi('members', ICONS.people, role.areaScoped ? 'Members in your ZIP codes' : 'Members', n(k.current), joinedThisYear ? `+${n(joinedThisYear)} in ${YEAR}` : 'Steady', !!joinedThisYear, joinedThisYear ? `current · ${n(joinedThisYear)} joined this year` : `current · nobody new in ${YEAR} yet`, grew)}
            {kpi('renewed', ICONS.renew, `Renewed for ${YEAR}`, `${pct(k.current, k.members)}%`, k.notRenewed ? `${n(k.notRenewed)} not yet` : 'Everyone', !k.notRenewed, `${n(k.current)} of ${n(k.members)} members`, renewedByMonth)}
            {kpi('dues', ICONS.money, `Dues collected ${YEAR}`, fmtMoney(duesNow * 100), duesNow >= duesThen ? `+${fmtMoney((duesNow - duesThen) * 100)}` : `−${fmtMoney((duesThen - duesNow) * 100)}`, duesNow >= duesThen, `vs ${YEAR - 1} by ${fmtDate(t).slice(0, 5)}`, cumulative(thisYear))}
            {kpi('voters', ICONS.vote, `Can vote in ${YEAR}`, n(k.voters), `${pct(k.voters, k.members)}%`, null, k.pending ? `${n(k.pending)} waiting for the Board` : 'of members', [])}
          </div>

          <div className="cc-row2">
            <ChartCard id="mh-dues" className="cc-trend" title="Dues payments by month" note={<>{YEAR} against {YEAR - 1} – renewals open November 1.</>}
              table={{ head: ['Month', String(YEAR), String(YEAR - 1)], rows: MONTHS.map((mo, i) => [mo, thisYear[i] === null ? '—' : fmtMoney((thisYear[i] ?? 0) * 100), fmtMoney((lastYear[i] ?? 0) * 100)]) }}>
              <LineChart label="Dues payments by month" labels={MONTHS} height={220} format={(v) => fmtMoney(v * 100)} series={[
                { id: 'last', name: String(YEAR - 1), values: lastYear, slot: 0 },
                { id: 'this', name: String(YEAR), values: thisYear, slot: 1, area: true },
              ]} />
            </ChartCard>
            <ChartCard id="mh-zips" title={role.areaScoped ? 'Your ZIP codes' : 'Members by ZIP code'} note="Renewed for this year and not yet; who represents each ZIP."
              table={{ head: ['ZIP', 'Members', 'Renewed', 'Area Representative'], rows: zips.map((z) => { const kk = masjidNumbers(mine.filter((x) => x.zip.startsWith(z))); return [z, kk.members, `${pct(kk.current, kk.members)}%`, repFor(z).join(', ') || 'Nobody yet']; }) }}>
              <StackedBars label="Members by ZIP code" parts={[{ name: 'Renewed', slot: 1 }, { name: 'Not yet', slot: 4 }]} rows={zips.map((z) => { const kk = masjidNumbers(mine.filter((x) => x.zip.startsWith(z))); return { id: z, label: z, values: [kk.current, kk.members - kk.current] }; })} />
              <ul className="mh-reps">{zips.map((z) => <li key={z} data-zip={z}><b>{z}</b><span>{repFor(z).length ? repFor(z).join(', ') : <em className="zn-missing">No Area Representative</em>}</span></li>)}</ul>
            </ChartCard>
          </div>

          <div className="cc-row3">
            <Attention className="" items={attention} empty="Nothing waiting. Alhamdulillah." />
            <section className="d-card glass-pane cc-newest" aria-labelledby="mh-new-h">
              <div className="d-head"><h2 id="mh-new-h">Newest members</h2><Link className="cc-more" href="/members">All members</Link></div>
              {newest.length ? <ul className="cc-people">
                {newest.map((x) => { const st = statusOf(x); const last = [...x.payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn))[0]; return (
                  <li key={x.id}>
                    <span className="av" aria-hidden="true">{initials(x)}</span>
                    <span className="nmw"><b className="nm">{fullName(x)}</b><small className="ago">joined {fmtDate(x.approvedOn!)}</small></span>
                    <span className="pl">{PLANS[x.plan].name} · ZIP {x.zip}</span>
                    <span className={`st st-${st === 'active' || st === 'life' ? 'active' : st === 'expired' ? 'needs-info' : 'board-review'}`}>{st === 'active' || st === 'life' ? 'Active' : st === 'expired' ? 'Not renewed' : 'Pending'}</span>
                    <b className="amt">{last ? fmtMoney(last.amountCents) : '—'}</b>
                  </li>
                ); })}
              </ul> : <p className="muted">No members yet.</p>}
            </section>
          </div>
        </div>

        <aside className="cc-side" aria-label="Your masjid">
          <MyWorkCard limit={5} />
          {!role.areaScoped && (
            <section className="d-card glass-pane mh-body" aria-labelledby="mh-body-h">
              <div className="d-head"><h2 id="mh-body-h">Working body <small>{SEATS.length - vacant.length} of {SEATS.length} seats</small></h2></div>
              <ul>{SEATS.map((s) => { const h = holders.filter(({ x }) => x.roleId === s); return (
                <li key={s} data-seat={s} className={h.length ? '' : 'vacant'}><small>{roleName(s)}</small><b>{h.length ? h.map(({ a }) => a.name).join(', ') : 'Vacant'}</b></li>
              ); })}</ul>
              {access.can('team.manage') && <Link className="btn sm" href="/team">Manage the working body</Link>}
            </section>
          )}
          <section className="d-card glass-pane" aria-labelledby="mh-ev-h">
            <div className="d-head"><h2 id="mh-ev-h">Coming up</h2>{access.can('events.checkin') && <Link className="cc-more" href="/events">Events</Link>}</div>
            {upcoming.length ? <ul className="mh-events">{upcoming.slice(0, 4).map((e) => <li key={e.id}><b>{e.title}</b><small>{new Date(`${e.start}:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {clock(Number(e.start.slice(11, 13)) * 60 + Number(e.start.slice(14, 16)))}{e.approval.state === 'pending' ? ' · waiting for approval' : e.status === 'draft' ? ' · draft' : ''}</small></li>)}</ul> : <p className="muted">No events planned at {m.name}.</p>}
          </section>
          <section className="d-card glass-pane" aria-labelledby="mh-q-h">
            <div className="d-head"><h2 id="mh-q-h">Work queues <small>{n(open.length)} open</small></h2></div>
            <ul className="mh-queues">{QUEUES.map((q) => <li key={q.id}><Link href={`/queues?tab=${q.id}`}><span>{q.label}</span><b>{n(byQueue(q.id))}</b></Link></li>)}</ul>
            {late > 0 && <p className="cc-note">{n(late)} past the target – oldest first in each queue.</p>}
          </section>
          <nav className="mh-links" aria-label="Your masjid’s pages">{links.map(([href, , label]) => <Link key={href} className="btn sm" href={href}>{label}</Link>)}</nav>
        </aside>
      </div>

      <footer className="cc-status glass-pane">
        <span><i className="on" aria-hidden="true" />{LIVE ? 'Live – numbers from the member records on the server' : 'Demo mode – numbers from the demo member records'}</span>
        <span suppressHydrationWarning>Refreshed {now} CT</span>
        <span>{m.name} · {ZONES[m.zone as ZoneId]} Zone</span>
      </footer>
    </div>
  );
}

/** Tiny single-series sparkline (decorative trend; the value and change are in text next to it). */
function Spark({ values, label }: { values: number[]; label: string }) {
  const W = 160, H = 40, min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - ((v - min) / (max - min || 1)) * (H - 10)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label} trend this year`}>
      <path d={`${d} L${W},${H} L0,${H} Z`} className="spark-fill" /><path d={d} className="spark-line" />
    </svg>
  );
}

/** "/" for zone roles: the zone's masjids side by side. */
export function ZoneHome() {
  const access = useAccess();
  const org = useOrg();
  const members = useMembers() ?? [];
  const { access: published } = useDocs();
  const doc = published ?? access.doc;
  const me = access.me!;
  const zones = org.zones.filter((z) => me.zones.includes(z.id as ZoneId));
  return (
    <div className="page mh">
      <header className="page-head"><div><p className="eyebrow">Zone dashboard · {access.role?.name}</p><h1>{zones.map((z) => z.name).join(', ')}</h1><p className="page-intro">Every masjid of your zone: members, renewals and who serves.</p></div></header>
      {zones.map((z) => <ZoneBlock key={z.id} zone={z} org={org} doc={doc} members={members} />)}
    </div>
  );
}
function ZoneBlock({ zone, org, doc, members }: { zone: OrgStructure['zones'][number]; org: OrgStructure; doc: AccessDoc; members: Member[] }) {
  const list = org.centers.filter((c) => c.zone === zone.id && c.active);
  const all = masjidNumbers(members.filter((m) => m.zone === zone.id));
  return (
    <section className="mh-zone" data-zone={zone.id} aria-label={zone.name}>
      <div className="viz-tiles mh-tiles">
        <StatTile id="zone-members" label={`${ZONES[zone.id as ZoneId] ?? zone.name} members`} value={n(all.members)} note={`${n(all.current)} current`} hero />
        <StatTile id="zone-renewed" label="Renewed this year" value={`${pct(all.current, all.members)}%`} meter={{ value: all.current, of: all.members }} />
        <StatTile id="zone-voters" label="Can vote" value={n(all.voters)} />
        <StatTile id="zone-masjids" label="Masjids" value={n(list.length)} note={`${list.filter((c) => holdersAt(doc, c.name).some(({ x }) => x.roleId === 'associate-director')).length} with an Associate Director`} />
      </div>
      <div className="table-wrap glass-pane"><table className="t-plain mh-ztable">
        <thead><tr><th>Masjid</th><th className="num">Members</th><th className="num">Renewed</th><th className="num">Can vote</th><th>Associate Director</th><th className="num">Seats</th></tr></thead>
        <tbody>{list.map((c) => { const k = masjidNumbers(members.filter((m) => centerOf(m) === c.name)); const h = holdersAt(doc, c.name); const ad = h.filter(({ x }) => x.roleId === 'associate-director').map(({ a }) => a.name); return (
          <tr key={c.id} data-masjid={c.id}><td><b>{c.name}</b><small className="block">{c.zips.join(', ')}</small></td><td className="num">{n(k.members)}</td><td className="num">{pct(k.current, k.members)}%</td><td className="num">{n(k.voters)}</td><td>{ad.length ? ad.join(', ') : <span className="zn-missing">Vacant</span>}</td><td className="num">{SEATS.filter((s) => h.some(({ x }) => x.roleId === s)).length}/{SEATS.length}</td></tr>
        ); })}</tbody>
      </table></div>
    </section>
  );
}
