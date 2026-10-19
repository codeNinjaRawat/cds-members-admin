/** White-box: V1 member classes + D13 plan ages (web/src/lib/content/membership.ts). Run: node --import tsx --test tests/wb/membership-classes.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../../web/src/lib/content/membership';

test('defaults: class 1 votes, class 2 does not; old settings without classes still parse', () => {
  assert.equal(M.memberClass(undefined, 'natural').canVote, true);
  assert.equal(M.memberClass(undefined, 'associate').canVote, false);
  assert.equal(M.noVoteMessage(undefined, 'associate'), 'Associate member members cannot vote (Constitution Art. III).');
  const old = structuredClone(M.mockMembershipSettings) as any; delete old.rules.classes;
  const r = M.MembershipSettingsSchema.safeParse(old); assert.equal(r.success, true);
  assert.equal(r.success && r.data.rules.classes.natural.label, 'Member');
});

test('a plan on a class that does not vote cannot be voting-eligible – and the rule flips per organization', () => {
  const s = structuredClone(M.mockMembershipSettings);
  s.plans[0].memberClass = 'associate'; s.plans[0].votingEligible = true;
  let r = M.MembershipSettingsSchema.safeParse(s);
  assert.equal(r.success, false);
  assert.match(r.success ? '' : r.error.issues[0].message, /Associate member members cannot vote/);
  s.rules.classes.associate.canVote = true; s.rules.classes.natural.canVote = false; s.rules.classes.reference = 'Bylaws §4';
  s.plans.forEach((p) => { if (p.memberClass === 'natural') p.votingEligible = false; });
  r = M.MembershipSettingsSchema.safeParse(s); assert.equal(r.success, true, JSON.stringify(r.success ? '' : r.error.issues));
  assert.equal(M.noVoteMessage(s.rules, 'natural'), 'Member members cannot vote (Bylaws §4).');
});

test('ISGH preset: the paid classes vote, natural does not, and the preset validates', () => {
  const p = M.PLAN_PRESETS.find((x) => x.id === 'isgh-2026')!;
  const s = { ...structuredClone(M.mockMembershipSettings), plans: p.plans, rules: p.rules };
  assert.equal(M.MembershipSettingsSchema.safeParse(s).success, true);
  assert.equal(p.rules.classes.natural.canVote, false);
  assert.equal(p.rules.classes.natural.offered, false);
  assert.ok(p.plans.every((x) => x.memberClass === 'associate' && x.votingEligible));
  assert.ok(M.rulesInWords(s).some((w) => /Natural members do not vote/.test(w)) === false, 'natural is not offered, so it is not explained');
});

test('plan ages: min above max is refused; a youth plan validates', () => {
  const s = structuredClone(M.mockMembershipSettings);
  s.plans[0].ages = { min: 18, max: 12 };
  assert.equal(M.MembershipSettingsSchema.safeParse(s).success, false);
  s.plans[0].ages = { max: 17 };
  assert.equal(M.MembershipSettingsSchema.safeParse(s).success, true);
});
