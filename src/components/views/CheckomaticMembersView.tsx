'use client';
/**
 * D10 – Members › Check-o-matic (the membership department's own reconciliation, from the 10/17 review call).
 * Every monthly giver's contributions for the year are pulled from Donations and held against the
 * "Monthly contributors are members" rule (Membership rules › Plans and dues): is this person a member? have the
 * contributions reached the yearly total by the cut-off? Members are tagged by the rule; people the system does not
 * know are a work list – contact them, tag them "eligible, information not provided", or start their application.
 * Needs only "See members" – no donation permission, which is what the office asked for.
 * DEMO: tags stay in this browser. Live: GET /admin/members/checkomatic, PUT /admin/members/checkomatic/:key/tag.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '@/components/charts/DashKit';
import { StatTile } from '@/components/charts/Charts';
import { useAccess } from '@/lib/access/use-access';
import { useMembershipSettings } from '@/lib/members/use-settings';
import { useDonations } from '@/lib/donations/use-donations';
import { usd, type Donation } from '@/lib/community/donations';
import { formatUSD, qualifiesByGifts, type MembershipRules } from '@/lib/content/membership';
import { addImportedMembers, centerOf, fmtDate, fullName, nextImportId, saveMember, YEAR, type Member } from '@/lib/members/members';
import { useMembers } from './MembersView';
import { LIVE } from '@/lib/live/live';

type Tag = { kind: 'contacted' | 'eligible-no-info' | 'not-interested' | 'application'; at: string; by: string; note?: string };
const TAG_LABEL: Record<Tag['kind'], string> = { contacted: 'Contacted', 'eligible-no-info': 'Eligible – information not provided', 'not-interested': 'Not interested', application: 'Application started' };
const KEY = 'ms:checkomatic-tags';
const readTags = (): Record<string, Tag> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const TODAY = LIVE ? new Date().toISOString().slice(0, 10) : '2026-10-15';

export type Giver = {
  key: string; name: string; email: string; memberId: string; center: string;
  gifts: { on: string; cents: number; recurring: boolean }[]; monthly: number; total: number; yearTotal: number; needed: number; ok: boolean; by: string; lastOn: string;
  member: Member | null;
};

/** DEMO: a recurring gift stands for a monthly plan – one instance each month from its start to today (live: the platform's own list). */
function monthlyInstances(d: Donation, today: string): { on: string; cents: number; recurring: boolean }[] {
  if (!d.recurring || d.refunded) return [{ on: d.at.slice(0, 10), cents: d.amountCents, recurring: false }];
  const out: { on: string; cents: number; recurring: boolean }[] = [];
  // demo: the plan has been running for a while (3–11 months, by amount) – the platform's record would say since when
  const start = new Date(`${d.at.slice(0, 10)}T12:00:00Z`); start.setUTCMonth(start.getUTCMonth() - (3 + (d.amountCents / 100) % 9)); const end = new Date(`${today}T12:00:00Z`);
  for (let t = new Date(start); t <= end; t.setUTCMonth(t.getUTCMonth() + 1)) out.push({ on: t.toISOString().slice(0, 10), cents: d.amountCents, recurring: true });
  return out;
}

/** Group the year's gifts by giver and hold them against the rule. */
export function buildGivers(donations: Donation[], members: Member[], rule: MembershipRules['qualifyingGifts'], year: number, today = TODAY): Giver[] {
  const byId = new Map(members.map((m) => [m.id, m])); const byEmail = new Map(members.map((m) => [m.email.toLowerCase(), m]));
  const groups = new Map<string, Giver>();
  for (const d of donations) {
    if (d.donor.anonymous || d.refunded) continue;
    const instances = (LIVE ? [{ on: d.at.slice(0, 10), cents: d.amountCents, recurring: d.recurring }] : monthlyInstances(d, today)).filter((g) => g.on.slice(0, 4) === String(year));
    if (!instances.length) continue;
    if (rule.countsGifts === 'recurring' && !d.recurring) continue;
    const key = d.donor.memberId || d.donor.email.toLowerCase() || d.donor.name;
    const g = groups.get(key) ?? { key, name: d.donor.name, email: d.donor.email, memberId: d.donor.memberId, center: d.center, gifts: [], monthly: 0, total: 0, yearTotal: 0, needed: 0, ok: false, by: '', lastOn: '', member: null };
    g.gifts.push(...instances); g.monthly = Math.max(g.monthly, d.recurring ? d.amountCents : 0); if (d.center) g.center = d.center;
    groups.set(key, g);
  }
  const out: Giver[] = [];
  for (const g of groups.values()) {
    const q = qualifiesByGifts(rule, g.gifts, year);
    g.total = q.total; g.yearTotal = g.gifts.reduce((a, x) => a + x.cents, 0); g.needed = q.needed; g.ok = q.ok; g.by = q.by; g.lastOn = g.gifts.map((x) => x.on).sort().pop() ?? '';
    g.member = (g.memberId && byId.get(g.memberId)) || (g.email && byEmail.get(g.email.toLowerCase())) || null;
    if (g.member) { g.name = fullName(g.member); g.memberId = g.member.id; }
    out.push(g);
  }
  return out.sort((a, b) => Number(!!a.member) - Number(!!b.member) || b.total - a.total);
}

