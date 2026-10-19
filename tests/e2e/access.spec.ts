/** Admin – A10 admins, roles, zone scopes, server-side checks, audit log. */
import { test, expect, type Page } from '@playwright/test';

const actAs = async (page: Page, id: string | null) => {
  await page.context().clearCookies();
  if (id) await page.context().addCookies([{ name: 'isgh-acting', value: id, url: 'http://localhost:4322' }]);
};
test.beforeEach(async ({ page, request }) => {
  await request.delete('/api/store/admin-access'); await request.delete('/api/store/membership-settings');
  await actAs(page, null); await page.goto('/'); await page.evaluate(() => localStorage.clear());
});

test('admins page: warnings, invite, two-step required for sensitive roles, publish', async ({ page, request }) => {
  await page.goto('/settings/admins');
  await expect(page.locator('.acc-warns')).toContainText('Only one Election Commission member');
  await expect(page.locator('.acc-warns')).toContainText('Not used for 6 months');
  await page.getByLabel('Name').fill('Second treasurer'); await page.getByLabel('Email').fill('treasurer2@isgh.org');
  await page.locator('.acc-invite').getByLabel('Role').selectOption('treasurer');
  await page.getByRole('button', { name: 'Invite admin' }).click();
  const row = page.locator('tr[data-admin="second-treasurer"]');
  await expect(row).toContainText('Invited');
  await page.getByRole('button', { name: 'Mark invitation accepted (demo)' }).click();
  await expect(page.locator('.acc-edit .sf-err').last()).toContainText('two-step sign-in is required');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await page.getByLabel('Two-step sign-in is set up').check();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.notice.ok')).toContainText('Published version');
  const doc = (await (await request.get('/api/store/admin-access')).json()).data;
  expect(doc.admins.find((a: any) => a.id === 'second-treasurer')).toMatchObject({ roleId: 'treasurer', status: 'active', twoStep: true });
  await page.getByRole('tab', { name: 'Roles' }).click();
  await page.locator('[data-role="election-commission"]').click();
  await expect(page.locator('[data-perm="voters.freeze"]')).toContainText('sensitive');
});

test('website editor: no member pages in the menu, members page refused, server refuses a rules change', async ({ page }) => {
  await actAs(page, 'web-editor');
  await page.goto('/');
  await expect(page.locator('.me-name')).toContainText('Website editor');
  await expect(page.locator('.side').getByRole('button', { name: /Members/ })).toHaveCount(0);
  await page.goto('/members');
  await expect(page.getByRole('heading', { name: 'Not part of your role' })).toBeVisible();
  const cur = (await (await page.request.get('/api/store/membership-settings')).json()).data;
  const r = await page.request.put('/api/store/membership-settings', { data: { data: cur } });
  expect(r.status()).toBe(403);
  expect((await r.json()).error).toContain('Website editor');
  expect((await page.request.put('/api/store/news', { data: { data: (await (await page.request.get('/api/store/news')).json()).data } })).status()).toBeLessThan(300);
  await page.request.delete('/api/store/news');
});

