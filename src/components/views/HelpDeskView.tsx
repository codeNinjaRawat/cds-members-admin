'use client';
/**
 * Work queues › Help desk – questions, requests, complaints and feedback from members, visitors and donors.
 * Research: memory/research/tickets-and-tasks.md. Rules: lib/community/work.ts. Settings: Settings › Help desk and tasks.
 *
 *  Inbox      saved views (Needs a reply, Mine, Unassigned, Due soon, Late, Waiting, Solved), search, category and masjid
 *             filters, bulk assign / status / priority / merge, j/k to move.
 *  Ticket     the conversation (public replies vs internal notes, saved replies with merge fields), two clocks
 *             (first reply, solve – paused while waiting on the requester), owner, watchers, tags, links, merge,
 *             ticket → team task, satisfaction.
 *  Dashboard  open by category, created vs solved, response times, targets met, satisfaction, oldest open.
 * DEMO: this browser (lib/work/work-store.ts). Live: /admin/tickets (BE/memory/api-contract-tickets.md).
 */
import { currentOrg } from '@/lib/access/masjid-filter';
import Link from 'next/link';
import { LIVE } from '@/lib/live/live';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { logAudit } from '@/lib/access/audit';
import { Tabs } from '@/components/editor/bits';
import { ChartCard, Columns, Donut, StatTile } from '@/components/charts/Charts';
import { useWork, type WorkApi } from '@/lib/work/work-store';
import { mockOrgStructure } from '@/lib/community/org-structure';
import {
  CHANNELS, PRIORITY_KEYS, PRIORITY_LABEL, TICKET_STATUS, activeClock, assign, fillReply, helpdeskStats, humanMinutes, isOpenTicket, merge, newTicket, nextTicketNumber,
  note as addNote, reply as addReply, requesterReply, setStatus, taskFromTicket, ticketClocks, unfilledFields, eventId,
  type Channel, type Clock, type Ticket, type TicketPriority, type TicketStatus,
} from '@/lib/community/work';