type Filter = 'all' | 'members' | 'unknown' | 'qualified' | 'short';

export function CheckomaticMembersView() {
  const access = useAccess();
  const settings = useMembershipSettings();
  const rule = settings.rules.qualifyingGifts;
  const plan = settings.plans.find((p) => p.id === rule.planId);
  const donations = useDonations();
  const members = useMembers() ?? [];
  const [tags, setTags] = useState<Record<string, Tag>>({});
  useEffect(() => { setTags(readTags()); }, []);
  const tag = (key: string, t: Tag['kind'], note?: string) => { const next = { ...readTags(), [key]: { kind: t, at: new Date().toISOString(), by: access.me?.name ?? 'Membership office', note } }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* */ } setTags(next); };
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const givers = useMemo(() => buildGivers(donations, members, rule, YEAR).filter((g) => !g.member || access.inScope(g.member.zone, centerOf(g.member), g.member.zip)), [donations, members, rule, access.ready, access.me?.id, access.dashIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = givers.filter((g) => (filter === 'all' || (filter === 'members' && g.member) || (filter === 'unknown' && !g.member) || (filter === 'qualified' && g.ok) || (filter === 'short' && !g.ok)))
    .filter((g) => !q || `${g.name} ${g.email} ${g.memberId} ${g.center}`.toLowerCase().includes(q.toLowerCase()));
  const nMembers = givers.filter((g) => g.member).length, nUnknown = givers.length - nMembers, nOk = givers.filter((g) => g.ok).length;
  const canAct = access.can('members.edit');
  const md = (x: string) => new Date(`2001-${x}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const startApplication = (g: Giver) => {
    const [first, ...rest] = g.name.replace(/^Donor\s+/, '').split(' ');
    const m: Member = { id: nextImportId(members), first: first || 'Donor', last: rest.join(' ') || g.name, email: g.email, phone: '', dob: '', street: '', city: '', zip: '', zone: 'sw', center: g.center,
      plan: (rule.planId || 'single') as Member['plan'], joined: YEAR, appliedOn: TODAY, approvedOn: null, idCheck: 'not_started', standing: 'good', payments: [], notes: [{ at: new Date().toISOString(), by: access.me?.name ?? 'Membership office', text: `Started from Check-o-matic: ${formatUSD(g.total)} given in ${YEAR} (${g.gifts.length} monthly gifts).` }],
      audit: [{ at: new Date().toISOString(), by: 'Check-o-matic', action: 'Application from monthly giving', detail: `${formatUSD(g.total)} in ${YEAR}` }], commitment: 'contribution', source: 'import' };
    addImportedMembers([m]); tag(g.key, 'application');
  };
  const noteMember = (g: Giver) => { if (!g.member) return; saveMember(g.member, 'Check-o-matic reviewed', g.ok ? `${formatUSD(g.total)} by ${fmtDate(g.by)} – qualifies` : `${formatUSD(g.total)} given – ${formatUSD(g.needed)} short of ${formatUSD(rule.totalCents)}`); tag(g.key, 'contacted', 'reviewed'); };
  const exp = () => downloadCsv('checkomatic-members', ['Giver', 'Email', 'Member ID', 'Center', 'Monthly', `Given in ${YEAR}`, 'Needed', 'Qualifies', 'Status', 'Tag'],
    list.map((g) => [g.name, g.email, g.memberId, g.center, usd(g.monthly), usd(g.yearTotal), usd(g.needed), g.ok ? 'yes' : 'no', g.member ? 'Member' : 'Not in the system', tags[g.key] ? TAG_LABEL[tags[g.key].kind] : '']));

  if (!rule.enabled) return (
    <div className="page cm"><header className="page-head"><div><h1>Check-o-matic</h1><p className="page-intro">The “monthly contributors are members” rule is off for this organization.</p></div></header>
      <p className="notice glass-pane">Turn it on under <Link href="/membership?tab=plans">Membership rules › Plans and dues › Rules</Link> and the monthly givers appear here, held against the rule.</p></div>
  );
  return (
    <div className="page cm">
      <header className="page-head">
        <div>
          <h1>{rule.label || 'Check-o-matic'} <span className="pill">{YEAR}</span></h1>
          <p className="page-intro">Monthly givers held against the rule: at least {formatUSD(rule.minMonthlyCents)} a month, {formatUSD(rule.totalCents)} by {md(rule.cutoff)}{rule.coversSpouse ? ', you and your spouse' : ''} → {plan?.name ?? 'member'}. Members are tagged by the rule; people not in the system are your work list. The money itself stays with <Link href="/donations?tab=checkomatic">Donations</Link>.</p>
        </div>
        <div className="page-actions"><button type="button" className="btn" onClick={exp}>Download CSV</button></div>
      </header>
      <div className="mo-kpis cm-kpis">
        <StatTile id="cm-all" hero label="Monthly givers" value={String(givers.length)} note={`${nOk} already qualify for ${YEAR}`} meter={{ value: nOk, of: Math.max(1, givers.length) }} />
        <StatTile id="cm-members" label="Members" value={String(nMembers)} note="matched to a member record – tagged by the rule" />
        <StatTile id="cm-unknown" label="Not in the system" value={String(nUnknown)} note="contact them or tag them" tone={nUnknown ? 'down' : undefined} />
        <StatTile id="cm-short" label={`Short of ${formatUSD(rule.totalCents)}`} value={String(givers.length - nOk)} note={`by ${md(rule.cutoff)} to count for ${YEAR}`} />
      </div>
      <section className="glass-pane zk-list cm-list" aria-label="Monthly givers">
        <div className="chip-row" role="group" aria-label="Show">
          {([['all', 'All'], ['members', 'Members'], ['unknown', 'Not in the system'], ['qualified', 'Qualify'], ['short', 'Short']] as const).map(([f, l]) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l}</button>)}
          <label className="sr-only" htmlFor="cm-q">Search</label><input id="cm-q" className="in sm cm-search" placeholder="Name, email, member ID, center" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-wrap"><table className="t-plain zk-table cm-table">
          <thead><tr><th>Giver</th><th className="num">Monthly</th><th className="num">Given in {YEAR}</th><th>Rule</th><th>Membership</th><th>Tag</th><th /></tr></thead>
          <tbody>{list.map((g) => {
            const t = tags[g.key];
            return (
              <tr key={g.key} data-giver={g.key} className={g.member ? 'is-member' : 'is-unknown'}>
                <td>{g.member ? <Link href={`/members/${g.member.id}`}><b>{g.name}</b></Link> : <b>{g.name}</b>}<small className="block">{g.email || 'no email'} · {g.center.replace(' Islamic Center', ' IC') || 'center unknown'} · last gift {fmtDate(g.lastOn)}</small></td>
                <td className="num">{g.monthly ? usd(g.monthly) : '—'}</td>
                <td className="num"><b>{usd(g.yearTotal)}</b><small className="block">{g.gifts.length} gift{g.gifts.length === 1 ? '' : 's'}{g.yearTotal !== g.total ? ` · ${usd(g.total)} counted by ${md(rule.cutoff)}` : ''}</small></td>
                <td>{g.ok ? <span className="pill good">Qualifies by {fmtDate(g.by)}</span> : <span className="pill warn">{usd(g.needed)} short</span>}<div className="cm-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round((g.total / Math.max(1, rule.totalCents)) * 100))}%` }} /></div></td>
                <td>{g.member ? <span className="pill good">Member · {g.member.id}</span> : <span className="pill">Not in the system</span>}</td>
                <td>{t ? <span className={`pill ${t.kind === 'application' ? 'good' : ''}`} title={`${t.by} · ${new Date(t.at).toLocaleDateString('en-US')}`}>{TAG_LABEL[t.kind]}</span> : <span className="muted small">—</span>}</td>
                <td className="row-actions">
                  {g.member && canAct && <button type="button" className="btn sm" onClick={() => noteMember(g)}>Note on the record<span className="sr-only"> {g.name}</span></button>}
                  {!g.member && canAct && <>
                    <button type="button" className="btn sm" onClick={() => tag(g.key, 'contacted')}>Contacted<span className="sr-only"> {g.name}</span></button>
                    <button type="button" className="btn sm" onClick={() => tag(g.key, 'eligible-no-info')}>Eligible, no information<span className="sr-only"> {g.name}</span></button>
                    {g.ok && t?.kind !== 'application' && <button type="button" className="btn sm primary" onClick={() => startApplication(g)}>Start application<span className="sr-only"> {g.name}</span></button>}
                  </>}
                </td>
              </tr>
            );
          })}{!list.length && <tr><td colSpan={7} className="empty">No monthly givers match.</td></tr>}</tbody>
        </table></div>
        <p className="muted small">The rule and its numbers live in Membership rules › Plans and dues. Another organization turns the rule off, or sets its own monthly minimum, yearly total and cut-off date.</p>
      </section>
    </div>
  );
}
