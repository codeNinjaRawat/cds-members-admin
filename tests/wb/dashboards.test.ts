/** White-box: D1 role dashboards (web/src/lib/community/access.ts). Run: node --import tsx --test tests/wb/dashboards.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../../../web/src/lib/community/access';

test('roles carry a dashboard.hide list; old documents without it still parse', () => {
  const doc = A.AccessSchema.safeParse(A.mockAccess);
  assert.equal(doc.success, true);
  const board = A.BUILT_IN_ROLES.find((r) => r.id === 'board-member')!;
  assert.ok(board.dashboard.hide.includes('cc.pipeline'), 'the board does not get the office pipeline');
  const office = A.BUILT_IN_ROLES.find((r) => r.id === 'membership-officer')!;
  assert.ok(office.dashboard.hide.includes('cc.kpi.giving') && !office.dashboard.hide.includes('cc.kpi.fees'), 'membership sees fees, not giving');
  const raw = structuredClone(A.mockAccess) as any; raw.roles.forEach((r: any) => { delete r.dashboard; });
  const again = A.AccessSchema.safeParse(raw); assert.equal(again.success, true);
  assert.deepEqual(again.success && again.data.roles[0].dashboard, { hide: [] });
});
