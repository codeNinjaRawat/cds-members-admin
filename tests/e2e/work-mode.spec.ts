/** Work mode – the whole screen for the page: sidebar folds to icons, photo band and banners go, page width unlimited; Esc leaves it; a setting remembers page width. */
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1800, height: 1000 } });
test.beforeEach(async ({ page }) => { await page.goto('/members'); await page.evaluate(() => localStorage.clear()); await page.reload(); });

test('top-bar button and Ctrl+Shift+F toggle work mode; Esc leaves it; the choice is remembered', async ({ page }) => {
  await expect(page.locator('.sec-art')).toBeVisible();
  const before = await page.locator('.page').evaluate((el) => getComputedStyle(el).maxWidth);
  expect(before).toBe('1500px');
  await page.getByRole('button', { name: /Work mode/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-work', 'on');
  await expect(page.locator('html')).toHaveAttribute('data-nav', 'rail');
  await expect(page.locator('.sec-art')).toHaveCount(0);
  expect(await page.locator('.page').evaluate((el) => getComputedStyle(el).maxWidth)).toBe('none');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-work', 'on');                 // remembered
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-work', 'off');
  await expect(page.locator('.sec-art')).toBeVisible();
  await page.keyboard.press('Control+Shift+F');
  await expect(page.locator('html')).toHaveAttribute('data-work', 'on');
  // Esc inside a dialog closes the dialog, not work mode
  await page.getByRole('button', { name: 'Import' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-work', 'on');
});

test('My appearance: page width "Whole screen" without work mode keeps the sidebar and photo band', async ({ page }) => {
  await page.goto('/appearance');
  await page.getByRole('radio', { name: 'Whole screen' }).click();
  await page.goto('/members');
  await expect(page.locator('html')).toHaveAttribute('data-width', 'full');
  expect(await page.locator('.page').evaluate((el) => getComputedStyle(el).maxWidth)).toBe('none');
  await expect(page.locator('.sec-art')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-nav', 'full');
});
