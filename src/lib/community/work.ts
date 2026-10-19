/**
 * Help desk and Team tasks – the shared contract (synced to the admin by admin/scripts/sync-contracts.mjs; edit here).
 * Research: admin/memory/research/tickets-and-tasks.md. BE: BE/memory/api-contract-tickets.md.
 *
 *   Help desk  = people OUTSIDE the team (members, visitors, donors) ask, complain or give feedback; the team answers
 *                on time. Categories route a ticket to an owner, priorities carry two targets (first response and
 *                solve), the clock can count business hours and pauses while waiting on the requester.
 *   Team tasks = the team's OWN work: projects, owners, due dates, checklists, sub-tasks, recurring tasks and
 *                project templates with dates relative to an anchor day (Eid, AGM, Election Day).
 *
 * Everything an organization would decide differently is in the `work-settings` document (WorkSettingsSchema).
 * Tickets and tasks themselves are rows (BE tables), not part of the document. No React here – the API shares it.
 */
import { z } from 'zod';

/* =============================== settings document =============================== */

export const PRIORITY_KEYS = ['urgent', 'high', 'normal', 'low'] as const;
export type TicketPriority = (typeof PRIORITY_KEYS)[number];
export const PRIORITY_LABEL: Record<TicketPriority, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };
export type AdminLike = { id: string; name: string; roleId: string; centers: string[]; status: string; more?: { roleId: string; centers: string[] }[] };

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 09:00.');
const slug = z.string().regex(/^[a-z0-9-]{2,40}$/, 'Use lowercase letters, numbers and dashes.');
const Target = z.object({
  firstResponseHours: z.number().min(0.5).max(24 * 60),
  solveHours: z.number().min(1).max(24 * 120),
});
export const CategorySchema = z.object({
  id: slug,
  label: z.string().trim().min(2).max(60),
  description: z.string().max(200).default(''),
  defaultPriority: z.enum(PRIORITY_KEYS).default('normal'),
  /** Who gets a new ticket: a named admin, "the role at the ticket's masjid" (falls back to the same role anywhere), or nobody (Unassigned). */
  owner: z.object({ kind: z.enum(['none', 'admin', 'role']), id: z.string().max(60).default('') }).default({ kind: 'none', id: '' }),
  /** Shown as a choice on the website forms and in the member portal. */
  onWebsite: z.boolean().default(true),
  /** Only the owner, the creator, watchers and senior roles see these (conduct complaints, private matters). */
  restricted: z.boolean().default(false),
  /** Role told when a ticket of this category goes late ('' = the owner only). */
  escalateTo: z.string().max(60).default(''),
  archived: z.boolean().default(false),
});
export type Category = z.infer<typeof CategorySchema>;
export const SavedReplySchema = z.object({
  id: slug, title: z.string().trim().min(2).max(80), body: z.string().trim().min(2).max(2000), categoryId: z.string().max(40).default(''),
});
export type SavedReply = z.infer<typeof SavedReplySchema>;

export const TASK_STATUS_KEYS = ['todo', 'doing', 'waiting', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUS_KEYS)[number];
export const LabelSchema = z.object({ id: slug, label: z.string().trim().min(1).max(30), color: z.enum(['green', 'blue', 'amber', 'red', 'violet', 'gray']).default('gray') });
export const TemplateTaskSchema = z.object({
  title: z.string().trim().min(2).max(140),
  /** Days from the anchor day (negative = before). */
  offsetDays: z.number().int().min(-365).max(365),
  priority: z.enum(PRIORITY_KEYS).default('normal'),
  checklist: z.array(z.string().trim().min(1).max(140)).max(30).default([]),
  /** Optional: who usually does it (a role id) – the person creating the project may change it. */
  roleId: z.string().max(60).default(''),
});
export const TemplateSchema = z.object({
  id: slug, name: z.string().trim().min(2).max(80), description: z.string().max(300).default(''),
  anchorLabel: z.string().trim().min(2).max(40).default('Event day'),
  tasks: z.array(TemplateTaskSchema).min(1).max(80),
});
export type ProjectTemplate = z.infer<typeof TemplateSchema>;

