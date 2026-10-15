/** Speed pass 2 – instant click feedback and light glass (owner: "actions getting slow / stuck"). */
import { test, expect } from '@playwright/test';

test('a click on another page shows the progress bar at once, even when the server is slow', async ({ page }) => {
  await page.goto('/');
  await page.route('**/members', async (r) => { await new Promise((x) => setTimeout(x, 900)); await r.continue(); });
  const shown = await page.evaluate(async () => {
    (document.querySelector('a[href="/members"]') as HTMLAnchorElement).click();
    await new Promise((r) => setTimeout(r, 60));
    const bar = document.querySelector('.nav-progress.is-run');
    return !!bar && bar.getBoundingClientRect().height > 0;
  }).catch(() => 'navigated before check');
  expect(shown).toBe(true);
  await expect(page).toHaveURL(/\/members$/);
});

test('same-page actions (tabs, views) never show the bar', async ({ page }) => {
  await page.goto('/members');
  await page.getByRole('tab', { name: /Not renewed/ }).click();
  await expect(page.locator('.nav-progress')).toHaveCount(0);
});

test('content panels do not use the expensive blur; the shell still does', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(() => {
    const bf = (el: Element | null) => (el ? getComputedStyle(el).backdropFilter : 'missing');
    return { pane: bf(document.querySelector('.glass-pane')), nav: bf(document.querySelector('.glass-nav')),
      blurred: [...document.querySelectorAll('*')].filter((e) => { const s = getComputedStyle(e).backdropFilter; return s && s !== 'none'; }).length };
  });
  expect(r.pane).toBe('none');
  expect(r.nav).toContain('blur');
  expect(r.blurred).toBeLessThanOrEqual(4);
});
