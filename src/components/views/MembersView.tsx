'use client';
/**
 * A3 Members list. Saved views (the questions staff ask) + search + filters + sortable table + paging + bulk actions.
 * View, filters, sort and page live in the address so a link can be shared. DEMO data (320 members, no API).
 * Live: same UI over GET /admin/members?view=&q=&zone=&plan=&status=&sort=&page= (server paging, role scopes A10).
 */
import Link from 'next/link';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  centerOf, centersOf, demoMembers, digits, eligibility, fmtDate, fullName, initials, lastPayment, MEMBERS_EVENT, membersWithEdits, PLANS, recordDate,
  STATUS_LABEL, statusOf, toCsv, YEAR, ZONES, type Member, type PlanId, type Status, type ZoneId,
} from '@/lib/members/members';

type Row = { m: Member; status: Status; vote: ReturnType<typeof eligibility>; paid: string };
const VIEWS = [
  { id: 'all', label: 'All members', test: (_: Row) => true },
  { id: 'voters', label: `Can vote ${YEAR}`, test: (r: Row) => r.vote.eligible },
  { id: 'pending', label: 'Pending approval', test: (r: Row) => r.status === 'pending' },
  { id: 'not-renewed', label: 'Not renewed', test: (r: Row) => r.status === 'expired' },
  { id: 'id-check', label: 'Photo ID to check', test: (r: Row) => r.m.idCheck !== 'verified' && r.m.standing === 'good' },
  { id: 'life', label: 'Life members', test: (r: Row) => r.status === 'life' },
] as const;
type ViewId = (typeof VIEWS)[number]['id'];
type SortKey = 'name' | 'plan' | 'zone' | 'status' | 'paid';
const SIZES = [25, 50, 100];
const ST_CLASS: Record<Status, string> = { active: 'st-active', life: 'st-approved', pending: 'st-board-review', expired: 'st-needs-info', resigned: 'st-muted', expelled: 'st-bad' };

type Q = { view: ViewId; q: string; zone: '' | ZoneId; plan: '' | PlanId; status: '' | Status; center: string; sort: SortKey; dir: 'asc' | 'desc'; page: number; size: number };
const DEFAULT_Q: Q = { view: 'all', q: '', zone: '', plan: '', status: '', center: '', sort: 'name', dir: 'asc', page: 1, size: 25 };
function readQ(search = typeof window === 'undefined' ? '' : window.location.search): Q {
  const p = new URLSearchParams(search); const q = { ...DEFAULT_Q };
  for (const k of Object.keys(DEFAULT_Q) as (keyof Q)[]) { const v = p.get(k); if (v != null) (q as Record<string, unknown>)[k] = typeof DEFAULT_Q[k] === 'number' ? Number(v) || DEFAULT_Q[k] : v; }
  if (!VIEWS.some((v) => v.id === q.view)) q.view = 'all';
  return q;
}

/** Demo data is deterministic, so the server renders real rows at once (fast first paint); this browser's edits merge in after. */
export function useMembers() {
  const [list, setList] = useState<Member[] | null>(() => demoMembers());
  useEffect(() => { const load = () => setList(membersWithEdits()); load(); window.addEventListener(MEMBERS_EVENT, load); return () => window.removeEventListener(MEMBERS_EVENT, load); }, []);
  return list;
}

