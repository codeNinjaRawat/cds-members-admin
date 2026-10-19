/** Every menu starts with a Dashboard: filters, a link to the full report, Download CSV and Print – and scoped roles stay in their area. */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const actAs = async (page: Page, id: string | null) => {
  await page.context().clearCookies();
  if (id) await page.context().addCookies([{ name: 'isgh-acting', value: id, url: 'http://localhost:4322' }]);
};
test.beforeEach(async ({ page, request }) => { await request.delete('/api/store/admin-access'); await actAs(page, null); });

const DASHES: [string, string, string][] = [
  ['/members/overview', 'Members dashboard', 'Membership report'],
  ['/queues/dashboard', 'Work queues dashboard', 'Open the queues'],
  ['/communication/dashboard', 'Communication dashboard', 'Delivery log'],
  ['/masjids/dashboard', 'Masjids and zones dashboard', 'Masjid working bodies'],
  ['/events/dashboard', 'Events dashboard', 'Event analytics'],
  ['/minutes/dashboard', 'Meetings dashboard', 'Required meetings check'],
  ['/elections', 'Elections dashboard', 'Voter list'],
  ['/website', 'Website dashboard', 'Pages'],
  ['/zakat?tab=overview', 'Zakat and Sadaqah', 'Zakat reports'],
  ['/donations?tab=overview', 'Donations', 'All gifts'],
  ['/finance?tab=overview', 'Finance', 'Statements and reports'],
  ['/benefits?tab=overview', 'Member benefits', 'Use log'],
  ['/officials?tab=overview', 'Elected officials', 'Vacancies'],
  ['/fundraising?tab=insights', 'Fundraising', 'Campaigns'],
];

test('each dashboard has the toolbar: report link, Download CSV and Print; no page errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`));
  for (const [url, h1, report] of DASHES) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible();
    const bar = page.getByRole('toolbar', { name: 'Filters and exports' });
    await expect(bar, url).toBeVisible();
    await expect(bar.getByRole('link', { name: report, exact: true }), url).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Download CSV' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Print' })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('every menu group with children starts with Dashboard (Members: Overview, D2)', async ({ page }) => {
  await page.goto('/');
  for (const group of ['Members', 'Work queues', 'Communication', 'Masjids and zones', 'Events', 'Zakat and Sadaqah', 'Donations', 'Fundraising', 'Finance', 'Member benefits', 'Elected officials', 'Meetings and minutes', 'Elections', 'Website']) {
    const btn = page.locator('nav .side-link.parent').filter({ hasText: new RegExp(`^${group}`) }).first();
    const toggle = (await btn.locator('.chev-btn').count()) ? btn.locator('.chev-btn') : btn;   // D2: a group with its own page folds with the chevron
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    const first = btn.locator('xpath=following-sibling::*[1]').locator('a').first();
    await expect(first, group).toHaveText(group === 'Members' ? 'Overview' : 'Dashboard');
  }
});

test('period filter changes the numbers; zone filter narrows them', async ({ page }) => {
  await page.goto('/donations?tab=overview');
  const given = page.locator('[data-tile="gross"] .viz-tile-note');
  const count = async () => Number((await given.textContent())!.match(/(\d+) gifts/)![1]);
  const all = await count();
  await page.getByRole('radio', { name: 'Last 30 days' }).click();
  await expect.poll(count).toBeLessThan(all);
  await page.getByRole('radio', { name: 'Last 12 months' }).click();
  await expect.poll(count).toBe(all);
  await page.getByRole('combobox', { name: 'Masjid' }).selectOption({ label: 'All of North Zone' });
  await expect.poll(count).toBeLessThan(all);
  await page.goto('/queues/dashboard');
  await expect(page.locator('.page-intro')).toContainText('North Zone');                  // the choice followed us here
  await page.getByRole('combobox', { name: 'Masjid' }).selectOption({ label: 'All masjids' });
  await expect(page.locator('.page-intro')).toContainText('All zones');
  const open = Number(await page.locator('[data-tile="open"] .viz-tile-value').textContent());
  await page.getByRole('combobox', { name: 'Masjid' }).selectOption({ label: 'All of North Zone' });
  await expect.poll(async () => Number(await page.locator('[data-tile="open"] .viz-tile-value').textContent())).toBeLessThan(open);
  await expect(page.locator('.page-intro')).toContainText('North Zone');
});

