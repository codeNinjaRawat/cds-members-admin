/**
 * PLATFORM DEMO STORE (server only) – shared by the SaaS panel, the org admin and the website.
 * Source: saas/src/lib/platform/platform-store.ts → copied to web/ and admin/ by `npm run platform:sync`.
 *
 *   <store>/_platform/tenants.json        organizations (falls back to the demo list)
 *   <store>/_platform/{plans,flags,announcements,settings}.json   platform documents { data, version, savedAt, by }
 *   <store>/_platform/support.json        support sign-ins · audit.json (newest first, last 500) · invoices.json (status changes)
 *   <store>/                              ISGH's own content (kept where it always was)
 *   <store>/tenants/<slug>/               every other organization's content (same files as ISGH's)
 * BE phase: replaced by the platform API + one database schema per region; the shapes stay the same.
 */
import 'server-only';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ZodTypeAny, z } from 'zod';
import {
  AnnouncementsDocSchema, FlagsDocSchema, TeamDocSchema, defaultTeam, PlansDocSchema, PlatformSettingsSchema, SupportSessionSchema, TenantSchema,
  defaultAnnouncements, defaultFlags, defaultPlans, defaultSettings, demoTenants, isoDay, resolveHost, FOUNDING_SLUG, nextClientNo,
  type AuditEntry, type Invoice, type SupportSession, type Tenant,
} from './platform';

export const storeRoot = () => path.resolve(process.cwd(), process.env.ISGH_DEMO_STORE || '../.demo-store');
const pfile = (name: string) => path.join(storeRoot(), '_platform', `${name}.json`);
/** Where an organization's website content lives. ISGH keeps the original folder. */
export const tenantDir = (slug: string) => (slug === 'isgh' ? storeRoot() : path.join(storeRoot(), 'tenants', slug));
/** "Today" for the demo (tests can pin it with PLATFORM_TODAY=2026-10-15). */
export const today = () => process.env.PLATFORM_TODAY || isoDay(new Date());

function readJson<T>(p: string): T | null {
  try { return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null; } catch { return null; }
}
export function writeAtomic(p: string, value: unknown) {
  mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p); // readers never see a half-written file
}

/* ---------- organizations ---------- */
export function readTenants(): Tenant[] {
  const raw = readJson<unknown[]>(pfile('tenants'));
  if (!Array.isArray(raw)) return demoTenants();
  const out: Tenant[] = [];
  for (const r of raw) { const p = TenantSchema.safeParse(r); if (p.success) out.push(p.data); else console.error('[platform] skipped an invalid organization record', p.error.issues[0]); }
  if (!out.length) return demoTenants();
  // ISGH is the founding client: it can never go missing from the platform (restored from the built-in record)
  if (!out.some((t) => t.slug === FOUNDING_SLUG)) out.unshift(demoTenants().find((t) => t.slug === FOUNDING_SLUG)!);
  // older files without customer numbers: ISGH = 1, the rest in joining order
  for (const t of out) if (t.slug === FOUNDING_SLUG) t.clientNo = 1;
  for (const t of [...out].sort((a, b) => a.createdOn.localeCompare(b.createdOn))) if (!t.clientNo) t.clientNo = nextClientNo(out);
  return out;
}
export const writeTenants = (list: Tenant[]) => writeAtomic(pfile('tenants'), list);
export const findTenant = (slug: string) => readTenants().find((t) => t.slug === slug) ?? null;

/* ---------- platform documents ---------- */
export const PLATFORM_DOCS = {
  plans: { schema: PlansDocSchema, initial: defaultPlans, label: 'SaaS plans' },
  flags: { schema: FlagsDocSchema, initial: defaultFlags, label: 'Feature rollouts' },
  announcements: { schema: AnnouncementsDocSchema, initial: defaultAnnouncements, label: 'Announcements' },
  settings: { schema: PlatformSettingsSchema, initial: defaultSettings, label: 'Platform settings' },
  team: { schema: TeamDocSchema, initial: defaultTeam, label: 'Platform team' },
} as const;
export type PlatformDocKey = keyof typeof PLATFORM_DOCS;
export const isPlatformDoc = (k: string): k is PlatformDocKey => k in PLATFORM_DOCS;
type DocValue<K extends PlatformDocKey> = z.infer<(typeof PLATFORM_DOCS)[K]['schema']>;
export type PlatformDoc<K extends PlatformDocKey> = { data: DocValue<K>; version: number; savedAt: string | null; by: string | null };