/* ---------------- D5 – system work queues: who gets what, and the two follow-up queues ---------------- */
/** The queues the system fills by itself (members/queues). Labels are the product's; an organization renames them in Settings. */
export const QUEUE_KEYS = ['applications', 'id', 'center', 'duplicates', 'payments', 'incomplete', 'missing'] as const;
export type QueueKey = (typeof QUEUE_KEYS)[number];
export const QUEUE_LABEL: Record<QueueKey, string> = { applications: 'Applications', id: 'Photo ID checks', center: 'Center changes', duplicates: 'Possible duplicates', payments: 'Payments to fix', incomplete: 'Incomplete applications', missing: 'Missing information' };
const QueueOwner = z.object({ kind: z.enum(['admin', 'role']), id: z.string().max(60) });
export const QueueRouteSchema = z.object({
  /** People (admins) or roles (the role at the case's masjid, else anywhere) that get these cases by default. */
  owners: z.array(QueueOwner).max(10).default([]),
  /** round-robin = spread evenly over everyone who matched; first = always the first match. */
  share: z.enum(['round-robin', 'first']).default('round-robin'),
  /** Days the office promises (the queue's target). */
  targetDays: z.number().int().min(1).max(90).default(7),
  /** Role told when a case passes its target ('' = nobody). */
  escalateTo: z.string().max(60).default(''),
  label: z.string().max(60).default(''),                        // '' = the product's label
});
export type QueueRoute = z.infer<typeof QueueRouteSchema>;
export const QueuesSettingsSchema = z.object({
  routing: z.record(z.string(), QueueRouteSchema).default({}),
  followUps: z.object({
    /** Someone verified their email (and maybe a phone) and left before paying. */
    incomplete: z.object({ enabled: z.boolean().default(true), afterHours: z.number().int().min(1).max(720).default(24), giveUpDays: z.number().int().min(1).max(365).default(30) }).default({}),
    /** Members whose record lacks what the organization needs (election season, cards, receipts). */
    missing: z.object({ enabled: z.boolean().default(true), fields: z.array(z.enum(['phone', 'address', 'dob', 'id', 'email'])).max(5).default(['phone', 'address', 'dob', 'id']) }).default({}),
  }).default({}),
  /** Show "On your desk" first when someone signs in. */
  todayOnSignIn: z.boolean().default(true),
});
export type QueuesSettings = z.infer<typeof QueuesSettingsSchema>;
export const DEFAULT_QUEUES: QueuesSettings = QueuesSettingsSchema.parse({});
/** Who a new case of this queue goes to: the owners resolved to active admins (a role = the role at that masjid, else anywhere), then spread. '' = unassigned. */
export function routeQueueCase(route: QueueRoute | undefined, center: string, admins: AdminLike[], caseId: string): string {
  if (!route?.owners.length) return '';
  const active = admins.filter((a) => a.status === 'active');
  const holds = (a: AdminLike, roleId: string, at: string) => [{ roleId: a.roleId, centers: a.centers }, ...(a.more ?? [])].some((r) => r.roleId === roleId && (!at || r.centers.includes(at)));
  const people: string[] = [];
  for (const o of route.owners) {
    if (o.kind === 'admin') { if (active.some((a) => a.id === o.id) && !people.includes(o.id)) people.push(o.id); continue; }
    const here = center ? active.filter((a) => holds(a, o.id, center)) : [];
    for (const a of (here.length ? here : active.filter((a) => holds(a, o.id, '')))) if (!people.includes(a.id)) people.push(a.id);
  }
  if (!people.length) return '';
  if (route.share === 'first') return people[0];
  let h = 0; for (const ch of caseId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;   // stable: the same case always lands on the same person
  return people[h % people.length];
}
/** The queue's label as this organization calls it. */
export const queueLabel = (q: QueuesSettings | undefined, key: QueueKey) => q?.routing[key]?.label || QUEUE_LABEL[key];

export const WorkSettingsSchema = z.object({
  queues: QueuesSettingsSchema.default({}),
  helpdesk: z.object({
    enabled: z.boolean().default(true),
    /** business = targets count only working hours; calendar = every hour counts. */
    clock: z.enum(['business', 'calendar']).default('business'),
    hours: z.object({ days: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5]), start: hhmm.default('09:00'), end: hhmm.default('17:00') }).default({}),
    targets: z.object({ urgent: Target, high: Target, normal: Target, low: Target }),
    /** "Due soon" when less than this share of the target is left. */
    dueSoonPercent: z.number().int().min(5).max(75).default(25),
    /** A solved ticket closes by itself after N days without a reply (0 = never). */
    autoCloseDays: z.number().int().min(0).max(90).default(7),
    satisfaction: z.boolean().default(true),
    acknowledgement: z.string().max(600).default(''),
    /** Website forms that create tickets. */
    websiteForms: z.boolean().default(true),
    /** Roles (ids) that see restricted tickets besides owner, creator and watchers. */
    seniorRoles: z.array(z.string().max(60)).max(20).default(['owner', 'admin']),
    categories: z.array(CategorySchema).min(1).max(60),
    savedReplies: z.array(SavedReplySchema).max(200).default([]),
  }),
  tasks: z.object({
    enabled: z.boolean().default(true),
    statusLabels: z.object({ todo: z.string().min(1).max(24), doing: z.string().min(1).max(24), waiting: z.string().min(1).max(24), done: z.string().min(1).max(24) }).default({ todo: 'To do', doing: 'Doing', waiting: 'Waiting', done: 'Done' }),
    labels: z.array(LabelSchema).max(40).default([]),
    templates: z.array(TemplateSchema).max(60).default([]),
  }),
}).superRefine((d, ctx) => {
  const dup = (path: (string | number)[], ids: string[], what: string) => { const seen = new Set<string>(); ids.forEach((id, i) => { if (seen.has(id)) ctx.addIssue({ code: 'custom', path: [...path, i, 'id'], message: `Two ${what} use the ID “${id}”.` }); seen.add(id); }); };
  dup(['helpdesk', 'categories'], d.helpdesk.categories.map((c) => c.id), 'categories');
  dup(['helpdesk', 'savedReplies'], d.helpdesk.savedReplies.map((c) => c.id), 'saved replies');
  dup(['tasks', 'labels'], d.tasks.labels.map((c) => c.id), 'labels');
  dup(['tasks', 'templates'], d.tasks.templates.map((c) => c.id), 'templates');
  if (d.helpdesk.hours.start >= d.helpdesk.hours.end) ctx.addIssue({ code: 'custom', path: ['helpdesk', 'hours', 'end'], message: 'The working day must end after it starts.' });
  PRIORITY_KEYS.forEach((p) => { const t = d.helpdesk.targets[p]; if (t.firstResponseHours > t.solveHours) ctx.addIssue({ code: 'custom', path: ['helpdesk', 'targets', p, 'firstResponseHours'], message: `${PRIORITY_LABEL[p]}: the first reply target cannot be longer than the solve target.` }); });
  if (!d.helpdesk.categories.some((c) => !c.archived)) ctx.addIssue({ code: 'custom', path: ['helpdesk', 'categories'], message: 'Keep at least one category in use.' });
  d.helpdesk.categories.forEach((c, i) => { if (c.owner.kind !== 'none' && !c.owner.id) ctx.addIssue({ code: 'custom', path: ['helpdesk', 'categories', i, 'owner', 'id'], message: `${c.label}: pick who gets these tickets.` }); });
});
export type WorkSettings = z.infer<typeof WorkSettingsSchema>;

/* =============================== tickets (rows) =============================== */

