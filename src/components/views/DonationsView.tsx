'use client';
/**
 * F3 Donations. Tabs in the order of the work: Overview → All gifts → Reconciliation (fix what we cannot place) →
 * Check-o-matic (gifts that lead to membership). Cash and checks are recorded here; online gifts arrive by themselves.
 * Center-limited roles see the gifts of their centers. DEMO: saved in this browser.
 */
import { DashBar, exportPage, useScope as useDashScope } from '@/components/charts/DashKit';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import { useMemo, useState, type FormEvent } from 'react';
import { Tabs } from '@/components/editor/bits';
import { ChartCard, Columns, ShareBar, StackedBars, StatTile } from '@/components/charts/Charts';
import {
  CHECKOMATIC_MODES, ONLINE, ONLINE_PLATFORMS, PLATFORMS, RECON_LABEL, checkomatic, checkomaticDonors, donationStats, entryProblems, needsReceipt, netOf, reconState, routedCenter, usd,
  type Donation, type DonationSettings, type Platform, type ReconState,
} from '@/lib/community/donations';
import type { OrgStructure } from '@/lib/community/org-structure';
import { useAccess } from '@/lib/access/use-access';
import { nextDonationId, saveDonation, useDonationContext, useDonations } from '@/lib/donations/use-donations';
import { useMembers } from './MembersView';
import { addImportedMembers, nextImportId, centersOf, type Member, ORG_TZ } from '@/lib/members/members';
import { csvCell } from '@/lib/community/member-records';

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: ORG_TZ, month: '2-digit', day: '2-digit', year: 'numeric' });
const TONE: Record<ReconState, string> = { matched: 'good', unmatched: 'warn', pending: '', refunded: 'bad' };

