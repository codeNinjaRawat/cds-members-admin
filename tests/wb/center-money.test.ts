/** White-box: D12 money per center (web/src/lib/community/donations.ts). Run: node --import tsx --test tests/wb/center-money.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../../../web/src/lib/community/donations';

const S = D.mockDonationSettings;

test('central funds go to the organization whichever center; a center with its own account gets its own gifts', () => {
  assert.equal(D.accountFor(S, 'Southwest Islamic Center 1', 'zakat').owner, 'organization');       // Zakat is routed to the main center
  assert.equal(D.accountFor(S, 'Southwest Islamic Center 1', 'general').owner, 'center');
  assert.equal(D.accountFor(S, 'Southwest Islamic Center 1', 'general').last4, '4k9Q');
  assert.equal(D.accountFor(S, 'South Islamic Center 2', 'general').owner, 'organization');          // no row → shared account
  assert.equal(D.accountFor(S, 'Southeast Islamic Center 1', 'education').owner, 'organization');    // shared fund
});

test('funds offered at a center: its own list plus the central funds; an empty list means every given-to-center fund', () => {
  const n1 = D.fundsForCenter(S, 'North Islamic Center 1').map((f) => f.id).sort();
  assert.deepEqual(n1, ['building', 'education', 'general', 'ramadan', 'zakat']);                    // own: general, building · central: zakat, ramadan, education
  const sw = D.fundsForCenter(S, 'Southwest Islamic Center 1').map((f) => f.id).length;
  assert.equal(sw, S.funds.filter((f) => f.active).length);
});

test('settings refuse an unknown fund on a center and an unnamed own account; old documents without centers still parse', () => {
  const bad = structuredClone(S); bad.centers['North Islamic Center 1'].funds.push('nope');
  const r = D.DonationSettingsSchema.safeParse(bad); assert.equal(r.success, false);
  const unnamed = structuredClone(S); unnamed.centers['Southwest Islamic Center 1'].account.label = '';
  assert.equal(D.DonationSettingsSchema.safeParse(unnamed).success, false);
  const old = structuredClone(S) as any; delete old.centers;
  assert.equal(D.DonationSettingsSchema.safeParse(old).success, true);
  const secret = structuredClone(S); secret.centers['Southwest Islamic Center 1'].account.last4 = 'sk_live_abc';
  assert.equal(D.DonationSettingsSchema.safeParse(secret).success, false, 'never more than 4 characters of an account');
});