type View = 'needs' | 'mine' | 'unassigned' | 'soon' | 'late' | 'waiting' | 'all' | 'solved';
const VIEWS: { id: View; label: string }[] = [
  { id: 'needs', label: 'Needs a reply' }, { id: 'mine', label: 'Mine' }, { id: 'unassigned', label: 'Unassigned' }, { id: 'soon', label: 'Due soon' },
  { id: 'late', label: 'Late' }, { id: 'waiting', label: 'Waiting' }, { id: 'all', label: 'All open' }, { id: 'solved', label: 'Solved' },
];
export const when = (iso: string) => (iso ? new Date(`${iso.slice(0, 19)}`).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const initials = (n: string) => n.replace(/\(.*?\)/g, '').trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase() || '?';
export function clockText(c: Clock, what: string) {
  if (c.state === 'met') return `${what}: on time`;
  if (c.state === 'missed') return `${what}: missed`;
  if (c.state === 'paused') return `${what}: paused`;
  return c.minutesLeft < 0 ? `${what}: ${humanMinutes(c.minutesLeft)} late` : `${what}: ${humanMinutes(c.minutesLeft)} left`;
}

export function HelpDeskView() {
  const w = useWork();
  const mf = useMasjidFilter();
  const H = w.settings.helpdesk;
  const inFilter = (t: Ticket) => (t.center ? mf.keep(mf.zoneOf(t.center), t.center) : !mf.masjid && !mf.zone);
  const list = w.tickets.filter(inFilter);
  const s = helpdeskStats(list, H, w.now);
  return (
    <div className="page hd">
      <header className="page-head">
        <div>
          <h1>Help desk <span className="pill">{s.open} open</span>{s.late > 0 && <span className="pill bad" data-late-count>{s.late} late</span>}</h1>
          <p className="page-intro">Questions, requests, complaints and feedback from members, visitors and donors – each with an owner, a first-reply and a solve target, and a private thread for the team.{LIVE ? '' : ' Demo data in this browser.'}</p>
        </div>
        <div className="page-actions">
          {w.access.can('settings.manage') && <Link className="btn ghost" href="/settings/work">Categories and targets</Link>}
          <Link className="btn ghost" href="/tasks">Team tasks</Link>
          <NewTicketButton w={w} />
        </div>
      </header>
      {!H.enabled && <p className="glass-pane notice">The help desk is switched off in Settings › Help desk and tasks. Website forms send email only.</p>}
      <Tabs label="Help desk" tabs={[
        { id: 'inbox', label: 'Inbox', badge: s.open, render: () => <Inbox w={w} list={list} /> },
        { id: 'dashboard', label: 'Dashboard', render: () => <HelpDeskDashboard w={w} list={list} /> },
      ]} />
    </div>
  );
}

/* ================================ inbox ================================ */
function Inbox({ w, list }: { w: WorkApi; list: Ticket[] }) {
  const H = w.settings.helpdesk;
  const [view, setView] = useState<View>('needs');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<'urgent' | 'newest' | 'oldest'>('urgent');
  const [selId, setSelId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const clocks = useMemo(() => new Map(list.map((t) => [t.id, activeClock(t, H, w.now)])), [list, H, w.now]);
  const lateOrSoon = (t: Ticket, st: 'late' | 'soon') => { const c = ticketClocks(t, H, w.now); return c.first.state === st || c.solve.state === st; };
  const match: Record<View, (t: Ticket) => boolean> = {
    needs: (t) => isOpenTicket(t) && t.status !== 'waiting' && t.status !== 'hold' && (!t.firstResponseAt || lastIsRequester(t)),
    mine: (t) => isOpenTicket(t) && t.assignee === w.me.id,
    unassigned: (t) => isOpenTicket(t) && !t.assignee,
    soon: (t) => isOpenTicket(t) && lateOrSoon(t, 'soon') && !lateOrSoon(t, 'late'),
    late: (t) => isOpenTicket(t) && lateOrSoon(t, 'late'),
    waiting: (t) => isOpenTicket(t) && (t.status === 'waiting' || t.status === 'hold'),
    all: isOpenTicket,
    solved: (t) => !isOpenTicket(t),
  };
  const ql = q.trim().toLowerCase();
  const rows = list.filter((t) => match[view](t) && (!cat || t.categoryId === cat) && (!ql || `${t.id} ${t.subject} ${t.requester.name} ${t.requester.email} ${t.requester.memberId} ${t.tags.join(' ')}`.toLowerCase().includes(ql)))
    .sort((a, b) => sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt)
      : Number(isOpenTicket(b)) - Number(isOpenTicket(a)) || (clocks.get(a.id)!.minutesLeft - clocks.get(b.id)!.minutesLeft) || PRIORITY_KEYS.indexOf(a.priority) - PRIORITY_KEYS.indexOf(b.priority));
  const sel = list.find((t) => t.id === selId) ?? rows[0] ?? null;
  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, list.filter(match[v.id]).length])) as Record<View, number>;
  const listRef = useRef<HTMLUListElement>(null);
  const linked = useRef(false);
  useEffect(() => { // ?ticket=T-1041 opens that ticket (links from tasks, emails, the overview)
    if (linked.current || !list.length) return; linked.current = true;
    const id = new URLSearchParams(window.location.search).get('ticket'); const t = id ? list.find((x) => x.id === id) : null;
    if (t) { setView(isOpenTicket(t) ? 'all' : 'solved'); setSelId(t.id); }
  }, [list]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const i = rows.findIndex((t) => t.id === sel?.id); const n = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'j' ? 1 : -1)))];
      if (n) { setSelId(n.id); listRef.current?.querySelector<HTMLButtonElement>(`[data-ticket="${n.id}"]`)?.focus(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  const change = (ids: string[], f: (t: Ticket) => Ticket, audit: string) => { w.setTickets((all) => all.map((t) => (ids.includes(t.id) ? f(t) : t))); logAudit({ area: 'members', action: audit, detail: ids.join(', ') }); };
  const can = w.access.can('members.view');
  return (
    <div className="hd-inbox">
      <div className="hd-views glass-pane" role="group" aria-label="Views">
        {VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => { setView(v.id); setSelId(null); setPicked([]); }} data-view={v.id}>{v.label}<span className={v.id === 'late' && counts.late ? 'bad' : ''}>{counts[v.id]}</span></button>)}
      </div>
      <div className="wq hd-wq glass-pane">
        <section className="wq-list" aria-label="Tickets">
          <div className="hd-filters">
            <input className="in" type="search" aria-label="Search tickets" placeholder="Search name, email, ID, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="chip-row">
              <select className="in pill-select" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{H.categories.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <MasjidPicker className="chip-select" />
              <select className="in pill-select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="urgent">Most urgent first</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
            </div>
          </div>
          {picked.length > 0 && can && <BulkBar w={w} picked={picked} onDone={() => setPicked([])} change={change} />}
          {!rows.length ? <p className="wq-empty">{view === 'solved' ? 'Nothing solved here yet.' : 'All clear – nothing in this view.'}</p> : (
            <ul className="wq-items hd-items" ref={listRef}>{rows.map((t) => { const c = clocks.get(t.id)!; const cat2 = H.categories.find((x) => x.id === t.categoryId); return (
              <li key={t.id}>
                {can && <input type="checkbox" aria-label={`Select ${t.id}`} checked={picked.includes(t.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))} />}
                <button type="button" className={`wq-item hd-item${sel?.id === t.id ? ' on' : ''}`} data-ticket={t.id} onClick={() => setSelId(t.id)}>
                  <span className={`hd-pri p-${t.priority}`} title={PRIORITY_LABEL[t.priority]} aria-hidden="true" />
                  <span className="wq-item-txt"><b>{t.restricted && <span className="hd-lock" title="Restricted">🔒 </span>}{t.subject}</b><small>{t.requester.name || 'Unknown'} · {cat2?.label ?? t.categoryId} · {t.center || 'Organization'}</small></span>
                  <span className="wq-item-side">
                    {isOpenTicket(t) ? <span className={`hd-sla s-${c.state}`}>{c.state === 'paused' ? 'Waiting' : c.minutesLeft < 0 ? `${humanMinutes(c.minutesLeft)} late` : humanMinutes(c.minutesLeft)}</span> : <span className="wq-flag done">{t.mergedInto ? `Merged` : TICKET_STATUS[t.status]}</span>}
                    <span className="wq-who" title={w.nameOf(t.assignee)} aria-label={`Owner ${w.nameOf(t.assignee)}`}>{t.assignee ? initials(w.nameOf(t.assignee)) : '–'}</span>
                  </span>
                </button>
              </li>
            ); })}</ul>
          )}
          <p className="wq-keys"><kbd>j</kbd><kbd>k</kbd> next / previous · select several for bulk changes</p>
        </section>
        <section className="wq-case" aria-live="polite" aria-label="Ticket">
          {!sel ? <p className="wq-empty">Pick a ticket on the left.</p> : <TicketDetail key={sel.id} w={w} t={sel} />}
        </section>
      </div>
    </div>
  );
}
const lastIsRequester = (t: Ticket) => { const talk = t.events.filter((e) => ['reply', 'requester', 'created'].includes(e.kind)); return talk.at(-1)?.kind === 'requester'; };

