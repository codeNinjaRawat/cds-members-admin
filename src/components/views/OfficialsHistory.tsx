'use client';
/**
 * E1 Elected officials › History – who held each position in each year. Filled by uploading a spreadsheet (one row per
 * year × position × person; a template is offered), by adding one past term by hand, or when a term ends on the
 * other tabs. Two views: by year ("Term 2024 – 2026") and by position ("President: 2026 …, 2024 …"). Past terms are
 * read-only history; they feed the website's past-leadership list and the Board term-limit count.
 * Positions and term length come from the organization's own configuration, so a client with one-year terms or other
 * titles uploads the same file: titles the Bylaws do not know are kept as written ("other").
 * DEMO (no API). Live: the `history` part of GET/PUT /admin/officials; POST /admin/officials/history/check.
 */
import { useMemo, useState } from 'react';
import { Panel } from '@/components/editor/bits';
import { useAccess } from '@/lib/access/use-access';
import { parseCsv, toCsv } from '@/lib/community/member-records';
import {
  END_REASONS, HISTORY_COLUMNS, HISTORY_TEMPLATE_ROWS, HOW, KINDS, OFFICERS, SECRETARIES, boardTermsServed, fmt, historyByPosition, historyByYear, historyRows,
  oathDay, planHistoryImport, readDate, seatLabel, seatLabelOfTerm, termLabel, type Holder, type Officials, type Term,
} from '@/lib/community/officials';
import type { OrgStructure } from '@/lib/community/org-structure';

type Props = { d: Officials; set: (f: (x: Officials) => void) => void; map: OrgStructure; memberIds: Set<string>; zoneName: (id: string) => string; today: string };
const download = (name: string, csv: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };

export function History({ d, set, map, memberIds, zoneName, today }: Props) {
  const access = useAccess();
  const canEdit = access.can('officials.manage');
  const [view, setView] = useState<'year' | 'position'>('year');
  const [upload, setUpload] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const hit = (t: Term) => !q || `${t.name} ${t.title} ${seatLabelOfTerm(t, zoneName)} ${t.year} ${t.center}`.toLowerCase().includes(q.toLowerCase());
  const history = d.history.filter(hit);
  const years = historyByYear(history);
  const positions = historyByPosition(history, view === 'position' ? d.holders.filter((h) => !q || `${h.name} ${seatLabel(h, zoneName)}`.toLowerCase().includes(q.toLowerCase())) : [], zoneName);
  const people = new Set(d.history.map((t) => t.memberId || t.name.toLowerCase())).size;
  const remove = (id: string) => set((x) => { x.history = x.history.filter((t) => t.id !== id); });
  const label = (t: Term) => seatLabelOfTerm(t, zoneName);
  return (
    <div className="of-hist">
      <div className="bn-bar of-hist-bar">
        <div className="seg" role="radiogroup" aria-label="View">
          <button type="button" role="radio" aria-checked={view === 'year'} onClick={() => setView('year')}>By year</button>
          <button type="button" role="radio" aria-checked={view === 'position'} onClick={() => setView('position')}>By position</button>
        </div>
        <input className="in" type="search" aria-label="Search the history" placeholder="Name, position, year…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small of-hist-count">{d.history.length.toLocaleString('en-US')} term{d.history.length === 1 ? '' : 's'} · {people.toLocaleString('en-US')} people · {years.length ? `${Math.min(...d.history.map((t) => t.year))} – ${Math.max(...d.history.map((t) => t.year))}` : 'nothing yet'}</span>
        <div className="row-actions">
          <button type="button" className="btn sm ghost" onClick={() => download('elected-officials-history.csv', toCsv(HISTORY_COLUMNS.map((c) => c.label), historyRows(d.history, zoneName)))} disabled={!d.history.length}>Export</button>
          {canEdit && <button type="button" className="btn sm" onClick={() => setAdding(true)}>Add a past term</button>}
          {canEdit && <button type="button" className="btn sm primary" onClick={() => setUpload(true)}>Upload elected members</button>}
        </div>
      </div>
      {!d.history.length && <p className="notice">No history yet. Upload a spreadsheet with one row per year, position and person – or add past terms one at a time. The current holders on the other tabs stay as they are.</p>}
      {view === 'year' ? years.map((g) => (
        <section key={g.year} className="glass-pane zk-list of-hist-year" aria-label={`Election ${g.year}`} data-year={g.year}>
          <h2>Election {g.year} <span className="pill">{g.terms.length}</span> <small className="muted">terms {termLabel(g.terms[0])}</small></h2>
          <div className="table-wrap"><table className="t-plain zk-table of-hist-table">
            <thead><tr><th>Position</th><th>Name</th><th>How</th><th>Term</th><th>Ended</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{g.terms.map((t) => <Row key={t.id} t={t} label={label(t)} canEdit={canEdit} open={open === t.id} onOpen={() => setOpen(open === t.id ? null : t.id)} onRemove={() => remove(t.id)} onToggleWeb={(v) => set((x) => { const k = x.history.findIndex((y) => y.id === t.id); if (k >= 0) x.history[k].showOnWebsite = v; })} />)}</tbody>
          </table></div>
        </section>
      )) : positions.map((g) => (
        <section key={g.seat} className="glass-pane zk-list of-hist-pos" aria-label={g.seat} data-seat={g.seat}>
          <h2>{g.seat} <span className="pill">{g.terms.length}</span></h2>
          <ol className="of-timeline">{g.terms.map((t) => (
            <li key={t.id} className={t.source === 'archived' && t.id.startsWith('now-') ? 'now' : ''} data-term={t.id}>
              <span className="of-tl-year">{t.year}</span>
              <span className="of-tl-who"><b>{t.name}</b><small>{t.id.startsWith('now-') ? 'Serving now · ' : ''}{HOW[t.how]} · {t.termStart || t.termEnd ? `${fmt(t.termStart)} – ${fmt(t.termEnd) || 'open'}` : termLabel(t)}{t.endReason && t.endReason !== 'completed' ? ` · ${END_REASONS[t.endReason]}` : ''}{g.kind === 'area-rep' && (t.zips.length || t.atLarge) ? ` · ${t.atLarge ? label(t).split(' – ')[1] : `ZIP ${t.zips.join(', ')}`}` : ''}</small></span>
            </li>
          ))}</ol>
        </section>
      ))}
      {view === 'year' && !years.length && d.history.length > 0 && <p className="muted">Nothing matches “{q}”.</p>}
      {upload && <UploadDialog d={d} set={set} map={map} memberIds={memberIds} zoneName={zoneName} onClose={() => setUpload(false)} />}
      {adding && <AddTerm d={d} set={set} map={map} today={today} onClose={() => setAdding(false)} />}
    </div>
  );
}

function Row({ t, label, canEdit, open, onOpen, onRemove, onToggleWeb }: { t: Term; label: string; canEdit: boolean; open: boolean; onOpen: () => void; onRemove: () => void; onToggleWeb: (v: boolean) => void }) {
  return (<>
    <tr data-term={t.id} className={open ? 'open' : ''}>
      <td>{label}{t.kind === 'other' && <small className="block muted">Position as uploaded</small>}</td>
      <td><button type="button" className="zk-name linkish" onClick={onOpen}>{t.name}</button>{t.memberId && <small className="block muted">{t.memberId}</small>}</td>
      <td>{HOW[t.how]}</td>
      <td>{t.termStart || t.termEnd ? `${fmt(t.termStart)} – ${fmt(t.termEnd) || 'open'}` : '—'}</td>
      <td>{t.endReason ? END_REASONS[t.endReason] : <span className="muted">—</span>}</td>
      <td className="num">{canEdit && <button type="button" className="icon-btn" aria-label={`Remove ${t.name}, ${label}, ${t.year}`} onClick={onRemove}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /></svg></button>}</td>
    </tr>
    {open && <tr className="of-hist-more"><td colSpan={6}>
      <div className="of-hist-detail">
        <span><small>Source</small>{t.source === 'upload' ? 'Uploaded' : t.source === 'manual' ? 'Added by hand' : 'From the officials list'}</span>
        {t.zone && <span><small>Zone</small>{t.zone}</span>}{t.center && <span><small>Islamic Center</small>{t.center}</span>}
        {t.zips.length > 0 && <span><small>ZIP codes</small>{t.zips.join(', ')}</span>}
        {t.notes && <span><small>Notes</small>{t.notes}</span>}
        <label className="check"><input type="checkbox" checked={t.showOnWebsite} disabled={!canEdit} onChange={(e) => onToggleWeb(e.target.checked)} /> <span>May be listed under past leadership on the website</span></label>
      </div>
    </td></tr>}
  </>);
}

