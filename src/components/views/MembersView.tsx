'use client';
/**
 * A3 Members list. Saved views (the questions staff ask) + search + filters + sortable table + paging + bulk actions.
 * View, filters, sort and page live in the address so a link can be shared. DEMO data (320 members, no API).
 * Live: same UI over GET /admin/members?view=&q=&zone=&plan=&status=&sort=&page= (server paging, role scopes A10).
 */
import { UNROUTED, useMasjidFilter } from '@/lib/access/masjid-filter';
import Link from 'next/link';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  centerOf, centersOf, demoMembers, digits, eligibility, fmtDate, fullName, initials, lastPayment, MEMBERS_EVENT, membersWithEdits, PLANS, recordDate,
  renewalOf, STATUS_LABEL, statusOf, toCsv, YEAR, ZONES, type Member, type PlanId, type Status, type ZoneId, ORG_TZ } from '@/lib/members/members';
import { useOrgConfig } from '@/lib/members/use-org-config';
import { LIVE } from '@/lib/live/live';
import { useAccess } from '@/lib/access/use-access';
import { logAudit } from '@/lib/access/audit';
import { MemberImport } from './MemberImport';
import { AddMemberDialog } from './AddMemberDialog';
import { idPurgeDue } from '@/lib/community/org-config';

type Row = { m: Member; status: Status; vote: ReturnType<typeof eligibility>; paid: string };
const VIEWS = [
  { id: 'all', label: 'All members', test: (r: Row) => r.status !== 'archived' },
  { id: 'voters', label: `Can vote ${YEAR}`, test: (r: Row) => r.vote.eligible },
  { id: 'pending', label: 'Pending approval', test: (r: Row) => r.status === 'pending' },
  { id: 'not-renewed', label: 'Not renewed', test: (r: Row) => r.status === 'expired' },
  { id: 'id-check', label: 'Photo ID to check', test: (r: Row) => r.m.idCheck !== 'verified' && r.m.standing === 'good' },
  { id: 'life', label: 'Life members', test: (r: Row) => r.status === 'life' },
  { id: 'archived', label: 'Archived', test: (r: Row) => r.status === 'archived' },
] as const;
type ViewId = (typeof VIEWS)[number]['id'];
type SortKey = 'added' | 'name' | 'plan' | 'zone' | 'status' | 'vote' | 'paid';
const SIZES = [25, 50, 100];
const ST_CLASS: Record<Status, string> = { active: 'st-active', life: 'st-approved', pending: 'st-board-review', expired: 'st-needs-info', resigned: 'st-muted', expelled: 'st-bad', archived: 'st-muted' };

type Q = { view: ViewId; q: string; zone: '' | ZoneId; plan: '' | PlanId; status: '' | Status; center: string; sort: SortKey; dir: 'asc' | 'desc'; page: number; size: number; peek: string };
const DEFAULT_Q: Q = { view: 'all', q: '', zone: '', plan: '', status: '', center: '', sort: 'added', dir: 'desc', page: 1, size: 25, peek: '' };   // newest first – a record made a minute ago is at the top
function readQ(search = typeof window === 'undefined' ? '' : window.location.search): Q {
  const p = new URLSearchParams(search); const q = { ...DEFAULT_Q };
  for (const k of Object.keys(DEFAULT_Q) as (keyof Q)[]) { const v = p.get(k); if (v != null) (q as Record<string, unknown>)[k] = typeof DEFAULT_Q[k] === 'number' ? Number(v) || DEFAULT_Q[k] : v; }
  if (!VIEWS.some((v) => v.id === q.view)) q.view = 'all';
  return q;
}

/** Demo data is deterministic, so the server renders real rows at once (fast first paint); this browser's edits merge in after. */
export function useMembers() {
  const [list, setList] = useState<Member[] | null>(() => (LIVE ? null : demoMembers()));   // live: nothing until the API answers
  useEffect(() => { const load = () => setList(LIVE && !membersWithEdits().length ? null : membersWithEdits()); load(); window.addEventListener(MEMBERS_EVENT, load); return () => window.removeEventListener(MEMBERS_EVENT, load); }, []);
  return list;
}

