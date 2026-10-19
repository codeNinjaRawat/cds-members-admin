'use client';
/**
 * Help desk + Team tasks – DEMO storage (this browser) and React hooks. The rules live in lib/community/work.ts
 * (shared with the website and the BE). Live mode: the same hooks over the API – the screens still change whole lists
 * with the shared rules, and liveTicketSteps / liveTaskSteps turn each change into the API call that makes it.
 *
 * Demo time: tickets and tasks are seeded relative to "now" so the demo always looks current. Tests pin the clock with
 * localStorage 'isgh-demo-now' = 'YYYY-MM-DDTHH:mm:ss' (Houston wall-clock).
 */
import { useEffect, useMemo, useState } from 'react';
import { useAccess } from '@/lib/access/use-access';
import { mockWorkSettings, WorkSettingsSchema, canSeeTicket, canSeeTask, canSeeProject, newTicket, reply, note, setStatus, assign, requesterReply, projectFromTemplate,
  type Project, type Task, type Ticket, type Viewer, type WorkSettings, type Actor } from '@/lib/community/work';
import { mockOrgStructure, OrgStructureSchema, type OrgStructure } from '@/lib/community/org-structure';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

const K = { tickets: 'isgh-admin-helpdesk', tasks: 'isgh-admin-tasks2', projects: 'isgh-admin-projects', now: 'isgh-demo-now' };
export const WORK_EVENT = 'isgh:work';

/* ---------------- demo clock ---------------- */
export function demoNow(): string {
  try { const n = localStorage.getItem(K.now); if (n && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(n)) return n.slice(0, 19); } catch { /* */ }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date());
  const p = (type: Intl.DateTimeFormatPartTypes): string => parts.find((x) => x.type === type)?.value ?? '00';
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour') === '24' ? '00' : p('hour')}:${p('minute')}:${p('second')}`;
}
export const demoToday = () => demoNow().slice(0, 10);
const shift = (now: string, hours: number) => new Date(Date.parse(`${now}Z`) + hours * 3_600_000).toISOString().slice(0, 19);
const dayShift = (now: string, days: number) => shift(now, days * 24).slice(0, 10);

