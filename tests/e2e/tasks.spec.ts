/** Work queues › Team tasks – my work, board move, checklist, recurring, template project, overview card, settings. Demo clock pinned. */
import { test, expect, type Page } from '@playwright/test';

const NOW = '2026-10-13T11:00:00';
const as = async (page: Page, id: string | null) => { await page.context().clearCookies(); if (id) await page.context().addCookies([{ name: 'isgh-acting', value: id, url: 'http://localhost:4322' }]); };
const fresh = async (page: Page, path = '/tasks') => { await page.goto(path); await page.evaluate((n) => { localStorage.clear(); localStorage.setItem('isgh-demo-now', n); }, NOW); await page.reload(); };
test.beforeEach(async ({ page }) => { await as(page, null); await fresh(page); });

test('my work buckets; ticking a task done; the sidebar badge follows', async ({ page }) => {
  await expect(page.locator('[data-bucket="overdue"]')).toContainText('Ask the client for the Zones map');
  await expect(page.locator('[data-bucket="today"]')).toContainText('Check 2027 dues');
  await expect(page.locator('[data-bucket="asked"]')).toContainText('Trial import of the Wild Apricot');
  await expect(page.locator('[data-bucket="asked"]')).toContainText('Monthly finance report');
  await expect(page.locator('.sub-link', { hasText: 'Team tasks' })).toContainText('2');
  await page.getByLabel('Done: Check 2027 dues and the reminder text').click();
  await expect(page.locator('[data-bucket="today"]')).not.toContainText('Check 2027 dues');
  await expect(page.locator('.sub-link', { hasText: 'Team tasks' })).toContainText('1');
});

test('board: move with the keyboard-friendly menu; checklist and comment in the task; recurring makes the next one', async ({ page }) => {
  await page.getByRole('tab', { name: 'Board', exact: true }).click();
  await page.getByLabel('Move Print renewal flyers for every masjid').selectOption('doing');
  await expect(page.locator('[data-col="doing"]')).toContainText('Print renewal flyers');
  await page.locator('[data-card="task-flyers"] .tk-card-main').click();
  const dlg = page.getByRole('dialog', { name: /Task: Print renewal flyers/ });
  await dlg.getByLabel('Add a checklist item').fill('Pick up from the printer'); await dlg.getByLabel('Add a checklist item').press('Enter');
  await expect(dlg.locator('.tk-checklist li')).toHaveCount(3);
  await dlg.getByRole('textbox', { name: 'Comment' }).fill('@Treasurer please approve the print invoice'); await dlg.getByRole('button', { name: 'Comment' }).click();
  await expect(dlg.locator('.tk-helpers')).toContainText('ISGH Treasurer');
  await dlg.getByLabel('Close').click();
  await page.getByLabel('Owner').selectOption('treasurer');
  await page.locator('[data-card="task-finance-report"] .tk-card-main').click();
  const fr = page.getByRole('dialog', { name: /Monthly finance report/ });
  await fr.getByRole('button', { name: /Mark done/ }).click();
  await fr.getByLabel('Close').click();
  await expect(page.locator('[data-col="todo"] .tk-card', { hasText: 'Monthly finance report' })).toContainText('Nov 16');  // Oct 16 + 1 month
});

test('new project from a template: dates from the anchor day, owners from roles', async ({ page }) => {
  await page.getByRole('button', { name: 'New project' }).click();
  const dlg = page.getByRole('dialog', { name: 'New project' });
  await dlg.getByLabel('Template').selectOption('eid-prayer');
  await dlg.getByLabel('Anchor date').fill('2027-03-10');
  await dlg.getByLabel('Project masjid').selectOption('Southeast Islamic Center 1');
  await dlg.getByLabel('Project name').fill('Eid ul-Fitr 2027 – Southeast 1');
  await expect(dlg.locator('.tk-preview')).toContainText('Feb 8');
  await expect(dlg.locator('.tk-preview')).toContainText('Yasir Karim (demo)');
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('tab', { name: /^Projects/ }).click();
  await expect(page.locator('.tk-project', { hasText: 'Eid ul-Fitr 2027' })).toContainText('0/6');
  // the masjid's membership secretary sees it (everyone at the masjid); a Southwest associate director does not
  await as(page, 'ms-se1'); await page.goto('/tasks?tab=projects');
  await expect(page.locator('.tk-project', { hasText: 'Eid ul-Fitr 2027' })).toBeVisible();
  await as(page, 'ad-sw2'); await page.goto('/tasks?tab=projects');
  await expect(page.locator('.tk-project', { hasText: 'Eid ul-Fitr 2027' })).toHaveCount(0);
});

test('overview: My work card replaces the fixed demo list and ticks tasks off', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('[data-mywork]');
  await expect(card).toContainText('Check 2027 dues');
  await expect(card).toContainText('Thank you for the new prayer timetable');
  await card.getByLabel('Done: Check 2027 dues and the reminder text').click();
  await expect(card).not.toContainText('Check 2027 dues');
});

test('settings: a category can route to a person; targets validated before publishing', async ({ page }) => {
  await page.goto('/settings/work');
  await page.getByLabel('Low first reply hours').fill('200');
  await expect(page.getByText('Low: the first reply target cannot be longer than the solve target.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();
  await page.getByLabel('Low first reply hours').fill('16');
  await page.getByLabel('Category 7 goes to').selectOption('admin:comms');
  await page.getByRole('button', { name: 'Publish' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText(/Published version/).first()).toBeVisible();
  await page.goto('/queues/tickets'); await page.locator('[data-view="all"]').click();
  await page.getByRole('button', { name: 'New ticket' }).click();
  const dlg = page.getByRole('dialog', { name: 'New ticket' });
  await dlg.getByLabel('Ticket category').selectOption('feedback');
  await expect(dlg.getByLabel('Ticket owner')).toContainText('Automatic – Communication manager');
  await page.request.delete('/api/store/work-settings');
});
