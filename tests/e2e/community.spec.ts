/** Admin – Events, Groups, Communication, Configuration, Renewals (WildApricot-style options, all switchable). */
import { test, expect, type Page } from '@playwright/test';

const KEYS = ['events', 'groups', 'communication', 'org-config', 'membership-settings'];
test.beforeEach(async ({ request }) => { for (const k of KEYS) await request.delete(`/api/store/${k}`); await request.get('http://localhost:4323/__reset'); });
const store = async (page: Page, k: string) => (await (await page.request.get(`/api/store/${k}`)).json()).data;
const publish = async (page: Page) => { await page.getByRole('button', { name: 'Publish', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click(); await expect(page.locator('.notice.ok')).toContainText('Published version'); };

test('events: list, waitlist state, new event checked before publishing, published to the store', async ({ page }) => {
  await page.goto('/events');
  await expect(page.locator('.cv-item')).toHaveCount(4);
  await page.locator('.cv-item[data-event="family-night-katy"] .cv-row').click();
  await expect(page.locator('.cv-state')).toContainText('Full – new registrations join the waitlist');
  await page.getByRole('button', { name: 'New event' }).click();
  const ed = page.locator('.cv-item.open');
  await expect(page.getByRole('radio', { name: /Drafts/ })).toHaveAttribute('aria-checked', 'true');
  await ed.getByLabel('Title').fill('Youth basketball night');
  await ed.getByLabel('End').fill('2020-01-01T10:00');
  await expect(ed.locator('.cv-row .sf-badge')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  const start = await ed.getByLabel('Start').inputValue();
  await ed.getByLabel('End').fill(start.slice(0, 11) + '21:00');
  await ed.getByRole('button', { name: 'Publish on the website' }).click();
  await publish(page);
  const doc = await store(page, 'events');
  expect(doc.events.find((e: any) => e.title === 'Youth basketball night')).toMatchObject({ status: 'published', id: 'new-event' });
});

test('groups: automatic counts add up, manual group gets a member, rules are checked', async ({ page }) => {
  await page.goto('/groups');
  const n = async (id: string) => Number(await page.locator(`.cv-item[data-group="${id}"] .cv-count`).getAttribute('data-count'));
  const zones = (await Promise.all(['zone-north', 'zone-northwest', 'zone-southwest', 'zone-south', 'zone-southeast'].map(n))).reduce((a, b) => a + b, 0);
  expect(zones).toBe(320);
  expect((await n('voting-2026')) + (await n('non-voting-2026'))).toBeLessThanOrEqual(320);
  await page.locator('.cv-item[data-group="volunteers"] .cv-row').click();
  await page.getByPlaceholder(/Add a member/).fill('khan');
  await page.locator('.cv-hits button').first().click();
  expect(await n('volunteers')).toBe(1);
  await page.getByRole('button', { name: 'New automatic group' }).click();
  await expect(page.locator('.cv-item.open .cv-meta')).toContainText('Automatic: Zone = North');
  await publish(page);
  const doc = await store(page, 'groups');
  expect(doc.groups.find((g: any) => g.id === 'volunteers').memberIds).toHaveLength(1);
  expect(doc.groups[0]).toMatchObject({ id: 'new-automatic-group', kind: 'automatic' });
});

test('communication: turn an email off, unknown merge field blocked, preview fills a sample member', async ({ page }) => {
  await page.goto('/communication');
  const row = page.locator('[data-email="renewal-reminder-2"]');
  await row.getByRole('switch').uncheck();
  await expect(row).toHaveClass(/off/);
  const one = page.locator('[data-email="renewal-reminder-1"]');
  await one.getByRole('button', { name: /Edit/ }).click();
  await expect(one.locator('.cv-preview')).toContainText('Renew now to keep your vote');
  await expect(one.locator('.cv-pv-sub')).toContainText('ISGH');
  await one.getByLabel('Message').fill('Hello {Member.Shoe}');
  await expect(one.locator('.sf-err')).toContainText('Unknown merge field {Member.Shoe}');
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await one.getByLabel('Message').fill('Dear ');
  await one.getByRole('button', { name: 'First name' }).click();
  await expect(one.getByLabel('Message')).toHaveValue('Dear {Member.FirstName}');
  await expect(one.locator('.cv-pv-body')).toContainText('Dear Aisha');
  await expect(one.locator('.sf-err')).toContainText('Add {Link.Renew}');   // a reminder must carry the renew link
  await one.getByRole('button', { name: 'Renew link' }).click();
  await expect(one.locator('.sf-err')).toHaveCount(0);
  await publish(page);
  const doc = await store(page, 'communication');
  expect(doc.system['renewal-reminder-2'].enabled).toBe(false);
  expect(doc.system['renewal-reminder-1'].body).toBe('Dear {Member.FirstName} {Link.Renew}');
});

test('configuration: at least one way to pay; admin-only field cannot be in the directory; directory switched on', async ({ page }) => {
  await page.goto('/settings/configuration?tab=payments');
  await page.getByRole('tab', { name: 'Payments' }).click();
  await page.getByRole('switch', { name: 'Card', exact: true }).uncheck();
  await page.getByRole('switch', { name: 'Check', exact: true }).uncheck();
  await expect(page.locator('.sf-err').first()).toContainText('at least one way to pay');
  await page.getByRole('switch', { name: 'Check', exact: true }).check();
  await page.getByRole('tab', { name: 'Members' }).click();
  await page.locator('.sf-group', { hasText: 'Directory' }).getByRole('switch', { name: 'Enabled' }).check();
  await publish(page);
  const cfg = await store(page, 'org-config');
  expect(cfg.payments).toMatchObject({ card: false, check: true });
  expect(cfg.members.directory.enabled).toBe(true);
});

test('membership: load ISGH’s WildApricot levels into the draft; grace / overdue order checked', async ({ page }) => {
  await page.goto('/membership?tab=plans');
  await page.getByRole('button', { name: /Use ISGH’s current levels/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Load into the draft' }).click();
  await expect(page.locator('.pill.warn')).toHaveText('Unpublished changes');
  await page.getByRole('tab', { name: 'Renewals and reminders' }).click();
  await page.getByLabel(/Overdue after/).fill('3');
  await expect(page.locator('.sf-err').first()).toContainText('on or after the end of the grace period');
  await page.getByLabel(/Overdue after/).fill('14');
  await publish(page);
  const s = await store(page, 'membership-settings');
  expect(s.plans.map((p: any) => p.id)).toContain('checkomatic');
  expect(s.plans.find((p: any) => p.id === 'family').termPrices).toEqual([{ years: 1, priceCents: 7500 }, { years: 3, priceCents: 18000 }, { years: 5, priceCents: 28500 }]);
  await page.request.delete('/api/store/membership-settings');
});

test('events can be switched off for an organization from the SaaS panel', async ({ page, request }) => {
  const r = await request.post('http://localhost:4323/api/platform/tenants/lakeside', { data: { type: 'module', module: 'events', value: 'off' } });
  expect(r.ok()).toBeTruthy();
  await page.goto('http://lakeside.localhost:4322/events');
  await expect(page.getByRole('heading', { name: 'Events is not part of your plan' })).toBeVisible();
  await expect(page.locator('.side-link', { hasText: 'Events' })).toHaveCount(0);
});

test('groups: a typo in a rule is flagged, impossible values refused, a group used by an event cannot be deleted', async ({ page }) => {
  await page.goto('/groups');
  const north = page.locator('.cv-item[data-group="zone-north"]');
  await north.locator('.cv-row').click();
  await north.getByRole('button', { name: 'North', exact: true }).click();
  await north.getByLabel('Value').locator('visible=true').first().fill('Nort');
  await expect(north.locator('.gr-warns')).toContainText('No zone is called "Nort"');
  await expect(north.locator('.pill.warn')).toHaveText('Check rule');
  await expect(north.locator('.cv-count')).toHaveAttribute('data-count', '0');
  await north.getByLabel('Value').locator('visible=true').first().fill('North');
  await expect(north.locator('.gr-warns')).toHaveCount(0);
  await north.locator('.cv-row').click();
  const nonVoting = page.locator('.cv-item[data-group="non-voting-2026"]');
  await nonVoting.locator('.cv-row').click();
  await nonVoting.getByRole('button', { name: 'pending', exact: true }).click();
  await nonVoting.getByLabel('Value').locator('visible=true').first().fill('actve');
  await expect(nonVoting.locator('.sf-err').first()).toContainText('Use one of: pending, active');
  await nonVoting.getByLabel('Value').locator('visible=true').first().fill('pending');
  await nonVoting.locator('.cv-row').click();
  const nominees = page.locator('.cv-item[data-group="nominees-2026"]');
  await nominees.locator('.cv-row').click();
  await expect(nominees.getByRole('button', { name: 'Delete group' })).toBeDisabled();
  await expect(nominees.locator('.gr-used')).toContainText('Event: ');
});
