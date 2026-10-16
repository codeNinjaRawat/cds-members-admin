/** Admin A0/A1 + website controls – black-box journeys against the real store route (demo store folder). */
import { test, expect, type Page } from '@playwright/test';

const KEYS = ['site-config', 'home', 'membership-settings', 'giving', 'pages', 'news', 'themes'];
async function resetAll(page: Page) {
  await page.goto('/');
  await page.evaluate(async (keys) => { localStorage.clear(); for (const k of keys) await fetch(`/api/store/${k}`, { method: 'DELETE' }); }, KEYS);
}
const store = (page: Page, key: string) => page.evaluate(async (k) => (await fetch(`/api/store/${k}`)).json(), key);

test.beforeEach(async ({ page }) => { await resetAll(page); });

test.describe('shell', () => {
  test('sidebar: submenus open, deep-link to tabs, planned modules are not links', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('isgh-admin-appearance', JSON.stringify({ nav: 'full' })));
    await page.reload();
    await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    for (const sec of ['Website', 'Giving', 'Membership', 'Settings']) {
      const btn = page.getByRole('button', { name: new RegExp('^' + sec) });
      if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
    }
    for (const name of ['Theme and branding', 'Home page', 'Menus and footer', 'Announcement bar', 'Pages', 'News', 'Verses and hadith', 'Who still needs help', 'Plans and dues', 'Organization', 'Feature switches', 'My appearance'])
      await expect(page.locator('.side').getByRole('link', { name: new RegExp('^' + name) })).toBeVisible();
    await page.locator('.side').getByRole('link', { name: /^Who still needs help/ }).click();
    await expect(page).toHaveURL(/\/website\/giving\?tab=needs$/);
    await expect(page.getByRole('tab', { name: /Who still needs help/ })).toHaveAttribute('aria-selected', 'true');
    await page.locator('.side').getByRole('link', { name: /^How we helped/ }).click();
    await expect(page.getByRole('tab', { name: /How we helped/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.side').getByRole('link', { name: /^How we helped/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.sub-link.soon').first()).toBeAttached();
  });

  test('icon rail: submenu flies out on hover', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('isgh-admin-appearance', JSON.stringify({ nav: 'rail' })));
    await page.reload();
    await page.getByRole('button', { name: /^Website/ }).hover();
    await expect(page.locator('#sub-website')).toBeVisible();
    await page.locator('#sub-website').getByRole('link', { name: 'Pages' }).click();
    await expect(page).toHaveURL(/\/website\/pages$/);
  });

  test('Ctrl+K finds a screen by plain words and opens it', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Find a setting or page' }).fill('zakat');
    await expect(page.locator('#cmdk-list').getByRole('option').first()).toContainText('Zakat and Sadaqah dashboard');   // page names first
    await expect(page.locator('#cmdk-list')).toContainText('Giving page');                                      // keywords still find it
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/zakat\?tab=overview$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zakat and Sadaqah');
  });

  test('my appearance: theme, dark mode and glass persist after reload', async ({ page }) => {
    await page.goto('/appearance');
    await page.getByRole('radio', { name: /Midnight/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-preset', 'midnight');
    await page.getByRole('radio', { name: 'Dark', exact: true }).click();
    await page.getByRole('radio', { name: 'Solid' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-glass', 'solid');
    await expect(page.getByRole('radio', { name: /Midnight/ })).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('publish flow', () => {
  test('edit announcement → unpublished → publish with note → version 1 in store and history → reset', async ({ page }) => {
    await page.goto('/website/announcement');
    const text = page.getByLabel('Text', { exact: true });
    await text.fill('Eid prayer at 8:00 AM at all centers.');
    await expect(page.getByText('Unpublished changes')).toBeVisible();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('You changed: Announcement');
    await page.getByLabel(/What changed/).fill('Eid notice');
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.notice.ok')).toContainText('Published version 1');
    const doc = await store(page, 'site-config');
    expect(doc.version).toBe(1);
    expect(doc.data.announcement.text).toBe('Eid prayer at 8:00 AM at all centers.');
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('dialog')).toContainText('Eid notice');
    await page.getByRole('button', { name: 'Reset to built-in content…' }).click();
    await page.getByRole('button', { name: 'Yes, use built-in content' }).click();
    await expect(page.getByText('Website is using its built-in content')).toBeVisible();
  });

  test('draft survives a reload and can be discarded', async ({ page }) => {
    await page.goto('/settings/organization');
    await page.getByLabel('Site name').fill('ISGH Members Portal');
    await page.waitForTimeout(200);
    await page.reload();
    await expect(page.getByText('We restored changes you had not published yet.')).toBeVisible();
    await expect(page.getByLabel('Site name')).toHaveValue('ISGH Members Portal');
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page.getByLabel('Site name')).toHaveValue('ISGH Members');
  });

  test('conflict: someone else published meanwhile → clear message and “Publish mine anyway”', async ({ page }) => {
    await page.goto('/settings/organization');
    await page.getByLabel('Site name').fill('Mine');
    await page.evaluate(async () => {
      const cur = await (await fetch('/api/store/site-config')).json();
      await fetch('/api/store/site-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { ...cur.data, org: { ...cur.data.org, productName: 'Theirs' } }, baseVersion: 0 }) });
    });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText(/Someone published a newer version \(v1\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Publish mine anyway' }).click();
    await expect(page.locator('.notice.ok')).toBeVisible();
    expect((await store(page, 'site-config')).data.org.productName).toBe('Mine');
  });
});

test.describe('website controls', () => {
  test('home: hide, reorder and switch layout; published sections reach the store', async ({ page }) => {
    await page.goto('/website/home');
    await page.getByRole('radio', { name: /Classic/ }).click();
    await page.locator('.sec-order li', { hasText: 'Heart line' }).getByRole('button', { name: 'Hide' }).click();
    await page.getByRole('button', { name: 'Move Plan cards up' }).click();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.notice.ok')).toBeVisible();
    const d = (await store(page, 'home')).data;
    expect(d.layout).toBe('classic');
    expect(d.sections).not.toContain('heart');
    expect(d.sections.indexOf('plans')).toBeLessThan(d.sections.indexOf('steps'));
  });

  test('theme colors: bad hex blocks publishing; low contrast is refused by the server', async ({ page }) => {
    await page.goto('/website/theme');
    await page.getByLabel('Primary', { exact: true }).fill('#12');
    await expect(page.getByRole('alert')).toContainText('Use a 6-digit color');
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    await page.getByLabel('Primary', { exact: true }).fill('#0E5A45');
    await page.getByLabel('Background', { exact: true }).fill('#111111');
    await expect(page.locator('.contrast li.bad').first()).toBeVisible();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Some colors are too hard to read.')).toBeVisible();
  });

  test('theme preview: unsaved colors are pushed into the website frame', async ({ page }) => {
    await page.goto('/website/theme');
    await page.getByLabel('Highlight', { exact: true }).fill('#C0392B');
    const frame = page.frameLocator('iframe[title="Website preview"]');
    await expect(frame.locator('#site-header')).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => page.frames().find((f) => f.url().includes('4321'))?.evaluate(() => document.getElementById('isgh-theme-preview')?.textContent?.includes('#C0392B')), { timeout: 8000 }).toBe(true);
  });

  test('pages: create a new page, add a block, publish', async ({ page }) => {
    await page.goto('/website/pages');
    await page.getByRole('button', { name: '+ New page' }).click();
    await page.getByLabel('Web address').fill('youth-programs');
    await page.getByRole('button', { name: 'Create page' }).click();
    await expect(page.getByRole('heading', { name: 'Youth programs' })).toBeVisible();
    await page.getByRole('button', { name: /\+ Add block/ }).click();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.notice.ok')).toBeVisible();
    const d = (await store(page, 'pages')).data;
    expect(d['youth-programs'].status).toBe('draft');
    expect(d['youth-programs'].blocks.length).toBe(2);
  });

  test('giving: money shown in dollars, saved in cents; sample warning', async ({ page }) => {
    await page.goto('/website/giving');
    await page.getByRole('tab', { name: /Who still needs help/ }).click();
    await expect(page.getByText(/sample cases.*turn off/)).toBeVisible();
    const item = page.locator('.sf-group', { has: page.getByRole('button', { name: 'Two months of rent for a single mother', exact: true }) }).last();
    await item.getByRole('button', { name: 'Two months of rent for a single mother', exact: true }).click();
    const goal = item.getByLabel('Goal');
    await expect(goal).toHaveValue('2400.00');
    await goal.fill('2500');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.notice.ok')).toBeVisible();
    expect((await store(page, 'giving')).data.needs.find((n: { id: string }) => n.id === 'n-rent-sw').goalCents).toBe(250000);
  });

  test('feature switches: turn off the newsletter', async ({ page }) => {
    await page.goto('/settings/flags');
    await page.getByRole('switch', { name: 'Newsletter sign-up' }).uncheck();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.notice.ok')).toBeVisible();
    expect((await store(page, 'site-config')).data.flags['cms.newsletter']).toBe(false);
  });
});

test.describe('store API (white-box)', () => {
  test('rejects unknown keys, invalid data and cross-site writes', async ({ page }) => {
    await page.goto('/');
    const r = await page.evaluate(async () => {
      const unknown = (await fetch('/api/store/passwords')).status;
      const invalid = await fetch('/api/store/news', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [{ slug: 1 }] }) });
      return { unknown, invalid: invalid.status, body: await invalid.json() };
    });
    expect(r.unknown).toBe(404);
    expect(r.invalid).toBe(400);
    expect(r.body.issues.length).toBeGreaterThan(0);
    const cross = await page.request.put('/api/store/news', { data: { data: [] }, headers: { origin: 'https://evil.example' } });
    expect(cross.status()).toBe(403);
  });
});
