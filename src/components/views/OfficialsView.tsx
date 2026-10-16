'use client';
/**
 * F5 Elected officials. Tabs in the order of the work: Overview (what needs action, next election) → Board (Shura:
 * 4 officers + Zonal Directors) → Center leadership (Associate Director, Secretaries, Council of Area Representatives
 * with the seat count from the Bylaws formula) → Vacancies (who fills each empty seat) → Rules (Eid dates, website).
 * Everything publishes as the `officials` document. Eligibility is checked against the member records.
 * DEMO (no API). Live: GET/PUT /admin/officials.
 */
import { DashBar, exportPage, useScope as useDashScope } from '@/components/charts/DashKit';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, SwitchRow, Tabs, countIssues } from '@/components/editor/bits';
import { ChartCard, StackedBars, StatTile } from '@/components/charts/Charts';
import {
  AT_LARGE, HOW, KINDS, OFFICERS, SECRETARIES, VACANCY_REASONS, addDays, areaRepSeats, ballotParity, electionDay, fmt, nextElection, oathDay,
  officialsWarnings, seatLabel, termFor, vacancyRule, type Holder, type Kind, type Officials, type PersonFacts,
} from '@/lib/community/officials';
import { OrgStructureSchema, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { useAccess } from '@/lib/access/use-access';
import { AccessSchema, assignmentsOf, mockAccess } from '@/lib/access/access';
import { roleForSeat } from '@/lib/community/officials-access';
import { centerOf, eligibility, fullName, type Member } from '@/lib/members/members';
import { useMembers } from './MembersView';

type Doc = { draft: Officials; setDraft: (f: Officials | ((d: Officials) => Officials)) => void; issues: Record<string, string> };
type Ctx = { linked: Set<string>; map: OrgStructure; facts: (id: string) => PersonFacts | null; voters: Record<string, Record<string, number>>; members: Member[]; today: string; zoneName: (id: string) => string; zoneOfCenter: (c: string) => string };
const todayCT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

export function OfficialsView() {
  return (
    <DocEditor<Officials> storeKey="officials" title="Elected officials" preview={false}
      intro="Who serves in each ISGH office, until when, and which seats are empty – following the Constitution and Bylaws (terms, oath dates, one office per person, who fills a vacancy). Eligibility is checked against the member records.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function useCtx(): Ctx {
  const members = useMembers() ?? [];
  const [map, setMap] = useState<OrgStructure>(mockOrgStructure);
  // Officials ↔ access: which seats already come with system access (Masjid working bodies › Officials and access)
  const [linked, setLinked] = useState<Set<string>>(() => new Set(mockAccess.admins.flatMap((a) => assignmentsOf(a).map((x) => x.holderId).filter(Boolean))));
  useEffect(() => { void fetch('/api/store/admin-access', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = AccessSchema.safeParse(j?.data); if (p.success) setLinked(new Set(p.data.admins.filter((a) => a.status !== 'suspended').flatMap((a) => assignmentsOf(a).map((x) => x.holderId).filter(Boolean)))); }).catch(() => {}); }, []);
  useEffect(() => { void fetch('/api/store/org-structure', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = OrgStructureSchema.safeParse(j?.data); if (p.success) setMap(p.data); }).catch(() => {}); }, []);
  return useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    const voters: Record<string, Record<string, number>> = {};
    for (const m of members) { if (m.archived || !eligibility(m).eligible) continue; const c = centerOf(m); (voters[c] ??= {})[m.zip] = (voters[c][m.zip] ?? 0) + 1; }
    return {
      linked, map, members, voters, today: todayCT(),
      facts: (id: string) => { const m = byId.get(id); return m ? { zip: m.zip, zone: m.zone, center: centerOf(m), eligibleVoter: !m.archived && eligibility(m).eligible, memberSinceYear: m.joined } : null; },
      zoneName: (id: string) => map.zones.find((z) => z.id === id)?.name ?? id,
      zoneOfCenter: (c: string) => map.centers.find((x) => x.name === c)?.zone ?? '',
    };
  }, [members, map, linked]);
}