/* ---------------- upload ---------------- */
function UploadDialog({ d, set, map, memberIds, zoneName, onClose }: { d: Officials; set: Props['set']; map: OrgStructure; memberIds: Set<string>; zoneName: (id: string) => string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [checked, setChecked] = useState('');
  const [withDups, setWithDups] = useState(false);
  const [checkIds, setCheckIds] = useState(false);
  const openDlg = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const result = useMemo(() => (checked ? planHistoryImport(checked, { map, existing: d.history, memberIds: checkIds ? memberIds : undefined }, parseCsv) : null), [checked, map, d.history, memberIds, checkIds]);
  const ready = result ? result.rows.filter((r) => r.status === 'ok' || (withDups && r.status === 'duplicate')) : [];
  const n = (s: 'ok' | 'error' | 'duplicate') => result?.rows.filter((r) => r.status === s).length ?? 0;
  const years = Array.from(new Set(ready.map((r) => r.record!.year))).sort();
  const doImport = () => {
    const used = new Set(d.history.map((t) => t.id));
    const list = ready.map((r) => { let t = r.record!; let id = t.id; let k = 1; while (used.has(id)) id = `${t.id}-${k++}`; used.add(id); t = { ...t, id }; return t; });
    set((x) => { x.history = [...x.history, ...list]; });
    onClose();
  };
  return (
    <dialog ref={openDlg} className="modal glass-float m-import" aria-label="Upload elected members" onClose={onClose} onCancel={onClose}>
      <div className="m-form">
        <h2>Upload elected members</h2>
        {!result ? (<>
          <p>One row per year, position and person. Needed columns: <b>Year</b> (the election year), <b>Position</b>, <b>Name</b>. Also read: Zone, Islamic Center, ZIP codes, Member ID, How (elected / appointed), Term starts, Term ends, End reason, Notes. Term dates left empty are filled in from the election year and the term rules. Nothing is saved until you check the result.</p>
          <p className="muted small">Positions: {Object.values(OFFICERS).join(', ')}, Zonal Director (+ zone), Associate Director (+ center), Area Representative (+ center, ZIP codes), {Object.values(SECRETARIES).join(', ')} (+ center). Any other title is kept as written.</p>
          <div className="row-actions"><button type="button" className="btn sm" onClick={() => download('elected-members-template.csv', toCsv(HISTORY_COLUMNS.map((c) => c.label), HISTORY_TEMPLATE_ROWS))}>Download a template</button></div>
          <label className="sf-field"><span className="sf-label">CSV file</span>
            <input className="in" type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2_000_000) { setFileName(''); setText(''); return; } setFileName(f.name); setText(await f.text()); }} /></label>
          <label className="sf-field"><span className="sf-label">…or paste the rows here</span><textarea className="in in-area mono" rows={6} value={text} onChange={(e) => { setText(e.target.value); setFileName(''); }} placeholder={'Year,Position,Name,Zone,Islamic Center\n2022,President,Example Name,,'} /></label>
          <label className="check"><input type="checkbox" checked={checkIds} onChange={(e) => setCheckIds(e.target.checked)} /> <span>Member IDs must exist in the member records</span></label>
          <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={!text.trim()} onClick={() => setChecked(text)}>Check the file</button></div>
        </>) : (<>
          {result.missing.length > 0 ? <p className="notice warn-note" role="alert">Missing column{result.missing.length > 1 ? 's' : ''}: {result.missing.join(', ')}. Add {result.missing.length > 1 ? 'them' : 'it'} to the first row and check again.</p> : (<>
            <div className="imp-sum" role="status">
              <span className="imp-ok"><b>{n('ok')}</b> ready</span><span className="imp-dup"><b>{n('duplicate')}</b> already filled</span><span className="imp-err"><b>{n('error')}</b> with errors</span>
              {years.length > 0 && <span className="muted">{fileName || 'Pasted rows'} · {years[0] === years[years.length - 1] ? years[0] : `${years[0]} – ${years[years.length - 1]}`}</span>}
            </div>
            {result.tooMany && <p className="notice warn-note">Only the first 2,000 rows were checked. Split the file.</p>}
            {result.columns.some((c) => !c.key) && <p className="muted small">Ignored columns: {result.columns.filter((c) => !c.key).map((c) => c.header).join(', ')}</p>}
            <div className="m-scroll imp-table"><table className="m-grid compact">
              <thead><tr><th scope="col">Row</th><th scope="col">Year</th><th scope="col">Position</th><th scope="col">Name</th><th scope="col">Result</th></tr></thead>
              <tbody>{result.rows.filter((r) => r.status !== 'ok').concat(result.rows.filter((r) => r.status === 'ok')).slice(0, 100).map((r) => (
                <tr key={r.line} className={`imp-${r.status}`} data-line={r.line}><td className="num">{r.line}</td><td>{r.record?.year ?? ''}</td><td>{r.record ? seatLabelOfTerm(r.record, zoneName) : '—'}</td><td>{r.record?.name ?? ''}</td>
                  <td>{r.status === 'ok' ? 'Ready' : r.errors.join(' ')}</td></tr>
              ))}</tbody>
            </table></div>
            {n('duplicate') > 0 && <label className="check"><input type="checkbox" checked={withDups} onChange={(e) => setWithDups(e.target.checked)} /> <span>Add the “already filled” rows too (two people held the seat that year, or I checked them)</span></label>}
          </>)}
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setChecked('')}>Back</button>
            <button type="button" className="btn primary" disabled={!ready.length || result.missing.length > 0} onClick={doImport}>Add {ready.length.toLocaleString('en-US')} term{ready.length === 1 ? '' : 's'}</button></div>
        </>)}
      </div>
    </dialog>
  );
}

