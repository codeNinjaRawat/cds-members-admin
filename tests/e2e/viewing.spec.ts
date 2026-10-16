/**
 * "Viewing" – everything belongs to a masjid through a ZIP code. One shared masjid filter (All masjids › a zone › one
 * masjid) narrows every list and dashboard, sticks as you move between screens, clears from the top bar, and is locked
 * for masjid and zone roles. Every admin except an Owner has a home ZIP that places them in a masjid.
 */
import { test, expect, type Page } from '@playwright/test';

const actAs = async (page: Page, id: string | null) => {
  await page.context().clearCookies();
  if (id) await page.context().addCookies([{ name: 'isgh-acting', value: id, url: 'http://localhost:4322' }]);
};
test.beforeEach(async ({ page, request }) => { await request.delete('/api/store/admin-access'); await actAs(page, null); await page.goto('/'); await page.evaluate(() => localStorage.clear()); });

const SW1 = 'Southwest Islamic Center 1';
const pick = (page: Page) => page.getByRole('combobox', { name: 'Masjid' }).first();

test('one choice follows you: pick a masjid in Work queues, every other list shows only that masjid', async ({ page }) => {
  await page.goto('/queues?tab=applications');
  const tile = page.getByRole('tab', { name: /^Applications/ });
  const count = async () => Number((await tile.locator('b').textContent())!.replace(/\D/g, ''));
  const before = await count();
  await pick(page).selectOption(SW1);
  await expect(page.locator('.viewing-chip')).toContainText(SW1);                       // top bar says what you are viewing
  await expect.poll(count).toBeLessThan(before);
  // members list: the zone and center filters are filled from the same choice
  await page.goto('/members');
  await expect(page.locator('.m-chip', { hasText: SW1 })).toBeVisible();
  const centers = await page.locator('tbody td[data-label="Zone"] .m-zone').evaluateAll((els) => els.map((e) => e.getAttribute('title')));
  expect(centers.length).toBeGreaterThan(0); expect(centers.every((c) => c === SW1)).toBe(true);
  // gifts, zakat, events, groups, reports, admins: the picker shows the same masjid and the lists are narrowed
  for (const [url, rowSel, col] of [['/donations?tab=gifts', 'tbody tr', ''], ['/zakat?tab=cases', '.zk-table tbody tr', 'td:nth-child(4)'], ['/settings/admins', 'tr[data-admin]', '.acc-home']] as const) {
    await page.goto(url);
    await expect(pick(page)).toHaveValue(SW1);
    if (col) {
      // each row belongs to the masjid: its home masjid, or (admins) a role held there
      const rows = await page.locator(rowSel).allInnerTexts();
      expect(rows.length, url).toBeGreaterThan(0);
      expect(rows.every((r) => r.includes(SW1)), url).toBe(true);
    }
  }
  await page.goto('/reports');
  await expect(page.locator('.page-intro')).toContainText(`members in ${SW1}`);
  // dashboards read the same choice
  await page.goto('/elections');
  await expect(page.locator('.page-intro')).toContainText(SW1);
  await expect(page.locator('[data-chart="el-masjid"] .viz-col')).toHaveCount(1);
  // the top-bar chip clears it everywhere
  await page.locator('.viewing-chip').click();
  await expect(page.locator('.viewing-chip')).toHaveCount(0);
  await expect(page.locator('.page-intro')).toContainText('All zones');
  await page.goto('/members');
  await expect(page.locator('.m-chip', { hasText: SW1 })).toHaveCount(0);
});

test('a whole zone can be picked; "Not routed yet" shows gifts without a masjid', async ({ page }) => {
  await page.goto('/donations?tab=gifts');
  const rows = page.locator('[aria-label="All gifts"] tbody tr');
  const all = await rows.count();
  await pick(page).selectOption({ label: 'All of North Zone' });
  await expect(page.locator('.viewing-chip')).toContainText('North Zone');
  const north = await rows.count(); expect(north).toBeLessThan(all); expect(north).toBeGreaterThan(0);
  await pick(page).selectOption({ label: 'Not routed yet' });
  await expect(page.locator('.viewing-chip')).toContainText('Not routed');
  const unrouted = await page.locator('[aria-label="All gifts"] tbody tr').count();
  expect(unrouted).toBeGreaterThan(0); expect(unrouted + north).toBeLessThan(all);
});

test('masjid role: the filter is locked to their masjid on every screen; zone role to their zone', async ({ page }) => {
  await actAs(page, 'ad-se1');
  for (const url of ['/queues?tab=applications', '/donations?tab=gifts', '/settings/admins', '/events']) {
    await page.goto(url);
    if (url === '/settings/admins' && (await page.getByRole('heading', { level: 1 }).textContent()) !== 'Admins and roles') continue; // not their page
    await expect(page.locator('.dbar-lock').first(), url).toHaveText('Southeast Islamic Center 1');
    await expect(pick(page), url).toHaveCount(0);
  }
  await expect(page.locator('.viewing-chip')).toHaveCount(0);                         // nothing to clear – it is their role, not a filter
  await actAs(page, 'sw-director');
  await page.goto('/queues?tab=applications');
  await expect(page.locator('.dbar-lock').first()).toHaveText('Southwest Zone');
});

test('every admin except an Owner has a home ZIP → masjid; the warning names who is missing one', async ({ page }) => {
  await page.goto('/settings/admins');
  await expect(page.locator('.acc-warns')).not.toContainText('No home ZIP');
  await expect(page.locator('tr[data-admin="akhter"] .acc-home')).toHaveText('Organization');
  await expect(page.locator('tr[data-admin="treasurer"] .acc-home')).toContainText('Southwest Islamic Center 1');
  await expect(page.locator('tr[data-admin="treasurer"] .acc-home')).toContainText('ZIP 77036');
  await expect(page.locator('tr[data-admin="ar-se1"] .acc-home')).toContainText('ZIP 77502');            // an area role: its ZIP is the home
  await page.locator('tr[data-admin="treasurer"]').getByRole('button', { name: /Edit/ }).click();
  const zip = page.getByLabel('Home ZIP of ISGH Treasurer');
  await zip.fill('');
  await expect(page.locator('.acc-warns')).toContainText('No home ZIP code: ISGH Treasurer');
  await zip.fill('77014');
  await expect(page.locator('tr[data-admin="treasurer"] .acc-home')).toContainText('North Islamic Center 1');
  await zip.fill('99999');
  await expect(page.locator('.acc-edit')).toContainText('No masjid serves this ZIP yet');
  // inviting: the ZIP is asked for and shows the masjid before you send
  await zip.fill('77036');
  await page.getByLabel('Name').fill('Nadia Demo'); await page.getByLabel('Email').fill('nadia.demo@example.org');
  await page.locator('.acc-invite').getByLabel('Home ZIP').fill('77502');
  await expect(page.locator('.acc-invite')).toContainText('Southeast Islamic Center 1');
  await page.getByRole('button', { name: 'Invite admin' }).click();
  await expect(page.locator('tr[data-admin="nadia-demo"] .acc-home')).toContainText('Southeast Islamic Center 1');
});