test('zone director sees only their zone; board member sees no contact details but can approve', async ({ page }) => {
  await actAs(page, 'sw-director');
  await page.goto('/members');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  const zones = await page.locator('tbody td[data-label="Zone"]').allTextContents();
  expect(zones.every((z) => z.startsWith('Southwest'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Import' })).toHaveCount(0);
  await page.goto('/members/HOU-200000');
  await page.locator('h1.panel-h, .m-defs').first().waitFor();
  const outside = await page.getByRole('heading', { name: 'Not in your zones' }).count();
  const zoneText = outside ? '' : await page.locator('.m-defs').first().textContent();
  expect(outside > 0 || zoneText!.includes('Southwest')).toBe(true);
  await actAs(page, 'board-secretary');
  await page.goto('/members?view=pending');
  await page.locator('tbody tr .m-who').first().click(); await page.getByRole('link', { name: 'Open full profile' }).click();
  await expect(page.locator('.m-defs').first()).toContainText('Hidden for your role');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export this view' })).toHaveCount(0);
});

test('voter list: only the Election Commission freezes it; the audit log shows who did what', async ({ page }) => {
  await actAs(page, 'board-secretary');
  await page.goto('/reports?tab=voters');
  await expect(page.getByText('Only the Election Commission can freeze the voter list.')).toBeVisible();
  await actAs(page, 'ec-chair');
  await page.goto('/reports?tab=voters');
  await page.getByRole('button', { name: /Freeze the voter list/ }).click();
  await expect(page.locator('.rp-versions tr[data-version="1"]')).toContainText('Election Commission chair');
  await actAs(page, null);
  await page.goto('/settings/audit');
  await page.getByLabel('Area').selectOption('voters');
  await expect(page.locator('.audit-table tbody tr').first()).toContainText('Voter list 2026 version 1 frozen');
  await expect(page.locator('.audit-table tbody tr').first()).toContainText('Election Commission chair');
});

test('roles are listed by area; each role shows its permissions module by module; custom role checks', async ({ page, request }) => {
  await request.delete('/api/store/admin-access');
  await page.goto('/settings/admins?tab=roles');
  await expect(page.locator('.acc-area h3')).toHaveText(['Leadership', 'Masjid working body', 'Membership and centers', 'Zakat and Sadaqah', 'Donations and finance', 'Communication', 'Benefits and community', 'Events', 'Website', 'Elections', 'Other']);
  await expect(page.locator('.acc-area[data-area="zakat"] .acc-role-btn')).toHaveCount(5);
  await page.locator('[data-role="zakat-coordinator"]').click();
  await expect(page.locator('.acc-role-facts')).toContainText('Only their own masjid(s)');
  await expect(page.locator('.acc-role-facts')).toContainText('Level 1');
  await expect(page.locator('.acc-mod').first()).toHaveAttribute('data-module', 'Zakat and Sadaqah');      // modules it uses come first
  await expect(page.locator('.acc-mod[data-module="Zakat and Sadaqah"] legend')).toContainText('Screens arrive with F2');
  await expect(page.locator('[data-perm="zakat.disburse"] input')).not.toBeChecked();
  await page.getByRole('button', { name: 'Copy as a new role' }).click();
  await expect(page.locator('.acc-role-btn.on')).toContainText('custom');
  await page.locator('[data-perm="zakat.approve"] input').uncheck();
  await expect(page.locator('.acc-role .sf-err').first()).toContainText('approval level needs');
  await page.getByLabel('Zakat approval level').selectOption('0');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
});

test('center-limited roles: Associate Director sees only members of their own center; admin needs a center', async ({ page, request }) => {
  await request.delete('/api/store/admin-access');
  await page.context().addCookies([{ name: 'isgh-acting', value: 'ad-sw2', url: 'http://localhost:4322' }]);
  await page.goto('/members');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  const zones = await page.locator('tbody td[data-label="Zone"] .m-zone').evaluateAll((els) => els.map((e) => e.getAttribute('title')));
  expect(zones.length).toBeGreaterThan(5);
  expect(zones.every((c) => c === 'Southwest Islamic Center 2')).toBe(true);
  await page.goto('/members/overview');
  await expect(page.locator('.dbar-lock')).toHaveText('Southwest Islamic Center 2');
  await page.context().clearCookies();
  await page.goto('/settings/admins');
  const row = page.locator('tr[data-admin="ad-sw2"]');
  await expect(row).toContainText('Southwest Islamic Center 2');
  await row.getByRole('button', { name: /Edit/ }).click();
  await page.locator('.acc-centers').getByLabel('Southwest Islamic Center 2').uncheck();
  await expect(page.locator('.acc-centers .sf-err')).toContainText('needs at least one Islamic Center');
});
