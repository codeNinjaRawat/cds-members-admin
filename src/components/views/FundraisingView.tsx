'use client';
/**
 * F8 Fundraising. Campaigns (goal, fund, dates, matching sponsors, personal pages, monthly giving) → Personal pages
 * (members start them; staff approve before they show) → Pledges → Donor insights (new, retained, LYBUNT, SYBUNT).
 * Campaign settings publish as the `fundraising` document; gifts and pledges are records (live: from Donations).
 * DEMO: this browser only.
 */
import { ORG_TZ } from '@/lib/members/members';
import { DashBar, exportPage, useScope as useDashScope } from '@/components/charts/DashKit';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Tabs, countIssues } from '@/components/editor/bits';
import { ChartCard, ShareBar, StatTile } from '@/components/charts/Charts';
import {
  STATE_LABEL, campaignState, donorInsights, fmt, fundraisingWarnings, matching, pageProgress, pledgeStatus, progress, slug, usd,
  type Campaign, type CampaignState, type Fundraising, type P2PPage,
} from '@/lib/community/fundraising';
import { DonationSettingsSchema, mockDonationSettings, type DonationSettings } from '@/lib/community/donations';
import { mockOrgStructure } from '@/lib/community/org-structure';
import { useAccess } from '@/lib/access/use-access';
import { addGift, addPledge, nextGiftId, useFundraisingRecords } from '@/lib/fundraising/use-fundraising';
import { csvCell } from '@/lib/community/member-records';

type Doc = { draft: Fundraising; setDraft: (f: Fundraising | ((d: Fundraising) => Fundraising)) => void; issues: Record<string, string> };
const todayCT = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
const TONE: Record<CampaignState, string> = { draft: '', scheduled: '', live: 'good', ended: 'warn', closed: '' };
const addDays = (s: string, n: number) => { const t = Date.parse(`${String(s ?? '').slice(0, 10)}T12:00:00Z`); if (Number.isNaN(t)) return String(s ?? ''); return new Date(t + n * 86_400_000).toISOString().slice(0, 10); };

