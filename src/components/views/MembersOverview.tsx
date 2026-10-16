'use client';
/**
 * Members › Overview – the membership at a glance: headline numbers, then charts (line, donut, bars, columns).
 * One filter row (zone) scopes every number on the page. Respects the admin's zone scope (A10).
 * DEMO data (no API). Live: GET /admin/members/overview?zone= returns the same shape as memberOverview().
 */
import Link from 'next/link';
import { useMemo } from 'react';
import { DashBar, exportPage, useScope } from '@/components/charts/DashKit';
import { centerOf, fmtDate, recordDate, YEAR, ZONES, type ZoneId } from '@/lib/members/members';
import { memberOverview, money, MONTHS } from '@/lib/members/overview';
import { useAccess } from '@/lib/access/use-access';
import { useMembers } from './MembersView';
import { ChartCard, Columns, Donut, LineChart, ShareBar, StackedBars, StatTile } from '@/components/charts/Charts';

const chicagoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const n = (v: number) => v.toLocaleString('en-US');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function MembersOverview() {
  const members = useMembers();
  const access = useAccess();
  const sc = useScope('12m');
  const zone = sc.zone;
  const today = chicagoToday();
  
  const o = useMemo(() => memberOverview((members ?? []).filter((m) => sc.keep(m.zone, centerOf(m), m.zip)), { today }), [members, sc.zone, sc.masjid, today, access.ready, access.me?.id, access.dashIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const dueDiff = o.duesCents - o.duesLastYearSameDate;
  const month = Number(today.slice(5, 7));
  const mostMonth = o.monthly[1].counts.reduce<number>((b, v, i, a) => ((v ?? -1) > (a[b] ?? -1) ? i : b), 0);
  const topPlan = [...o.plans].sort((a, b) => b.count - a.count)[0];
  const topZone = [...o.zones].sort((a, b) => b.voters + b.others - (a.voters + a.others))[0];
  const biggestAge = [...o.ages].sort((a, b) => b.count - a.count)[0];
  const card = o.methods.find((m) => m.id === 'card')!;
  const payTotal = o.methods.reduce((s, m) => s + m.count, 0);
  const scope = sc.label;

  return (
    <div className="page mo">
      <header className="page-head mo-head">
        <div>
          <h1>Members dashboard</h1>
          <p className="page-intro">{scope} · as of {fmtDate(today)} · demo data</p>
        </div>
        <div className="page-actions">
          <Link className="btn" href="/members">Open the member list</Link>
          <Link className="btn" href="/reports?tab=voters">Voter list</Link>
        </div>
      </header>

      <DashBar s={sc} show={{ zone: true, masjid: true }} report={{ href: '/reports', label: 'Membership report' }} onExport={() => exportPage('members-dashboard')}
        extra={<span className="mo-chip">Membership year {YEAR} · record date {fmtDate(recordDate(YEAR))}</span>} />

      <div className={`mo-grid${members ? '' : ' loading'}`}>
        <div className="mo-kpis">
          <StatTile id="total" hero label="Members" value={n(o.total)} note={`${n(o.joinedThisYear)} joined in ${YEAR}`} spark={o.joins.map((j) => j.count)} />
          <StatTile id="voters" label={`Can vote in ${YEAR}`} value={n(o.voters)} note={`${pct(o.voters, o.total)}% of members`} meter={{ value: o.voters, of: o.total }} />
          <StatTile id="renewed" label={`Renewed for ${YEAR}`} value={`${pct(o.renewal.renewed, o.renewal.due)}%`} note={`${n(o.renewal.renewed)} of ${n(o.renewal.due)} due · ${n(o.renewal.due - o.renewal.renewed)} still to renew`} meter={{ value: o.renewal.renewed, of: o.renewal.due }} />
          <StatTile id="dues" label={`Dues collected for ${YEAR}`} value={money(o.duesCents)} tone={dueDiff >= 0 ? 'up' : 'down'}
            note={`${money(Math.abs(dueDiff))} ${dueDiff >= 0 ? 'more' : 'less'} than ${YEAR - 1} by ${fmtDate(today).slice(0, 5)}`} spark={o.cumulativeCents} />
        </div>

        <ChartCard id="status" className="mo-status" title="Where members stand" note={<><b>{n(o.pending)}</b> applications wait for the Board · <Link href="/members?view=not-renewed">see who has not renewed</Link></>}
          table={{ head: ['Status', 'Members'], rows: o.statuses.map((s) => [s.label, s.count]) }}>
          <ShareBar label="Members by status" items={o.statuses.map((s) => ({ id: s.id, label: s.label, value: s.count }))} />
        </ChartCard>

        <ChartCard id="payments" className="mo-wide" title="Dues payments each month" note={<>{YEAR} vs {YEAR - 1}. The busiest month this year was <b>{MONTHS[mostMonth]}</b>; renewals open November 1.</>}
          table={{ head: ['Month', String(YEAR), String(YEAR - 1)], rows: MONTHS.map((m, i) => [m, o.monthly[1].counts[i] ?? '—', o.monthly[0].counts[i] ?? 0]) }}>
          <LineChart label="Dues payments each month" labels={MONTHS} series={[
            { id: 'last', name: String(YEAR - 1), values: o.monthly[0].counts, slot: 0 },
            { id: 'this', name: String(YEAR), values: o.monthly[1].counts.slice(0, month), slot: 1, area: true },
          ]} format={(v) => `${n(v)}`} />
        </ChartCard>

        <ChartCard id="plans" className="mo-side" title="Membership plans" note={<>{topPlan.label} is the most common plan.</>}
          table={{ head: ['Plan', 'Members'], rows: o.plans.map((p) => [p.label, p.count]) }}>
          <Donut label="Members by plan" centerLabel="members" items={o.plans.map((p) => ({ id: p.id, label: p.label, value: p.count }))} />
        </ChartCard>

        <ChartCard id="zones" className="mo-half" title="Members and voters by zone" note={<>{topZone.label} has the most members ({n(topZone.voters + topZone.others)}).</>}
          table={{ head: ['Zone', `Can vote in ${YEAR}`, 'Cannot vote yet', 'Members'], rows: o.zones.map((z) => [z.label, z.voters, z.others, z.voters + z.others]) }}>
          <StackedBars label="Members by zone" parts={[{ name: `Can vote in ${YEAR}`, slot: 1 }, { name: 'Cannot vote yet', slot: 2 }]}
            rows={o.zones.filter((z) => (zone ? z.id === zone : access.inScope(z.id))).map((z) => ({ id: z.id, label: z.label, values: [z.voters, z.others] }))} />
        </ChartCard>

        <ChartCard id="ages" className="mo-half" title="Age groups" note={<>The largest group is <b>{biggestAge.band}</b> ({n(biggestAge.count)} members).</>}
          table={{ head: ['Age', 'Members'], rows: o.ages.map((a) => [a.band, a.count]) }}>
          <Columns label="Members by age group" items={o.ages.map((a) => ({ label: a.band, value: a.count }))} />
        </ChartCard>

        <ChartCard id="joins" className="mo-wide" title="New members by year joined" note={<>Members still on record, by the year they joined. {n(o.joinedThisYear)} so far in {YEAR}.</>}
          table={{ head: ['Year', 'Joined'], rows: o.joins.map((j) => [String(j.year), j.count]) }}>
          <LineChart label="New members by year joined" labels={o.joins.map((j) => String(j.year))} series={[{ id: 'joins', name: 'Joined', values: o.joins.map((j) => j.count), slot: 1, area: true }]} height={220} />
        </ChartCard>

        <ChartCard id="methods" className="mo-side" title={`How ${YEAR} dues were paid`} note={<>{pct(card.count, payTotal)}% paid by card online.</>}
          table={{ head: ['Method', 'Payments'], rows: o.methods.map((m) => [m.label, m.count]) }}>
          <Donut label="Payments by method" centerLabel="payments" items={o.methods.map((m) => ({ id: m.id, label: m.label, value: m.count }))} />
        </ChartCard>
      </div>
    </div>
  );
}
