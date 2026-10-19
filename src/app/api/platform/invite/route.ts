/**
 * Admin invitations made in the SaaS panel. GET ?token= → who it is for (only for this organization's address);
 * POST { token } → accept (demo: no password yet – staff sign-in arrives with BE module B1).
 */
import { audit, readTenants, tenantForHost, today, writeTenants } from '@/lib/platform/platform-store';
import { apiCall, apiConfig, ownSessionCookie } from '@/lib/api/client';

/** Live: the API's invitation (GET /auth/invitations/:token, POST …/accept {password?} → signed in on this admin). */
const LIVE_TOKEN = /^[A-Za-z0-9_-]{30,60}$/;
async function live(method: 'GET' | 'POST', token: string | null, body?: unknown): Promise<Response> {
  if (!token || !LIVE_TOKEN.test(token)) return Response.json({ error: 'This invitation link is not valid any more. Ask for a new one.' }, { status: 404 });
  const r = await apiCall(method, `/auth/invitations/${token}${method === 'POST' ? '/accept' : ''}`, body).catch(() => null);
  if (!r) return Response.json({ error: 'We could not reach the server.' }, { status: 503 });
  const res = Response.json(r.body, { status: r.status });
  for (const c of r.setCookie) res.headers.append('set-cookie', ownSessionCookie(c));
  return res;
}

export const dynamic = 'force-dynamic';
const TOKEN = /^inv-[a-z0-9-]{4,40}$/;
const find = (req: Request, token: string | null) => {
  const { tenant } = tenantForHost(req.headers.get('host'));
  if (!tenant || !token || !TOKEN.test(token)) return null;
  const u = tenant.admins.find((a) => a.token === token && a.status === 'invited');
  return u ? { tenant, u } : null;
};
export async function GET(req: Request) {
  if (!apiConfig.useMock) return live('GET', new URL(req.url).searchParams.get('token'));
  const hit = find(req, new URL(req.url).searchParams.get('token'));
  if (!hit) return Response.json({ error: 'This invitation link is not valid any more. Ask for a new one.' }, { status: 404 });
  return Response.json({ org: hit.tenant.name, shortName: hit.tenant.shortName, name: hit.u.name, email: hit.u.email, role: hit.u.role });
}
export async function POST(req: Request) {
  const o = req.headers.get('origin'); const host = req.headers.get('host');
  if (o && host && o !== `http://${host}` && o !== `https://${host}`) return Response.json({ error: 'Not allowed.' }, { status: 403 });
  let token: string | null = null; let password: string | undefined;
  try { const b = (await req.json()) as { token?: string; password?: string }; token = b.token ?? null; password = b.password; } catch { /* bad body */ }
  if (!apiConfig.useMock) return live('POST', token, password ? { password } : {});
  const hit = find(req, token);
  if (!hit) return Response.json({ error: 'This invitation link is not valid any more. Ask for a new one.' }, { status: 404 });
  const list = readTenants(); const t = list.find((x) => x.slug === hit.tenant.slug)!; const u = t.admins.find((a) => a.id === hit.u.id)!;
  u.status = 'active'; u.token = undefined; u.lastActiveOn = today();
  writeTenants(list);
  audit(u.name, 'admin.accepted', t.slug, `${u.name} <${u.email}> accepted the invitation`);
  return Response.json({ ok: true, org: t.name });
}
