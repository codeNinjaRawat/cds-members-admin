/** A4 Work queues – black-box journeys (DEMO data, no API). */
import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/queues'); await page.evaluate(() => localStorage.clear()); await page.reload(); });
const tabCount = async (page: Page, name: RegExp) => Number(await page.getByRole('tab', { name }).locator('b').textContent());
const sideCount = (page: Page, label: string) => page.locator('.sub-link', { hasText: label }).locator('.side-badge');

test('five queues with counts; sidebar badges match; tab lives in the address', async ({ page }) => {
  for (const [name, side] of [[/Applications/, 'Applications'], [/Photo ID checks/, 'Photo ID checks'], [/Center changes/, 'Center changes'], [/Possible duplicates/, 'Possible duplicates'], [/Payments to fix/, 'Payments to fix']] as const) {
    const n = await tabCount(page, name);
    expect(n).toBeGreaterThan(0);
    await expect(sideCount(page, side)).toHaveText(String(n));
  }
  await page.getByRole('tab', { name: /Payments to fix/ }).click();
  await expect(page).toHaveURL(/tab=payments/);
  await expect(page.locator('.sub-link.active')).toHaveText(/Payments to fix/);
  await page.locator('.sub-link', { hasText: 'Possible duplicates' }).click();
  await expect(page.getByRole('tab', { name: /Possible duplicates/ })).toHaveAttribute('aria-selected', 'true');
});

test('oldest first, overdue chips, keyboard J/K moves through cases', async ({ page }) => {
  const ages = await page.locator('.wq-item .wq-age').allTextContents();
  const days = ages.map((a) => (a === 'Today' ? 0 : parseInt(a, 10)));
  expect([...days].sort((a, b) => b - a)).toEqual(days);
  await expect(page.locator('.wq-item.on')).toHaveCount(1);
  const first = await page.locator('.wq-item.on b').textContent();
  await page.locator('.wq-item').first().focus();
  await page.keyboard.press('j');
  await expect(page.locator('.wq-item.on b')).not.toHaveText(first!);
  await page.keyboard.press('k');
  await expect(page.locator('.wq-item.on b')).toHaveText(first!);
});

test('photo ID → verified unblocks the application → ready → Board approval → member approved; undo works', async ({ page }) => {
  // the application is blocked until the photo ID is checked
  const name = (await page.locator('.wq-item.on b').textContent())!;
  await expect(page.getByRole('button', { name: 'Ready for the Board' })).toBeDisabled();
  await page.getByRole('tab', { name: /Photo ID checks/ }).click();
  await page.locator('.wq-item', { hasText: name }).click();
  const good = page.getByRole('button', { name: 'Photo ID is good' });
  test.skip(await good.isDisabled(), 'this demo ID has a failed check');
  const before = await tabCount(page, /Photo ID checks/);
  await good.click();
  await expect(page.locator('.wq-undo')).toContainText('Verified');
  await expect.poll(() => tabCount(page, /Photo ID checks/)).toBe(before - 1);
  // undo puts it back
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => tabCount(page, /Photo ID checks/)).toBe(before);
  await page.locator('.wq-item', { hasText: name }).click();
  await page.getByRole('button', { name: 'Photo ID is good' }).click();
  // back to applications
  await page.getByRole('tab', { name: /Applications/ }).click();
  await page.locator('.wq-item', { hasText: name }).click();
  await page.getByRole('button', { name: 'Ready for the Board' }).click();
  await expect(page.locator('.wq-batch')).toContainText('1 ready for the Board');
  await page.getByRole('button', { name: 'Record Board approval' }).click();
  await page.getByRole('dialog').getByLabel('Board meeting or reference').fill('Board meeting, October 2026');
  await page.getByRole('dialog').getByRole('button', { name: 'Approve 1' }).click();
  await expect(page.locator('.wq-undo')).toContainText('1 application approved by the Board');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.locator('.wq-item', { hasText: name }).click();
  await expect(page.locator('.wq-detail .notice')).toContainText('Approved by the Board');
  // the member record shows it, with audit entries
  await page.locator('.wq-dhead h2 a').click();
  await expect(page.locator('.m-checks li', { hasText: 'Board' })).toHaveClass(/ok/);
  await page.getByRole('tab', { name: 'Audit log' }).click();
  await expect(page.locator('.m-audit')).toContainText('Approved');
  await expect(page.locator('.m-audit')).toContainText('Photo ID verified');
});