/* ---------------- seed (fictional people; centers match the demo map) ---------------- */
const SW1 = 'Southwest Islamic Center 1', N1 = 'North Islamic Center 1', SE1 = 'Southeast Islamic Center 1';
type AdminLite = { id: string; name: string; roleId: string; centers: string[]; status: string; more?: { roleId: string; centers: string[] }[] };
export function seedTickets(now: string, s: WorkSettings, admins: AdminLite[]): Ticket[] {
  const H = s.helpdesk;
  const by = (id: string): Actor => ({ id, name: admins.find((a) => a.id === id)?.name ?? id });
  const mk = (id: string, hoursAgo: number, p: Omit<Parameters<typeof newTicket>[0], 'id' | 'at' | 'createdBy'> & { createdBy?: Actor }) => newTicket({ ...p, id, at: shift(now, -hoursAgo), createdBy: p.createdBy ?? { id: '', name: 'Website' } }, H, admins);
  const at = (h: number) => shift(now, -h);
  const req = (name: string, email: string, memberId = '', phone = '') => ({ name, email, memberId, phone });
  const list: Ticket[] = [];
  let t = mk('T-1041', 50, { subject: 'Parking blocked during Jumu’ah', detail: 'Cars were parked across the exit for the second Friday in a row. Someone could get hurt in an emergency.', categoryId: 'facilities', channel: 'website', requester: req('Hamza Qureshi', 'hamza.q@example.com', 'HOU-200341'), center: SW1 });
  t = reply(t, 'Assalamu alaikum Hamza, thank you for telling us. We are speaking with the parking volunteers this week.', by(t.assignee || 'owner'), at(46));
  t = note(t, 'Cones at the exit from this Friday. @Southwest zone director can you confirm two volunteers?', by(t.assignee || 'owner'), at(45), admins);
  list.push({ ...t, tags: ['jumuah', 'safety'] });
  list.push(mk('T-1042', 120, { subject: 'Weekend school registration page is hard to find', detail: 'It took me ten minutes to find where to register my children. A link on the home page would help.', categoryId: 'website', channel: 'website', requester: req('Sara Malik', 'sara.m@example.com'), center: N1 }));
  t = mk('T-1043', 96, { subject: 'Change of address and new phone number', detail: 'We moved to 77036 last month. Please update my record and my wife’s.', categoryId: 'membership', channel: 'portal', requester: req('Imran Sheikh', 'imran.s@example.com', 'HOU-205032'), center: SW1 });
  t = reply(t, 'Assalamu alaikum Imran, happy to update both records. Could you send your new street address and your wife’s phone number?', by('membership-office'), at(90), 'waiting');
  list.push(t);
  t = mk('T-1044', 200, { subject: 'Donation receipt shows the wrong amount', detail: 'I gave $500 on the website; the receipt says $50.', categoryId: 'donations', channel: 'website', requester: req('Nadia Rahman', 'nadia.r@example.com') , center: '' });
  t = reply(t, 'Assalamu alaikum Nadia, I am sorry for the trouble – checking with the payment platform now.', by('treasurer'), at(196));
  t = setStatus(reply(t, 'Your receipt is corrected and re-sent. The kiosk had logged the gift twice. May Allah accept it.', by('treasurer'), at(170)), 'solved', by('treasurer'), at(170));
  list.push({ ...t, csat: { score: 'good', comment: 'Quick and kind, thank you.', at: at(150) } });
  t = mk('T-1045', 30, { subject: 'Membership card for my son who turned 18', detail: 'He is on our family plan and would like his own card and sign-in.', categoryId: 'membership', channel: 'phone', requester: req('Khalid Ahmed', '', 'HOU-201226', '(713) 555-0142'), center: SW1, createdBy: by('front-office') });
  list.push(t);
  t = mk('T-1046', 20, { subject: 'Complaint about a volunteer’s behavior at the youth night', detail: 'A volunteer spoke harshly to my daughter in front of others. I would like this handled privately.', categoryId: 'conduct', channel: 'website', requester: req('Parent (private)', 'parent@example.com'), center: SE1 });
  list.push(note(t, 'Spoke with the youth coordinator; meeting with the family next week.', by('gen-secretary'), at(10), admins));
  list.push(mk('T-1047', 6, { subject: 'Thank you for the new prayer timetable', detail: 'The printable month view is exactly what our elders asked for.', categoryId: 'feedback', channel: 'website', requester: req('Aisha Noor', 'aisha.n@example.com', 'HOU-209623'), center: N1 }));
  list.push(mk('T-1048', 3, { subject: 'Can I pay Zakat for my brother’s rent?', detail: 'My brother lost his job. Can my Zakat go directly to his landlord, and does it count?', categoryId: 'other', channel: 'email', requester: req('Bilal Haider', 'bilal.h@example.com'), center: '' }));
  list.push(mk('T-1049', 26, { subject: 'Exit blocked again after Friday prayer', detail: 'Same problem as before – the side exit was blocked by double-parked cars.', categoryId: 'facilities', channel: 'website', requester: req('Yusuf Karim', 'yusuf.k@example.com'), center: SW1 }));
  list.push(mk('T-1050', 12, { subject: 'Wheelchair ramp at the side door is broken', detail: 'The handrail is loose and the ramp has a crack. Elders are using the stairs.', categoryId: 'facilities', channel: 'walk-in', requester: req('Uncle Farooq (walk-in)', '', '', '(281) 555-0199'), center: N1, priority: 'urgent', createdBy: by('center-admin-n1') }));
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function seedWork(now: string, s: WorkSettings, admins: AdminLite[], tickets: Ticket[]): { projects: Project[]; tasks: Task[] } {
  const today = now.slice(0, 10);
  const me: Actor = { id: 'owner', name: 'Mohammad (demo)' };
  const agm = projectFromTemplate(s.tasks.templates.find((t) => t.id === 'agm') ?? s.tasks.templates[0], { name: 'Annual General Meeting 2026', anchor: dayShift(now, 24), owner: 'gen-secretary', center: '', by: { id: 'gen-secretary', name: admins.find((a) => a.id === 'gen-secretary')?.name ?? 'General Secretary' }, at: shift(now, -72), visibility: 'organization' }, admins);
  agm.project.color = 'violet';
  const P = (id: string, name: string, color: Project['color'], owner: string, center: string, visibility: Project['visibility'], due: string, members: string[], description = ''): Project => ({ id, name, color, owner, center, visibility, members, due, anchor: '', templateId: '', archived: false, createdAt: shift(now, -240), description });
  const renew = P('prj-renewal-2027', 'Renewal season 2027', 'green', 'owner', '', 'organization', dayShift(now, 40), ['owner', 'membership-office', 'board-secretary', 'web-editor', 'comms'], 'Everything before renewals open on November 1.');
  const coats = P('prj-coat-drive', 'Winter coat drive', 'blue', 'ad-se1', SE1, 'masjid', dayShift(now, 30), ['ad-se1', 'ms-se1', 'fs-se1'], 'Collect, sort and give out coats before December.');
  const T = (p: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({ projectId: '', parentId: '', notes: '', owner: 'owner', helpers: [], status: 'todo', priority: 'normal', start: '', due: '', labels: [], checklist: [], repeat: null, links: [], comments: [], createdAt: shift(now, -100), createdBy: admins.find((a) => a.id === (p.owner ?? 'owner'))?.name ?? 'Mohammad (demo)', doneAt: '', order: 0, ...p });
  const c = (text: string, done = false, i = 0) => ({ id: `c${i}-${text.length}`, text, done });
  const parking = tickets.find((t) => t.id === 'T-1041');
  const tasks: Task[] = [
    ...agm.tasks.map((t, i) => (i === 0 ? { ...t, status: 'doing' as const, checklist: t.checklist.map((x, j) => ({ ...x, done: j === 0 })) } : t)),
    T({ id: 'task-dues-text', projectId: renew.id, title: 'Check 2027 dues and the reminder text', owner: 'owner', due: today, priority: 'high', labels: ['board'], checklist: [c('Prices match the Board decision', true, 1), c('Reminder email wording', false, 2), c('Text message wording', false, 3)], order: 0 }),
    T({ id: 'task-board-apps', projectId: renew.id, title: 'Approve applications waiting for Board review', owner: 'board-secretary', due: today, priority: 'high', labels: ['board'], links: [{ kind: 'member', id: 'queue:applications', label: 'Work queues › Applications' }], order: 1 }),
    T({ id: 'task-renew-email', projectId: renew.id, title: 'Schedule the “Renewals are open” email for November 1', owner: 'comms', due: dayShift(now, 10), order: 2, status: 'waiting', comments: [{ at: shift(now, -20), by: 'Communication manager', text: 'Waiting for the final prices from the Board.' }] }),
    T({ id: 'task-flyers', projectId: renew.id, title: 'Print renewal flyers for every masjid', owner: 'membership-office', due: dayShift(now, -2), labels: ['print'], order: 3, checklist: [c('Design approved', true, 1), c('Order 2,000 copies', false, 2)] }),
    T({ id: 'task-site-banner', projectId: renew.id, title: 'Website banner: “Renew before June 30”', owner: 'web-editor', due: dayShift(now, 12), order: 4 }),
    T({ id: 'task-coat-boxes', projectId: coats.id, title: 'Put collection boxes at both entrances', owner: 'ad-se1', due: dayShift(now, 1), order: 0, labels: ['volunteers'] }),
    T({ id: 'task-coat-sort', projectId: coats.id, title: 'Sort coats by size with the youth group', owner: 'ms-se1', helpers: ['ad-se1'], due: dayShift(now, 14), order: 1, labels: ['volunteers'] }),
    T({ id: 'task-coat-thanks', projectId: coats.id, title: 'Thank-you post for donors', owner: 'fs-se1', due: dayShift(now, 32), order: 2, priority: 'low' }),
    T({ id: 'task-finance-report', title: 'Monthly finance report to the Board', owner: 'treasurer', createdBy: 'Mohammad (demo)', due: dayShift(now, 3), repeat: { every: 'month', interval: 1 }, labels: ['finance', 'board'], checklist: [c('Bank reconciliation', false, 1), c('Fund balances', false, 2), c('Send to the Board secretary', false, 3)] }),
    T({ id: 'task-parking-roster', title: 'Friday parking volunteers roster', owner: 'ad-se1', due: dayShift(now, 2), repeat: { every: 'week', interval: 1 }, labels: ['volunteers'] }),
    T({ id: 'task-sample-items', title: 'Turn off the sample giving items before launch', owner: 'owner', due: dayShift(now, 5), priority: 'low' }),
    T({ id: 'task-zones-map', title: 'Ask the client for the Zones map (KML) for the real zone boundaries', owner: 'owner', due: dayShift(now, -3), priority: 'high', labels: ['board'], notes: 'Needed for the ISGH preset: ZIP lists per zone or the KML export of the Google My Map.' }),
    T({ id: 'task-wa-export', title: 'Trial import of the Wild Apricot contact export', owner: 'membership-office', due: dayShift(now, 6), createdBy: 'Mohammad (demo)', checklist: [c('Get the export file', false, 1), c('Run Members › Import with the Wild Apricot preset', false, 2), c('Check duplicates', false, 3)] }),
    T({ id: 'task-names', title: 'Confirm the four “name to confirm” centers', owner: 'owner', due: dayShift(now, 9), helpers: ['gen-secretary'] }),
  ];
  if (parking) tasks.push(T({ id: 'task-cones', title: `Buy cones and “Keep clear” signs (${parking.id})`, owner: 'sw-director', due: dayShift(now, -1), priority: 'high', links: [{ kind: 'ticket', id: parking.id, label: parking.subject }], comments: [{ at: shift(now, -44), by: 'Mohammad (demo)', text: 'From the parking ticket – the cones should be in place before Friday.' }] }));
  return { projects: [renew, agm.project, coats], tasks };
}

/* ---------------- storage ---------------- */
function read<T>(key: string): T | null { try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : null; } catch { return null; } }
function write(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* */ } window.dispatchEvent(new Event(WORK_EVENT)); }

