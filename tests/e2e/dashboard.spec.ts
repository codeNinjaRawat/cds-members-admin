/** Members › Dashboard – charts render, agree with each other, filter by zone, hover and keyboard work, tables exist. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/members/overview'); await page.evaluate(() => localStorage.clear()); await page.reload(); });

test('dashboard: tiles, every chart and a table view for each; sidebar marks Dashboard only', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByRole('heading', { name: 'Members dashboard', level: 1 })).toBeVisible();
  await expect(page.locator('[data-tile="total"] .viz-tile-value')).toHaveText('312');
  await expect(page.locator('[data-tile="voters"] .viz-tile-value')).toHaveText('210');
  for (const id of ['status', 'payments', 'plans', 'zones', 'ages', 'joins', 'methods']) {
    await expect(page.locator(`[data-chart="${id}"]`)).toBeVisible();
    await expect(page.locator(`[data-chart="${id}"] .viz-table summary`)).toHaveText('Show as a table');
  }
  await expect(page.locator('[data-chart="plans"] .viz-slice')).toHaveCount(4);
  await expect(page.locator('[data-chart="ages"] .viz-col')).toHaveCount(6);
  await expect(page.locator('[data-chart="zones"] .viz-hrow')).toHaveCount(5);
  await expect(page.locator('.sub-link.active')).toHaveText(['Dashboard']);
  expect(errors).toEqual([]);
});

test('numbers agree across charts: plan donut and zone bars both add up to the members tile', async ({ page }) => {
  const total = Number((await page.locator('[data-tile="total"] .viz-tile-value').textContent())!.replace(/,/g, ''));
  const plans = await page.locator('[data-chart="plans"] .viz-legend b').allTextContents();
  expect(plans.reduce((s, v) => s + Number(v.replace(/,/g, '')), 0)).toBe(total);
  const zones = await page.locator('[data-chart="zones"] .viz-hval').allTextContents();
  expect(zones.reduce((s, v) => s + Number(v), 0)).toBe(total);
  await expect(page.locator('[data-chart="plans"] .viz-donut-v')).toHaveText(String(total));
});

test('hover and keyboard: line crosshair lists both years; donut legend focus shows the share', async ({ page }) => {
  await page.locator('[data-chart="payments"] .viz-hit').nth(4).hover();
  const tip = page.locator('[data-chart="payments"] .viz-tip');
  await expect(tip).toContainText('May'); await expect(tip.locator('.viz-tip-row')).toHaveCount(2);
  await page.mouse.move(5, 5);
  await expect(tip).toHaveCount(0);
  await page.locator('[data-chart="methods"] .viz-legend button').first().focus();
  await expect(page.locator('[data-chart="methods"] .viz-donut-l')).toHaveText('Card');
  await expect(page.locator('[data-chart="methods"] .viz-donut-v')).toHaveText(/%$/);
  await page.locator('[data-chart="ages"] .viz-col').nth(3).focus();
  await expect(page.locator('[data-chart="ages"] .viz-col.hot')).toHaveCount(1);
});

test('zone filter scopes every number; zone director sees only their zone', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Masjid' }).selectOption({ label: 'All of North Zone' });
  await expect(page.locator('.page-intro')).toContainText('North Zone');
  await expect(page.locator('[data-chart="zones"] .viz-hrow')).toHaveCount(1);
  const north = Number(await page.locator('[data-chart="zones"] .viz-hval').textContent());
  await expect(page.locator('[data-tile="total"] .viz-tile-value')).toHaveText(String(north));
  await page.context().addCookies([{ name: 'isgh-acting', value: 'sw-director', url: 'http://localhost:4322' }]);
  await page.reload();
  await expect(page.locator('.dbar-lock')).toHaveText('Southwest Zone');                       // a zone role cannot pick another zone
  await expect(page.locator('[data-chart="zones"] .viz-hrow')).toHaveCount(1);
  await expect(page.locator('[data-chart="zones"] .viz-hrow[data-row="sw"]')).toBeVisible();
  await page.context().clearCookies();
});

test('table view shows the numbers without hovering', async ({ page }) => {
  await page.locator('[data-chart="ages"] .viz-table summary').click();
  await expect(page.locator('[data-chart="ages"] .viz-table tbody tr')).toHaveCount(6);
  await page.locator('[data-chart="payments"] .viz-table summary').click();
  await expect(page.locator('[data-chart="payments"] .viz-table tbody tr').nth(11)).toContainText('—');
});
