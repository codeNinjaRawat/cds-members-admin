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
import { SIMPLE_WORK_PRESET } from '@/lib/community/work';
import { readTenants, tenantDir } from '@/lib/platform/platform-store';
import { seedFor } from '@/lib/platform/seed';
import { BUILT_IN_ROLES, type AccessDoc } from '@/lib/access/access';
import type { Tenant } from '@/lib/platform/platform';

/** A new organization's admins come from the platform invitations (owner / admin / editor / viewer). */
function accessFor(t: Tenant): AccessDoc {
  const map = { owner: 'owner', admin: 'admin', editor: 'website-editor', viewer: 'viewer' } as const;
  return { requireTwoStepFor: 'sensitive', roles: BUILT_IN_ROLES, admins: t.admins.filter((a) => a.status !== 'revoked').map((a) => ({ id: a.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40).padEnd(2, '-'), name: a.name, email: a.email.toLowerCase(), roleId: map[a.role], zones: [], centers: [], zips: [], more: [], memberId: '', givenBy: '', holderId: '', reviewedOn: '', homeZip: '', status: a.status === 'active' ? 'active' : 'invited', twoStep: a.role === 'owner' || a.role === 'admin' })) };
}

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
  if (k === 'admin-access') return t ? accessFor(t) : REGISTRY[k].initial;   // another org never gets ISGH's admins
  if (k === 'zakat-settings') return REGISTRY[k].initial;
  if (k === 'work-settings') return t ? SIMPLE_WORK_PRESET : REGISTRY[k].initial;   // another org starts simple: 3 categories, nobody pre-assigned
  if (k === 'donation-settings') return t ? { ...(REGISTRY[k].initial as object), mainCenter: '', platforms: { stripe: { enabled: false, lastSync: '' }, paypal: { enabled: false, lastSync: '' }, medina: { enabled: false, lastSync: '' }, bloomerang: { enabled: false, lastSync: '' } }, checkomatic: { mode: 'off', minCents: 4000, funds: ['general'], countsAsDues: false } } : REGISTRY[k].initial; // other organizations start with Check-o-matic off // the same safe defaults for every organization
  if (k === 'fundraising') return t ? { campaigns: [], pages: [], website: { enabled: false } } : REGISTRY[k].initial;
  if (k === 'elections') return t ? { ...(REGISTRY[k].initial as object), elections: [] } : REGISTRY[k].initial;
  if (k === 'records') return t ? { items: [], website: { enabled: false, title: 'Records', intro: '' } } : REGISTRY[k].initial;
  if (k === 'finance-settings') return t ? { ...(REGISTRY[k].initial as object), accounts: [], budgets: [], openingCents: {}, plan: { approvedOn: '' }, audit: { year: 2025, presentedOn: '' } } : REGISTRY[k].initial;
  if (k === 'prayer-times') return t ? { ...(REGISTRY[k].initial as object), centers: [], special: [], location: { label: t.city || 'Main', lat: 29.7604, lng: -95.3698 } } : REGISTRY[k].initial;
  if (k === 'officials') return t ? { ...(REGISTRY[k].initial as object), holders: [], website: { enabled: false, showEmail: true, findByZip: true } } : REGISTRY[k].initial;
  if (k === 'benefits') return t ? { ...(REGISTRY[k].initial as object), enabled: false, partners: [], offers: [] } : REGISTRY[k].initial;
  if (k === 'org-structure') return t ? { zones: [{ id: 'main', name: t.city || 'Main', areas: '', director: { name: '', email: '' }, termEnds: '', zips: [], active: true }], centers: [] } : REGISTRY[k].initial; // a new organization starts with one empty zone
  if (k === 'integrations') return t ? { ...(REGISTRY[k].initial as object), stripe: { ...(REGISTRY[k].initial as { stripe: object }).stripe, enabled: false, publishableKey: '', secretKey: undefined }, email: { ...(REGISTRY[k].initial as { email: object }).email, domain: (t.email.split('@')[1] || 'example.org'), fromTransactional: t.email, fromBulk: `news@news.${t.email.split('@')[1] || 'example.org'}` } } : REGISTRY[k].initial; // never ISGH's keys
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
  const parsed = stored ? REGISTRY[k].schema.safeParse(stored.data) : null;
  // Return the parsed copy so documents saved before a new field existed get its default.
  if (stored && parsed?.success) return { ...stored, data: parsed.data, source: 'published' as const };
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