function Body({ doc }: { doc: Doc }) {
  const ctx = useCtx();
  const [open, setOpen] = useState<string | null>(null);
  const set = (f: (x: Officials) => void) => doc.setDraft((d) => { const c = structuredClone(d); f(c); return c; });
  const warns = officialsWarnings(doc.draft, ctx.map, ctx.facts, ctx.voters, ctx.today);
  const i = open ? doc.draft.holders.findIndex((h) => h.id === open) : -1;
  /** Add a holder for a seat and open it. Elected seats get the term of the latest election for that seat. */
  const fill = (seat: Partial<Holder> & { kind: Kind }, from?: Holder) => {
    const id = `${seat.kind}-${Date.now().toString(36)}`;
    const p = ballotParity({ kind: seat.kind, office: seat.office ?? '', zone: seat.zone ?? '', center: seat.center ?? '' }, ctx.zoneOfCenter);
    let y = Number(ctx.today.slice(0, 4)); if (electionDay(y) > ctx.today) y--; if (p) while ((y % 2 === 0) !== (p === 'even')) y--;
    const term = termFor(y, doc.draft.eidDates);
    const h: Holder = {
      id, office: '', zone: '', center: '', zips: [], atLarge: '', name: '', memberId: '', publicEmail: '', status: 'serving', vacancy: { reason: '', on: '' }, boardTerms: 0, showOnWebsite: true, orientationOn: '',
      ...(from ? { how: 'appointed', termStart: ctx.today, termEnd: from.termEnd, oathOn: '' } : seat.kind === 'secretary' ? { how: 'confirmed', termStart: ctx.today, termEnd: '', oathOn: '' } : { how: 'elected', termStart: term.start, termEnd: term.end, oathOn: '' }),
      ...seat,
    } as Holder;
    set((x) => { if (from) { const k = x.holders.findIndex((q) => q.id === from.id); if (k >= 0) x.holders[k].status = 'ended'; } x.holders.push(h); });
    setOpen(id);
  };
  return (
    <div className={`of${i >= 0 ? ' has-peek' : ''}`}>
      <Tabs label="Elected officials" tabs={[
        { id: 'overview', label: 'Dashboard', render: () => <Overview d={doc.draft} ctx={ctx} warns={warns} onOpen={setOpen} /> },
        { id: 'board', label: 'Board (Shura)', badge: countIssues(doc.issues, ['holders']), render: () => <Board d={doc.draft} ctx={ctx} onOpen={setOpen} onFill={fill} /> },
        { id: 'centers', label: 'Center leadership', render: () => <Centers d={doc.draft} ctx={ctx} onOpen={setOpen} onFill={fill} /> },
        { id: 'vacancies', label: 'Vacancies', badge: doc.draft.holders.filter((h) => h.status === 'vacant').length || undefined, render: () => <Vacancies d={doc.draft} ctx={ctx} onOpen={setOpen} onFill={fill} /> },
        { id: 'rules', label: 'Rules', render: () => <Rules d={doc.draft} set={set} today={ctx.today} /> },
      ]} />
      {i >= 0 && <HolderPanel doc={doc} i={i} ctx={ctx} set={set} onClose={() => setOpen(null)} onFill={fill} />}
    </div>
  );
}

