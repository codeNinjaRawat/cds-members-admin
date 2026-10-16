'use client';
/**
 * F4 Member benefits. Tabs in the order of the work: Overview → Offers (what members get) → Partners (who gives it:
 * approval, agreement, suitability review) → Use log (who used what; the office can record a use) → Rules.
 * Offers and partners publish together as the `benefits` document; uses are saved at once (they are records, not
 * settings). Partners never see member contact details – they check a member on the Verify page (status only).
 * DEMO (no API). Live: GET/PUT /admin/benefits, GET/POST /admin/benefits/uses.
 */
import { DashBar, exportPage, useScope as useDashScope } from '@/components/charts/DashKit';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import { centerOf } from '@/lib/members/members';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, SwitchRow, Tabs, countIssues } from '@/components/editor/bits';
import { ChartCard, Columns, Donut, LineChart, ShareBar, StatTile } from '@/components/charts/Charts';
import {
  CATEGORIES, KIND, LIMIT, OFFER_STATE_LABEL, PARTNER_STATE_LABEL, PARTNER_STATUS, PLAN_IDS, PLAN_NAME, REDEEM, addDays, benefitStats, benefitWarnings,
  discountLabel, eligibility, fmt, listPlans, offerState, partnerState, usage,
  type Benefits, type Category, type Offer, type OfferState, type Partner, type PartnerState, type Redemption,
} from '@/lib/community/benefits';
import { mockOrgStructure } from '@/lib/community/org-structure';
import { csvCell } from '@/lib/community/member-records';
import { useAccess } from '@/lib/access/use-access';
import { addUse, factsOf, nextUseId, useUses } from '@/lib/benefits/use-benefits';
import { useMembers } from './MembersView';

type Doc = { draft: Benefits; setDraft: (f: Benefits | ((d: Benefits) => Benefits)) => void; issues: Record<string, string> };
type Open = { kind: 'offer' | 'partner'; id: string } | null;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: '2-digit', day: '2-digit', year: 'numeric' });
const OFFER_TONE: Record<OfferState, string> = { live: 'good', scheduled: '', draft: '', paused: 'warn', expired: 'bad', 'partner-off': 'warn' };
const PARTNER_TONE: Record<PartnerState, string> = { approved: 'good', proposed: '', review: 'warn', paused: 'warn', ended: 'bad', expired: 'bad' };
const VIA = { portal: 'Member portal', partner: 'Partner checked the card', office: 'Office' } as const;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34) || 'item';
const uniqueId = (base: string, taken: string[]) => { let id = slug(base), n = 2; while (taken.includes(id)) id = `${slug(base)}-${n++}`; return id; };

