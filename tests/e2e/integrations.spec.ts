/** Admin – A11 integrations: status, readiness, keys kept as last 4, four-eyes approval, test sends. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  for (const k of ['integrations', 'admin-access']) await request.delete(`/api/store/${k}`);
  await page.context().clearCookies(); await page.goto('/'); await page.evaluate(() => localStorage.clear());
});

test('status chips and readiness: DNS records and what other modules expect', async ({ page }) => {
  await page.goto('/settings/integrations');
  await expect(page.locator('.integ-chip')).toHaveCount(4);
  await expect(page.locator('.integ-chip[data-int="email"]')).toContainText('Needs attention');
  await expect(page.locator('[data-card="email"] .integ-checks')).toContainText('DMARC record for isgh.org');
  await expect(page.locator('[data-card="stripe"] .integ-checks')).toContainText('Apple Pay domain verified');
  await page.getByLabel('DMARC').selectOption('ok'); await page.getByLabel('DKIM').selectOption('ok');
  await expect(page.locator('.integ-chip[data-int="email"]')).toContainText('Test mode');
  await expect(page.locator('.integ-approve')).toHaveCount(0);   // DNS status is not a sensitive change
});

test('keys: shape checked, only the last 4 kept; a key change needs a second admin (browser and server)', async ({ page, request }) => {
  // a second admin who may approve
  const acc = (await (await request.get('/api/store/admin-access')).json()).data;
  acc.admins.push({ id: 'second-admin', name: 'Second admin', email: 'second@isgh.org', roleId: 'admin', zones: [], status: 'active', twoStep: true });
  expect((await request.put('/api/store/admin-access', { data: { data: acc } })).status()).toBeLessThan(300);
  await page.goto('/settings/integrations');
  const stripe = page.locator('[data-card="stripe"]');
  await stripe.getByLabel('New Webhook signing secret').fill('nope');
  await stripe.getByRole('button', { name: 'Save key' }).nth(1).click();
  await expect(stripe.locator('[role="status"]').first()).toContainText('signing secret');
  await stripe.getByLabel('New Webhook signing secret').fill('whsec_ABCDEFGHIJKLMNOPQRSTUVWX1234');
  await stripe.getByRole('button', { name: 'Save key' }).nth(1).click();
  await expect(stripe).toContainText('••••1234');
  await expect(page.locator('.integ-approve')).toContainText('Stripe keys');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  // without approval the server refuses
  const draft = (await (await request.get('/api/store/integrations')).json()).data;
  draft.stripe.webhookSecret = { last4: '9999', setAt: '2026-10-15', setBy: 'x' };
  const r = await request.put('/api/store/integrations', { data: { data: draft } });
  expect(r.status()).toBe(409); expect((await r.json()).error).toContain('second admin');
  // with approval it publishes, and the secret itself is never stored
  await page.locator('.integ-approve').getByLabel('Approved by').selectOption('second-admin');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.notice.ok')).toContainText('Published version');
  const saved = await (await request.get('/api/store/integrations')).text();
  expect(saved).toContain('"last4":"1234"'); expect(saved).not.toContain('whsec_ABCDEFGH');
  expect(saved).toContain('"approvedBy":"second-admin"');
});

test('test sends go through the fake adapter; Stripe test payment only in test mode; editors cannot open the page', async ({ page }) => {
  await page.goto('/settings/integrations');
  const email = page.locator('[data-card="email"]');
  await email.getByLabel('Test email address').fill('you@example.com');
  await email.getByRole('button', { name: 'Send a test email' }).click();
  await expect(email.locator('.integ-res')).toContainText('logged, not sent');
  const stripe = page.locator('[data-card="stripe"]');
  await stripe.getByRole('button', { name: 'Run a $1 test payment' }).click();
  await expect(stripe.locator('.integ-res')).toContainText('4242 4242 4242 4242');
  await stripe.getByRole('radio', { name: 'Live' }).click();
  await stripe.getByRole('button', { name: 'Run a $1 test payment' }).click();
  await expect(stripe.locator('.integ-res')).toContainText('only run in test mode');
  await expect(stripe.locator('.sf-err').first()).toContainText('pk_live_');
  await page.context().addCookies([{ name: 'isgh-acting', value: 'web-editor', url: 'http://localhost:4322' }]);
  await page.goto('/settings/integrations');
  await expect(page.getByRole('heading', { name: 'Not part of your role' })).toBeVisible();
});