let settingsCache: WorkSettings | null = null; let settingsLoading: Promise<WorkSettings> | null = null;
export function loadWorkSettings(force = false): Promise<WorkSettings> {
  if (!force && settingsCache) return Promise.resolve(settingsCache);
  if (!force && settingsLoading) return settingsLoading;
  settingsLoading = fetch('/api/store/work-settings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
    const p = WorkSettingsSchema.safeParse(j?.data); settingsCache = p.success ? p.data : mockWorkSettings; settingsLoading = null; return settingsCache;
  });
  return settingsLoading;
}
export function useWorkSettings(): WorkSettings {
  const [s, setS] = useState<WorkSettings>(settingsCache ?? mockWorkSettings);
  useEffect(() => {
    const go = (force = false) => void loadWorkSettings(force).then(setS);
    go(); const onPub = (e: Event) => { if ((e as CustomEvent).detail?.key === 'work-settings') go(true); };
    window.addEventListener('isgh:published', onPub); return () => window.removeEventListener('isgh:published', onPub);
  }, []);
  return s;
}

type Store = { tickets: Ticket[]; tasks: Task[]; projects: Project[] };
function ensureSeed(admins: AdminLite[], s: WorkSettings): Store {
  if (LIVE) { if (!live) void loadLiveWork(); return live ?? { tickets: [], tasks: [], projects: [] }; }
  let tickets = read<Ticket[]>(K.tickets);
  if (!tickets) { tickets = seedTickets(demoNow(), s, admins); localStorage.setItem(K.tickets, JSON.stringify(tickets)); }
  let tasks = read<Task[]>(K.tasks), projects = read<Project[]>(K.projects);
  if (!tasks || !projects) { const w = seedWork(demoNow(), s, admins, tickets); tasks = w.tasks; projects = w.projects; localStorage.setItem(K.tasks, JSON.stringify(tasks)); localStorage.setItem(K.projects, JSON.stringify(projects)); }
  return { tickets, tasks, projects };
}

