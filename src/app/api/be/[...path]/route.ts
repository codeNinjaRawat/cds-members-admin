/**
 * /api/be/* – the admin's door to the API in live mode (ISGH_USE_MOCK_API=false). Same origin, so the session cookie
 * (ms_sid, httpOnly) belongs to this admin address – a website sign-in never opens the admin. Sign-in, admin and
 * public routes pass; platform (staff) routes never do. Writes must come from this admin (Origin check).
 */
import { apiCall, apiConfig, ownSessionCookie } from '@/lib/api/client';
import { jsonResponse } from '@/lib/api/json-response';

const ALLOWED = /^(auth|admin|public)\/[A-Za-z0-9._~\-/]{1,300}$/;
type Ctx = { params: Promise<{ path: string[] }> };

const sameSite = (req: Request) => {
  const o = req.headers.get('origin'); if (!o) return true;
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim();
  return o === `https://${host}` || o === `http://${host}` || o === new URL(req.url).origin;
};

async function pass(req: Request, { params }: Ctx) {
  if (apiConfig.useMock) return Response.json({ error: 'Demo mode – the API is not connected.' }, { status: 404 });
  const path = (await params).path.join('/');
  if (!ALLOWED.test(path) || path.includes('..')) return Response.json({ error: 'Not found.' }, { status: 404 });
  if (req.method !== 'GET' && !sameSite(req)) return Response.json({ error: 'Not allowed from another site.' }, { status: 403 });
  let body: unknown;
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const text = await req.text();
    if (text.length > 4_000_000) return Response.json({ error: 'Too large (4 MB max).' }, { status: 413 });
    try { body = text ? JSON.parse(text) : {}; } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  }
  try {
    const r = await apiCall(req.method, `/${path}${new URL(req.url).search}`, body);
    const out = new Headers();
    for (const c of r.setCookie) out.append('set-cookie', ownSessionCookie(c));
    return jsonResponse(req, r.body ?? {}, { status: r.status, headers: out });
  } catch {
    return Response.json({ error: 'We could not reach the server. Please try again in a minute.' }, { status: 503 });
  }
}
export { pass as GET, pass as POST, pass as PUT, pass as PATCH, pass as DELETE };
