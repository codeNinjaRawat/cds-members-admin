'use client';
/**
 * R1 Records library – minutes, reports, Bylaws, policies, newsletters and forms, for the whole organization or one
 * masjid, each with a date, a category and an audience (website / members / leaders). Follows the shared "Viewing"
 * masjid filter; a masjid role sees and edits its own masjid's records only. Publishes as the `records` document.
 * DEMO (no API). Live: GET/PUT /admin/records.
 */
import { ORG_TZ } from '@/lib/members/members';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, SwitchRow } from '@/components/editor/bits';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { useAccess } from '@/lib/access/use-access';
import { OrgStructureSchema, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { RECORD_AUDIENCE, RECORD_CATEGORIES, fmtDate, recordsByCenter, recordsWarnings, type RecordAudience, type RecordCategory, type RecordItem, type Records } from '@/lib/community/records';

type Doc = { draft: Records; setDraft: (f: Records | ((d: Records) => Records)) => void; issues: Record<string, string> };
const todayCT = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'record';

export function RecordsView() {
  return (
    <DocEditor<Records> storeKey="records" title="Records library" preview={false}
      intro="The documents members and leaders look for: meeting minutes, reports, the Constitution and Bylaws, policies, newsletters and forms – for the whole organization or one masjid. Each record says who may see it.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function Body({ doc }: { doc: Doc }) {
  const access = useAccess();
  const mf = useMasjidFilter();
  const [map, setMap] = useState<OrgStructure>(mockOrgStructure);
  useEffect(() => { void fetch('/api/store/org-structure', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = OrgStructureSchema.safeParse(j?.data); if (p.success) setMap(p.data); }).catch(() => {}); }, []);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'' | RecordCategory>('');
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState<{ index: number | null; r: RecordItem } | null>(null);
  const canEdit = access.can('center.content');
  const centers = map.centers.filter((c) => c.active && access.inScope(c.zone, c.name)).map((c) => c.name);
  const list = useMemo(() => doc.draft.items.filter((r) => (showArchived || !r.archived) && (!r.center || mf.keep(mf.zoneOf(r.center), r.center)) && (!mf.masjid || r.center === mf.masjid || (!r.center && mf.masjid !== '~none')) && (!cat || r.category === cat) && (!q || `${r.title} ${r.summary} ${r.center}`.toLowerCase().includes(q.toLowerCase()))), [doc.draft.items, showArchived, mf, cat, q]);
  const groups = recordsByCenter(list, map.centers.map((c) => c.name));
  const warns = recordsWarnings(doc.draft, centers, todayCT());
  const set = (f: (x: Records) => void) => doc.setDraft((d) => { const c = structuredClone(d); f(c); return c; });
  const blank = (): RecordItem => ({ id: '', title: '', category: 'minutes', center: mf.masjid && mf.masjid !== '~none' ? mf.masjid : mf.lockedMasjid || '', date: todayCT(), audience: 'members', url: '', summary: '', source: 'link', archived: false });
  return (
    <div className="rc">
      {warns.length > 0 && <details className="notice warn-note zn-warns" open={warns.length <= 4}><summary><b>{warns.length} thing{warns.length === 1 ? '' : 's'} to look at</b></summary><ul>{warns.map((w) => <li key={w}>{w}</li>)}</ul></details>}
      <div className="bn-bar rc-bar">
        <MasjidPicker className="chip-select" />
        <select className="in pill-select" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value as '' | RecordCategory)}><option value="">All categories</option>{Object.entries(RECORD_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className="in" type="search" aria-label="Search records" placeholder="Title, summary…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> <span>Show archived</span></label>
        <span className="muted small rc-count">{list.length} of {doc.draft.items.filter((r) => !r.archived).length}</span>
        {canEdit && <button type="button" className="btn primary sm" onClick={() => setEdit({ index: null, r: blank() })}>Add a record</button>}
      </div>
      {groups.map((g) => (
        <section key={g.center || 'org'} className="glass-pane zk-list rc-group" aria-label={g.label} data-center={g.center}>
          <h2>{g.label} <span className="pill">{g.items.length}</span></h2>
          <div className="table-wrap"><table className="t-plain zk-table rc-table">
            <thead><tr><th>Date</th><th>Record</th><th>Category</th><th>Who sees it</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{g.items.map((r) => { const i = doc.draft.items.findIndex((x) => x.id === r.id); const mine = r.center ? centers.includes(r.center) : !mf.lockedMasjid; return (
              <tr key={r.id} data-record={r.id} className={r.archived ? 'off' : ''}>
                <td className="rc-date">{fmtDate(r.date)}</td>
                <td><a href={r.url} target="_blank" rel="noreferrer" className="zk-name">{r.title}</a>{r.summary && <small className="block muted">{r.summary}</small>}{r.archived && <span className="pill">Archived</span>}</td>
                <td>{RECORD_CATEGORIES[r.category]}</td>
                <td><span className={`pill ${r.audience === 'public' ? 'good' : r.audience === 'leaders' ? 'warn' : ''}`}>{RECORD_AUDIENCE[r.audience].split(' (')[0]}</span></td>
                <td className="num"><span className="row-actions">{canEdit && mine && <button type="button" className="btn sm ghost" onClick={() => setEdit({ index: i, r: structuredClone(r) })}>Edit<span className="sr-only"> {r.title}</span></button>}
                  {canEdit && mine && <button type="button" className="btn sm ghost" onClick={() => set((x) => { x.items[i].archived = !x.items[i].archived; })}>{r.archived ? 'Restore' : 'Archive'}<span className="sr-only"> {r.title}</span></button>}</span></td>
              </tr>
            ); })}</tbody>
          </table></div>
        </section>
      ))}
      {!groups.length && <p className="notice">No records here yet{canEdit ? ' – add the first one.' : '.'}</p>}
      <Panel title="On the website">
        <SwitchRow id="rc-web" label="Show the Records page (public records only)" checked={doc.draft.website.enabled} onChange={(v) => set((x) => { x.website.enabled = v; })} />
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Page title</span><input className="in" aria-label="Records page title" value={doc.draft.website.title} onChange={(e) => set((x) => { x.website.title = e.target.value; })} /></label>
          <label className="sf-field"><span className="sf-label">Intro</span><input className="in" aria-label="Records page intro" value={doc.draft.website.intro} onChange={(e) => set((x) => { x.website.intro = e.target.value; })} /></label>
        </div>
      </Panel>
      {edit && <RecordDialog edit={edit} centers={centers} lockedCenter={mf.lockedMasjid} existing={doc.draft.items} onClose={() => setEdit(null)} onSave={(r) => { set((x) => { if (edit.index === null) x.items.push(r); else x.items[edit.index] = r; }); setEdit(null); }} />}
    </div>
  );
}

function RecordDialog({ edit, centers, lockedCenter, existing, onClose, onSave }: { edit: { index: number | null; r: RecordItem }; centers: string[]; lockedCenter: string; existing: RecordItem[]; onClose: () => void; onSave: (r: RecordItem) => void }) {
  const [r, setR] = useState<RecordItem>(edit.r);
  const up = (p: Partial<RecordItem>) => setR({ ...r, ...p });
  const errs: Record<string, string> = {};
  if (r.title.trim().length < 3) errs.title = 'Give the record a title.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errs.date = 'Enter the date.';
  if (!(/^https:\/\/\S+$/.test(r.url) || /^\/\S+$/.test(r.url))) errs.url = 'Use a full https address or a path on this site, like /files/minutes-2026-09.pdf.';
  if (lockedCenter && r.center !== lockedCenter) errs.center = `You can add records for ${lockedCenter} only.`;
  const openDlg = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const submit = (e: FormEvent) => {
    e.preventDefault(); if (Object.keys(errs).length) return;
    let id = r.id || `${slug(r.center) || 'org'}-${slug(r.title)}-${r.date.replace(/-/g, '')}`.slice(0, 60); let n = 2;
    while (existing.some((x, k) => x.id === id && k !== edit.index)) id = `${id.slice(0, 55)}-${n++}`;
    onSave({ ...r, id, title: r.title.trim(), url: r.url.trim(), source: r.url.startsWith('/') ? 'upload' : r.source === 'wildapricot' ? 'wildapricot' : 'link' });
  };
  return (
    <dialog ref={openDlg} className="modal glass-float" aria-label={edit.index === null ? 'Add a record' : 'Edit record'} onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={submit}>
        <h2>{edit.index === null ? 'Add a record' : 'Edit record'}</h2>
        <label className="sf-field"><span className="sf-label">Title</span><input className="in" aria-label="Record title" value={r.title} onChange={(e) => up({ title: e.target.value })} />{errs.title && r.title && <small className="sf-err">{errs.title}</small>}</label>
        <div className="field-row three">
          <label className="sf-field"><span className="sf-label">Category</span><select className="in" aria-label="Record category" value={r.category} onChange={(e) => up({ category: e.target.value as RecordCategory })}>{Object.entries(RECORD_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Belongs to</span><select className="in" aria-label="Record masjid" value={r.center} disabled={!!lockedCenter} onChange={(e) => up({ center: e.target.value })}>{!lockedCenter && <option value="">Whole organization</option>}{centers.map((c) => <option key={c} value={c}>{c}</option>)}</select>{errs.center && <small className="sf-err">{errs.center}</small>}</label>
          <label className="sf-field"><span className="sf-label">Date</span><input className="in" type="date" aria-label="Record date" value={r.date} onChange={(e) => up({ date: e.target.value })} /></label>
        </div>
        <label className="sf-field"><span className="sf-label">Link (a file in your storage, or a web page)</span><input className="in" aria-label="Record link" placeholder="https://… or /files/minutes-2026-09.pdf" value={r.url} onChange={(e) => up({ url: e.target.value })} />{errs.url && r.url && <small className="sf-err">{errs.url}</small>}</label>
        <label className="sf-field"><span className="sf-label">Who may see it</span><select className="in" aria-label="Record audience" value={r.audience} onChange={(e) => up({ audience: e.target.value as RecordAudience })}>{Object.entries(RECORD_AUDIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="sf-field"><span className="sf-label">One line about it (optional)</span><input className="in" aria-label="Record summary" value={r.summary} onChange={(e) => up({ summary: e.target.value.slice(0, 300) })} /></label>
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={Object.keys(errs).length > 0}>{edit.index === null ? 'Add record' : 'Save'}</button></div>
      </form>
    </dialog>
  );
}
