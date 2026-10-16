/** Admin – member records (review step 2): extra profile fields, duplicates, archive, import, safe export. */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => { await request.delete('/api/store/org-config'); await page.goto('/members'); await page.evaluate(() => localStorage.clear()); });

test('extra profile fields: shown with who can see them, edited with checks, audit hides admin-only values', async ({ page }) => {
  await page.goto('/members/HOU-200000');
  await expect(page.locator('.m-extra')).toContainText('Profession or skills');
  await expect(page.locator('.m-extra')).toContainText('Admins only');
  await page.getByRole('button', { name: 'Edit details' }).click();
  const dlg = page.getByRole('dialog', { name: 'Edit details' });
  await dlg.getByLabel('Profession or skills').fill('Pediatrician');
  await dlg.getByLabel('Texas driver license / ID number').fill('12345678');
  await dlg.getByRole('button', { name: 'Save details' }).click();
  await expect(page.locator('.m-extra')).toContainText('Pediatrician');
  await page.getByRole('tab', { name: 'Audit log' }).click();
  await expect(page.locator('.m360-main')).toContainText('Profession or skills: Pediatrician');
  await expect(page.locator('.m360-main')).toContainText('(admin-only, value not logged)');
  await expect(page.locator('.m360-main')).not.toContainText('12345678');
});

test('archive hides the record from lists and the vote; restore brings it back', async ({ page }) => {
  await page.goto('/members/HOU-200000');
  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByLabel(/Reason/).fill('Test record created by mistake');
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.m-archived')).toContainText('Test record created by mistake');
  await expect(page.locator('.m-checks li', { hasText: 'In good standing' })).toContainText('Archived');
  await page.goto('/members?q=HOU-200000');
  await expect(page.locator('.m-count')).toContainText('No members match');
  await page.goto('/members?view=archived');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.goto('/members/HOU-200000');
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.m-archived')).toHaveCount(0);
});

test('import: rows are checked first – errors, duplicates and ready rows; only ready rows are saved', async ({ page }) => {
  await page.goto('/members/HOU-200000');
  const email = (await page.locator('.m-defs a[href^="mailto:"]').first().textContent())!.trim();
  await page.goto('/members');
  await page.getByRole('button', { name: 'Import' }).click();
  const dlg = page.getByRole('dialog', { name: 'Import members' });
  await dlg.getByLabel(/paste the rows/).fill([
    'First name,Last name,E-mail,Mobile,Date of birth,ZIP,Plan,Profession or skills',
    'Amina,Yusuf,amina.yusuf@example.com,713-555-0101,04/12/1988,77036,Single,Teacher',
    'Same,Person,' + email + ',,,,,',
    'Bad,Row,not-an-email,12,02/30/1990,7703,Gold,',
    '=HYPERLINK("x"),Khan,formula@example.com,,,,,',
  ].join('\n'));
  await dlg.getByRole('button', { name: 'Check the file' }).click();
  await expect(dlg.locator('.imp-sum')).toContainText('2 ready');
  await expect(dlg.locator('.imp-sum')).toContainText('1 possible duplicate');
  await expect(dlg.locator('.imp-sum')).toContainText('1 with errors');
  const bad = dlg.locator('tr[data-line="4"]');
  await expect(bad).toContainText('not an email'); await expect(bad).toContainText('not a date'); await expect(bad).toContainText('not a ZIP'); await expect(bad).toContainText('no plan called');
  await expect(dlg.locator('tr[data-line="3"]')).toContainText('Same email');
  await dlg.getByRole('button', { name: 'Import 2 members' }).click();
  await expect(page.locator('.m-toast')).toContainText('Imported 2 members');
  await page.goto('/members?q=amina.yusuf');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.locator('tbody tr .m-who').click();
  await expect(page.locator('.m-extra')).toContainText('Teacher');
  await expect(page.locator('.st').first()).toHaveText('Pending approval');
});

test('import: a file without the needed columns is refused before anything else', async ({ page }) => {
  await page.getByRole('button', { name: 'Import' }).click();
  const dlg = page.getByRole('dialog', { name: 'Import members' });
  await dlg.getByLabel(/paste the rows/).fill('Name,Phone\nAmina Yusuf,7135550101');
  await dlg.getByRole('button', { name: 'Check the file' }).click();
  await expect(dlg.getByRole('alert')).toContainText('First name, Last name, Email');
  await expect(dlg.getByRole('button', { name: /^Import \d/ })).toBeDisabled();
});

test('export: formulas are neutralized and admin-only fields need an extra tick', async ({ page }) => {
  await page.goto('/members/HOU-200000');
  await page.getByRole('button', { name: 'Edit details' }).click();
  await page.getByRole('dialog').getByLabel('Profession or skills').fill('=1+2');
  await page.getByRole('dialog').getByLabel('Texas driver license / ID number').fill('99887766');
  await page.getByRole('dialog').getByRole('button', { name: 'Save details' }).click();
  await page.goto('/members?q=HOU-200000');
  const grab = async (tick: boolean) => {
    await page.getByRole('button', { name: 'Export this view' }).click();
    if (tick) await page.getByRole('dialog').getByLabel(/admin-only fields/).check();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
    return (await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  };
  const plain = await grab(false);
  expect(plain).toContain("'=1+2");
  expect(plain).not.toContain('99887766');
  expect(plain).not.toContain('Texas driver license');
  const full = await grab(true);
  expect(full).toContain('99887766');
});

test('possible duplicate is flagged on the member page and can be marked as different people', async ({ page }) => {
  await page.goto('/members/HOU-200000');
  const phone = (await page.locator('.m-defs a[href^="tel:"]').first().textContent())!.trim();
  await page.goto('/members');
  await page.getByRole('button', { name: 'Import' }).click();
  const dlg = page.getByRole('dialog', { name: 'Import members' });
  await dlg.getByLabel(/paste the rows/).fill(`First name,Last name,Email,Phone\nZed,Other,zed.other@example.com,${phone}`);
  await dlg.getByRole('button', { name: 'Check the file' }).click();
  await dlg.getByLabel(/Import the possible duplicates too/).check();
  await dlg.getByRole('button', { name: 'Import 1 member' }).click();
  await page.goto('/members?q=zed.other');
  await page.locator('tbody tr .m-who').click();
  await expect(page.locator('.m-dups')).toContainText('Same phone');
  await page.locator('.m-dups').getByRole('button', { name: 'Not the same person' }).first().click();
  await expect(page.locator('.m-dups')).toHaveCount(0);
});