/* ---------------- shared pieces ---------------- */
const serving = (d: Officials) => d.holders.filter((h) => h.status === 'serving');
function Person({ h, ctx, onOpen, label }: { h?: Holder; ctx: Ctx; onOpen: (id: string) => void; label: string }) {
  if (!h) return null;
  const ended = h.termEnd && h.termEnd < ctx.today && h.kind !== 'secretary';
  return (
    <button type="button" className={`of-person${ended ? ' late' : ''}`} data-holder={h.id} onClick={() => onOpen(h.id)}>
      <span className="of-avatar" aria-hidden="true">{h.name ? h.name.split(' ').map((p) => p[0]).slice(0, 2).join('') : '?'}</span>
      <span className="of-who"><small>{label}</small><b>{h.name || 'Vacant'}</b>
        <small>{h.kind === 'secretary' ? HOW[h.how] : `${HOW[h.how]} · until ${fmt(h.termEnd)}`}{ended ? ' · term ended' : ''}</small>
        {h.name && roleForSeat(h, (c) => ctx.map.centers.find((x) => x.name === c)?.zips ?? []) && (ctx.linked.has(h.id)
          ? <small className="of-access yes">{ended ? 'Still has system access' : 'Has system access'}</small>
          : !ended && <small className="of-access no">No system access</small>)}</span>
    </button>
  );
}
function Empty({ label, rule, onFill }: { label: string; rule: string; onFill: () => void }) {
  return (
    <div className="of-person empty"><span className="of-avatar" aria-hidden="true">+</span>
      <span className="of-who"><small>{label}</small><b>Nobody serving</b><small>{rule}</small></span>
      <button type="button" className="btn sm" onClick={onFill}>Fill seat<span className="sr-only"> {label}</span></button>
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ d, ctx, warns: allWarns, onOpen }: { d: Officials; ctx: Ctx; warns: ReturnType<typeof officialsWarnings>; onOpen: (id: string) => void }) {
  const ds = useDashScope('year');
  const [allFix, setAllFix] = useState(false);
  const zoneOfH = (h: Holder) => (h.kind === 'zonal-director' ? h.zone : h.center ? ctx.zoneOfCenter(h.center) : '');
  const inZone = (h: Holder) => (!ds.zone || zoneOfH(h) === ds.zone) && (!ds.masjid || h.center === ds.masjid);
  const s = serving(d).filter(inZone);
  const warns = allWarns.filter((w) => { const h = w.holder ? d.holders.find((x) => x.id === w.holder) : undefined; return h ? inZone(h) : !ds.zone && !ds.masjid; });
  const centers = ctx.map.centers.filter((c) => c.active && (!ds.zone || c.zone === ds.zone) && (!ds.masjid || c.name === ds.masjid));
  const seatsNeeded = (ds.zone || ds.masjid ? 0 : 4) + (ds.masjid ? 0 : ds.zone ? 1 : ctx.map.zones.length) + centers.length + centers.reduce((a, c) => a + areaRepSeats(ctx.voters[c.name] ?? {}).total + 5, 0);
  const filled = s.length;
  let y = Number(ctx.today.slice(0, 4)); if (electionDay(y) < ctx.today) y++;
  const ballot = (h: Holder) => nextElection(h, ctx.zoneOfCenter, ctx.today) === electionDay(y);
  const onBallot = s.filter(ballot);
  const rows = ctx.map.zones.filter((z) => !ds.zone || z.id === ds.zone).map((z) => {
    const cs = centers.filter((c) => c.zone === z.id);
    const need = 1 + cs.reduce((a, c) => a + 1 + 5 + areaRepSeats(ctx.voters[c.name] ?? {}).total, 0);
    const have = s.filter((h) => (h.kind === 'zonal-director' && h.zone === z.id) || cs.some((c) => c.name === h.center)).length;
    return { id: z.id, label: z.name.replace(' Zone', ''), values: [Math.min(have, need), Math.max(0, need - have)] };
  });
  const stop = warns.filter((w) => w.level === 'stop');
  return (
    <div className="of-over">
      <DashBar s={ds} show={{ zone: true, masjid: true }} report={{ href: '/officials?tab=vacancies', label: 'Vacancies' }} onExport={() => exportPage('officials-dashboard', [{ title: 'On the ballot', head: ['Seat', 'Election Day'], rows: onBallot.filter((h) => h.kind !== 'area-rep').map((h) => [seatLabel(h, ctx.zoneName), fmt(electionDay(y))]) }])} />
      <div className="zk-kpis">
        <StatTile id="of-filled" label="Seats filled" value={`${filled} of ${seatsNeeded}`} meter={{ value: filled, of: seatsNeeded }} note="Board, centers, Councils, Secretaries" />
        <StatTile id="of-stop" label="Must be fixed" value={String(stop.length)} tone={stop.length ? 'down' : undefined} note="empty seats, ended terms, eligibility" />
        <StatTile id="of-election" label="Next election" value={fmt(electionDay(y))} note={`${onBallot.length} serving officials on the ballot`} />
        <StatTile id="of-oath" label="Oath of office" value={fmt(oathDay(y, d.eidDates))} note="new terms start (not Eid or New Year weekend)" />
      </div>
      {warns.length > 0 && (
        <section className="glass-pane zk-list of-warns" aria-label="To fix">
          <h2>To fix <span className="pill">{warns.length}</span></h2>
          <ul>{[...warns].sort((a, b) => Number(a.level === 'look') - Number(b.level === 'look')).slice(0, allFix ? 40 : 8).map((w, k) => <li key={k} className={w.level}>{w.holder ? <button type="button" className="linkish" onClick={() => onOpen(w.holder!)}>{w.text}</button> : w.text}</li>)}</ul>
          {warns.length > 8 && <button type="button" className="btn sm ghost" onClick={() => setAllFix(!allFix)}>{allFix ? 'Show fewer' : `Show all ${warns.length}`}</button>}
          {allFix && warns.length > 40 && <p className="muted small">and {warns.length - 40} more.</p>}
          <p className="muted small">Seat counts use the {Object.values(ctx.voters).reduce((a, z) => a + Object.values(z).reduce((b, n) => b + n, 0), 0).toLocaleString('en-US')} eligible voters in the member records today.</p>
        </section>
      )}
      <div className="zk-charts">
        <ChartCard id="of-zones" className="zk-wide" title="Seats by zone" note="Zonal Director, Associate Directors, Secretaries and Area Representatives (seat count from eligible voters per ZIP code)." table={{ head: ['Zone', 'Filled', 'Empty'], rows: rows.map((r) => [r.label, r.values[0], r.values[1]]) }}>
          <StackedBars label="Seats by zone" rows={rows} parts={[{ name: 'Filled', slot: 1 }, { name: 'Empty', slot: 4 }]} />
        </ChartCard>
      </div>
      <section className="glass-pane zk-list" aria-label="On the ballot">
        <h2>On the ballot {fmt(electionDay(y))}</h2>
        <p className="muted">Seats alternate between even and odd years (Bylaws Art. VII Sec. 1). Board members who served two terms in a row cannot run for the same seat.</p>
        <ul className="of-ballot">{onBallot.filter((h) => h.kind !== 'area-rep').map((h) => <li key={h.id}><button type="button" className="linkish" onClick={() => onOpen(h.id)}>{seatLabel(h, ctx.zoneName)}</button> <small>{h.name}{h.boardTerms >= 1 ? ' · cannot run again' : ''}</small></li>)}
          {onBallot.some((h) => h.kind === 'area-rep') && <li>Area Representatives in {Array.from(new Set(onBallot.filter((h) => h.kind === 'area-rep').map((h) => ctx.zoneName(ctx.zoneOfCenter(h.center))))).join(', ')}</li>}</ul>
      </section>
    </div>
  );
}

