/**
 * DEMO STORE (server only). "Publish" writes `<key>.json` + keeps the last 20 versions in `<key>.history.json`.
 * The website (mock mode) reads the same folder. Replaced by BE admin endpoints in phase 3:
 *   PUT /admin/content/{key} (role-checked, audited, versioned) – same body/validation.
 */
import 'server-only';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkContrast, type ThemesFile } from '@/lib/theme/theme-css';
import { REGISTRY, type DocKey } from './registry';
import { readTenants, tenantDir } from '@/lib/platform/platform-store';
import { seedFor } from '@/lib/platform/seed';

export type Stored = { data: unknown; version: number; publishedAt: string; by: string; note?: string };
export type Version = Omit<Stored, 'data'> & { data?: unknown };

const MAX_HISTORY = 20;
export const storeEnabled = () => process.env.ISGH_DEMO_STORE !== 'off';
export const storeDir = () => path.resolve(process.cwd(), process.env.ISGH_DEMO_STORE || '../.demo-store');
/** SaaS: ISGH keeps the store folder itself; every other organization has <store>/tenants/<slug>/ */
const file = (k: DocKey, slug: string, suffix = '') => path.join(tenantDir(slug), `${k}${suffix}.json`);
/** The built-in content for this organization: ISGH's own, or starter content made from the organization's profile. */
const initialFor = (k: DocKey, slug: string) => {
  if (slug === 'isgh') return REGISTRY[k].initial;
  const t = readTenants().find((x) => x.slug === slug);
  return t ? seedFor(k, REGISTRY[k].initial, t) : REGISTRY[k].initial;
};

function readJson<T>(p: string): T | null {
  try { return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null; } catch { return null; }
}
function writeAtomic(p: string, value: unknown) {
  mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p); // readers never see a half-written file
}

export function getDoc(k: DocKey, slug = 'isgh') {
  const stored = readJson<Stored>(file(k, slug));
  if (stored && REGISTRY[k].schema.safeParse(stored.data).success) return { ...stored, source: 'published' as const };
  return { data: initialFor(k, slug), version: 0, publishedAt: null, by: null, source: 'default' as const };
}
export const getHistory = (k: DocKey, slug = 'isgh') => readJson<Stored[]>(file(k, slug, '.history')) ?? [];

export type PublishResult =
  | { ok: true; version: number; publishedAt: string }
  | { ok: false; status: 400 | 409; error: string; issues?: { path: string; message: string }[] };

export function publishDoc(k: DocKey, body: { data: unknown; baseVersion?: number; note?: string; by?: string }, slug = 'isgh'): PublishResult {
  const parsed = REGISTRY[k].schema.safeParse(body.data);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Some fields are not valid.', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
  }
  if (k === 'themes') {
    const problems = checkContrast(parsed.data as ThemesFile);
    if (problems.length) return { ok: false, status: 400, error: 'Some colors are too hard to read.', issues: problems.map((p) => ({ path: 'themes', message: p })) };
  }
  const current = getDoc(k, slug);
  if (typeof body.baseVersion === 'number' && body.baseVersion !== current.version) {
    return { ok: false, status: 409, error: `Someone published a newer version (v${current.version}) after you opened this page.` };
  }
  const next: Stored = { data: parsed.data, version: current.version + 1, publishedAt: new Date().toISOString(), by: body.by || 'Admin (demo)', note: body.note?.slice(0, 200) };
  writeAtomic(file(k, slug), next);
  writeAtomic(file(k, slug, '.history'), [next, ...getHistory(k, slug)].slice(0, MAX_HISTORY));
  return { ok: true, version: next.version, publishedAt: next.publishedAt };
}

/** Back to the website's built-in content (history is kept so it can be restored). */
export function resetDoc(k: DocKey, slug = 'isgh') {
  if (existsSync(file(k, slug))) rmSync(file(k, slug));
}
