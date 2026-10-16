/** Documents published before newer fields existed must still open (defaults filled on load). */
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const STORE = process.env.ISGH_DEMO_STORE || path.resolve(__dirname, '../../../demo-store');
const writeOld = (key: string, data: unknown) =>
  writeFileSync(path.join(STORE, `${key}.json`), JSON.stringify({ data, version: 1, publishedAt: '2026-10-01T15:00:00.000Z', by: 'Older admin' }));

test.afterEach(async ({ request }) => {
  for (const k of ['groups', 'events', 'org-config']) await request.delete(`/api/store/${k}`);
});

test('groups saved before match/include/exclude existed still open', async ({ page, request }) => {
  const cur = await (await request.get('/api/store/groups')).json();
  const old = { ...cur.data, groups: cur.data.groups.map(({ match, include, exclude, ...g }: Record<string, unknown>) => g) };
  writeOld('groups', old);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  const j = await (await request.get('/api/store/groups')).json();
  expect(j.source).toBe('published');
  expect(j.data.groups[0].include).toEqual([]); expect(j.data.groups[0].match).toBe('all');
  await page.goto('/groups');
  await expect(page.getByRole('button', { name: /^North zone/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('events and configuration saved in an older format still open', async ({ page, request }) => {
  const ev = await (await request.get('/api/store/events')).json();
  writeOld('events', { ...ev.data, events: ev.data.events.map(({ typeCounts, ...e }: Record<string, unknown>) => e) });
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/events');
  await expect(page.locator('main')).toBeVisible();
  const oc = await (await request.get('/api/store/org-config')).json();
  const { achPercent, achCapCents, ...cover } = oc.data.coverFees ?? {};
  const { payLaterDays, ...rest } = oc.data;
  writeOld('org-config', { ...rest, coverFees: cover });
  await page.goto('/settings/configuration');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByText(/NaN/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