/* ---------------- one past term by hand ---------------- */
function AddTerm({ d, set, map, today, onClose }: { d: Officials; set: Props['set']; map: OrgStructure; today: string; onClose: () => void }) {
  const openDlg = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const [f, setF] = useState({ year: String(Number(today.slice(0, 4)) - 2), kind: 'officer' as Term['kind'], office: 'president', zone: map.zones[0]?.id ?? '', center: map.centers[0]?.name ?? '', title: '', name: '', memberId: '', how: 'elected' as Term['how'], termStart: '', termEnd: '', endReason: 'completed' as Term['endReason'], notes: '' });
  const up = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const year = Number(f.year);
  const errs: string[] = [];
  if (!Number.isInteger(year) || year < 1900 || year > 2200) errs.push('Enter the election year.');
  if (f.name.trim().length < 2) errs.push('Enter the name.');
  if (f.kind === 'other' && !f.title.trim()) errs.push('Enter the position.');
  if (f.memberId && !/^HOU-\d{6}$/.test(f.memberId)) errs.push('Member IDs look like HOU-204781.');
  const ts = readDate(f.termStart) ?? null; const te = readDate(f.termEnd) ?? null;
  if (ts && te && te <= ts) errs.push('The term must end after it starts.');
  const needsCenter = ['associate-director', 'area-rep', 'secretary'].includes(f.kind);
  const add = () => {
    const t: Term = {
      id: `m-${year}-${f.kind}-${Date.now().toString(36)}`, year, kind: f.kind, office: f.kind === 'officer' || f.kind === 'secretary' ? f.office : '', zone: f.kind === 'zonal-director' ? f.zone : '', center: needsCenter ? f.center : '', zips: [], atLarge: '',
      title: f.kind === 'other' ? f.title.trim() : '', name: f.name.trim(), memberId: f.memberId.toUpperCase(), how: f.how, termStart: ts || (f.kind === 'secretary' ? '' : oathDay(year)), termEnd: te || (f.kind === 'secretary' ? '' : oathDay(year + 2)), endReason: f.endReason, notes: f.notes.slice(0, 240), source: 'manual', showOnWebsite: true,
    };
    set((x) => { x.history.push(t); }); onClose();
  };
  const prior = f.name.trim().length > 1 ? boardTermsServed(d.history, { memberId: f.memberId.toUpperCase(), name: f.name }) : 0;
  return (
    <dialog ref={openDlg} className="modal glass-float" aria-label="Add a past term" onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={(e) => { e.preventDefault(); if (!errs.length) add(); }}>
        <h2>Add a past term</h2>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Election year</span><input className="in in-num" aria-label="Election year" inputMode="numeric" value={f.year} onChange={(e) => up({ year: e.target.value })} /></label>
          <label className="sf-field"><span className="sf-label">Position</span><select className="in" aria-label="Position kind" value={f.kind} onChange={(e) => { const kind = e.target.value as Term['kind']; up({ kind, office: kind === 'secretary' ? 'administrative' : kind === 'officer' ? 'president' : '' , how: kind === 'secretary' ? 'confirmed' : 'elected' }); }}>
            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="other">Another position (type it)</option></select></label>
        </div>
        {f.kind === 'officer' && <label className="sf-field"><span className="sf-label">Office</span><select className="in" aria-label="Office" value={f.office} onChange={(e) => up({ office: e.target.value })}>{Object.entries(OFFICERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
        {f.kind === 'secretary' && <label className="sf-field"><span className="sf-label">Secretary post</span><select className="in" aria-label="Secretary post" value={f.office} onChange={(e) => up({ office: e.target.value })}>{Object.entries(SECRETARIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
        {f.kind === 'zonal-director' && <label className="sf-field"><span className="sf-label">Zone</span><select className="in" aria-label="Zone" value={f.zone} onChange={(e) => up({ zone: e.target.value })}>{map.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>}
        {needsCenter && <label className="sf-field"><span className="sf-label">Islamic Center</span><select className="in" aria-label="Islamic Center" value={f.center} onChange={(e) => up({ center: e.target.value })}>{map.centers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></label>}
        {f.kind === 'other' && <label className="sf-field"><span className="sf-label">Position title</span><input className="in" aria-label="Position title" value={f.title} onChange={(e) => up({ title: e.target.value })} placeholder="Election Commissioner" /></label>}
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Name</span><input className="in" aria-label="Past holder name" value={f.name} onChange={(e) => up({ name: e.target.value })} /></label>
          <label className="sf-field"><span className="sf-label">Member ID (optional)</span><input className="in" aria-label="Past holder member ID" placeholder="HOU-204781" value={f.memberId} onChange={(e) => up({ memberId: e.target.value.trim().toUpperCase() })} /></label>
        </div>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">How</span><select className="in" aria-label="How they got the seat" value={f.how} onChange={(e) => up({ how: e.target.value as Term['how'] })}>{Object.entries(HOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">How it ended</span><select className="in" aria-label="How the term ended" value={f.endReason} onChange={(e) => up({ endReason: e.target.value as Term['endReason'] })}><option value="">Not recorded</option>{Object.entries(END_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Term starts</span><input className="in" aria-label="Past term starts" type="date" value={f.termStart} onChange={(e) => up({ termStart: e.target.value })} /><small className="sf-hint">Empty: {fmt(oathDay(Number.isInteger(year) ? year : 2000))} from the election year.</small></label>
          <label className="sf-field"><span className="sf-label">Term ends</span><input className="in" aria-label="Past term ends" type="date" value={f.termEnd} onChange={(e) => up({ termEnd: e.target.value })} /></label>
        </div>
        <label className="sf-field"><span className="sf-label">Notes</span><input className="in" aria-label="Notes" value={f.notes} onChange={(e) => up({ notes: e.target.value })} /></label>
        {prior > 0 && (f.kind === 'officer' || f.kind === 'zonal-director') && <p className="muted small">{f.name} already has {prior} Board term{prior === 1 ? '' : 's'} in the history.</p>}
        {errs.length > 0 && f.name && <ul className="notice warn-note of-mine">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary" disabled={errs.length > 0}>Add to the history</button></div>
      </form>
    </dialog>
  );
}

/** Exposed for the holder panel: a serving holder's earlier Board terms counted from the history. */
export const priorBoardTerms = (d: Officials, h: Holder) => boardTermsServed(d.history, { memberId: h.memberId, name: h.name }, h.termStart ? Number(h.termStart.slice(0, 4)) - 1 : 9999);
