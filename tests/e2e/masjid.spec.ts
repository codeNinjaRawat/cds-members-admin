/** M1–M5 Masjid CRM: working bodies, giving roles (organization admin and masjid leader), the server check, dashboards. */
import { test, expect, type Page } from '@playwright/test';

const as = async (page: Page, id: string | null, dash?: number) => {
  await page.context().clearCookies();
  const c = [];
  if (id) c.push({ name: 'isgh-acting', value: id, url: 'http://localhost:4322' });
  if (dash) c.push({ name: 'isgh-dash', value: String(dash), url: 'http://localhost:4322' });
  if (c.length) await page.context().addCookies(c);
};
test.beforeEach(async ({ page, request }) => {
  await page.context().clearCookies();
  for (const k of ['admin-access', 'sign-in', 'org-structure', 'officials']) await request.delete(`/api/store/${k}`);
});
const publish = async (page: Page) => {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.page-status')).toContainText('Published version');
};

test('organization admin: every masjid by zone, then one masjid as an org chart', async ({ page }) => {
  await page.goto('/masjids');
  await expect(page.locator('.tm-zone')).toHaveCount(5);
  const se1 = page.locator('.tm-mq[data-masjid="se-1"]');
  await expect(se1).toContainText('3/4 seats');
  await expect(page.locator('.tm-mq[data-masjid="n-2"]')).toContainText('no AD');
  await se1.click();
  await expect(page.locator('.tm-head h2')).toHaveText('Southeast Islamic Center 1');
  await expect(page.locator('[data-seat="associate-director"]')).toContainText('Yasir Karim (demo)');
  await expect(page.locator('[data-seat="education-secretary"] .tm-vacant')).toHaveText('Vacant');
  await expect(page.locator('.tm-areas tr[data-zip="77502"]')).toContainText('Area representative 77502');
});

