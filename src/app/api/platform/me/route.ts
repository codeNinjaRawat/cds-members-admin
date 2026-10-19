/**
 * GET what this admin needs to know about its own organization (SaaS): name, status, plan, modules it may use,
 * platform announcements, an open support sign-in, its website address. Read-only; only this organization's data.
 * BE: GET /admin/platform/me (from the signed-in admin's organization).
 */
import { tenantForHost, readPlatformDoc, readSupport, today } from '@/lib/platform/platform-store';
import { apiCall, apiConfig } from '@/lib/api/client';
import { announcementsFor, effectiveModules, hostsFor, planOf, sessionActive, trialDaysLeft } from '@/lib/platform/platform';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!apiConfig.useMock) {   // live: the API answers for the signed-in admin's organization
    const r = await apiCall('GET', '/admin/platform/me').catch(() => null);
    if (!r) return Response.json({ error: 'We could not reach the server.' }, { status: 503 });
    return Response.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
  }
  const host = req.headers.get('host');
  const { tenant: t } = tenantForHost(host);
  if (!t) return Response.json({ error: 'This address does not belong to an organization.' }, { status: 404 });
  const plans = readPlatformDoc('plans').data; const settings = readPlatformDoc('settings').data;
  const day = today(); const now = new Date();
  const support = readSupport().find((s) => s.slug === t.slug && sessionActive(s, now));
  const hosts = hostsFor(t, settings);
  // the website that belongs to this admin: production → its web host; on a PC → same name on port 3000
  const local = !host || /localhost|127\.0\.0\.1/.test(host);
  const siteUrl = local ? undefined : `https://${hosts.custom ?? hosts.web}`;
  return Response.json({
    productName: settings.productName, supportEmail: settings.supportEmail,
    org: { slug: t.slug, name: t.name, shortName: t.shortName, status: t.status, color: t.color, plan: planOf(plans, t.planId).name, trialDaysLeft: trialDaysLeft(t, day), suspendedReason: t.suspendedReason },
    modules: effectiveModules(t, plans, readPlatformDoc('flags').data.flags),
    announcements: announcementsFor(t, readPlatformDoc('announcements').data.items, day).map(({ id, title, body, tone }) => ({ id, title, body, tone })),
    support: support ? { by: support.by, reason: support.reason, mode: support.mode, endsAt: support.endsAt } : null,
    siteUrl,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
