'use client';
/**
 * M1 Import members from any spreadsheet: a CSV from Wild Apricot, Breeze, Planning Center, Excel or Google Sheets.
 * Three steps – the file → match the columns (a preset for the common sources, every column changeable by hand, a
 * sample value next to each) → check every row (errors, possible duplicates, ready rows) → import. Status words of
 * the old system (Active, Lapsed, Pending…) become ours; nobody is silently made active. Nothing is saved until the
 * person has seen the result. DEMO: saved in this browser.
 * Live: POST /admin/members/import/check (same planImport on the server) → POST /admin/members/import.
 */
import { useMemo, useState } from 'react';
import { addImportedMembers, fullName, nextImportId, PLANS, zoneForZip, ZONES, YEAR, type Member, type PlanId, ORG_TZ } from '@/lib/members/members';
import { fieldsFor, matchColumns, parseCsv, planImport, toCsv, IMPORT_COLUMNS, IMPORT_PRESETS, type ImportRow } from '@/lib/community/member-records';
import type { OrgConfig } from '@/lib/community/org-config';

const chicagoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
const SAMPLE = ['Amina', 'Yusuf', 'amina.yusuf@example.com', '(713) 555-0101', '04/12/1988', '1234 Bellaire Blvd', 'Houston', '77036', 'Single', 'WA-10234', 'Active', '03/01/2019', '12/31/2026', 'No', 'Yes', 'Yes', 'No', ''];

