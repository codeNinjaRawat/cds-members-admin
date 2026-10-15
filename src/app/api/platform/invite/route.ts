/**
 * Admin invitations made in the SaaS panel. GET ?token= → who it is for (only for this organization's address);
 * POST { token } → accept (demo: no password yet – staff sign-in arrives with BE module B1).
 */
import { audit, readTenants, tenantForHost, today, writeTenants } from '@/lib/platform/platform-store';

export const dynamic = 'force-dynamic';
const TOKEN = /^inv-[a-z0-9-]{4,40}$/;
const find = (req: Request, token: string | null) => {
  const { tenant } = tenantForHost(req.headers.get('host'));
  if (!tenant || !token || !TOKEN.test(token)) return null;
  const u = tenant.admins.find((a) => a.token === token && a.status === 'invited');
  return u ? { tenant, u } : null;
};
export function GET(req: Request) {
  const hit = find(req, new URL(req.url).searchParams.get('token'));
  if (!hit) return Response.json({ error: 'This invitation link is not valid any more. Ask for a new one.' }, { status: 404 });
  return Response.json({ org: hit.tenant.name, shortName: hit.tenant.shortName, name: hit.u.name, email: hit.u.email, role: hit.u.role });
}
export async function POST(req: Request) {
  const o = req.headers.get('origin'); const host = req.headers.get('host');
  if (o && host && o !== `http://${host}` && o !== `https://${host}`) return Response.json({ error: 'Not allowed.' }, { status: 403 });
  let token: string | null = null;
  try { token = ((await req.json()) as { token?: string }).token ?? null; } catch { /* bad body */ }
  const hit = find(req, token);
  if (!hit) return Response.json({ error: 'This invitation link is not valid any more. Ask for a new one.' }, { status: 404 });
  const list = readTenants(); const t = list.find((x) => x.slug === hit.tenant.slug)!; const u = t.admins.find((a) => a.id === hit.u.id)!;
  u.status = 'active'; u.token = undefined; u.lastActiveOn = today();
  writeTenants(list);
  audit(u.name, 'admin.accepted', t.slug, `${u.name} <${u.email}> accepted the invitation`);
  return Response.json({ ok: true, org: t.name });
}
