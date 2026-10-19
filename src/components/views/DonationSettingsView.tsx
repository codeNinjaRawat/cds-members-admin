'use client';
/**
 * F3 Donations › Funds and rules: the funds (and which center gets each one), the main center, which platforms send
 * gifts, the receipt threshold and the Check-o-matic rule. Published like every other document; only "Manage finance"
 * may publish. DEMO: the platforms are switches only – no keys are entered here (Settings › Integrations holds them).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel } from '@/components/editor/bits';
import { CHECKOMATIC_MODES, ONLINE_PLATFORMS, PLATFORMS, accountFor, fundsForCenter, isCentralFund, usd, type DonationSettings, type Fund } from '@/lib/community/donations';
import { mockOrgStructure, OrgStructureSchema, type OrgStructure } from '@/lib/community/org-structure';

type Doc = { draft: DonationSettings; setDraft: (f: DonationSettings | ((d: DonationSettings) => DonationSettings)) => void; issues: Record<string, string> };
const ROUTE: Record<Fund['route'], string> = { given: 'The center it was given to', main: 'The main center', all: 'Shared by all centers' };

export function DonationSettingsView() {
  return (
    <DocEditor<DonationSettings> storeKey="donation-settings" title="Funds and donation rules" preview={false}
      intro="The funds donors can give to, which center each fund belongs to, receipts, and whether a gift can lead to membership (Check-o-matic). Gifts already received keep the fund they were given to.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function Money({ label, value, onChange, err, hint }: { label: string; value: number; onChange: (c: number) => void; err?: string; hint?: ReactNode }) {
  return (
    <label className="sf-field"><span className="sf-label">{label}</span>
      <span className="in-money"><i>$</i><input className="in" type="number" min="0" step="1" value={value / 100} onChange={(e) => onChange(Math.round(Number(e.target.value || 0) * 100))} aria-invalid={!!err} /></span>
      {hint && <small className="sf-hint">{hint}</small>}{err && <small className="sf-err">{err}</small>}</label>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function Body({ doc }: { doc: Doc }) {
  const d = doc.draft;
  const set = (f: (x: DonationSettings) => DonationSettings) => doc.setDraft((x) => f(structuredClone(x)));
  const e = (k: string) => doc.issues[k];
  const [map, setMap] = useState<OrgStructure>(mockOrgStructure);
  const [newFund, setNewFund] = useState('');
  useEffect(() => {
    void fetch('/api/store/org-structure', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = OrgStructureSchema.safeParse(j?.data); if (p.success) setMap(p.data); }).catch(() => {});
  }, []);
  const centers = map.centers.filter((c) => c.active).map((c) => c.name);
  const c = d.checkomatic;
  const fundErr = Object.entries(doc.issues).filter(([k]) => k.startsWith('checkomatic.funds')).map(([, v]) => v)[0];
  const addFund = () => {
    const name = newFund.trim(); const id = slug(name);
    if (name.length < 2 || !id) return;
    set((x) => { x.funds.push({ id: x.funds.some((f) => f.id === id) ? `${id}-2` : id, name, restricted: true, route: 'given', zakat: false, active: true }); return x; });
    setNewFund('');
  };
  return (
    <div className="cv dn-settings">
      <Panel title="Funds" intro="Restricted money may only be spent on its purpose. “Goes to” decides which center’s books the gift lands in.">
        <div className="table-wrap"><table className="t-plain zk-table dn-funds">
          <thead><tr><th>Fund</th><th>Goes to</th><th>Restricted</th><th>Zakat</th><th>Active</th></tr></thead>
          <tbody>{d.funds.map((f, i) => (
            <tr key={i} data-fund={f.id} className={f.active ? '' : 'off'}>
              <td><input className="in" aria-label={`Fund name ${f.id}`} value={f.name} onChange={(ev) => set((x) => { x.funds[i].name = ev.target.value; return x; })} aria-invalid={!!e(`funds.${i}.name`)} /><small className="block">{f.id}</small>{(e(`funds.${i}.id`) || e(`funds.${i}.name`)) && <small className="sf-err">{e(`funds.${i}.id`) ?? e(`funds.${i}.name`)}</small>}</td>
              <td><select className="in" aria-label={`Goes to ${f.id}`} value={f.route} onChange={(ev) => set((x) => { x.funds[i].route = ev.target.value as Fund['route']; return x; })}>{Object.entries(ROUTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td><input type="checkbox" aria-label={`Restricted ${f.id}`} checked={f.restricted} onChange={(ev) => set((x) => { x.funds[i].restricted = ev.target.checked; return x; })} /></td>
              <td><input type="checkbox" aria-label={`Zakat fund ${f.id}`} checked={f.zakat} onChange={(ev) => set((x) => { x.funds[i].zakat = ev.target.checked; return x; })} /></td>
              <td><input type="checkbox" aria-label={`Active ${f.id}`} checked={f.active} onChange={(ev) => set((x) => { x.funds[i].active = ev.target.checked; return x; })} /></td>
            </tr>
          ))}</tbody>
        </table></div>
        {e('funds') && <p className="sf-err" role="alert">{e('funds')}</p>}
        <div className="dn-addfund">
          <input className="in" aria-label="New fund name" placeholder="New fund, e.g. Food pantry" value={newFund} onChange={(ev) => setNewFund(ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addFund(); } }} />
          <button type="button" className="btn" onClick={addFund} disabled={newFund.trim().length < 2}>Add fund</button>
        </div>
        <p className="muted small">Funds are never deleted – turn one off and it disappears from the donation forms but keeps its history.</p>
      </Panel>

      <Panel title="Main center and receipts">
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Main center</span>
            <select className="in" value={d.mainCenter} onChange={(ev) => set((x) => { x.mainCenter = ev.target.value; return x; })}>
              {!centers.includes(d.mainCenter) && <option value={d.mainCenter}>{d.mainCenter || 'Choose a center'}</option>}
              {centers.map((n) => <option key={n} value={n}>{n}</option>)}
            </select><small className="sf-hint">Funds set to “The main center” land here.</small></label>
          <Money label="Send a written receipt for gifts of" value={d.receiptAboveCents} onChange={(v) => set((x) => { x.receiptAboveCents = v; return x; })} hint={d.receiptAboveCents === 0 ? 'Every gift gets a receipt.' : `${usd(d.receiptAboveCents)} or more. The IRS asks for a written acknowledgment from $250.`} />
        </div>
      </Panel>

      {/* D12 – money per center */}
      <Panel title="Each center’s account and funds" intro="From the review call: a gift to a masjid goes to that masjid’s own account, except the central funds (Zakat, Sadaqah for the needy, Weekend school…), which go to the organization. Keys stay in Settings › Integrations – only a name and the last 4 characters are kept here. A center with no row uses the organization’s account and every fund marked “the center it was given to”.">
        <p className="muted small">Central funds now: {d.funds.filter((f) => f.active && isCentralFund(f)).map((f) => f.name).join(', ') || 'none'} (a fund is central when “Goes to” is the main center or shared).</p>
        <div className="table-wrap"><table className="m-grid compact dn-centers">
          <thead><tr><th scope="col">Center</th><th scope="col">Payment account</th><th scope="col">Account name · last 4</th><th scope="col">Funds this center offers</th><th scope="col">Example: a $10 gift to General goes to</th></tr></thead>
          <tbody>{map.centers.filter((c) => c.active).map((c) => {
            const row = d.centers?.[c.name] ?? { account: { provider: 'organization' as const, label: '', last4: '', enabled: true }, funds: [] };
            const up = (f: (r: typeof row) => void) => set((x) => { x.centers ??= {}; x.centers[c.name] ??= structuredClone(row); f(x.centers[c.name]); return x; });
            const given = d.funds.filter((f) => f.active && !isCentralFund(f));
            const acc = accountFor(d, c.name, 'general');
            return (
              <tr key={c.id} data-center={c.id}>
                <th scope="row">{c.name}</th>
                <td><select className="in sm" aria-label={`${c.name} – payment account`} value={row.account.provider} onChange={(ev) => up((r) => { r.account.provider = ev.target.value as 'stripe'; })}>
                  <option value="organization">Organization’s account</option><option value="stripe">Own Stripe account</option><option value="paypal">Own PayPal</option><option value="zeffy">Own Zeffy</option></select></td>
                <td>{row.account.provider === 'organization' ? <span className="muted small">shared</span> : <span className="dn-acc">
                  <input className="in sm" aria-label={`${c.name} – account name`} placeholder="Bank and masjid, e.g. Chase – Abu Bakr" value={row.account.label} aria-invalid={!!e(`centers.${c.name}.account.label`)} onChange={(ev) => up((r) => { r.account.label = ev.target.value; })} />
                  <input className="in sm in-last4" aria-label={`${c.name} – last 4`} placeholder="last 4" maxLength={4} value={row.account.last4} onChange={(ev) => up((r) => { r.account.last4 = ev.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4); })} />
                  {e(`centers.${c.name}.account.label`) && <small className="sf-err block">{e(`centers.${c.name}.account.label`)}</small>}</span>}</td>
                <td><div className="chip-row sm" role="group" aria-label={`${c.name} – funds`}>
                  {given.map((f) => { const on = row.funds.length ? row.funds.includes(f.id) : true; return <button key={f.id} type="button" aria-pressed={on} onClick={() => up((r) => { const all = given.map((g) => g.id); const cur = r.funds.length ? r.funds : all; r.funds = cur.includes(f.id) ? cur.filter((x) => x !== f.id) : [...cur, f.id]; if (r.funds.length === all.length) r.funds = []; })}>{f.name}</button>; })}
                  <small className="muted block">+ central funds always · {fundsForCenter(d, c.name).length} shown to donors</small></div></td>
                <td className="small muted">{acc.owner === 'center' ? `${acc.label}${acc.last4 ? ` ····${acc.last4}` : ''}` : 'the organization’s account'}</td>
              </tr>);
          })}</tbody>
        </table></div>
      </Panel>
      <Panel title="Where gifts come from" intro="Switch a platform off and its gifts stop arriving here. Keys and accounts live in Settings › Integrations.">
        <ul className="dn-plats">{ONLINE_PLATFORMS.map((p) => (
          <li key={p}><label className="check"><input type="checkbox" checked={d.platforms[p]?.enabled ?? false} onChange={(ev) => set((x) => { x.platforms[p] = { enabled: ev.target.checked, lastSync: x.platforms[p]?.lastSync ?? '' }; return x; })} /> <span>{PLATFORMS[p]}</span></label></li>
        ))}</ul>
      </Panel>

      <Panel title="Check-o-matic" intro="Whether a gift at a masjid can lead to membership. The Bylaws do not say a gift makes someone a member, so the safest choice is an application the Board approves.">
        <fieldset className="dn-modes"><legend className="sf-label">What a qualifying gift does</legend>
          {(Object.keys(CHECKOMATIC_MODES) as (keyof typeof CHECKOMATIC_MODES)[]).map((m) => (
            <label key={m} className={`dn-mode${c.mode === m ? ' on' : ''}`}><input type="radio" name="cm-mode" value={m} checked={c.mode === m} onChange={() => set((x) => { x.checkomatic.mode = m; if (m !== 'member') x.checkomatic.countsAsDues = false; return x; })} /> <span>{CHECKOMATIC_MODES[m]}</span></label>
          ))}
        </fieldset>
        {c.mode !== 'off' && <>
          <div className="field-row">
            <Money label="Smallest gift that counts" value={c.minCents} onChange={(v) => set((x) => { x.checkomatic.minCents = v; return x; })} />
          </div>
          <fieldset className="dn-cm-funds"><legend className="sf-label">Funds that count</legend>
            {d.funds.filter((f) => f.active || c.funds.includes(f.id)).map((f) => (
              <label key={f.id} className="check"><input type="checkbox" aria-label={`Counts: ${f.name}`} checked={c.funds.includes(f.id)} onChange={(ev) => set((x) => { x.checkomatic.funds = ev.target.checked ? [...x.checkomatic.funds, f.id] : x.checkomatic.funds.filter((y) => y !== f.id); return x; })} /> <span>{f.name}</span></label>
            ))}
            {fundErr && <p className="sf-err" role="alert">{fundErr}</p>}
          </fieldset>
          <label className="check"><input type="checkbox" disabled={c.mode !== 'member'} checked={c.countsAsDues} onChange={(ev) => set((x) => { x.checkomatic.countsAsDues = ev.target.checked; return x; })} /> <span>The gift also counts as the member’s dues (and so for the right to vote){c.mode !== 'member' && ' – only possible with “Member”'}</span></label>
          {e('checkomatic.countsAsDues') && <p className="sf-err" role="alert">{e('checkomatic.countsAsDues')}</p>}
        </>}
      </Panel>
    </div>
  );
}
