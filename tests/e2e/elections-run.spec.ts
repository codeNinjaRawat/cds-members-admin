/** Elections › Nominations, ballot and results – the whole journey: nominate (checked) → ballot → count (tie) → certify → swear in. */
import { test, expect, type Page } from '@playwright/test';
test.describe.configure({ mode: 'serial' });

const as = async (page: Page, id: string | null) => { await page.context().clearCookies(); if (id) await page.context().addCookies([{ name: 'isgh-acting', value: id, url: 'http://localhost:4322' }]); };
test.beforeEach(async ({ page, request }) => { for (const k of ['elections', 'officials']) await request.delete(`/api/store/${k}`); await as(page, null); await page.goto('/elections/run'); await page.evaluate(() => localStorage.clear()); await page.reload(); });

test('nominations are checked against the member record; a seat needs a candidate before the ballot is set', async ({ page }) => {
  await expect(page.locator('[data-status="nominations"]')).toHaveText('Nominations open');
  await expect(page.locator('.ex-warns')).toContainText('Zonal Director, North Zone: no accepted candidate');
  const sara = page.locator('[data-nomination="n-5"]');
  await expect(sara.locator('.ex-issues')).toHaveCount(0);
  await sara.getByRole('button', { name: /^Accept/ }).click();
  await expect(sara.locator('.pill')).toHaveText('Accepted');
  // a nomination with no member record cannot be accepted
  const lubna = page.locator('[data-nomination="n-4"]');
  await expect(lubna).toContainText('Link the member record');
  await expect(lubna.getByRole('button', { name: /^Accept/ })).toBeDisabled();
  // record a nomination for the empty seat: a member of another center is refused on residence
  await page.getByRole('button', { name: 'Record a nomination' }).click();
  const form = page.getByRole('form', { name: 'New nomination' });
  await form.getByLabel('Seat').selectOption('ad:Southeast Islamic Center 1');
  await form.getByLabel('Candidate member ID').fill('HOU-201334');
  await expect(form.getByRole('alert')).toContainText('Not a member of this center');
  await expect(form.getByRole('alert')).toContainText('Also nominated for President');
  await form.getByLabel('Candidate member ID').fill('HOU-200197');
  await expect(form.getByRole('alert')).toHaveCount(0);
  await form.getByLabel('Nominated by').fill('Omar Siddiqui');
  await form.getByLabel('Seconded by').fill('Faisal Haq');
  await form.getByRole('button', { name: 'Record nomination' }).click();
  const se = page.locator('[data-seat="ad:Southeast Islamic Center 1"]');
  await expect(se).toContainText('Hamza Ibrahim');
  await se.getByRole('button', { name: /^Accept/ }).click();
  await expect(page.locator('.ex-warns')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Ballot' }).click();
  await expect(page.locator('[data-ballot-seat="officer:president"]')).toContainText('Adnan Ansari, Huda Rahman');
  await expect(page.locator('[data-ballot-seat="zd:sw"]')).toContainText('uncontested');
  await page.getByRole('button', { name: /Freeze the voter list/ }).click();
  await expect(page.locator('[data-tile="ex-voters"], #ex-voters').first()).toBeVisible();
  await page.getByRole('button', { name: 'Set the ballot' }).click();
  await expect(page.locator('[data-status="ballot"]')).toHaveText('Ballot set');
});

test('count, tie-break, certify and swear in: the winners become the serving officials and the old holders go to the history', async ({ page }) => {
  // make the ballot complete quickly
  await page.locator('[data-nomination="n-5"]').getByRole('button', { name: /^Accept/ }).click();
  await page.getByRole('tab', { name: 'Ballot' }).click();
  await page.getByRole('button', { name: /Take off Associate Director, Southeast Islamic Center 1/ }).click();
  await page.getByRole('button', { name: /Freeze the voter list/ }).click();
  await page.getByRole('button', { name: 'Set the ballot' }).click();
  await page.getByRole('button', { name: 'Open voting' }).click();
  await page.getByRole('button', { name: 'Close voting – count' }).click();
  await page.getByRole('tab', { name: 'Results' }).click();
  const pres = page.locator('[data-count="officer:president"]');
  await pres.getByLabel('Ballots cast President').fill('150');
  await pres.getByLabel('Votes for Adnan Ansari').fill('80');
  await pres.getByLabel('Votes for Huda Rahman').fill('80');
  await expect(pres).toContainText('Tie for the last place');
  await pres.getByRole('button', { name: 'Tie-break: Huda Rahman' }).click();
  await expect(pres.locator('tr.ex-winner')).toContainText('Huda Rahman');
  await expect(pres.locator('.pill.good').first()).toHaveText('Counted');
  // votes beyond the ballots cast are refused by the document rules
  const gs = page.locator('[data-count="officer:general-secretary"]');
  await gs.getByLabel('Ballots cast General Secretary').fill('10');
  await gs.getByLabel('Votes for Rashid Aziz').fill('12');
  await expect(page.getByRole('tab', { name: /Results/ })).toContainText('1');
  await gs.getByLabel('Votes for Rashid Aziz').fill('9');
  await gs.getByRole('button', { name: /Accept the count/ }).click();
  for (const [seat, cand] of [['zd:n', 'Sara Aziz'], ['zd:sw', 'Ahmed Abdullah']]) {
    const c = page.locator(`[data-count="${seat}"]`);
    await c.getByLabel(/Ballots cast/).fill('40'); await c.getByLabel(`Votes for ${cand}`).fill('30'); await c.getByRole('button', { name: /Accept the count/ }).click();
  }
  const ar = page.locator('[data-count="ar:Southwest Islamic Center 1:77036"]');
  await ar.getByLabel(/Ballots cast/).fill('20'); await ar.getByLabel('Votes for Mustafa Abdullah').fill('15'); await ar.getByLabel('Votes for Zaid Ibrahim').fill('12');
  await expect(ar.locator('tr.ex-winner')).toHaveCount(2);                     // two places
  await ar.getByRole('button', { name: /Accept the count/ }).click();
  await expect(page.locator('.ex-warns')).toContainText('Every seat is counted – certify');
  await page.getByRole('tab', { name: 'Certify and swear in' }).click();
  await expect(page.locator('[data-winner-seat="officer:president"]')).toContainText('Huda Rahman');
  await page.getByRole('button', { name: 'Certify the results' }).click();
  await expect(page.locator('[data-status="certified"]')).toHaveText('Certified');
  await expect(page.locator('#ex-turnout, [data-tile="ex-turnout"]').first()).toBeVisible();
  await page.getByRole('button', { name: /Swear in 6 winners/ }).click();
  await expect(page.locator('.ex-certify').getByRole('status')).toContainText('6 officials sworn in');
  // Elected officials now holds the new President; the previous one is in the history (checked through the store – other specs reset screens in parallel)
  const o = (await (await page.request.get('/api/store/officials')).json()).data;
  const po = o.holders.filter((h: any) => h.kind === 'officer' && h.office === 'president');
  expect(po.find((h: any) => h.status === 'serving').name).toBe('Huda Rahman');
  expect(po.find((h: any) => h.name === 'Yusuf Karim').status).toBe('ended');
  expect(o.history.find((t: any) => t.name === 'Yusuf Karim' && t.year === 2024).notes).toContain('Succeeded after the 2026 election');
  await expect(page.locator('[data-status="closed"]')).toHaveText('Closed');
});

test('only the Election Commission (voters.freeze) may run the election; others read', async ({ page }) => {
  await as(page, 'treasurer');
  await page.goto('/elections/run');
  await expect(page.getByRole('heading', { name: 'Nominations, ballot and results', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record a nomination' })).toHaveCount(0);
  await expect(page.locator('[data-nomination="n-5"]').getByRole('button', { name: /^Accept/ })).toHaveCount(0);
  await as(page, 'ec-chair');
  await page.goto('/elections/run');
  await expect(page.getByRole('button', { name: 'Record a nomination' })).toBeVisible();
});