export const TICKET_STATUS = { new: 'New', open: 'Open', waiting: 'Waiting on requester', hold: 'On hold', solved: 'Solved', closed: 'Closed' } as const;
export type TicketStatus = keyof typeof TICKET_STATUS;
export const CHANNELS = { website: 'Website form', portal: 'Member portal', email: 'Email', phone: 'Phone', 'walk-in': 'Walk-in', staff: 'Staff' } as const;
export type Channel = keyof typeof CHANNELS;
export type LinkRef = { kind: 'member' | 'event' | 'donation' | 'task' | 'ticket'; id: string; label: string };
export type TicketEvent = {
  id: string; at: string; by: string;
  kind: 'created' | 'reply' | 'requester' | 'note' | 'status' | 'assign' | 'priority' | 'category' | 'merge' | 'link' | 'csat' | 'escalated' | 'watch' | 'tag';
  text?: string; status?: TicketStatus; to?: string; mentions?: string[];
};
export type Ticket = {
  id: string; subject: string; categoryId: string; channel: Channel;
  requester: { name: string; email: string; phone: string; memberId: string };
  center: string;                    // '' = the organization
  assignee: string;                  // admin id, '' = unassigned
  watchers: string[]; tags: string[];
  priority: TicketPriority; status: TicketStatus; restricted: boolean;
  createdAt: string; createdBy: string;   // local Houston time 'YYYY-MM-DDTHH:mm:ss'
  firstResponseAt: string; solvedAt: string; closedAt: string;
  mergedInto: string; links: LinkRef[];
  csat: null | { score: 'good' | 'bad'; comment: string; at: string };
  events: TicketEvent[];
};
export const isOpenTicket = (t: Ticket) => !['solved', 'closed'].includes(t.status) && !t.mergedInto;
/** The website / portal form a ticket arrives with (BE: POST /public/tickets, /member/tickets). */
export const PublicTicketSchema = z.object({
  categoryId: slug, subject: z.string().trim().min(4, 'Give it a short title.').max(140), detail: z.string().trim().min(10, 'Tell us a little more (10 characters or more).').max(5000),
  name: z.string().trim().min(2).max(120), email: z.string().trim().email('Use a working email so we can answer.').max(200), phone: z.string().max(30).default(''),
  center: z.string().max(80).default(''), memberId: z.string().max(40).default(''),
});
export type PublicTicket = z.infer<typeof PublicTicketSchema>;

/** What the website and member portal may know: categories people can pick (never owners, roles or saved replies). */
export function publicHelpdesk(s: WorkSettings) {
  const h = s.helpdesk;
  return { enabled: h.enabled && h.websiteForms, satisfaction: h.satisfaction, categories: h.categories.filter((c) => c.onWebsite && !c.archived).map((c) => ({ id: c.id, label: c.label, description: c.description, private: c.restricted })) };
}
export type PublicHelpdesk = ReturnType<typeof publicHelpdesk>;
/** What a member sees of their own ticket (no internal notes, no owner names). */
export const MEMBER_STATUS: Record<TicketStatus, string> = { new: 'Received', open: 'We are working on it', waiting: 'Waiting for your answer', hold: 'We are working on it', solved: 'Solved', closed: 'Closed' };
export function memberView(t: Ticket) {
  return { id: t.id, subject: t.subject, status: MEMBER_STATUS[t.status], createdAt: t.createdAt, messages: t.events.filter((e) => ['created', 'reply', 'requester'].includes(e.kind)).map((e) => ({ at: e.at, from: e.kind === 'reply' ? 'team' as const : 'you' as const, text: e.text ?? '' })) };
}

