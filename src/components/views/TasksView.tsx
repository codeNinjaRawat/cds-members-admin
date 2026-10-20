'use client';
/**
 * Work queues › Team tasks – the team's own work (research: memory/research/tickets-and-tasks.md).
 *   My work   overdue · today · next 7 days · later · no date – across every project
 *   Board     To do / Doing / Waiting / Done (drag a card, or use its Move menu – works with the keyboard too)
 *   List      grouped by project, with owner, due date, checklist progress
 *   Calendar  month view by due date
 *   Projects  progress, overdue, at risk; new project from scratch or from a template (dates from an anchor day)
 * A task: owner + helpers, dates, priority, labels, checklist, sub-tasks, repeat (weekly / monthly / yearly – the next
 * one appears when it is done), links (a help-desk ticket), comments with @mentions.
 * DEMO: this browser (lib/work/work-store.ts). Live: /admin/tasks, /admin/projects (BE/memory/api-contract-tickets.md).
 */
import Link from 'next/link';
import { LIVE } from '@/lib/live/live';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Tabs } from '@/components/editor/bits';
import { ChartCard, Columns, StatTile } from '@/components/charts/Charts';
import { logAudit } from '@/lib/access/audit';
import { useWork, type WorkApi } from '@/lib/work/work-store';
import { centersFor } from './HelpDeskView';
import {
  BUCKET_LABEL, PRIORITY_KEYS, PRIORITY_LABEL, TASK_STATUS_KEYS, bucketOf, completeTask, mentionsIn, newId, nextDue, projectFromTemplate, projectProgress, reopenTask, workload,
  type Bucket, type Project, type Task, type TaskStatus, type TicketPriority,
} from '@/lib/community/work';

const fmt = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');
const initials = (n: string) => n.replace(/\(.*?\)/g, '').trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase() || '?';
const COLORS: Project['color'][] = ['green', 'blue', 'amber', 'red', 'violet', 'gray'];

type Filters = { project: string; owner: string; label: string; q: string; done: boolean };

export function TasksView() {
  const w = useWork();
  const [f, setF] = useState<Filters>({ project: '', owner: '', label: '', q: '', done: false });
  const [open, setOpen] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<null | Partial<Task>>(null);
  const [newProject, setNewProject] = useState(false);
  useEffect(() => { const t = new URLSearchParams(window.location.search).get('task'); if (t) setOpen(t); }, []);
  const ql = f.q.trim().toLowerCase();
  const tasks = w.tasks.filter((t) => !t.parentId && (!f.project || (f.project === '~none' ? !t.projectId : t.projectId === f.project)) && (!f.owner || (f.owner === '~me' ? t.owner === w.me.id || t.helpers.includes(w.me.id) : t.owner === f.owner)) && (!f.label || t.labels.includes(f.label)) && (!ql || `${t.title} ${t.notes}`.toLowerCase().includes(ql)));
  const shown = tasks.filter((t) => f.done || t.status !== 'done');
  const mine = w.tasks.filter((t) => t.status !== 'done' && (t.owner === w.me.id || t.helpers.includes(w.me.id)));
  const overdue = mine.filter((t) => bucketOf(t, w.today) === 'overdue').length;
  const sel = open ? w.allTasks.find((t) => t.id === open) ?? null : null;
  const ctx = { w, open: setOpen };
  return (
    <div className="page tk2">
      <header className="page-head">
        <div>
          <h1>Team tasks <span className="pill">{mine.length} mine</span>{overdue > 0 && <span className="pill bad">{overdue} overdue</span>}</h1>
          <p className="page-intro">The team’s own work – projects, owners, due dates, checklists and recurring jobs. Questions from members live in the <Link href="/queues/tickets">Help desk</Link>.{LIVE ? '' : ' Demo data in this browser.'}</p>
        </div>
        <div className="page-actions">
          {w.access.can('settings.manage') && <Link className="btn ghost" href="/settings/work?tab=tasks">Templates and labels</Link>}
          <button type="button" className="btn ghost" onClick={() => setNewProject(true)}>New project</button>
          <button type="button" className="btn primary" onClick={() => setNewTask({ projectId: f.project && f.project !== '~none' ? f.project : '' })}>New task</button>
        </div>
      </header>
      <div className="tk-bar glass-pane" role="toolbar" aria-label="Task filters">
        <input className="in" type="search" aria-label="Search tasks" placeholder="Search tasks…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className="in pill-select" aria-label="Project" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}><option value="">All projects</option><option value="~none">No project</option>{w.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="in pill-select" aria-label="Owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}><option value="">Everyone</option><option value="~me">Me</option>{w.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select className="in pill-select" aria-label="Label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })}><option value="">All labels</option>{w.settings.tasks.labels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
        <label className="tk-done"><input type="checkbox" checked={f.done} onChange={(e) => setF({ ...f, done: e.target.checked })} /> Show done</label>
      </div>
      <Tabs label="Task views" tabs={[
        { id: 'mine', label: 'My work', badge: mine.length, render: () => <MyWork ctx={ctx} /> },
        { id: 'board', label: 'Board', render: () => <Board ctx={ctx} tasks={tasks} showDone /> },
        { id: 'list', label: 'List', render: () => <ListView ctx={ctx} tasks={shown} /> },
        { id: 'calendar', label: 'Calendar', render: () => <Calendar ctx={ctx} tasks={shown} /> },
        { id: 'projects', label: 'Projects', badge: w.projects.filter((p) => !p.archived).length, render: () => <Projects ctx={ctx} pick={(id) => setF({ ...f, project: id })} onNew={() => setNewProject(true)} /> },
        { id: 'dashboard', label: 'Dashboard', render: () => <TasksDashboard w={w} /> },
      ]} />
      {sel && <TaskDrawer w={w} t={sel} onClose={() => { setOpen(null); const u = new URL(window.location.href); if (u.searchParams.has('task')) { u.searchParams.delete('task'); window.history.replaceState(null, '', u); } }} open={setOpen} />}
      {newTask && <NewTask w={w} init={newTask} onClose={() => setNewTask(null)} onCreated={(id) => { setNewTask(null); setOpen(id); }} />}
      {newProject && <NewProject w={w} onClose={() => setNewProject(false)} onCreated={(id) => { setNewProject(false); setF({ ...f, project: id }); }} />}
    </div>
  );
}
type Ctx = { w: WorkApi; open: (id: string) => void };

