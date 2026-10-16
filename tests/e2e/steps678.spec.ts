/** Admin – review steps 6–8: event registrations + check-in, sample receipt and code status, security warnings, idle lock. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => { for (const k of ['events', 'org-config']) await request.delete(`/api/store/${k}`); await page.goto('/events'); await page.evaluate(() => localStorage.clear()); });

test('event registrations: counts add up, waitlist, check-in only on the event day, export', async ({ page, request }) => {
  await page.goto('/events');
  const fam = page.locator('.cv-item[data-event="family-night-katy"]');
  await fam.locator('.cv-row').click();
  await expect(fam.locator('.ev-att')).toContainText('120 people of 120');
  await expect(fam.locator('.ev-att')).toContainText('on the waitlist');
  await expect(fam.locator('.ev-att-note')).toContainText('Check-in opens on the event day');
  await expect(fam.locator('.ev-att tbody button').first()).toBeDisabled();
  const [dl] = await Promise.all([page.waitForEvent('download'), fam.getByRole('button', { name: 'Export list' }).click()]);
  expect(dl.suggestedFilename()).toBe('family-night-katy-registrations.csv');
  // an event happening today: check-in works
  const today = await page.evaluate(() => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10));
  const doc = (await (await request.get('/api/store/events')).json()).data;
  doc.events.push({ ...doc.events.find((e: any) => e.id === 'family-night-katy'), id: 'today-test', title: 'Today test', start: `${today}T00:00`, end: `${today}T23:59`, registered: 10, waiting: 0, registration: { ...doc.events.find((e: any) => e.id === 'family-night-katy').registration, opens: undefined, closes: undefined } });
  expect((await request.put('/api/store/events', { data: { data: doc } })).status()).toBeLessThan(300);
  await page.goto('/events');
  const t = page.locator('.cv-item[data-event="today-test"]');
  await t.locator('.cv-row').click();
  await t.locator('.ev-att tbody tr').first().getByRole('button', { name: /Check in/ }).click();
  await expect(t.locator('.ev-att tbody tr').first().getByRole('button', { name: /Checked in/ })).toHaveAttribute('aria-pressed', 'true');
  expect(Number(await t.locator('[data-in]').getAttribute('data-in'))).toBeGreaterThan(0);
});

test('payments: sample receipt splits dues and gift; discount codes show where they stand', async ({ page }) => {
  await page.goto('/settings/configuration?tab=payments');
  await page.getByRole('tab', { name: 'Payments' }).click();
  const r = page.locator('.rcpt');
  await expect(r).toContainText('Gift to cover processing fees');
  await expect(r).toContainText('No goods or services were provided');
  await expect(r).toContainText('not a tax-deductible gift');
  await expect(r).toContainText(/INV-\d{4}-00042/);
  await page.getByRole('tab', { name: 'Discount codes' }).click();
  await expect(page.locator('.code-status [data-code="NEWMUSLIM"]')).toContainText('Codes are off');
});

test('security: risky choices are named; the admin screen locks after the idle time', async ({ page }) => {
  await page.clock.install();
  await page.goto('/settings/configuration?tab=security');
  await page.getByRole('tab', { name: 'Security' }).click();
  await expect(page.locator('.sec-warns')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Admins must use 2-step sign-in' }).uncheck();
  await expect(page.locator('.sec-warns')).toContainText('Two-step sign-in for admins is off');
  await page.getByRole('switch', { name: 'Admins must use 2-step sign-in' }).check();
  await page.clock.fastForward('02:01:00');
  await expect(page.getByRole('dialog', { name: 'Locked for safety' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue (demo)' }).click();
  await expect(page.getByRole('dialog', { name: 'Locked for safety' })).toHaveCount(0);
});