export function DonationsView() {
  const access = useAccess();
  const all = useDonations();
  const { settings: s, map } = useDonationContext();
  const [open, setOpen] = useState<string | null>(null);
  const [entry, setEntry] = useState(false);
  const zoneOf = (center: string) => map.centers.find((c) => c.name === center)?.zone ?? '';
  const list = useMemo(() => all.filter((d) => access.inScope(zoneOf(d.center), d.center)), [all, map, access.ready, access.me?.id, access.dashIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = donationStats(list, s);
  const canFix = access.can('donations.reconcile');
  const openGift = list.find((d) => d.id === open);
  return (
    <div className={`page dn${openGift ? ' has-peek' : ''}`}>
      <header className="page-head">
        <div><h1>Donations</h1><p className="page-intro">Every gift – online and in person – with its fund, center and receipt. {access.role?.centerScoped ? `Gifts at ${access.me?.centers.join(', ')}.` : 'All centers.'} Demo gifts, saved in this browser.</p></div>
        <div className="page-actions">{canFix && <button type="button" className="btn primary" onClick={() => setEntry(true)}>Record cash or check</button>}</div>
      </header>
      <Tabs label="Donations" tabs={[
        { id: 'overview', label: 'Dashboard', render: () => <Overview list={list} s={s} st={st} /> },
        { id: 'gifts', label: 'All gifts', render: () => <Gifts list={list} s={s} onOpen={setOpen} /> },
        { id: 'recon', label: 'Reconciliation', badge: st.recon.find((r) => r.id === 'unmatched')?.count || undefined, render: () => <Recon list={list} s={s} canFix={canFix} onOpen={setOpen} /> },
        { id: 'checkomatic', label: 'Check-o-matic', render: () => <Checkomatic list={list} s={s} map={map} canAct={access.can('members.edit') || access.can('members.archive')} /> },
      ]} />
      {openGift && <GiftPanel d={openGift} s={s} canFix={canFix} onClose={() => setOpen(null)} />}
      {entry && <EntryDialog s={s} map={map} all={all} onClose={() => setEntry(false)} onSaved={(id) => { setEntry(false); setOpen(id); }} />}
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ list: all, s }: { list: Donation[]; s: DonationSettings; st?: ReturnType<typeof donationStats> }) {
  const sc = useDashScope('12m');
  const list = all.filter((d) => sc.match(d.at, routedCenter(d, s)));
  const st = donationStats(list, s);
  const centers = Array.from(new Set(list.map((d) => routedCenter(d, s)))).map((c) => ({ id: c, label: c.replace(' Islamic Center', ''), values: [list.filter((d) => routedCenter(d, s) === c && !d.refunded && ONLINE.includes(d.platform)).reduce((t, d) => t + d.amountCents, 0) / 100, list.filter((d) => routedCenter(d, s) === c && !d.refunded && !ONLINE.includes(d.platform)).reduce((t, d) => t + d.amountCents, 0) / 100] })).sort((a, b) => b.values[0] + b.values[1] - (a.values[0] + a.values[1]));
  const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
  return (
    <div className="dn-over">
      <DashBar s={sc} show={{ period: 'past', zone: true, masjid: true }} report={{ href: '/donations?tab=gifts', label: 'All gifts' }} onExport={() => exportPage('donations-dashboard')} />
      <div className="zk-kpis">
        <StatTile id="gross" label="Given" value={usd(st.grossCents)} note={`${st.count} gifts · ${st.recurring} monthly`} />
        <StatTile id="net" label="After platform fees" value={usd(st.netCents)} note={`${usd(st.feesCents)} in fees`} />
        <StatTile id="receipts" label="Receipts to send" value={String(st.receiptsDue)} tone={st.receiptsDue ? 'down' : undefined} note={`gifts of ${usd(s.receiptAboveCents)} or more`} />
        <StatTile id="checkomatic" label="Check-o-matic donors" value={String(st.checkomatic)} note={CHECKOMATIC_MODES[s.checkomatic.mode].split(' – ')[0]} />
      </div>
      <div className="zk-charts">
        <ChartCard id="dn-recon" className="zk-wide" title="Reconciliation" note="Every gift should end up matched: right fund, known donor, money in the bank." table={{ head: ['State', 'Gifts'], rows: st.recon.map((r) => [r.label, r.count]) }}>
          <ShareBar label="Gifts by reconciliation state" items={st.recon.map((r) => ({ id: r.id, label: r.label, value: r.count }))} />
        </ChartCard>
        <ChartCard id="dn-fund" title="By fund" table={{ head: ['Fund', 'Given'], rows: st.byFund.map((f) => [f.label, usd(f.cents)]) }}>
          <Columns label="Given by fund" items={st.byFund.map((f) => ({ label: f.label.split(' ')[0], value: Math.round(f.cents / 100) }))} ramp={false} format={(v) => `$${v.toLocaleString('en-US')}`} />
        </ChartCard>
        <ChartCard id="dn-platform" title="How people give" table={{ head: ['Way', 'Given'], rows: st.byPlatform.map((p) => [p.label, usd(p.cents)]) }}>
          <Columns label="Given by platform" items={st.byPlatform.map((p) => ({ label: p.label.split(' ')[0], value: Math.round(p.cents / 100) }))} ramp={false} format={(v) => `$${v.toLocaleString('en-US')}`} />
        </ChartCard>
        <ChartCard id="dn-center" className="zk-wide" title="By center (after fund routing)" note={`Zakat and Ramadan gifts go to ${s.mainCenter || 'the main center'}; Education is shared by all centers.`} table={{ head: ['Center', 'Online', 'Cash and checks'], rows: centers.map((c) => [c.id, money(c.values[0]), money(c.values[1])]) }}>
          <StackedBars label="Given by center" parts={[{ name: 'Online', slot: 1 }, { name: 'Cash and checks', slot: 2 }]} rows={centers} format={money} />
        </ChartCard>
      </div>
    </div>
  );
}

/* ---------------- All gifts ---------------- */
function Gifts({ list, s, onOpen }: { list: Donation[]; s: DonationSettings; onOpen: (id: string) => void }) {
  const [q, setQ] = useState(''); const [fund, setFund] = useState(''); const [plat, setPlat] = useState(''); const [state, setState] = useState(''); const [receipt, setReceipt] = useState(false);
  const mf = useMasjidFilter();
  const rows = list.filter((d) => mf.keep('', routedCenter(d, s)) && (!fund || d.fund === fund) && (!plat || d.platform === plat) && (!state || reconState(d) === state) && (!receipt || needsReceipt(d, s))
    && (!q || `${d.id} ${d.donor.name} ${d.donor.email} ${d.ref} ${d.center}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.at.localeCompare(a.at));
  const fundName = (id: string) => s.funds.find((f) => f.id === id)?.name ?? '';
  const csv = () => {
    const out = [['Gift', 'Date', 'Donor', 'Email', 'Member ID', 'Amount', 'Fee', 'Net', 'Fund', 'Center', 'Booked to', 'How', 'Reference', 'Deposit', 'State'], ...rows.map((d) => [d.id, fmtDay(d.at), d.donor.anonymous ? 'Anonymous' : d.donor.name, d.donor.email, d.donor.memberId, usd(d.amountCents), usd(d.feeCents), usd(netOf(d)), fundName(d.fund), d.center, routedCenter(d, s), PLATFORMS[d.platform], d.ref, d.payout, RECON_LABEL[reconState(d)]])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `donations-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <section className="zk-list glass-pane" aria-label="All gifts">
      <div className="zk-filters">
        <MasjidPicker unrouted />
        <label className="m-search"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" /></svg><span className="sr-only">Search gifts</span><input className="in" type="search" placeholder="Donor, email, gift or check number" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="in pill-select" aria-label="Fund" value={fund} onChange={(e) => setFund(e.target.value)}><option value="">All funds</option>{s.funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <select className="in pill-select" aria-label="How given" value={plat} onChange={(e) => setPlat(e.target.value)}><option value="">Every way</option>{(Object.keys(PLATFORMS) as Platform[]).map((p) => <option key={p} value={p}>{PLATFORMS[p]}</option>)}</select>
        <select className="in pill-select" aria-label="State" value={state} onChange={(e) => setState(e.target.value)}><option value="">Any state</option>{(Object.keys(RECON_LABEL) as ReconState[]).map((k) => <option key={k} value={k}>{RECON_LABEL[k]}</option>)}</select>
        <label className="check"><input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} /> <span>Receipt to send</span></label>
        <button type="button" className="btn sm ghost" onClick={csv} disabled={!rows.length}>Download CSV</button>
      </div>
      <p className="m-count">{rows.length} gift{rows.length === 1 ? '' : 's'} · {usd(rows.reduce((t, d) => t + (d.refunded ? 0 : d.amountCents), 0))}</p>
      <div className="table-wrap"><table className="t-plain zk-table">
        <thead><tr><th>Donor</th><th className="num">Amount</th><th>Fund</th><th>Center</th><th>How</th><th>State</th></tr></thead>
        <tbody>{rows.map((d) => (
          <tr key={d.id} data-gift={d.id} onClick={() => onOpen(d.id)}>
            <td><b>{d.donor.anonymous ? 'Anonymous' : d.donor.name}</b><small className="block">{d.id} · {fmtDay(d.at)}{d.recurring ? ' · monthly' : ''}</small></td>
            <td className="num">{usd(d.amountCents)}{d.feeCents > 0 && <small className="block">net {usd(netOf(d))}</small>}</td>
            <td>{fundName(d.fund) || <span className="zn-missing">Unknown</span>}</td>
            <td>{d.center.replace(' Islamic Center', '')}{routedCenter(d, s) !== d.center && <small className="block">→ {routedCenter(d, s).replace(' Islamic Center', '')}</small>}</td>
            <td>{PLATFORMS[d.platform].split(' (')[0]}<small className="block">{d.ref}</small></td>
            <td><span className={`pill ${TONE[reconState(d)]}`}>{RECON_LABEL[reconState(d)]}</span>{needsReceipt(d, s) && <small className="block zk-late">receipt to send</small>}</td>
          </tr>
        ))}{!rows.length && <tr><td colSpan={6} className="empty">No gifts match.</td></tr>}</tbody>
      </table></div>
    </section>
  );
}

/* ---------------- Reconciliation ---------------- */
function Recon({ list, s, canFix, onOpen }: { list: Donation[]; s: DonationSettings; canFix: boolean; onOpen: (id: string) => void }) {
  const un = list.filter((d) => reconState(d) === 'unmatched');
  const pend = list.filter((d) => reconState(d) === 'pending');
  const byPlat = ONLINE.map((p) => ({ p, items: pend.filter((d) => d.platform === p) })).filter((x) => x.items.length);
  const deposit = (p: Platform) => { const ref = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${p.slice(0, 2).toUpperCase()}`; for (const d of pend.filter((x) => x.platform === p)) saveDonation({ ...d, payout: ref }, 'Deposit matched', `${PLATFORMS[p]} ${ref}`); };
  return (
    <div className="zk-pay">
      <section className="glass-pane zk-list" aria-label="Needs a fund or donor">
        <h2>Needs a fund or donor <span className="pill">{un.length}</span></h2>
        <p className="muted">Gifts we cannot place yet – usually a kiosk gift without a name, or a gift whose purpose is unclear. Open one to fix it.</p>
        {un.length ? <ul className="zk-rows">{un.map((d) => <li key={d.id}><button type="button" className="zk-row" data-gift={d.id} onClick={() => onOpen(d.id)}><span className="zk-row-main"><b>{d.donor.name}</b><small>{d.id} · {fmtDay(d.at)} · {PLATFORMS[d.platform]} {d.ref}</small></span><span className="zk-row-amt">{usd(d.amountCents)}</span><span className="zk-row-tags"><span className="pill warn">{d.fund ? 'Donor unknown' : 'Fund unknown'}</span></span>{canFix && <span className="zk-row-act">Fix ›</span>}</button></li>)}</ul> : <p className="muted">Everything is placed.</p>}
      </section>
      <section className="glass-pane zk-list" aria-label="Waiting for the deposit">
        <h2>Waiting for the deposit <span className="pill">{pend.length}</span></h2>
        <p className="muted">Online gifts are paid to the bank in batches. When the deposit arrives, match it here (live: the platforms report it).</p>
        {byPlat.map(({ p, items }) => (
          <div key={p} className="dn-batch" data-platform={p}>
            <div className="dn-batch-h"><div><b>{PLATFORMS[p]}</b><small className="block">{items.length} {items.length === 1 ? 'gift' : 'gifts'} · {usd(items.reduce((t, d) => t + netOf(d), 0))} expected after fees</small></div>
            {canFix && <button type="button" className="btn sm" onClick={() => deposit(p)}>Deposit arrived</button>}</div>
          </div>
        ))}
        {!byPlat.length && <p className="muted">No online gifts are waiting.</p>}
      </section>
      <section className="glass-pane zk-list" aria-label="Platforms">
        <h2>Platforms</h2>
        <ul className="dn-plats">{ONLINE_PLATFORMS.map((p) => (
          <li key={p} className={s.platforms[p]?.enabled ? 'on' : ''}><b>{PLATFORMS[p]}</b><small>{s.platforms[p]?.enabled ? `Connected · last sync ${s.platforms[p].lastSync ? fmtDay(s.platforms[p].lastSync) : '—'}` : 'Not connected'}</small></li>
        ))}</ul>
        <p className="muted">Keys are set in Settings › Integrations. Demo: no platform is called.</p>
      </section>
    </div>
  );
}

/* ---------------- Check-o-matic ---------------- */
function Checkomatic({ list, s, map, canAct }: { list: Donation[]; s: DonationSettings; map: OrgStructure; canAct: boolean }) {
  const members = useMembers() ?? [];
  const donors = checkomaticDonors(list, s);
  const c = s.checkomatic;
  const isMember = (memberId: string, email: string) => members.some((m) => (memberId && m.id === memberId) || (email && m.email === email));
  const [done, setDone] = useState<string[]>([]);
  const apply = (d: (typeof donors)[number]) => {
    const [first, ...rest] = d.name.replace(/^Donor\s+/, '').split(' ');
    const center = d.last.center; const cz = map.centers.find((x) => x.name === center)?.zone;
    const zone = (cz && ['n', 'nw', 'sw', 's', 'se'].includes(cz) ? cz : 'sw') as Member['zone'];
    const today = new Date().toISOString().slice(0, 10);
    const m: Member = { id: nextImportId(members), first: first || 'Donor', last: rest.join(' ') || d.name, email: d.email, phone: '', dob: '1980-01-01', street: '', city: 'Houston', zip: map.zones.find((z) => z.id === zone)?.zips[0] ?? '77036', zone, center: centersOf(zone).includes(center) ? center : centersOf(zone)[0], plan: 'single', joined: Number(today.slice(0, 4)), appliedOn: today,
      approvedOn: c.mode === 'member' ? today : null, idCheck: 'not_started', standing: 'good', payments: c.countsAsDues ? [{ year: Number(d.until.slice(0, 4)), paidOn: d.last.at.slice(0, 10), amountCents: d.total, method: 'card', payer: 'self', ref: d.last.id }] : [], notes: [{ at: new Date().toISOString(), by: 'Check-o-matic', text: `From gift ${d.last.id} (${usd(d.total)}). ${CHECKOMATIC_MODES[c.mode]}` }],
      audit: [{ at: new Date().toISOString(), by: 'Check-o-matic', action: c.mode === 'member' ? 'Member from a gift' : 'Application from a gift', detail: `${d.last.id}, valid until ${d.until}` }], commitment: 'contribution', source: 'import' };
    addImportedMembers([m]); setDone((x) => [...x, d.key]);
  };
  return (
    <section className="glass-pane zk-list dn-cm" aria-label="Check-o-matic">
      <h2>Check-o-matic</h2>
      <p className="dn-cm-rule"><b>{CHECKOMATIC_MODES[c.mode]}</b><br />Counts: gifts of {usd(c.minCents)} or more to {c.funds.map((f) => s.funds.find((x) => x.id === f)?.name ?? f).join(' or ')}. {c.countsAsDues ? 'The gift also counts as the member’s dues (and so for the vote).' : 'The gift does not count as dues – the Bylaws vote rules stay the same.'} Change this in Donations › Funds and rules.</p>
      {c.mode === 'off' ? <p className="muted">Check-o-matic is off.</p> : (
        <div className="table-wrap"><table className="t-plain zk-table">
          <thead><tr><th>Donor</th><th className="num">Qualifying gifts</th><th>Valid until</th><th>Membership</th><th /></tr></thead>
          <tbody>{donors.map((d) => {
            const already = isMember(d.memberId, d.email) || done.includes(d.key);
            return (
              <tr key={d.key} data-donor={d.key}>
                <td><b>{d.name}</b><small className="block">{d.email || 'no email'} · last gift {fmtDay(d.last.at)} at {d.last.center.replace(' Islamic Center', '')}</small></td>
                <td className="num">{usd(d.total)}</td>
                <td>{d.until.slice(5, 7)}/{d.until.slice(8)}/{d.until.slice(0, 4)}</td>
                <td>{already ? <span className="pill good">{done.includes(d.key) ? (c.mode === 'member' ? 'Added as member' : 'Sent to the Board') : 'Already a member'}</span> : c.mode === 'supporter' ? <span className="pill">Supporter</span> : <span className="pill warn">Not a member yet</span>}</td>
                <td className="row-actions">{!already && canAct && c.mode === 'application' && <button type="button" className="btn sm" onClick={() => apply(d)}>Send to the Board<span className="sr-only"> {d.name}</span></button>}
                  {!already && canAct && c.mode === 'member' && <button type="button" className="btn sm" onClick={() => apply(d)}>Add as member<span className="sr-only"> {d.name}</span></button>}</td>
              </tr>
            );
          })}{!donors.length && <tr><td colSpan={5} className="empty">No qualifying gifts.</td></tr>}</tbody>
        </table></div>
      )}
    </section>
  );
}

/* ---------------- one gift ---------------- */
function GiftPanel({ d, s, canFix, onClose }: { d: Donation; s: DonationSettings; canFix: boolean; onClose: () => void }) {
  const [fund, setFund] = useState(d.fund); const [name, setName] = useState(d.donor.name.startsWith('Unknown') ? '' : d.donor.name); const [email, setEmail] = useState(d.donor.email);
  const st = reconState(d); const q = checkomatic(d, s);
  return (
    <aside className="m-peek zk-case glass-float" aria-label={`Gift ${d.id}`} data-open-gift={d.id}>
      <div className="m-peek-top"><span className="m-peek-pos">{d.id} · {fmtDay(d.at)}</span><button type="button" className="icon-btn" aria-label="Close gift" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /></svg></button></div>
      <div><h2 className="zk-case-h">{usd(d.amountCents)} · {d.donor.anonymous ? 'Anonymous' : d.donor.name}</h2><p className="m-peek-status"><span className={`pill ${TONE[st]}`}>{RECON_LABEL[st]}</span>{d.recurring && <span className="pill">Monthly</span>}{needsReceipt(d, s) && <span className="pill warn">Receipt to send</span>}</p></div>
      <dl className="m-peek-facts">
        <div><dt>Fund</dt><dd>{s.funds.find((f) => f.id === d.fund)?.name ?? 'Unknown'}{s.funds.find((f) => f.id === d.fund)?.restricted ? ' · restricted' : ''}</dd></div>
        <div><dt>Given at → booked to</dt><dd>{d.center} → {routedCenter(d, s)}</dd></div>
        <div><dt>How</dt><dd>{PLATFORMS[d.platform]} · {d.ref}{d.payout ? ` · deposit ${d.payout}` : ''}</dd></div>
        <div><dt>After fees</dt><dd>{usd(netOf(d))}{d.feeCents ? ` (fee ${usd(d.feeCents)})` : ''}</dd></div>
        {d.donor.email && <div><dt>Donor</dt><dd>{d.donor.email}{d.donor.memberId ? ` · member ${d.donor.memberId}` : ''}</dd></div>}
        <div><dt>Check-o-matic</dt><dd>{q.qualifies ? q.why : `No – ${q.why}`}</dd></div>
      </dl>
      {canFix && st === 'unmatched' && (
        <form className="zk-act" onSubmit={(e: FormEvent) => { e.preventDefault(); saveDonation({ ...d, fund, donor: { ...d.donor, name: name.trim() || d.donor.name, email: email.trim(), anonymous: !name.trim() && !email.trim() ? true : d.donor.anonymous } }, 'Gift placed', `${fund}${name ? `, ${name}` : ''}`); }}>
          <h3>Place this gift</h3>
          <label className="sf-field"><span className="sf-label">Fund</span><select className="in" value={fund} onChange={(e) => setFund(e.target.value)}><option value="">Choose…</option>{s.funds.filter((f) => f.active).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <div className="field-row"><label className="sf-field"><span className="sf-label">Donor name</span><input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Leave empty for anonymous" /></label><label className="sf-field"><span className="sf-label">Email</span><input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label></div>
          <button type="submit" className="btn primary" disabled={!fund}>Save</button>
        </form>
      )}
      {canFix && needsReceipt(d, s) && <div className="zk-act"><h3>Receipt</h3><p className="sf-hint">Gifts of {usd(s.receiptAboveCents)} or more need a written acknowledgment for the donor’s taxes.</p><button type="button" className="btn" onClick={() => saveDonation({ ...d, receiptSent: true }, 'Receipt sent', d.donor.email)}>Mark receipt sent (demo)</button></div>}
      {canFix && !d.refunded && <div className="zk-act"><button type="button" className="btn ghost danger-ghost" onClick={() => saveDonation({ ...d, refunded: true }, 'Refunded', usd(d.amountCents))}>Mark as refunded</button></div>}
    </aside>
  );
}

/* ---------------- record cash or check ---------------- */
function EntryDialog({ s, map, all, onClose, onSaved }: { s: DonationSettings; map: OrgStructure; all: Donation[]; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({ platform: 'cash' as 'cash' | 'check', amount: '', fund: '', center: '', ref: '', name: '', email: '', anonymous: false });
  const [errs, setErrs] = useState<string[]>([]);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = (e: FormEvent) => {
    e.preventDefault();
    const d: Donation = { id: nextDonationId(all), at: new Date().toISOString(), donor: { name: f.anonymous ? 'Anonymous' : f.name, email: f.email, memberId: '', anonymous: f.anonymous }, amountCents: Math.round(Number(f.amount || 0) * 100), feeCents: 0, fund: f.fund, center: f.center, platform: f.platform, ref: f.ref, payout: `DEP-${new Date().toISOString().slice(0, 10)}`, recurring: false, refunded: false, receiptSent: false, enteredBy: 'admin' };
    const p = [...entryProblems(d, s), ...(!f.anonymous && f.name.trim().length < 2 ? ['Enter the donor’s name, or tick Anonymous.'] : [])];
    setErrs(p); if (p.length) return;
    saveDonation(d, 'Gift recorded', `${f.platform} ${usd(d.amountCents)} ${f.fund}`); onSaved(d.id);
  };
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  return (
    <dialog ref={open} className="modal glass-float zn-dialog" aria-label="Record cash or check" onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={save} noValidate>
        <h2>Record cash or check</h2>
        <div className="seg" role="radiogroup" aria-label="Cash or check">{(['cash', 'check'] as const).map((p) => <button key={p} type="button" role="radio" aria-checked={f.platform === p} onClick={() => set({ platform: p })}>{p === 'cash' ? 'Cash' : 'Check'}</button>)}</div>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Amount</span><span className="in-money"><i>$</i><input className="in" type="number" min="1" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></span></label>
          <label className="sf-field"><span className="sf-label">{f.platform === 'check' ? 'Check number' : 'Receipt book number (optional)'}</span><input className="in" value={f.ref} onChange={(e) => set({ ref: e.target.value })} /></label>
        </div>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Fund</span><select className="in" value={f.fund} onChange={(e) => set({ fund: e.target.value })}><option value="">Choose…</option>{s.funds.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Received at</span><select className="in" value={f.center} onChange={(e) => set({ center: e.target.value })}><option value="">Choose…</option>{map.centers.filter((c) => c.active).map((c) => <option key={c.id}>{c.name}</option>)}</select></label>
        </div>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Donor name</span><input className="in" value={f.name} disabled={f.anonymous} onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="sf-field"><span className="sf-label">Email (for the receipt)</span><input className="in" type="email" value={f.email} disabled={f.anonymous} onChange={(e) => set({ email: e.target.value })} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={f.anonymous} onChange={(e) => set({ anonymous: e.target.checked })} /> <span>Anonymous gift</span></label>
        {errs.length > 0 && <ul className="notice warn-note" role="alert">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">Save gift</button></div>
      </form>
    </dialog>
  );
}