/* ---------------- Board ---------------- */
function Board({ d, ctx, onOpen, onFill }: { d: Officials; ctx: Ctx; onOpen: (id: string) => void; onFill: (s: Partial<Holder> & { kind: Kind }) => void }) {
  const s = serving(d);
  return (
    <div className="of-board">
      <section className="glass-pane zk-list" aria-label="Executive Body">
        <h2>Executive Body</h2><p className="muted">Four officers elected at large. President and Vice President: two years of membership and able to lead prayers.</p>
        <div className="of-grid">{(Object.keys(OFFICERS) as (keyof typeof OFFICERS)[]).map((o) => {
          const h = s.find((x) => x.kind === 'officer' && x.office === o);
          return h ? <Person key={o} h={h} ctx={ctx} onOpen={onOpen} label={OFFICERS[o]} /> : <Empty key={o} label={OFFICERS[o]} rule={vacancyRule({ kind: 'officer', office: o, termStart: '' }, ctx.today)} onFill={() => onFill({ kind: 'officer', office: o })} />;
        })}</div>
      </section>
      <section className="glass-pane zk-list" aria-label="Zonal Directors">
        <h2>Zonal Directors</h2><p className="muted">Elected by the voters living in each zone; they represent the zone on the Board.</p>
        <div className="of-grid">{ctx.map.zones.filter((z) => z.active).map((z) => {
          const h = s.find((x) => x.kind === 'zonal-director' && x.zone === z.id);
          return h ? <Person key={z.id} h={h} ctx={ctx} onOpen={onOpen} label={z.name} /> : <Empty key={z.id} label={z.name} rule={vacancyRule({ kind: 'zonal-director', office: '', termStart: '' }, ctx.today)} onFill={() => onFill({ kind: 'zonal-director', zone: z.id })} />;
        })}</div>
      </section>
    </div>
  );
}

