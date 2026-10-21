/**
 * The admin's documents: GET current document (+ ?history=1), PUT publish, DELETE reset to the starter content.
 * Demo: the demo store (disabled in production unless ISGH_DEMO_STORE is set). Live: the API (/admin/documents/:key).
 */
import { getDoc, getHistory, publishDoc, resetDoc, storeEnabled } from '@/lib/store/server-store';
import { isDocKey } from '@/lib/store/registry';
import { tenantForHost } from '@/lib/platform/platform-store';
import { actorName, canManageAdmins, denyPublish, fourEyesProblem, teamProblem, pagesProblem } from '@/lib/access/server-access';
import { apiCall, apiConfig } from '@/lib/api/client';
import { jsonResponse } from '@/lib/api/json-response';

/* ---------- live mode (ISGH_USE_MOCK_API=false): the same answers, from the API's /admin/documents/:key ---------- */
type ApiDoc = { data: unknown; version: number; publishedAt: string | null; by: string | null; source: string; versions?: { version: number; publishedAt: string; by: string; note?: string; data?: unknown }[] };
const fail = (r: { status: number; body: unknown }) => { const b = (r.body ?? {}) as { error?: string; detail?: unknown; code?: string }; return Response.json({ error: b.error ?? 'The server refused this.', issues: Array.isArray(b.detail) ? b.detail : undefined, code: b.code }, { status: r.status }); };
async function live(method: string, key: string, req: Request): Promise<Response> {
  try {
    if (method === 'GET') {
      const history = !!new URL(req.url).searchParams.get('history');
      const r = await apiCall('GET', `/admin/documents/${key}${history ? '?versions=full' : ''}`);
      if (r.status >= 400) return fail(r);
      const d = r.body as ApiDoc;
      if (history) return Response.json(d.versions ?? []);
      return jsonResponse(req, { data: d.data, version: d.version, publishedAt: d.publishedAt, by: d.by, source: d.source === 'published' ? 'published' : 'default' });
    }
    if (method === 'PUT') {
      const text = await req.text();
      if (text.length > 2_000_000) return Response.json({ error: 'This document is too large (2 MB max). Use smaller images.' }, { status: 413 });
      let body: unknown; try { body = JSON.parse(text); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }
      const r = await apiCall('PUT', `/admin/documents/${key}`, body);
      return r.status >= 400 ? fail(r) : Response.json(r.body);
    }
    const r = await apiCall('DELETE', `/admin/documents/${key}`);
    return r.status >= 400 ? fail(r) : Response.json({ ok: true });
  } catch { return Response.json({ error: 'We could not reach the server. Your draft is saved in this browser.' }, { status: 503 }); }
}

/** SaaS: which organization this admin address belongs to (Host header only). */
const org = (req: Request) => tenantForHost(req.headers.get('host')).tenant;
const noOrg = () => Response.json({ error: 'This address does not belong to an organization.' }, { status: 404 });
const locked = (status: string) => Response.json({ error: `This organization is ${status === 'suspended' ? 'suspended' : 'closed'} – changes are not possible. Contact the platform team.` }, { status: 423 });

const allowed = () => storeEnabled() && (process.env.NODE_ENV !== 'production' || !!process.env.ISGH_DEMO_STORE);
const deny = () => Response.json({ error: 'The demo store is turned off.' }, { status: 403 });
const bad = () => Response.json({ error: 'Unknown document.' }, { status: 404 });

type Ctx = { params: Promise<{ key: string }> };
/** Writes only from the admin itself (blocks cross-site requests). */
/** Behind a proxy (https://member-admin.masajidsolutions.com → Node on :3001) the request URL may say http or an inner host,
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
  if (!apiConfig.useMock) return live('GET', key, req);
  const t = org(req); if (!t) return noOrg();
  if (new URL(req.url).searchParams.get('history')) return Response.json(getHistory(key, t.slug));
  return Response.json(getDoc(key, t.slug), { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { key } = await params;
  if (!isDocKey(key)) return bad();
  if (!apiConfig.useMock) return sameOrigin(req) ? live('PUT', key, req) : deny();   // the API checks role, versions, four eyes, team
  if (!allowed() || !sameOrigin(req)) return deny();
  const t = org(req); if (!t) return noOrg();
  if (t.status === 'suspended' || t.status === 'cancelled') return locked(t.status);
  const no = denyPublish(req, t.slug, key); if (no) return no;          // A10: role check (BE: every endpoint)
  const text = await req.text();
  if (text.length > 2_000_000) return Response.json({ error: 'This document is too large (2 MB max). Use smaller images.' }, { status: 413 });
  let body: { data: unknown; baseVersion?: number; note?: string };
  try { body = JSON.parse(text); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  if (key === 'integrations') { const fe = fourEyesProblem(req, t.slug, body.data); if (fe) return Response.json({ error: fe }, { status: 409 }); }
  if (key === 'admin-access') { const tp = teamProblem(req, t.slug, body.data); if (tp) return Response.json({ error: tp, permission: 'admins.manage' }, { status: 403 }); }
  if (key === 'pages') { const pp = pagesProblem(req, t.slug, body.data); if (pp) return Response.json({ error: pp, permission: 'content.publish' }, { status: 403 }); }
  const r = publishDoc(key, { ...body, by: actorName(req, t.slug) }, t.slug);
  return r.ok ? Response.json(r) : Response.json(r, { status: r.status });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { key } = await params;
  if (!isDocKey(key)) return bad();
  if (!apiConfig.useMock) return sameOrigin(req) ? live('DELETE', key, req) : deny();
  if (!allowed() || !sameOrigin(req)) return deny();
  const t = org(req); if (!t) return noOrg();
  if (t.status === 'suspended' || t.status === 'cancelled') return locked(t.status);
  const no = denyPublish(req, t.slug, key); if (no) return no;
  if (key === 'admin-access' && !canManageAdmins(req, t.slug)) return Response.json({ error: 'Only the organization admin can reset the admin list.' }, { status: 403 });
  resetDoc(key, t.slug);
  return Response.json({ ok: true });
}
