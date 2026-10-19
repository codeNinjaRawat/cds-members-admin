/** Admin – renewal engine: live preview on the draft, stricter plan rules on save, renewal status on the member page. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => { await request.delete('/api/store/membership-settings'); });

test('renewals tab previews real dates for each plan from the draft', async ({ page }) => {
  await page.goto('/membership?tab=plans');
  await page.getByLabel('Plan preset').selectOption('wildapricot');
  await page.getByRole('button', { name: 'Load into the draft' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Load into the draft' }).click();
  await page.getByRole('tab', { name: 'Renewals and reminders' }).click();
  const pv = page.locator('.ren-preview');
  await pv.getByLabel('Joins on').fill('2026-10-15');
  const ind = pv.locator('.ren-card[data-plan="individual"]');
  await expect(ind.locator('.ren-through')).toHaveText('Paid through 12/15/2027');
  await expect(ind.locator('.ren-steps li')).toHaveCount(7);
  await expect(ind.locator('.ren-steps li').first()).toContainText('11/15/2027');
  await expect(ind.locator('.ren-steps li').first()).toContainText('with an invoice');
  await expect(ind.locator('.ren-steps .k-overdue')).toContainText('12/29/2027');
  await expect(pv.locator('.ren-card[data-plan="life-individual"]')).toHaveCount(0);
  // the preview follows the draft: shorter grace moves the dates
  await page.getByLabel(/Grace period/).first().fill('3');
  await expect(ind.locator('.ren-steps .k-grace-ends')).toContainText('12/18/2027');
});

test('contradicting plan settings are refused by the server', async ({ request }) => {
  const cur = (await (await request.get('/api/store/membership-settings')).json()).data;
  const bad = { ...cur, plans: cur.plans.map((p: any) => (p.id === 'life' ? { ...p, renewal: { anchor: 'date', anchorDate: '02-30', mode: 'manual', prorate: false, aheadLimitDays: 0 } } : p)) };
  const r = await request.put('/api/store/membership-settings', { data: { data: bad } });
  expect(r.status()).toBe(400);
  const assoc = { ...cur, plans: cur.plans.map((p: any) => (p.id === 'associate' ? { ...p, votingEligible: true } : p)) };
  expect((await request.put('/api/store/membership-settings', { data: { data: assoc } })).status()).toBe(400);
});

test('member page shows the renewal status and paid-through date', async ({ page }) => {
  await page.goto('/members/HOU-200000');
  await expect(page.locator('.ren-chip')).toContainText(/paid through 12\/31\/2026/i);
  await page.goto('/members/HOU-200473');
  await expect(page.locator('.ren-chip')).toHaveText('Lapsed · paid through 12/31/2025');
  await page.goto('/members/HOU-200064');
  await expect(page.locator('.ren-chip')).toHaveCount(0); // Life: never renews
});
