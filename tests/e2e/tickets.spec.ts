/** Work queues › Help desk – views, reply vs note, targets, bulk, merge, ticket → task, restricted, masjid scope. Demo clock pinned. */
import { test, expect, type Page } from '@playwright/test';

const NOW = '2026-10-13T11:00:00'; // a Tuesday morning
const as = async (page: Page, id: string | null) => { await page.context().clearCookies(); if (id) await page.context().addCookies([{ name: 'isgh-acting', value: id, url: 'http://localhost:4322' }]); };
const fresh = async (page: Page, path = '/queues/tickets') => { await page.goto(path); await page.evaluate((n) => { localStorage.clear(); localStorage.setItem('isgh-demo-now', n); }, NOW); await page.reload(); };
test.beforeEach(async ({ page }) => { await as(page, null); await fresh(page); });

test('inbox views with counts; late first; the sidebar badge counts open tickets', async ({ page }) => {
  await expect(page.locator('.sub-link[href="/queues/tickets"]')).toContainText('9');
  await expect(page.locator('[data-view="late"]')).toContainText('3');
  await page.locator('[data-view="all"]').click();
  await expect(page.locator('.hd-item')).toHaveCount(9);
  await expect(page.locator('.hd-item').first()).toContainText('late');
  await page.locator('[data-view="solved"]').click();
  await expect(page.locator('[data-ticket="T-1044"]')).toBeVisible();
  await page.locator('[data-ticket="T-1044"]').click();
  await expect(page.locator('[data-open-ticket="T-1044"] .hd-csat')).toContainText('Good');
});

test('a note is private and never counts as the first reply; a reply with "wait" pauses the clock; the requester answer reopens', async ({ page }) => {
  await page.locator('[data-view="all"]').click();
  await page.locator('[data-ticket="T-1042"]').click();
  const d = page.locator('[data-open-ticket="T-1042"]');
  await expect(d.locator('[data-clock="first"]')).toContainText('late');
  await d.getByRole('tab', { name: 'Internal note' }).click();
  await d.getByLabel('Note text').fill('Ask @Website editor for a home page link.');
  await d.getByRole('button', { name: 'Add note' }).click();
  await expect(d.locator('.hd-msg.note')).toContainText('home page link');
  await expect(d.locator('[data-clock="first"]')).toContainText('late');                     // still not answered
  await d.getByRole('tab', { name: 'Reply to requester' }).click();
  await d.getByLabel('Saved reply').selectOption('looking-into-it');
  await expect(d.getByLabel('Reply text')).toHaveValue(/Assalamu alaikum Sara/);
  await d.getByLabel('Status after sending').selectOption('waiting');
  await d.getByRole('button', { name: 'Send reply' }).click();
  await expect(d.locator('[data-ticket-status]')).toHaveText('Waiting on requester');
  await expect(d.locator('[data-clock="first"]')).toContainText('missed');
  await expect(d.locator('[data-clock="solve"]')).toContainText('paused');
  await d.getByRole('button', { name: 'Demo: requester answers' }).click();
  await expect(d.locator('[data-ticket-status]')).toHaveText('Open');
});

test('unknown merge fields block sending', async ({ page }) => {
  await page.locator('[data-view="all"]').click();
  await page.locator('[data-ticket="T-1048"]').click();
  const d = page.locator('[data-open-ticket="T-1048"]');
  await d.getByLabel('Reply text').fill('Salam {{first_name}}, {{oops}}');
  await expect(d.getByRole('alert')).toContainText('{{first_name}}, {{oops}}');
  await expect(d.getByRole('button', { name: 'Send reply' })).toBeDisabled();
});

