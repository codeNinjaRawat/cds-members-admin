'use client';
/**
 * "My work" on every home page (organization, masjid and zone dashboards): my tasks that are overdue, due today or
 * this week (tick them off here), and help-desk tickets that wait on me. Replaces the fixed demo "Today’s tasks".
 */
import Link from 'next/link';
import { useWork } from '@/lib/work/work-store';
import { activeClock, bucketOf, completeTask, humanMinutes, isOpenTicket, type AdminLike } from '@/lib/community/work';
import { allCases, useQueueState } from './QueuesView';
import { assigneeOf, daysWaiting, isOpen, QUEUES, sla } from '@/lib/queues/queues';

export function MyWorkCard({ limit = 6 }: { limit?: number }) {
  const w = useWork();
  const qs = useQueueState();
  if (!w.ready) return <section className="d-card glass-pane" aria-labelledby="mw-h"><div className="d-head"><h2 id="mw-h">My work</h2></div><p className="muted small">Loading…</p></section>;
  const tasks = w.tasks.filter((t) => t.status !== 'done' && !t.parentId && (t.owner === w.me.id || t.helpers.includes(w.me.id)) && ['overdue', 'today', 'week'].includes(bucketOf(t, w.today)))
    .sort((a, b) => a.due.localeCompare(b.due)).slice(0, limit);
  const tickets = w.tickets.filter((t) => isOpenTicket(t) && t.status !== 'waiting' && (t.assignee === w.me.id || (!t.assignee && w.viewer.orgWide)))
    .map((t) => ({ t, c: activeClock(t, w.settings.helpdesk, w.now) })).sort((a, b) => a.c.minutesLeft - b.c.minutesLeft).slice(0, 4);
  const overdue = tasks.filter((t) => bucketOf(t, w.today) === 'overdue').length;
  // D5 – system queue cases on my desk (taken by me, or routed to me by the queue's rule)
  const admins = w.admins as unknown as AdminLike[];
  const desk = allCases().filter((c) => isOpen(c, qs) && assigneeOf(c, qs, w.settings.queues, admins).id === w.me.id).map((c) => ({ c, t: sla(c) })).sort((a, b) => daysWaiting(b.c) - daysWaiting(a.c));
  const deskLate = desk.filter((x) => x.t.tone === 'late').length;
  const fmt = (d: string) => (d === w.today ? 'Today' : new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
  return (
    <section className="d-card glass-pane mw" aria-labelledby="mw-h" data-mywork>
      <div className="d-head"><h2 id="mw-h">My work <small>{desk.length} case{desk.length === 1 ? '' : 's'}{deskLate ? ` · ${deskLate} late` : ''} · {tasks.length} task{tasks.length === 1 ? '' : 's'}{overdue ? ` · ${overdue} overdue` : ''} · {tickets.length} ticket{tickets.length === 1 ? '' : 's'}</small></h2></div>
      <p className="mw-h">On your desk – queue cases</p>
      {desk.length ? <ul className="mw-list">{desk.slice(0, limit).map(({ c, t }) => (
        <li key={c.id} data-mw-case={c.id}>
          <span className={`hd-pri p-${t.tone === 'late' ? 'urgent' : t.tone === 'due' ? 'high' : 'normal'}`} aria-hidden="true" />
          <Link className="tt" href={`/queues?tab=${c.queue}`}><b>{QUEUES.find((q) => q.id === c.queue)?.label}</b><small>{c.memberId} · waiting {t.days} day{t.days === 1 ? '' : 's'}</small></Link>
          <span className={`wq-age ${t.tone}`}>{t.tone === 'late' ? `${t.days - t.target} d late` : `${Math.max(0, t.target - t.days)} d left`}</span>
        </li>
      ))}</ul> : <p className="muted small">Nothing routed to you. Alhamdulillah.</p>}
      <p className="mw-h">Tasks due this week</p>
      {tasks.length ? <ul className="mw-list">{tasks.map((t) => (
        <li key={t.id} data-mw-task={t.id}>
          <input type="checkbox" aria-label={`Done: ${t.title}`} onChange={() => w.setTasks((l) => completeTask(l, t.id, w.me, w.now))} />
          <Link className="tt" href={`/tasks?task=${encodeURIComponent(t.id)}`}><b>{t.title}</b><small>{w.projects.find((p) => p.id === t.projectId)?.name ?? 'No project'}{t.repeat ? ' · repeats' : ''}</small></Link>
          <span className={`tk-due b-${bucketOf(t, w.today)}`}>{fmt(t.due)}</span>
        </li>
      ))}</ul> : <p className="muted small">Nothing due this week.</p>}
      <p className="mw-h">Help desk – waiting on you</p>
      {tickets.length ? <ul className="mw-list">{tickets.map(({ t, c }) => (
        <li key={t.id} data-mw-ticket={t.id}>
          <span className={`hd-pri p-${t.priority}`} aria-hidden="true" />
          <Link className="tt" href={`/queues/tickets?ticket=${encodeURIComponent(t.id)}`}><b>{t.subject}</b><small>{t.id} · {t.requester.name}{t.assignee ? '' : ' · unassigned'}</small></Link>
          <span className={`hd-sla s-${c.state}`}>{c.minutesLeft < 0 ? `${humanMinutes(c.minutesLeft)} late` : humanMinutes(c.minutesLeft)}</span>
        </li>
      ))}</ul> : <p className="muted small">No tickets waiting on you.</p>}
      <div className="mw-links"><Link className="btn sm" href="/tasks">All my tasks</Link><Link className="btn sm ghost" href="/queues/tickets">Help desk</Link></div>
    </section>
  );
}
