/** F1 Zones and Islamic Centers – black-box journeys. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => { await request.delete('/api/store/org-structure'); await page.goto('/zones'); await page.evaluate(() => localStorage.clear()); await page.reload(); });

test('zones: cards with director, term and counts; warnings; edit a director and publish', async ({ page, request }) => {
  await expect(page.locator('.zn-card')).toHaveCount(5);
  await expect(page.locator('.zn-warns')).toContainText('Southeast Zone has no director');
  await expect(page.locator('[data-zone="nw"] .zn-term')).toContainText('ended');
  const sw = page.locator('.zn-card[data-zone="sw"]');
  await expect(sw.locator('.zn-counts')).toContainText('4 centers');
  await page.locator('.zn-card[data-zone="se"]').getByRole('button', { name: /Edit/ }).click();
  await page.locator('.zn-card[data-zone="se"]').getByLabel('Director', { exact: true }).fill('Southeast Director');
  await page.locator('.zn-card[data-zone="se"]').getByLabel('Director email').fill('bad');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await page.locator('.zn-card[data-zone="se"]').getByLabel('Director email').fill('dir.sez@isgh.org');
  await expect(page.locator('.zn-warns')).not.toContainText('Southeast Zone has no director');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.page-status')).toContainText('Published version 1');
  const doc = (await (await request.get('/api/store/org-structure')).json()).data;
  expect(doc.zones.find((z: any) => z.id === 'se').director.name).toBe('Southeast Director');
});

test('centers: grouped by zone with member counts; add a center (checks, ZIP hint), filter and search', async ({ page }) => {
  await page.getByRole('tab', { name: 'Islamic Centers' }).click();
  await expect(page.locator('.zn-table tbody tr')).toHaveCount(20);
  const total = (await page.locator('.zn-table td.num').allTextContents()).reduce((s, v) => s + Number(v.replace(/,/g, '')), 0);
  expect(total).toBeGreaterThan(300);
  await page.getByRole('button', { name: 'Add center' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add an Islamic Center' });
  await dlg.getByRole('button', { name: 'Add center' }).click();
  await expect(dlg.locator('.sf-err').first()).toBeVisible();                       // name required
  await dlg.getByLabel(/^Name/).fill('Masjid Bilal');
  await dlg.getByLabel(/Also known as/).fill('Adel Road Islamic Center');
  await dlg.getByLabel('ZIP code').fill('77072');
  await expect(dlg.locator('.sf-warn')).toContainText('belongs to Southwest Zone');
  await dlg.getByRole('button', { name: 'Use Southwest Zone' }).click();
  await dlg.getByLabel('Phone').fill('2815371946');
  await expect(dlg.getByLabel('Phone')).toHaveValue('(281) 537-1946');
  await dlg.getByLabel('Website').fill('masjidbilal.org');
  await dlg.getByRole('button', { name: 'Add center' }).click();
  await expect(dlg.locator('.sf-err')).toContainText('full web address');
  await dlg.getByLabel('Website').fill('https://masjidbilal.org');
  await dlg.getByRole('button', { name: 'Add center' }).click();
  await expect(page.locator('tr[data-center="masjid-bilal"]')).toContainText('Adel Road Islamic Center');
  await page.locator('.zn-bar').getByLabel('Zone').selectOption('sw');
  await expect(page.locator('.zn-table tbody tr')).toHaveCount(5);
  await page.getByPlaceholder('Center name, city or ZIP').fill('bilal');
  await expect(page.locator('.zn-table tbody tr')).toHaveCount(1);
});

test('ZIP codes: look up, one zone per ZIP, add, give it a masjid, remove', async ({ page }) => {
  await page.getByRole('tab', { name: /ZIP codes/ }).click();
  await page.getByPlaceholder('77072').fill('77072');
  await expect(page.locator('.zn-look-out')).toContainText('Southwest Zone');
  await expect(page.locator('.zn-look-out')).toContainText('Home masjid Southwest Islamic Center');
  await page.getByPlaceholder('77072').fill('10001');
  await expect(page.locator('.zn-look-out')).toContainText('outside every zone');
  await page.getByLabel('Add a ZIP code to North Zone').fill('77072');
  await page.locator('.panel', { hasText: 'North Zone ·' }).getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.panel', { hasText: 'North Zone ·' }).locator('.sf-err')).toContainText('already in Southwest Zone');
  await page.getByLabel('Add a ZIP code to North Zone').fill('77396');
  await page.locator('.panel', { hasText: 'North Zone ·' }).getByRole('button', { name: 'Add' }).click();
  const row = page.locator('[data-zone="n"] tr[data-zip="77396"]');
  await expect(row).toHaveClass(/zn-unserved/);
  await expect(page.locator('.zn-warns')).toContainText('ZIP 77396 is not served by any masjid');
  await page.getByLabel('Masjid for 77396').selectOption({ label: 'North Islamic Center 3' });
  await expect(row).not.toHaveClass(/zn-unserved/);
  await page.getByRole('tab', { name: 'Islamic Centers' }).click();
  await expect(page.locator('tr[data-center="n-3"] .zn-area')).toContainText('77396');
  await page.getByRole('tab', { name: /ZIP codes/ }).click();
  await page.getByRole('button', { name: 'Remove 77396 from North Zone' }).click();
  await expect(page.locator('[data-zone="n"] tr[data-zip="77396"]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Islamic Centers' }).click();
  await expect(page.locator('tr[data-center="n-3"] .zn-area')).not.toContainText('77396');
});

test('view-only role sees the map but cannot publish', async ({ page }) => {
  await page.context().addCookies([{ name: 'isgh-acting', value: 'board-secretary', url: 'http://localhost:4322' }]);
  await page.reload();
  await expect(page.locator('.zn-card')).toHaveCount(5);
  await expect(page.locator('.page-status')).toContainText('View only');
  await page.context().clearCookies();
});

test('Z2: start from the real ISGH centers preset – five zones, real masjids with addresses, each serving its own ZIP; still fully editable', async ({ page }) => {
  await page.goto('/zones');
  await expect(page.getByLabel('Map preset')).toHaveValue('isgh-real');
  await page.getByRole('button', { name: 'Load into the draft' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('5 zones, 21 centers');
  await expect(dlg).toContainText('to confirm');
  await dlg.getByRole('button', { name: 'Load into the draft' }).click();
  await expect(page.locator('.pill.warn')).toHaveText('Unpublished changes');
  await page.getByRole('tab', { name: 'Islamic Centers' }).click();
  await expect(page.getByText('Masjid Bilal').first()).toBeVisible();
  await expect(page.getByText('11815 Adel Rd').first()).toBeVisible();
  await expect(page.getByText('Masjid Al-Sabireen').first()).toBeVisible();
  await expect(page.getByText('Baytown Islamic Center').first()).toBeVisible();
  // the demo "North Islamic Center 1" names are gone; the warnings say directors are missing (people are entered by the admin)
  await expect(page.getByText('North Islamic Center 1')).toHaveCount(0);
  await expect(page.locator('.zn-warns')).toContainText('North Zone has no director');
  // ZIP routing: a real address ZIP goes to its masjid
  await page.getByRole('tab', { name: /ZIP codes and masjids/ }).click();
  await page.locator('.zn-look input').fill('77379');
  await expect(page.locator('.zn-look-out')).toContainText('Masjid Al-Salam');
  await page.request.delete('/api/store/org-structure');
});
