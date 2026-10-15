/**
 * DEMO admin API (no BE yet). GET current document (+ ?history=1), PUT publish, DELETE reset to default.
 * Disabled in production unless ISGH_DEMO_STORE is set explicitly.
 */
import { getDoc, getHistory, publishDoc, resetDoc, storeEnabled } from '@/lib/store/server-store';
import { isDocKey } from '@/lib/store/registry';
import { tenantForHost } from '@/lib/platform/platform-store';

/** SaaS: which organization this admin address belongs to (Host header only). */
const org = (req: Request) => tenantForHost(req.headers.get('host')).tenant;
const noOrg = () => Response.json({ error: 'This address does not belong to an organization.' }, { status: 404 });
const locked = (status: string) => Response.json({ error: `This organization is ${status === 'suspended' ? 'suspended' : 'closed'} – changes are not possible. Contact the platform team.` }, { status: 423 });

const allowed = () => storeEnabled() && (process.env.NODE_ENV !== 'production' || !!process.env.ISGH_DEMO_STORE);
const deny = () => Response.json({ error: 'The demo store is turned off.' }, { status: 403 });
const bad = () => Response.json({ error: 'Unknown document.' }, { status: 404 });

type Ctx = { params: Promise<{ key: string }> };
/** Writes only from the admin itself (blocks cross-site requests). */
/** Behind a proxy (https://member-admin.nextgrow.pro → Node on :3001) the request URL may say http or an inner host,
 *  so the forwarded host and the configured public admin URL are trusted too. */
const sameOrigin = (req: Request) => {
  const o = req.headers.get('origin'); if (!o) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const ok = [new URL(req.url).origin, process.env.NEXT_PUBLIC_ADMIN_URL, host && `https://${host}`, host && `http://${host}`].filter(Boolean);
  return ok.includes(o);
};

export async function GET(req: Request, { params }: Ctx) {
  const { key } = await params;
  if (!isDocKey(key)) return bad();
  const t = org(req); if (!t) return noOrg();
  if (new URL(req.url).searchParams.get('history')) return Response.json(getHistory(key, t.slug));
  return Response.json(getDoc(key, t.slug), { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { key } = await params;
  if (!isDocKey(key)) return bad();
  if (!allowed() || !sameOrigin(req)) return deny();
  const t = org(req); if (!t) return noOrg();
  if (t.status === 'suspended' || t.status === 'cancelled') return locked(t.status);
  const text = await req.text();
  if (text.length > 2_000_000) return Response.json({ error: 'This document is too large (2 MB max). Use smaller images.' }, { status: 413 });
  let body: { data: unknown; baseVersion?: number; note?: string };
  try { body = JSON.parse(text); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const r = publishDoc(key, { ...body, by: 'Akhter Alam (demo)' }, t.slug);
  return r.ok ? Response.json(r) : Response.json(r, { status: r.status });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { key } = await params;
  if (!isDocKey(key)) return bad();
  if (!allowed() || !sameOrigin(req)) return deny();
  const t = org(req); if (!t) return noOrg();
  if (t.status === 'suspended' || t.status === 'cancelled') return locked(t.status);
  resetDoc(key, t.slug);
  return Response.json({ ok: true });
}