/* ---------------- shared bits ---------------- */
function Due({ t, today }: { t: Task; today: string }) {
  if (!t.due) return null;
  const b = bucketOf(t, today);
  return <span className={`tk-due b-${b}`}>{b === 'today' ? 'Today' : fmt(t.due)}{t.repeat ? ' ↻' : ''}</span>;
}
function TaskRow({ ctx, t }: { ctx: Ctx; t: Task }) {
  const { w } = ctx;
  const pr = w.projects.find((p) => p.id === t.projectId);
  const done = t.checklist.filter((c) => c.done).length;
  const subs = w.allTasks.filter((x) => x.parentId === t.id);
  return (
    <li className={`tk-row${t.status === 'done' ? ' is-done' : ''}`} data-task={t.id}>
      <input type="checkbox" aria-label={`Done: ${t.title}`} checked={t.status === 'done'} onChange={() => { w.setTasks((l) => (t.status === 'done' ? reopenTask(l, t.id) : completeTask(l, t.id, w.me, w.now))); if (t.status !== 'done') logAudit({ area: 'members', action: 'Task done', detail: t.title }); }} />
      <button type="button" className="tk-row-main" onClick={() => ctx.open(t.id)}>
        <b>{t.title}</b>
        <small>{pr ? <span className={`tk-dot c-${pr.color}`} aria-hidden="true" /> : null}{pr?.name ?? 'No project'}{t.checklist.length ? ` · ${done}/${t.checklist.length}` : ''}{subs.length ? ` · ${subs.filter((s) => s.status === 'done').length}/${subs.length} sub-tasks` : ''}{t.links.some((l) => l.kind === 'ticket') ? ' · from a ticket' : ''}</small>
      </button>
      <span className="tk-row-side">{t.priority === 'urgent' || t.priority === 'high' ? <span className={`hd-pri p-${t.priority}`} title={PRIORITY_LABEL[t.priority]} /> : null}<Due t={t} today={w.today} /><span className="wq-who" title={w.nameOf(t.owner)}>{initials(w.nameOf(t.owner))}</span></span>
    </li>
  );
}