/* ---------------- live mode: the API's tickets, tasks and projects ---------------- */
let live: Store | null = null; let liveLoading: Promise<void> | null = null; let orgMap: OrgStructure | null = null;
export function loadLiveWork(force = false): Promise<void> {
  if (!force && live) return Promise.resolve();
  if (!force && liveLoading) return liveLoading;
  liveLoading = Promise.all([
    be<{ tickets: Ticket[] }>('GET', 'admin/helpdesk/tickets?view=any&full=1'), be<{ tasks: Task[] }>('GET', 'admin/tasks'), be<{ projects: Project[] }>('GET', 'admin/tasks/projects'),
    orgMap ? Promise.resolve(null) : fetch('/api/store/org-structure', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([t, k, p, o]) => {
    liveLoading = null;
    const om = OrgStructureSchema.safeParse((o as { data?: unknown } | null)?.data); if (om.success) orgMap = om.data;
    if (!t.ok || !k.ok || !p.ok) { const bad = [t, k, p].find((x) => !x.ok) as { message: string; status: number }; if (bad.status !== 401) notice(`Help desk and tasks could not be loaded: ${bad.message}`); }
    live = { tickets: t.ok ? t.data.tickets.map((x) => ({ ...x, events: x.events ?? [] })) : live?.tickets ?? [], tasks: k.ok ? k.data.tasks : live?.tasks ?? [], projects: p.ok ? p.data.projects : live?.projects ?? [] };
    window.dispatchEvent(new Event(WORK_EVENT));
  });
  return liveLoading;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
type Step = [string, string, unknown];
/** One ticket's change → API calls. New threads go first (a reply may set the status itself), then the fields. */
export function liveTicketSteps(before: Ticket | undefined, t: Ticket): Step[] {
  if (!before) return [['POST', 'admin/helpdesk/tickets', { subject: t.subject, detail: t.events[0]?.text || t.subject, categoryId: t.categoryId, channel: ['phone', 'walk-in', 'email', 'staff'].includes(t.channel) ? t.channel : 'staff', name: t.requester.name || 'Staff', email: t.requester.email, phone: t.requester.phone, memberId: t.requester.memberId, center: t.center, priority: t.priority, assignee: t.assignee || undefined }]];
  const id = encodeURIComponent(t.id); const steps: Step[] = [];
  if (t.mergedInto && !before.mergedInto) return [['POST', `admin/helpdesk/tickets/${id}/merge`, { into: t.mergedInto }]];
  const added = t.events.slice(before.events.length);
  let statusSent = false;
  for (const e of added) {
    if (e.kind === 'reply') { const after = t.status !== before.status && ['waiting', 'solved', 'open', 'hold'].includes(t.status) ? t.status : undefined; steps.push(['POST', `admin/helpdesk/tickets/${id}/replies`, { text: e.text, status: after }]); if (after) statusSent = true; }
    if (e.kind === 'note') steps.push(['POST', `admin/helpdesk/tickets/${id}/notes`, { text: e.text }]);
    if (e.kind === 'requester') steps.push(['POST', `admin/helpdesk/tickets/${id}/requester`, { text: e.text }]);
  }
  const patch: Record<string, unknown> = {};
  if (t.status !== before.status && !statusSent && !(added.some((e) => e.kind === 'requester') && before.status === 'waiting')) patch.status = t.status;
  if (t.assignee !== before.assignee) patch.assignee = t.assignee;
  if (t.priority !== before.priority) patch.priority = t.priority;
  if (t.categoryId !== before.categoryId) patch.categoryId = t.categoryId;
  if (t.center !== before.center) patch.center = t.center;
  if (!same(t.tags, before.tags)) patch.tags = t.tags;
  if (!same(t.watchers, before.watchers) && !added.some((e) => e.kind === 'note')) patch.watchers = t.watchers;   // @mentions add watchers on the server
  if (t.restricted !== before.restricted) patch.restricted = t.restricted;
  if (t.csat && !same(t.csat, before.csat)) patch.csat = { score: t.csat.score, comment: t.csat.comment };
  if (Object.keys(patch).length) steps.push(['PATCH', `admin/helpdesk/tickets/${id}`, patch]);
  return steps;
}
const TASK_FIELDS = ['title', 'projectId', 'parentId', 'owner', 'notes', 'helpers', 'status', 'priority', 'start', 'due', 'labels', 'checklist', 'repeat', 'order'] as const;
/** The task list's change → API calls (done / reopen use their own calls; a ticket's task is made from the ticket). */
export function liveTaskSteps(before: Task[], after: Task[]): Step[] {
  const steps: Step[] = []; const old = new Map(before.map((t) => [t.id, t]));
  const finished = after.filter((t) => t.status === 'done' && old.get(t.id) && old.get(t.id)!.status !== 'done');
  for (const t of after) {
    const b = old.get(t.id);
    if (!b) {
      if (finished.some((f) => f.repeat && f.title === t.title)) continue;   // the next of a repeating task: the server makes it on "done"
      const ticket = t.links.find((l) => l.kind === 'ticket');
      if (ticket) { steps.push(['POST', `admin/helpdesk/tickets/${encodeURIComponent(ticket.id)}/task`, { owner: t.owner, due: t.due }]); continue; }
      steps.push(['POST', 'admin/tasks', { id: t.id, title: t.title, projectId: t.projectId, parentId: t.parentId, owner: t.owner, notes: t.notes, helpers: t.helpers, status: t.status === 'done' ? 'todo' : t.status, priority: t.priority, start: t.start, due: t.due, labels: t.labels, checklist: t.checklist, repeat: t.repeat }]);
      if (t.status === 'done') steps.push(['POST', `admin/tasks/${t.id}/done`, {}]);
      continue;
    }
    const id = encodeURIComponent(t.id);
    if (t.status === 'done' && b.status !== 'done') steps.push(['POST', `admin/tasks/${id}/done`, {}]);
    if (t.status !== 'done' && b.status === 'done') steps.push(['POST', `admin/tasks/${id}/reopen`, {}]);
    const patch: Record<string, unknown> = {};
    for (const k of TASK_FIELDS) if (k !== 'status' && !same(t[k], b[k])) patch[k] = t[k];
    if (t.status !== b.status && t.status !== 'done' && b.status !== 'done') patch.status = t.status;
    if (Object.keys(patch).length) steps.push(['PATCH', `admin/tasks/${id}`, patch]);
    for (const c of t.comments.slice(b.comments.length)) steps.push(['POST', `admin/tasks/${id}/comments`, { text: c.text }]);
  }
  for (const b of before) if (!after.some((t) => t.id === b.id)) steps.push(['DELETE', `admin/tasks/${encodeURIComponent(b.id)}`, undefined]);
  return steps;
}
export function liveProjectSteps(before: Project[], after: Project[]): Step[] {
  const steps: Step[] = []; const old = new Map(before.map((p) => [p.id, p]));
  for (const p of after) {
    const b = old.get(p.id);
    if (!b) { steps.push(['POST', 'admin/tasks/projects', { id: p.id, name: p.name, color: p.color, center: p.center, visibility: p.visibility, due: p.due, description: p.description }]); continue; }
    const patch: Record<string, unknown> = {};
    if (p.name !== b.name) patch.name = p.name; if (p.archived !== b.archived) patch.archived = p.archived; if (p.due !== b.due) patch.due = p.due;
    if (Object.keys(patch).length) steps.push(['PATCH', `admin/tasks/projects/${encodeURIComponent(p.id)}`, patch]);
  }
  return steps;
}
async function runSteps(steps: Step[], what: string) {
  for (const [method, path, body] of steps) { const r = await be(method, path, body); if (!r.ok) { notice(`${what}: ${r.message}`); break; } }
  await loadLiveWork(true);
}
/** Live writes: show the change at once, send it, then reload from the server (its numbers, clocks and rules win). */
function liveSet<K extends keyof Store>(key: K, f: (l: Store[K]) => Store[K]) {
  const cur = ensureSeed([], mockWorkSettings)[key]; const next = f(cur);
  live = { ...(live ?? { tickets: [], tasks: [], projects: [] }), [key]: next };
  window.dispatchEvent(new Event(WORK_EVENT));
  const steps = key === 'tickets' ? (next as Ticket[]).flatMap((t) => { const b = (cur as Ticket[]).find((x) => x.id === t.id); return b && same(b, t) ? [] : liveTicketSteps(b, t); })
    : key === 'tasks' ? liveTaskSteps(cur as Task[], next as Task[]) : liveProjectSteps(cur as Project[], next as Project[]);
  queue = queue.then(() => runSteps(steps, key === 'tickets' ? 'Help desk' : key === 'tasks' ? 'Task' : 'Project'));   // one at a time: a project before its tasks
}
let queue: Promise<void> = Promise.resolve();
/** Live: resolves when every change sent so far has been answered (tests, and screens that wait). */
export const liveSettled = () => queue;
/** Live: the same change the screens make through useWork().setTickets / setTasks / setProjects. */
export const liveChange = liveSet;

/** Everything the help desk and task screens need: the data (seeded once), the settings, who I am and what I may see. */
export function useWork() {
  const access = useAccess();
  const settings = useWorkSettings();
  const [store, setStore] = useState<Store>({ tickets: [], tasks: [], projects: [] });
  const [ready, setReady] = useState(false);
  const admins = access.doc.admins as unknown as AdminLite[];
  useEffect(() => {
    if (!access.ready) return;
    const load = () => { setStore(ensureSeed(admins, settings)); setReady(true); };
    load(); window.addEventListener(WORK_EVENT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(WORK_EVENT, load); window.removeEventListener('storage', load); };
  }, [access.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const me: Actor = { id: access.me?.id ?? (LIVE ? '' : 'owner'), name: access.me?.name ?? (LIVE ? '' : 'Mohammad (demo)') };
  const viewer: Viewer = useMemo(() => ({ ...viewerFor(access.me?.id ?? '', access.role?.id ?? 'owner', access.inScope, !(access.role?.centerScoped || access.role?.zoneScoped || access.role?.areaScoped)), name: access.me?.name }), [access.doc, access.me, access.role]); // eslint-disable-line react-hooks/exhaustive-deps
  const setTickets = (f: (l: Ticket[]) => Ticket[]) => { if (LIVE) return liveSet('tickets', f); const cur = ensureSeed(admins, settings).tickets; write(K.tickets, f(cur)); };
  const setTasks = (f: (l: Task[]) => Task[]) => { if (LIVE) return liveSet('tasks', f); const cur = ensureSeed(admins, settings).tasks; write(K.tasks, f(cur)); };
  const setProjects = (f: (l: Project[]) => Project[]) => { if (LIVE) return liveSet('projects', f); const cur = ensureSeed(admins, settings).projects; write(K.projects, f(cur)); };
  const visibleTickets = store.tickets.filter((t) => canSeeTicket(t, viewer, settings.helpdesk));
  const visibleProjects = store.projects.filter((p) => canSeeProject(p, viewer));
  const visibleTasks = store.tasks.filter((t) => canSeeTask(t, store.projects, viewer));
  const activeAdmins = access.doc.admins.filter((a) => a.status === 'active');
  const nameOf = (id: string) => (id ? activeAdmins.find((a) => a.id === id)?.name ?? access.doc.admins.find((a) => a.id === id)?.name ?? id : 'Unassigned');
  return { ready: ready && access.ready, access, settings, me, viewer, admins: activeAdmins, nameOf, tickets: visibleTickets, allTickets: store.tickets, tasks: visibleTasks, allTasks: store.tasks, projects: visibleProjects, setTickets, setTasks, setProjects, now: demoNow(), today: demoToday() };
}
export type WorkApi = ReturnType<typeof useWork>;

const zoneOf = (center: string) => ((LIVE ? orgMap : null) ?? mockOrgStructure).centers.find((c) => c.name === center)?.zone ?? '';   // live: this organization's map
function viewerFor(id: string, roleId: string, inScope: (zone: string, center?: string) => boolean, orgWide: boolean): Viewer {
  return { id, roleId, orgWide, inScope: (center: string) => inScope(zoneOf(center), center) };
}

/** Handy wrappers used by several screens. */
export const actions = { reply, note, setStatus, assign, requesterReply };
/** Sidebar badges share one subscription (the shell renders both). */
function useBadges() {
  const access = useAccess();
  const [n, setN] = useState({ tickets: 0, tasks: 0 });
  useEffect(() => {
    if (!access.ready) return;
    const viewer = viewerFor(access.me?.id ?? '', access.role?.id ?? 'owner', access.inScope, !(access.role?.centerScoped || access.role?.zoneScoped || access.role?.areaScoped));
    const count = () => void loadWorkSettings().then((s) => {
      const st = ensureSeed(access.doc.admins as unknown as AdminLite[], s); const today = demoToday();
      setN({
        tickets: st.tickets.filter((t) => canSeeTicket(t, viewer, s.helpdesk) && !['solved', 'closed'].includes(t.status) && !t.mergedInto).length,
        tasks: st.tasks.filter((t) => t.status !== 'done' && t.owner === viewer.id && !!t.due && t.due <= today).length,
      });
    });
    count(); window.addEventListener(WORK_EVENT, count); return () => window.removeEventListener(WORK_EVENT, count);
  }, [access.ready, access.me?.id, access.dashIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  return n;
}
/** Open tickets the signed-in admin can see. */
export const useHelpdeskBadge = () => useBadges().tickets;
/** My tasks due today or overdue. */
export const useMyTasksBadge = () => useBadges().tasks;
