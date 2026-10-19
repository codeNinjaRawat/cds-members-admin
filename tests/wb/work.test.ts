/** White-box: Help desk + Team tasks contract (web/src/lib/community/work.ts). Run: node --import tsx --test tests/wb/work.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../../../web/src/lib/community/work';

const S = W.mockWorkSettings;
const H = S.helpdesk;
const me = { id: 'owner', name: 'Mohammad (demo)' };
const admins = [
  { id: 'membership-office', name: 'Membership office', roleId: 'membership-officer', centers: [], status: 'active' },
  { id: 'ad-se1', name: 'Yasir', roleId: 'associate-director', centers: ['Southeast Islamic Center 1'], status: 'active' },
  { id: 'ad-sw2', name: 'SW2 AD', roleId: 'associate-director', centers: ['Southwest Islamic Center 2'], status: 'active' },
  { id: 'gone', name: 'Gone', roleId: 'treasurer', centers: [], status: 'suspended' },
  { id: 'sw-director', name: 'SW dir', roleId: 'zone-director', centers: [], status: 'active', more: [{ roleId: 'associate-director', centers: ['Southwest Islamic Center 1'] }] },
];
const mk = (over: Partial<Parameters<typeof W.newTicket>[0]> = {}) => W.newTicket({ id: 'T-1', subject: 'Parking', detail: 'Cars block the exit', categoryId: 'facilities', channel: 'website', requester: { name: 'Amina Khan', email: 'a@example.com', phone: '', memberId: '' }, center: 'Southeast Islamic Center 1', createdBy: { id: '', name: 'Website' }, at: '2026-10-12T10:00:00', ...over }, H, admins);

test('settings: defaults parse, duplicate ids and bad hours are refused', () => {
  assert.equal(W.WorkSettingsSchema.safeParse(S).success, true);
  const dup = structuredClone(S); dup.helpdesk.categories.push({ ...dup.helpdesk.categories[0] });
  assert.match(JSON.stringify(W.WorkSettingsSchema.safeParse(dup).error?.issues), /Two categories/);
  const hrs = structuredClone(S); hrs.helpdesk.hours = { days: [1], start: '17:00', end: '09:00' };
  assert.match(JSON.stringify(W.WorkSettingsSchema.safeParse(hrs).error?.issues), /must end after/);
  const tg = structuredClone(S); tg.helpdesk.targets.low = { firstResponseHours: 90, solveHours: 10 };
  assert.match(JSON.stringify(W.WorkSettingsSchema.safeParse(tg).error?.issues), /cannot be longer/);
  const own = structuredClone(S); own.helpdesk.categories[0].owner = { kind: 'admin', id: '' };
  assert.match(JSON.stringify(W.WorkSettingsSchema.safeParse(own).error?.issues), /pick who gets/);
  const none = structuredClone(S); none.helpdesk.categories.forEach((c) => { c.archived = true; });
  assert.match(JSON.stringify(W.WorkSettingsSchema.safeParse(none).error?.issues), /at least one category/);
  assert.equal(W.WorkSettingsSchema.safeParse(W.SIMPLE_WORK_PRESET).success, true);
});

test('business clock: working minutes and adding across nights and weekends', () => {
  const h = { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' };
  assert.equal(W.businessMinutesBetween('2026-10-12T10:00:00', '2026-10-12T12:30:00', h), 150); // Monday
  assert.equal(W.businessMinutesBetween('2026-10-16T16:00:00', '2026-10-19T10:00:00', h), 120); // Fri 16:00 → Mon 10:00
  assert.equal(W.businessMinutesBetween('2026-10-17T10:00:00', '2026-10-17T12:00:00', h), 0);   // Saturday
  assert.equal(W.addBusinessMinutes('2026-10-16T16:00:00', 120, h), '2026-10-19T10:00:00');
  assert.equal(W.addBusinessMinutes('2026-10-12T07:00:00', 60, h), '2026-10-12T10:00:00');         // before opening
  assert.equal(W.addBusinessMinutes('2026-10-12T18:00:00', 30, h), '2026-10-13T09:30:00');         // after closing
});

test('routing: named admin, role at the masjid (incl. extra roles), fallback, nobody', () => {
  const cat = (id: string) => H.categories.find((c) => c.id === id)!;
  assert.equal(W.routeOwner(cat('membership'), '', admins), 'membership-office');
  assert.equal(W.routeOwner(cat('facilities'), 'Southeast Islamic Center 1', admins), 'ad-se1');
  assert.equal(W.routeOwner(cat('facilities'), 'Southwest Islamic Center 1', admins), 'sw-director');   // via `more`
  assert.equal(W.routeOwner(cat('facilities'), '', admins), 'ad-se1');                                  // any holder of the role
  assert.equal(W.routeOwner(cat('feedback'), 'x', admins), '');
  assert.equal(W.routeOwner({ ...cat('donations'), owner: { kind: 'admin', id: 'gone' } }, '', admins), '');  // suspended admin never gets tickets
  const t = mk(); assert.equal(t.assignee, 'ad-se1'); assert.equal(t.status, 'open'); assert.equal(t.priority, 'high');
  const f = mk({ categoryId: 'feedback' }); assert.equal(f.status, 'new'); assert.equal(f.priority, 'low');
  assert.equal(mk({ categoryId: 'conduct' }).restricted, true);
});

test('targets: first response, due soon, late, met; the solve clock pauses while waiting on the requester', () => {
  const t = mk(); // high: 4 h first reply, 16 h solve, created Mon 10:00
  let c = W.ticketClocks(t, H, '2026-10-12T11:00:00');
  assert.equal(c.first.due, '2026-10-12T14:00:00'); assert.equal(c.first.state, 'ok');
  assert.equal(W.ticketClocks(t, H, '2026-10-12T13:30:00').first.state, 'soon');
  assert.equal(W.ticketClocks(t, H, '2026-10-12T15:00:00').first.state, 'late');
  const r = W.reply(t, 'We are on it', me, '2026-10-12T12:00:00');
  c = W.ticketClocks(r, H, '2026-10-12T15:00:00'); assert.equal(c.first.state, 'met'); assert.equal(c.solve.due, '2026-10-14T10:00:00');
  // waiting Tue 10:00 → Wed 10:00 (8 working hours) moves the solve target 8 working hours later
  const w = W.setStatus(r, 'waiting', me, '2026-10-13T10:00:00');
  assert.equal(W.ticketClocks(w, H, '2026-10-13T16:00:00').solve.state, 'paused');
  const back = W.requesterReply(w, 'Here is the photo', '2026-10-14T10:00:00');
  assert.equal(back.status, 'open');
  assert.equal(W.pausedMinutes(back, H, '2026-10-14T11:00:00'), 480);
  assert.equal(W.ticketClocks(back, H, '2026-10-14T11:00:00').solve.due, '2026-10-15T10:00:00');
  const solved = W.setStatus(back, 'solved', me, '2026-10-14T15:00:00');
  assert.equal(W.ticketClocks(solved, H, '2026-10-20T10:00:00').solve.state, 'met');
  // calendar clock counts nights too
  const cal = { ...H, clock: 'calendar' as const };
  assert.equal(W.ticketClocks(t, cal, '2026-10-12T11:00:00').solve.due, '2026-10-13T02:00:00');
});

test('reply vs note: a note never counts as a response; mentions become watchers', () => {
  const t = mk({ categoryId: 'feedback' });
  const n = W.note(t, 'Can @Yasir check the cones?', me, '2026-10-12T11:00:00', admins);
  assert.equal(n.firstResponseAt, ''); assert.deepEqual(n.watchers, ['ad-se1']); assert.equal(n.status, 'new');
  const r = W.reply(n, 'Thanks', me, '2026-10-12T11:05:00');
  assert.equal(r.firstResponseAt, '2026-10-12T11:05:00'); assert.equal(r.status, 'open');
  assert.equal(W.reply(r, 'Need your ID', me, '2026-10-12T11:10:00', 'waiting').status, 'waiting');
});

test('saved replies: merge fields, unknown fields stay visible', () => {
  const t = mk();
  const out = W.fillReply('Salam {{first_name}} – {{ticket}} at {{masjid}} by {{agent}} {{oops}}', t, { agent: 'Mohammad', organization: 'ISGH' });
  assert.equal(out, 'Salam Amina – T-1 at Southeast Islamic Center 1 by Mohammad {{oops}}');
  assert.deepEqual(W.unfilledFields(out), ['oops']);
  assert.match(W.fillReply('{{masjid}}', { ...t, center: '' }, { agent: 'x', organization: 'ISGH' }), /ISGH/);
});

test('merge: thread moves, duplicate closes and points at the main ticket; auto-close after N days', () => {
  const a = mk({ id: 'T-1' }), b = W.note(mk({ id: 'T-2', categoryId: 'membership' }), 'same person', me, '2026-10-12T12:00:00', admins);
  const [m, d] = W.merge(a, b, me, '2026-10-12T13:00:00');
  assert.equal(d.mergedInto, 'T-1'); assert.equal(d.status, 'closed'); assert.equal(W.isOpenTicket(d), false);
  assert.ok(m.events.some((e) => e.text?.startsWith('[from T-2]')));
  assert.ok(m.watchers.includes('membership-office'));
  const s = W.setStatus(a, 'solved', me, '2026-10-01T10:00:00');
  const [closed] = W.autoClose([s], H, '2026-10-09T10:00:00'); assert.equal(closed.status, 'closed');
  const [kept] = W.autoClose([s], { ...H, autoCloseDays: 0 }, '2026-12-09T10:00:00'); assert.equal(kept.status, 'solved');
});

test('visibility: masjid scope, assigned to me, restricted tickets', () => {
  const v = (id: string, roleId: string, centers: string[], orgWide = false): W.Viewer => ({ id, roleId, orgWide, inScope: (c) => orgWide || centers.includes(c) });
  const t = mk();
  assert.equal(W.canSeeTicket(t, v('x', 'membership-secretary', ['Southeast Islamic Center 1']), H), true);
  assert.equal(W.canSeeTicket(t, v('y', 'membership-secretary', ['Southwest Islamic Center 2']), H), false);
  const org = mk({ center: '', categoryId: 'membership' });
  assert.equal(W.canSeeTicket(org, v('y', 'membership-secretary', ['Southwest Islamic Center 2']), H), false);
  assert.equal(W.canSeeTicket({ ...org, assignee: 'y' }, v('y', 'membership-secretary', []), H), true);
  const r = mk({ categoryId: 'conduct', center: '' });
  assert.equal(W.canSeeTicket(r, v('treasurer', 'treasurer', [], true), H), false);   // organization-wide but not involved
  assert.equal(W.canSeeTicket(r, v('o', 'owner', [], true), H), true);               // senior role
  assert.equal(W.canSeeTicket({ ...r, watchers: ['treasurer'] }, v('treasurer', 'treasurer', [], true), H), true);
});

test('stats: open, late, targets met, satisfaction, by category', () => {
  const a = W.setStatus(W.reply(mk({ id: 'T-1' }), 'ok', me, '2026-10-12T11:00:00'), 'solved', me, '2026-10-12T15:00:00');
  const b = mk({ id: 'T-2', categoryId: 'membership', at: '2026-10-05T10:00:00' });
  const c = { ...W.setStatus(mk({ id: 'T-3', categoryId: 'feedback' }), 'solved', me, '2026-10-30T10:00:00'), csat: { score: 'good' as const, comment: '', at: '' } };
  const s = W.helpdeskStats([a, b, c], H, '2026-10-13T12:00:00');
  assert.equal(s.open, 1); assert.equal(s.late, 1); assert.equal(s.targetsMetPct, 50); assert.equal(s.satisfactionPct, 100);
  assert.equal(s.medianFirstResponseMin, 60);
  assert.deepEqual(s.byCategory.map((x) => x.id), ['membership', 'facilities', 'feedback']);
});

test('tasks: recurring creates the next one; month ends; buckets', () => {
  const t: W.Task = { id: 'a', projectId: '', parentId: '', title: 'Monthly report', notes: '', owner: 'treasurer', helpers: [], status: 'doing', priority: 'normal', start: '', due: '2026-01-31', labels: [], checklist: [{ id: 'c', text: 'x', done: true }], repeat: { every: 'month', interval: 1 }, links: [], comments: [], createdAt: '', createdBy: '', doneAt: '', order: 0 };
  const out = W.completeTask([t], 'a', me, '2026-01-31T10:00:00');
  assert.equal(out.length, 2); assert.equal(out[0].status, 'done'); assert.equal(out[1].due, '2026-02-28'); assert.equal(out[1].checklist[0].done, false);
  assert.equal(W.nextDue('2026-10-16', { every: 'week', interval: 2 }), '2026-10-30');
  assert.equal(W.nextDue('2024-02-29', { every: 'year', interval: 1 }), '2025-02-28');
  assert.equal(W.completeTask(out, 'a', me, 'x').length, 2);      // done twice does nothing
  const b = (due: string, status: W.TaskStatus = 'todo') => W.bucketOf({ ...t, due, status }, '2026-10-13');
  assert.equal(b('2026-10-12'), 'overdue'); assert.equal(b('2026-10-13'), 'today'); assert.equal(b('2026-10-20'), 'week'); assert.equal(b('2026-10-21'), 'later'); assert.equal(b(''), 'nodate'); assert.equal(b('2026-10-01', 'done'), 'done');
});

test('templates: dates from the anchor, owners from roles at the masjid, project visible to its people', () => {
  const tpl = S.tasks.templates.find((x) => x.id === 'eid-prayer')!;
  const { project, tasks } = W.projectFromTemplate(tpl, { name: 'Eid ul-Adha 2027', anchor: '2027-05-16', owner: 'owner', center: 'Southeast Islamic Center 1', by: me, at: '2026-10-13T10:00:00' }, admins);
  assert.equal(tasks.length, tpl.tasks.length);
  assert.equal(tasks[0].due, '2027-04-16'); assert.equal(tasks[0].owner, 'ad-se1'); assert.equal(tasks[1].owner, 'owner');  // no website editor in this list → creator
  assert.equal(tasks.at(-1)!.due, '2027-05-19'); assert.equal(project.due, '2027-05-19'); assert.equal(project.visibility, 'masjid');
  assert.ok(project.members.includes('ad-se1'));
  const v = (id: string, centers: string[], orgWide = false): W.Viewer => ({ id, roleId: 'x', orgWide, inScope: (c) => orgWide || centers.includes(c) });
  assert.equal(W.canSeeProject(project, v('ms-se1', ['Southeast Islamic Center 1'])), true);
  assert.equal(W.canSeeProject(project, v('ad-sw2', ['Southwest Islamic Center 2'])), false);
  assert.equal(W.canSeeProject({ ...project, visibility: 'members' }, v('ms-se1', ['Southeast Islamic Center 1'])), false);
  assert.equal(W.canSeeTask(tasks[0], [project], v('ms-se1', ['Southeast Islamic Center 1'])), true);
  const p = W.projectProgress(project, W.completeTask(tasks, tasks[0].id, me, 'x'), '2027-05-10');
  assert.equal(p.done, 1); assert.equal(p.overdue, 3); assert.equal(p.atRisk, true);
});

test('ticket → task keeps the link; workload sorts by overdue', () => {
  const k = W.taskFromTicket(mk(), { owner: 'ad-se1', due: '2026-10-15', by: me, at: 'x' });
  assert.deepEqual(k.links[0], { kind: 'ticket', id: 'T-1', label: 'Parking' }); assert.equal(k.priority, 'high');
  const w = W.workload([k, { ...k, id: 'b', owner: 'x', due: '2026-10-01' }], '2026-10-13');
  assert.deepEqual(w.map((x) => x.owner), ['x', 'ad-se1']);
});

test('website/portal see only the public part; members never see notes or owners', async () => {
  const p = W.publicHelpdesk(S);
  assert.equal(p.enabled, true);
  assert.ok(p.categories.every((c) => !('owner' in c) && !('escalateTo' in c)));
  assert.ok(p.categories.find((c) => c.id === 'conduct')?.private);
  assert.equal(JSON.stringify(p).includes('membership-office'), false);
  const off = structuredClone(S); off.helpdesk.websiteForms = false; assert.equal(W.publicHelpdesk(off).enabled, false);
  const t = W.reply(W.note(mk(), 'internal only', me, '2026-10-12T11:00:00', admins), 'public answer', me, '2026-10-12T12:00:00', 'waiting');
  const v = W.memberView(t);
  assert.equal(v.status, 'Waiting for your answer');
  assert.deepEqual(v.messages.map((x) => x.from), ['you', 'team']);
  assert.equal(JSON.stringify(v).includes('internal only'), false);
  assert.equal(W.PublicTicketSchema.safeParse({ categoryId: 'membership', subject: 'Hi', detail: 'short', name: 'A', email: 'x' }).success, false);
  assert.equal(W.PublicTicketSchema.safeParse({ categoryId: 'membership', subject: 'New card', detail: 'Please send a new card.', name: 'Amina', email: 'a@example.com' }).success, true);
});

test('portal "who served": all kinds shown, hidden terms and member IDs never', async () => {
  const O = await import('../../../web/src/lib/community/officials');
  const years = O.memberPastLeadership(O.mockOfficials);
  const flat = years.flatMap((y) => y.terms);
  assert.ok(flat.length >= O.publicPastLeadership(O.mockOfficials).flatMap((y) => y.terms).length);
  assert.equal(JSON.stringify(years).includes('HOU-'), false);
  const hidden = structuredClone(O.mockOfficials); hidden.history.forEach((h) => { h.showOnWebsite = false; });
  assert.equal(O.memberPastLeadership(hidden).length, 0);
});