export function MemberImport({ members, cfg, onClose, onDone }: { members: Member[]; cfg: OrgConfig; onClose: () => void; onDone: (n: number) => void }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [stage, setStage] = useState<'file' | 'map' | 'check'>('file');
  const [preset, setPreset] = useState('generic');
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [withDups, setWithDups] = useState(false);
  const [plan, setPlan] = useState<PlanId>('single');
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const plans = (Object.keys(PLANS) as PlanId[]).map((id) => ({ id, name: PLANS[id].name }));
  const extra = fieldsFor(cfg.members.fields, 'admin').filter((f) => f.type !== 'file');
  const table = useMemo(() => (stage === 'file' ? [] : parseCsv(text)), [text, stage]);
  const head = table[0] ?? []; const sample = table[1] ?? [];
  const auto = useMemo(() => matchColumns(head, { fields: cfg.members.fields, preset }), [head, cfg.members.fields, preset]);
  const effective = auto.map((c) => ({ header: c.header, key: c.header in mapping ? mapping[c.header] : c.key }));
  const result = useMemo(() => (stage === 'check' ? planImport(text, { fields: cfg.members.fields, plans, existing: members.filter((m) => !m.archived), today: chicagoToday(), preset, mapping }) : null), [stage, text, cfg, members, preset, mapping]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = result ? result.rows.filter((r) => r.status === 'ok' || (withDups && r.status === 'duplicate')) : [];
  const n = (s: ImportRow['status']) => result?.rows.filter((r) => r.status === s).length ?? 0;
  const missing = IMPORT_COLUMNS.filter((c) => c.required && !effective.some((x) => x.key === c.key)).map((c) => c.label);
  const twice = IMPORT_COLUMNS.filter((c) => effective.filter((x) => x.key === c.key).length > 1).map((c) => c.label);

  const template = () => {
    const csv = toCsv([...IMPORT_COLUMNS.map((c) => c.label), ...extra.map((f) => f.label)], [[...SAMPLE.slice(0, IMPORT_COLUMNS.length), ...extra.map(() => '')]]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'member-import-template.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  const doImport = () => {
    const today = chicagoToday();
    const list: Member[] = ready.map((r, i) => {
      const x = r.record!; const zone = zoneForZip(x.zip);
      const planId = (x.plan as PlanId) || plan;
      const status = x.archived === 'yes' ? 'archived' : x.status || 'pending';
      const since = x.memberSince || today;
      const joined = Number(since.slice(0, 4));
      const paidFor = status === 'active' && (!x.renewalDue || x.renewalDue >= today) ? YEAR : null;
      const notes = [x.externalId ? `ID in the old system: ${x.externalId}` : '', x.notes, x.recurring === 'yes' ? 'Recurring payment in the old system.' : '', x.renewalDue ? `Renewal was due ${x.renewalDue.slice(5, 7)}/${x.renewalDue.slice(8)}/${x.renewalDue.slice(0, 4)} in the old system.` : ''].filter(Boolean);
      return {
        id: nextImportId(members, i), first: x.first, last: x.last, email: x.email, phone: x.phone, dob: x.dob || '1900-01-01',
        street: x.street, city: x.city, zip: x.zip, zone: zone ?? 'sw', center: zone ? `${ZONES[zone]} Islamic Center 1` : '',
        plan: planId, joined, appliedOn: since, approvedOn: status === 'pending' ? null : since, idCheck: 'not_started', standing: 'good',
        payments: paidFor ? [{ year: paidFor, paidOn: since > today ? today : since, amountCents: PLANS[planId].cents, method: 'check' as const, payer: 'self' as const, ref: `IMPORT-${x.externalId || r.line}` }] : [],
        notes: notes.map((t, k) => ({ at: new Date(Date.now() + k).toISOString(), by: 'Import', text: t })), commitment: 'programs', extra: x.values, source: 'import',
        prefs: x.smsConsent || x.emailOptIn ? { email: x.emailOptIn !== 'no', sms: x.smsConsent === 'yes', optOut: [] } : undefined,
        archived: status === 'archived' ? { on: today, reason: 'Archived in the old system', by: 'Import' } : undefined,
        audit: [{ at: new Date().toISOString(), by: 'Mohammad (demo)', action: 'Imported', detail: `From ${fileName || 'pasted text'}, row ${r.line}${x.status ? ` – ${x.status} in the old system` : ''}${r.duplicates.length ? ` – imported although it looks like ${r.duplicates.map((d) => d.id).join(', ')}` : ''}` }],
      };
    });
    addImportedMembers(list);
    onDone(list.length);
  };
  const stats = { statuses: n('ok') + n('duplicate') ? result!.rows.filter((r) => r.record).reduce<Record<string, number>>((a, r) => { const s = r.record!.archived === 'yes' ? 'archived' : r.record!.status || 'pending'; a[s] = (a[s] ?? 0) + 1; return a; }, {}) : {} };

  return (
    <dialog ref={open} className="modal glass-float m-import" aria-label="Import members" onClose={onClose} onCancel={onClose}>
      <div className="m-form">
        <h2>Import members</h2>
        <ol className="imp-steps" aria-label="Import steps">{(['file', 'map', 'check'] as const).map((s, i) => <li key={s} aria-current={stage === s ? 'step' : undefined} className={stage === s ? 'on' : ''}>{i + 1}. {s === 'file' ? 'The file' : s === 'map' ? 'Match the columns' : 'Check and import'}</li>)}</ol>
        {stage === 'file' && (<>
          <p>Upload a CSV from Wild Apricot, Breeze, Planning Center, Excel or Google Sheets. Needed: First name, Last name, Email. Also read: Phone, Date of birth, Street, City, ZIP, Plan, ID in the old system, Membership status, Member since, Renewal due, Recurring, Text/SMS consent, Subscribed to emails, Archived, Notes, and any extra profile field by its name. You match the columns next; nothing is saved until you check the result.</p>
          <div className="row-actions"><button type="button" className="btn sm" onClick={template}>Download a template</button></div>
          <label className="sf-field"><span className="sf-label">CSV file</span>
            <input className="in" type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2_000_000) { setFileName(''); setText(''); return; } setFileName(f.name); setText(await f.text()); }} /></label>
          <label className="sf-field"><span className="sf-label">…or paste the rows here</span><textarea className="in in-area mono" rows={6} value={text} onChange={(e) => { setText(e.target.value); setFileName(''); }} placeholder={'First name,Last name,Email\nAmina,Yusuf,amina.yusuf@example.com'} /></label>
          <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={!text.trim()} onClick={() => { setMapping({}); setStage('map'); }}>Next: match the columns</button></div>
        </>)}
        {stage === 'map' && (<>
          <label className="sf-field narrow"><span className="sf-label">Where the file comes from</span><select className="in" aria-label="Import preset" value={preset} onChange={(e) => { setPreset(e.target.value); setMapping({}); }}>{IMPORT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <p className="muted small">{IMPORT_PRESETS.find((p) => p.id === preset)?.blurb} Change any match below; “Ignore” leaves a column out.</p>
          <div className="m-scroll imp-table"><table className="m-grid compact imp-map">
            <thead><tr><th scope="col">Column in the file</th><th scope="col">First row</th><th scope="col">Becomes</th></tr></thead>
            <tbody>{effective.map((c, j) => (
              <tr key={j} data-col={c.header} className={!c.key ? 'imp-ignored' : ''}>
                <td><b>{c.header || `Column ${j + 1}`}</b></td><td className="imp-sample">{sample[j] ?? ''}</td>
                <td><select className="in" aria-label={`Match for ${c.header || `column ${j + 1}`}`} value={c.key ?? ''} onChange={(e) => setMapping({ ...mapping, [c.header]: e.target.value || null })}>
                  <option value="">Ignore</option>
                  <optgroup label="Member record">{IMPORT_COLUMNS.map((k) => <option key={k.key} value={k.key}>{k.label}{k.required ? ' *' : ''}</option>)}</optgroup>
                  {extra.length > 0 && <optgroup label="Extra profile fields">{extra.map((f) => <option key={f.id} value={`field:${f.id}`}>{f.label}</option>)}</optgroup>}
                </select></td>
              </tr>
            ))}</tbody>
          </table></div>
          {missing.length > 0 && <p className="notice warn-note" role="alert">Still needed: {missing.join(', ')}. Match {missing.length > 1 ? 'them' : 'it'} to a column above.</p>}
          {twice.length > 0 && <p className="notice warn-note" role="alert">Matched twice: {twice.join(', ')}. Each can come from one column only.</p>}
          <p className="muted small">{effective.filter((c) => c.key).length} of {effective.length} columns will be read{Object.keys(mapping).length ? ` (${Object.keys(mapping).length} matched by hand)` : ''}.</p>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setStage('file')}>Back</button><button type="button" className="btn primary" disabled={missing.length > 0 || twice.length > 0} onClick={() => setStage('check')}>Check the file</button></div>
        </>)}
        {stage === 'check' && result && (<>
          <div className="imp-sum" role="status">
            <span className="imp-ok"><b>{n('ok')}</b> ready</span><span className="imp-dup"><b>{n('duplicate')}</b> possible duplicate{n('duplicate') === 1 ? '' : 's'}</span><span className="imp-err"><b>{n('error')}</b> with errors</span>
            {Object.keys(stats.statuses).length > 0 && <span className="muted">{Object.entries(stats.statuses).map(([k, v]) => `${v} ${k}`).join(' · ')}</span>}
          </div>
          {result.tooMany && <p className="notice warn-note">Only the first 2,000 rows were checked. Split the file.</p>}
          {effective.some((c) => !c.key) && <p className="muted small">Ignored columns: {effective.filter((c) => !c.key).map((c) => c.header).join(', ')}</p>}
          <div className="m-scroll imp-table"><table className="m-grid compact">
            <thead><tr><th scope="col">Row</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Result</th></tr></thead>
            <tbody>{result.rows.filter((r) => r.status !== 'ok').concat(result.rows.filter((r) => r.status === 'ok')).slice(0, 100).map((r) => (
              <tr key={r.line} className={`imp-${r.status}`} data-line={r.line}><td className="num">{r.line}</td><td>{r.record ? `${r.record.first} ${r.record.last}` : '—'}</td><td>{r.record?.email ?? ''}</td><td>{r.record ? (r.record.archived === 'yes' ? 'archived' : r.record.status || 'pending') : ''}</td>
                <td>{r.status === 'ok' ? 'Ready' : r.status === 'error' ? r.errors.join(' ') : `Looks like ${r.duplicates.map((d) => { const o = members.find((m) => m.id === d.id); return `${o ? `${fullName(o)} (${d.id})` : `row ${d.id}`}: ${d.reasons.join(', ')}`; }).join('; ')}`}</td></tr>
            ))}</tbody>
          </table></div>
          <p className="muted small">Active rows become approved members with this year’s dues recorded as paid (unless their renewal was already due); Lapsed rows become members who have not renewed; Pending rows wait for approval; Archived rows are kept out of the lists. The old system’s ID, renewal date and recurring flag go into the notes.</p>
          {n('duplicate') > 0 && <label className="check"><input type="checkbox" checked={withDups} onChange={(e) => setWithDups(e.target.checked)} /> <span>Import the possible duplicates too (I checked them)</span></label>}
          <label className="sf-field narrow"><span className="sf-label">Plan for rows without a plan</span><select className="in" value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setStage('map')}>Back</button>
            <button type="button" className="btn primary" disabled={!ready.length} onClick={doImport}>Import {ready.length.toLocaleString('en-US')} member{ready.length === 1 ? '' : 's'}</button></div>
        </>)}
      </div>
    </dialog>
  );
}