test('new ticket by phone is routed by category and masjid; take it; bulk assign; merge a duplicate', async ({ page }) => {
  await page.getByRole('button', { name: 'New ticket' }).click();
  const dlg = page.getByRole('dialog', { name: 'New ticket' });
  await dlg.getByLabel('Ticket category').selectOption('facilities');
  await dlg.getByLabel('Ticket masjid').selectOption('Southeast Islamic Center 1');
  await expect(dlg.getByLabel('Ticket owner')).toContainText('Automatic – Yasir Karim (demo)');
  await dlg.getByLabel('Requester name').fill('Brother Idris');
  await dlg.getByLabel('Ticket title').fill('Broken ablution tap');
  await dlg.getByLabel('Ticket details').fill('Left tap in the brothers’ wudu area keeps running.');
  await dlg.getByRole('button', { name: 'Create ticket' }).click();
  await page.locator('[data-view="all"]').click();
  await page.locator('.hd-item', { hasText: 'Broken ablution tap' }).click();
  const d = page.locator('[data-open-ticket="T-1051"]');
  await expect(d.getByLabel('Owner')).toHaveValue('ad-se1');
  await expect(d.getByLabel('Priority')).toHaveValue('high');
  await d.getByRole('button', { name: 'Take it' }).click();
  await expect(d.getByLabel('Owner')).toHaveValue('owner');
  // bulk: two tickets to the membership office
  await page.getByLabel('Select T-1042').check(); await page.getByLabel('Select T-1047').check();
  await page.getByLabel('Assign selected').selectOption('membership-office');
  await page.locator('[data-ticket="T-1047"]').click();
  await expect(page.locator('[data-open-ticket="T-1047"]').getByLabel('Owner')).toHaveValue('membership-office');
  // merge the second parking complaint into the first
  await page.locator('[data-ticket="T-1049"]').click();
  const dup = page.locator('[data-open-ticket="T-1049"]');
  await dup.getByLabel('Merge into').selectOption('T-1041');
  await dup.getByRole('button', { name: 'Merge T-1049 into T-1041' }).click();
  await expect(page.locator('[data-ticket="T-1049"]')).toHaveCount(0);
  await page.locator('[data-ticket="T-1041"]').click();
  await expect(page.locator('[data-open-ticket="T-1041"] .hd-thread')).toContainText('[from T-1049]');
});

test('ticket → team task: linked both ways', async ({ page }) => {
  await page.locator('[data-view="all"]').click();
  await page.locator('[data-ticket="T-1050"]').click();
  const d = page.locator('[data-open-ticket="T-1050"]');
  await d.getByRole('button', { name: 'Create a team task' }).click();
  await d.getByLabel('Task owner').selectOption('center-admin-n1');
  await d.getByRole('button', { name: 'Create task' }).click();
  await expect(d.locator('.hd-links')).toContainText('Task: Wheelchair ramp');
  await d.locator('.hd-links a').click();
  await expect(page.getByRole('dialog', { name: /Task: Wheelchair ramp/ })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('link', { name: /Ticket T-1050/ })).toBeVisible();
});

test('restricted conduct complaint: hidden from the treasurer, seen by the owner role and its masjid director is not enough', async ({ page }) => {
  await page.locator('[data-view="all"]').click();
  await expect(page.locator('[data-ticket="T-1046"]')).toBeVisible();          // Owner (senior role)
  await as(page, 'treasurer'); await page.goto('/queues/tickets'); await page.locator('[data-view="all"]').click();
  await expect(page.locator('.hd-item').first()).toBeVisible();
  await expect(page.locator('[data-ticket="T-1046"]')).toHaveCount(0);
  await as(page, 'ad-se1'); await page.goto('/queues/tickets'); await page.locator('[data-view="all"]').click();
  await expect(page.locator('[data-ticket="T-1046"]')).toHaveCount(0);           // its masjid, but restricted
  await expect(page.locator('[data-ticket="T-1041"]')).toHaveCount(0);           // another masjid
});

test('dashboard tab shows the numbers and a table view', async ({ page }) => {
  await page.getByRole('tab', { name: 'Dashboard' }).click();
  await expect(page.locator('[data-tile="hd-open"]')).toContainText('9');
  await expect(page.locator('[data-tile="hd-csat"]')).toContainText('100%');
  await expect(page.locator('[data-chart="hd-cat"]')).toContainText('Facilities and parking');
});
