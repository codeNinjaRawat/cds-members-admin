/** E1 Elected officials › History – who held each position in each year: upload, by-year and by-position views, manual add, archiving. */
import { test, expect, type Page } from '@playwright/test';

const as = async (page: Page, id: string | null) => {
  await page.context().clearCookies();
  if (id) await page.context().addCookies([{ name: 'isgh-acting', value: id, url: 'http://localhost:4322' }]);
};
test.beforeEach(async ({ page, request }) => {
  for (const k of ['officials', 'org-structure', 'admin-access']) await request.delete(`/api/store/${k}`);
  await as(page, null); await page.goto('/officials?tab=history'); await page.evaluate(() => localStorage.clear()); await page.reload();
});
const dlg = (page: Page) => page.getByRole('dialog', { name: 'Upload elected members' });

test('by year and by position: the demo history is grouped and searchable', async ({ page }) => {
  await page.getByRole('tab', { name: /History/ }).click();
  await expect(page.locator('.of-hist-count')).toContainText('2020 – 2022');
  const y22 = page.locator('[data-year="2022"]');
  await expect(y22).toContainText('President');
  await expect(y22).toContainText('Yusuf Karim');
  await expect(y22.locator('tbody tr[data-term]')).toHaveCount(6);
  await expect(page.locator('[data-year="2020"]')).toContainText('Election Commissioner');     // a position the Bylaws do not know is kept as written
  // by position: the current holder leads the timeline, past terms follow newest first
  await page.getByRole('radio', { name: 'By position' }).click();
  const pres = page.locator('[data-seat="President"] .of-timeline li');
  await expect(pres).toHaveCount(3);
  await expect(pres.nth(0)).toContainText('Serving now');
  await expect(pres.nth(0)).toContainText('Yusuf Karim');
  await expect(pres.nth(1).locator('.of-tl-year')).toHaveText('2022');
  await expect(pres.nth(2)).toContainText('Nasir Baig');
  await expect(page.locator('[data-seat="Area Representatives, Southwest Islamic Center 1"]')).toContainText('ZIP 77036');
  // search narrows both views
  await page.getByLabel('Search the history').fill('Rizwan');
  await expect(page.locator('.of-hist-pos')).toHaveCount(1);
  await page.getByRole('radio', { name: 'By year' }).click();
  await expect(page.locator('.of-hist-year')).toHaveCount(2);
});

test('upload elected members: rows are checked, errors and already-filled seats are called out, good rows are added', async ({ page }) => {
  await page.getByRole('tab', { name: /History/ }).click();
  await page.getByRole('button', { name: 'Upload elected members' }).click();
  const d = dlg(page);
  await d.getByLabel('…or paste the rows here').fill([
    'Year,Position,Name,Zone,Islamic Center,ZIP codes,Member ID,How,Term starts,Term ends,End reason',
    '2018,President,Example Person A,,,,,Elected,01/07/2019,01/03/2021,Completed the term',
    '2018,Zonal Director,Example Person B,North Zone,,,,Elected,,,',
    '2018,Associate Director,Example Person C,,Southwest Islamic Center 1,,,Elected,,,',
    '2018,Area Representative,Example Person D,,Southwest Islamic Center 1,77036 77072,,Elected,,,',
    '2018,Treasurer,Example Person E,,,,,Elected,13/40/2019,,',                      // bad date
    '2018,Associate Director,Example Person F,,Nowhere Islamic Center,,,Elected,,,',  // unknown center
    '2018,Zonal Director,Example Person G,,,,,Elected,,,',                           // no zone
    '2018,President,Example Person H,,,,,Appointed,,,',                              // seat already filled that year
    '2018,Youth Coordinator,Example Person I,,,,,Appointed,,,',                      // another position – kept as written
  ].join('\n'));
  await d.getByRole('button', { name: 'Check the file' }).click();
  await expect(d.locator('.imp-ok b')).toHaveText('5');
  await expect(d.locator('.imp-dup b')).toHaveText('1');
  await expect(d.locator('.imp-err b')).toHaveText('3');
  await expect(d.locator('tr[data-line="6"]')).toContainText('Term starts: use a date');
  await expect(d.locator('tr[data-line="7"]')).toContainText('“Nowhere Islamic Center” is not in Masjids and zones');
  await expect(d.locator('tr[data-line="8"]')).toContainText('Name the zone');
  await expect(d.locator('tr[data-line="9"]')).toContainText('President already has a holder for 2018');
  await expect(d.locator('tr[data-line="3"]')).toContainText('Zonal Director, North Zone');
  await d.getByRole('button', { name: /^Add 5 terms$/ }).click();
  const y18 = page.locator('[data-year="2018"]');
  await expect(y18.locator('tbody tr[data-term]')).toHaveCount(5);
  await expect(y18).toContainText('Youth Coordinator');
  await expect(y18).toContainText('01/07/2019 – 01/03/2021');
  await expect(y18).toContainText('01/06/2019 – 01/10/2021');     // term dates filled in from the election year (oath rule)
  await expect(page.locator('.of-hist-count')).toContainText('2018 – 2022');
  // the file is remembered in the draft: publish saves it
  await page.getByRole('button', { name: /^Publish/ }).click();
  await page.reload();
  await page.getByRole('tab', { name: /History/ }).click();
  await expect(page.locator('[data-year="2018"] tbody tr[data-term]')).toHaveCount(5);
});