test('organization admin gives a masjid role to someone new, publishes, and it sticks', async ({ page }) => {
  await page.goto('/masjids');
  await page.locator('.tm-mq[data-masjid="se-1"]').click();
  await page.locator('[data-seat="education-secretary"]').getByRole('button', { name: /Assign/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Give a role' });
  await dlg.getByRole('button', { name: 'Give role' }).click();
  await expect(dlg.locator('.sf-err')).toContainText('name and email');
  await dlg.getByLabel('Name').fill('Teacher Q. Demo');
  await dlg.getByLabel('Email').fill('teacher.demo@example.org');
  await expect(dlg.locator('.tm-preview')).toContainText('Education Secretary for Southeast Islamic Center 1');
  await dlg.getByRole('button', { name: 'Give role' }).click();
  await expect(page.locator('[data-seat="education-secretary"]')).toContainText('Teacher Q. Demo');
  await publish(page);
  await page.goto('/settings/admins');
  await expect(page.locator('tr[data-admin="teacher-q-demo"]')).toContainText('Education Secretary');
  await expect(page.locator('tr[data-admin="teacher-q-demo"]')).toContainText('Invited');
});

test('one person, several roles: give another role from the admin list, and take it away', async ({ page }) => {
  await page.goto('/settings/admins');
  await page.locator('tr[data-admin="ms-se1"]').getByRole('button', { name: /Edit/ }).click();
  await page.getByRole('button', { name: /Give another role/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Give a role' });
  await dlg.getByLabel('Role').selectOption({ label: 'Area Representative' });
  await dlg.getByLabel('Masjid').selectOption('Southeast Islamic Center 1');
  await dlg.getByRole('button', { name: 'Give role' }).click();
  await expect(dlg.locator('.sf-err')).toContainText('ZIP codes');
  await dlg.getByRole('checkbox', { name: '77502' }).check();
  await dlg.getByRole('button', { name: 'Give role' }).click();
  const row = page.locator('tr[data-admin="ms-se1"]');
  await expect(row.locator('.acc-assign')).toHaveCount(2);
  await expect(row).toContainText('Southeast Islamic Center 1 · ZIP 77502');
  await page.getByRole('button', { name: 'Take Area Representative away from Southeast Center 1 membership secretary' }).click();
  await expect(row.locator('.acc-assign')).toHaveCount(1);
});

test('a role made from scratch: New role, limited to some ZIP codes of a masjid', async ({ page }) => {
  await page.goto('/settings/admins?tab=roles');
  await page.getByRole('button', { name: 'New role', exact: true }).click();
  await page.getByLabel('Role name').fill('Youth coordinator');
  await page.getByLabel('Who they see').selectOption('area');
  await expect(page.locator('.acc-role-btn.on')).toContainText('custom');
  await expect(page.locator('.acc-role-btn.on')).toContainText('own zip codes');
});

test('masjid leader builds their own working body – only inside their masjid, never more than they have', async ({ page }) => {
  await as(page, 'ad-se1');
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: 'Working body', level: 1 })).toBeVisible();
  await expect(page.locator('.tm-pick')).toHaveCount(0);                                         // only their masjid
  await expect(page.locator('[data-seat="associate-director"]').getByRole('button')).toHaveCount(0); // ADs are made by the organization admin
  await expect(page.getByRole('button', { name: /Take Associate Director away from Yasir/ })).toHaveCount(0); // not themselves
  await page.getByRole('button', { name: 'Add Area Representative for 77502' }).click();
  const dlg = page.getByRole('dialog', { name: 'Give a role' });
  const roles = await dlg.getByLabel('Role').locator('option').allInnerTexts();
  expect(roles).not.toContain('Treasurer');
  expect(roles).not.toContain('Associate Director');
  expect(roles).not.toContain('Local Zakat Coordinator');                                       // can approve Zakat – the AD cannot
  await dlg.getByLabel('Name').fill('Neighbor R. Demo'); await dlg.getByLabel('Email').fill('neighbor.demo@example.org');
  await dlg.getByRole('button', { name: 'Give role' }).click();
  await expect(page.locator('.tm-areas tr[data-zip="77502"]')).toContainText('Neighbor R. Demo');
  await publish(page);
});

test('the server refuses a masjid leader’s change outside their masjid', async ({ page }) => {
  await as(page, 'ad-se1');
  await page.goto('/team');
  const doc = await (await page.request.get('/api/store/admin-access')).json();
  const data = doc.data;
  data.admins = data.admins.map((a: { id: string; status: string }) => (a.id === 'treasurer' ? { ...a, status: 'suspended' } : a));
  const r = await page.request.put('/api/store/admin-access', { data: { data }, headers: { origin: 'http://localhost:4322' } });
  expect(r.status()).toBe(403);
  expect((await r.json()).error).toContain('outside your masjid');
  const roles = { ...doc.data, roles: doc.data.roles.map((x: { id: string; name: string }) => (x.id === 'viewer' ? { ...x, name: 'Watcher' } : x)) };
  const r2 = await page.request.put('/api/store/admin-access', { data: { data: roles }, headers: { origin: 'http://localhost:4322' } });
  expect(r2.status()).toBe(403);
  await as(page, 'ms-se1'); await page.goto('/team');
  await expect(page.locator('.no-access')).toContainText('Not part of your role');                // secretaries cannot give roles
});

test('dashboards: the home page follows the role you work in; switch without signing out', async ({ page }) => {
  await as(page, 'sw-director');
  await page.goto('/');
  await expect(page.locator('.mh .eyebrow, .mh p').first()).toContainText('Zone dashboard');
  await expect(page.locator('.mh-ztable tbody tr')).toHaveCount(4);
  await page.getByLabel('Dashboard').selectOption('1');
  await expect(page.locator('.mh[data-masjid="sw-1"] .mh-name')).toHaveText('Southwest Islamic Center 1');
  await expect(page.locator('.mh-hero .eyebrow')).toContainText('Masjid · Associate Director');
  await page.goto('/events');                                                                      // AD may run events; the zone role may not
  await expect(page.locator('.no-access')).toHaveCount(0);
  await page.getByLabel('Dashboard').selectOption('0');
  await page.goto('/');
  await expect(page.locator('.mh-ztable')).toBeVisible();
});

test('sign-in hand-over: /?as=&dash= opens that dashboard once and cleans the address', async ({ page }) => {
  await page.goto('/?as=ad-se1&dash=1');
  await expect(page.locator('.mh-hero .eyebrow')).toContainText('My area · Area Representative');
  await expect(page).toHaveURL(/localhost:4322\/$/);
  await expect(page.locator('[data-tile="members"] .cc-kv b')).toHaveText(/^\d+$/);          // current members in the ZIP
  await expect(page.locator('.mh-reps li')).toHaveCount(1);                                   // one ZIP code – their own
});

test('area representative sees only the members in their ZIP codes', async ({ page }) => {
  await as(page, 'ar-se1');
  await page.goto('/members');
  const rows = page.locator('table.m-grid tbody tr');
  await expect(rows.first()).toBeVisible();
  const n = await rows.count();
  expect(n).toBe(4);
  await expect(page.locator('.mh, .m-grid').first()).toBeVisible();
});

test('settings › sign-in: methods, chooser and a live preview of one person’s dashboards', async ({ page }) => {
  await page.goto('/settings/sign-in');
  await expect(page.locator('.si-pv li')).toHaveCount(3);
  await page.getByLabel('Preview as').selectOption({ label: 'Southwest zone director' });
  await expect(page.locator('.si-pv li')).toHaveCount(2);
  await page.getByRole('radio', { name: /Open the main role/ }).check();
  await expect(page.locator('.si-pv-note')).toContainText('Opens Zone dashboard straight away');
  await page.getByRole('switch', { name: 'Continue with Google' }).uncheck();
  await page.getByRole('switch', { name: 'A 6-digit code by email' }).uncheck();
  await expect(page.locator('.si-admin .sf-err')).toContainText('Keep at least one way to sign in');
  await page.getByRole('switch', { name: 'A 6-digit code by email' }).check();
  await page.getByRole('checkbox', { name: 'My area on' }).uncheck();
  await page.getByLabel('Preview as').selectOption({ label: 'Yasir Karim (demo)' });
  await expect(page.locator('.si-pv li')).toHaveCount(2);
  await publish(page);
});

test('officials and access: leaver taken away, joiner given access linked to the seat, review kept for a year', async ({ page }) => {
  await page.goto('/masjids?tab=officials');
  const tiles = page.locator('.oa-tile');
  await expect(tiles.nth(0)).toContainText('1');                                                     // Ahmed Jaffer's term ended
  await page.locator('.oa-item[data-admin="ad-se2"]').getByRole('button', { name: /Take access away/ }).click();
  await expect(page.locator('.oa-item[data-admin="ad-se2"]')).toHaveCount(0);
  const give = page.locator('.oa-item.k-give[data-holder="ad-sw-1"]');
  await expect(give).toContainText('Imran Malik serves as Associate Director');
  await give.getByRole('button', { name: /Give access/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Give a role' });
  await expect(dlg.getByLabel('Name')).toHaveValue('Imran Malik');
  await expect(dlg.getByLabel('Email')).toHaveValue('ad.sw1@isgh.org');
  await expect(dlg.locator('.tm-preview')).toContainText('Associate Director for Southwest Islamic Center 1');
  await dlg.getByRole('button', { name: 'Give role' }).click();
  await expect(page.locator('.oa-item[data-holder="ad-sw-1"]')).toHaveCount(0);
  const review = page.locator('.oa-item.k-review[data-admin="ar-se1"]');
  await review.getByRole('button', { name: /Keep for a year/ }).click();
  await expect(page.locator('.oa-item.k-review[data-admin="ar-se1"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('.page-status')).toContainText('Published version');
  await page.goto('/officials?tab=centers');
  await page.locator('#of-center').selectOption('Southwest Islamic Center 1');
  await expect(page.locator('.of-person[data-holder="ad-sw-1"] .of-access')).toHaveText('Has system access');
  await expect(page.locator('.of-person[data-holder="sec-sw-1-finance"] .of-access')).toHaveText('No system access');
});

test('one masjid shows its own officials-and-access list', async ({ page }) => {
  await page.goto('/masjids');
  await page.locator('.tm-mq[data-masjid="sw-1"]').click();
  const oa = page.getByRole('region', { name: 'Officials and access' });
  await expect(oa.locator('.oa-item.k-give').first()).toBeVisible();
  for (const t of await oa.locator('.oa-item').allInnerTexts()) expect(t).not.toMatch(/President|Vice President|North Zone/);
});

test('masjid roles do not see organization-wide rule pages in their menu', async ({ page }) => {
  await as(page, 'ad-se1');
  await page.goto('/');
  const side = page.locator('.side');
  for (const href of ['/zakat/settings', '/donations/settings', '/finance?tab=rules', '/prayer-times?tab=settings', '/officials?tab=rules', '/zones?tab=zones', '/masjids']) await expect(side.locator(`a[href="${href}"]`)).toHaveCount(0);
  for (const href of ['/team', '/zakat?tab=cases', '/finance?tab=overview', '/prayer-times?tab=iqamah', '/zones?tab=zips']) await expect(side.locator(`a[href="${href}"]`)).toHaveCount(1);
  await as(page, null); await page.goto('/');
  await expect(page.locator('.side a[href="/zakat/settings"]')).toHaveCount(1);
});

test('masjid home: every number comes from the masjid’s own records, with trends, attention and the working body', async ({ page }) => {
  await as(page, 'ad-se1');
  await page.goto('/');
  const home = page.locator('.mh[data-masjid="se-1"]');
  await expect(home.getByRole('heading', { level: 1 })).toContainText('Assalamu alaikum, Yasir');
  await expect(home.locator('.yr')).toBeVisible();                                                     // the membership year, like the Overview
  await expect(home.locator('.mh-prayer span')).toHaveCount(5);
  // KPI cards: members and renewed agree with each other; dues come from the payments
  const current = Number(await home.locator('[data-tile="members"] .cc-kv b').textContent());
  const renewedNote = await home.locator('[data-tile="renewed"] small').textContent();
  expect(renewedNote).toContain(`${current} of`);
  await expect(home.locator('[data-tile="dues"] .cc-kv b')).toHaveText(/^\$[\d,]+$/);
  await expect(home.locator('[data-tile="members"] .spark, [data-tile="renewed"] .spark')).toHaveCount(2);
  // charts and tables
  await expect(home.locator('[data-chart="mh-dues"] .viz-table summary')).toHaveText('Show as a table');
  await expect(home.locator('[data-chart="mh-zips"] .viz-hrow')).toHaveCount(2);                       // the masjid's two ZIP codes
  await expect(home.locator('.mh-reps li[data-zip="77502"]')).toContainText('Area representative 77502');
  // attention: the ID check is a queue item of one of this masjid's members; the vacant seat is the working body's
  await expect(home.locator('.dash-att li')).toContainText(['photo ID', 'move masjid', 'not renewed', 'Zakat case', 'Council meeting', 'Vacant: Education Secretary']);
  await expect(home.locator('.mh-body li[data-seat="education-secretary"]')).toHaveClass(/vacant/);
  await expect(home.locator('.mh-queues li').filter({ hasText: 'Photo ID checks' }).locator('b')).toHaveText('1');
  await expect(home.locator('.cc-newest .cc-people li')).toHaveCount(6);
  // nothing from another masjid: every newest member is in one of this masjid's ZIP codes
  const zips = await home.locator('.cc-newest .pl').allInnerTexts();
  expect(zips.every((z) => /ZIP 7750[2]|ZIP 77062/.test(z))).toBe(true);
  // the secretary sees the same masjid, but no Zakat line (no zakat.view) and no "Manage the working body"
  await as(page, 'ms-se1');
  await page.goto('/');
  await expect(page.locator('.mh[data-masjid="se-1"] .dash-att')).not.toContainText('Zakat case');
  await expect(page.locator('.mh-body').getByRole('link', { name: 'Manage the working body' })).toHaveCount(0);
});