/* ---------------- My work ---------------- */
function MyWork({ ctx }: { ctx: Ctx }) {
  const { w } = ctx;
  const mine = w.tasks.filter((t) => t.owner === w.me.id || t.helpers.includes(w.me.id));
  const order: Bucket[] = ['overdue', 'today', 'week', 'later', 'nodate'];
  const doneWeek = mine.filter((t) => t.status === 'done' && t.doneAt.slice(0, 10) >= new Date(Date.parse(`${w.today}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)).length;
  const tickets = w.tickets.filter((t) => t.assignee === w.me.id && !['solved', 'closed'].includes(t.status) && !t.mergedInto).length;
  const asked = w.tasks.filter((t) => t.status !== 'done' && t.createdBy === w.me.name && t.owner !== w.me.id && !t.parentId).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  return (
    <div className="tk-mine">
      <div className="tk-mine-cols">
        {order.map((b) => { const list = mine.filter((t) => bucketOf(t, w.today) === b).sort((a, c) => (a.due || '9').localeCompare(c.due || '9')); return (
          <section key={b} className={`tk-bucket glass-pane b-${b}`} aria-labelledby={`bk-${b}`} data-bucket={b}>
            <h2 id={`bk-${b}`}>{BUCKET_LABEL[b]} <span className="pill">{list.length}</span></h2>
            {list.length ? <ul className="tk-rows">{list.map((t) => <TaskRow key={t.id} ctx={ctx} t={t} />)}</ul> : <p className="muted small">{b === 'overdue' ? 'Nothing overdue.' : 'Nothing here.'}</p>}
          </section>
        ); })}
      </div>
      {asked.length > 0 && <section className="tk-bucket glass-pane tk-asked" aria-labelledby="bk-asked" data-bucket="asked">
        <h2 id="bk-asked">I asked others <span className="pill">{asked.length}</span></h2>
        <ul className="tk-rows">{asked.map((t) => <TaskRow key={t.id} ctx={ctx} t={t} />)}</ul>
      </section>}
      <p className="muted small tk-foot">{doneWeek} done in the last 7 days · {tickets} help-desk ticket{tickets === 1 ? '' : 's'} assigned to you – <Link href="/queues/tickets">open the Help desk</Link></p>
    </div>
  );
}

/* ---------------- Board ---------------- */
function Board({ ctx, tasks, showDone }: { ctx: Ctx; tasks: Task[]; showDone: boolean }) {
  const { w } = ctx;
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const L = w.settings.tasks.statusLabels;
  const move = (id: string, st: TaskStatus) => {
    const t = w.allTasks.find((x) => x.id === id); if (!t || t.status === st) return;
    w.setTasks((l) => (st === 'done' ? completeTask(l, id, w.me, w.now) : t.status === 'done' ? reopenTask(l, id).map((x) => (x.id === id ? { ...x, status: st } : x)) : l.map((x) => (x.id === id ? { ...x, status: st, comments: [...x.comments, { at: w.now, by: w.me.name, text: `Moved to ${L[st]}.` }] } : x))));
  };
  return (
    <div className="tk-board">
      {TASK_STATUS_KEYS.filter((s) => showDone || s !== 'done').map((s) => { const col = tasks.filter((t) => t.status === s).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, s === 'done' ? 12 : 200); return (
        <section key={s} className={`tk-col glass-pane${over === s ? ' over' : ''}`} aria-labelledby={`col-${s}`} data-col={s}
          onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); if (drag) move(drag, s); setDrag(null); setOver(null); }}>
          <h2 id={`col-${s}`}>{L[s]} <span className="pill">{tasks.filter((t) => t.status === s).length}</span></h2>
          <ul className="tk-cards">{col.map((t) => { const pr = w.projects.find((p) => p.id === t.projectId); const done = t.checklist.filter((c) => c.done).length; return (
            <li key={t.id} className="tk-card" draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} data-card={t.id}>
              <button type="button" className="tk-card-main" onClick={() => ctx.open(t.id)}>
                {pr && <span className={`tk-proj c-${pr.color}`}>{pr.name}</span>}
                <b>{t.title}</b>
                <span className="tk-card-meta">{t.labels.map((l) => { const lb = w.settings.tasks.labels.find((x) => x.id === l); return lb ? <span key={l} className={`tk-label c-${lb.color}`}>{lb.label}</span> : null; })}{t.checklist.length > 0 && <span className="tk-check">☑ {done}/{t.checklist.length}</span>}</span>
              </button>
              <div className="tk-card-foot"><Due t={t} today={w.today} /><span className="wq-who" title={w.nameOf(t.owner)}>{initials(w.nameOf(t.owner))}</span>
                <select className="in in-sm tk-move" aria-label={`Move ${t.title}`} value={t.status} onChange={(e) => move(t.id, e.target.value as TaskStatus)}>{TASK_STATUS_KEYS.map((k) => <option key={k} value={k}>{L[k]}</option>)}</select></div>
            </li>
          ); })}</ul>
          {s !== 'done' && <QuickAdd w={w} status={s} />}
        </section>
      ); })}
    </div>
  );
}
function QuickAdd({ w, status }: { w: WorkApi; status: TaskStatus }) {
  const [v, setV] = useState('');
  return (
    <form className="tk-quick" onSubmit={(e) => { e.preventDefault(); if (v.trim().length < 2) return; w.setTasks((l) => [...l, blankTask(w, { title: v.trim(), status })]); setV(''); }}>
      <input className="in in-sm" aria-label={`Add a task to ${w.settings.tasks.statusLabels[status]}`} placeholder="+ Add a task" value={v} onChange={(e) => setV(e.target.value)} />
    </form>
  );
}
const blankTask = (w: WorkApi, p: Partial<Task>): Task => ({ id: newId('task'), projectId: '', parentId: '', title: '', notes: '', owner: w.me.id, helpers: [], status: 'todo', priority: 'normal', start: '', due: '', labels: [], checklist: [], repeat: null, links: [], comments: [], createdAt: w.now, createdBy: w.me.name, doneAt: '', order: 0, ...p });

/* ---------------- List ---------------- */
function ListView({ ctx, tasks }: { ctx: Ctx; tasks: Task[] }) {
  const { w } = ctx;
  const groups = [...w.projects.filter((p) => !p.archived).map((p) => ({ id: p.id, name: p.name, color: p.color })), { id: '', name: 'No project', color: 'gray' as const }]
    .map((g) => ({ ...g, items: tasks.filter((t) => t.projectId === g.id).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.due || '9').localeCompare(b.due || '9')) })).filter((g) => g.items.length);
  if (!groups.length) return <p className="glass-pane notice">No tasks match these filters.</p>;
  return (
    <div className="tk-list">
      {groups.map((g) => (
        <section key={g.id || 'none'} className="glass-pane tk-group" aria-labelledby={`g-${g.id || 'none'}`}>
          <h2 id={`g-${g.id || 'none'}`}><span className={`tk-dot c-${g.color}`} aria-hidden="true" />{g.name} <span className="pill">{g.items.length}</span></h2>
          <ul className="tk-rows">{g.items.map((t) => <TaskRow key={t.id} ctx={ctx} t={t} />)}</ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------- Calendar ---------------- */
function Calendar({ ctx, tasks }: { ctx: Ctx; tasks: Task[] }) {
  const { w } = ctx;
  const [month, setMonth] = useState(w.today.slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)); const startDow = first.getUTCDay(); const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((startDow + days) / 7) * 7 }, (_, i) => { const d = i - startDow + 1; return d >= 1 && d <= days ? `${month}-${String(d).padStart(2, '0')}` : ''; });
  const go = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const noDate = tasks.filter((t) => !t.due && t.status !== 'done').length;
  return (
    <div className="tk-cal glass-pane">
      <div className="tk-cal-head"><button type="button" className="btn sm ghost" aria-label="Previous month" onClick={() => go(-1)}>‹</button><h2>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><button type="button" className="btn sm ghost" aria-label="Next month" onClick={() => go(1)}>›</button><button type="button" className="btn sm ghost" onClick={() => setMonth(w.today.slice(0, 7))}>Today</button></div>
      <div className="tk-cal-grid" role="grid" aria-label="Tasks by due date">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="tk-cal-dow" role="columnheader">{d}</div>)}
        {cells.map((d, i) => { const items = d ? tasks.filter((t) => t.due === d) : []; return (
          <div key={i} className={`tk-cal-cell${!d ? ' off' : ''}${d === w.today ? ' today' : ''}`} role="gridcell" data-day={d || undefined}>
            {d && <span className="tk-cal-n">{Number(d.slice(8))}</span>}
            {items.slice(0, 3).map((t) => <button key={t.id} type="button" className={`tk-cal-item${t.status === 'done' ? ' done' : ''} b-${bucketOf(t, w.today)}`} onClick={() => ctx.open(t.id)} title={t.title}>{t.title}</button>)}
            {items.length > 3 && <small>+{items.length - 3} more</small>}
          </div>
        ); })}
      </div>
      {noDate > 0 && <p className="muted small">{noDate} open task{noDate > 1 ? 's have' : ' has'} no due date (see My work › No date).</p>}
    </div>
  );
}

/* ---------------- Projects ---------------- */
function Projects({ ctx, pick, onNew }: { ctx: Ctx; pick: (id: string) => void; onNew: () => void }) {
  const { w } = ctx;
  const live = w.projects.filter((p) => !p.archived);
  return (
    <div className="tk-projects">
      {live.map((p) => { const pg = projectProgress(p, w.allTasks, w.today); return (
        <article key={p.id} className={`tk-project glass-pane c-${p.color}`} data-project={p.id}>
          <header><span className={`tk-dot c-${p.color}`} aria-hidden="true" /><h2>{p.name}</h2>{pg.atRisk && <span className="pill bad">At risk</span>}</header>
          {p.description && <p className="small">{p.description}</p>}
          <div className="tk-progress" role="meter" aria-label={`${p.name} progress`} aria-valuenow={pg.pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pg.pct}%` }} /></div>
          <p className="small"><b>{pg.done}/{pg.total}</b> done{pg.overdue ? ` · ${pg.overdue} overdue` : ''}{p.due ? ` · due ${fmt(p.due)}` : ''}</p>
          <p className="muted small">{w.nameOf(p.owner)} · {p.center || 'Organization'} · {p.visibility === 'members' ? 'Project members only' : p.visibility === 'masjid' ? 'Everyone at the masjid' : 'Every admin'}{p.templateId ? ' · from a template' : ''}</p>
          <div className="row-actions">
            <button type="button" className="btn sm" onClick={() => { pick(p.id); const u = new URL(window.location.href); u.searchParams.set('tab', 'board'); window.history.replaceState(null, '', u); window.dispatchEvent(new Event('isgh:tab')); }}>Open board</button>
            {(p.owner === w.me.id || w.access.can('admins.manage')) && <button type="button" className="btn sm ghost" onClick={() => { w.setProjects((l) => l.map((x) => (x.id === p.id ? { ...x, archived: true } : x))); logAudit({ area: 'members', action: 'Project archived', detail: p.name }); }}>Archive</button>}
          </div>
        </article>
      ); })}
      <button type="button" className="tk-project tk-project-new glass-pane" onClick={onNew}>+ New project<small>From scratch or from a template</small></button>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function TasksDashboard({ w }: { w: WorkApi }) {
  const open = w.tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => bucketOf(t, w.today) === 'overdue');
  const weekAgo = new Date(Date.parse(`${w.today}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const doneWeek = w.tasks.filter((t) => t.status === 'done' && t.doneAt.slice(0, 10) >= weekAgo).length;
  const load = workload(w.tasks, w.today);
  const risk = w.projects.filter((p) => !p.archived && projectProgress(p, w.allTasks, w.today).atRisk);
  return (
    <div className="mo-grid">
      <div className="viz-tiles">
        <StatTile id="tk-open" label="Open tasks" value={String(open.length)} note={`${open.filter((t) => t.status === 'waiting').length} waiting on someone`} />
        <StatTile id="tk-over" label="Overdue" value={String(overdue.length)} tone={overdue.length ? 'down' : undefined} note="past their due date" />
        <StatTile id="tk-done" label="Done this week" value={String(doneWeek)} note="last 7 days" />
        <StatTile id="tk-risk" label="Projects at risk" value={String(risk.length)} note={risk.map((p) => p.name).join(', ') || 'none'} />
      </div>
      <ChartCard id="tk-load" title="Open tasks per person" note="Overdue first – who might need help" table={{ head: ['Person', 'Open', 'Overdue'], rows: load.map((x) => [w.nameOf(x.owner), x.open, x.overdue]) }}>
        <Columns label="Open tasks per person" ramp={false} items={load.slice(0, 10).map((x) => ({ label: initials(w.nameOf(x.owner)), value: x.open }))} />
      </ChartCard>
      <section className="viz-card glass-pane" aria-labelledby="tk-od-h">
        <header className="viz-head"><h2 id="tk-od-h">Overdue</h2><p>Oldest first</p></header>
        <ul className="hd-oldest">{overdue.sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8).map((t) => <li key={t.id}><b>{fmt(t.due)}</b> {t.title}<small>{w.nameOf(t.owner)}</small></li>)}</ul>
      </section>
    </div>
  );
}

/* ---------------- one task ---------------- */
function TaskDrawer({ w, t, onClose, open }: { w: WorkApi; t: Task; onClose: () => void; open: (id: string) => void }) {
  const set = (f: (x: Task) => Task) => w.setTasks((l) => l.map((x) => (x.id === t.id ? f(x) : x)));
  const [item, setItem] = useState('');
  const [sub, setSub] = useState('');
  const [comment, setComment] = useState('');
  const subs = w.allTasks.filter((x) => x.parentId === t.id);
  const parent = t.parentId ? w.allTasks.find((x) => x.id === t.parentId) : null;
  const L = w.settings.tasks.statusLabels;
  const mayDelete = t.createdBy === w.me.name || t.owner === w.me.id || w.access.can('admins.manage');
  const ref = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const addComment = (e: FormEvent) => { e.preventDefault(); const text = comment.trim(); if (!text) return; const mentions = mentionsIn(text, w.admins); set((x) => ({ ...x, helpers: Array.from(new Set([...x.helpers, ...mentions.filter((m) => m !== x.owner)])), comments: [...x.comments, { at: w.now, by: w.me.name, text }] })); setComment(''); };
  return (
    <dialog ref={ref} className="modal glass-float tk-drawer" aria-label={`Task: ${t.title}`} onClose={onClose} onCancel={onClose} data-task-open={t.id}>
      <div className="tk-drawer-head">
        {parent && <button type="button" className="linkish small" onClick={() => open(parent.id)}>‹ {parent.title}</button>}
        <input className="in tk-title" aria-label="Task title" value={t.title} onChange={(e) => set((x) => ({ ...x, title: e.target.value }))} />
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>×</button>
      </div>
      <div className="tk-drawer-body">
        <div className="tk-props">
          <label className="sf-field"><span className="sf-label">Status</span><select className="in" aria-label="Task status" value={t.status} onChange={(e) => { const st = e.target.value as TaskStatus; w.setTasks((l) => (st === 'done' ? completeTask(l, t.id, w.me, w.now) : (t.status === 'done' ? reopenTask(l, t.id) : l).map((x) => (x.id === t.id ? { ...x, status: st } : x)))); }}>{TASK_STATUS_KEYS.map((k) => <option key={k} value={k}>{L[k]}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Owner</span><select className="in" aria-label="Task owner" value={t.owner} onChange={(e) => set((x) => ({ ...x, owner: e.target.value, comments: [...x.comments, { at: w.now, by: w.me.name, text: `Owner: ${w.nameOf(e.target.value)}.` }] }))}>{w.admins.map((a) => <option key={a.id} value={a.id}>{a.name}{a.id === w.me.id ? ' (me)' : ''}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Due</span><input className="in" type="date" aria-label="Due date" value={t.due} onChange={(e) => set((x) => ({ ...x, due: e.target.value }))} /></label>
          <label className="sf-field"><span className="sf-label">Priority</span><select className="in" aria-label="Task priority" value={t.priority} onChange={(e) => set((x) => ({ ...x, priority: e.target.value as TicketPriority }))}>{PRIORITY_KEYS.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Project</span><select className="in" aria-label="Task project" value={t.projectId} onChange={(e) => set((x) => ({ ...x, projectId: e.target.value }))}><option value="">No project</option>{w.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Repeat</span><select className="in" aria-label="Repeat" value={t.repeat ? `${t.repeat.every}-${t.repeat.interval}` : ''} onChange={(e) => { const v = e.target.value; set((x) => ({ ...x, repeat: v ? { every: v.split('-')[0] as 'week', interval: Number(v.split('-')[1]) } : null })); }}><option value="">Does not repeat</option><option value="week-1">Every week</option><option value="week-2">Every 2 weeks</option><option value="month-1">Every month</option><option value="month-3">Every 3 months</option><option value="year-1">Every year</option></select>
            {t.repeat && t.due && <small className="sf-hint">Next one: {fmt(nextDue(t.due, t.repeat))}</small>}</label>
        </div>
        <div className="tk-labels" role="group" aria-label="Labels">{w.settings.tasks.labels.map((l) => <button key={l.id} type="button" className={`tk-label c-${l.color}`} aria-pressed={t.labels.includes(l.id)} onClick={() => set((x) => ({ ...x, labels: x.labels.includes(l.id) ? x.labels.filter((y) => y !== l.id) : [...x.labels, l.id] }))}>{l.label}</button>)}</div>
        <label className="sf-field"><span className="sf-label">Notes</span><textarea className="in in-area" rows={3} aria-label="Task notes" value={t.notes} onChange={(e) => set((x) => ({ ...x, notes: e.target.value }))} /></label>
        <div className="tk-helpers"><span className="sf-label">Helpers</span> {t.helpers.length ? t.helpers.map(w.nameOf).join(', ') : <span className="muted small">none – mention someone in a comment to add them</span>}</div>

        <section className="tk-sec" aria-labelledby="ck-h">
          <h3 id="ck-h" className="wq-h3">Checklist {t.checklist.length > 0 && <span className="pill">{t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span>}</h3>
          <ul className="tk-checklist">{t.checklist.map((c) => <li key={c.id}><label><input type="checkbox" checked={c.done} onChange={() => set((x) => ({ ...x, checklist: x.checklist.map((y) => (y.id === c.id ? { ...y, done: !y.done } : y)) }))} /> <span className={c.done ? 'done' : ''}>{c.text}</span></label><button type="button" className="icon-btn sm" aria-label={`Remove ${c.text}`} onClick={() => set((x) => ({ ...x, checklist: x.checklist.filter((y) => y.id !== c.id) }))}>×</button></li>)}</ul>
          <form onSubmit={(e) => { e.preventDefault(); if (!item.trim()) return; set((x) => ({ ...x, checklist: [...x.checklist, { id: newId('c'), text: item.trim(), done: false }] })); setItem(''); }}><input className="in in-sm" aria-label="Add a checklist item" placeholder="+ Add an item" value={item} onChange={(e) => setItem(e.target.value)} /></form>
        </section>

        {!t.parentId && <section className="tk-sec" aria-labelledby="sub-h">
          <h3 id="sub-h" className="wq-h3">Sub-tasks {subs.length > 0 && <span className="pill">{subs.filter((s) => s.status === 'done').length}/{subs.length}</span>}</h3>
          <ul className="tk-rows">{subs.map((s) => <TaskRow key={s.id} ctx={{ w, open }} t={s} />)}</ul>
          <form onSubmit={(e) => { e.preventDefault(); if (sub.trim().length < 2) return; w.setTasks((l) => [...l, blankTask(w, { title: sub.trim(), parentId: t.id, projectId: t.projectId, owner: t.owner, due: t.due })]); setSub(''); }}><input className="in in-sm" aria-label="Add a sub-task" placeholder="+ Add a sub-task" value={sub} onChange={(e) => setSub(e.target.value)} /></form>
        </section>}

        {t.links.length > 0 && <section className="tk-sec"><h3 className="wq-h3">Linked</h3><ul className="hd-links">{t.links.map((l) => <li key={l.kind + l.id}>{l.kind === 'ticket' ? <Link href={`/queues/tickets?ticket=${encodeURIComponent(l.id)}`}>Ticket {l.id}: {l.label}</Link> : l.id.startsWith('queue:') ? <Link href={`/queues?tab=${l.id.slice(6)}`}>{l.label}</Link> : <span>{l.label}</span>}</li>)}</ul></section>}

        <section className="tk-sec" aria-labelledby="cm-h">
          <h3 id="cm-h" className="wq-h3">Comments and history</h3>
          <ul className="history">{[...t.comments].reverse().map((c, i) => <li key={i}><div><b>{c.text}</b><span>{c.by} · {new Date(c.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div></li>)}</ul>
          <form className="tk-comment" onSubmit={addComment}><textarea className="in in-area" rows={2} aria-label="Comment" placeholder="Write a comment – @name brings someone in" value={comment} onChange={(e) => setComment(e.target.value)} /><button className="btn sm" disabled={!comment.trim()}>Comment</button></form>
        </section>
      </div>
      <div className="modal-actions">
        {mayDelete && <button type="button" className="btn ghost danger-text" onClick={() => { w.setTasks((l) => l.filter((x) => x.id !== t.id && x.parentId !== t.id)); logAudit({ area: 'members', action: 'Task deleted', detail: t.title }); onClose(); }}>Delete</button>}
        {t.status === 'done' ? <button type="button" className="btn" onClick={() => w.setTasks((l) => reopenTask(l, t.id))}>Reopen</button>
          : <button type="button" className="btn primary" onClick={() => { w.setTasks((l) => completeTask(l, t.id, w.me, w.now)); logAudit({ area: 'members', action: 'Task done', detail: t.title }); }}>Mark done{t.repeat ? ' (next one is created)' : ''}</button>}
      </div>
    </dialog>
  );
}

/* ---------------- create ---------------- */
function NewTask({ w, init, onClose, onCreated }: { w: WorkApi; init: Partial<Task>; onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ title: '', projectId: init.projectId ?? '', owner: w.me.id, due: '', priority: 'normal' as TicketPriority, repeat: '' });
  const ref = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  return (
    <dialog ref={ref} className="modal glass-float" aria-label="New task" onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={(e) => { e.preventDefault(); if (f.title.trim().length < 2) return; const t = blankTask(w, { title: f.title.trim(), projectId: f.projectId, owner: f.owner, due: f.due, priority: f.priority, repeat: f.repeat ? { every: f.repeat.split('-')[0] as 'week', interval: Number(f.repeat.split('-')[1]) } : null }); w.setTasks((l) => [...l, t]); if (f.projectId) w.setProjects((l) => l.map((p) => (p.id === f.projectId && !p.members.includes(f.owner) ? { ...p, members: [...p.members, f.owner] } : p))); logAudit({ area: 'members', action: 'Task created', detail: t.title }); onCreated(t.id); }}>
        <h2>New task</h2>
        <label className="sf-field"><span className="sf-label">What needs doing</span><input className="in" aria-label="New task title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></label>
        <div className="field-row three">
          <label className="sf-field"><span className="sf-label">Project</span><select className="in" aria-label="New task project" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}><option value="">No project</option>{w.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Owner</span><select className="in" aria-label="New task owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>{w.admins.map((a) => <option key={a.id} value={a.id}>{a.name}{a.id === w.me.id ? ' (me)' : ''}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Due</span><input className="in" type="date" aria-label="New task due date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        </div>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Priority</span><select className="in" aria-label="New task priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as TicketPriority })}>{PRIORITY_KEYS.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Repeat</span><select className="in" aria-label="New task repeat" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })}><option value="">Does not repeat</option><option value="week-1">Every week</option><option value="month-1">Every month</option><option value="year-1">Every year</option></select></label>
        </div>
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={f.title.trim().length < 2}>Create task</button></div>
      </form>
    </dialog>
  );
}

function NewProject({ w, onClose, onCreated }: { w: WorkApi; onClose: () => void; onCreated: (id: string) => void }) {
  const tpls = w.settings.tasks.templates;
  const locked = w.access.role?.centerScoped && w.access.me?.centers.length === 1 ? w.access.me.centers[0] : '';
  const [f, setF] = useState({ how: tpls.length ? 'template' : 'blank', templateId: tpls[0]?.id ?? '', name: '', anchor: '', due: '', center: locked, visibility: (locked ? 'masjid' : 'organization') as Project['visibility'], color: 'green' as Project['color'] });
  const tpl = tpls.find((t) => t.id === f.templateId);
  const preview = useMemo(() => (f.how === 'template' && tpl && f.anchor ? projectFromTemplate(tpl, { name: f.name || tpl.name, anchor: f.anchor, owner: w.me.id, center: f.center, by: w.me, at: w.now, visibility: f.visibility }, w.admins as never) : null), [f, tpl]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = (f.name.trim().length >= 2 || (f.how === 'template' && !!tpl)) && (f.how === 'blank' || !!f.anchor);
  const ref = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const create = (e: FormEvent) => {
    e.preventDefault(); if (!ok) return;
    if (preview) { const p = { ...preview.project, color: f.color }; w.setProjects((l) => [...l, p]); w.setTasks((l) => [...l, ...preview.tasks]); logAudit({ area: 'members', action: 'Project created from a template', detail: `${p.name} (${tpl?.name})` }); onCreated(p.id); return; }
    const p: Project = { id: newId('prj'), name: f.name.trim(), color: f.color, owner: w.me.id, center: f.center, visibility: f.visibility, members: [w.me.id], due: f.due, anchor: '', templateId: '', archived: false, createdAt: w.now, description: '' };
    w.setProjects((l) => [...l, p]); logAudit({ area: 'members', action: 'Project created', detail: p.name }); onCreated(p.id);
  };
  return (
    <dialog ref={ref} className="modal glass-float tk-newproj" aria-label="New project" onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={create}>
        <h2>New project</h2>
        <div className="seg" role="radiogroup" aria-label="Start from">
          <button type="button" role="radio" aria-checked={f.how === 'template'} disabled={!tpls.length} onClick={() => setF({ ...f, how: 'template' })}>From a template</button>
          <button type="button" role="radio" aria-checked={f.how === 'blank'} onClick={() => setF({ ...f, how: 'blank' })}>Blank</button>
        </div>
        {f.how === 'template' && <div className="field-row">
          <label className="sf-field"><span className="sf-label">Template</span><select className="in" aria-label="Template" value={f.templateId} onChange={(e) => setF({ ...f, templateId: e.target.value })}>{tpls.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.tasks.length} tasks)</option>)}</select>{tpl?.description && <small className="sf-hint">{tpl.description}</small>}</label>
          <label className="sf-field"><span className="sf-label">{tpl?.anchorLabel ?? 'Event day'}</span><input className="in" type="date" aria-label="Anchor date" value={f.anchor} onChange={(e) => setF({ ...f, anchor: e.target.value })} /><small className="sf-hint">Every task’s due date is counted from this day.</small></label>
        </div>}
        <label className="sf-field"><span className="sf-label">Name</span><input className="in" aria-label="Project name" placeholder={f.how === 'template' ? tpl?.name : 'Ramadan iftar program'} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <div className="field-row three">
          <label className="sf-field"><span className="sf-label">Masjid</span><select className="in" aria-label="Project masjid" value={f.center} disabled={!!locked} onChange={(e) => setF({ ...f, center: e.target.value, visibility: e.target.value ? 'masjid' : 'organization' })}>{!locked && <option value="">The organization</option>}{centersFor(w).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <label className="sf-field"><span className="sf-label">Who sees it</span><select className="in" aria-label="Project visibility" value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value as Project['visibility'] })}><option value="members">Only the people on it</option>{f.center && <option value="masjid">Everyone at the masjid</option>}<option value="organization">Every admin</option></select></label>
          {f.how === 'blank' ? <label className="sf-field"><span className="sf-label">Due (optional)</span><input className="in" type="date" aria-label="Project due date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
            : <label className="sf-field"><span className="sf-label">Color</span><select className="in" aria-label="Project color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value as Project['color'] })}>{COLORS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>}
        </div>
        {preview && <div className="tk-preview glass-pane" aria-label="Tasks this creates"><b>{preview.tasks.length} tasks</b><ul>{preview.tasks.map((t) => <li key={t.id}><span>{fmt(t.due)}</span> {t.title} <small>– {w.nameOf(t.owner)}</small></li>)}</ul></div>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ok}>Create project</button></div>
      </form>
    </dialog>
  );
}
