/** Admin family trees – black-box (DEMO). Staff see the membership family only. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/families'); await page.evaluate(() => localStorage.clear()); await page.reload(); });

test('family trees page: default family, statuses, history stays private', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Family trees' })).toBeVisible();
  await expect(page.locator('.fam-who')).toContainText('Aisha Rahman');
  await expect(page.locator('.ft-card', { hasText: 'Sumayya Rahman' })).toContainText('Turns 18 on 03/14/2027');
  await expect(page.locator('.ft-card', { hasText: 'Tariq Khan' })).toContainText('Father');
  await expect(page.locator('.ft-card', { hasText: 'Abdul Latif Khan' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /Whole family/ })).toHaveCount(0);
  await expect(page.locator('.fam-privacy')).toContainText('private to the member');
});

test('search a member and open their family; outreach list works; address keeps the member', async ({ page }) => {
  await page.getByPlaceholder('Find a member by name or ID').fill('Safiya');
  await page.locator('.fam-hits').first().locator('button').first().click();
  const name = (await page.locator('.fam-who b').textContent())!;
  expect(name).toContain('Safiya');
  await expect(page.locator('.ft-card.is-root')).toContainText(name);
  await expect(page).toHaveURL(/member=HOU-/);
  await page.reload();
  await expect(page.locator('.fam-who b')).toHaveText(name);
  const first = page.locator('.fam-find > .fam-hits').last().locator('button').first();
  const who = (await first.locator('b').textContent())!;
  await first.click();
  await expect(page.locator('.fam-who b')).toHaveText(who);
});

test('invite a relative who can join → logged in the member audit', async ({ page }) => {
  await page.locator('.ft-card', { hasText: 'Sara Khan' }).click();
  await page.getByRole('button', { name: 'Send invitation to join' }).click();
  await expect(page.locator('.fam-admin-side .notice')).toContainText('Logged');
  await page.getByRole('link', { name: 'Open Member 360°' }).click();
  await page.getByRole('tab', { name: 'Audit log' }).click();
  await expect(page.locator('.m-audit')).toContainText('Invitation to join sent for Sara Khan');
});

test('Member 360° has a Family tree tab for every member (no crash), spouse links to their record', async ({ page }) => {
  await page.goto('/members');
  for (const i of [0, 3, 4, 9]) {
    await page.goto('/members'); await page.locator('.m-who').nth(i).click();
    await page.getByRole('tab', { name: 'Family tree' }).click();
    await expect(page.locator('.ft-card.is-root')).toBeVisible();
  }
  // a member with a linked spouse
  await page.goto('/members');
  await page.getByPlaceholder(/Name, email, phone/).fill('aisha@example.com');
  await page.locator('.m-who').first().click();
  await page.getByRole('tab', { name: 'Household' }).click();
  await page.getByRole('tab', { name: 'Family tree' }).click();
  await expect(page.locator('.ft-card', { hasText: 'Omar Rahman' })).toContainText('Husband');
});

test('list view and zoom controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.ft-zoom span')).toHaveText(/9\d%|1\d\d%/);
  await page.getByRole('radio', { name: 'List' }).click();
  await expect(page.locator('section[aria-label="Children"]')).toContainText('Sumayya Rahman');
});