export function readPlatformDoc<K extends PlatformDocKey>(k: K): PlatformDoc<K> {
  const stored = readJson<{ data: unknown; version: number; savedAt: string; by: string }>(pfile(k));
  const schema = PLATFORM_DOCS[k].schema as ZodTypeAny;
  if (stored) { const p = schema.safeParse(stored.data); if (p.success) return { ...stored, data: p.data }; }
  return { data: PLATFORM_DOCS[k].initial as DocValue<K>, version: 0, savedAt: null, by: null };
}
export type SaveResult = { ok: true; version: number } | { ok: false; status: 400 | 409; error: string; issues?: { path: string; message: string }[] };
export function savePlatformDoc(k: PlatformDocKey, body: { data: unknown; baseVersion?: number }, by: string): SaveResult {
  const p = (PLATFORM_DOCS[k].schema as ZodTypeAny).safeParse(body.data);
  if (!p.success) return { ok: false, status: 400, error: 'Some fields are not valid.', issues: p.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
  const cur = readPlatformDoc(k);
  if (typeof body.baseVersion === 'number' && body.baseVersion !== cur.version) return { ok: false, status: 409, error: `Someone saved a newer version (v${cur.version}) after you opened this page.` };
  const next = { data: p.data, version: cur.version + 1, savedAt: new Date().toISOString(), by };
  writeAtomic(pfile(k), next);
  audit(by, 'settings.saved', k, `${PLATFORM_DOCS[k].label} saved (v${next.version})`);
  return { ok: true, version: next.version };
}

/* ---------- support sign-ins, audit, invoices ---------- */
export const readSupport = (): SupportSession[] => (readJson<unknown[]>(pfile('support')) ?? []).flatMap((r) => { const p = SupportSessionSchema.safeParse(r); return p.success ? [p.data] : []; });
export const writeSupport = (list: SupportSession[]) => writeAtomic(pfile('support'), list.slice(0, 200));
/** First line of the platform's history: ISGH joined as the founding client. */
export const FOUNDING_ENTRY: AuditEntry = { id: 'a-founding-isgh', at: '2026-09-01T15:00:00.000Z', by: 'Mohammad (demo)', action: 'org.created', target: FOUNDING_SLUG, detail: 'Islamic Society of Greater Houston joined as client #1 – the founding client of the platform (Network plan, yearly)' };
export const readAudit = (): AuditEntry[] => { const l = readJson<AuditEntry[]>(pfile('audit')) ?? []; return l.some((e) => e.id === FOUNDING_ENTRY.id) ? l : [...l, FOUNDING_ENTRY]; };
export function audit(by: string, action: string, target: string | undefined, detail: string) {
  const e: AuditEntry = { id: `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), by, action, target, detail };
  writeAtomic(pfile('audit'), [e, ...readAudit()].slice(0, 500));
  return e;
}
export const readInvoiceStatus = () => readJson<Record<string, Invoice['status']>>(pfile('invoices')) ?? {};
export const writeInvoiceStatus = (v: Record<string, Invoice['status']>) => writeAtomic(pfile('invoices'), v);

/* ---------- which organization is this request for? ---------- */
export type TenantLookup = { tenant: Tenant | null; slug: string; app: 'web' | 'admin' | null; fromHost: boolean };
/**
 * From the Host header (never X-Forwarded-Host: anyone can send that). Plain localhost → ISGH_TENANT (default isgh).
 * An address that matches no organization returns tenant: null (the app shows "not found").
 */
export function tenantForHost(host: string | null | undefined): TenantLookup {
  const tenants = readTenants();
  const settings = readPlatformDoc('settings').data;
  const hit = resolveHost(host, tenants, settings);
  const slug = hit?.slug ?? (process.env.ISGH_TENANT || 'isgh');
  const known = host && !hit && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host.trim()) && !isFixedHost(host);
  return { tenant: known ? null : tenants.find((t) => t.slug === slug) ?? null, slug, app: hit?.app ?? null, fromHost: !!hit };
}
/** Addresses that always mean "this server's own tenant" (env), e.g. an IP address or the old single-org name. */
function isFixedHost(host: string) {
  const h = host.toLowerCase().replace(/:\d+$/, '');
  const extra = (process.env.PLATFORM_FIXED_HOSTS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || extra.includes(h);
}