export function MembersView({ search = '' }: { search?: string }) {
  const members = useMembers();
  const [q, setQState] = useState<Q>(() => readQ(search));
  const [sel, setSel] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  useEffect(() => { const on = () => setQState(readQ()); window.addEventListener('popstate', on); window.addEventListener('isgh:tab', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('isgh:tab', on); }; }, []);
  const setQ = useCallback((patch: Partial<Q>) => setQState((cur) => {
    const next = { ...cur, ...patch, page: 'page' in patch ? patch.page! : 1 };
    const u = new URL(window.location.href); u.search = '';
    for (const k of Object.keys(next) as (keyof Q)[]) if (next[k] !== DEFAULT_Q[k]) u.searchParams.set(k, String(next[k]));
    window.history.replaceState(null, '', u);
    if (patch.view !== undefined) queueMicrotask(() => window.dispatchEvent(new Event('isgh:tab'))); // keep the sidebar in step
    return next;
  }), []);
  const needle = useDeferredValue(q.q);

  const rows: Row[] = useMemo(() => (members ?? []).map((m) => { const lp = lastPayment(m); return { m, status: statusOf(m), vote: eligibility(m), paid: lp?.paidOn ?? '' }; }), [members]);
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.id, rows.filter(v.test).length])) as Record<ViewId, number>, [rows]);

  const filtered = useMemo(() => {
    const view = VIEWS.find((v) => v.id === q.view)!;
    const s = needle.trim().toLowerCase(); const sd = digits(s);
    const out = rows.filter((r) => view.test(r)
      && (!q.zone || r.m.zone === q.zone) && (!q.plan || r.m.plan === q.plan) && (!q.status || r.status === q.status) && (!q.center || centerOf(r.m) === q.center)
      && (!s || `${fullName(r.m)} ${r.m.email} ${r.m.id} ${r.m.zip}`.toLowerCase().includes(s) || (sd.length >= 4 && digits(r.m.phone).includes(sd))));
    const key = (r: Row): string => q.sort === 'name' ? `${r.m.last} ${r.m.first}` : q.sort === 'plan' ? PLANS[r.m.plan].name : q.sort === 'zone' ? `${ZONES[r.m.zone]} ${centerOf(r.m)}` : q.sort === 'status' ? STATUS_LABEL[r.status] : r.paid;
    out.sort((a, b) => key(a).localeCompare(key(b)) * (q.dir === 'asc' ? 1 : -1));
    return out;
  }, [rows, q.view, q.zone, q.plan, q.status, q.center, q.sort, q.dir, needle]);

  const pages = Math.max(1, Math.ceil(filtered.length / q.size));
  const page = Math.min(q.page, pages);
  const shown = filtered.slice((page - 1) * q.size, page * q.size);
  const allShown = shown.length > 0 && shown.every((r) => sel.includes(r.m.id));
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(''), 3500); };

  const exportCsv = (only?: string[]) => {
    const list = (only ? filtered.filter((r) => only.includes(r.m.id)) : filtered).map((r) => r.m);
    const blob = new Blob([toCsv(list)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `isgh-members-${q.view}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
    flash(`Exported ${list.length.toLocaleString('en-US')} member${list.length === 1 ? '' : 's'} to CSV.`);
  };
  const sortBtn = (k: SortKey, label: string) => (
    <th scope="col" aria-sort={q.sort === k ? (q.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => setQ({ sort: k, dir: q.sort === k && q.dir === 'asc' ? 'desc' : 'asc' })}>
        {label}<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d={q.sort === k ? (q.dir === 'asc' ? 'M2 6.5l3-3 3 3' : 'M2 3.5l3 3 3-3') : 'M2 4l3-2.5L8 4M2 6l3 2.5L8 6'} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
    </th>
  );
  const kpi = (id: ViewId, label: string, note: string) => (
    <button type="button" className={`m-kpi glass-pane${q.view === id ? ' on' : ''}`} onClick={() => setQ({ view: id })} aria-pressed={q.view === id}>
      <span>{label}</span><b>{members ? counts[id].toLocaleString('en-US') : '–'}</b><small>{note}</small>
    </button>
  );

  return (
    <div className="page members">
      <header className="page-head">
        <div>
          <h1>Members</h1>
          <p className="page-intro">Find anyone in seconds and see if they can vote in {YEAR} – and why. Record date {fmtDate(recordDate(YEAR))}. Demo data, 320 members.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => exportCsv()} disabled={!filtered.length}>Export this view</button>
        </div>
      </header>

      <div className="m-kpis">
        {kpi('all', 'All members', 'on record')}
        {kpi('voters', `Can vote in ${YEAR}`, 'meet every Bylaws rule')}
        {kpi('not-renewed', 'Not renewed', `no ${YEAR} dues yet`)}
        {kpi('pending', 'Pending approval', 'waiting for the Board')}
        {kpi('id-check', 'Photo ID to check', 'before approval')}
      </div>

      <section className="m-table glass-pane" aria-labelledby="m-h">
        <h2 id="m-h" className="sr-only">Member list</h2>
        <div className="m-views" role="tablist" aria-label="Saved views">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" type="button" aria-selected={q.view === v.id} className="m-view" onClick={() => setQ({ view: v.id })}>
              {v.label}<span>{members ? counts[v.id] : ''}</span>
            </button>
          ))}
        </div>
        <div className="m-filters">
          <label className="m-search">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" /></svg>
            <span className="sr-only">Search members</span>
            <input className="in" type="search" placeholder="Name, email, phone, member ID or ZIP" value={q.q} onChange={(e) => setQ({ q: e.target.value })} />
          </label>
          <select className="in pill-select" aria-label="Zone" value={q.zone} onChange={(e) => setQ({ zone: e.target.value as Q['zone'], center: '' })}>
            <option value="">All zones</option>{(Object.keys(ZONES) as ZoneId[]).map((z) => <option key={z} value={z}>{ZONES[z]}</option>)}
          </select>
          <select className="in pill-select" aria-label="Islamic Center" value={q.center} onChange={(e) => setQ({ center: e.target.value })} disabled={!q.zone}>
            <option value="">{q.zone ? 'All centers' : 'Pick a zone first'}</option>{q.zone && centersOf(q.zone).map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="in pill-select" aria-label="Plan" value={q.plan} onChange={(e) => setQ({ plan: e.target.value as Q['plan'] })}>
            <option value="">All plans</option>{(Object.keys(PLANS) as PlanId[]).map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
          </select>
          <select className="in pill-select" aria-label="Status" value={q.status} onChange={(e) => setQ({ status: e.target.value as Q['status'] })}>
            <option value="">Any status</option>{(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          {(q.q || q.zone || q.plan || q.status) && <button className="linkish" onClick={() => setQ({ q: '', zone: '', plan: '', status: '', center: '' })}>Clear filters</button>}
        </div>

        {sel.length > 0 && (
          <div className="m-bulk" role="region" aria-label="Selected members">
            <b>{sel.length} selected</b>
            <button className="btn sm" onClick={() => exportCsv(sel)}>Export selected</button>
            <button className="btn sm" onClick={() => flash(`Demo: a renewal reminder would go to ${sel.length} member${sel.length === 1 ? '' : 's'} (email and SMS adapters come later).`)}>Send renewal reminder</button>
            <button className="linkish" onClick={() => setSel([])}>Clear selection</button>
          </div>
        )}

        <p className="m-count" aria-live="polite">{!members ? 'Loading members…' : filtered.length ? `Showing ${((page - 1) * q.size + 1).toLocaleString('en-US')}–${Math.min(page * q.size, filtered.length).toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')}` : 'No members match. Try fewer filters.'}</p>

        <div className="m-scroll">
          <table className="m-grid">
            <thead>
              <tr>
                <th scope="col" className="m-check"><input type="checkbox" aria-label="Select all on this page" checked={allShown} onChange={() => setSel((s) => allShown ? s.filter((id) => !shown.some((r) => r.m.id === id)) : Array.from(new Set([...s, ...shown.map((r) => r.m.id)])))} /></th>
                {sortBtn('name', 'Member')}{sortBtn('plan', 'Plan')}{sortBtn('zone', 'Zone and center')}{sortBtn('status', 'Status')}
                <th scope="col">Voting {YEAR}</th>{sortBtn('paid', 'Last paid')}<th scope="col">Phone</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ m, status, vote, paid }) => (
                <tr key={m.id} className={sel.includes(m.id) ? 'is-sel' : undefined}>
                  <td className="m-check"><input type="checkbox" aria-label={`Select ${fullName(m)}`} checked={sel.includes(m.id)} onChange={() => setSel((s) => s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id])} /></td>
                  <td data-label="Member"><Link className="m-who" href={`/members/${m.id}`}><span className="m-av" aria-hidden="true">{initials(m)}</span><span><b>{fullName(m)}</b><small>{m.id} · {m.email}</small></span></Link></td>
                  <td data-label="Plan">{PLANS[m.plan].name}</td>
                  <td data-label="Zone"><span className="m-zone">{ZONES[m.zone]}<small>{centerOf(m)}</small></span></td>
                  <td data-label="Status"><span className={`st ${ST_CLASS[status]}`}>{STATUS_LABEL[status]}</span></td>
                  <td data-label={`Voting ${YEAR}`}><span className={`m-vote ${vote.eligible ? 'yes' : 'no'}`} title={vote.summary}>{vote.eligible ? 'Yes' : 'No'}<small>{vote.eligible ? '' : vote.summary}</small></span></td>
                  <td data-label="Last paid" className="num">{paid ? fmtDate(paid) : '—'}</td>
                  <td data-label="Phone" className="num"><a href={`tel:+1${digits(m.phone)}`}>{m.phone}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="m-pager">
          <label>Rows per page <select className="in pill-select" value={q.size} onChange={(e) => setQ({ size: Number(e.target.value) })}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <span>Page {page} of {pages}</span>
          <button className="btn sm" disabled={page <= 1} onClick={() => setQ({ page: page - 1 })}>Previous</button>
          <button className="btn sm" disabled={page >= pages} onClick={() => setQ({ page: page + 1 })}>Next</button>
        </footer>
      </section>
      {toast && <p className="m-toast glass-float" role="status">{toast}</p>}
    </div>
  );
}
