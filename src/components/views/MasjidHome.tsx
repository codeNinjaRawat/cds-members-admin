'use client';
/**
 * M5 Home pages by dashboard. The admin overview ("/") follows the role the person is working in:
 *   masjid roles (Associate Director, secretaries)  → MasjidHome: one masjid – members, dues, voters, its ZIP areas
 *                                                     and their Area Representatives, the working body, what to do next
 *   area roles (Area Representative)                → MasjidHome limited to their ZIP codes
 *   zone roles (Zone director)                      → ZoneHome: every masjid of the zone side by side
 * Organization roles keep the organization overview. All numbers follow inScope – nobody sees outside their area.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StatTile } from '@/components/charts/Charts';
import { useAccess } from '@/lib/access/use-access';
import { AccessSchema, type AccessDoc } from '@/lib/access/access';
import { centerOf, eligibility, statusOf, ZONES, type Member, type ZoneId } from '@/lib/members/members';
import { EventsSchema, mockEvents, type EventsDoc } from '@/lib/community/events';
import { dayTimes, clock, mockPrayerSettings, PRAYER_NAME, IQAMAH_PRAYERS } from '@/lib/community/prayer';
import type { Center, OrgStructure } from '@/lib/community/org-structure';
import { useMembers } from './MembersView';
import { SEATS, holdersAt, useOrg } from './TeamViews';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const n = (v: number) => v.toLocaleString('en-US');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function useDocs() {
  const [access, setAccess] = useState<AccessDoc | null>(null);
  const [events, setEvents] = useState<EventsDoc>(mockEvents);
  useEffect(() => {
    void fetch('/api/store/admin-access', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = AccessSchema.safeParse(j?.data); if (p.success) setAccess(p.data); }).catch(() => undefined);
    void fetch('/api/store/events', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = EventsSchema.safeParse(j?.data); if (p.success) setEvents(p.data); }).catch(() => undefined);
  }, []);
  return { access, events };
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

/** "/" for masjid and area roles. */
export function MasjidHome() {
  const access = useAccess();
  const org = useOrg();
  const members = useMembers() ?? [];
  const { access: published, events } = useDocs();
  const doc = published ?? access.doc;
  const me = access.me!;
  const role = access.role!;
  const masjids = org.centers.filter((c) => me.centers.includes(c.name));
  const [sel, setSel] = useState(0);
  const m: Center | undefined = masjids[sel] ?? masjids[0];
  const mine = useMemo(() => members.filter((x) => m && centerOf(x) === m.name && access.inScope(x.zone, centerOf(x), x.zip)), [members, m, access.ready, access.me?.id, access.dashIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <div className="page"><p className="cv-empty">Your role has no masjid yet. Ask the organization admin.</p></div>;
  const k = masjidNumbers(mine);
  const zips = role.areaScoped ? me.zips : m.zips;
  const holders = holdersAt(doc, m.name);
  const repFor = (zip: string) => holders.filter(({ x }) => x.roleId === 'area-representative' && x.zips.includes(zip)).map(({ a }) => a.name);
  const vacant = SEATS.filter((s) => !holders.some(({ x }) => x.roleId === s));
  const upcoming = events.events.filter((e) => e.location.center === m.name && e.status !== 'cancelled' && e.end.slice(0, 10) >= today()).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
  const day = dayTimes(mockPrayerSettings, m.name, today(), m.jumuah.map((j) => j.khutbah));
  const todo = [
    k.pending && access.can('members.view') ? { text: `${n(k.pending)} application${k.pending === 1 ? '' : 's'} waiting for the Board`, href: '/queues?tab=applications' } : null,
    k.notRenewed ? { text: `${n(k.notRenewed)} member${k.notRenewed === 1 ? ' has' : 's have'} not renewed for this year`, href: '/members' } : null,
    !role.areaScoped && vacant.length ? { text: `Vacant: ${vacant.map((s) => doc.roles.find((r) => r.id === s)?.name ?? s).join(', ')}`, href: access.can('team.manage') ? '/team' : '' } : null,
    !role.areaScoped && zips.filter((z) => !repFor(z).length).length ? { text: `${zips.filter((z) => !repFor(z).length).length} ZIP code(s) without an Area Representative`, href: access.can('team.manage') ? '/team' : '' } : null,
  ].filter(Boolean) as { text: string; href: string }[];
  const links = ([
    ['/members', 'members.view', 'Members'], ['/team', 'team.manage', 'Working body'], ['/events', 'events.checkin', 'Events'],
    ['/prayer-times', 'members.view', 'Prayer times'], ['/minutes', 'members.view', 'Meetings and minutes'], ['/donations', 'donations.view', 'Donations'], ['/finance', 'finance.view', 'Finance'], ['/zakat', 'zakat.view', 'Zakat cases'],
  ] as const).filter(([, p]) => access.can(p));
  return (
    <div className="page mh" data-masjid={m.id}>
      <header className="mh-hero glass-pane">
        <div>
          <p className="eyebrow">{role.areaScoped ? 'My area' : 'Masjid dashboard'} · {role.name}</p>
          <h1>{m.name}</h1>
          <p className="muted">{org.zones.find((z) => z.id === m.zone)?.name}{m.address.city ? ` · ${m.address.city}` : ''} · {role.areaScoped ? `your ZIP codes ${zips.join(', ')}` : `service area ${zips.join(', ') || 'not set'}`}</p>
        </div>
        {masjids.length > 1 && <label className="sf-field"><span className="sr-only">Masjid</span><select className="in pill-select" value={sel} onChange={(e) => setSel(Number(e.target.value))}>{masjids.map((c, i) => <option key={c.id} value={i}>{c.name}</option>)}</select></label>}
        <div className="mh-prayer" aria-label="Today’s iqamah">
          {day.iqamah ? IQAMAH_PRAYERS.map((p) => <span key={p}><small>{PRAYER_NAME[p]}</small><b>{clock(day.iqamah![p])}</b></span>) : <span className="muted">No iqamah times set</span>}
        </div>
      </header>

      <div className="viz-tiles mh-tiles">
        <StatTile id="members" label={role.areaScoped ? 'Members in your ZIP codes' : 'Members'} value={n(k.members)} note={`${n(k.current)} current`} hero />
        <StatTile id="renewed" label="Renewed this year" value={`${pct(k.current, k.members)}%`} meter={{ value: k.current, of: k.members }} note={`${n(k.notRenewed)} not yet`} />
        <StatTile id="voters" label="Can vote" value={n(k.voters)} note="for the next election" />
        <StatTile id="pending" label="Applications" value={n(k.pending)} note="waiting for the Board" />
      </div>

      <div className="mh-grid">
        <section className="panel glass-pane mh-todo" aria-labelledby="mh-todo-h">
          <h2 id="mh-todo-h" className="panel-h">To do</h2>
          {todo.length ? <ul>{todo.map((t) => <li key={t.text}>{t.href ? <Link href={t.href}>{t.text}</Link> : t.text}</li>)}</ul> : <p className="muted">Nothing waiting. Alhamdulillah.</p>}
        </section>

        <section className="panel glass-pane" aria-labelledby="mh-zip-h">
          <h2 id="mh-zip-h" className="panel-h">{role.areaScoped ? 'Your ZIP codes' : 'Members by ZIP code'}</h2>
          <div className="table-wrap"><table className="t-plain mh-zips">
            <thead><tr><th>ZIP</th><th className="num">Members</th><th className="num">Renewed</th><th>Area Representative</th></tr></thead>
            <tbody>{zips.map((z) => { const l = mine.filter((x) => x.zip.startsWith(z)); const kk = masjidNumbers(l); const reps = repFor(z); return (
              <tr key={z} data-zip={z}><td><b>{z}</b></td><td className="num">{n(kk.members)}</td><td className="num">{pct(kk.current, kk.members)}%</td><td>{reps.length ? reps.join(', ') : <span className="zn-missing">Nobody yet</span>}</td></tr>
            ); })}</tbody>
          </table></div>
        </section>

        {!role.areaScoped && (
          <section className="panel glass-pane mh-body" aria-labelledby="mh-body-h">
            <h2 id="mh-body-h" className="panel-h">Working body</h2>
            <ul>{SEATS.map((s) => { const h = holders.filter(({ x }) => x.roleId === s); return (
              <li key={s} data-seat={s} className={h.length ? '' : 'vacant'}><small>{doc.roles.find((r) => r.id === s)?.name}</small><b>{h.length ? h.map(({ a }) => a.name).join(', ') : 'Vacant'}</b></li>
            ); })}</ul>
            {access.can('team.manage') && <Link className="btn sm" href="/team">Manage the working body</Link>}
          </section>
        )}

        <section className="panel glass-pane" aria-labelledby="mh-ev-h">
          <h2 id="mh-ev-h" className="panel-h">Coming up at {m.name}</h2>
          {upcoming.length ? <ul className="mh-events">{upcoming.map((e) => <li key={e.id}><b>{e.title}</b><small>{new Date(`${e.start}:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {clock(Number(e.start.slice(11, 13)) * 60 + Number(e.start.slice(14, 16)))}{e.status === 'draft' ? ' · draft' : ''}</small></li>)}</ul> : <p className="muted">No events planned.</p>}
        </section>
      </div>

      <nav className="mh-links" aria-label="Your masjid’s pages">{links.map(([href, , label]) => <Link key={href} className="btn" href={href}>{label}</Link>)}</nav>
    </div>
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