export function MembersView({ search = '' }: { search?: string }) {
  const members = useMembers();
  const [q, setQState] = useState<Q>(() => readQ(search));
  const mf = useMasjidFilter();
  const [sel, setSel] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const cfg = useOrgConfig();
  const [dialog, setDialog] = useState<null | { kind: 'export'; only?: string[] } | { kind: 'import' } | { kind: 'add' }>(null);
  useEffect(() => { const on = () => setQState(readQ()); window.addEventListener('popstate', on); window.addEventListener('isgh:tab', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('isgh:tab', on); }; }, []);
  // the shared "Viewing" masjid fills the zone / center filters when the address has none; choices here are shared back
  useEffect(() => { if (mf.narrowed && !q.zone && !q.center) setQ({ zone: mf.zone, center: mf.masjid === UNROUTED ? '' : mf.masjid }); }, [mf.zone, mf.masjid]); // eslint-disable-line react-hooks/exhaustive-deps
  const setQ = useCallback((patch: Partial<Q>) => setQState((cur) => {
    const next = { ...cur, ...patch, page: 'page' in patch ? patch.page! : 1 };
    const u = new URL(window.location.href); u.search = '';
    for (const k of Object.keys(next) as (keyof Q)[]) if (next[k] !== DEFAULT_Q[k]) u.searchParams.set(k, String(next[k]));
    // the address is written after render (writing it inside a state update makes Next's router update mid-render)
    queueMicrotask(() => { window.history.replaceState(null, '', u); if (patch.view !== undefined) window.dispatchEvent(new Event('isgh:tab')); }); // keep the sidebar in step
    return next;
  }), []);
  const needle = useDeferredValue(q.q);

  const access = useAccess();
  const contact = access.can('members.contact');
  // nothing is listed until the signed-in person's scope is known – a zone or area role must never see the whole list for a moment
  const rows: Row[] = useMemo(() => (access.ready ? (members ?? []) : []).filter((m) => access.inScope(m.zone, centerOf(m), m.zip)).map((m) => { const lp = lastPayment(m); return { m, status: statusOf(m), vote: eligibility(m), paid: lp?.paidOn ?? '' }; }), [members, access.ready, access.me?.id, access.dashIndex]);
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.id, rows.filter(v.test).length])) as Record<ViewId, number>, [rows]);

  const filtered = useMemo(() => {
    const view = VIEWS.find((v) => v.id === q.view)!;
    const s = needle.trim().toLowerCase(); const sd = digits(s);
    const out = rows.filter((r) => view.test(r)
      && (!q.zone || r.m.zone === q.zone) && (!q.plan || r.m.plan === q.plan) && (!q.status || r.status === q.status) && (!q.center || centerOf(r.m) === q.center)
      && (!s || `${fullName(r.m)} ${r.m.email} ${r.m.id} ${r.m.zip}`.toLowerCase().includes(s) || (sd.length >= 4 && digits(r.m.phone).includes(sd))));
    const key = (r: Row): string => q.sort === 'added' ? `${r.m.appliedOn} ${r.m.id}` : q.sort === 'name' ? `${r.m.last} ${r.m.first}` : q.sort === 'plan' ? PLANS[r.m.plan].name : q.sort === 'zone' ? `${ZONES[r.m.zone]} ${centerOf(r.m)}` : q.sort === 'status' ? STATUS_LABEL[r.status] : q.sort === 'vote' ? (r.vote.eligible ? '1' : '0') : r.paid;
    out.sort((a, b) => key(a).localeCompare(key(b)) * (q.dir === 'asc' ? 1 : -1));
    return out;
  }, [rows, q.view, q.zone, q.plan, q.status, q.center, q.sort, q.dir, needle]);

  const pages = Math.max(1, Math.ceil(filtered.length / q.size));
  const page = Math.min(q.page, pages);
  const shown = filtered.slice((page - 1) * q.size, page * q.size);
  const allShown = shown.length > 0 && shown.every((r) => sel.includes(r.m.id));
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(''), 3500); };

  const exportCsv = (only?: string[], adminOnly = false) => {
    logAudit({ area: 'export', action: 'Members exported', detail: `${only ? only.length : filtered.length} rows, view “${q.view}”${adminOnly ? ', with admin-only fields' : ''}` });
    const list = (only ? filtered.filter((r) => only.includes(r.m.id)) : filtered).map((r) => r.m);
    const blob = new Blob([toCsv(list, cfg.members.fields, adminOnly)], { type: 'text/csv;charset=utf-8' });
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
  const filterChips: { key: keyof Q; label: string }[] = [
    ...(q.zone ? [{ key: 'zone' as const, label: `Zone: ${ZONES[q.zone]}` }] : []),
    ...(q.center ? [{ key: 'center' as const, label: q.center }] : []),
    ...(q.plan ? [{ key: 'plan' as const, label: `Plan: ${PLANS[q.plan].name}` }] : []),
    ...(q.status ? [{ key: 'status' as const, label: `Status: ${STATUS_LABEL[q.status]}` }] : []),
  ];
  const peekIdx = q.peek ? filtered.findIndex((r) => r.m.id === q.peek) : -1;
  const peekRow = peekIdx >= 0 ? filtered[peekIdx] : q.peek ? rows.find((r) => r.m.id === q.peek) : undefined;
  const openPeek = (id: string) => setQ({ peek: id, page });
  const purgeDue = (() => { const keep = cfg.security.idDocuments.keepDays; const today = new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
    return { keep, n: (members ?? []).filter((m) => m.idCheck === 'verified' && idPurgeDue(m.approvedOn, keep, today)).length }; })();

  return (
    <div className={`page members${peekRow ? ' has-peek' : ''}`}>
      <header className="page-head m-head-row">
        <div>
          <h1>Members <span className="m-total">{members ? rows.filter((r) => r.status !== 'archived').length.toLocaleString('en-US') : ''}</span></h1>
          <p className="page-intro">Voting record date {fmtDate(recordDate(YEAR))}{LIVE ? '' : ' · demo data'}</p>
        </div>
        <div className="page-actions">
          {purgeDue.n > 0 && (
            <details className="m-notices">
              <summary className="btn ghost"><span className="m-dot" aria-hidden="true" />1 notice</summary>
              <div className="m-pop glass-float" role="note">
                <p className="notice id-purge">{purgeDue.n.toLocaleString('en-US')} photo ID file{purgeDue.n === 1 ? ' is' : 's are'} past the {purgeDue.keep}-day keep period (Settings › Configuration › Security). The BE deletes the files nightly and keeps only “verified on (date) by (admin)”.</p>
              </div>
            </details>
          )}
          {LIVE && access.can('members.edit') && <button className="btn primary" onClick={() => setDialog({ kind: 'add' })}>Add member</button>}
          {access.can('members.archive') && <button className="btn" onClick={() => setDialog({ kind: 'import' })}>Import</button>}
          {access.can('members.contact') && <button className="btn" onClick={() => setDialog({ kind: 'export' })} disabled={!filtered.length}>Export this view</button>}
        </div>
      </header>

      <section className="m-table glass-pane" aria-labelledby="m-h">
        <h2 id="m-h" className="sr-only">Member list</h2>
        <div className="m-views" role="tablist" aria-label="Saved views">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" type="button" aria-selected={q.view === v.id} className="m-view" onClick={() => setQ({ view: v.id, peek: '' })}>
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
          <button type="button" className={`btn m-filter-btn${filterChips.length ? ' on' : ''}`} aria-expanded={showFilters} aria-controls="m-filter-panel" onClick={() => setShowFilters((x) => !x)}>
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Filters{filterChips.length ? <span className="m-badge">{filterChips.length}</span> : null}
          </button>
        </div>
        {showFilters && (
          <div className="m-filter-panel" id="m-filter-panel">
            <label className="sf-field"><span className="sf-label">Zone</span>
              <select className="in" aria-label="Zone" value={q.zone} onChange={(e) => { setQ({ zone: e.target.value as Q['zone'], center: '' }); if (e.target.value) mf.setZone(e.target.value as ZoneId); else mf.clear(); }}>
                <option value="">All zones</option>{(Object.keys(ZONES) as ZoneId[]).map((z) => <option key={z} value={z}>{ZONES[z]}</option>)}
              </select></label>
            <label className="sf-field"><span className="sf-label">Islamic Center</span>
              <select className="in" aria-label="Islamic Center" value={q.center} onChange={(e) => { setQ({ center: e.target.value }); if (e.target.value) mf.setMasjid(e.target.value); else mf.setZone(q.zone as ZoneId); }} disabled={!q.zone}>
                <option value="">{q.zone ? 'All centers' : 'Pick a zone first'}</option>{q.zone && centersOf(q.zone).map((c) => <option key={c}>{c}</option>)}
              </select></label>
            <label className="sf-field"><span className="sf-label">Plan</span>
              <select className="in" aria-label="Plan" value={q.plan} onChange={(e) => setQ({ plan: e.target.value as Q['plan'] })}>
                <option value="">All plans</option>{(Object.keys(PLANS) as PlanId[]).map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
              </select></label>
            <label className="sf-field"><span className="sf-label">Status</span>
              <select className="in" aria-label="Status" value={q.status} onChange={(e) => setQ({ status: e.target.value as Q['status'] })}>
                <option value="">Any status</option>{(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select></label>
          </div>
        )}
        {(filterChips.length > 0 || q.q) && (
          <div className="m-chips" aria-label="Active filters">
            {filterChips.map((c) => (
              <button key={c.key} type="button" className="m-chip" aria-label={`Remove filter ${c.label}`} onClick={() => { if (c.key === 'zone') mf.clear(); if (c.key === 'center') mf.setZone(q.zone as ZoneId); setQ(c.key === 'zone' ? { zone: '', center: '' } : { [c.key]: '' } as Partial<Q>); }}>{c.label}<span aria-hidden="true">×</span></button>
            ))}
            <button className="linkish" onClick={() => { mf.clear(); setQ({ q: '', zone: '', plan: '', status: '', center: '' }); }}>Clear filters</button>
          </div>
        )}

        {sel.length > 0 && (
          <div className="m-bulk" role="region" aria-label="Selected members">
            <b>{sel.length} selected</b>
            {access.can('members.contact') && <button className="btn sm" onClick={() => setDialog({ kind: 'export', only: sel })}>Export selected</button>}
            <button className="btn sm" onClick={() => flash(`Demo: a renewal reminder would go to ${sel.length} member${sel.length === 1 ? '' : 's'} (email and SMS adapters come later).`)}>Send renewal reminder</button>
            <button className="linkish" onClick={() => setSel([])}>Clear selection</button>
          </div>
        )}

        <p className="m-count" aria-live="polite">{!members || !access.ready ? 'Loading members…' : filtered.length ? `Showing ${((page - 1) * q.size + 1).toLocaleString('en-US')}–${Math.min(page * q.size, filtered.length).toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')}` : 'No members match. Try fewer filters.'}</p>

        <div className="m-scroll">
          <table className="m-grid">
            <thead>
              <tr>
                <th scope="col" className="m-check"><input type="checkbox" aria-label="Select all on this page" checked={allShown} onChange={() => setSel((s) => allShown ? s.filter((id) => !shown.some((r) => r.m.id === id)) : Array.from(new Set([...s, ...shown.map((r) => r.m.id)])))} /></th>
                {sortBtn('name', 'Member')}{sortBtn('status', 'Status')}
                {sortBtn('vote', `Vote ${YEAR}`)}{sortBtn('plan', 'Plan')}{sortBtn('zone', 'Zone and center')}{contact && <th scope="col">Contact</th>}{sortBtn('added', 'Added')}{sortBtn('paid', 'Last paid')}
              </tr>
            </thead>
            <tbody>
              {shown.map(({ m, status, vote, paid }) => (
                <tr key={m.id} className={[sel.includes(m.id) ? 'is-sel' : '', q.peek === m.id ? 'is-peek' : ''].join(' ').trim() || undefined}
                  onClick={(e) => { if ((e.target as HTMLElement).closest('input,a,button')) return; openPeek(m.id); }}>
                  <td className="m-check"><input type="checkbox" aria-label={`Select ${fullName(m)}`} checked={sel.includes(m.id)} onChange={() => setSel((s) => s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id])} /></td>
                  <td data-label="Member"><a className="m-who" href={`/members/${m.id}`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); openPeek(m.id); }}>
                    <span><b>{fullName(m)}</b><small>{m.id}</small></span></a></td>
                  <td data-label="Status"><span className={`st ${ST_CLASS[status]}`}>{STATUS_LABEL[status]}</span></td>
                  <td data-label={`Vote ${YEAR}`}><span className={`m-vote ${vote.eligible ? 'yes' : 'no'}`} title={vote.summary}><i aria-hidden="true">{vote.eligible ? '✓' : '–'}</i>{vote.eligible ? 'Yes' : 'No'}</span></td>
                  <td data-label="Plan">{PLANS[m.plan].name}</td>
                  <td data-label="Zone"><span className="m-zone">{ZONES[m.zone]}<small>{centerOf(m)}</small></span></td>
                  {contact && <td data-label="Contact" className="m-contact"><a href={`tel:+1${digits(m.phone)}`}>{m.phone}</a><small><a href={`mailto:${m.email}`}>{m.email}</a></small></td>}
                  <td data-label="Added" className="num">{m.appliedOn ? fmtDate(m.appliedOn) : '—'}</td>
                  <td data-label="Last paid" className="num">{paid ? fmtDate(paid) : '—'}</td>
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
      {peekRow && <MemberPeek row={peekRow} contact={access.can('members.contact')} canPay={access.can('payments.record')}
        pos={peekIdx >= 0 ? `${peekIdx + 1} of ${filtered.length.toLocaleString('en-US')}` : ''}
        onPrev={peekIdx > 0 ? () => setQ({ peek: filtered[peekIdx - 1].m.id, page: Math.floor((peekIdx - 1) / q.size) + 1 }) : undefined}
        onNext={peekIdx >= 0 && peekIdx < filtered.length - 1 ? () => setQ({ peek: filtered[peekIdx + 1].m.id, page: Math.floor((peekIdx + 1) / q.size) + 1 }) : undefined}
        onClose={() => setQ({ peek: '', page })} />}
      {toast && <p className="m-toast glass-float" role="status">{toast}</p>}
      {dialog?.kind === 'add' && <AddMemberDialog onClose={() => setDialog(null)} onAdded={(id) => { logAudit({ area: 'members', action: 'Member added', detail: id }); setDialog(null); }} />}
      {dialog?.kind === 'export' && <ExportDialog count={dialog.only ? dialog.only.length : filtered.length} hasAdminOnly={cfg.members.fields.some((f) => f.access === 'admins' && f.type !== 'file')}
        onClose={() => setDialog(null)} onExport={(adminOnly) => { exportCsv(dialog.only, adminOnly); setDialog(null); }} />}
      {dialog?.kind === 'import' && members && <MemberImport members={members} cfg={cfg} onClose={() => setDialog(null)} onDone={(n) => { logAudit({ area: 'members', action: 'Members imported', detail: `${n} new records (Pending approval)` }); setDialog(null); flash(`Imported ${n.toLocaleString('en-US')} member${n === 1 ? '' : 's'}. They wait for Board approval.`); }} />}
    </div>
  );
}

/** Quick look: the facts staff need most, without leaving the list. The full record stays one click away. */
function MemberPeek({ row, contact, canPay, pos, onPrev, onNext, onClose }: { row: Row; contact: boolean; canPay: boolean; pos: string; onPrev?: () => void; onNext?: () => void; onClose: () => void }) {
  const { m, status, vote, paid } = row;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
  const ren = renewalOf(m, today);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus(); }, [m.id]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest('input,select,textarea,dialog')) return;
      if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowDown' && onNext) { e.preventDefault(); onNext(); } else if (e.key === 'ArrowUp' && onPrev) { e.preventDefault(); onPrev(); } };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, [onClose, onNext, onPrev]);
  const payable = canPay && m.plan !== 'life' && !!m.approvedOn && status !== 'archived';
  return (
    <aside ref={ref} tabIndex={-1} className="m-peek glass-float" aria-label={`Quick look: ${fullName(m)}`}>
      <div className="m-peek-top">
        <span className="m-peek-pos">{pos}</span>
        <span className="m-peek-nav">
          <button type="button" className="icon-btn" aria-label="Previous member" disabled={!onPrev} onClick={onPrev}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" /></svg></button>
          <button type="button" className="icon-btn" aria-label="Next member" disabled={!onNext} onClick={onNext}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" /></svg></button>
          <button type="button" className="icon-btn" aria-label="Close quick look" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /></svg></button>
        </span>
      </div>
      <div className="m-peek-who">
        <span className="m-av lg" aria-hidden="true">{initials(m)}</span>
        <div><h2>{fullName(m)}</h2><p>{m.id} · {PLANS[m.plan].name} plan</p></div>
      </div>
      <p className="m-peek-status"><span className={`st ${ST_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
        <span className={`m-vote ${vote.eligible ? 'yes' : 'no'}`}><i aria-hidden="true">{vote.eligible ? '✓' : '–'}</i>{vote.eligible ? `Can vote in ${YEAR}` : `Cannot vote in ${YEAR}`}</span></p>
      {!vote.eligible && <p className="m-peek-why">{vote.summary}</p>}
      <dl className="m-peek-facts">
        <div><dt>Zone and center</dt><dd>{ZONES[m.zone]} · {centerOf(m)}</dd></div>
        <div><dt>{ren.paidThrough ? 'Paid through' : 'Last paid'}</dt><dd>{ren.paidThrough ? fmtDate(ren.paidThrough) : paid ? fmtDate(paid) : 'No payments yet'}</dd></div>
        <div><dt>Member since</dt><dd>{m.joined}</dd></div>
        {contact && <div><dt>Email</dt><dd><a href={`mailto:${m.email}`}>{m.email}</a></dd></div>}
        {contact && <div><dt>Mobile</dt><dd><a href={`tel:+1${digits(m.phone)}`}>{m.phone}</a></dd></div>}
      </dl>
      <div className="m-peek-actions">
        <Link className="btn primary" href={`/members/${m.id}`}>Open full profile</Link>
        {payable && <Link className="btn" href={`/members/${m.id}?do=payment`}>Record payment</Link>}
      </div>
      <p className="m-peek-hint">↑ ↓ to move · Esc to close</p>
    </aside>
  );
}

function ExportDialog({ count, hasAdminOnly, onClose, onExport }: { count: number; hasAdminOnly: boolean; onClose: () => void; onExport: (adminOnly: boolean) => void }) {
  const [adminOnly, setAdminOnly] = useState(false);
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  return (
    <dialog ref={open} className="modal glass-float" aria-label="Export to CSV" onClose={onClose} onCancel={onClose}>
      <form method="dialog" className="m-form" onSubmit={(e) => { e.preventDefault(); onExport(adminOnly); }}>
        <h2>Export to CSV</h2>
        <p>{count.toLocaleString('en-US')} member{count === 1 ? '' : 's'}. Includes contact details, plan, status, voting and the extra profile fields members can see. The file opens safely in Excel (no formulas run).</p>
        {hasAdminOnly && <label className="check"><input type="checkbox" checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} /> <span>Also include admin-only fields (sensitive – for example ID numbers). Keep the file private.</span></label>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">Download CSV</button></div>
      </form>
    </dialog>
  );
}
