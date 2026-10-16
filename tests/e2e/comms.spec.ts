/** Admin – Communication (review steps 4 and 5): system email rules, renewal email plan, send a message. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => { for (const k of ['communication', 'membership-settings', 'groups']) await request.delete(`/api/store/${k}`); await page.goto('/communication'); await page.evaluate(() => localStorage.clear()); });

test('renewal emails follow the renewal steps; an email switched off is flagged; receipts cannot be switched off', async ({ page }) => {
  await page.goto('/communication?tab=system');
  const plan = page.locator('.ren-mail');
  await expect(plan.locator('li')).toHaveCount(6);
  await expect(plan.locator('li').first()).toContainText('Renewal reminder 1');
  await expect(plan.locator('li').first()).toContainText('12/01/');
  await page.locator('[data-email="grace-notice"]').getByRole('switch').uncheck();
  await expect(plan.locator('li[data-key="grace-notice"]')).toHaveClass(/off/);
  await expect(page.locator('.ren-mail-warn')).toContainText('Grace period ends');
  await expect(page.locator('[data-email="receipt"]').getByRole('switch')).toBeDisabled();
});

test('system email rules: wrong merge field, missing renew link, subject on one line', async ({ page }) => {
  await page.goto('/communication?tab=system');
  const row = page.locator('[data-email="renewal-reminder-1"]');
  await row.getByRole('button', { name: /Edit/ }).click();
  await row.getByLabel('Message').fill('Join us at {Event.Title}.');
  await expect(row.locator('.sf-err').first()).toContainText(/has no value|Renew link/);
  await expect(row.locator('.cv-macros')).not.toContainText('Event title');   // only fields that have a value here
  await row.getByLabel('Message').fill('Please renew: {Link.Renew}');
  await expect(row.locator('.sf-err')).toHaveCount(0);
});

test('send a message: template, groups, who is left out and why, schedule rules, send', async ({ page }) => {
  await page.goto('/communication?tab=send');
  await page.getByRole('button', { name: 'New message' }).click();
  await page.getByLabel('Start from a template').selectOption('monthly-newsletter');
  await expect(page.getByLabel('Name (only staff see it)')).toHaveValue('Monthly newsletter');
  await expect(page.getByLabel('Kind of message')).toHaveValue('newsletter');
  const count = page.locator('.cmp-count b');
  await expect(page.locator('.cmp-issues')).toContainText('Choose who gets it');
  await page.getByRole('checkbox', { name: 'North zone' }).first().check();
  const north = Number(await count.getAttribute('data-count'));
  expect(north).toBeGreaterThan(20);
  await expect(page.locator('.cmp-count [data-skip="unsubscribed"]')).toContainText('chose not to get');
  await page.getByLabel('Kind of message').selectOption('membership');
  expect(Number(await count.getAttribute('data-count'))).toBeGreaterThan(north);           // official notice ignores opt-outs
  await page.getByLabel('Kind of message').selectOption('newsletter');
  await expect(page.locator('.cv-preview')).toContainText('Change what you get');
  await page.getByRole('radio', { name: 'Schedule' }).click();
  await page.getByLabel('Send on (Houston time)').fill('2020-01-01T09:00');
  await expect(page.locator('.cmp-issues')).toContainText('in the future');
  await page.getByRole('radio', { name: 'Send now' }).click();
  await page.getByRole('radio', { name: 'Text message' }).click();
  await expect(page.locator('.cmp-issues')).toContainText('Text messages are switched off');
  await expect(page.locator('.cmp-seg')).toContainText('text part');
  await page.getByRole('radio', { name: 'Email' }).click();
  await page.getByLabel('Subject').fill('October newsletter');
  await page.getByRole('button', { name: 'Send now…' }).click();
  await expect(page.getByRole('dialog')).toContainText(`goes to ${north.toLocaleString('en-US')}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.notice.ok')).toContainText('Nothing was sent');
  await expect(page.locator('tr', { hasText: 'Monthly newsletter' })).toContainText('Sent');
});