/* ---------------- Centers ---------------- */
function Centers({ d, ctx, onOpen, onFill }: { d: Officials; ctx: Ctx; onOpen: (id: string) => void; onFill: (s: Partial<Holder> & { kind: Kind }) => void }) {
  const mf = useMasjidFilter();
  const centers = ctx.map.centers.filter((c) => c.active && (!mf.zone || c.zone === mf.zone) && mf.access.inScope(c.zone, c.name));
  const [picked, setC] = useState('');
  // follows the shared "Viewing" masjid; picking one here sets it for every screen
  const c = (mf.masjid && centers.some((x) => x.name === mf.masjid) ? mf.masjid : '') || (centers.some((x) => x.name === picked) ? picked : centers[0]?.name ?? '');
  const s = serving(d).filter((h) => h.center === c);
  const ad = s.find((h) => h.kind === 'associate-director');
  const seats = areaRepSeats(ctx.voters[c] ?? {});
  const reps = s.filter((h) => h.kind === 'area-rep');
  const used = new Set<string>();
  const slots = seats.rows.flatMap((r) => Array.from({ length: r.seats }, (_, k) => {
    const h = reps.find((x) => !used.has(x.id) && (r.atLarge ? x.atLarge === r.atLarge : !x.atLarge && x.zips.some((z) => r.zips.includes(z))));
    if (h) used.add(h.id);
    return { key: `${r.label}-${k}`, row: r, h };
  }));
  const extra = reps.filter((h) => !used.has(h.id));
  return (
    <div className="of-centers">
      <div className="bn-bar"><label className="sr-only" htmlFor="of-center">Islamic Center</label>
        <select id="of-center" className="in pill-select of-center-pick" value={c} onChange={(e) => { setC(e.target.value); if (!mf.lockedMasjid) mf.setMasjid(e.target.value); }}>
          {ctx.map.zones.filter((z) => centers.some((x) => x.zone === z.id)).map((z) => <optgroup key={z.id} label={z.name}>{centers.filter((x) => x.zone === z.id).map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</optgroup>)}
        </select>
      </div>
      <section className="glass-pane zk-list" aria-label="Associate Director and Secretaries">
        <h2>Administrative Body</h2><p className="muted">The Associate Director (elected by the center’s voters) nominates five Secretaries; the Council confirms them.</p>
        <div className="of-grid">
          {ad ? <Person h={ad} ctx={ctx} onOpen={onOpen} label="Associate Director" /> : <Empty label="Associate Director" rule={vacancyRule({ kind: 'associate-director', office: '', termStart: '' }, ctx.today)} onFill={() => onFill({ kind: 'associate-director', center: c })} />}
          {(Object.keys(SECRETARIES) as (keyof typeof SECRETARIES)[]).map((o) => {
            const h = s.find((x) => x.kind === 'secretary' && x.office === o);
            return h ? <Person key={o} h={h} ctx={ctx} onOpen={onOpen} label={SECRETARIES[o]} /> : <Empty key={o} label={SECRETARIES[o]} rule="Nominated by the Associate Director, confirmed by the Council." onFill={() => onFill({ kind: 'secretary', office: o, center: c })} />;
          })}
        </div>
      </section>
      <section className="glass-pane zk-list" aria-label="Council of Representatives">
        <h2>Council of Representatives <span className="pill">{reps.length} of {seats.total}</span></h2>
        <p className="muted">One Area Representative per 40 eligible voters in a ZIP code (at most 2; 4 from a ZIP with 160 or more), small ZIP codes grouped, at least 4 per center, plus a youth and a sister at large when there are more than 10.</p>
        <div className="table-wrap"><table className="t-plain zk-table of-seats">
          <thead><tr><th>Seat</th><th className="num">Eligible voters</th><th>Area Representative</th><th>Term until</th></tr></thead>
          <tbody>{slots.map(({ key, row, h }) => (
            <tr key={key} data-seat={row.label}>
              <td>{row.label}</td><td className="num">{row.voters || '—'}</td>
              <td>{h ? <button type="button" className="zk-name linkish" onClick={() => onOpen(h.id)}>{h.name}</button> : <button type="button" className="btn sm" onClick={() => onFill({ kind: 'area-rep', center: c, zips: row.zips.slice(0, 20), atLarge: row.atLarge ?? '' })}>Fill seat<span className="sr-only"> {row.label}</span></button>}</td>
              <td>{h ? fmt(h.termEnd) : <span className="zn-missing">Empty</span>}</td>
            </tr>
          ))}
          {extra.map((h) => <tr key={h.id} className="of-extra"><td>{seatLabel(h).split(' – ')[1]}</td><td className="num">{h.zips.reduce((a, z) => a + (ctx.voters[c]?.[z] ?? 0), 0) || '—'}</td><td><button type="button" className="zk-name linkish" onClick={() => onOpen(h.id)}>{h.name}</button></td><td>{fmt(h.termEnd)}<small className="block">Elected for these ZIP codes; with today’s voter count the seats change at the next election.</small></td></tr>)}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}

/* ---------------- Vacancies ---------------- */
function Vacancies({ d, ctx, onOpen, onFill }: { d: Officials; ctx: Ctx; onOpen: (id: string) => void; onFill: (s: Partial<Holder> & { kind: Kind }, from?: Holder) => void }) {
  const list = d.holders.filter((h) => h.status === 'vacant');
  return (
    <section className="glass-pane zk-list" aria-label="Vacancies">
      <h2>Vacancies <span className="pill">{list.length}</span></h2>
      <p className="muted">Seats that were held and became empty. Appointees must attend ISGH orientation within a week of their appointment. Seats that were never filled show on the Board and Center leadership tabs.</p>
      <ul className="zk-rows">{list.map((h) => (
        <li key={h.id} className="of-vac" data-vacancy={h.id}>
          <div><b>{seatLabel(h, ctx.zoneName)}</b><small className="block">{h.vacancy.reason ? VACANCY_REASONS[h.vacancy.reason] : ''}{h.vacancy.on ? ` · ${fmt(h.vacancy.on)}` : ''}{h.termEnd ? ` · term until ${fmt(h.termEnd)}` : ''}</small><small className="block of-rule">{vacancyRule(h, ctx.today)}</small></div>
          <div className="row-actions"><button type="button" className="btn sm ghost" onClick={() => onOpen(h.id)}>Details</button>
            {!(h.kind === 'officer' && h.office === 'president') && <button type="button" className="btn sm" onClick={() => onFill({ kind: h.kind, office: h.office, zone: h.zone, center: h.center, zips: h.zips, atLarge: h.atLarge }, h)}>Record appointment<span className="sr-only"> {seatLabel(h, ctx.zoneName)}</span></button>}</div>
        </li>
      ))}</ul>
      {!list.length && <p className="muted">No vacancies.</p>}
    </section>
  );
}

/* ---------------- Rules ---------------- */
function Rules({ d, set, today }: { d: Officials; set: (f: (x: Officials) => void) => void; today: string }) {
  const [eid, setEid] = useState('');
  const y = Number(today.slice(0, 4));
  return (
    <div className="cv">
      <Panel title="Leadership on the website" intro="The public Leadership page lists the people serving (only those marked “Show on the website”).">
        <SwitchRow id="of-web" label="Show the Leadership page" checked={d.website.enabled} onChange={(v) => set((x) => { x.website.enabled = v; })} />
        <SwitchRow id="of-email" label="Show office email addresses" help="Use office addresses (like ad.sw1@isgh.org), not personal ones." checked={d.website.showEmail} onChange={(v) => set((x) => { x.website.showEmail = v; })} />
        <SwitchRow id="of-zip" label="“Who represents me?” – find representatives by ZIP code" checked={d.website.findByZip} onChange={(v) => set((x) => { x.website.findByZip = v; })} />
      </Panel>
      <Panel title="Eid dates" intro="The oath of office (and the election) moves to the next Sunday when it falls in the three days of Eid. Enter the first day of each Eid.">
        <ul className="of-eid">{d.eidDates.map((e, k) => <li key={e}><span>{fmt(e)} – {fmt(addDays(e, 2))}</span><button type="button" className="linkish" onClick={() => set((x) => { x.eidDates.splice(k, 1); })}>Remove<span className="sr-only"> {fmt(e)}</span></button></li>)}</ul>
        <div className="dn-addfund"><input className="in" type="date" aria-label="First day of Eid" value={eid} onChange={(e) => setEid(e.target.value)} /><button type="button" className="btn" disabled={!eid || d.eidDates.includes(eid)} onClick={() => { set((x) => { x.eidDates = [...x.eidDates, eid].sort(); }); setEid(''); }}>Add Eid</button></div>
      </Panel>
      <Panel title="Election and oath dates" intro="Election: second Sunday of December. Oath: first Sunday of January (not the New Year weekend or Eid), or the second Sunday after the election if later.">
        <div className="table-wrap"><table className="t-plain zk-table of-dates"><thead><tr><th>Election</th><th>Oath and new terms</th><th>On the ballot</th></tr></thead>
          <tbody>{[y, y + 1, y + 2].map((yr) => <tr key={yr}><td>{fmt(electionDay(yr))}</td><td>{fmt(oathDay(yr, d.eidDates))}</td><td><small>{yr % 2 === 0 ? 'President, General Secretary, Directors North and Southwest; Associate Directors Northwest, South, Southeast; Area Representatives North and Southwest' : 'Vice President, Treasurer, Directors Northwest, South, Southeast; Associate Directors North and Southwest; Area Representatives Northwest, South, Southeast'}</small></td></tr>)}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}

/* ---------------- side panel ---------------- */
function Field({ label, err, hint, children }: { label: string; err?: string; hint?: ReactNode; children: ReactNode }) {
  return <label className="sf-field"><span className="sf-label">{label}</span>{children}{hint && <small className="sf-hint">{hint}</small>}{err && <small className="sf-err">{err}</small>}</label>;
}
function HolderPanel({ doc, i, ctx, set, onClose, onFill }: { doc: Doc; i: number; ctx: Ctx; set: (f: (x: Officials) => void) => void; onClose: () => void; onFill: (s: Partial<Holder> & { kind: Kind }, from?: Holder) => void }) {
  const access = useAccess();
  const h = doc.draft.holders[i];
  const e = (f: string) => doc.issues[`holders.${i}.${f}`];
  const up = (p: Partial<Holder>) => set((x) => { x.holders[i] = { ...x.holders[i], ...p }; });
  const m = h.memberId ? ctx.members.find((x) => x.id === h.memberId) : undefined;
  const mine = officialsWarnings(doc.draft, ctx.map, ctx.facts, ctx.voters, ctx.today).filter((w) => w.holder === h.id);
  const board = h.kind === 'officer' || h.kind === 'zonal-director';
  const next = nextElection(h, ctx.zoneOfCenter, ctx.today);
  const canEdit = access.can('officials.manage');
  return (
    <aside className="m-peek zk-case of-peek glass-float" aria-label={seatLabel(h, ctx.zoneName)} data-open-holder={h.id}>
      <div className="m-peek-top"><span className="m-peek-pos">{KINDS[h.kind]}</span><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /></svg></button></div>
      <div><h2 className="zk-case-h">{h.name || 'Vacant seat'}</h2><p className="muted">{seatLabel(h, ctx.zoneName)}</p>
        <p className="m-peek-status"><span className={`pill ${h.status === 'serving' ? 'good' : h.status === 'vacant' ? 'warn' : ''}`}>{h.status === 'serving' ? 'Serving' : h.status === 'vacant' ? 'Vacant' : 'Ended'}</span>{next && <span className="pill">On the ballot {fmt(next)}</span>}</p></div>
      {mine.length > 0 && <ul className="notice warn-note of-mine" role="alert">{mine.map((w, k) => <li key={k}>{w.text.split(': ').slice(1).join(': ') || w.text}</li>)}</ul>}
      <fieldset className="m-form bn-form" disabled={!canEdit}>
        <Field label="Name" err={e('name')}><input className="in" aria-label="Official name" value={h.name} onChange={(ev) => up({ name: ev.target.value })} /></Field>
        <Field label="Member ID" err={e('memberId')} hint={m ? `${fullName(m)} · ZIP ${m.zip} · ${centerOf(m)} · member since ${m.joined} · ${eligibility(m).eligible ? 'eligible voter' : 'not an eligible voter'}` : 'Links the member record so eligibility and residence are checked.'}>
          <span className="of-idrow"><input className="in" aria-label="Member ID" placeholder="HOU-204781" value={h.memberId} onChange={(ev) => up({ memberId: ev.target.value.trim().toUpperCase() })} />{m && !h.name && <button type="button" className="btn sm" onClick={() => up({ name: fullName(m) })}>Use name</button>}</span>
        </Field>
        {h.kind === 'area-rep' && <div className="field-row">
          <Field label="ZIP codes represented" err={e('zips')}><input className="in" aria-label="ZIP codes represented" value={h.zips.join(', ')} disabled={!!h.atLarge} onChange={(ev) => up({ zips: ev.target.value.split(/[\s,]+/).filter(Boolean) })} /></Field>
          <Field label="At-large seat"><select className="in" aria-label="At-large seat" value={h.atLarge} onChange={(ev) => up({ atLarge: ev.target.value as Holder['atLarge'], zips: ev.target.value ? [] : h.zips })}><option value="">No – a ZIP code seat</option>{Object.entries(AT_LARGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>}
        <Field label="Office email (website)" err={e('publicEmail')}><input className="in" aria-label="Office email" type="email" value={h.publicEmail} onChange={(ev) => up({ publicEmail: ev.target.value })} /></Field>
        <div className="field-row">
          <Field label="How"><select className="in" aria-label="How they got the seat" value={h.how} onChange={(ev) => up({ how: ev.target.value as Holder['how'] })}>{Object.entries(HOW).filter(([k]) => (h.kind === 'secretary') === (k === 'confirmed' || k === 'acting')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          {board && <Field label="Earlier Board terms" hint="Two in a row: cannot run for the same seat. Five in all: no more Board terms."><input className="in in-num" aria-label="Earlier Board terms" type="number" min="0" max="20" value={h.boardTerms} onChange={(ev) => up({ boardTerms: Number(ev.target.value || 0) })} /></Field>}
        </div>
        <div className="field-row">
          <Field label={h.kind === 'secretary' ? 'Confirmed on' : 'Term starts'}><input className="in" aria-label="Term starts" type="date" value={h.termStart} onChange={(ev) => up({ termStart: ev.target.value })} /></Field>
          {h.kind !== 'secretary' && <Field label="Term ends" err={e('termEnd')}><input className="in" aria-label="Term ends" type="date" value={h.termEnd} onChange={(ev) => up({ termEnd: ev.target.value })} /></Field>}
        </div>
        {h.kind !== 'secretary' && <div className="field-row">
          <Field label="Oath of office taken"><input className="in" aria-label="Oath taken" type="date" value={h.oathOn} onChange={(ev) => up({ oathOn: ev.target.value })} /></Field>
          {h.how === 'appointed' && <Field label="ISGH orientation attended" hint={h.termStart ? `By ${fmt(addDays(h.termStart, 7))} at the latest.` : undefined}><input className="in" aria-label="Orientation attended" type="date" value={h.orientationOn} onChange={(ev) => up({ orientationOn: ev.target.value })} /></Field>}
        </div>}
        <label className="check"><input type="checkbox" checked={h.showOnWebsite} onChange={(ev) => up({ showOnWebsite: ev.target.checked })} /> <span>Show on the website’s Leadership page</span></label>
      </fieldset>
      {canEdit && h.status === 'serving' && (
        <div className="zk-act"><h3>Seat becomes empty</h3>
          <div className="field-row">
            <Field label="Why"><select className="in" aria-label="Why the seat is empty" value={h.vacancy.reason} onChange={(ev) => up({ vacancy: { reason: ev.target.value as Holder['vacancy']['reason'], on: h.vacancy.on || ctx.today } })}><option value="">Choose…</option>{Object.entries(VACANCY_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Since"><input className="in" aria-label="Vacant since" type="date" value={h.vacancy.on} onChange={(ev) => up({ vacancy: { ...h.vacancy, on: ev.target.value } })} /></Field>
          </div>
          <p className="sf-hint">{vacancyRule(h, ctx.today)}</p>
          <button type="button" className="btn" disabled={!h.vacancy.reason} onClick={() => {
            if (h.kind === 'officer' && h.office === 'president') {
              set((x) => { const vp = x.holders.find((q) => q.status === 'serving' && q.kind === 'officer' && q.office === 'vice-president'); x.holders[i] = { ...x.holders[i], status: 'ended' }; if (vp) { x.holders.push({ ...vp, id: `president-${Date.now().toString(36)}`, office: 'president', how: 'appointed', termStart: ctx.today, termEnd: h.termEnd, oathOn: '', orientationOn: ctx.today }); vp.status = 'vacant'; vp.vacancy = { reason: 'other', on: ctx.today }; } });
            } else up({ status: 'vacant', name: h.name });
          }}>{h.kind === 'officer' && h.office === 'president' ? 'Vice President becomes President' : 'Mark as vacant'}</button>
        </div>
      )}
      {canEdit && h.status === 'vacant' && !(h.kind === 'officer' && h.office === 'president') && <div className="zk-act"><p className="sf-hint">{vacancyRule(h, ctx.today)}</p><button type="button" className="btn primary" onClick={() => onFill({ kind: h.kind, office: h.office, zone: h.zone, center: h.center, zips: h.zips, atLarge: h.atLarge }, h)}>Record appointment</button></div>}
      {canEdit && !h.name && h.status !== 'vacant' && <div className="zk-act"><button type="button" className="btn ghost danger-ghost" onClick={() => { set((x) => { x.holders.splice(i, 1); }); onClose(); }}>Remove this empty entry</button></div>}
    </aside>
  );
}
