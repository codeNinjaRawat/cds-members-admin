/** A1 – "approve only after the dues are paid in full": a rule in Membership rules, applied in the member profile and the Board-approval batch. */
import { test, expect, type Page } from '@playwright/test';

const withRule = async (page: Page, on: boolean) => {
  const cur = (await (await page.request.get('/api/store/membership-settings')).json()).data;
  const r = await page.request.put('/api/store/membership-settings', { data: { data: { ...cur, rules: { ...cur.rules, approval: { ...cur.rules.approval, requireFullPayment: on } } } } });
  expect(r.ok()).toBeTruthy();
};
test.beforeEach(async ({ page, request }) => { await request.delete('/api/store/membership-settings'); await page.goto('/members'); await page.evaluate(() => localStorage.clear()); });
test.afterEach(async ({ request }) => { await request.delete('/api/store/membership-settings'); });

test('profile: with the rule on, an unpaid application cannot be approved until a payment is recorded', async ({ page }) => {
  await withRule(page, true);
  await page.goto('/members?view=pending');
  await page.locator('.m-who').first().click(); await page.getByRole('link', { name: 'Open full profile' }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('.m-blockers')).toContainText('Dues not paid in full: $0 of');
  await expect(dlg.getByRole('button', { name: 'Approve' })).toBeDisabled();
  // record the dues from the dialog, then approve
  await dlg.getByRole('button', { name: 'Record the payment' }).click();
  const pay = page.getByRole('dialog', { name: 'Record an offline payment' });
  await pay.getByLabel('Paid on').fill('2026-10-01');
  await pay.getByRole('button', { name: 'Record payment' }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.m-blockers')).toHaveCount(0);
  await page.getByRole('dialog').getByLabel('Board meeting or reference').fill('Board meeting, October 2026');
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('.m-checks li', { hasText: 'Board' })).toHaveClass(/ok/);
});

test('work queue: the Board-approval batch holds back unpaid applications and names them', async ({ page }) => {
  await withRule(page, true);
  await page.goto('/queues?tab=applications');
  await page.locator('.wq-item').first().click();
  const name = (await page.locator('.wq-item.on b').textContent())!.trim();
  await page.getByRole('tab', { name: /Photo ID checks/ }).click();
  await page.locator('.wq-item', { hasText: name }).click();
  const good = page.getByRole('button', { name: 'Photo ID is good' });
  test.skip(await good.isDisabled(), 'this demo ID has a failed check');
  await good.click();
  await page.getByRole('tab', { name: /Applications/ }).click();
  await page.locator('.wq-item', { hasText: name }).click();
  await page.getByRole('button', { name: 'Ready for the Board' }).click();
  await page.getByRole('button', { name: 'Record Board approval' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('.wq-blocked')).toContainText('1 held back by the approval rule');
  await expect(dlg.locator('.wq-blocked')).toContainText(name.split(' ')[0]);
  await expect(dlg).toContainText('one Board decision for 0 applications');
});

test('rule off (demo default): approval goes through as before', async ({ page }) => {
  await page.goto('/members?view=pending');
  await page.locator('.m-who').first().click(); await page.getByRole('link', { name: 'Open full profile' }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.m-blockers')).toHaveCount(0);
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Approve' })).toBeEnabled();
});