function BulkBar({ w, picked, onDone, change }: { w: WorkApi; picked: string[]; onDone: () => void; change: (ids: string[], f: (t: Ticket) => Ticket, audit: string) => void }) {
  const at = w.now;
  return (
    <div className="wq-batch hd-bulk" role="group" aria-label="Bulk changes">
      <b>{picked.length} selected</b>
      <select className="in pill-select" aria-label="Assign selected" value="" onChange={(e) => { const id = e.target.value === '-' ? '' : e.target.value; change(picked, (t) => assign(t, id, w.nameOf(id), w.me, at), 'Tickets assigned'); onDone(); }}>
        <option value="">Assign to…</option><option value="-">Nobody</option>{w.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <select className="in pill-select" aria-label="Status of selected" value="" onChange={(e) => { const st = e.target.value as TicketStatus; change(picked, (t) => setStatus(t, st, w.me, at), `Tickets set to ${TICKET_STATUS[st]}`); onDone(); }}>
        <option value="">Status…</option>{(['open', 'waiting', 'hold', 'solved'] as TicketStatus[]).map((s) => <option key={s} value={s}>{TICKET_STATUS[s]}</option>)}
      </select>
      <select className="in pill-select" aria-label="Priority of selected" value="" onChange={(e) => { const p = e.target.value as TicketPriority; change(picked, (t) => ({ ...t, priority: p, events: [...t.events, { id: eventId(), at, by: w.me.name, kind: 'priority', text: `Priority: ${PRIORITY_LABEL[p]}` }] }), 'Ticket priority changed'); onDone(); }}>
        <option value="">Priority…</option>{PRIORITY_KEYS.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
      </select>
      {picked.length >= 2 && <button type="button" className="btn sm" onClick={() => {
        const [mainId, ...rest] = [...picked].sort();
        w.setTickets((all) => { let main = all.find((t) => t.id === mainId)!; const out = new Map(all.map((t) => [t.id, t])); rest.forEach((id) => { const [m, d] = merge(main, out.get(id)!, w.me, at); main = m; out.set(id, d); }); out.set(mainId, main); return all.map((t) => out.get(t.id)!); });
        logAudit({ area: 'members', action: 'Tickets merged', detail: `${rest.join(', ')} → ${mainId}` }); onDone();
      }}>Merge into the oldest</button>}
      <button type="button" className="btn sm ghost" onClick={onDone}>Clear</button>
    </div>
  );
}

/* ================================ one ticket ================================ */
function TicketDetail({ w, t }: { w: WorkApi; t: Ticket }) {
  const H = w.settings.helpdesk;
  const c = ticketClocks(t, H, w.now);
  const cat = H.categories.find((x) => x.id === t.categoryId);
  const can = w.access.can('members.view');
  const contact = w.access.can('members.contact');
  const update = (f: (x: Ticket) => Ticket) => w.setTickets((all) => all.map((x) => (x.id === t.id ? f(x) : x)));
  const others = w.allTickets.filter((x) => x.id !== t.id && ((t.requester.memberId && x.requester.memberId === t.requester.memberId) || (t.requester.email && x.requester.email === t.requester.email)));
  const late = isOpenTicket(t) && (c.first.state === 'late' || c.solve.state === 'late');
  const following = t.watchers.includes(w.me.id);
  return (
    <article className="hd-detail" data-open-ticket={t.id}>
      <div className="hd-main">
        <div className="hd-head">
          <span className="muted small">{t.id} · {CHANNELS[t.channel]} · {when(t.createdAt)}{t.restricted ? ' · Restricted' : ''}</span>
          <h2>{t.subject}</h2>
          <div className="hd-chips">
            <span className={`pill ${t.status === 'solved' || t.status === 'closed' ? 'good' : late ? 'bad' : ''}`} data-ticket-status={t.status}>{TICKET_STATUS[t.status]}</span>
            <span className={`hd-clock s-${c.first.state}`} data-clock="first" title={`Due ${when(c.first.due)}`}>{clockText(c.first, 'First reply')}</span>
            <span className={`hd-clock s-${c.solve.state}`} data-clock="solve" title={`Due ${when(c.solve.due)}`}>{clockText(c.solve, 'Solve')}</span>
            {t.mergedInto && <span className="pill">Merged into {t.mergedInto}</span>}
          </div>
          {late && cat?.escalateTo && <p className="hd-escalate" role="status">Late – {w.access.doc.roles.find((r) => r.id === cat.escalateTo)?.name ?? cat.escalateTo} has been told (escalation rule of “{cat.label}”).</p>}
        </div>
        <Thread t={t} />
        {can && !t.mergedInto && <Composer w={w} t={t} update={update} />}
      </div>
      <aside className="hd-side" aria-label="Ticket details">
        <section className="hd-card">
          <h3 className="wq-h3">Requester</h3>
          <p className="hd-req"><b>{t.requester.name || 'Unknown'}</b>
            {t.requester.memberId ? <Link href={`/members/${encodeURIComponent(t.requester.memberId)}`}>{t.requester.memberId}</Link> : <span className="muted small">Not a member record</span>}
            {contact ? <>{t.requester.email && <span>{t.requester.email}</span>}{t.requester.phone && <span>{t.requester.phone}</span>}</> : (t.requester.email || t.requester.phone) && <span className="muted small">Contact details need “See contact details”.</span>}
          </p>
          {others.length > 0 && <p className="small">{others.length} other ticket{others.length > 1 ? 's' : ''}: {others.slice(0, 4).map((o, i) => <span key={o.id}>{i ? ', ' : ''}{o.id} ({TICKET_STATUS[o.status]})</span>)}</p>}
        </section>
        <section className="hd-card hd-props">
          <label className="sf-field"><span className="sf-label">Status</span><select className="in" aria-label="Status" disabled={!can || !!t.mergedInto} value={t.status} onChange={(e) => update((x) => setStatus(x, e.target.value as TicketStatus, w.me, w.now))}>{(Object.keys(TICKET_STATUS) as TicketStatus[]).map((s) => <option key={s} value={s}>{TICKET_STATUS[s]}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Owner</span>
            <span className="hd-owner"><select className="in" aria-label="Owner" disabled={!can} value={t.assignee} onChange={(e) => update((x) => assign(x, e.target.value, w.nameOf(e.target.value), w.me, w.now))}><option value="">Unassigned</option>{w.admins.map((a) => <option key={a.id} value={a.id}>{a.name}{a.id === w.me.id ? ' (me)' : ''}</option>)}</select>
              {can && t.assignee !== w.me.id && isOpenTicket(t) && <button type="button" className="btn sm" onClick={() => update((x) => assign(x, w.me.id, w.me.name, w.me, w.now))}>Take it</button>}</span></label>
          <label className="sf-field"><span className="sf-label">Priority</span><select className="in" aria-label="Priority" disabled={!can} value={t.priority} onChange={(e) => { const p = e.target.value as TicketPriority; update((x) => ({ ...x, priority: p, events: [...x.events, { id: eventId(), at: w.now, by: w.me.name, kind: 'priority', text: `Priority: ${PRIORITY_LABEL[p]}` }] })); }}>{PRIORITY_KEYS.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]} – reply in {H.targets[p].firstResponseHours} h</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Category</span><select className="in" aria-label="Category of this ticket" disabled={!can} value={t.categoryId} onChange={(e) => { const id = e.target.value; update((x) => ({ ...x, categoryId: id, restricted: x.restricted || !!H.categories.find((k) => k.id === id)?.restricted, events: [...x.events, { id: eventId(), at: w.now, by: w.me.name, kind: 'category', text: `Category: ${H.categories.find((k) => k.id === id)?.label}` }] })); }}>{H.categories.filter((k) => !k.archived || k.id === t.categoryId).map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Masjid</span><select className="in" aria-label="Masjid of this ticket" disabled={!can || !!w.access.role?.centerScoped} value={t.center} onChange={(e) => update((x) => ({ ...x, center: e.target.value }))}><option value="">The organization</option>{w.access.doc && Array.from(new Set([t.center, ...centersFor(w)])).filter(Boolean).map((c2) => <option key={c2} value={c2}>{c2}</option>)}</select></label>
        </section>
        <section className="hd-card">
          <h3 className="wq-h3">Following <span className="pill">{t.watchers.length}</span></h3>
          <p className="small">{t.watchers.length ? t.watchers.map(w.nameOf).join(', ') : 'Nobody else yet.'}</p>
          {can && <button type="button" className="btn sm ghost" onClick={() => update((x) => ({ ...x, watchers: following ? x.watchers.filter((y) => y !== w.me.id) : [...x.watchers, w.me.id] }))}>{following ? 'Stop following' : 'Follow'}</button>}
          <h3 className="wq-h3 hd-gap">Tags</h3>
          <Tags tags={t.tags} disabled={!can} onChange={(tags) => update((x) => ({ ...x, tags }))} />
          {can && <div className="hd-switch"><label><input type="checkbox" checked={t.restricted} aria-label="Restricted" onChange={(e) => update((x) => ({ ...x, restricted: e.target.checked, events: [...x.events, { id: eventId(), at: w.now, by: w.me.name, kind: 'status', text: e.target.checked ? 'Marked restricted.' : 'No longer restricted.' }] }))} /> Restricted – only the people involved and senior roles see it</label></div>}
        </section>
        <section className="hd-card">
          <h3 className="wq-h3">Linked work</h3>
          {t.links.length ? <ul className="hd-links">{t.links.map((l) => <li key={l.kind + l.id}>{l.kind === 'task' ? <Link href={`/tasks?task=${encodeURIComponent(l.id)}`}>Task: {l.label}</Link> : <span>{l.kind}: {l.label}</span>}</li>)}</ul> : <p className="muted small">Nothing linked.</p>}
          {can && isOpenTicket(t) && <TaskFromTicket w={w} t={t} update={update} />}
          {can && isOpenTicket(t) && <MergeInto w={w} t={t} />}
        </section>
        {(t.csat || (H.satisfaction && t.status === 'solved')) && (
          <section className="hd-card">
            <h3 className="wq-h3">Satisfaction</h3>
            {t.csat ? <p className={`hd-csat ${t.csat.score}`}>{t.csat.score === 'good' ? 'Good' : 'Not good'}{t.csat.comment ? ` – “${t.csat.comment}”` : ''}</p>
              : <><p className="muted small">The survey went out with the solved message.</p><div className="row-actions"><button type="button" className="btn sm ghost" onClick={() => update((x) => ({ ...x, csat: { score: 'good', comment: '', at: w.now } }))}>Demo: rated Good</button><button type="button" className="btn sm ghost" onClick={() => update((x) => ({ ...x, csat: { score: 'bad', comment: 'Took too long.', at: w.now } }))}>Demo: rated Not good</button></div></>}
          </section>
        )}
      </aside>
    </article>
  );
}
export const centersFor = (w: WorkApi) => {
  return currentOrg().centers.filter((c) => c.active && w.access.inScope(c.zone, c.name)).map((c) => c.name);
};

function Thread({ t }: { t: Ticket }) {
  return (
    <ol className="hd-thread" aria-label="Conversation">
      {t.events.map((e) => {
        if (e.kind === 'created' || e.kind === 'requester') return <li key={e.id} className="hd-msg req"><div className="hd-meta"><b>{e.by}</b><span>{e.kind === 'created' ? 'wrote' : 'replied'} · {when(e.at)}</span></div><p>{e.text}</p></li>;
        if (e.kind === 'reply') return <li key={e.id} className="hd-msg agent"><div className="hd-meta"><b>{e.by}</b><span>replied to the requester · {when(e.at)}</span></div><p>{e.text}</p></li>;
        if (e.kind === 'note') return <li key={e.id} className="hd-msg note"><div className="hd-meta"><b>{e.by}</b><span>internal note · {when(e.at)}</span></div><p>{e.text}</p></li>;
        return <li key={e.id} className="hd-sys"><span>{e.text}</span> <small>{e.by} · {when(e.at)}</small></li>;
      })}
    </ol>
  );
}

function Composer({ w, t, update }: { w: WorkApi; t: Ticket; update: (f: (x: Ticket) => Ticket) => void }) {
  const H = w.settings.helpdesk;
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [text, setText] = useState('');
  const [after, setAfter] = useState<'' | TicketStatus>('');
  const replies = H.savedReplies.filter((r) => !r.categoryId || r.categoryId === t.categoryId);
  const missing = unfilledFields(text);
  const canReply = !!(t.requester.email || t.requester.phone || t.channel === 'portal');
  const send = (e: FormEvent) => {
    e.preventDefault(); const body = text.trim(); if (!body) return;
    if (mode === 'reply') update((x) => addReply(x, body, w.me, w.now, after || undefined));
    else update((x) => addNote(x, body, w.me, w.now, w.admins));
    logAudit({ area: 'members', action: mode === 'reply' ? 'Ticket reply sent' : 'Ticket note added', detail: t.id });
    setText(''); setAfter('');
  };
  return (
    <form className={`hd-composer m-${mode}`} onSubmit={send}>
      <div className="hd-modes" role="tablist" aria-label="Write">
        <button type="button" role="tab" aria-selected={mode === 'reply'} onClick={() => setMode('reply')}>Reply to requester</button>
        <button type="button" role="tab" aria-selected={mode === 'note'} onClick={() => setMode('note')}>Internal note</button>
        {mode === 'reply' && replies.length > 0 && <select className="in pill-select" aria-label="Saved reply" value="" onChange={(e) => { const r = replies.find((x) => x.id === e.target.value); if (r) setText(fillReply(r.body, t, { agent: w.me.name.replace(/\s*\(demo\)$/, ''), organization: 'ISGH' })); }}><option value="">Saved replies…</option>{replies.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select>}
      </div>
      <textarea className="in in-area" rows={4} aria-label={mode === 'reply' ? 'Reply text' : 'Note text'} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={mode === 'reply' ? `Write to ${t.requester.name || 'the requester'} – they get this by ${t.channel === 'portal' ? 'the member portal' : t.requester.email ? 'email' : 'text message'}.` : 'Only the team sees this. Mention someone with @name.'} />
      {mode === 'reply' && !canReply && <p className="sf-err">No email or phone on this ticket – call them and add a note instead.</p>}
      {missing.length > 0 && <p className="sf-err" role="alert">Fill these before sending: {missing.map((m) => `{{${m}}}`).join(', ')}</p>}
      <div className="row-actions">
        {mode === 'reply' && <select className="in pill-select" aria-label="Status after sending" value={after} onChange={(e) => setAfter(e.target.value as TicketStatus)}><option value="">Keep status</option><option value="waiting">…and wait for their answer</option><option value="solved">…and mark solved</option></select>}
        <button className="btn sm primary" disabled={!text.trim() || missing.length > 0 || (mode === 'reply' && !canReply)}>{mode === 'reply' ? 'Send reply' : 'Add note'}</button>
        {['waiting', 'solved'].includes(t.status) && <button type="button" className="btn sm ghost" onClick={() => update((x) => requesterReply(x, 'Thank you – here is the information you asked for.', w.now))}>Demo: requester answers</button>}
      </div>
    </form>
  );
}

function Tags({ tags, onChange, disabled }: { tags: string[]; onChange: (t: string[]) => void; disabled: boolean }) {
  const [v, setV] = useState('');
  return (
    <div className="hd-tags">
      {tags.map((g) => <span key={g} className="hd-tag">{g}{!disabled && <button type="button" aria-label={`Remove tag ${g}`} onClick={() => onChange(tags.filter((x) => x !== g))}>×</button>}</span>)}
      {!disabled && <form onSubmit={(e) => { e.preventDefault(); const x = v.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 30); if (x && !tags.includes(x)) onChange([...tags, x]); setV(''); }}><input className="in in-sm" aria-label="Add a tag" placeholder="Add tag" value={v} onChange={(e) => setV(e.target.value)} /></form>}
    </div>
  );
}

function TaskFromTicket({ w, t, update }: { w: WorkApi; t: Ticket; update: (f: (x: Ticket) => Ticket) => void }) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState(t.assignee || w.me.id);
  const [due, setDue] = useState(w.today);
  if (!open) return <button type="button" className="btn sm" onClick={() => setOpen(true)}>Create a team task</button>;
  return (
    <form className="hd-mini" onSubmit={(e) => { e.preventDefault(); const k = taskFromTicket(t, { owner, due, by: w.me, at: w.now }); w.setTasks((l) => [...l, k]); update((x) => ({ ...x, links: [...x.links, { kind: 'task', id: k.id, label: k.title }], events: [...x.events, { id: eventId(), at: w.now, by: w.me.name, kind: 'link', text: `Team task created for ${w.nameOf(owner)}.` }] })); logAudit({ area: 'members', action: 'Task from ticket', detail: t.id }); setOpen(false); }}>
      <label className="sf-field"><span className="sf-label">Task owner</span><select className="in" aria-label="Task owner" value={owner} onChange={(e) => setOwner(e.target.value)}>{w.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className="sf-field"><span className="sf-label">Due</span><input className="in" type="date" aria-label="Task due date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <div className="row-actions"><button className="btn sm primary">Create task</button><button type="button" className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

function MergeInto({ w, t }: { w: WorkApi; t: Ticket }) {
  const [to, setTo] = useState('');
  const options = w.tickets.filter((x) => x.id !== t.id && isOpenTicket(x));
  return (
    <div className="hd-mini">
      <label className="sf-field"><span className="sf-label">Duplicate? Merge into</span><select className="in" aria-label="Merge into" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Pick a ticket…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.id} – {o.subject}</option>)}</select></label>
      {to && <button type="button" className="btn sm" onClick={() => { w.setTickets((all) => { const main = all.find((x) => x.id === to)!; const [m, d] = merge(main, all.find((x) => x.id === t.id)!, w.me, w.now); return all.map((x) => (x.id === m.id ? m : x.id === d.id ? d : x)); }); logAudit({ area: 'members', action: 'Tickets merged', detail: `${t.id} → ${to}` }); }}>Merge {t.id} into {to}</button>}
    </div>
  );
}

/* ================================ new ticket ================================ */
export function NewTicketButton({ w }: { w: WorkApi }) {
  const [open, setOpen] = useState(false);
  if (!w.access.can('members.view')) return null;
  return <><button type="button" className="btn primary" onClick={() => setOpen(true)}>New ticket</button>{open && <NewTicket w={w} onClose={() => setOpen(false)} />}</>;
}
function NewTicket({ w, onClose }: { w: WorkApi; onClose: () => void }) {
  const H = w.settings.helpdesk;
  const locked = w.access.role?.centerScoped && w.access.me?.centers.length === 1 ? w.access.me.centers[0] : '';
  const cats = H.categories.filter((c) => !c.archived);
  const [f, setF] = useState({ channel: 'phone' as Channel, categoryId: cats[0]?.id ?? '', center: locked, name: '', email: '', phone: '', memberId: '', subject: '', detail: '', priority: '' as '' | TicketPriority, owner: 'auto' });
  const preview = newTicket({ id: 'x', subject: 'x', detail: 'x', categoryId: f.categoryId, channel: f.channel, requester: { name: '', email: '', phone: '', memberId: '' }, center: f.center, createdBy: w.me, at: w.now }, H, w.admins as never);
  const openDlg = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const ok = f.subject.trim().length >= 4 && f.detail.trim().length >= 3 && f.name.trim().length >= 2;
  const submit = (e: FormEvent) => {
    e.preventDefault(); if (!ok) return;
    w.setTickets((all) => {
      const t = newTicket({ id: nextTicketNumber(all), subject: f.subject.trim(), detail: f.detail.trim(), categoryId: f.categoryId, channel: f.channel, requester: { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), memberId: f.memberId.trim().toUpperCase() }, center: f.center, priority: f.priority || undefined, assignee: f.owner === 'auto' ? undefined : f.owner === '-' ? '' : f.owner, createdBy: w.me, at: w.now }, H, w.admins as never);
      logAudit({ area: 'members', action: 'Ticket created', detail: `${t.id}: ${t.subject}` });
      return [t, ...all];
    });
    onClose();
  };
  return (
    <dialog ref={openDlg} className="modal glass-float hd-new" aria-label="New ticket" onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={submit}>
        <h2>New ticket</h2>
        <p className="muted small">For a call, a visit or an email someone sent you. Website and portal forms create tickets by themselves.</p>
        <div className="field-row three">
          <label className="sf-field"><span className="sf-label">How it came in</span><select className="in" aria-label="Channel" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as Channel })}>{(['phone', 'walk-in', 'email', 'staff'] as Channel[]).map((c) => <option key={c} value={c}>{CHANNELS[c]}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Category</span><select className="in" aria-label="Ticket category" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Masjid</span><select className="in" aria-label="Ticket masjid" value={f.center} disabled={!!locked} onChange={(e) => setF({ ...f, center: e.target.value })}>{!locked && <option value="">The organization</option>}{centersFor(w).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        </div>
        <div className="field-row three">
          <label className="sf-field"><span className="sf-label">Their name</span><input className="in" aria-label="Requester name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="sf-field"><span className="sf-label">Email</span><input className="in" type="email" aria-label="Requester email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="sf-field"><span className="sf-label">Phone</span><input className="in" aria-label="Requester phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        </div>
        <label className="sf-field"><span className="sf-label">Title</span><input className="in" aria-label="Ticket title" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
        <label className="sf-field"><span className="sf-label">What they said</span><textarea className="in in-area" rows={3} aria-label="Ticket details" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></label>
        <div className="field-row three">
          <label className="sf-field"><span className="sf-label">Member ID (optional)</span><input className="in" aria-label="Ticket member ID" placeholder="HOU-204781" value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })} /></label>
          <label className="sf-field"><span className="sf-label">Priority</span><select className="in" aria-label="Ticket priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as TicketPriority })}><option value="">From the category ({PRIORITY_LABEL[preview.priority]})</option>{PRIORITY_KEYS.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Owner</span><select className="in" aria-label="Ticket owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}><option value="auto">Automatic – {preview.assignee ? w.nameOf(preview.assignee) : 'Unassigned'}</option><option value="-">Unassigned</option>{w.admins.map((a) => <option key={a.id} value={a.id}>{a.name}{a.id === w.me.id ? ' (me)' : ''}</option>)}</select></label>
        </div>
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ok}>Create ticket</button></div>
      </form>
    </dialog>
  );
}

