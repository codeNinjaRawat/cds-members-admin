/** White-box: D5 queue routing (web/src/lib/community/work.ts). Run: node --import tsx --test tests/wb/queue-routing.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../../../web/src/lib/community/work';

const admins = [
  { id: 'membership-office', name: 'Membership office', roleId: 'membership-officer', centers: [], status: 'active' },
  { id: 'clerk-2', name: 'Second clerk', roleId: 'membership-officer', centers: [], status: 'active' },
  { id: 'ad-se1', name: 'AD SE1', roleId: 'associate-director', centers: ['Southeast Islamic Center 1'], status: 'active' },
  { id: 'ad-n1', name: 'AD N1', roleId: 'associate-director', centers: ['North Islamic Center 1'], status: 'active' },
  { id: 'gone', name: 'Gone', roleId: 'treasurer', centers: [], status: 'suspended' },
];

test('settings: the queues block parses with defaults and every system queue has a label', () => {
  const s = W.WorkSettingsSchema.safeParse({ ...W.mockWorkSettings, queues: undefined });
  assert.equal(s.success, true);
  assert.equal(s.success && Object.keys(s.data.queues.routing).length, 0);
  for (const k of W.QUEUE_KEYS) assert.ok(W.QUEUE_LABEL[k]);
  assert.equal(W.queueLabel(W.mockWorkSettings.queues, 'incomplete'), 'Incomplete applications');
  assert.equal(W.queueLabel({ ...W.mockWorkSettings.queues, routing: { incomplete: { owners: [], share: 'first', targetDays: 3, escalateTo: '', label: 'Half-done sign-ups' } } }, 'incomplete'), 'Half-done sign-ups');
});

test('routing: a person, a role at the masjid (else anywhere), suspended admins skipped, unassigned when nobody matches', () => {
  const r = (owners: W.QueueRoute['owners'], share: W.QueueRoute['share'] = 'round-robin') => ({ owners, share, targetDays: 7, escalateTo: '', label: '' });
  assert.equal(W.routeQueueCase(r([{ kind: 'admin', id: 'membership-office' }]), '', admins, 'c1'), 'membership-office');
  assert.equal(W.routeQueueCase(r([{ kind: 'admin', id: 'gone' }]), '', admins, 'c1'), '');
  assert.equal(W.routeQueueCase(r([{ kind: 'role', id: 'associate-director' }]), 'North Islamic Center 1', admins, 'c1'), 'ad-n1');
  assert.equal(W.routeQueueCase(r([{ kind: 'role', id: 'associate-director' }], 'first'), '', admins, 'c1'), 'ad-se1');
  assert.equal(W.routeQueueCase(r([{ kind: 'role', id: 'nobody' }]), '', admins, 'c1'), '');
  assert.equal(W.routeQueueCase(undefined, '', admins, 'c1'), '');
});

test('round-robin is stable per case and spreads over the matched people', () => {
  const r = { owners: [{ kind: 'role' as const, id: 'membership-officer' }], share: 'round-robin' as const, targetDays: 7, escalateTo: '', label: '' };
  const picks = new Set<string>();
  for (let i = 0; i < 40; i++) { const a = W.routeQueueCase(r, '', admins, `case-${i}`); assert.equal(a, W.routeQueueCase(r, '', admins, `case-${i}`)); picks.add(a); }
  assert.deepEqual([...picks].sort(), ['clerk-2', 'membership-office']);
});
