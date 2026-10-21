/**
 * Who is making this request (demo). Live: the session cookie → admin user → role (BE checks every endpoint).
 * Demo: the admin picks "Acting as" in the top bar; the id travels in the `isgh-acting` cookie. No cookie = the first
 * active Owner. The store API refuses a publish the acting admin is not allowed to make.
 */
import 'server-only';
import { getDoc } from '@/lib/store/server-store';
import { actingIn, can, pagesChangeProblem, permissionForDoc, roleOf, teamChangeProblem, AccessSchema, type AccessDoc, type AdminUser } from './access';
import { OrgStructureSchema, mockOrgStructure } from '@/lib/community/org-structure';
import { fourEyes, IntegrationsSchema } from '@/lib/integrations/integrations';

export function actorFor(req: Request, slug: string): { doc: AccessDoc; admin: AdminUser | null } {
  const parsed = AccessSchema.safeParse(getDoc('admin-access', slug).data);
  const doc = parsed.success ? parsed.data : (getDoc('admin-access', slug).data as AccessDoc);
  const id = /(?:^|;\s*)isgh-acting=([a-z0-9-]+)/.exec(req.headers.get('cookie') ?? '')?.[1];
  const person = (id && doc.admins.find((a) => a.id === id)) || doc.admins.find((a) => a.roleId === 'owner' && a.status === 'active') || null;
  // M4: the dashboard (assignment) the person chose after signing in – cookie `isgh-dash`, 0 = their main role
  const dash = Number(/(?:^|;\s*)isgh-dash=(\d+)/.exec(req.headers.get('cookie') ?? '')?.[1] ?? 0);
  const admin = person ? actingIn(person, dash) : null;
  return { doc, admin };
}
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
/** null = allowed; otherwise a 403 response that says who is missing what. */
export function denyPublish(req: Request, slug: string, key: string): Response | null {
  const { doc, admin } = actorFor(req, slug);
  const p = permissionForDoc(key);
  if (can(doc, admin, p, today())) return null;
  if (key === 'admin-access' && can(doc, admin, 'team.manage', today())) return null; // checked against the change itself (teamProblem)
  if (key === 'pages' && can(doc, admin, 'center.content', today())) return null;     // O1.5 masjid editor – checked against the change itself (pagesProblem)
  const who = admin ? `${admin.name} (${roleOf(doc, admin)?.name ?? admin.roleId})` : 'This admin';
  return Response.json({ error: `${who} cannot change this – it needs “${p}”.`, permission: p }, { status: 403 });
}
/** Integrations: provider, mode or key changes need a second admin (four eyes) – checked here, not only in the browser. */
export function fourEyesProblem(req: Request, slug: string, data: unknown): string | null {
  const { doc, admin } = actorFor(req, slug);
  const before = IntegrationsSchema.safeParse(getDoc('integrations', slug).data);
  const after = IntegrationsSchema.safeParse(data);
  if (!before.success || !after.success || !admin) return null; // schema errors are reported by the publish itself
  const t = today();
  const approvers = doc.admins.filter((a) => a.id !== admin.id && can(doc, a, 'integrations.manage', t)).map((a) => a.id);
  return fourEyes(before.data, after.data, admin.id, approvers);
}
export const actorName = (req: Request, slug: string) => actorFor(req, slug).admin?.name ?? 'Admin (demo)';
/** M2: a masjid leader without admins.manage may only change their own masjid's working body. null = fine. */
export function teamProblem(req: Request, slug: string, data: unknown): string | null {
  const { doc, admin } = actorFor(req, slug);
  if (!admin || can(doc, admin, 'admins.manage', today())) return null;
  const after = AccessSchema.safeParse(data);
  if (!after.success) return null; // the publish reports schema errors itself
  return teamChangeProblem(doc, after.data, admin, today()) || null;
}
export const canManageAdmins = (req: Request, slug: string) => { const { doc, admin } = actorFor(req, slug); return can(doc, admin, 'admins.manage', today()); };
/** O1.5: a masjid editor (center.content, no content.publish) may only change their own masjid's pages and may not publish them. null = fine. */
export function pagesProblem(req: Request, slug: string, data: unknown): string | null {
  const { doc, admin } = actorFor(req, slug);
  if (!admin || can(doc, admin, 'content.publish', today())) return null;
  const mp = OrgStructureSchema.safeParse(getDoc('org-structure', slug).data); const map = mp.success ? mp.data : mockOrgStructure;
  type L = Record<string, { slug: string; status: string; scope: { kind: 'org' } | { kind: 'masjid'; center: string } }>;
  const before = (getDoc('pages', slug).data ?? {}) as L; const after = (data ?? {}) as L;
  if (typeof after !== 'object') return null;
  return pagesChangeProblem(before, after, admin, doc, (id) => map.centers.find((c) => c.id === id)?.name ?? '', (name) => map.centers.find((c) => c.name === name)?.zone ?? '');
}