/* ---------------- time helpers (local Houston wall-clock strings; no time zones inside) ---------------- */
const ms = (iso: string) => Date.parse(`${iso.length === 10 ? `${iso}T00:00:00` : iso.slice(0, 19)}Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 19);
const MIN = 60_000;
const dayStart = (t: number) => t - (t % 86_400_000);
const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
type Hours = WorkSettings['helpdesk']['hours'];
/** Working minutes between two moments (business clock). */
export function businessMinutesBetween(from: string, to: string, h: Hours): number {
  let a = ms(from); const b = ms(to); if (b <= a) return 0;
  let total = 0;
  while (a < b) {
    const d0 = dayStart(a); const wd = new Date(d0).getUTCDay();
    if (h.days.includes(wd)) { const s = d0 + hm(h.start) * MIN, e = d0 + hm(h.end) * MIN; total += Math.max(0, Math.min(e, b) - Math.max(s, a)); }
    a = d0 + 86_400_000;
  }
  return Math.round(total / MIN);
}
/** Add working minutes to a moment (business clock). */
export function addBusinessMinutes(from: string, minutes: number, h: Hours): string {
  let t = ms(from); let left = minutes;
  for (let guard = 0; guard < 3660; guard++) {
    const d0 = dayStart(t); const wd = new Date(d0).getUTCDay();
    if (h.days.includes(wd)) {
      const s = d0 + hm(h.start) * MIN, e = d0 + hm(h.end) * MIN; const from2 = Math.max(t, s);
      if (from2 < e) { const room = (e - from2) / MIN; if (left <= room) return iso(from2 + left * MIN); left -= room; }
    }
    t = d0 + 86_400_000;
  }
  return iso(t);
}
const minutesBetween = (from: string, to: string, s: WorkSettings['helpdesk']) => (s.clock === 'business' ? businessMinutesBetween(from, to, s.hours) : Math.max(0, Math.round((ms(to) - ms(from)) / MIN)));
const addMinutes = (from: string, m: number, s: WorkSettings['helpdesk']) => (s.clock === 'business' ? addBusinessMinutes(from, m, s.hours) : iso(ms(from) + m * MIN));

/** Minutes the solve clock stood still because the ticket waited on the requester (up to `now`). */
export function pausedMinutes(t: Ticket, s: WorkSettings['helpdesk'], now: string): number {
  let total = 0; let since = '';
  const changes = t.events.filter((e) => e.status).sort((a, b) => a.at.localeCompare(b.at));
  for (const e of changes) {
    if (e.status === 'waiting' && !since) since = e.at;
    else if (e.status !== 'waiting' && since) { total += minutesBetween(since, e.at, s); since = ''; }
  }
  if (since && t.status === 'waiting') total += minutesBetween(since, now, s);
  return total;
}
export type Clock = { due: string; state: 'met' | 'missed' | 'ok' | 'soon' | 'late' | 'paused'; minutesLeft: number };
/** The two targets of a ticket: first response and solve, with "due soon" and the pause while waiting on the requester. */
export function ticketClocks(t: Ticket, s: WorkSettings['helpdesk'], now: string): { first: Clock; solve: Clock } {
  const tg = s.targets[t.priority];
  const mk = (targetMin: number, doneAt: string, extra: number, paused: boolean): Clock => {
    const due = addMinutes(t.createdAt, targetMin + extra, s);
    if (doneAt) return { due, state: doneAt <= due ? 'met' : 'missed', minutesLeft: 0 };
    const left = (s.clock === 'business' ? (now < due ? businessMinutesBetween(now, due, s.hours) : -businessMinutesBetween(due, now, s.hours)) : Math.round((ms(due) - ms(now)) / MIN));
    if (paused) return { due, state: 'paused', minutesLeft: left };
    return { due, state: left < 0 ? 'late' : left <= (targetMin * s.dueSoonPercent) / 100 ? 'soon' : 'ok', minutesLeft: left };
  };
  return {
    first: mk(tg.firstResponseHours * 60, t.firstResponseAt || (t.mergedInto ? t.createdAt : ''), 0, false),
    solve: mk(tg.solveHours * 60, t.solvedAt || t.closedAt || (t.mergedInto ? t.createdAt : ''), pausedMinutes(t, s, now), t.status === 'waiting'),
  };
}
/** The clock that matters now (first response until someone replied, then solve). */
export const activeClock = (t: Ticket, s: WorkSettings['helpdesk'], now: string): Clock => { const c = ticketClocks(t, s, now); return !t.firstResponseAt && isOpenTicket(t) ? (c.first.state === 'late' || c.solve.state !== 'late' ? c.first : c.solve) : c.solve; };
export const humanMinutes = (m: number) => { const a = Math.abs(m); if (a === 0) return 'now'; if (a < 60) return `${a} min`; if (a < 60 * 24) return `${Math.round(a / 60)} h`; return `${Math.round(a / 60 / 24)} d`; };

/* ---------------- routing, visibility, replies ---------------- */
/** Who gets a new ticket of this category at this masjid. */
export function routeOwner(cat: Category | undefined, center: string, admins: AdminLike[]): string {
  if (!cat || cat.owner.kind === 'none') return '';
  const active = admins.filter((a) => a.status === 'active');
  if (cat.owner.kind === 'admin') return active.some((a) => a.id === cat.owner.id) ? cat.owner.id : '';
  const holds = (a: AdminLike, at: string) => [{ roleId: a.roleId, centers: a.centers }, ...(a.more ?? [])].some((r) => r.roleId === cat.owner.id && (!at || r.centers.includes(at)));
  return (center && active.find((a) => holds(a, center))?.id) || active.find((a) => holds(a, ''))?.id || '';
}
export type Viewer = { id: string; roleId: string; inScope: (center: string) => boolean; orgWide: boolean; name?: string };
/** Masjid roles see their masjid's tickets and tickets assigned to them; restricted tickets only the people involved and senior roles. */
export function canSeeTicket(t: Ticket, v: Viewer, s: WorkSettings['helpdesk']): boolean {
  const involved = t.assignee === v.id || t.watchers.includes(v.id) || t.createdBy === v.id;
  if (t.restricted && !involved && !s.seniorRoles.includes(v.roleId)) return false;
  if (involved) return true;
  return t.center ? v.inScope(t.center) : v.orgWide;
}
/** Saved reply with merge fields: {{first_name}} {{name}} {{ticket}} {{subject}} {{masjid}} {{agent}} {{organization}}. Unknown fields stay visible so nobody sends "{{x}}" unnoticed. */
export function fillReply(body: string, t: Ticket, ctx: { agent: string; organization: string }): string {
  const first = t.requester.name.split(/\s+/)[0] || 'there';
  const map: Record<string, string> = { first_name: first, name: t.requester.name || 'there', ticket: t.id, subject: t.subject, masjid: t.center || ctx.organization, agent: ctx.agent, organization: ctx.organization };
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => map[k] ?? m);
}
export const unfilledFields = (text: string) => Array.from(new Set(Array.from(text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)).map((m) => m[1])));
export const mentionsIn = (text: string, admins: { id: string; name: string }[]) => admins.filter((a) => text.toLowerCase().includes(`@${a.name.toLowerCase()}`) || text.toLowerCase().includes(`@${a.id}`)).map((a) => a.id);

/* ---------------- changes (pure; every change is one event on the thread) ---------------- */
let seq = 0;
export const eventId = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;
export type Actor = { id: string; name: string };
const ev = (by: Actor, at: string, e: Omit<TicketEvent, 'id' | 'at' | 'by'>): TicketEvent => ({ id: eventId(), at, by: by.name, ...e });
export function setStatus(t: Ticket, status: TicketStatus, by: Actor, at: string, text = ''): Ticket {
  if (t.status === status) return t;
  return { ...t, status, solvedAt: status === 'solved' ? at : status === 'closed' ? t.solvedAt || at : '', closedAt: status === 'closed' ? at : '', events: [...t.events, ev(by, at, { kind: 'status', status, text: text || `Status: ${TICKET_STATUS[status]}` })] };
}
/** A public reply: counts as the first response; New becomes Open (or the status picked with the reply). */
export function reply(t: Ticket, text: string, by: Actor, at: string, status?: TicketStatus): Ticket {
  let n: Ticket = { ...t, firstResponseAt: t.firstResponseAt || at, events: [...t.events, ev(by, at, { kind: 'reply', text })] };
  const next = status ?? (t.status === 'new' ? 'open' : t.status);
  if (next !== n.status) n = setStatus(n, next, by, at);
  return n;
}
export function note(t: Ticket, text: string, by: Actor, at: string, admins: { id: string; name: string }[]): Ticket {
  const mentions = mentionsIn(text, admins);
  return { ...t, watchers: Array.from(new Set([...t.watchers, ...mentions])), events: [...t.events, ev(by, at, { kind: 'note', text, mentions })] };
}
/** The requester wrote back: a solved or waiting ticket opens again. */
export function requesterReply(t: Ticket, text: string, at: string): Ticket {
  const by = { id: '', name: t.requester.name || 'Requester' };
  let n: Ticket = { ...t, events: [...t.events, ev(by, at, { kind: 'requester', text })] };
  if (['waiting', 'solved'].includes(t.status)) n = setStatus(n, 'open', by, at, 'Reopened by the requester’s reply.');
  return n;
}
export function assign(t: Ticket, to: string, toName: string, by: Actor, at: string): Ticket {
  if (t.assignee === to) return t;
  return { ...t, assignee: to, status: t.status === 'new' && to ? 'open' : t.status, events: [...t.events, ev(by, at, { kind: 'assign', to, text: to ? `Assigned to ${toName}.` : 'Unassigned.' })] };
}
/** Merge `dup` into `main`: the thread moves (marked), the duplicate closes and points at the main ticket. */
export function merge(main: Ticket, dup: Ticket, by: Actor, at: string): [Ticket, Ticket] {
  if (main.id === dup.id) return [main, dup];
  const moved = dup.events.filter((e) => ['created', 'reply', 'requester', 'note'].includes(e.kind)).map((e) => ({ ...e, id: eventId(), text: `[from ${dup.id}] ${e.text ?? ''}`.trim() }));
  const m: Ticket = { ...main, watchers: Array.from(new Set([...main.watchers, ...dup.watchers, ...(dup.assignee ? [dup.assignee] : [])])), tags: Array.from(new Set([...main.tags, ...dup.tags])), events: [...main.events, ...moved, ev(by, at, { kind: 'merge', text: `${dup.id} merged into this ticket.` })].sort((a, b) => a.at.localeCompare(b.at)) };
  const d: Ticket = { ...dup, mergedInto: main.id, status: 'closed', closedAt: at, events: [...dup.events, ev(by, at, { kind: 'merge', text: `Merged into ${main.id}.` })] };
  return [m, d];
}
/** Solved tickets with no reply for N days close by themselves (the BE runs this nightly). */
export function autoClose(list: Ticket[], s: WorkSettings['helpdesk'], now: string): Ticket[] {
  if (!s.autoCloseDays) return list;
  return list.map((t) => (t.status === 'solved' && t.solvedAt && ms(now) - ms(t.solvedAt) >= s.autoCloseDays * 86_400_000 ? setStatus(t, 'closed', { id: 'system', name: 'System' }, now, `Closed automatically after ${s.autoCloseDays} days.`) : t));
}
export function newTicket(p: { id: string; subject: string; detail: string; categoryId: string; channel: Channel; requester: Ticket['requester']; center: string; priority?: TicketPriority; assignee?: string; createdBy: Actor; at: string; restricted?: boolean; tags?: string[] }, s: WorkSettings['helpdesk'], admins: AdminLike[]): Ticket {
  const cat = s.categories.find((c) => c.id === p.categoryId);
  const assignee = p.assignee ?? routeOwner(cat, p.center, admins);
  return {
    id: p.id, subject: p.subject, categoryId: p.categoryId, channel: p.channel, requester: p.requester, center: p.center, assignee, watchers: [], tags: p.tags ?? [],
    priority: p.priority ?? cat?.defaultPriority ?? 'normal', status: assignee ? 'open' : 'new', restricted: p.restricted ?? cat?.restricted ?? false,
    createdAt: p.at, createdBy: p.createdBy.id || p.createdBy.name, firstResponseAt: '', solvedAt: '', closedAt: '', mergedInto: '', links: [], csat: null,
    events: [{ id: eventId(), at: p.at, by: p.channel === 'staff' || p.channel === 'phone' || p.channel === 'walk-in' ? p.createdBy.name : p.requester.name || 'Requester', kind: 'created', text: p.detail }],
  };
}
export const nextTicketNumber = (list: { id: string }[]) => `T-${list.reduce((a, t) => Math.max(a, Number(t.id.replace(/\D/g, '')) || 0), 1040) + 1}`;

/* ---------------- dashboard numbers ---------------- */
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
export function helpdeskStats(list: Ticket[], s: WorkSettings['helpdesk'], now: string) {
  const live = list.filter((t) => !t.mergedInto);
  const open = live.filter(isOpenTicket);
  const clocks = live.map((t) => ({ t, c: ticketClocks(t, s, now) }));
  const answered = live.filter((t) => t.firstResponseAt);
  const solved = live.filter((t) => t.solvedAt);
  const judged = clocks.filter(({ c }) => c.solve.state === 'met' || c.solve.state === 'missed');
  const rated = live.filter((t) => t.csat);
  return {
    open: open.length,
    unassigned: open.filter((t) => !t.assignee).length,
    late: clocks.filter(({ t, c }) => isOpenTicket(t) && (c.first.state === 'late' || c.solve.state === 'late')).length,
    soon: clocks.filter(({ t, c }) => isOpenTicket(t) && (c.first.state === 'soon' || c.solve.state === 'soon')).length,
    waiting: open.filter((t) => t.status === 'waiting').length,
    medianFirstResponseMin: median(answered.map((t) => minutesBetween(t.createdAt, t.firstResponseAt, s))),
    medianSolveMin: median(solved.map((t) => minutesBetween(t.createdAt, t.solvedAt, s))),
    targetsMetPct: judged.length ? Math.round((judged.filter(({ c }) => c.solve.state === 'met').length / judged.length) * 100) : 0,
    satisfactionPct: rated.length ? Math.round((rated.filter((t) => t.csat!.score === 'good').length / rated.length) * 100) : 0,
    rated: rated.length,
    byCategory: s.categories.map((c) => ({ id: c.id, label: c.label, open: open.filter((t) => t.categoryId === c.id).length, all: live.filter((t) => t.categoryId === c.id).length })).filter((x) => x.all),
  };
}

/* =============================== team tasks (rows) =============================== */

export type ChecklistItem = { id: string; text: string; done: boolean };
export type Repeat = { every: 'week' | 'month' | 'year'; interval: number };
export type TaskComment = { at: string; by: string; text: string };
export type Project = {
  id: string; name: string; color: 'green' | 'blue' | 'amber' | 'red' | 'violet' | 'gray'; owner: string; center: string;
  /** members = only the people in `members`; masjid = everyone working at that masjid; organization = every admin. */
  visibility: 'members' | 'masjid' | 'organization';
  members: string[]; due: string; anchor: string; templateId: string; archived: boolean; createdAt: string; description: string;
};
export type Task = {
  id: string; projectId: string; parentId: string; title: string; notes: string; owner: string; helpers: string[];
  status: TaskStatus; priority: TicketPriority; start: string; due: string; labels: string[];
  checklist: ChecklistItem[]; repeat: Repeat | null; links: LinkRef[]; comments: TaskComment[];
  createdAt: string; createdBy: string; doneAt: string; order: number;
};
const addDaysISO = (d: string, n: number) => iso(ms(d.slice(0, 10)) + n * 86_400_000).slice(0, 10);
const addMonthsISO = (d: string, n: number) => { const t = new Date(ms(d.slice(0, 10))); const day = t.getUTCDate(); t.setUTCDate(1); t.setUTCMonth(t.getUTCMonth() + n); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(day, last)); return t.toISOString().slice(0, 10); };
/** Next due date of a recurring task (keeps the 31st as the month's last day). */
export function nextDue(due: string, r: Repeat): string {
  const n = Math.max(1, r.interval);
  return r.every === 'week' ? addDaysISO(due, 7 * n) : r.every === 'month' ? addMonthsISO(due, n) : addMonthsISO(due, 12 * n);
}
let tseq = 0;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}${(tseq++).toString(36)}`;
/** Done: a recurring task leaves the next one behind (same owner, checklist unticked, next date). */
export function completeTask(list: Task[], id: string, by: Actor, at: string): Task[] {
  const t = list.find((x) => x.id === id); if (!t || t.status === 'done') return list;
  const done: Task = { ...t, status: 'done', doneAt: at, comments: [...t.comments, { at, by: by.name, text: 'Marked done.' }] };
  const out = list.map((x) => (x.id === id ? done : x));
  if (t.repeat && t.due) {
    const due = nextDue(t.due, t.repeat);
    out.push({ ...t, id: newId('task'), status: 'todo', due, start: t.start ? addDaysISO(t.start, Math.round((ms(due) - ms(t.due)) / 86_400_000)) : '', doneAt: '', checklist: t.checklist.map((c) => ({ ...c, done: false })), createdAt: at, createdBy: t.createdBy, comments: [{ at, by: 'Repeat', text: `Next one after ${t.due}.` }] });
  }
  return out;
}
export function reopenTask(list: Task[], id: string): Task[] { return list.map((x) => (x.id === id ? { ...x, status: 'todo', doneAt: '' } : x)); }
export type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'nodate' | 'done';
export const BUCKET_LABEL: Record<Bucket, string> = { overdue: 'Overdue', today: 'Today', week: 'Next 7 days', later: 'Later', nodate: 'No date', done: 'Done' };
export function bucketOf(t: Task, today: string): Bucket {
  if (t.status === 'done') return 'done';
  if (!t.due) return 'nodate';
  if (t.due < today) return 'overdue';
  if (t.due === today) return 'today';
  return t.due <= addDaysISO(today, 7) ? 'week' : 'later';
}
/** A project from a template: every task's due date = anchor + offset; owners from the template's role where someone holds it. */
export function projectFromTemplate(tpl: ProjectTemplate, p: { name: string; anchor: string; owner: string; center: string; by: Actor; at: string; visibility?: Project['visibility'] }, admins: AdminLike[]): { project: Project; tasks: Task[] } {
  const project: Project = { id: newId('prj'), name: p.name, color: 'green', owner: p.owner, center: p.center, visibility: p.visibility ?? (p.center ? 'masjid' : 'organization'), members: [p.owner], due: addDaysISO(p.anchor, Math.max(0, ...tpl.tasks.map((t) => t.offsetDays))), anchor: p.anchor, templateId: tpl.id, archived: false, createdAt: p.at, description: tpl.description };
  const who = (roleId: string) => (roleId ? routeOwner({ id: 'x', label: 'x', description: '', defaultPriority: 'normal', owner: { kind: 'role', id: roleId }, onWebsite: false, restricted: false, escalateTo: '', archived: false }, p.center, admins) : '') || p.owner;
  const tasks: Task[] = tpl.tasks.map((x, i) => ({ id: newId('task'), projectId: project.id, parentId: '', title: x.title, notes: '', owner: who(x.roleId), helpers: [], status: 'todo', priority: x.priority, start: '', due: addDaysISO(p.anchor, x.offsetDays), labels: [], checklist: x.checklist.map((c, j) => ({ id: `c${i}-${j}`, text: c, done: false })), repeat: null, links: [], comments: [], createdAt: p.at, createdBy: p.by.name, doneAt: '', order: i }));
  project.members = Array.from(new Set([p.owner, ...tasks.map((t) => t.owner)]));
  return { project, tasks };
}
export function canSeeProject(pr: Project, v: Viewer): boolean {
  if (pr.owner === v.id || pr.members.includes(v.id)) return true;
  if (pr.visibility === 'organization') return v.orgWide || !pr.center || v.inScope(pr.center);
  if (pr.visibility === 'masjid') return !!pr.center && v.inScope(pr.center);
  return false;
}
/** Tasks a person can see: their own, those they help with, and those in projects they can see. */
export const canSeeTask = (t: Task, projects: Project[], v: Viewer) => t.owner === v.id || t.helpers.includes(v.id) || t.createdBy === v.id || (!!v.name && t.createdBy === v.name) || (!!t.projectId && !!projects.find((p) => p.id === t.projectId && canSeeProject(p, v)));
export function projectProgress(pr: Project, tasks: Task[], today: string) {
  const mine = tasks.filter((t) => t.projectId === pr.id && !t.parentId);
  const done = mine.filter((t) => t.status === 'done').length;
  const overdue = mine.filter((t) => bucketOf(t, today) === 'overdue').length;
  return { total: mine.length, done, overdue, pct: mine.length ? Math.round((done / mine.length) * 100) : 0, atRisk: overdue > 0 || (!!pr.due && pr.due < addDaysISO(today, 7) && done < mine.length) };
}
export function workload(tasks: Task[], today: string): { owner: string; open: number; overdue: number }[] {
  const m = new Map<string, { open: number; overdue: number }>();
  tasks.filter((t) => t.status !== 'done' && t.owner).forEach((t) => { const x = m.get(t.owner) ?? { open: 0, overdue: 0 }; x.open++; if (bucketOf(t, today) === 'overdue') x.overdue++; m.set(t.owner, x); });
  return Array.from(m, ([owner, x]) => ({ owner, ...x })).sort((a, b) => b.overdue - a.overdue || b.open - a.open);
}
/** Ticket → task: a linked task for the internal part of the work. */
export function taskFromTicket(t: Ticket, p: { owner: string; due: string; by: Actor; at: string; projectId?: string }): Task {
  return { id: newId('task'), projectId: p.projectId ?? '', parentId: '', title: `${t.subject} (${t.id})`, notes: '', owner: p.owner, helpers: [], status: 'todo', priority: t.priority, start: '', due: p.due, labels: [], checklist: [], repeat: null, links: [{ kind: 'ticket', id: t.id, label: t.subject }], comments: [], createdAt: p.at, createdBy: p.by.name, doneAt: '', order: 0 };
}

/* =============================== defaults and presets =============================== */

export const mockWorkSettings: WorkSettings = WorkSettingsSchema.parse({
  // D5 – the office's default routing (demo): the membership office owns most system queues, the treasurer owns payments,
  // center changes go to the Associate Director of the masjid asked for. Overdue cases are flagged to a senior role.
  queues: {
    routing: {
      applications: { owners: [{ kind: 'admin', id: 'membership-office' }], share: 'round-robin', targetDays: 7, escalateTo: 'general-secretary' },
      id: { owners: [{ kind: 'admin', id: 'membership-office' }], share: 'round-robin', targetDays: 3, escalateTo: 'general-secretary' },
      center: { owners: [{ kind: 'role', id: 'associate-director' }, { kind: 'admin', id: 'membership-office' }], share: 'first', targetDays: 14, escalateTo: 'zone-director' },
      duplicates: { owners: [{ kind: 'admin', id: 'owner' }, { kind: 'admin', id: 'membership-office' }], share: 'round-robin', targetDays: 7, escalateTo: '' },
      payments: { owners: [{ kind: 'admin', id: 'treasurer' }], share: 'round-robin', targetDays: 3, escalateTo: 'general-secretary' },
      incomplete: { owners: [{ kind: 'admin', id: 'membership-office' }], share: 'round-robin', targetDays: 5, escalateTo: '' },
      missing: { owners: [{ kind: 'admin', id: 'membership-office' }], share: 'round-robin', targetDays: 30, escalateTo: '' },
    },
    followUps: { incomplete: { enabled: true, afterHours: 24, giveUpDays: 30 }, missing: { enabled: true, fields: ['phone', 'address', 'dob', 'id'] } },
    todayOnSignIn: true,
  },
  helpdesk: {
    enabled: true, clock: 'business', hours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
    targets: { urgent: { firstResponseHours: 2, solveHours: 8 }, high: { firstResponseHours: 4, solveHours: 16 }, normal: { firstResponseHours: 8, solveHours: 40 }, low: { firstResponseHours: 16, solveHours: 80 } },
    dueSoonPercent: 25, autoCloseDays: 7, satisfaction: true, websiteForms: true, seniorRoles: ['owner', 'admin', 'president'],
    acknowledgement: 'Assalamu alaikum {{first_name}}, we have your message ({{ticket}}). {{masjid}} will answer within our working hours. JazakAllahu khayran for your patience.',
    categories: [
      { id: 'membership', label: 'Membership and dues', description: 'Joining, renewing, cards, household changes.', defaultPriority: 'normal', owner: { kind: 'admin', id: 'membership-office' }, escalateTo: 'membership-officer' },
      // D7 – from the review call: a member who cannot find their membership, or sits at the wrong center, opens a ticket from the portal
      { id: 'my-record', label: 'My membership record is wrong', description: 'Membership not found, wrong name or plan, a payment that does not show.', defaultPriority: 'high', owner: { kind: 'admin', id: 'membership-office' }, escalateTo: 'general-secretary', onWebsite: true },
      { id: 'my-center', label: 'My Islamic Center is wrong', description: 'The center or zone on the record is not where the member lives or prays.', defaultPriority: 'normal', owner: { kind: 'admin', id: 'membership-office' }, escalateTo: '', onWebsite: true },
      { id: 'donations', label: 'Donations and receipts', description: 'Receipts, recurring gifts, tax letters.', defaultPriority: 'high', owner: { kind: 'admin', id: 'treasurer' }, escalateTo: 'treasurer' },
      { id: 'facilities', label: 'Facilities and parking', description: 'Building, parking, cleanliness, safety.', defaultPriority: 'high', owner: { kind: 'role', id: 'associate-director' } },
      { id: 'events', label: 'Events and programs', description: 'Registration, classes, weekend school.', defaultPriority: 'normal', owner: { kind: 'role', id: 'associate-director' } },
      { id: 'website', label: 'Website and app', description: 'Something does not work or is hard to find.', defaultPriority: 'low', owner: { kind: 'admin', id: 'web-editor' } },
      { id: 'conduct', label: 'Complaint about conduct', description: 'Private – seen only by the people handling it.', defaultPriority: 'high', owner: { kind: 'admin', id: 'gen-secretary' }, restricted: true, escalateTo: 'president' },
      { id: 'feedback', label: 'Feedback and ideas', description: 'Thanks, suggestions, ideas.', defaultPriority: 'low', owner: { kind: 'none', id: '' } },
      { id: 'other', label: 'Something else', defaultPriority: 'normal', owner: { kind: 'admin', id: 'front-office' } },
    ],
    savedReplies: [
      { id: 'thanks-feedback', title: 'Thank you for the feedback', body: 'Assalamu alaikum {{first_name}},\n\nJazakAllahu khayran for taking the time to write to us. I have shared it with the team at {{masjid}}.\n\n{{agent}}' },
      { id: 'need-id', title: 'We need a photo ID', categoryId: 'membership', body: 'Assalamu alaikum {{first_name}},\n\nTo finish this ({{ticket}}) we need a photo of a government ID that shows the same name as your membership. You can upload it from your member home, or bring it to {{masjid}}.\n\n{{agent}}' },
      { id: 'receipt-resent', title: 'Receipt re-sent', categoryId: 'donations', body: 'Assalamu alaikum {{first_name}},\n\nI have corrected your receipt and sent it again to this email address. May Allah accept your gift.\n\n{{agent}}' },
      { id: 'looking-into-it', title: 'We are looking into it', body: 'Assalamu alaikum {{first_name}},\n\nThank you – {{masjid}} is looking into this and I will write again as soon as I know more.\n\n{{agent}}' },
    ],
  },
  tasks: {
    enabled: true,
    statusLabels: { todo: 'To do', doing: 'Doing', waiting: 'Waiting', done: 'Done' },
    labels: [{ id: 'board', label: 'Board', color: 'violet' }, { id: 'finance', label: 'Finance', color: 'green' }, { id: 'volunteers', label: 'Volunteers', color: 'blue' }, { id: 'urgent', label: 'Urgent', color: 'red' }, { id: 'print', label: 'Print', color: 'amber' }],
    templates: [
      { id: 'eid-prayer', name: 'Eid prayer at a masjid', description: 'Everything for one Eid prayer: permits, volunteers, parking, announcements.', anchorLabel: 'Eid day', tasks: [
        { title: 'Book the overflow space and confirm the city permit', offsetDays: -30, priority: 'high', roleId: 'associate-director', checklist: ['Permit form', 'Insurance letter', 'Neighbor notice'] },
        { title: 'Announce prayer times on the website and app', offsetDays: -10, roleId: 'website-editor', checklist: [] },
        { title: 'Recruit parking and security volunteers', offsetDays: -14, roleId: 'associate-director', checklist: ['Parking team (12)', 'Security team (6)', 'Sisters’ area (4)'] },
        { title: 'Order water and prayer rugs', offsetDays: -7, checklist: [] },
        { title: 'Volunteer briefing', offsetDays: -1, checklist: ['Map of the lots', 'Walkie-talkies charged'] },
        { title: 'Thank-you note to volunteers', offsetDays: 3, priority: 'low', checklist: [] },
      ] },
      { id: 'agm', name: 'Annual General Meeting', description: 'Notice, quorum, reports and minutes for the yearly members’ meeting.', anchorLabel: 'Meeting day', tasks: [
        { title: 'Send the meeting notice to all members', offsetDays: -30, priority: 'high', roleId: 'general-secretary', checklist: ['Agenda approved by the Board', 'Notice by email and text', 'Notice on the website'] },
        { title: 'Prepare the annual and financial reports', offsetDays: -14, roleId: 'treasurer', checklist: ['Financial statement', 'Annual report draft'] },
        { title: 'Print the members’ sign-in list', offsetDays: -2, roleId: 'membership-officer', checklist: [] },
        { title: 'Publish the minutes in the Records library', offsetDays: 14, roleId: 'general-secretary', checklist: [] },
      ] },
      { id: 'election', name: 'Election timeline', description: 'The Election Commission’s steps from nominations to oath.', anchorLabel: 'Election Day', tasks: [
        { title: 'Freeze the voter list', offsetDays: -45, priority: 'high', roleId: 'election-commission', checklist: [] },
        { title: 'Open nominations', offsetDays: -40, roleId: 'election-commission', checklist: [] },
        { title: 'Publish the ballot', offsetDays: -14, roleId: 'election-commission', checklist: [] },
        { title: 'Count and certify results', offsetDays: 1, priority: 'urgent', roleId: 'election-commission', checklist: [] },
      ] },
    ],
  },
});
/** A minimal start for an organization with one office and three categories. */
export const SIMPLE_WORK_PRESET: WorkSettings = WorkSettingsSchema.parse({
  ...mockWorkSettings,
  helpdesk: { ...mockWorkSettings.helpdesk, clock: 'calendar', categories: [
    { id: 'question', label: 'Question', defaultPriority: 'normal', owner: { kind: 'none', id: '' } },
    { id: 'complaint', label: 'Complaint', defaultPriority: 'high', owner: { kind: 'none', id: '' } },
    { id: 'feedback', label: 'Feedback', defaultPriority: 'low', owner: { kind: 'none', id: '' } },
  ], savedReplies: [] },
});
