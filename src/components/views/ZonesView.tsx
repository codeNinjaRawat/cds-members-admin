'use client';
/**
 * F1 Zones and Islamic Centers. Three tabs in the order staff need them: Zones (who leads each area, term dates) →
 * Islamic Centers (address, contact, Jumu'ah, services) → ZIP codes (which ZIP belongs to which zone – used to place
 * members and route Zakat applications). Warnings sit at the top; everything publishes as one document.
 * DEMO (no API). Live: GET/PUT /admin/org-structure.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { DocEditor, Modal } from '@/components/editor/DocEditor';
import { Panel, SwitchRow, Tabs, countIssues } from '@/components/editor/bits';
import {
  CenterSchema, SERVICE_LABEL, STRUCTURE_PRESETS, centerForZip, centersIn, fmt, homeForZip, unservedZips, fmtTime, slugify, structureWarnings, unassignedZips, zoneForZip,
  type Center, type OrgStructure, type Zone,
} from '@/lib/community/org-structure';
import { useMembers } from './MembersView';
import { centerRulesInWords, DEFAULT_CENTER_RULES, DEFAULT_PROFILE, MasjidProfileSchema, type CenterRules } from '@/lib/community/org-structure';
import { SchemaForm } from '@/components/forms/SchemaForm';
import { centerOf, ORG_TZ } from '@/lib/members/members';

type Doc = { draft: OrgStructure; setDraft: (f: OrgStructure | ((d: OrgStructure) => OrgStructure)) => void; issues: Record<string, string> };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
const n = (v: number) => v.toLocaleString('en-US');

export function ZonesView() {
  return (
    <DocEditor<OrgStructure> storeKey="org-structure" title="Zones and Islamic Centers" preview={false}
      intro="The organization's map: who leads each zone, the Islamic Centers in it, and which ZIP codes belong where. Members, Zakat applications and donations are placed by this map.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function Body({ doc }: { doc: Doc }) {
  const members = useMembers() ?? [];
  const warns = structureWarnings(doc.draft, today());
  const byZone = useMemo(() => { const m = new Map<string, number>(); members.filter((x) => !x.archived).forEach((x) => m.set(x.zone, (m.get(x.zone) ?? 0) + 1)); return m; }, [members]);
  const byCenter = useMemo(() => { const m = new Map<string, number>(); members.filter((x) => !x.archived).forEach((x) => m.set(centerOf(x), (m.get(centerOf(x)) ?? 0) + 1)); return m; }, [members]);
  const loose = unassignedZips(doc.draft, members.map((m) => m.zip));
  const byZip = useMemo(() => { const m = new Map<string, number>(); members.filter((x) => !x.archived).forEach((x) => m.set(x.zip.slice(0, 5), (m.get(x.zip.slice(0, 5)) ?? 0) + 1)); return m; }, [members]);
  return (
    <div className="zn">
      {warns.length > 0 && (
        <details className="notice warn-note zn-warns" open={warns.length <= 4}>
          <summary><b>{warns.length} thing{warns.length === 1 ? '' : 's'} to look at</b></summary>
          <ul>{warns.map((w, i) => <li key={i} data-zone={w.zone} data-center={w.center}>{w.text}</li>)}</ul>
        </details>
      )}
      <Presets doc={doc} />
      <Tabs label="Zones and centers" tabs={[
        { id: 'zones', label: 'Zones', badge: countIssues(doc.issues, ['zones']), render: () => <ZonesTab doc={doc} byZone={byZone} /> },
        { id: 'centers', label: 'Islamic Centers', badge: countIssues(doc.issues, ['centers']), render: () => <CentersTab doc={doc} byCenter={byCenter} /> },
        { id: 'rules', label: 'Rules', badge: countIssues(doc.issues, ['rules']), render: () => <RulesTab doc={doc} /> },
        { id: 'zips', label: 'ZIP codes and masjids', badge: (loose.length + doc.draft.zones.reduce((a, z) => a + unservedZips(doc.draft, z.id).length, 0)) || undefined, render: () => <ZipsTab doc={doc} loose={loose} byZip={byZip} /> },
      ]} />
    </div>
  );
}

/* ---------------- Z1/Z2 presets ---------------- */
function Presets({ doc }: { doc: Doc }) {
  const [id, setId] = useState(STRUCTURE_PRESETS[0].id);
  const [ask, setAsk] = useState(false);
  const p = STRUCTURE_PRESETS.find((x) => x.id === id)!;
  return (
    <div className="zn-presets glass-pane">
      <div className="zn-preset-row">
        <label className="sf-field zn-preset-pick"><span className="sf-label">Start from a preset</span><select className="in" aria-label="Map preset" value={id} onChange={(e) => setId(e.target.value)}>{STRUCTURE_PRESETS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <button type="button" className="btn" onClick={() => setAsk(true)}>Load into the draft</button>
      </div>
      <p className="muted small">{p.blurb} Loading replaces the zones, centers and ZIP codes in the draft; nothing is published until you press Publish.</p>
      {ask && (
        <Modal title={`Load “${p.name}”?`} onClose={() => setAsk(false)}>
          <p>{p.blurb}</p>
          <p>{p.doc.zones.length} zones, {p.doc.centers.length} centers. This replaces the {doc.draft.zones.length} zones and {doc.draft.centers.length} centers in the draft.</p>
          {p.notes.length > 0 && <ul className="zn-preset-notes">{p.notes.map((t) => <li key={t}>{t}</li>)}</ul>}
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setAsk(false)}>Keep my map</button><button type="button" className="btn primary" onClick={() => { doc.setDraft(structuredClone(p.doc)); setAsk(false); }}>Load into the draft</button></div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Zones ---------------- */
function ZonesTab({ doc, byZone }: { doc: Doc; byZone: Map<string, number> }) {
  const [open, setOpen] = useState<string | null>(null);
  const t = today();
  const setZone = (i: number, patch: Partial<Zone>) => doc.setDraft((d) => { const c = structuredClone(d); c.zones[i] = { ...c.zones[i], ...patch }; return c; });
  return (
    <div className="zn-zones">
      {doc.draft.zones.map((z, i) => {
        const centers = centersIn(doc.draft, z.id);
        const term = !z.termEnds ? null : z.termEnds < t ? 'ended' : z.termEnds <= addDays(t, 90) ? 'soon' : 'ok';
        const err = (f: string) => doc.issues[`zones.${i}.${f}`];
        return (
          <section key={z.id} className={`zn-card glass-pane${z.active ? '' : ' off'}${open === z.id ? ' open' : ''}`} data-zone={z.id} aria-labelledby={`zn-${z.id}`}>
            <header className="zn-card-h">
              <h2 id={`zn-${z.id}`}>{z.name}</h2>
              {!z.active && <span className="pill">Not active</span>}
              <button type="button" className="btn sm ghost" aria-expanded={open === z.id} onClick={() => setOpen(open === z.id ? null : z.id)}>{open === z.id ? 'Done' : 'Edit'}<span className="sr-only"> {z.name}</span></button>
            </header>
            <p className="zn-areas">{z.areas || <i className="muted">No areas described</i>}</p>
            <dl className="zn-facts">
              <div><dt>Director</dt><dd>{z.director.name || <span className="zn-missing">Not set</span>}{z.director.email && <small><a href={`mailto:${z.director.email}`}>{z.director.email}</a></small>}</dd></div>
              <div><dt>Term ends</dt><dd>{z.termEnds ? <span className={`zn-term ${term}`}>{fmt(z.termEnds)}{term === 'ended' ? ' · ended' : term === 'soon' ? ' · soon' : ''}</span> : '—'}</dd></div>
            </dl>
            <ul className="zn-counts">
              <li><b>{centers.length}</b> {centers.length === 1 ? 'center' : 'centers'}</li>
              <li><b>{n(byZone.get(z.id) ?? 0)}</b> members</li>
              <li><b>{z.zips.length}</b> ZIP codes</li>
            </ul>
            {open === z.id && (
              <div className="zn-edit sf">
                <div className="field-row">
                  <label className="sf-field"><span className="sf-label">Zone name</span><input className="in" value={z.name} onChange={(e) => setZone(i, { name: e.target.value })} aria-invalid={!!err('name')} />{err('name') && <small className="sf-err">{err('name')}</small>}</label>
                  <label className="sf-field"><span className="sf-label">Term ends</span><input className="in" type="date" value={z.termEnds} onChange={(e) => setZone(i, { termEnds: e.target.value })} /></label>
                </div>
                <label className="sf-field"><span className="sf-label">Areas it covers</span><input className="in" value={z.areas} maxLength={240} onChange={(e) => setZone(i, { areas: e.target.value })} /></label>
                <div className="field-row">
                  <label className="sf-field"><span className="sf-label">Director</span><input className="in" value={z.director.name} onChange={(e) => setZone(i, { director: { ...z.director, name: e.target.value } })} /></label>
                  <label className="sf-field"><span className="sf-label">Director email</span><input className="in" type="email" value={z.director.email} onChange={(e) => setZone(i, { director: { ...z.director, email: e.target.value } })} aria-invalid={!!err('director.email')} />{err('director.email') && <small className="sf-err">{err('director.email')}</small>}</label>
                </div>
                <label className="check"><input type="checkbox" checked={z.active} onChange={(e) => setZone(i, { active: e.target.checked })} /> <span>Active zone</span></label>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Islamic Centers ---------------- */
function CentersTab({ doc, byCenter }: { doc: Doc; byCenter: Map<string, number> }) {
  const [zone, setZone] = useState('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ index: number | null; c: Center } | null>(null);
  const zones = doc.draft.zones;
  const s = q.trim().toLowerCase();
  const list = doc.draft.centers.map((c, i) => ({ c, i })).filter(({ c }) => (!zone || c.zone === zone) && (!s || `${c.name} ${c.aka} ${c.address.city} ${c.address.zip}`.toLowerCase().includes(s)));
  const blank = (): Center => ({ id: '', name: '', aka: '', zone: zone || zones[0]?.id || '', address: { street: '', city: '', zip: '' }, phone: '', website: '', jumuah: [{ khutbah: '13:15', label: '' }], services: ['daily-prayers', 'jumuah'], zips: [], profile: DEFAULT_PROFILE, active: true });
  return (
    <div className="zn-centers">
      <div className="zn-bar">
        <label className="m-search"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" /></svg><span className="sr-only">Search centers</span><input className="in" type="search" placeholder="Center name, city or ZIP" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="in pill-select" aria-label="Zone" value={zone} onChange={(e) => setZone(e.target.value)}><option value="">All zones</option>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
        <button type="button" className="btn primary" onClick={() => setEdit({ index: null, c: blank() })}>Add center</button>
      </div>
      {zones.filter((z) => !zone || z.id === zone).map((z) => {
        const rows = list.filter(({ c }) => c.zone === z.id);
        if (!rows.length) return null;
        return (
          <Panel key={z.id} title={`${z.name} · ${rows.length} center${rows.length === 1 ? '' : 's'}`}>
            <div className="table-wrap"><table className="t-plain zn-table">
              <thead><tr><th>Center</th><th>Address</th><th>Service area</th><th>Jumu'ah</th><th>Members</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{rows.map(({ c, i }) => (
                <tr key={c.id} data-center={c.id} className={c.active ? '' : 'off'}>
                  <td><b>{c.name}</b>{c.aka && <small className="block">{c.aka}</small>}<span className="zn-svc">{c.services.filter((x) => x !== 'daily-prayers' && x !== 'jumuah').map((x) => <span key={x} className="chip">{SERVICE_LABEL[x]}</span>)}</span>{!c.active && <span className="pill">Not active</span>}</td>
                  <td>{c.address.street}<small className="block">{c.address.city}{c.address.city ? ', TX ' : ''}{c.address.zip}</small>{c.phone && <small className="block"><a href={`tel:+1${c.phone.replace(/\D/g, '')}`}>{c.phone}</a></small>}</td>
                  <td className="zn-area">{c.zips.length ? c.zips.map((z) => <span key={z} className="chip">{z}</span>) : <span className="zn-missing">No ZIP codes</span>}</td>
                  <td>{c.jumuah.length ? c.jumuah.map((j) => <span key={j.khutbah} className="block">{fmtTime(j.khutbah)}{j.label ? ` · ${j.label}` : ''}</span>) : <span className="zn-missing">{c.services.includes('jumuah') ? 'No time' : '—'}</span>}</td>
                  <td className="num">{n(byCenter.get(c.name) ?? 0)}</td>
                  <td className="row-actions"><button type="button" className="btn sm" onClick={() => setEdit({ index: i, c: structuredClone(c) })}>Edit<span className="sr-only"> {c.name}</span></button></td>
                </tr>
              ))}</tbody>
            </table></div>
          </Panel>
        );
      })}
      {!list.length && <p className="cv-empty">No centers match.</p>}
      {edit && <CenterDialog doc={doc} edit={edit} members={edit.index == null ? 0 : byCenter.get(doc.draft.centers[edit.index].name) ?? 0} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CenterDialog({ doc, edit, members, onClose }: { doc: Doc; edit: { index: number | null; c: Center }; members: number; onClose: () => void }) {
  const [c, setC] = useState<Center>(edit.c);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (p: Partial<Center>) => setC((x) => ({ ...x, ...p }));
  const home = c.address.zip.length === 5 ? zoneForZip(doc.draft, c.address.zip) : null;
  const save = (e: FormEvent) => {
    e.preventDefault();
    const id = c.id || uniqueId(slugify(c.name), doc.draft.centers.map((x) => x.id));
    const r = CenterSchema.safeParse({ ...c, id });
    const dup = doc.draft.centers.some((x, i) => i !== edit.index && x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
    const out: Record<string, string> = {};
    if (!r.success) r.error.issues.forEach((i) => { out[i.path.join('.')] ??= i.message; });
    if (dup) out.name = `Another center is already called “${c.name}”.`;
    setErrs(out);
    if (Object.keys(out).length || !r.success) return;
    doc.setDraft((d) => { const x = structuredClone(d); if (edit.index == null) x.centers.push(r.data); else x.centers[edit.index] = r.data; return x; });
    onClose();
  };
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const E = ({ k }: { k: string }) => (errs[k] ? <small className="sf-err" role="alert">{errs[k]}</small> : null);
  return (
    <dialog ref={open} className="modal glass-float zn-dialog" aria-label={edit.index == null ? 'Add an Islamic Center' : `Edit ${edit.c.name}`} onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={save} noValidate>
        <h2>{edit.index == null ? 'Add an Islamic Center' : `Edit ${edit.c.name}`}</h2>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Name</span><input className="in" value={c.name} onChange={(e) => set({ name: e.target.value })} required /><E k="name" /></label>
          <label className="sf-field"><span className="sf-label">Also known as <span className="sf-opt">optional</span></span><input className="in" value={c.aka} onChange={(e) => set({ aka: e.target.value })} placeholder="Adel Road Islamic Center" /></label>
        </div>
        <label className="sf-field"><span className="sf-label">Zone</span>
          <select className="in" value={c.zone} onChange={(e) => set({ zone: e.target.value })}>{doc.draft.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select><E k="zone" />
          {home && home.id !== c.zone && <small className="sf-warn">ZIP {c.address.zip} belongs to {home.name}. <button type="button" className="linkish" onClick={() => set({ zone: home.id })}>Use {home.name}</button></small>}
        </label>
        <label className="sf-field"><span className="sf-label">Street address</span><input className="in" value={c.address.street} onChange={(e) => set({ address: { ...c.address, street: e.target.value } })} /></label>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">City</span><input className="in" value={c.address.city} onChange={(e) => set({ address: { ...c.address, city: e.target.value } })} /></label>
          <label className="sf-field"><span className="sf-label">ZIP code</span><input className="in" inputMode="numeric" maxLength={5} value={c.address.zip} onChange={(e) => set({ address: { ...c.address, zip: e.target.value.replace(/\D/g, '') } })} /><E k="address.zip" /></label>
        </div>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Phone</span><input className="in" value={c.phone} onChange={(e) => set({ phone: formatPhone(e.target.value) })} placeholder="(713) 555-0100" /><E k="phone" /></label>
          <label className="sf-field"><span className="sf-label">Website</span><input className="in" value={c.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" /><E k="website" /></label>
        </div>
        <fieldset className="sf-field"><legend className="sf-label">Jumu'ah khutbah times</legend>
          <div className="zn-times">
            {c.jumuah.map((j, i) => (
              <span key={i} className="zn-time">
                <input className="in" type="time" aria-label={`Khutbah ${i + 1}`} value={j.khutbah} onChange={(e) => set({ jumuah: c.jumuah.map((x, k) => (k === i ? { ...x, khutbah: e.target.value } : x)) })} />
                <button type="button" className="icon-btn sm" aria-label={`Remove khutbah ${i + 1}`} onClick={() => set({ jumuah: c.jumuah.filter((_, k) => k !== i) })}>×</button>
              </span>
            ))}
            {c.jumuah.length < 4 && <button type="button" className="btn sm ghost" onClick={() => set({ jumuah: [...c.jumuah, { khutbah: '14:15', label: c.jumuah.length ? 'Second' : '' }] })}>+ Add a time</button>}
          </div><E k="jumuah" />
        </fieldset>
        <fieldset className="sf-field"><legend className="sf-label">Services</legend>
          <div className="zn-svc-pick">{(Object.keys(SERVICE_LABEL) as Center['services']).map((k) => (
            <label key={k} className="check"><input type="checkbox" checked={c.services.includes(k)} onChange={() => set({ services: c.services.includes(k) ? c.services.filter((x) => x !== k) : [...c.services, k] })} /> <span>{SERVICE_LABEL[k]}</span></label>
          ))}</div>
        </fieldset>
        <details className="sf-group d0 zn-profile">
          <summary className="sf-label">Masjid page (website /masjid/{c.id || slugify(c.name) || '…'}) <span className="sf-opt">optional</span></summary>
          <p className="sf-hint">Photo, story, accent color, facilities, hours, social links and staff for this masjid’s own pages. Prayer times, events, leaders and campaigns come from their modules automatically.</p>
          <SchemaForm schema={MasjidProfileSchema} value={c.profile} path={['profile']} issues={errs} onChange={(v) => set({ profile: v as Center['profile'] })} />
        </details>
        <label className="check"><input type="checkbox" checked={c.active} onChange={(e) => set({ active: e.target.checked })} /> <span>Active center</span></label>
        {!c.active && members > 0 && <p className="notice warn-note">{n(members)} members are linked to this center. They keep it on their record until a center change is approved.</p>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">{edit.index == null ? 'Add center' : 'Save center'}</button></div>
        <p className="muted zn-pub">Changes go live when you publish.</p>
      </form>
    </dialog>
  );
}

/* ---------------- ZIP codes and masjid service areas ---------------- */
function ZipsTab({ doc, loose, byZip }: { doc: Doc; loose: string[]; byZip: Map<string, number> }) {
  const [add, setAdd] = useState<Record<string, string>>({});
  const [look, setLook] = useState('');
  const [msg, setMsg] = useState<Record<string, string>>({});
  const owner = (zip: string) => doc.draft.zones.find((z) => z.zips.includes(zip));
  const addZip = (zoneId: string, raw: string) => {
    const zip = raw.trim();
    if (!/^\d{5}$/.test(zip)) { setMsg({ ...msg, [zoneId]: 'A ZIP code has 5 digits.' }); return; }
    const o = owner(zip);
    if (o) { setMsg({ ...msg, [zoneId]: `${zip} is already in ${o.name}.` }); return; }
    doc.setDraft((d) => ({ ...d, zones: d.zones.map((z) => (z.id === zoneId ? { ...z, zips: [...z.zips, zip].sort() } : z)) }));
    setAdd({ ...add, [zoneId]: '' }); setMsg({ ...msg, [zoneId]: '' });
  };
  /** Removing a ZIP from a zone also takes it out of the masjid that served it. */
  const remove = (zoneId: string, zip: string) => doc.setDraft((d) => ({ ...d, zones: d.zones.map((z) => (z.id === zoneId ? { ...z, zips: z.zips.filter((x) => x !== zip) } : z)), centers: d.centers.map((c) => (c.zips.includes(zip) ? { ...c, zips: c.zips.filter((x) => x !== zip) } : c)) }));
  /** One ZIP → one masjid: moving it takes it out of the previous masjid. */
  const serve = (zip: string, centerId: string) => doc.setDraft((d) => ({ ...d, centers: d.centers.map((c) => {
    const rest = c.zips.filter((x) => x !== zip);
    return c.id === centerId ? { ...c, zips: [...rest, zip].sort() } : rest.length !== c.zips.length ? { ...c, zips: rest } : c;
  }) }));
  const home = look.length === 5 ? homeForZip(doc.draft, look) : null;
  return (
    <div className="zn-zips">
      <Panel title="Find a ZIP code" intro="ZIP code → masjid → zone. This is how every member, applicant and Zakat case finds its home masjid.">
        <label className="sf-field zn-look"><span className="sr-only">ZIP code</span><input className="in" inputMode="numeric" maxLength={5} placeholder="77072" value={look} onChange={(e) => setLook(e.target.value.replace(/\D/g, ''))} /></label>
        {home && <p className="zn-look-out" role="status">{home.center ? <>Home masjid <b>{home.center.name}</b> · {home.zone?.name}{byZip.get(look) ? ` · ${n(byZip.get(look)!)} members live here` : ''}</> : home.why}</p>}
      </Panel>
      {loose.length > 0 && (
        <Panel title={`ZIP codes on member records without a zone (${loose.length})`} tone="warn" intro="Add each one to a zone so these members (and future applicants) land in the right place.">
          <ul className="zn-loose">{loose.map((zip) => (
            <li key={zip} data-zip={zip}><b>{zip}</b>
              <select className="in pill-select" aria-label={`Zone for ${zip}`} value="" onChange={(e) => e.target.value && addZip(e.target.value, zip)}><option value="">Add to zone…</option>{doc.draft.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
            </li>
          ))}</ul>
        </Panel>
      )}
      {doc.draft.zones.map((z) => {
        const masjids = centersIn(doc.draft, z.id);
        const open = unservedZips(doc.draft, z.id).length;
        return (
          <Panel key={z.id} title={`${z.name} · ${z.zips.length} ZIP code${z.zips.length === 1 ? '' : 's'}${open ? ` · ${open} without a masjid` : ''}`} tone={open ? 'warn' : undefined}>
            <div className="table-wrap"><table className="t-plain zn-ziptable" data-zone={z.id}>
              <thead><tr><th>ZIP</th><th>Home masjid</th><th className="num">Members</th><th><span className="sr-only">Remove</span></th></tr></thead>
              <tbody>{z.zips.map((zip) => { const c = centerForZip(doc.draft, zip); return (
                <tr key={zip} data-zip={zip} className={c ? '' : 'zn-unserved'}>
                  <td><b>{zip}</b></td>
                  <td><select className="in pill-select" aria-label={`Masjid for ${zip}`} value={c?.id ?? ''} onChange={(e) => e.target.value && serve(zip, e.target.value)}>
                    {!c && <option value="">No masjid – pick one</option>}
                    {masjids.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select></td>
                  <td className="num">{n(byZip.get(zip) ?? 0)}</td>
                  <td className="row-actions"><button type="button" className="icon-btn sm" aria-label={`Remove ${zip} from ${z.name}`} onClick={() => remove(z.id, zip)}>×</button></td>
                </tr>
              ); })}</tbody>
            </table></div>
            <form className="zn-addzip" onSubmit={(e) => { e.preventDefault(); addZip(z.id, add[z.id] ?? ''); }}>
              <input className="in" inputMode="numeric" maxLength={5} aria-label={`Add a ZIP code to ${z.name}`} placeholder="Add ZIP" value={add[z.id] ?? ''} onChange={(e) => setAdd({ ...add, [z.id]: e.target.value.replace(/\D/g, '') })} />
              <button type="submit" className="btn sm">Add</button>
              {msg[z.id] && <small className="sf-err" role="alert">{msg[z.id]}</small>}
            </form>
          </Panel>
        );
      })}
    </div>
  );
}

function uniqueId(base: string, taken: string[]) { let id = base, i = 2; while (taken.includes(id)) id = `${base}-${i++}`.slice(0, 40); return id; }
function formatPhone(v: string) { const d = v.replace(/\D/g, '').slice(0, 10); return d.length < 4 ? d : d.length < 7 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; }
function addDays(d: string, k: number) { const t = Date.parse(`${String(d ?? '').slice(0, 10)}T12:00:00Z`); if (Number.isNaN(t)) return String(d ?? ''); return new Date(t + k * 86_400_000).toISOString().slice(0, 10); }

/* ---------------- D14 – center choice and change rules ---------------- */
function RulesTab({ doc }: { doc: Doc }) {
  const r = doc.draft.rules ?? DEFAULT_CENTER_RULES;
  const set = (f: (x: CenterRules) => void) => doc.setDraft((d) => { const n = structuredClone(d); n.rules = n.rules ?? structuredClone(DEFAULT_CENTER_RULES); f(n.rules); return n; });
  const e = (k: string) => doc.issues[`rules.${k}`];
  return (
    <div className="cv">
      <Panel title="Which center a person belongs to" intro="From the review call: members belong to their zone and may pick any of its centers; near a border they may ask for the nearest center of the next zone. Another organization may keep it simpler – nearest center only, no border requests.">
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Inside their zone</span><select className="in" aria-label="Choice inside the zone" value={r.choiceInZone} onChange={(ev) => set((x) => { x.choiceInZone = ev.target.value as 'nearest'; })}><option value="any-in-zone">Any center of the zone (nearest suggested)</option><option value="nearest">The nearest center only</option></select></label>
          <label className="sf-field"><span className="sf-label">Near a zone border</span><select className="in" aria-label="Border choice" value={r.borderChoice} onChange={(ev) => set((x) => { x.borderChoice = ev.target.value as 'none'; })}><option value="nearest-next-zone">May ask for the nearest center of the next zone</option><option value="any-next-zone">May ask for any center of the next zone</option><option value="none">No border requests</option></select></label>
          {r.borderChoice !== 'none' && <label className="sf-field"><span className="sf-label">“Near” means within (miles)</span><input className="in in-num" type="number" min={0} max={100} step={0.5} aria-label="Border miles" value={r.borderMiles} onChange={(ev) => set((x) => { x.borderMiles = Math.max(0, Math.min(100, Number(ev.target.value || 0))); })} />{e('borderMiles') && <small className="sf-err">{e('borderMiles')}</small>}</label>}
        </div>
      </Panel>
      <Panel title="Changing center" intro="A change is an application the office or the Board decides – not a setting a member flips every year.">
        <div className="field-row three">
          <label className="sf-field"><span className="sf-label">Approved by</span><input className="in" aria-label="Approved by" value={r.approvedBy} onChange={(ev) => set((x) => { x.approvedBy = ev.target.value; })} /></label>
          <label className="sf-field"><span className="sf-label">Stays for (years, 0 = no lock)</span><input className="in in-num" type="number" min={0} max={20} aria-label="Lock years" value={r.lockYears} onChange={(ev) => set((x) => { x.lockYears = Math.max(0, Math.min(20, Number(ev.target.value || 0))); })} /></label>
          <label className="sf-field"><span className="sf-label">Requests taken until (MM-DD, blank = any time)</span><input className="in" aria-label="Request deadline" placeholder="03-31" value={r.requestDeadline} onChange={(ev) => set((x) => { x.requestDeadline = ev.target.value; })} />{e('requestDeadline') && <small className="sf-err">{e('requestDeadline')}</small>}</label>
        </div>
        <div className="pe-switches">
          <SwitchRow id="cr-proof" label="A change needs proof of address or ID" checked={r.needsProof} onChange={(v) => set((x) => { x.needsProof = v; })} />
          <SwitchRow id="cr-move" label="A new address lifts the lock" checked={r.unlockOnMove} onChange={(v) => set((x) => { x.unlockOnMove = v; })} />
        </div>
        <p className="muted small">How it reads: {centerRulesInWords(r)}</p>
      </Panel>
    </div>
  );
}
