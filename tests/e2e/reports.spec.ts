/** Admin – A9 reports + voter list snapshot. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/reports'); await page.evaluate(() => localStorage.clear()); await page.reload(); });
const num = async (page: import('@playwright/test').Page, id: string) => Number((await page.locator(`[data-tile="${id}"] b`).textContent())!.replace(/[^\d]/g, ''));

test('membership and dues: tiles, chart with a table view, CSV', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
  expect(await num(page, 'members')).toBe(320);
  await expect(page.locator('[data-tile="renewal"] b')).toHaveText(/%$/);
  await page.locator('.rp-bar').last().hover();
  await expect(page.locator('.rp-tip')).toContainText('new');
  await page.getByText('Show as a table').first().click();
  await expect(page.locator('.rp-table table').first().locator('tbody tr')).toHaveCount(12);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download CSV – By zone/ }).click()]);
  expect(dl.suggestedFilename()).toBe('members-by-zone-2026.csv');
  await page.getByRole('tab', { name: 'Dues' }).click();
  await expect(page.locator('[data-tile="collected"] b')).toHaveText(/^\$/);
  expect(await num(page, 'ontime') + await num(page, 'late')).toBeGreaterThan(100);
});

test('voter list: freeze, fingerprint, a change needs a reason and becomes version 2', async ({ page }) => {
  await page.goto('/reports?tab=voters');
  const eligible = await num(page, 'eligible-now');
  await page.getByRole('button', { name: /Freeze the voter list/ }).click();
  const v1 = page.locator('.rp-versions tr[data-version="1"]');
  await expect(v1).toContainText(eligible.toLocaleString('en-US'));
  await expect(v1.locator('code')).toHaveText(/^[0-9a-f]{16}…$/);
  await expect(page.locator('.rp-diff-none')).toContainText('No changes');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download version 1 (CSV)' }).click()]);
  const csv = (await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  expect(csv.split('\r\n')[0]).toBe('Member ID,Name,Zone,Islamic Center');
  expect(csv.split('\r\n')).toHaveLength(eligible + 1);
  expect(csv).not.toContain('@');                                         // no emails on a voter list
  // a member resigns after the snapshot → the frozen list does not change, the difference shows
  const first = csv.split('\r\n')[1].split(',')[0];
  await page.evaluate((id) => { const e = JSON.parse(localStorage.getItem('isgh-admin-member-edits') || '{}'); e[id] = { ...(e[id] || {}), standing: 'resigned' }; localStorage.setItem('isgh-admin-member-edits', JSON.stringify(e)); }, first);
  await page.reload();
  await expect(page.locator('.rp-diff')).toContainText('1 no longer eligible');
  await page.getByRole('button', { name: 'Save version 2' }).click();
  await expect(page.locator('.rp-diff [role="alert"]')).toContainText('needs a reason');
  await page.getByLabel('Reason for a new version').fill('Member resigned before the final list – EC decision');
  await page.getByRole('button', { name: 'Save version 2' }).click();
  await expect(page.locator('.rp-versions tr[data-version="2"]')).toContainText((eligible - 1).toLocaleString('en-US'));
  await expect(page.locator('.rp-versions tr[data-version="1"]')).toContainText(eligible.toLocaleString('en-US'));  // version 1 kept as it was
});

test('area representatives follow the ratio and rounding; candidates by years in good standing', async ({ page }) => {
  await page.goto('/reports?tab=area-reps');
  const down = await num(page, 'reps');
  await page.getByLabel('Partial groups').selectOption('up');
  expect(await num(page, 'reps')).toBeGreaterThan(down);
  await page.getByLabel('Voters per representative').fill('10');
  await page.getByLabel('Partial groups').selectOption('down');
  expect(await num(page, 'reps')).toBeGreaterThanOrEqual(down);
  await page.getByRole('tab', { name: 'Candidates' }).click();
  const board = await num(page, 'can-run-board'), officer = await num(page, 'can-run-officer');
  expect(board).toBeGreaterThan(0); expect(officer).toBeLessThanOrEqual(board);
  await page.getByRole('radio', { name: 'President / VP' }).click();
  await expect(page.locator('.rp-tbl tbody tr').first()).toContainText('Yes');
});

test('reports are in the menu; voter list link opens the voter tab; phone width has no sideways scroll', async ({ page }) => {
  await page.goto('/');
  await page.locator('.side').getByRole('link', { name: 'Reports' }).click();
  await expect(page).toHaveURL(/\/reports/);
  await page.goto('/reports?tab=voters');
  await expect(page.getByRole('tab', { name: 'Voter list' })).toHaveAttribute('aria-selected', 'true');
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
