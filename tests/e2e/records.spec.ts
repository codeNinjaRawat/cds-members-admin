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
  await page.getByRole('button', { name: 'More actions' }).click(); await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByLabel(/Reason/).fill('Test record created by mistake');
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.m-archived')).toContainText('Test record created by mistake');
  await expect(page.locator('.m-checks li', { hasText: 'In good standing' })).toContainText('Archived');
  await page.goto('/members?q=HOU-200000');
  await expect(page.locator('.m-count')).toContainText('No members match');
  await page.goto('/members?view=archived');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.goto('/members/HOU-200000');
  await page.getByRole('button', { name: 'More actions' }).click(); await page.getByRole('button', { name: 'Restore' }).click();
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
  await dlg.getByRole('button', { name: 'Next: match the columns' }).click();
  await expect(dlg.locator('tr[data-col="E-mail"] select')).toHaveValue('email');            // matched by heading
  await expect(dlg.locator('tr[data-col="Profession or skills"] select')).toHaveValue('field:profession');
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
  await page.locator('tbody tr .m-who').click(); await page.getByRole('link', { name: 'Open full profile' }).click();
  await expect(page.locator('.m-extra')).toContainText('Teacher');
  await expect(page.locator('.st').first()).toHaveText('Pending approval');
});

test('import: a file without the needed columns is refused before anything else', async ({ page }) => {
  await page.getByRole('button', { name: 'Import' }).click();
  const dlg = page.getByRole('dialog', { name: 'Import members' });
  await dlg.getByLabel(/paste the rows/).fill('Name,Phone\nAmina Yusuf,7135550101');
  await dlg.getByRole('button', { name: 'Next: match the columns' }).click();
  await expect(dlg.getByRole('alert')).toContainText('Still needed: First name, Last name, Email');
  await expect(dlg.getByRole('button', { name: 'Check the file' })).toBeDisabled();
  // matching a column by hand clears that need; the same column cannot feed two fields
  await dlg.locator('tr[data-col="Name"] select').selectOption('first');
  await expect(dlg.getByRole('alert')).toContainText('Still needed: Last name, Email');
  await dlg.locator('tr[data-col="Phone"] select').selectOption('first');
  await expect(dlg.getByRole('alert').last()).toContainText('Matched twice: First name');
});

test('M1 import: a Wild Apricot export – preset matches the columns, statuses become ours, consents and the old ID are kept', async ({ page }) => {
  await page.getByRole('button', { name: 'Import' }).click();
  const dlg = page.getByRole('dialog', { name: 'Import members' });
  await dlg.getByLabel(/paste the rows/).fill([
    'User ID,First name,Last name,Phone,Email,Company,Follow up,Entered by,Payment processed,Membership level,Membership status,Member since,Renewal due,Text/SMS consent,Subscribed to emails,Archived',
    '10234,Example,Activeperson,713-555-0199,example.active@example.com,,Call about family plan,Staff,Yes,Family,Active,03/01/2019,12/31/2026,Yes,Yes,No',
    '10235,Example,Lapsedperson,,example.lapsed@example.com,,,,,Single,Lapsed,06/15/2021,12/31/2025,No,No,No',
    '10236,Example,Newperson,,example.new@example.com,,,,,Single,Pending - New,10/10/2026,,Yes,Yes,No',
    '10237,Example,Oldperson,,example.old@example.com,,,,,Single,Active,01/01/2010,,,,Yes',
    '10238,Example,Odd,,example.odd@example.com,,,,,Single,Frozen,,,,,',
  ].join('\n'));
  await dlg.getByRole('button', { name: 'Next: match the columns' }).click();
  await dlg.getByLabel('Import preset').selectOption('wildapricot');
  await expect(dlg.locator('tr[data-col="User ID"] select')).toHaveValue('externalId');
  await expect(dlg.locator('tr[data-col="Membership status"] select')).toHaveValue('status');
  await expect(dlg.locator('tr[data-col="Entered by"] select')).toHaveValue('');
  await expect(dlg.locator('tr[data-col="Follow up"] select')).toHaveValue('notes');
  await dlg.getByRole('button', { name: 'Check the file' }).click();
  await expect(dlg.locator('.imp-sum')).toContainText('4 ready');
  await expect(dlg.locator('.imp-sum')).toContainText('1 with errors');
  await expect(dlg.locator('tr[data-line="6"]')).toContainText('Status “Frozen” is not one we know');
  await expect(dlg.locator('.imp-sum')).toContainText('1 lapsed');
  await expect(dlg.locator('.imp-sum')).toContainText('1 archived');
  await dlg.getByRole('button', { name: 'Import 4 members' }).click();
  await expect(page.locator('.m-toast')).toContainText('Imported 4 members');
  await page.goto('/members?q=example.active');
  await page.locator('.m-who').first().click(); await page.getByRole('link', { name: 'Open full profile' }).click();
  await expect(page.locator('.st').first()).toHaveText('Active');
  await expect(page.getByText('Family plan · member since 2019')).toBeVisible();
  await page.getByRole('tab', { name: /Notes/ }).click();
  await expect(page.locator('section[aria-label="Notes"]')).toContainText('ID in the old system: 10234');
  await expect(page.locator('section[aria-label="Notes"]')).toContainText('Call about family plan');
  await page.goto('/members?q=example.lapsed');
  await page.locator('.m-who').first().click(); await page.getByRole('link', { name: 'Open full profile' }).click();
  await expect(page.locator('.st').first()).toHaveText('Not renewed');
  await page.goto('/members?q=example.new');
  await page.locator('.m-who').first().click(); await page.getByRole('link', { name: 'Open full profile' }).click();
  await expect(page.locator('.st').first()).toHaveText('Pending approval');
  await page.goto('/members?q=example.old');
  await expect(page.locator('tbody tr')).toHaveCount(0);                      // archived rows stay out of the lists
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
  await dlg.getByRole('button', { name: 'Next: match the columns' }).click();
  await dlg.getByRole('button', { name: 'Check the file' }).click();
  await dlg.getByLabel(/Import the possible duplicates too/).check();
  await dlg.getByRole('button', { name: 'Import 1 member' }).click();
  await page.goto('/members?q=zed.other');
  await page.locator('tbody tr .m-who').click(); await page.getByRole('link', { name: 'Open full profile' }).click();
  await expect(page.locator('.m-dups')).toContainText('Same phone');
  await page.locator('.m-dups').getByRole('button', { name: 'Not the same person' }).first().click();
  await expect(page.locator('.m-dups')).toHaveCount(0);
});
