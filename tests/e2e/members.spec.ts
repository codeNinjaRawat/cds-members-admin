/** A3 Members – black-box journeys (DEMO data, no API) + speed checks. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/members'); await page.evaluate(() => localStorage.clear()); await page.reload(); });

test('default look is Onyx and gold with full sidebar; wallpaper does not animate', async ({ page }) => {
  const s = await page.evaluate(() => ({ p: document.documentElement.dataset.preset, n: document.documentElement.dataset.nav, w: document.documentElement.dataset.wall, a: document.getAnimations().filter((x) => (x as CSSAnimation).animationName === 'drift').length }));
  expect(s).toEqual({ p: 'luxe', n: 'full', w: 'silk', a: 0 });
});

test('list: saved views with counts, view lives in the address, sidebar follows', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Members', level: 1 })).toBeVisible();
  await expect(page.locator('.m-count')).toContainText('of 320');
  await page.getByRole('tab', { name: /Can vote 2026/ }).click();
  await expect(page).toHaveURL(/view=voters/);
  await expect(page.locator('.sub-link.active')).toHaveText('Can vote this year');
  const n = Number((await page.getByRole('tab', { name: /Can vote 2026/ }).locator('span').textContent()) ?? 0);
  await expect(page.locator('.m-count')).toContainText(`of ${n}`);
  await expect(page.locator('.m-vote.no')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('tab', { name: /Can vote 2026/ })).toHaveAttribute('aria-selected', 'true');
  // sidebar sub-link switches the view without a reload
  await page.locator('.sub-link', { hasText: 'Not renewed' }).click();
  await expect(page.getByRole('tab', { name: /Not renewed/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.st-needs-info').first()).toHaveText('Not renewed');
});

test('search by name, phone digits and member ID; filters and clear', async ({ page }) => {
  const search = page.getByPlaceholder(/Name, email, phone/);
  await search.fill('aisha@example.com');
  await expect(page.locator('.m-who b')).toHaveText(['Aisha Rahman']);
  const phone = await page.locator('td[data-label="Phone"] a').first().textContent();
  await search.fill(phone!.replace(/\D/g, '').slice(-7));
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await search.fill('');
  await page.getByLabel('Zone').selectOption('n');
  await page.getByLabel('Islamic Center').selectOption('North Islamic Center 2');
  for (const t of await page.locator('.m-zone small').allTextContents()) expect(t).toBe('North Islamic Center 2');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.m-count')).toContainText('of 320');
});

test('sort and paging', async ({ page }) => {
  const th = page.locator('th', { hasText: 'Last paid' });
  await th.getByRole('button').click();
  await expect(th).toHaveAttribute('aria-sort', 'ascending');
  await th.getByRole('button').click();
  await expect(th).toHaveAttribute('aria-sort', 'descending');
  const first = await page.locator('td[data-label="Last paid"]').first().textContent();
  expect(first).toMatch(/^\d\d\/\d\d\/2026$/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.m-count')).toContainText('Showing 26–50');
  await page.getByLabel('Rows per page').selectOption('100');
  await expect(page.locator('tbody tr')).toHaveCount(100);
});

test('bulk select → export CSV of the selection', async ({ page }) => {
  await page.getByLabel('Select all on this page').check();
  await expect(page.getByText('25 selected')).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export selected' }).click()]);
  const csv = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  expect(csv.split('\r\n')).toHaveLength(26);
  expect(csv.split('\r\n')[0]).toContain('Member ID,First name,Last name');
  await expect(page.locator('.m-toast')).toContainText('Exported 25 members');
});

test('360°: not-renewed member → record an on-time check → can vote; audit entry written', async ({ page }) => {
  // find a member whose only problem is missing 2026 dues
  await page.goto('/members?view=not-renewed');
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  let opened = false;
  for (let i = 0; i < 25 && !opened; i++) {
    await rows.nth(i).locator('.m-who').click();
    await expect(page.locator('.m-verdict')).toBeVisible();
    if ((await page.locator('.m-checks li.bad').count()) === 1 && (await page.locator('.m-checks li.bad').textContent())!.includes('No 2026 dues')) opened = true;
    else await page.goBack();
  }
  expect(opened).toBeTruthy();
  await expect(page.locator('.m-verdict')).toContainText('No – No 2026 dues on record');
  await page.getByRole('button', { name: 'Record payment' }).click();
  const dlg = page.getByRole('dialog', { name: 'Record an offline payment' });
  await dlg.getByLabel('Paid on').fill('2026-06-20');
  await dlg.getByLabel('Check number or receipt (optional)').fill('Check 1042');
  await dlg.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.locator('.m-verdict')).toContainText('Yes – meets every Bylaws rule');
  await page.getByRole('tab', { name: 'Audit log' }).click();
  await expect(page.locator('.m-audit li').first()).toContainText('Payment recorded');
  await expect(page.locator('.m-audit li').first()).toContainText('Akhter Alam');
  await page.reload();
  await expect(page.locator('.m-verdict')).toContainText('Yes');
});

test('360°: a late payment renews but does not give a vote (Bylaws)', async ({ page }) => {
  await page.goto('/members?view=not-renewed');
  await page.locator('.m-who').first().click();
  await page.getByRole('button', { name: 'Record payment' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Paid on').fill('2026-07-14');
  await dlg.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.locator('.m-checks li', { hasText: 'Own dues for 2026' })).toContainText('after the record date');
  await expect(page.locator('.chip-line .st').first()).toHaveText('Active');
});

test('360°: approve a pending application and change center with a required reason', async ({ page }) => {
  await page.goto('/members?view=pending');
  await page.locator('.m-who').first().click();
  await expect(page.locator('.m-checks li.bad', { hasText: 'Board' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Board meeting or reference').fill('Board meeting, October 2026');
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('.m-checks li', { hasText: 'Board' })).toHaveClass(/ok/);
  await page.getByRole('button', { name: 'Change center' }).click();
  const dlg = page.getByRole('dialog', { name: 'Change Islamic Center' });
  await dlg.getByRole('combobox', { name: 'Zone' }).selectOption('s');
  await dlg.getByRole('button', { name: 'Save change' }).click();
  await expect(dlg).toBeVisible(); // reason is required
  await dlg.getByLabel(/Reason/).fill('Moved to a new address in Pearland');
  await dlg.getByRole('button', { name: 'Save change' }).click();
  await expect(page.locator('.m-def', { hasText: 'Zone and center' })).toContainText('South Islamic Center 1');
  await expect(page.locator('.m-def', { hasText: 'Zone and center' })).toContainText('locked until');
});

test('unknown member ID shows a friendly message', async ({ page }) => {
  await page.goto('/members/HOU-000000');
  await expect(page.getByRole('heading', { name: 'No member with ID HOU-000000' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to members' }).click();
  await expect(page).toHaveURL(/\/members$/);
});

test('phone width: rows become cards, no horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
});

test('speed: switching views and typing stay fast (< 400 ms)', async ({ page }) => {
  for (const name of [/Not renewed/, /Pending approval/, /All members/]) {
    const t = Date.now(); await page.getByRole('tab', { name }).click(); await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
    expect(Date.now() - t).toBeLessThan(600);
  }
  const t = Date.now(); await page.getByPlaceholder(/Name, email, phone/).pressSequentially('khan', { delay: 0 }); await expect(page.locator('.m-who b').first()).toContainText('Khan');
  expect(Date.now() - t).toBeLessThan(800);
});