test('Download CSV saves totals on screen (BOM, no emails or phone numbers)', async ({ page }) => {
  for (const [url, prefix] of [['/donations?tab=overview', 'donations-dashboard'], ['/queues/dashboard', 'work-queues'], ['/elections', 'voters-by-masjid']]) {
    await page.goto(url);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
    expect(dl.suggestedFilename()).toMatch(new RegExp(`^${prefix}-\\d{4}-\\d{2}-\\d{2}\\.csv$`));
    const text = readFileSync((await dl.path())!, 'utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
    expect(text).not.toMatch(/\(\d{3}\) \d{3}-\d{4}/);
    expect(text.split('\r\n').length).toBeGreaterThan(3);
  }
});

test('masjid role: filters are locked to the own masjid, numbers stay inside it', async ({ page }) => {
  await actAs(page, 'ad-sw2');
  await page.goto('/elections');
  const bar = page.getByRole('toolbar', { name: 'Filters and exports' });
  await expect(bar.locator('.dbar-lock')).toHaveText('Southwest Islamic Center 2');
  await expect(bar.getByRole('combobox', { name: 'Masjid' })).toHaveCount(0);
  await expect(page.locator('.page-intro')).toContainText('Southwest Islamic Center 2');
  const masjidCols = page.locator('[data-chart="el-masjid"] .viz-col');
  await expect(masjidCols).toHaveCount(1);
});

test('zone role sees the zone, cannot pick another; organization pages stay hidden', async ({ page }) => {
  await actAs(page, 'sw-director');
  await page.goto('/masjids/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Masjids and zones dashboard' })).toBeVisible();
  await expect(page.locator('.dbar-lock')).toHaveText('Southwest Zone');
  const masjids = await page.getByRole('combobox', { name: 'Masjid' }).locator('option').allTextContents();
  expect(masjids.slice(1).every((m) => m.startsWith('Southwest'))).toBe(true);
});

test('events dashboard: weekly columns for short periods, monthly for the year', async ({ page }) => {
  await page.goto('/events/dashboard');
  await expect(page.locator('[data-chart="e-month"] h2')).toHaveText('Events coming up by week');
  await expect(page.locator('[data-chart="e-month"] .viz-col')).toHaveCount(13);
  await page.getByRole('radio', { name: 'Next 12 months' }).click();
  await expect(page.locator('[data-chart="e-month"] h2')).toHaveText('Events coming up by month');
  await expect(page.locator('[data-chart="e-month"] .viz-col')).toHaveCount(12);
});

test('a role built from scratch: the admin it is tagged to sees exactly those dashboards and nothing else', async ({ page }) => {
  // 1. the owner makes a role with two permissions only
  await page.goto('/settings/admins?tab=roles');
  await page.getByRole('button', { name: 'New role', exact: true }).click();
  await page.getByLabel('Role name').fill('Zakat reviewer');
  await page.getByLabel('Who they see').selectOption('all');
  await page.getByRole('checkbox', { name: /Zakat reviewer: .*See Zakat/i }).check();
  await page.getByRole('checkbox', { name: /Zakat reviewer: .*See members/i }).check();
  await expect(page.locator('.acc-modules')).toContainText('Zakat');
  // 2. tags it to a new admin
  await page.getByRole('tab', { name: 'Admins' }).click();
  await page.getByLabel('Name').fill('Rida Demo'); await page.getByLabel('Email').fill('rida.demo@example.org');
  await page.locator('.acc-invite').getByLabel('Role').selectOption({ label: 'Zakat reviewer' });
  await page.getByRole('button', { name: 'Invite admin' }).click();
  await page.getByRole('button', { name: 'Mark invitation accepted (demo)' }).click();
  await page.getByLabel('Two-step sign-in is set up').check();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.notice.ok')).toContainText('Published version');
  // 3. that admin signs in: menu shows only what the role opens
  await actAs(page, 'rida-demo');
  await page.goto('/zakat?tab=overview');
  await expect(page.getByRole('heading', { level: 1, name: 'Zakat and Sadaqah' })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Filters and exports' })).toBeVisible();
  const names = await page.locator('nav.side-tree > ul > li.node > .side-link .lbl').allInnerTexts();
  expect(names).toContain('Zakat and Sadaqah'); expect(names).toContain('Members');
  for (const hidden of ['Donations', 'Finance', 'Fundraising', 'Communication', 'Website', 'Member benefits', 'Events']) expect(names, hidden).not.toContain(hidden);
  await page.locator('nav.side-tree').getByRole('button', { name: /^Settings/ }).click();
  await expect(page.locator('nav.side-tree li.node.open').filter({ has: page.getByRole('button', { name: /^Settings/ }) }).locator('a')).toHaveText(['My appearance']);   // only the personal theme – no organization settings
  // 4. a dashboard outside the role is refused, even by address
  await page.goto('/donations?tab=overview');
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Donations');
  await expect(page.getByRole('toolbar', { name: 'Filters and exports' })).toHaveCount(0);
});
