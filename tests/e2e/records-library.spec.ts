/** R1 Records library – minutes, reports, Bylaws per masjid and for the organization; audiences; the shared masjid filter; masjid roles edit their own. */
import { test, expect, type Page } from '@playwright/test';

const as = async (page: Page, id: string | null) => { await page.context().clearCookies(); if (id) await page.context().addCookies([{ name: 'isgh-acting', value: id, url: 'http://localhost:4322' }]); };
test.beforeEach(async ({ page, request }) => { await request.delete('/api/store/records'); await as(page, null); await page.goto('/records'); await page.evaluate(() => localStorage.clear()); await page.reload(); });

test('grouped by organization and masjid; the shared masjid filter narrows; add a record and publish; the website shows public ones only', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Records library', level: 1 })).toBeVisible();
  await expect(page.locator('.rc-group')).toHaveCount(4);
  await expect(page.locator('.rc-group').first()).toContainText('Whole organization');
  await expect(page.locator('[data-record="bylaws-2025"]')).toContainText('Everyone');
  await expect(page.locator('[data-record="sw1-budget-2026"]')).toContainText('Elected leaders');
  await page.getByRole('combobox', { name: 'Masjid' }).first().selectOption('Southwest Islamic Center 1');
  await expect(page.locator('.rc-group')).toHaveCount(2);                       // the organization's + the masjid's
  await page.getByLabel('Category').selectOption('minutes');
  await expect(page.locator('tr[data-record]')).toHaveCount(2);
  await page.getByLabel('Category').selectOption('');
  await page.getByRole('button', { name: 'Add a record' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add a record' });
  await expect(dlg.getByLabel('Record masjid')).toHaveValue('Southwest Islamic Center 1');   // follows the filter
  await dlg.getByLabel('Record title').fill('Council minutes – October 2026');
  await dlg.getByLabel('Record date').fill('2026-10-12');
  await dlg.getByLabel('Record link').fill('ftp://bad');
  await expect(dlg.locator('.sf-err')).toContainText('full https address');
  await dlg.getByLabel('Record link').fill('/files/sw1-council-2026-10.pdf');
  await dlg.getByRole('button', { name: 'Add record' }).click();
  await expect(page.locator('[data-center="Southwest Islamic Center 1"] tr[data-record]', { hasText: 'Council minutes – October 2026' })).toContainText('10/12/2026');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.notice.ok')).toContainText('Published version');
  const s = (await (await page.request.get('/api/store/records')).json()).data;
  expect(s.items.length).toBe(13);
  // the public page: public records only, members-only minutes stay out
  await page.goto('http://localhost:4321/records');
  await expect(page.getByRole('heading', { name: 'Records', level: 1 })).toBeVisible();
  await expect(page.locator('.rec-group').first()).toContainText('Constitution and Bylaws');
  const txt = await page.locator('.records .wrap').innerText();
  expect(txt).not.toContain('Council minutes'); expect(txt).not.toContain('Center budget');
});

test('a masjid role sees its masjid locked and can add records for it only', async ({ page }) => {
  await as(page, 'ad-se1');
  await page.goto('/records');
  await expect(page.locator('.dbar-lock, .chip-select').first()).toBeVisible();
  await expect(page.locator('.rc-group')).toHaveCount(2);
  await expect(page.locator('[data-record="sw1-minutes-2026-09"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add a record' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add a record' });
  await expect(dlg.getByLabel('Record masjid')).toBeDisabled();
  await expect(dlg.getByLabel('Record masjid')).toHaveValue('Southeast Islamic Center 1');
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  // the organization's records are read-only for them
  await expect(page.locator('[data-record="bylaws-2025"]').getByRole('button', { name: /Edit/ })).toHaveCount(0);
});