export function FundraisingView() {
  return (
    <DocEditor<Fundraising> storeKey="fundraising" title="Fundraising" preview={false}
      intro="Campaigns with a goal and a fund, matching sponsors, pledges and members’ personal fundraising pages. Money given to a campaign stays in its fund – Zakat stays Zakat. Campaigns publish to the website’s Campaigns page.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function useFunds() {
  const [s, setS] = useState<DonationSettings>(mockDonationSettings);
  useEffect(() => { void fetch('/api/store/donation-settings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = DonationSettingsSchema.safeParse(j?.data); if (p.success) setS(p.data); }).catch(() => {}); }, []);
  return s.funds.filter((f) => f.active);
}

function Body({ doc }: { doc: Doc }) {
  const access = useAccess();
  const funds = useFunds();
  const { gifts, pledges } = useFundraisingRecords();
  const t = todayCT();
  const [open, setOpen] = useState<string | null>(null);
  const canEdit = access.can('fundraising.manage');
  const warns = fundraisingWarnings(doc.draft, gifts, pledges, t, funds.map((f) => f.id));
  const i = open ? doc.draft.campaigns.findIndex((c) => c.id === open) : -1;
  const newCampaign = () => {
    const id = `new-campaign-${doc.draft.campaigns.length + 1}`;
    doc.setDraft((d) => ({ ...d, campaigns: [{ id, name: 'New campaign', fund: 'general', goalCents: 1_000_000, start: t, end: addDays(t, 30), center: '', story: '', status: 'draft', matching: [], p2p: { enabled: false, approval: true, minGoalCents: 25_000 }, monthly: true, showDonors: true, featured: false }, ...d.campaigns] }));
    setOpen(id);
  };
  return (
    <div className={`fr${i >= 0 ? ' has-peek' : ''}`}>
      {warns.length > 0 && <details className="notice warn-note zn-warns" open={warns.length <= 5}><summary><b>{warns.length} thing{warns.length === 1 ? '' : 's'} to look at</b></summary>
        <ul>{warns.map((w, k) => <li key={k}>{w.campaign ? <button type="button" className="linkish" onClick={() => setOpen(w.campaign!)}>{w.text}</button> : w.text}</li>)}</ul></details>}
      <Tabs label="Fundraising" tabs={[
        { id: 'insights', label: 'Dashboard', render: () => <Insights gifts={gifts} campaigns={doc.draft.campaigns} /> },
        { id: 'campaigns', label: 'Campaigns', badge: countIssues(doc.issues, ['campaigns']), render: () => <Campaigns d={doc.draft} gifts={gifts} pledges={pledges} onOpen={setOpen} onNew={canEdit ? newCampaign : undefined} /> },
        { id: 'pages', label: 'Personal pages', badge: doc.draft.pages.filter((p) => p.status === 'pending').length || undefined, render: () => <Pages doc={doc} gifts={gifts} canEdit={canEdit} /> },
        { id: 'pledges', label: 'Pledges', render: () => <Pledges d={doc.draft} gifts={gifts} pledges={pledges} canEdit={canEdit} /> },
      ]} />
      {i >= 0 && <CampaignPanel doc={doc} i={i} funds={funds} gifts={gifts} pledges={pledges} canEdit={canEdit} onClose={() => setOpen(null)} onRename={setOpen} />}
    </div>
  );
}

/* ---------------- campaigns ---------------- */
function Thermo({ pct, matchedPct }: { pct: number; matchedPct: number }) {
  return <span className="fr-thermo" role="img" aria-label={`${pct}% of the goal`}><i style={{ width: `${Math.min(100, pct - matchedPct)}%` }} /><b style={{ width: `${Math.max(0, Math.min(100 - (pct - matchedPct), matchedPct))}%` }} /></span>;
}
function Campaigns({ d, gifts, pledges, onOpen, onNew }: { d: Fundraising; gifts: ReturnType<typeof useFundraisingRecords>['gifts']; pledges: ReturnType<typeof useFundraisingRecords>['pledges']; onOpen: (id: string) => void; onNew?: () => void }) {
  const t = todayCT();
  const order: CampaignState[] = ['live', 'ended', 'scheduled', 'draft', 'closed'];
  const mf = useMasjidFilter();
  // organization-wide campaigns (no masjid) belong to every masjid, so they stay when one masjid is picked
  const list = d.campaigns.filter((c) => !c.center || mf.keep('', c.center)).sort((a, b) => order.indexOf(campaignState(a, t)) - order.indexOf(campaignState(b, t)) || a.end.localeCompare(b.end));
  return (
    <section className="glass-pane zk-list" aria-label="Campaigns">
      <div className="bn-bar"><h2>Campaigns <span className="pill">{list.length}</span></h2><MasjidPicker />{onNew && <button type="button" className="btn primary" onClick={onNew}>New campaign</button>}</div>
      <ul className="fr-cards">{list.map((c) => {
        const st = campaignState(c, t); const p = progress(c, gifts, pledges, t);
        return (
          <li key={c.id}><button type="button" className={`fr-card s-${st}`} data-campaign={c.id} onClick={() => onOpen(c.id)}>
            <span className="fr-card-h"><b>{c.name}</b><span className={`pill ${TONE[st]}`}>{STATE_LABEL[st]}</span></span>
            <small>{c.center || 'All of ISGH'} · {fmt(c.start)} – {fmt(c.end)}</small>
            <span className="fr-amt"><b>{usd(p.totalCents)}</b> <small>of {usd(c.goalCents)} · {p.pct}%</small></span>
            <Thermo pct={p.pct} matchedPct={Math.round((p.matchedCents / c.goalCents) * 100)} />
            <span className="fr-facts"><small>{p.donors} donors</small>{p.matchedCents > 0 && <small>{usd(p.matchedCents)} matched</small>}{p.monthly > 0 && <small>{p.monthly} monthly</small>}{st === 'live' && <small>{p.daysLeft} days left</small>}{c.p2p.enabled && <small>{d.pages.filter((x) => x.campaignId === c.id && x.status === 'approved').length} personal pages</small>}</span>
          </button></li>
        );
      })}</ul>
    </section>
  );
}

function Field({ label, children, err, hint }: { label: string; children: ReactNode; err?: string; hint?: ReactNode }) {
  return <label className="sf-field"><span className="sf-label">{label}</span>{children}{hint && <small className="sf-hint">{hint}</small>}{err && <small className="sf-err">{err}</small>}</label>;
}
function CampaignPanel({ doc, i, funds, gifts, pledges, canEdit, onClose, onRename }: { doc: Doc; i: number; funds: DonationSettings['funds']; gifts: ReturnType<typeof useFundraisingRecords>['gifts']; pledges: ReturnType<typeof useFundraisingRecords>['pledges']; canEdit: boolean; onClose: () => void; onRename: (id: string) => void }) {
  const c = doc.draft.campaigns[i]; const t = todayCT();
  const e = (f: string) => doc.issues[`campaigns.${i}.${f}`];
  const up = (p: Partial<Campaign>) => { doc.setDraft((d) => { const n = structuredClone(d); if (p.id && p.id !== n.campaigns[i].id) n.pages = n.pages.map((x) => (x.campaignId === n.campaigns[i].id ? { ...x, campaignId: p.id! } : x)); n.campaigns[i] = { ...n.campaigns[i], ...p }; return n; }); if (p.id !== undefined) onRename(p.id); };
  const p = progress(c, gifts, pledges, t); const ms = matching(c, gifts);
  const [gift, setGift] = useState({ amount: '', name: '', anonymous: false });
  const [msg, setMsg] = useState('');
  const record = (ev: FormEvent) => {
    ev.preventDefault();
    const err = addGift({ id: nextGiftId(gifts), campaignId: c.id, pageId: '', at: new Date().toISOString(), amountCents: Math.round(Number(gift.amount || 0) * 100), monthly: false, source: 'office', donor: { key: `office-${gift.name.toLowerCase() || Date.now()}`, name: gift.anonymous ? '' : gift.name, memberId: '', anonymous: gift.anonymous, showName: !gift.anonymous } });
    setMsg(err.length ? err.join(' ') : 'Gift recorded.'); if (!err.length) setGift({ amount: '', name: '', anonymous: false });
  };
  const fund = funds.find((f) => f.id === c.fund);
  return (
    <aside className="m-peek zk-case fr-peek glass-float" aria-label={`Campaign ${c.name}`} data-open-campaign={c.id}>
      <div className="m-peek-top"><span className="m-peek-pos">/campaigns?c={c.id}</span><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /></svg></button></div>
      <div><h2 className="zk-case-h">{c.name}</h2><p className="m-peek-status"><span className={`pill ${TONE[campaignState(c, t)]}`}>{STATE_LABEL[campaignState(c, t)]}</span><span className="pill">{usd(p.totalCents)} of {usd(c.goalCents)}</span>{fund?.zakat && <span className="pill">Zakat</span>}</p>
        <Thermo pct={p.pct} matchedPct={Math.round((p.matchedCents / c.goalCents) * 100)} />
        <p className="muted small">{p.gifts} gifts from {p.donors} donors · average {usd(p.avgCents)} · {usd(p.pledgedCents)} pledged</p></div>
      <fieldset className="m-form bn-form of-peek" disabled={!canEdit}>
        <div className="seg" role="radiogroup" aria-label="Campaign status">{(['draft', 'live', 'closed'] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={c.status === s} onClick={() => up({ status: s })}>{s === 'draft' ? 'Draft' : s === 'live' ? 'Published' : 'Closed'}</button>)}</div>
        <Field label="Name" err={e('name')}><input className="in" aria-label="Campaign name" value={c.name} onChange={(ev) => up({ name: ev.target.value })} /></Field>
        <Field label="Web address" err={e('id')} hint={`isgh.org/campaigns?c=${c.id}`}><span className="of-idrow"><input className="in" aria-label="Web address" value={c.id} onChange={(ev) => up({ id: ev.target.value })} /><button type="button" className="btn sm" onClick={() => up({ id: slug(c.name) })}>From name</button></span></Field>
        <div className="field-row">
          <Field label="Fund" hint={fund?.zakat ? 'Zakat campaign: gifts go only to Zakat-eligible people.' : fund?.restricted ? 'Restricted fund – spent only on its purpose.' : undefined}><select className="in" aria-label="Fund" value={c.fund} onChange={(ev) => up({ fund: ev.target.value })}>{!funds.some((f) => f.id === c.fund) && <option value={c.fund}>{c.fund} (not active)</option>}{funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
          <Field label="Goal" err={e('goalCents')}><span className="in-money"><i>$</i><input className="in" type="number" min="100" aria-label="Goal" value={c.goalCents / 100} onChange={(ev) => up({ goalCents: Math.round(Number(ev.target.value || 0) * 100) })} /></span></Field>
        </div>
        <div className="field-row">
          <Field label="Starts"><input className="in" type="date" aria-label="Starts" value={c.start} onChange={(ev) => up({ start: ev.target.value })} /></Field>
          <Field label="Ends" err={e('end')}><input className="in" type="date" aria-label="Ends" value={c.end} onChange={(ev) => up({ end: ev.target.value })} /></Field>
        </div>
        <Field label="For"><select className="in" aria-label="For center" value={c.center} onChange={(ev) => up({ center: ev.target.value })}><option value="">All of ISGH</option>{mockOrgStructure.centers.filter((x) => x.active).map((x) => <option key={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Story (shown on the campaign page)"><textarea className="in" rows={3} aria-label="Story" maxLength={3000} value={c.story} onChange={(ev) => up({ story: ev.target.value })} /></Field>
        <label className="check"><input type="checkbox" checked={c.monthly} onChange={(ev) => up({ monthly: ev.target.checked })} /> <span>Offer monthly giving</span></label>
        <label className="check"><input type="checkbox" checked={c.showDonors} onChange={(ev) => up({ showDonors: ev.target.checked })} /> <span>Show first names of donors who allow it (never amounts)</span></label>
        <label className="check"><input type="checkbox" checked={c.featured} onChange={(ev) => up({ featured: ev.target.checked })} /> <span>Feature on the Give page</span></label>
        <div className="fr-sub"><span className="sf-label">Matching sponsors</span>
          {c.matching.map((m, k) => { const used = ms[k]; const um = (pp: Partial<typeof m>) => up({ matching: c.matching.map((x, j) => (j === k ? { ...x, ...pp } : x)) }); return (
            <div key={k} className="fr-match" data-match={k}>
              <input className="in" aria-label={`Sponsor ${k + 1}`} value={m.sponsor} onChange={(ev) => um({ sponsor: ev.target.value })} />
              <select className="in" aria-label={`Ratio ${k + 1}`} value={m.ratio} onChange={(ev) => um({ ratio: Number(ev.target.value) })}><option value={0.5}>50 cents per $1</option><option value={1}>$1 per $1</option><option value={2}>$2 per $1</option></select>
              <span className="in-money"><i>$</i><input className="in in-num" type="number" aria-label={`Match cap ${k + 1}`} value={m.capCents / 100} onChange={(ev) => um({ capCents: Math.round(Number(ev.target.value || 0) * 100) })} /></span>
              <input className="in" type="date" aria-label={`Match from ${k + 1}`} value={m.from} onChange={(ev) => um({ from: ev.target.value })} /><input className="in" type="date" aria-label={`Match to ${k + 1}`} value={m.to} onChange={(ev) => um({ to: ev.target.value })} />
              <small>{used ? `${usd(used.matchedCents)} matched · ${used.full ? 'used up' : `${usd(used.leftCents)} left`}` : ''}</small>
              {doc.issues[`campaigns.${i}.matching.${k}.from`] && <small className="sf-err">{doc.issues[`campaigns.${i}.matching.${k}.from`]}</small>}
            </div>); })}
          <button type="button" className="btn sm" onClick={() => up({ matching: [...c.matching, { sponsor: '', ratio: 1, capCents: 500_000, from: c.start, to: c.end }] })}>Add a matching sponsor</button>
        </div>
        <div className="fr-sub"><span className="sf-label">Personal fundraising pages</span>
          <label className="check"><input type="checkbox" checked={c.p2p.enabled} onChange={(ev) => up({ p2p: { ...c.p2p, enabled: ev.target.checked } })} /> <span>Members may start their own page for this campaign</span></label>
          {c.p2p.enabled && <><label className="check"><input type="checkbox" checked={c.p2p.approval} onChange={(ev) => up({ p2p: { ...c.p2p, approval: ev.target.checked } })} /> <span>Staff approve each page before it shows</span></label>
            <Field label="Smallest page goal" err={e('p2p')}><span className="in-money"><i>$</i><input className="in in-num" type="number" aria-label="Smallest page goal" value={c.p2p.minGoalCents / 100} onChange={(ev) => up({ p2p: { ...c.p2p, minGoalCents: Math.round(Number(ev.target.value || 0) * 100) } })} /></span></Field></>}
        </div>
      </fieldset>
      {canEdit && <form className="zk-act fr-gift" onSubmit={record} noValidate>
        <h3>Record a gift received at the office</h3>
        <div className="field-row"><Field label="Amount"><span className="in-money"><i>$</i><input className="in" type="number" min="1" aria-label="Gift amount" value={gift.amount} onChange={(ev) => setGift({ ...gift, amount: ev.target.value })} /></span></Field>
          <Field label="Donor name"><input className="in" aria-label="Donor name" value={gift.name} disabled={gift.anonymous} onChange={(ev) => setGift({ ...gift, name: ev.target.value })} /></Field></div>
        <label className="check"><input type="checkbox" checked={gift.anonymous} onChange={(ev) => setGift({ ...gift, anonymous: ev.target.checked })} /> <span>Anonymous</span></label>
        <button type="submit" className="btn">Record gift</button>{msg && <p className="sf-hint" role="status">{msg}</p>}
      </form>}
    </aside>
  );
}

/* ---------------- personal pages ---------------- */
function Pages({ doc, gifts, canEdit }: { doc: Doc; gifts: ReturnType<typeof useFundraisingRecords>['gifts']; canEdit: boolean }) {
  const [status, setStatus] = useState('');
  const d = doc.draft;
  const rows = d.pages.filter((p) => !status || p.status === status).sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.createdOn.localeCompare(a.createdOn));
  const set = (id: string, patch: Partial<P2PPage>) => doc.setDraft((x) => ({ ...x, pages: x.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const LABEL: Record<P2PPage['status'], string> = { pending: 'Waiting for approval', approved: 'Approved – showing', rejected: 'Not approved', hidden: 'Hidden' };
  return (
    <section className="glass-pane zk-list" aria-label="Personal pages">
      <div className="bn-bar"><h2>Personal fundraising pages <span className="pill">{rows.length}</span></h2>
        <select className="in pill-select" aria-label="Page status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Every status</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <p className="muted">Members start a page for a campaign (a run, a birthday, a car wash). Check the title and story are suitable before approving. Changes publish with the campaigns.</p>
      <ul className="fr-pages">{rows.map((p) => {
        const c = d.campaigns.find((x) => x.id === p.campaignId); const pr = pageProgress(p, gifts);
        return (
          <li key={p.id} data-page={p.id} className={`s-${p.status}`}>
            <div className="fr-page-main"><b>{p.title}</b><small>{p.owner.name} · {c?.name ?? 'Unknown campaign'} · started {fmt(p.createdOn)}</small>{p.story && <p>{p.story}</p>}
              <span className="fr-amt"><b>{usd(pr.totalCents)}</b> <small>of {usd(p.goalCents)} · {pr.donors} donors</small></span><Thermo pct={pr.pct} matchedPct={0} /></div>
            <div className="fr-page-act"><span className={`pill ${p.status === 'approved' ? 'good' : p.status === 'pending' ? 'warn' : p.status === 'rejected' ? 'bad' : ''}`}>{LABEL[p.status]}</span>
              {canEdit && p.status !== 'approved' && <button type="button" className="btn sm primary" onClick={() => set(p.id, { status: 'approved', note: '' })}>Approve<span className="sr-only"> {p.title}</span></button>}
              {canEdit && p.status === 'pending' && <button type="button" className="btn sm ghost danger-ghost" onClick={() => set(p.id, { status: 'rejected', note: 'Not suitable for an ISGH campaign page.' })}>Do not approve<span className="sr-only"> {p.title}</span></button>}
              {canEdit && p.status === 'approved' && <button type="button" className="btn sm ghost" onClick={() => set(p.id, { status: 'hidden' })}>Hide<span className="sr-only"> {p.title}</span></button>}
              {doc.issues[`pages.${d.pages.indexOf(p)}.status`] && <small className="sf-err">{doc.issues[`pages.${d.pages.indexOf(p)}.status`]}</small>}
            </div>
          </li>
        );
      })}</ul>
    </section>
  );
}

/* ---------------- pledges ---------------- */
function Pledges({ d, gifts, pledges, canEdit }: { d: Fundraising; gifts: ReturnType<typeof useFundraisingRecords>['gifts']; pledges: ReturnType<typeof useFundraisingRecords>['pledges']; canEdit: boolean }) {
  const t = todayCT();
  const [f, setF] = useState({ campaignId: d.campaigns[0]?.id ?? '', name: '', amount: '', dueBy: addDays(t, 90) });
  const save = (e: FormEvent) => { e.preventDefault(); const cents = Math.round(Number(f.amount || 0) * 100); if (!f.name.trim() || cents < 100) return; addPledge({ id: `P-${pledges.length + 1}-${Date.now().toString(36)}`, campaignId: f.campaignId, donor: { key: `pledge-${f.name.toLowerCase()}`, name: f.name }, totalCents: cents, dueBy: f.dueBy }); setF({ ...f, name: '', amount: '' }); };
  return (
    <section className="glass-pane zk-list" aria-label="Pledges">
      <h2>Pledges <span className="pill">{pledges.length}</span></h2>
      <p className="muted">A promise to give by a date. Payments are gifts marked as pledge payments; late pledges get a gentle reminder.</p>
      <div className="table-wrap"><table className="t-plain zk-table"><thead><tr><th>Donor</th><th>Campaign</th><th className="num">Pledged</th><th className="num">Paid</th><th>Due by</th><th>State</th></tr></thead>
        <tbody>{pledges.map((p) => { const s = pledgeStatus(p, gifts, t); return <tr key={p.id} data-pledge={p.id}><td>{p.donor.name}</td><td>{d.campaigns.find((c) => c.id === p.campaignId)?.name ?? p.campaignId}</td><td className="num">{usd(p.totalCents)}</td><td className="num">{usd(s.paidCents)}</td><td>{fmt(p.dueBy)}</td><td><span className={`pill ${s.done ? 'good' : s.late ? 'bad' : 'warn'}`}>{s.done ? 'Fulfilled' : s.late ? 'Past due' : 'Open'}</span></td></tr>; })}</tbody></table></div>
      {canEdit && <form className="dn-addfund fr-pledge" onSubmit={save}>
        <select className="in" aria-label="Pledge campaign" value={f.campaignId} onChange={(e) => setF({ ...f, campaignId: e.target.value })}>{d.campaigns.filter((c) => c.status !== 'closed').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input className="in" aria-label="Pledge donor" placeholder="Donor name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <span className="in-money"><i>$</i><input className="in in-num" type="number" aria-label="Pledge amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></span>
        <input className="in" type="date" aria-label="Pledge due by" value={f.dueBy} onChange={(e) => setF({ ...f, dueBy: e.target.value })} />
        <button type="submit" className="btn">Add pledge</button>
      </form>}
    </section>
  );
}

/* ---------------- insights ---------------- */
function Insights({ gifts: all, campaigns }: { gifts: ReturnType<typeof useFundraisingRecords>['gifts']; campaigns: { id: string; center: string }[] }) {
  const thisYear = Number(todayCT().slice(0, 4));
  const [y, setY] = useState(thisYear);
  const ds = useDashScope('year');
  const gifts = all.filter((g) => ds.match(undefined, campaigns.find((c) => c.id === g.campaignId)?.center ?? ''));
  const ins = donorInsights(gifts, y);
  const csv = (rows: { name: string; lastGift: string }[], name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([[['Donor', 'Last gift'], ...rows.map((r) => [r.name, r.lastGift])].map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `${name}-${y}.csv`; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <div className="fr-ins">
      <DashBar s={ds} show={{ zone: true, masjid: true }} report={{ href: '/fundraising?tab=campaigns', label: 'Campaigns' }} onExport={() => exportPage('fundraising-dashboard')}
        extra={<select className="in pill-select" aria-label="Year" value={y} onChange={(e) => setY(Number(e.target.value))}>{[thisYear, thisYear - 1, thisYear - 2].map((v) => <option key={v} value={v}>{v}</option>)}</select>} />
      <div className="zk-kpis">
        <StatTile id="fr-donors" label={`Donors in ${y}`} value={String(ins.donors)} note={`${ins.newDonors} new`} />
        <StatTile id="fr-ret" label="Kept from last year" value={`${ins.retentionPct}%`} meter={{ value: ins.retentionPct, of: 100 }} note={`${ins.retained} donors gave again`} />
        <StatTile id="fr-lybunt" label="Gave last year, not yet this year" value={String(ins.lybunt.length)} tone={ins.lybunt.length ? 'down' : undefined} note="LYBUNT – worth a personal thank-you" />
        <StatTile id="fr-monthly" label="Monthly donors" value={String(ins.monthlyDonors)} />
      </div>
      <div className="zk-charts">
        <ChartCard id="fr-mix" className="zk-wide" title={`Who gave in ${y}`} note="New donors, donors who gave again, and donors who gave in an earlier year but not this one." table={{ head: ['Group', 'Donors'], rows: [['New', ins.newDonors], ['Gave again', ins.retained], ['Came back after a gap', Math.max(0, ins.donors - ins.newDonors - ins.retained)], ['Not yet this year (LYBUNT)', ins.lybunt.length]] }}>
          <ShareBar label="Donor groups" items={[{ id: 'new', label: 'New', value: ins.newDonors }, { id: 'ret', label: 'Gave again', value: ins.retained }, { id: 'back', label: 'Came back', value: Math.max(0, ins.donors - ins.newDonors - ins.retained) }, { id: 'lybunt', label: 'Not yet this year', value: ins.lybunt.length }]} />
        </ChartCard>
      </div>
      <div className="fr-lists">
        <section className="glass-pane zk-list" aria-label="LYBUNT"><div className="bn-bar"><h2>Gave last year, not yet this year</h2><button type="button" className="btn sm" onClick={() => csv(ins.lybunt, 'lybunt')}>CSV</button></div>
          <ul className="fr-donors">{ins.lybunt.slice(0, 15).map((r) => <li key={r.key}><b>{r.name}</b><small>last gift {fmt(r.lastGift)}</small></li>)}</ul></section>
        <section className="glass-pane zk-list" aria-label="SYBUNT"><div className="bn-bar"><h2>Gave some year before, not since</h2><button type="button" className="btn sm" onClick={() => csv(ins.sybunt, 'sybunt')}>CSV</button></div>
          <ul className="fr-donors">{ins.sybunt.slice(0, 15).map((r) => <li key={r.key}><b>{r.name}</b><small>last gift {fmt(r.lastGift)}</small></li>)}</ul></section>
        <section className="glass-pane zk-list" aria-label="Top donors"><h2>Top donors this year</h2><ul className="fr-donors">{ins.top.map((r) => <li key={r.name}><b>{r.name}</b><small>{usd(r.totalCents)}</small></li>)}</ul><p className="muted small">Visible to fundraising staff only.</p></section>
      </div>
    </div>
  );
}