test('the template and the export use the same layout; missing columns stop the upload', async ({ page }) => {
  await page.getByRole('tab', { name: /History/ }).click();
  await page.getByRole('button', { name: 'Upload elected members' }).click();
  const d = dlg(page);
  const dl = page.waitForEvent('download');
  await d.getByRole('button', { name: 'Download a template' }).click();
  const file = await dl; expect(file.suggestedFilename()).toBe('elected-members-template.csv');
  await d.getByLabel('…or paste the rows here').fill('Name,Zone\nSomeone,North Zone');
  await d.getByRole('button', { name: 'Check the file' }).click();
  await expect(d.getByRole('alert')).toContainText('Missing columns: Year, Position');
  await d.getByRole('button', { name: 'Back' }).click();
  await d.getByRole('button', { name: 'Cancel' }).click();
  const ex = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  expect((await ex).suggestedFilename()).toBe('elected-officials-history.csv');
});

test('add a past term by hand; a seat marked vacant lands in the history with its end reason', async ({ page }) => {
  await page.getByRole('tab', { name: /History/ }).click();
  await page.getByRole('button', { name: 'Add a past term' }).click();
  const d = page.getByRole('dialog', { name: 'Add a past term' });
  await d.getByLabel('Election year').fill('2016');
  await d.getByLabel('Position kind').selectOption('zonal-director');
  await d.getByLabel('Zone').selectOption({ label: 'South Zone' });
  await d.getByLabel('Past holder name').fill('Example Person J');
  await d.getByRole('button', { name: 'Add to the history' }).click();
  await expect(page.locator('[data-year="2016"]')).toContainText('Zonal Director, South Zone');
  // the treasurer resigns: the ended term is archived automatically
  await page.getByRole('tab', { name: 'Board (Shura)' }).click();
  await page.locator('[data-holder="treasurer"]').click();
  const p = page.locator('aside[data-open-holder]');
  await p.getByLabel('Why the seat is empty').selectOption('resigned');
  await p.getByLabel('Vacant since').fill('2026-09-15');
  await p.getByRole('button', { name: 'Mark as vacant' }).click();
  await page.getByRole('tab', { name: /History/ }).click();
  const row = page.locator('[data-year="2025"] tr[data-term]', { hasText: 'Bilal Ansari' });
  await expect(row).toContainText('Treasurer');
  await expect(row).toContainText('Resigned');
  await expect(row).toContainText('– 09/15/2026');
  // the holder panel counts earlier Board terms from the history
  await page.getByRole('tab', { name: 'Board (Shura)' }).click();
  await page.locator('[data-holder="president"]').click();
  await expect(page.locator('aside[data-open-holder]')).toContainText('The history lists 2 earlier Board terms for Yusuf Karim');
});

test('a masjid role can read the history but not change it', async ({ page }) => {
  await as(page, 'ad-se1');
  await page.goto('/officials?tab=history');
  if ((await page.getByRole('heading', { level: 1 }).textContent()) !== 'Elected officials') return;
  await page.getByRole('tab', { name: /History/ }).click();
  await expect(page.locator('.of-hist-year').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload elected members' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a past term' })).toHaveCount(0);
});
