'use client';
/**
 * Import members from a CSV (WildApricot: Contacts › Import). Every row is checked first – nothing is saved until the
 * person sees the result: ready rows, possible duplicates (held back unless they choose otherwise) and rows with errors.
 * Imported people start as "Pending approval" (the Board still approves). DEMO: saved in this browser.
 * Live: POST /admin/members/import/check (same planImport on the server) → POST /admin/members/import.
 */
import { useMemo, useState } from 'react';
import { addImportedMembers, fullName, nextImportId, PLANS, zoneForZip, ZONES, type Member, type PlanId } from '@/lib/members/members';
import { fieldsFor, planImport, toCsv, IMPORT_COLUMNS, type ImportRow } from '@/lib/community/member-records';
import type { OrgConfig } from '@/lib/community/org-config';

const chicagoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

export function MemberImport({ members, cfg, onClose, onDone }: { members: Member[]; cfg: OrgConfig; onClose: () => void; onDone: (n: number) => void }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [checked, setChecked] = useState('');
  const [withDups, setWithDups] = useState(false);
  const [plan, setPlan] = useState<PlanId>('single');
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const plans = (Object.keys(PLANS) as PlanId[]).map((id) => ({ id, name: PLANS[id].name }));
  const result = useMemo(() => (checked ? planImport(checked, { fields: cfg.members.fields, plans, existing: members.filter((m) => !m.archived), today: chicagoToday() }) : null), [checked, cfg, members]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = result ? result.rows.filter((r) => r.status === 'ok' || (withDups && r.status === 'duplicate')) : [];
  const n = (s: ImportRow['status']) => result?.rows.filter((r) => r.status === s).length ?? 0;

  const template = () => {
    const extra = fieldsFor(cfg.members.fields, 'admin').filter((f) => f.type !== 'file');
    const csv = toCsv([...IMPORT_COLUMNS.map((c) => c.label), ...extra.map((f) => f.label)], [['Amina', 'Yusuf', 'amina.yusuf@example.com', '(713) 555-0101', '04/12/1988', '1234 Bellaire Blvd', 'Houston', '77036', 'Single', ...extra.map(() => '')]]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'member-import-template.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  const doImport = () => {
    const today = chicagoToday();
    const list: Member[] = ready.map((r, i) => {
      const x = r.record!; const zone = zoneForZip(x.zip);
      return {
        id: nextImportId(members, i), first: x.first, last: x.last, email: x.email, phone: x.phone, dob: x.dob || '1900-01-01',
        street: x.street, city: x.city, zip: x.zip, zone: zone ?? 'sw', center: zone ? `${ZONES[zone]} Islamic Center 1` : '',
        plan: (x.plan as PlanId) || plan, joined: Number(today.slice(0, 4)), appliedOn: today, approvedOn: null, idCheck: 'not_started', standing: 'good',
        payments: [], notes: [], commitment: 'programs', extra: x.values, source: 'import',
        audit: [{ at: new Date().toISOString(), by: 'Mohammad (demo)', action: 'Imported', detail: `From ${fileName || 'pasted text'}, row ${r.line}${r.duplicates.length ? ` – imported although it looks like ${r.duplicates.map((d) => d.id).join(', ')}` : ''}` }],
      };
    });
    addImportedMembers(list);
    onDone(list.length);
  };

  return (
    <dialog ref={open} className="modal glass-float m-import" aria-label="Import members" onClose={onClose} onCancel={onClose}>
      <div className="m-form">
        <h2>Import members</h2>
        {!result ? (<>
          <p>Upload a CSV from WildApricot, Excel or Google Sheets. Needed columns: First name, Last name, Email. Also read: Phone, Date of birth, Street, City, ZIP, Plan and any extra profile field by its name. Nothing is saved until you check the result.</p>
          <div className="row-actions"><button type="button" className="btn sm" onClick={template}>Download a template</button></div>
          <label className="sf-field"><span className="sf-label">CSV file</span>
            <input className="in" type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2_000_000) { setFileName(''); setText(''); return; } setFileName(f.name); setText(await f.text()); }} /></label>
          <label className="sf-field"><span className="sf-label">…or paste the rows here</span><textarea className="in in-area mono" rows={6} value={text} onChange={(e) => { setText(e.target.value); setFileName(''); }} placeholder={'First name,Last name,Email\nAmina,Yusuf,amina.yusuf@example.com'} /></label>
          <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={!text.trim()} onClick={() => setChecked(text)}>Check the file</button></div>
        </>) : (<>
          {result.missing.length > 0 ? <p className="notice warn-note" role="alert">Missing column{result.missing.length > 1 ? 's' : ''}: {result.missing.join(', ')}. Add {result.missing.length > 1 ? 'them' : 'it'} to the first row and check again.</p> : (<>
            <div className="imp-sum" role="status">
              <span className="imp-ok"><b>{n('ok')}</b> ready</span><span className="imp-dup"><b>{n('duplicate')}</b> possible duplicate{n('duplicate') === 1 ? '' : 's'}</span><span className="imp-err"><b>{n('error')}</b> with errors</span>
            </div>
            {result.tooMany && <p className="notice warn-note">Only the first 2,000 rows were checked. Split the file.</p>}
            {result.columns.some((c) => !c.key) && <p className="muted">Ignored columns: {result.columns.filter((c) => !c.key).map((c) => c.header).join(', ')}</p>}
            <div className="m-scroll imp-table"><table className="m-grid compact">
              <thead><tr><th scope="col">Row</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Result</th></tr></thead>
              <tbody>{result.rows.filter((r) => r.status !== 'ok').concat(result.rows.filter((r) => r.status === 'ok')).slice(0, 100).map((r) => (
                <tr key={r.line} className={`imp-${r.status}`} data-line={r.line}><td className="num">{r.line}</td><td>{r.record ? `${r.record.first} ${r.record.last}` : '—'}</td><td>{r.record?.email ?? ''}</td>
                  <td>{r.status === 'ok' ? 'Ready' : r.status === 'error' ? r.errors.join(' ') : `Looks like ${r.duplicates.map((d) => { const o = members.find((m) => m.id === d.id); return `${o ? `${fullName(o)} (${d.id})` : `row ${d.id}`}: ${d.reasons.join(', ')}`; }).join('; ')}`}</td></tr>
              ))}</tbody>
            </table></div>
            {n('duplicate') > 0 && <label className="check"><input type="checkbox" checked={withDups} onChange={(e) => setWithDups(e.target.checked)} /> <span>Import the possible duplicates too (I checked them)</span></label>}
            <label className="sf-field narrow"><span className="sf-label">Plan for rows without a plan</span><select className="in" value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          </>)}
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setChecked('')}>Back</button>
            <button type="button" className="btn primary" disabled={!ready.length || result.missing.length > 0} onClick={doImport}>Import {ready.length.toLocaleString('en-US')} member{ready.length === 1 ? '' : 's'}</button></div>
        </>)}
      </div>
    </dialog>
  );
}
