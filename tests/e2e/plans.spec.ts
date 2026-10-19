/** P1–P3 Membership rules › Plans and dues: the plan editor follows the term, presets load, rules are switches with numbers, the website explains them. */
import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page, request }) => { await request.delete('/api/store/membership-settings'); await page.goto('/membership?tab=plans'); await page.evaluate(() => localStorage.clear()); });
const publish = async (page: Page) => { await page.getByRole('button', { name: 'Publish', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click(); await expect(page.locator('.notice.ok')).toContainText('Published version'); };
const store = async (page: Page) => (await (await page.request.get('/api/store/membership-settings')).json()).data;

test('a lifetime plan never offers renewal or multi-year prices; switching the term cleans up', async ({ page }) => {
  const card = page.locator('[data-plan="life"]');
  await card.locator('.pe-open').click();
  await expect(card.getByLabel('Renews on Life')).toHaveCount(0);
  await expect(card.getByLabel('Years ahead Life')).toHaveCount(0);
  await expect(card.getByLabel('Price Life')).toHaveValue('1000.00');
  // the demo Single plan: yearly → fixed prices for 3 years; then make it lifetime: the options go away, no errors remain
  const single = page.locator('[data-plan="single"]');
  await single.locator('.pe-open').click();
  await single.getByLabel('Years ahead Single').fill('3');
  await single.getByRole('button', { name: '+ Add a fixed price' }).click();
  await single.getByLabel('Fixed price 1 Single').fill('60.00');
  await expect(single.locator('.sf-err')).toHaveCount(0);
  await single.getByRole('radio', { name: 'Lifetime' }).click();
  await expect(single.getByLabel('Years ahead Single')).toHaveCount(0);
  await expect(single.getByLabel('Renews on Single')).toHaveCount(0);
  await expect(single.getByLabel('Unit Single')).toHaveValue('one time');
  await expect(page.locator('.sf-err')).toHaveCount(0);
  await publish(page);
  const s = await store(page);
  const p = s.plans.find((x: any) => x.id === 'single');
  expect(p.term).toBe('lifetime'); expect(p.renewal).toBeUndefined(); expect(p.termPrices).toBeUndefined();
});

test('start from the ISGH preset: three categories, the Check-o-matic and lifetime-by-gift rules on; the website explains them', async ({ page }) => {
  await expect(page.getByLabel('Plan preset')).toHaveValue('isgh-2026');
  await page.getByRole('button', { name: 'Load into the draft' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Load into the draft' }).click();
  await expect(page.locator('.pe-card')).toHaveCount(4);
  await expect(page.locator('[data-plan="checkomatic"]')).toContainText('$10 per month, at least');
  await expect(page.locator('[data-plan="checkomatic"]')).toContainText('household of 2');
  await expect(page.getByRole('switch', { name: 'Use this rule' }).first()).toBeChecked();
  await expect(page.getByLabel('Qualifying total')).toHaveValue('40.00');
  await expect(page.getByLabel('Qualifying cut-off')).toHaveValue('06-30');
  await expect(page.getByLabel('Lifetime gift threshold')).toHaveValue('25000.00');
  await expect(page.locator('.pe-words')).toContainText('reach $40 by June 30, you and your spouse are members');
  await expect(page.locator('.pe-words')).toContainText('$25,000 or more makes you a Lifetime (individual) member');
  // every number is editable – another organization's rule
  await page.getByLabel('Qualifying total').fill('100.00');
  await page.getByLabel('Qualifying cut-off').fill('12-31');
  await page.getByRole('switch', { name: 'Covers the spouse too (primary and spouse)' }).click();
  await expect(page.locator('.pe-words')).toContainText('reach $100 by December 31, you are a member');
  await page.getByLabel('Qualifying cut-off').fill('13-40');
  await expect(page.locator('.sf-err').first()).toContainText('not a real date');
  await page.getByLabel('Qualifying cut-off').fill('12-31');
  await publish(page);
  const s = await store(page);
  expect(s.rules.qualifyingGifts).toMatchObject({ enabled: true, planId: 'checkomatic', totalCents: 10000, cutoff: '12-31', coversSpouse: false });
  expect(s.rules.lifetimeByDonation).toMatchObject({ enabled: true, planId: 'life-individual', thresholdCents: 2500000 });
});

test('rules: switched off nothing is said; a rule turned on needs its plan', async ({ page }) => {
  // the demo rule is on (D10 – monthly contributors); off, the website says nothing about it
  await expect(page.locator('.pe-words')).toContainText('Monthly contributor: give at least $10 a month');
  await page.getByRole('switch', { name: 'Use this rule' }).first().click();
  await expect(page.locator('.pe-words')).not.toContainText('month');
  await page.getByRole('switch', { name: 'Use this rule' }).first().click();
  await page.getByLabel('Qualifying plan').selectOption('');
  await expect(page.locator('.sf-err').first()).toContainText('Choose the plan these contributors hold');
  await page.getByLabel('Qualifying plan').selectOption('single');
  await expect(page.locator('.sf-err')).toHaveCount(0);
  await expect(page.locator('.pe-words')).toContainText('Single: give at least $10 a month');
});

test('add, reorder and remove plans; associate members can never vote', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add plan' }).click();
  const card = page.locator('[data-plan="new-plan"]');
  await expect(card).toContainText('Hidden');
  await card.getByLabel('Plan name New plan').fill('Student');
  await page.locator('[data-plan="new-plan"]').getByLabel('Plan ID Student').fill('Student 2027!');
  await expect(page.locator('[data-plan="student-2027"]')).toHaveCount(1);
  const st = page.locator('[data-plan="student-2027"]');
  await expect(st.locator('.pe-form')).toBeVisible();
  // V1 – the class rule is a setting: the demo's second class does not vote, so the switch is off and locked
  await st.getByRole('radio', { name: 'Associate member' }).click();
  await expect(st.getByRole('switch', { name: 'Members on this plan can vote' })).not.toBeChecked();
  await expect(st.getByRole('switch', { name: 'Members on this plan can vote' })).toBeDisabled();
  await expect(st.locator('#pe-vote-student-2027-h')).toContainText('Associate member members cannot vote (Constitution Art. III)');
  await st.getByRole('radio', { name: 'Member', exact: true }).click();
  await expect(st.getByRole('switch', { name: 'Members on this plan can vote' })).toBeChecked();
  await expect(page.locator('.sf-err')).toHaveCount(0);
  // flip the rule: the second class votes (ISGH's reading) – the switch unlocks
  await page.locator('#pe-cls-vote-associate').check({ force: true });
  await st.getByRole('radio', { name: 'Associate member' }).click();
  await expect(st.getByRole('switch', { name: 'Members on this plan can vote' })).toBeEnabled();
  await page.locator('#pe-cls-vote-associate').uncheck({ force: true });
  await st.getByRole('radio', { name: 'Member', exact: true }).click();
  await page.getByRole('button', { name: 'Move Student up' }).click();
  await expect(page.locator('.pe-card').nth(4)).toHaveAttribute('data-plan', 'student-2027');
  await page.getByRole('button', { name: 'Remove Associate' }).click();
  await expect(page.locator('.pe-card')).toHaveCount(5);
});

test('J1/J3: identity policy, consent and the sign-up guide are the organization’s own words', async ({ page }) => {
  await page.getByRole('tab', { name: 'Identity and sign-up guide' }).click();
  await expect(page.getByText('Identity policy and consent')).toBeVisible();
  const consent = page.getByLabel(/Consent text/);
  await expect(consent).toHaveValue(/I have read the Identity Collection/);
  await consent.fill('I agree to the identity check.');
  await page.getByLabel(/Consent version/).fill('identity-v2');
  await expect(page.locator('.pill.warn')).toHaveText('Unpublished changes');
  await expect(page.getByText('Sign-up guide page')).toBeVisible();
  await publish(page);
  const s = await store(page);
  expect(s.identity.consentText).toBe('I agree to the identity check.');
  expect(s.identity.consentVersion).toBe('identity-v2');
  expect(s.guide.steps.length).toBe(6);
});
