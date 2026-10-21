'use client';
/** O6 – Admin › Prayer times › Friday khutbah: the committee's schedule, editable row by row or pasted from its sheet. */
import { useMemo, useState } from 'react';
import { Panel, SwitchRow } from '@/components/editor/bits';
import { khutbahFor, nextFriday, parseKhutbahSheet, type KhutbahRow, type PrayerSettings } from '@/lib/community/prayer';

type Doc = { draft: PrayerSettings; setDraft: (f: PrayerSettings | ((d: PrayerSettings) => PrayerSettings)) => void; issues: Record<string, string> };
const todayCT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function KhutbahTab({ doc, centers }: { doc: Doc; centers: string[] }) {
  const k = doc.draft.khutbah;
  const set = (f: (x: PrayerSettings['khutbah']) => void) => doc.setDraft((v) => { const n = structuredClone(v); f(n.khutbah); return n; });
  const [friday, setFriday] = useState(nextFriday(todayCT()));
  const [showPast, setShowPast] = useState(false);
  const [paste, setPaste] = useState(''); const [pasteResult, setPasteResult] = useState<{ rows: KhutbahRow[]; errors: string[] } | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');
  const today = todayCT();
  const fridays = useMemo(() => Array.from(new Set([...k.rows.map((r) => r.date), friday])).filter((d) => showPast || d >= today).sort(), [k.rows, friday, showPast, today]);
  const rows = khutbahFor(k, { date: friday });
  const idx = (r: KhutbahRow) => k.rows.indexOf(r);
  const update = (r: KhutbahRow, patch: Partial<KhutbahRow>) => set((x) => { const i = idx(r); if (i >= 0) x.rows[i] = { ...x.rows[i], ...patch }; });
  const remove = (r: KhutbahRow) => set((x) => { const i = idx(r); if (i >= 0) x.rows.splice(i, 1); });
  const add = () => set((x) => { x.rows.push({ date: friday, center: centers.find((c) => !rows.some((r) => r.center === c)) ?? centers[0] ?? '', khateeb: '', topic: '', language: '', time: '', note: '' }); });
  const copyWeek = () => set((x) => { const prev = new Date(Date.parse(`${friday}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10); for (const r of x.rows.filter((r) => r.date === prev)) if (!x.rows.some((y) => y.date === friday && y.center === r.center && y.time === r.time)) x.rows.push({ ...r, date: friday, khateeb: '', topic: '' }); });
  const applyPaste = () => {
    if (!pasteResult?.rows.length) return;
    set((x) => {
      if (mode === 'replace') { const dates = new Set(pasteResult.rows.map((r) => r.date)); x.rows = x.rows.filter((r) => !dates.has(r.date)); }
      for (const r of pasteResult.rows) { const i = x.rows.findIndex((y) => y.date === r.date && y.center === r.center && y.time === r.time); if (i >= 0) x.rows[i] = r; else x.rows.push(r); }
    });
    setPaste(''); setPasteResult(null);
  };
  return (
    <div className="cv">
      <Panel title="Friday khutbah schedule" intro="What the Khutbah Committee keeps in its sheet today: khateeb, time and topic per masjid per Friday. Shown on /khutbah, on every masjid’s Jumuah page and in the “Friday khutbah” block.">
        <SwitchRow id="kh-on" label="Show the schedule on the website" checked={k.enabled} onChange={(v) => set((x) => { x.enabled = v; })} />
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Note above the schedule</span><input className="in" value={k.note} maxLength={300} onChange={(e) => set((x) => { x.note = e.target.value; })} placeholder="Unless noted, khutbah starts at the listed time…" /></label>
          <label className="sf-field"><span className="sf-label">“Rate a khutbah” link</span><input className="in" value={k.feedbackUrl} maxLength={300} onChange={(e) => set((x) => { x.feedbackUrl = e.target.value; })} placeholder="/feedback?topic=khutbah" /></label>
        </div>
      </Panel>
      <Panel title={`Rows for ${fmt(friday)}`} intro={<><label className="sf-label" htmlFor="kh-friday">Friday</label> <select id="kh-friday" className="in in-sm" value={friday} onChange={(e) => setFriday(e.target.value)}>{fridays.map((d) => <option key={d} value={d}>{fmt(d)} ({k.rows.filter((r) => r.date === d).length})</option>)}</select>
        {' '}<button type="button" className="btn sm ghost" onClick={() => setFriday(new Date(Date.parse(`${friday}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10))}>Next Friday →</button>
        {' '}<label className="check"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> <span>Show past Fridays</span></label></>}>
        <div className="kh-admin-table">
          <table className="tbl">
            <thead><tr><th>Masjid</th><th>Time</th><th>Khateeb</th><th>Topic</th><th>Language</th><th>Note</th><th /></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>
                <td><select className="in in-sm" aria-label="Masjid" value={r.center} onChange={(e) => update(r, { center: e.target.value })}>{!centers.includes(r.center) && <option value={r.center}>{r.center} (not in centers)</option>}{centers.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
                <td><input className="in in-sm" type="time" aria-label="Khutbah time (blank = usual)" value={r.time} onChange={(e) => update(r, { time: e.target.value })} /></td>
                <td><input className="in in-sm" aria-label="Khateeb" value={r.khateeb} maxLength={80} onChange={(e) => update(r, { khateeb: e.target.value })} /></td>
                <td><input className="in in-sm" aria-label="Topic" value={r.topic} maxLength={160} onChange={(e) => update(r, { topic: e.target.value })} /></td>
                <td><input className="in in-sm" aria-label="Language" value={r.language} maxLength={30} onChange={(e) => update(r, { language: e.target.value })} placeholder="English" /></td>
                <td><input className="in in-sm" aria-label="Note" value={r.note} maxLength={200} onChange={(e) => update(r, { note: e.target.value })} /></td>
                <td><button type="button" className="icon-btn sm danger-text" aria-label="Remove row" onClick={() => remove(r)}>✕</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">No rows for this Friday yet.</td></tr>}</tbody>
          </table>
        </div>
        <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn sm" onClick={add}>+ Add a masjid</button>
          <button type="button" className="btn sm ghost" onClick={copyWeek}>Copy last Friday’s masajid and times</button>
        </div>
      </Panel>
      <Panel title="Paste from the committee’s sheet" intro="Copy the rows from Google Sheets or Excel (with the header row: date, center, khateeb, topic, language, time, note – any order) and paste here.">
        <textarea className="in" rows={6} value={paste} onChange={(e) => { setPaste(e.target.value); setPasteResult(e.target.value.trim() ? parseKhutbahSheet(e.target.value, centers) : null); }} placeholder={'date\tcenter\tkhateeb\ttopic\tlanguage\ttime\n10/24/2026\tMasjid Al-Salam\tImam Yusuf Ali\tGratitude\tEnglish\t13:15'} aria-label="Pasted schedule" />
        {pasteResult && (
          <div className="kh-paste-result">
            <p><b>{pasteResult.rows.length} row{pasteResult.rows.length === 1 ? '' : 's'}</b> ready{pasteResult.errors.length ? `, ${pasteResult.errors.length} warning${pasteResult.errors.length === 1 ? '' : 's'}` : ''}.</p>
            {pasteResult.errors.length > 0 && <ul className="sf-err">{pasteResult.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul>}
            <div className="seg seg-sm" role="radiogroup" aria-label="How to apply">
              <button type="button" role="radio" aria-checked={mode === 'merge'} onClick={() => setMode('merge')}>Add / update rows</button>
              <button type="button" role="radio" aria-checked={mode === 'replace'} onClick={() => setMode('replace')}>Replace those Fridays</button>
            </div>
            <button type="button" className="btn primary sm" disabled={!pasteResult.rows.length} onClick={applyPaste}>Apply to the draft</button>
          </div>
        )}
      </Panel>
    </div>
  );
}