export function BenefitsView() {
  return (
    <DocEditor<Benefits> storeKey="benefits" title="Member benefits" preview={false}
      intro="Partner businesses and the offers they give ISGH members. Offers and partners publish together; the use log is saved as it happens. Partners check a member on the website’s Verify page and see only the name and whether the membership is active.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function Body({ doc }: { doc: Doc }) {
  const uses = useUses();
  const t = today();
  const [open, setOpen] = useState<Open>(null);
  const warns = benefitWarnings(doc.draft, t);
  const set = (f: (x: Benefits) => void) => doc.setDraft((d) => { const c = structuredClone(d); f(c); return c; });
  const oi = open?.kind === 'offer' ? doc.draft.offers.findIndex((o) => o.id === open.id) : -1;
  const pi = open?.kind === 'partner' ? doc.draft.partners.findIndex((p) => p.id === open.id) : -1;
  return (
    <div className={`bn${oi >= 0 || pi >= 0 ? ' has-peek' : ''}`}>
      {warns.length > 0 && (
        <details className="notice warn-note zn-warns bn-warns" open={warns.length <= 5}>
          <summary><b>{warns.length} thing{warns.length === 1 ? '' : 's'} to look at</b></summary>
          <ul>{warns.map((w, i) => (
            <li key={i}><button type="button" className="linkish" onClick={() => setOpen(w.offer ? { kind: 'offer', id: w.offer } : { kind: 'partner', id: w.partner! })}>{w.text}</button></li>
          ))}</ul>
        </details>
      )}
      <Tabs label="Member benefits" tabs={[
        { id: 'overview', label: 'Dashboard', render: () => <Overview d={doc.draft} uses={uses} /> },
        { id: 'offers', label: 'Offers', badge: countIssues(doc.issues, ['offers']), render: () => <Offers d={doc.draft} uses={uses} onOpen={(id) => setOpen({ kind: 'offer', id })} onNew={() => {
          const p = doc.draft.partners.find((x) => partnerState(x, doc.draft, t) === 'approved') ?? doc.draft.partners[0];
          const id = uniqueId('new-offer', doc.draft.offers.map((o) => o.id));
          set((x) => { x.offers.unshift({ id, partnerId: p?.id ?? '', title: 'New offer', details: '', kind: 'percent', value: 10, redeem: 'card', code: '', url: '', plans: [...PLAN_IDS], goodStanding: false, limit: 'unlimited', from: t, until: p?.agreementUntil && p.agreementUntil > t ? p.agreementUntil : addDays(t, 180), status: 'draft', featured: false }); });
          setOpen({ kind: 'offer', id });
        }} /> },
        { id: 'partners', label: 'Partners', badge: countIssues(doc.issues, ['partners']), render: () => <Partners d={doc.draft} uses={uses} onOpen={(id) => setOpen({ kind: 'partner', id })} onNew={() => {
          const id = uniqueId('new-partner', doc.draft.partners.map((p) => p.id));
          set((x) => { x.partners.unshift({ id, name: 'New partner', category: 'food', center: '', address: '', phone: '', website: '', contact: { name: '', email: '' }, status: 'proposed', agreementUntil: '', reviewed: { by: '', on: '' }, notes: '' }); });
          setOpen({ kind: 'partner', id });
        }} /> },
        { id: 'uses', label: 'Use log', render: () => <Uses d={doc.draft} uses={uses} /> },
        { id: 'rules', label: 'Rules', render: () => <Rules d={doc.draft} set={set} /> },
      ]} />
      {oi >= 0 && <OfferPanel doc={doc} i={oi} uses={uses} set={set} onClose={() => setOpen(null)} onPartner={(id) => setOpen({ kind: 'partner', id })} />}
      {pi >= 0 && <PartnerPanel doc={doc} i={pi} set={set} onClose={() => setOpen(null)} onOffer={(id) => setOpen({ kind: 'offer', id })} />}
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ d, uses: all }: { d: Benefits; uses: Redemption[] }) {
  const ds = useDashScope('12m');
  const who = new Map((useMembers() ?? []).map((m) => [m.id, m]));
  const uses = all.filter((r) => { const m = who.get(r.memberId); return ds.match(r.at, m ? centerOf(m) : '', m?.zone) && (!m || ds.access.inScope(m.zone, centerOf(m), m.zip)); });
  const st = benefitStats(d, uses, today());
  return (
    <div className="bn-over">
      <DashBar s={ds} show={{ period: 'past', zone: true, masjid: true }} report={{ href: '/benefits?tab=uses', label: 'Use log' }} onExport={() => exportPage('benefits-dashboard')} />
      <div className="zk-kpis">
        <StatTile id="bn-live" label="Live offers" value={String(st.liveOffers)} note={`from ${st.partners} approved partners`} />
        <StatTile id="bn-month" label="Uses this month" value={String(st.usesThisMonth)} note={`${st.membersThisMonth} members`} spark={st.byMonth.map((m) => m.value)} />
        <StatTile id="bn-total" label="Uses in 6 months" value={String(st.byMonth.reduce((a, m) => a + m.value, 0))} note="all offers" />
        <StatTile id="bn-wait" label="Partners waiting" value={String(st.waiting)} tone={st.waiting ? 'down' : undefined} note="approval or review" />
      </div>
      {!d.enabled && <p className="notice warn-note" role="status">Members do not see benefits right now – switch them on in Rules.</p>}
      <div className="zk-charts">
        <ChartCard id="bn-trend" className="zk-wide" title="Uses by month" note="How often members used an offer (portal, partner check or office)." table={{ head: ['Month', 'Uses'], rows: st.byMonth.map((m) => [m.label, m.value]) }}>
          <LineChart label="Uses by month" labels={st.byMonth.map((m) => m.label)} series={[{ id: 'uses', name: 'Uses', values: st.byMonth.map((m) => m.value), slot: 1, area: true }]} height={200} />
        </ChartCard>
        <ChartCard id="bn-cat" title="What members use" table={{ head: ['Category', 'Uses'], rows: st.byCategory.map((c) => [c.label, c.value]) }}>
          <Donut label="Uses by category" centerLabel="uses" items={groupTail(st.byCategory)} />
        </ChartCard>
        <ChartCard id="bn-top" title="Most used offers" table={{ head: ['Offer', 'Uses'], rows: st.top.map((o) => [o.label, o.value]) }}>
          <Columns label="Uses by offer" items={st.top.map((o) => ({ label: o.label.length > 16 ? `${o.label.slice(0, 15).trim()}…` : o.label, value: o.value }))} />
        </ChartCard>
        <ChartCard id="bn-via" className="zk-wide" title="How the offer was used" note="Partner checks use the Verify page – the partner sees the name and status only." table={{ head: ['Way', 'Uses'], rows: st.byVia.map((v) => [v.label, v.value]) }}>
          <ShareBar label="Uses by way" items={st.byVia} />
        </ChartCard>
      </div>
    </div>
  );
}
/** ≤4 colors: the top three categories, the rest as "Other". */
function groupTail(items: { id: string; label: string; value: number }[]) {
  if (items.length <= 4) return items.map((x) => ({ ...x, label: x.label.split(',')[0].split(' and ')[0] }));
  const top = items.slice(0, 3).map((x) => ({ ...x, label: x.label.split(',')[0].split(' and ')[0] }));
  return [...top, { id: 'rest', label: 'Other', value: items.slice(3).reduce((a, x) => a + x.value, 0) }];
}

/* ---------------- Offers ---------------- */
function Offers({ d, uses, onOpen, onNew }: { d: Benefits; uses: Redemption[]; onOpen: (id: string) => void; onNew: () => void }) {
  const t = today();
  const [state, setState] = useState(''); const [q, setQ] = useState(''); const [cat, setCat] = useState('');
  const partner = (id: string) => d.partners.find((p) => p.id === id);
  const rows = d.offers.filter((o) => (!state || offerState(o, d, t) === state) && (!cat || partner(o.partnerId)?.category === cat)
    && (!q || `${o.title} ${partner(o.partnerId)?.name ?? ''} ${o.code}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <section className="glass-pane zk-list" aria-label="Offers">
      <div className="bn-bar">
        <h2>Offers <span className="pill">{d.offers.length}</span></h2>
        <input className="in" type="search" aria-label="Search offers" placeholder="Search offers or partners" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="in pill-select" aria-label="Offer state" value={state} onChange={(e) => setState(e.target.value)}><option value="">Every state</option>{Object.entries(OFFER_STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="in pill-select" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Every category</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="button" className="btn primary" onClick={onNew} disabled={!d.partners.length} title={d.partners.length ? undefined : 'Add a partner first'}>New offer</button>
      </div>
      <ul className="bn-offers">
        {rows.map((o) => {
          const st = offerState(o, d, t); const p = partner(o.partnerId); const n = uses.filter((r) => r.offerId === o.id).length;
          return (
            <li key={o.id}>
              <button type="button" className={`bn-coupon s-${st}`} data-offer={o.id} onClick={() => onOpen(o.id)}>
                <span className="bn-stub"><b>{discountLabel(o)}</b><small>{LIMIT[o.limit]}</small></span>
                <span className="bn-body">
                  <span className="bn-title">{o.title}{o.featured && <i className="bn-star" aria-label="Featured">★</i>}</span>
                  <small>{p?.name ?? 'No partner'} · {p ? CATEGORIES[p.category] : ''}</small>
                  <span className="bn-tags"><span className={`pill ${OFFER_TONE[st]}`}>{OFFER_STATE_LABEL[st]}</span><small>{listPlans(o.plans)}{o.goodStanding ? ' · dues paid' : ''}</small></span>
                  <small className="bn-dates">{fmt(o.from)} – {fmt(o.until)} · {n} {n === 1 ? 'use' : 'uses'}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!rows.length && <p className="muted">No offers match.</p>}
    </section>
  );
}

function Field({ label, err, hint, children, wide }: { label: string; err?: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return <label className={`sf-field${wide ? ' wide' : ''}`}><span className="sf-label">{label}</span>{children}{hint && <small className="sf-hint">{hint}</small>}{err && <small className="sf-err">{err}</small>}</label>;
}
function PanelFrame({ label, data, pos, onClose, children }: { label: string; data: Record<string, string>; pos: string; onClose: () => void; children: ReactNode }) {
  return (
    <aside className="m-peek zk-case bn-peek glass-float" aria-label={label} {...data}>
      <div className="m-peek-top"><span className="m-peek-pos">{pos}</span><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /></svg></button></div>
      {children}
    </aside>
  );
}

function OfferPanel({ doc, i, uses, set, onClose, onPartner }: { doc: Doc; i: number; uses: Redemption[]; set: (f: (x: Benefits) => void) => void; onClose: () => void; onPartner: (id: string) => void }) {
  const d = doc.draft; const o = d.offers[i]; const t = today();
  const p = d.partners.find((x) => x.id === o.partnerId);
  const e = (f: string) => doc.issues[`offers.${i}.${f}`];
  const up = (patch: Partial<Offer>) => set((x) => { x.offers[i] = { ...x.offers[i], ...patch }; });
  const st = offerState(o, d, t);
  const n = uses.filter((r) => r.offerId === o.id).length;
  const money = o.kind === 'amount' || o.kind === 'price';
  return (
    <PanelFrame label={`Offer ${o.title}`} data={{ 'data-open-offer': o.id }} pos={`Offer · ${o.id}`} onClose={onClose}>
      <div><h2 className="zk-case-h">{discountLabel(o)} · {o.title}</h2><p className="m-peek-status"><span className={`pill ${OFFER_TONE[st]}`}>{OFFER_STATE_LABEL[st]}</span><span className="pill">{n} {n === 1 ? 'use' : 'uses'}</span></p></div>
      {st === 'partner-off' && p && <p className="notice warn-note">Members do not see this offer: {p.name} is “{PARTNER_STATE_LABEL[partnerState(p, d, t)]}”. <button type="button" className="linkish" onClick={() => onPartner(p.id)}>Open the partner</button></p>}
      <div className="m-form bn-form">
        <div className="seg" role="radiogroup" aria-label="Offer status">{(['draft', 'live', 'paused'] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={o.status === s} onClick={() => up({ status: s })}>{s === 'draft' ? 'Draft' : s === 'live' ? 'Live' : 'Paused'}</button>)}</div>
        {e('status') && <p className="sf-err" role="alert">{e('status')}</p>}
        <Field label="Partner" err={e('partnerId')}><select className="in" aria-label="Partner" value={o.partnerId} onChange={(ev) => up({ partnerId: ev.target.value })}><option value="">Choose…</option>{d.partners.map((x) => <option key={x.id} value={x.id}>{x.name} ({PARTNER_STATE_LABEL[partnerState(x, d, t)]})</option>)}</select></Field>
        <Field label="Title" err={e('title')}><input className="in" aria-label="Offer title" value={o.title} onChange={(ev) => up({ title: ev.target.value })} /></Field>
        <Field label="Details" hint="Conditions members should know (days, limits, what is not included)."><textarea className="in" aria-label="Offer details" rows={2} maxLength={400} value={o.details} onChange={(ev) => up({ details: ev.target.value })} /></Field>
        <div className="field-row">
          <Field label="Kind"><select className="in" aria-label="Kind of offer" value={o.kind} onChange={(ev) => up({ kind: ev.target.value as Offer['kind'], value: ev.target.value === 'percent' ? 10 : ev.target.value === 'free' ? 0 : 1000 })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          {o.kind !== 'free' && <Field label={o.kind === 'percent' ? 'Percent off' : o.kind === 'amount' ? 'Dollars off' : 'Member price'} err={e('value')}>
            {money ? <span className="in-money"><i>$</i><input className="in" aria-label="Amount" type="number" min="0" step="1" value={o.value / 100} onChange={(ev) => up({ value: Math.round(Number(ev.target.value || 0) * 100) })} /></span>
              : <span className="in-money"><input className="in" aria-label="Percent" type="number" min="1" max="100" value={o.value} onChange={(ev) => up({ value: Math.round(Number(ev.target.value || 0)) })} /><i>%</i></span>}
          </Field>}
        </div>
        <Field label="How members use it"><select className="in" aria-label="How members use it" value={o.redeem} onChange={(ev) => up({ redeem: ev.target.value as Offer['redeem'] })}>{Object.entries(REDEEM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {o.redeem === 'code' && <Field label="Code" err={e('code')} hint="Everyone uses the same code – fine for online shops, easy to share."><input className="in" aria-label="Code" value={o.code} onChange={(ev) => up({ code: ev.target.value.toUpperCase() })} /></Field>}
        {o.redeem === 'unique' && <p className="sf-hint">Each member gets their own code (like ISGH-7KQ2MX). The partner can check it on the Verify page, so it cannot be passed around.</p>}
        {o.redeem === 'card' && <p className="sf-hint">Members show the digital card; the partner checks it on the Verify page if unsure.</p>}
        {o.redeem === 'link' && <Field label="Web address" err={e('url')}><input className="in" aria-label="Web address" type="url" value={o.url} onChange={(ev) => up({ url: ev.target.value })} placeholder="https://" /></Field>}
        <fieldset className="bn-plans"><legend className="sf-label">Which plans</legend>
          {PLAN_IDS.map((pl) => <label key={pl} className="check"><input type="checkbox" aria-label={`Plan ${PLAN_NAME[pl]}`} checked={o.plans.includes(pl)} onChange={(ev) => up({ plans: ev.target.checked ? PLAN_IDS.filter((x) => x === pl || o.plans.includes(x)) : o.plans.filter((x) => x !== pl) })} /> <span>{PLAN_NAME[pl]}</span></label>)}
          {e('plans') && <small className="sf-err">{e('plans')}</small>}
        </fieldset>
        <label className="check"><input type="checkbox" checked={o.goodStanding} onChange={(ev) => up({ goodStanding: ev.target.checked })} /> <span>Only members whose dues for this year are paid (Life members always)</span></label>
        <div className="field-row">
          <Field label="How often"><select className="in" aria-label="How often" value={o.limit} onChange={(ev) => up({ limit: ev.target.value as Offer['limit'] })}>{Object.entries(LIMIT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <label className="check bn-feat"><input type="checkbox" checked={o.featured} onChange={(ev) => up({ featured: ev.target.checked })} /> <span>Show first</span></label>
        </div>
        <div className="field-row">
          <Field label="Starts" err={e('from')}><input className="in" aria-label="Starts" type="date" value={o.from} onChange={(ev) => up({ from: ev.target.value })} /></Field>
          <Field label="Ends" err={e('until')} hint={p?.agreementUntil ? `Agreement with the partner ends ${fmt(p.agreementUntil)}.` : undefined}><input className="in" aria-label="Ends" type="date" value={o.until} onChange={(ev) => up({ until: ev.target.value })} /></Field>
        </div>
      </div>
      <div className="bn-preview" aria-label="What members see">
        <small className="sf-label">What members see</small>
        <div className="bn-mcard"><b>{discountLabel(o)}</b><span>{o.title}</span><small>{p?.name}{o.details ? ` · ${o.details}` : ''}</small><small>Until {fmt(o.until)} · {LIMIT[o.limit]}</small></div>
      </div>
      {o.status === 'draft' && n === 0 && <div className="zk-act"><button type="button" className="btn ghost danger-ghost" onClick={() => { set((x) => { x.offers.splice(i, 1); }); onClose(); }}>Delete this draft</button></div>}
    </PanelFrame>
  );
}

/* ---------------- Partners ---------------- */
function Partners({ d, uses, onOpen, onNew }: { d: Benefits; uses: Redemption[]; onOpen: (id: string) => void; onNew: () => void }) {
  const t = today();
  const [state, setState] = useState('');
  const rows = d.partners.filter((p) => !state || partnerState(p, d, t) === state);
  const offersOf = (id: string) => d.offers.filter((o) => o.partnerId === id);
  return (
    <section className="glass-pane zk-list" aria-label="Partners">
      <div className="bn-bar">
        <h2>Partners <span className="pill">{d.partners.length}</span></h2>
        <select className="in pill-select" aria-label="Partner state" value={state} onChange={(e) => setState(e.target.value)}><option value="">Every state</option>{Object.entries(PARTNER_STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="button" className="btn primary" onClick={onNew}>Add partner</button>
      </div>
      <div className="table-wrap"><table className="t-plain zk-table">
        <thead><tr><th>Partner</th><th>Near</th><th>State</th><th>Agreement until</th><th>Review</th><th className="num">Live offers</th><th className="num">Uses</th></tr></thead>
        <tbody>{rows.map((p) => {
          const st = partnerState(p, d, t); const offers = offersOf(p.id);
          return (
            <tr key={p.id} data-partner={p.id}>
              <td><button type="button" className="zk-name linkish" onClick={() => onOpen(p.id)}>{p.name}</button><small className="block">{CATEGORIES[p.category]}</small></td>
              <td>{p.center ? p.center.replace(' Islamic Center', '') : 'All of Houston'}</td>
              <td><span className={`pill ${PARTNER_TONE[st]}`}>{PARTNER_STATE_LABEL[st]}</span></td>
              <td>{p.agreementUntil ? fmt(p.agreementUntil) : '—'}</td>
              <td>{p.reviewed.on ? <small>{fmt(p.reviewed.on)}</small> : <small className="zn-missing">Not yet</small>}</td>
              <td className="num">{offers.filter((o) => offerState(o, d, t) === 'live').length}</td>
              <td className="num">{uses.filter((r) => offers.some((o) => o.id === r.offerId)).length}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </section>
  );
}

function PartnerPanel({ doc, i, set, onClose, onOffer }: { doc: Doc; i: number; set: (f: (x: Benefits) => void) => void; onClose: () => void; onOffer: (id: string) => void }) {
  const access = useAccess();
  const d = doc.draft; const p = d.partners[i]; const t = today();
  const e = (f: string) => doc.issues[`partners.${i}.${f}`];
  const up = (patch: Partial<Partner>) => set((x) => { x.partners[i] = { ...x.partners[i], ...patch }; });
  const st = partnerState(p, d, t);
  const centers = mockOrgStructure.centers.filter((c) => c.active).map((c) => c.name);
  const offers = d.offers.filter((o) => o.partnerId === p.id);
  return (
    <PanelFrame label={`Partner ${p.name}`} data={{ 'data-open-partner': p.id }} pos={`Partner · ${p.id}`} onClose={onClose}>
      <div><h2 className="zk-case-h">{p.name}</h2><p className="m-peek-status"><span className={`pill ${PARTNER_TONE[st]}`}>{PARTNER_STATE_LABEL[st]}</span><span className="pill">{CATEGORIES[p.category]}</span></p></div>
      <div className="zk-act bn-review">
        <h3>Suitability review</h3>
        <p className="sf-hint">Halal, no interest-based products, family-friendly. {d.requireReview ? 'Needed before this partner’s offers show.' : 'Recommended (not required in Rules).'}</p>
        {p.reviewed.on
          ? <p>Reviewed by <b>{p.reviewed.by || '—'}</b> on {fmt(p.reviewed.on)}. <button type="button" className="linkish" onClick={() => up({ reviewed: { by: '', on: '' } })}>Clear</button></p>
          : <button type="button" className="btn" onClick={() => up({ reviewed: { by: access.me?.name ?? 'Admin', on: t } })}>Mark as reviewed</button>}
      </div>
      <div className="m-form bn-form">
        <div className="field-row">
          <Field label="Status"><select className="in" aria-label="Partner status" value={p.status} onChange={(ev) => up({ status: ev.target.value as Partner['status'] })}>{Object.entries(PARTNER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Agreement until" err={e('agreementUntil')}><input className="in" aria-label="Agreement until" type="date" value={p.agreementUntil} onChange={(ev) => up({ agreementUntil: ev.target.value })} /></Field>
        </div>
        <Field label="Business name" err={e('name')}><input className="in" aria-label="Business name" value={p.name} onChange={(ev) => up({ name: ev.target.value })} /></Field>
        <div className="field-row">
          <Field label="Category"><select className="in" aria-label="Partner category" value={p.category} onChange={(ev) => up({ category: ev.target.value as Category })}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Near"><select className="in" aria-label="Near center" value={p.center} onChange={(ev) => up({ center: ev.target.value })}><option value="">All of Houston</option>{!centers.includes(p.center) && p.center && <option value={p.center}>{p.center}</option>}{centers.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="Address"><input className="in" aria-label="Address" value={p.address} onChange={(ev) => up({ address: ev.target.value })} /></Field>
        <div className="field-row">
          <Field label="Phone" err={e('phone')}><input className="in" aria-label="Phone" value={p.phone} placeholder="(713) 555-0100" onChange={(ev) => up({ phone: ev.target.value })} /></Field>
          <Field label="Website" err={e('website')}><input className="in" aria-label="Website" type="url" value={p.website} placeholder="https://" onChange={(ev) => up({ website: ev.target.value })} /></Field>
        </div>
        <div className="field-row">
          <Field label="Contact person" hint="Staff only – never shown to members."><input className="in" aria-label="Contact person" value={p.contact.name} onChange={(ev) => up({ contact: { ...p.contact, name: ev.target.value } })} /></Field>
          <Field label="Contact email" err={e('contact.email')}><input className="in" aria-label="Contact email" type="email" value={p.contact.email} onChange={(ev) => up({ contact: { ...p.contact, email: ev.target.value } })} /></Field>
        </div>
        <Field label="Notes (staff only)"><textarea className="in" aria-label="Partner notes" rows={2} maxLength={500} value={p.notes} onChange={(ev) => up({ notes: ev.target.value })} /></Field>
      </div>
      <div className="bn-poffers"><h3>Offers</h3>{offers.length ? <ul>{offers.map((o) => <li key={o.id}><button type="button" className="linkish" onClick={() => onOffer(o.id)}>{discountLabel(o)} · {o.title}</button> <small>{OFFER_STATE_LABEL[offerState(o, d, t)]}</small></li>)}</ul> : <p className="muted">No offers yet.</p>}</div>
    </PanelFrame>
  );
}

/* ---------------- Use log ---------------- */
function Uses({ d, uses }: { d: Benefits; uses: Redemption[] }) {
  const [offer, setOffer] = useState(''); const [via, setVia] = useState(''); const [dlg, setDlg] = useState(false);
  const title = (id: string) => d.offers.find((o) => o.id === id)?.title ?? id;
  const mf = useMasjidFilter();
  const rows = useMemo(() => uses.filter((r) => mf.keep('', r.center) && (!offer || r.offerId === offer) && (!via || r.via === via)).sort((a, b) => b.at.localeCompare(a.at)), [uses, offer, via, mf.zone, mf.masjid, mf.access.ready, mf.access.me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const csv = () => {
    const out = [['Use', 'Date', 'Offer', 'Member ID', 'Way', 'Center'], ...rows.map((r) => [r.id, fmtDay(r.at), title(r.offerId), r.memberId, VIA[r.via], r.center])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.map((x) => x.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `benefit-uses-${today()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <section className="glass-pane zk-list" aria-label="Use log">
      <div className="bn-bar">
        <h2>Use log <span className="pill">{rows.length}</span></h2>
        <MasjidPicker unrouted />
        <select className="in pill-select" aria-label="Filter by offer" value={offer} onChange={(e) => setOffer(e.target.value)}><option value="">Every offer</option>{d.offers.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select>
        <select className="in pill-select" aria-label="Filter by way" value={via} onChange={(e) => setVia(e.target.value)}><option value="">Every way</option>{Object.entries(VIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="button" className="btn" onClick={csv}>Download CSV</button>
        <button type="button" className="btn primary" onClick={() => setDlg(true)}>Record a use</button>
      </div>
      <p className="muted small">Only the member ID is kept – no names or contact details. Saved as it happens (no need to publish).</p>
      <div className="table-wrap"><table className="t-plain zk-table">
        <thead><tr><th>Date</th><th>Offer</th><th>Member</th><th>Way</th><th>Center</th></tr></thead>
        <tbody>{rows.slice(0, 200).map((r) => <tr key={r.id} data-use={r.id}><td>{fmtDay(r.at)}<small className="block">{r.id}</small></td><td>{title(r.offerId)}</td><td>{r.memberId}</td><td>{VIA[r.via]}</td><td>{r.center.replace(' Islamic Center', '') || '—'}</td></tr>)}</tbody>
      </table></div>
      {dlg && <UseDialog d={d} uses={uses} onClose={() => setDlg(false)} />}
    </section>
  );
}

function UseDialog({ d, uses, onClose }: { d: Benefits; uses: Redemption[]; onClose: () => void }) {
  const members = useMembers() ?? [];
  const t = today();
  const [f, setF] = useState({ memberId: '', offerId: '' });
  const [err, setErr] = useState('');
  const live = d.offers.filter((o) => offerState(o, d, t) === 'live');
  const save = (e: FormEvent) => {
    e.preventDefault();
    const m = members.find((x) => x.id.toLowerCase() === f.memberId.trim().toLowerCase());
    const o = live.find((x) => x.id === f.offerId);
    if (!m) { setErr('No member with this ID.'); return; }
    if (!o) { setErr('Choose a live offer.'); return; }
    const el = eligibility(o, factsOf(m)); if (!el.ok) { setErr(el.why); return; }
    const us = usage(o, m.id, uses, t); if (!us.ok) { setErr(us.why); return; }
    const p = d.partners.find((x) => x.id === o.partnerId);
    addUse({ id: nextUseId(uses), at: new Date().toISOString(), offerId: o.id, memberId: m.id, center: p?.center ?? '', via: 'office' }, o.title);
    onClose();
  };
  const ref = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  return (
    <dialog ref={ref} className="modal glass-float zn-dialog" aria-label="Record a use" onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={save} noValidate>
        <h2>Record a use</h2>
        <p className="sf-hint">For members who used an offer at the office or by phone. The rules (plan, dues, how often) are checked.</p>
        <Field label="Member ID"><input className="in" aria-label="Member ID" placeholder="HOU-204781" value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })} /></Field>
        <Field label="Offer"><select className="in" aria-label="Offer used" value={f.offerId} onChange={(e) => setF({ ...f, offerId: e.target.value })}><option value="">Choose…</option>{live.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></Field>
        {err && <p className="notice warn-note" role="alert">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">Save use</button></div>
      </form>
    </dialog>
  );
}

/* ---------------- Rules ---------------- */
function Rules({ d, set }: { d: Benefits; set: (f: (x: Benefits) => void) => void }) {
  return (
    <div className="cv">
      <Panel title="What members see">
        <SwitchRow id="bn-enabled" label="Show “My benefits” in the member portal" checked={d.enabled} onChange={(v) => set((x) => { x.enabled = v; })} />
        <SwitchRow id="bn-locked" label="Also show offers for other plans (marked “For Family members”)" help="Lets members see what another plan would give them. Off = members only see what they can use." checked={d.showLocked} onChange={(v) => set((x) => { x.showLocked = v; })} />
      </Panel>
      <Panel title="Partners">
        <SwitchRow id="bn-review" label="A partner needs the suitability review before its offers show" help="Halal, no interest-based products, family-friendly. Who reviews is up to the Board." checked={d.requireReview} onChange={(v) => set((x) => { x.requireReview = v; })} />
        <p className="sf-hint">Partners check a member on the website’s Verify page with the member ID, last name and ZIP. They see the first name, last initial and whether the membership is active – never address, phone, email or birth date.</p>
      </Panel>
    </div>
  );
}