/* ================================ dashboard ================================ */
function HelpDeskDashboard({ w, list }: { w: WorkApi; list: Ticket[] }) {
  const H = w.settings.helpdesk;
  const s = helpdeskStats(list, H, w.now);
  const weeks = Array.from({ length: 8 }, (_, i) => { const end = new Date(Date.parse(`${w.today}T12:00:00Z`) - (7 - i) * 7 * 86_400_000); const start = new Date(end.getTime() - 7 * 86_400_000); return { label: `${end.getUTCMonth() + 1}/${end.getUTCDate()}`, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }; });
  weeks[7].end = '9999';
  const created = weeks.map((x) => list.filter((t) => t.createdAt.slice(0, 10) > x.start && t.createdAt.slice(0, 10) <= x.end).length);
  const solved = weeks.map((x) => list.filter((t) => t.solvedAt && t.solvedAt.slice(0, 10) > x.start && t.solvedAt.slice(0, 10) <= x.end).length);
  const oldest = list.filter(isOpenTicket).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 6);
  const byMasjid = Array.from(new Set(list.filter(isOpenTicket).map((t) => t.center || 'Organization'))).map((m) => ({ label: m.replace(' Islamic Center', ''), value: list.filter((t) => isOpenTicket(t) && (t.center || 'Organization') === m).length })).sort((a, b) => b.value - a.value);
  const byOwner = w.admins.map((a) => ({ id: a.id, label: a.name, value: list.filter((t) => isOpenTicket(t) && t.assignee === a.id).length })).filter((x) => x.value).sort((a, b) => b.value - a.value);
  return (
    <div className="mo-grid hd-dash">
      <div className="viz-tiles">
        <StatTile id="hd-open" label="Open" value={String(s.open)} note={`${s.unassigned} unassigned · ${s.waiting} waiting`} />
        <StatTile id="hd-late" label="Late" value={String(s.late)} note={`${s.soon} due soon`} tone={s.late ? 'down' : undefined} />
        <StatTile id="hd-first" label="First reply (median)" value={humanMinutes(s.medianFirstResponseMin)} note={H.clock === 'business' ? 'working hours' : 'calendar hours'} />
        <StatTile id="hd-solve" label="Time to solve (median)" value={humanMinutes(s.medianSolveMin)} note="solved tickets" />
        <StatTile id="hd-met" label="Solve targets met" value={`${s.targetsMetPct}%`} meter={{ value: s.targetsMetPct, of: 100 }} />
        <StatTile id="hd-csat" label="Satisfaction" value={s.rated ? `${s.satisfactionPct}%` : '–'} note={`${s.rated} rating${s.rated === 1 ? '' : 's'}`} />
      </div>
      <ChartCard id="hd-cat" title="Open tickets by category" note="Where the questions come from" table={{ head: ['Category', 'Open', 'All'], rows: s.byCategory.map((c) => [c.label, c.open, c.all]) }}>
        <Donut label="Open tickets by category" centerLabel="open" items={s.byCategory.filter((c) => c.open).map((c) => ({ id: c.id, label: c.label, value: c.open }))} />
      </ChartCard>
      <ChartCard id="hd-weeks" title="Created per week" note={`${created.reduce((a, b) => a + b, 0)} created · ${solved.reduce((a, b) => a + b, 0)} solved in 8 weeks`} table={{ head: ['Week ending', 'Created', 'Solved'], rows: weeks.map((x, i) => [x.label, created[i], solved[i]]) }}>
        <Columns label="Tickets created per week" items={weeks.map((x, i) => ({ label: x.label, value: created[i] }))} />
      </ChartCard>
      <ChartCard id="hd-masjid" title="Open by masjid" table={{ head: ['Masjid', 'Open'], rows: byMasjid.map((x) => [x.label, x.value]) }}>
        <Columns label="Open tickets by masjid" ramp={false} items={byMasjid} />
      </ChartCard>
      <section className="viz-card glass-pane" aria-labelledby="hd-old-h">
        <header className="viz-head"><h2 id="hd-old-h">Oldest open tickets</h2><p>Who has waited longest</p></header>
        <ul className="hd-oldest">{oldest.map((t) => <li key={t.id}><b>{t.id}</b> {t.subject}<small>{w.nameOf(t.assignee)} · since {when(t.createdAt)}</small></li>)}</ul>
        {byOwner.length > 0 && <><h3 className="wq-h3 hd-gap">Open per owner</h3><ul className="hd-oldest">{byOwner.map((o) => <li key={o.id}><b>{o.value}</b> {o.label}</li>)}</ul></>}
      </section>
    </div>
  );
}