test('photo ID with an expired document cannot be approved; ask for a new photo needs a message', async ({ page }) => {
  await page.getByRole('tab', { name: /Photo ID checks/ }).click();
  const bad = page.locator('.wq-item');
  const n = await bad.count();
  let found = false;
  for (let i = 0; i < n && !found; i++) { await bad.nth(i).click(); found = (await page.locator('.m-checks li.bad', { hasText: 'expired' }).count()) > 0; }
  expect(found).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Photo ID is good' })).toBeDisabled();
  await page.getByRole('button', { name: 'Ask for a new photo' }).click();
  await expect(page.getByLabel('Message to the member')).toHaveValue(/clear photo/);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.wq-undo')).toContainText('Demo: the member would get this');
});

test('center change: over 5 miles is blocked by the Bylaws; within 5 miles approves and locks 5 years', async ({ page }) => {
  await page.getByRole('tab', { name: /Center changes/ }).click();
  await page.locator('.wq-item', { hasText: '6.3 mi' }).click();
  await expect(page.getByRole('button', { name: 'Approve change' })).toBeDisabled();
  await expect(page.locator('.wq-why')).toContainText('5 miles');
  await page.locator('.wq-item', { hasText: '1.4 mi' }).click();
  const to = (await page.locator('.wq-move .to span').textContent())!;
  await page.getByRole('button', { name: 'Approve change' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.locator('.wq-item').first().click();
  await page.locator('.wq-dhead h2 a').click();
  await expect(page.locator('.m-def', { hasText: 'Zone and center' })).toContainText(to);
  await expect(page.locator('.m-def', { hasText: 'Zone and center' })).toContainText('locked until 12/31/2031');
});

test('decline needs a reason; duplicates merge; payments: check received makes the member active', async ({ page }) => {
  await page.getByRole('tab', { name: /Possible duplicates/ }).click();
  const dupBefore = await tabCount(page, /Possible duplicates/);
  await page.getByRole('button', { name: 'Not the same person' }).click();
  await page.getByRole('button', { name: 'Not the same person' }).click(); // empty reason → blocked by the form
  await expect(page.locator('.wq-ask')).toBeVisible();
  await page.locator('.wq-ask textarea').fill('Different people – father and son');
  await page.getByRole('button', { name: 'Not the same person' }).click();
  await expect.poll(() => tabCount(page, /Possible duplicates/)).toBe(dupBefore - 1);
  await page.getByRole('button', { name: /Merge into/ }).click();
  await expect.poll(() => tabCount(page, /Possible duplicates/)).toBe(dupBefore - 2);

  await page.getByRole('tab', { name: /Payments to fix/ }).click();
  await page.locator('.wq-item', { hasText: 'check' }).first().click();
  const who = (await page.locator('.wq-dhead h2 a').textContent())!;
  await page.getByRole('button', { name: 'Check received' }).click();
  await page.goto('/members?view=not-renewed');
  await page.getByPlaceholder(/Name, email, phone/).fill(who);
  await expect(page.locator('.m-count')).toContainText('No members match');
});

test('assign to me and the "Assigned to me" filter', async ({ page }) => {
  await page.getByRole('button', { name: 'Assign to me' }).click();
  await expect(page.getByRole('button', { name: 'Assigned to me' }).last()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.chip-row').getByRole('button', { name: 'Assigned to me' }).click();
  await expect(page.locator('.wq-item')).toHaveCount(1);
});

test('phone width: list stacks over the case, no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('.wq-item').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
});
