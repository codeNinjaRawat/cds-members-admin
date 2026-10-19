'use client';
/**
 * F6 Prayer times. Today (every center's iqamah at a glance) → Monthly timetable (print or CSV) → Iqamah rules per
 * center → Calculation and Eid (method, Asr, minute adjustments, special prayers, website). Adhan times are calculated;
 * centers set iqamah rules (fixed time or minutes after the adhan, by season). Jumu'ah comes from Zones and centers.
 * Center-limited admins edit only their centers; the calculation needs "Manage settings". DEMO (no API).
 */
import { ORG_TZ } from '@/lib/members/members';
import { useEffect, useMemo, useState } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, SwitchRow, Tabs, countIssues } from '@/components/editor/bits';
import {
  IQAMAH_PRAYERS, METHODS, PRAYERS, PRAYER_NAME, clock, clock24, dayTimes, monthDays, nextPrayer, prayerWarnings,
  type CenterTimes, type IqPrayer, type Method, type PrayerSettings, type Rule,
} from '@/lib/community/prayer';
import { OrgStructureSchema, fmtTime, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { useAccess } from '@/lib/access/use-access';
import { csvCell } from '@/lib/community/member-records';

type Doc = { draft: PrayerSettings; setDraft: (f: PrayerSettings | ((d: PrayerSettings) => PrayerSettings)) => void; issues: Record<string, string> };
const todayCT = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
const nowMinCT = () => { const p = new Intl.DateTimeFormat('en-US', { timeZone: ORG_TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()); return Number(p.find((x) => x.type === 'hour')?.value) * 60 + Number(p.find((x) => x.type === 'minute')?.value); };
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' });

export function PrayerTimesView() {
  return (
    <DocEditor<PrayerSettings> storeKey="prayer-times" title="Prayer times" preview={false}
      intro="Adhan times are calculated for Houston (ISNA, standard Asr – the method on ISGH’s monthly sheets). Each Islamic Center sets its iqamah: a fixed time or minutes after the adhan, by season. Jumu’ah times come from Zones and centers.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function useMap() {
  const [map, setMap] = useState<OrgStructure>(mockOrgStructure);
  useEffect(() => { void fetch('/api/store/org-structure', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = OrgStructureSchema.safeParse(j?.data); if (p.success) setMap(p.data); }).catch(() => {}); }, []);
  return map;
}

function Body({ doc }: { doc: Doc }) {
  const access = useAccess();
  const map = useMap();
  const today = todayCT();
  const zoneOf = (c: string) => map.centers.find((x) => x.name === c)?.zone ?? '';
  const mine = doc.draft.centers.filter((c) => access.inScope(zoneOf(c.center), c.center)).map((c) => c.center);
  const jumuah = (c: string) => (map.centers.find((x) => x.name === c)?.jumuah ?? []).map((j) => j.khutbah);
  const warns = useMemo(() => prayerWarnings(doc.draft, today, 120).filter((w) => mine.includes(w.center)), [doc.draft, today, mine.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pt">
      {warns.length > 0 && <details className="notice warn-note zn-warns" open={warns.length <= 4}><summary><b>{warns.length} iqamah problem{warns.length === 1 ? '' : 's'} in the next 4 months</b></summary><ul>{warns.map((w, i) => <li key={i}>{w.text}</li>)}</ul></details>}
      <Tabs label="Prayer times" tabs={[
        { id: 'today', label: 'Today', render: () => <Today s={doc.draft} centers={mine} jumuah={jumuah} map={map} /> },
        { id: 'month', label: 'Monthly timetable', render: () => <Month s={doc.draft} centers={mine} jumuah={jumuah} /> },
        { id: 'iqamah', label: 'Iqamah rules', badge: countIssues(doc.issues, ['centers']), render: () => <Iqamah doc={doc} centers={mine} /> },
        { id: 'settings', label: 'Calculation and Eid', badge: countIssues(doc.issues, ['special', 'location', 'adjust']), render: () => <Settings doc={doc} centers={mine} canCalc={access.can('settings.manage')} /> },
      ]} />
    </div>
  );
}

/* ---------------- Today ---------------- */
function Today({ s, centers, jumuah, map }: { s: PrayerSettings; centers: string[]; jumuah: (c: string) => string[]; map: OrgStructure }) {
  const today = todayCT();
  const [zone, setZone] = useState('');
  const [now, setNow] = useState(nowMinCT());
  useEffect(() => { const t = setInterval(() => setNow(nowMinCT()), 30_000); return () => clearInterval(t); }, []);
  const base = dayTimes(s, centers[0] ?? '', today);
  const next = nextPrayer(base, now);
  const rows = centers.filter((c) => !zone || map.centers.find((x) => x.name === c)?.zone === zone);
  return (
    <div className="pt-today">
      <section className="glass-pane pt-hero" aria-label="Adhan today">
        <div className="pt-hero-h"><h2>{fmtDate(today)}</h2>{s.website.showHijri && <span className="pill">{base.hijri}</span>}
          {next && <span className="pt-next" data-next={next.prayer}>Next: <b>{PRAYER_NAME[next.prayer]} {next.kind === 'iqamah' ? 'iqamah' : 'adhan'}</b> at {clock(next.at)} <small>in {Math.max(0, next.at - now)} min</small></span>}</div>
        <ol className="pt-strip">{PRAYERS.map((p) => <li key={p} className={next?.prayer === p ? 'on' : base.adhan[p] < now ? 'past' : ''}><span>{PRAYER_NAME[p]}</span><b>{clock(base.adhan[p])}</b><small>adhan</small></li>)}</ol>
        {base.special.length > 0 && <p className="pt-special">{base.special.map((x) => `${x.name}: ${x.times.map((t) => fmtTime(t)).join(', ')}`).join(' · ')}</p>}
      </section>
      <section className="glass-pane zk-list" aria-label="Iqamah at each center">
        <div className="bn-bar"><h2>Iqamah at each center <span className="pill">{rows.length}</span></h2>
          <select className="in pill-select" aria-label="Zone" value={zone} onChange={(e) => setZone(e.target.value)}><option value="">Every zone</option>{map.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
        <div className="table-wrap"><table className="t-plain zk-table pt-table">
          <thead><tr><th>Center</th>{IQAMAH_PRAYERS.map((p) => <th key={p} className="num">{PRAYER_NAME[p]}</th>)}<th>Jumu’ah</th></tr></thead>
          <tbody>{rows.map((c) => { const d = dayTimes(s, c, today, jumuah(c)); return (
            <tr key={c} data-center={c}><td>{c}</td>{IQAMAH_PRAYERS.map((p) => <td key={p} className={`num${d.iqamah && d.iqamah[p] < d.adhan[p] ? ' pt-bad' : ''}`}>{d.iqamah ? clock(d.iqamah[p]) : '—'}</td>)}<td>{jumuah(c).map((t) => fmtTime(t)).join(', ') || <span className="zn-missing">Not set</span>}</td></tr>); })}</tbody>
        </table></div>
      </section>
    </div>
  );
}

/* ---------------- Month ---------------- */
function Month({ s, centers, jumuah }: { s: PrayerSettings; centers: string[]; jumuah: (c: string) => string[] }) {
  const t = todayCT();
  const [c, setC] = useState(centers[0] ?? '');
  const [ym, setYm] = useState(t.slice(0, 7));
  const [y, m] = ym.split('-').map(Number);
  const days = monthDays(y, m).map((d) => dayTimes(s, c, d, jumuah(c)));
  const csv = () => {
    const head = ['Date', 'Hijri', ...PRAYERS.flatMap((p) => (p === 'sunrise' ? ['Sunrise'] : [`${PRAYER_NAME[p]} adhan`, `${PRAYER_NAME[p]} iqamah`])), 'Jumu’ah'];
    const rows = days.map((d) => [d.date, d.hijri, ...PRAYERS.flatMap((p) => (p === 'sunrise' ? [clock24(d.adhan[p])] : [clock24(d.adhan[p]), d.iqamah ? clock24(d.iqamah[p as IqPrayer]) : ''])), d.jumuah.join(' ')]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `prayer-times-${c.toLowerCase().replace(/\s+/g, '-')}-${ym}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <section className="glass-pane zk-list pt-month" aria-label="Monthly timetable">
      <div className="bn-bar"><h2>Monthly timetable</h2>
        <select className="in pill-select" aria-label="Center" value={c} onChange={(e) => setC(e.target.value)}>{centers.map((x) => <option key={x}>{x}</option>)}</select>
        <input className="in" type="month" aria-label="Month" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} />
        <button type="button" className="btn" onClick={csv}>Download CSV</button>
        <button type="button" className="btn" onClick={() => window.print()}>Print</button>
      </div>
      <div className="table-wrap"><table className="t-plain zk-table pt-table pt-cal">
        <thead><tr><th>Date</th>{PRAYERS.map((p) => <th key={p} className="num">{PRAYER_NAME[p]}</th>)}</tr></thead>
        <tbody>{days.map((d) => (
          <tr key={d.date} className={`${d.date === t ? 'is-today' : ''}${d.jumuah.length ? ' is-fri' : ''}`} data-date={d.date}>
            <td><b>{fmtDate(d.date).split(',')[0]} {d.date.slice(8)}</b>{s.website.showHijri && <small className="block">{d.hijri}</small>}{d.jumuah.length > 0 && <small className="block">Jumu’ah {d.jumuah.map((x) => fmtTime(x)).join(', ')}</small>}{d.special.map((x) => <small key={x.id} className="block pt-sp">{x.name}</small>)}</td>
            {PRAYERS.map((p) => <td key={p} className="num">{clock(d.adhan[p])}{p !== 'sunrise' && d.iqamah && <small className="block pt-iq">{clock(d.iqamah[p as IqPrayer])}</small>}</td>)}
          </tr>
        ))}</tbody>
      </table></div>
      <p className="muted small">Top: adhan. Below: iqamah at {c}.</p>
    </section>
  );
}

/* ---------------- Iqamah rules ---------------- */
const blankRule = (): Rule => ({ from: '01-01', to: '12-31', kind: 'after', minutes: 15, time: '', roundTo: 5 });
function Iqamah({ doc, centers }: { doc: Doc; centers: string[] }) {
  const [c, setC] = useState(centers[0] ?? '');
  const i = doc.draft.centers.findIndex((x) => x.center === c);
  const ct = doc.draft.centers[i];
  const set = (f: (x: CenterTimes) => void) => doc.setDraft((d) => { const n = structuredClone(d); f(n.centers[i]); return n; });
  if (!ct) return <p className="muted">No center you can edit.</p>;
  const week = Array.from({ length: 7 }, (_, k) => new Date(Date.parse(`${todayCT()}T12:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10)).map((d) => dayTimes(doc.draft, c, d));
  return (
    <div className="pt-iqamah">
      <div className="bn-bar"><label className="sr-only" htmlFor="pt-c">Center</label><select id="pt-c" className="in pill-select of-center-pick" value={c} onChange={(e) => setC(e.target.value)}>{centers.map((x) => <option key={x}>{x}</option>)}</select>
        <button type="button" className="btn" onClick={() => doc.setDraft((d) => { const n = structuredClone(d); n.centers.forEach((x) => { if (x.center !== c && centers.includes(x.center)) x.iqamah = structuredClone(ct.iqamah); }); return n; })}>Copy to all my centers</button></div>
      {IQAMAH_PRAYERS.map((p) => {
        const err = doc.issues[`centers.${i}.iqamah.${p}`];
        return (
          <section key={p} className="glass-pane zk-list pt-rule" aria-label={`${PRAYER_NAME[p]} iqamah`} data-prayer={p}>
            <h3>{PRAYER_NAME[p]}</h3>
            <ul>{ct.iqamah[p].map((r, k) => {
              const up = (patch: Partial<Rule>) => set((x) => { x.iqamah[p][k] = { ...x.iqamah[p][k], ...patch }; });
              return (
                <li key={k} className="pt-rule-row">
                  <label>From <input className="in" aria-label={`${PRAYER_NAME[p]} rule ${k + 1} from`} value={r.from} onChange={(e) => up({ from: e.target.value })} placeholder="MM-DD" /></label>
                  <label>to <input className="in" aria-label={`${PRAYER_NAME[p]} rule ${k + 1} to`} value={r.to} onChange={(e) => up({ to: e.target.value })} placeholder="MM-DD" /></label>
                  <select className="in" aria-label={`${PRAYER_NAME[p]} rule ${k + 1} kind`} value={r.kind} onChange={(e) => up({ kind: e.target.value as Rule['kind'], time: e.target.value === 'fixed' ? r.time || '13:45' : '' })}><option value="after">Minutes after the adhan</option><option value="fixed">Fixed time</option></select>
                  {r.kind === 'after' ? <>
                    <input className="in in-num" type="number" min="0" max="120" aria-label={`${PRAYER_NAME[p]} rule ${k + 1} minutes`} value={r.minutes} onChange={(e) => up({ minutes: Number(e.target.value || 0) })} />
                    <select className="in" aria-label={`${PRAYER_NAME[p]} rule ${k + 1} rounding`} value={r.roundTo} onChange={(e) => up({ roundTo: Number(e.target.value) as Rule['roundTo'] })}><option value={1}>exact minute</option><option value={5}>round up to 5</option><option value={10}>round up to 10</option><option value={15}>round up to 15</option></select>
                  </> : <input className="in" type="time" aria-label={`${PRAYER_NAME[p]} rule ${k + 1} time`} value={r.time} onChange={(e) => up({ time: e.target.value })} />}
                  {ct.iqamah[p].length > 1 && <button type="button" className="linkish" onClick={() => set((x) => { x.iqamah[p].splice(k, 1); })}>Remove<span className="sr-only"> rule {k + 1}</span></button>}
                </li>
              );
            })}</ul>
            {err && <p className="sf-err" role="alert">{err}</p>}
            <div className="pt-rule-foot"><button type="button" className="btn sm" onClick={() => set((x) => { x.iqamah[p].push(blankRule()); })}>Add a season</button>
              <span className="pt-week">{week.map((d) => <span key={d.date}><small>{d.date.slice(5).replace('-', '/')}</small>{d.iqamah ? clock(d.iqamah[p]) : '—'}</span>)}</span></div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Calculation and Eid ---------------- */
function Settings({ doc, centers, canCalc }: { doc: Doc; centers: string[]; canCalc: boolean }) {
  const d = doc.draft;
  const set = (f: (x: PrayerSettings) => void) => doc.setDraft((v) => { const n = structuredClone(v); f(n); return n; });
  const t = todayCT();
  return (
    <div className="cv">
      <Panel title="Calculation" intro={canCalc ? 'The same adhan times are used for every center. ISGH’s monthly sheets use ISNA with the standard Asr.' : 'Only admins with “Manage settings” change the calculation.'}>
        <fieldset disabled={!canCalc} className="pt-fs">
          <div className="field-row">
            <label className="sf-field"><span className="sf-label">Method</span><select className="in" aria-label="Calculation method" value={d.method} onChange={(e) => set((x) => { x.method = e.target.value as Method; })}>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></label>
            <label className="sf-field"><span className="sf-label">Asr</span><select className="in" aria-label="Asr method" value={d.asr} onChange={(e) => set((x) => { x.asr = e.target.value as PrayerSettings['asr']; })}><option value="standard">Standard – Shafi’i, Maliki, Hanbali</option><option value="hanafi">Hanafi (later)</option></select></label>
          </div>
          <div className="field-row">
            <label className="sf-field"><span className="sf-label">Place</span><input className="in" aria-label="Place name" value={d.location.label} onChange={(e) => set((x) => { x.location.label = e.target.value; })} /></label>
            <label className="sf-field"><span className="sf-label">Latitude</span><input className="in in-num" type="number" step="0.0001" aria-label="Latitude" value={d.location.lat} onChange={(e) => set((x) => { x.location.lat = Number(e.target.value); })} /></label>
            <label className="sf-field"><span className="sf-label">Longitude</span><input className="in in-num" type="number" step="0.0001" aria-label="Longitude" value={d.location.lng} onChange={(e) => set((x) => { x.location.lng = Number(e.target.value); })} /></label>
          </div>
          <p className="sf-label">Minute adjustments (precaution added to the calculated time)</p>
          <div className="pt-adj">{PRAYERS.map((p) => <label key={p} className="sf-field"><span className="sf-label">{PRAYER_NAME[p]}</span><input className="in in-num" type="number" min="-15" max="15" aria-label={`${PRAYER_NAME[p]} adjustment`} value={d.adjust[p]} onChange={(e) => set((x) => { x.adjust[p] = Number(e.target.value || 0); })} /></label>)}</div>
          <label className="sf-field"><span className="sf-label">Hijri date adjustment (moon sighting)</span><select className="in" aria-label="Hijri adjustment" value={d.hijriAdjust} onChange={(e) => set((x) => { x.hijriAdjust = Number(e.target.value); })}>{[-2, -1, 0, 1, 2].map((n) => <option key={n} value={n}>{n > 0 ? `+${n}` : n} day{Math.abs(n) === 1 ? '' : 's'}</option>)}</select><small className="sf-hint">Today: {dayTimes(d, '', t).hijri}</small></label>
        </fieldset>
      </Panel>
      <Panel title="Eid and special prayers" intro="Shown on the timetable, the website and the member app for that day.">
        <ul className="pt-specials">{d.special.map((sp, k) => (
          <li key={sp.id} data-special={sp.id}>
            <input className="in" aria-label={`Special prayer ${k + 1} name`} value={sp.name} onChange={(e) => set((x) => { x.special[k].name = e.target.value; })} />
            <input className="in" type="date" aria-label={`Special prayer ${k + 1} date`} value={sp.date} onChange={(e) => set((x) => { x.special[k].date = e.target.value; })} />
            <select className="in" aria-label={`Special prayer ${k + 1} center`} value={sp.center} onChange={(e) => set((x) => { x.special[k].center = e.target.value; })}><option value="">Every center</option>{centers.map((c) => <option key={c}>{c}</option>)}</select>
            <input className="in" aria-label={`Special prayer ${k + 1} times`} value={sp.times.join(', ')} onChange={(e) => set((x) => { x.special[k].times = e.target.value.split(/[\s,]+/).filter(Boolean); })} placeholder="08:00, 09:30" />
            <button type="button" className="linkish" onClick={() => set((x) => { x.special.splice(k, 1); })}>Remove<span className="sr-only"> {sp.name}</span></button>
            {(doc.issues[`special.${k}.times`] || doc.issues[`special.${k}.name`]) && <small className="sf-err">{doc.issues[`special.${k}.times`] ?? doc.issues[`special.${k}.name`]}</small>}
          </li>
        ))}</ul>
        <button type="button" className="btn sm" onClick={() => set((x) => { x.special.push({ id: `special-${Date.now().toString(36)}`, date: t, name: 'Eid prayer', center: '', times: ['08:00'], place: '' }); })}>Add a special prayer</button>
      </Panel>
      <Panel title="Website">
        <SwitchRow id="pt-web" label="Show the Prayer times page" checked={d.website.enabled} onChange={(v) => set((x) => { x.website.enabled = v; })} />
        <SwitchRow id="pt-iq" label="Show iqamah times (not only adhan)" checked={d.website.showIqamah} onChange={(v) => set((x) => { x.website.showIqamah = v; })} />
        <SwitchRow id="pt-hijri" label="Show the Hijri date" checked={d.website.showHijri} onChange={(v) => set((x) => { x.website.showHijri = v; })} />
      </Panel>
    </div>
  );
}
