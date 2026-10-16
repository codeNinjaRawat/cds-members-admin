/**
 * M4 One door, many dashboards. Everyone signs in on the website the same way; afterwards the person picks where to
 * work – their own membership, the whole organization, a zone, a masjid, or the ZIP codes they represent. The list is
 * built from their role assignments (lib/community/access.ts), so it changes the moment an admin gives or takes a role.
 *   SignInSchema   – admin › Settings › Sign-in: which sign-in methods show, what each dashboard is called, and what
 *                    happens when someone has several (always ask / open the last one / open the main one).
 *   dashboardsFor  – the dashboards one email may open (live: GET /auth/dashboards from the session – never by email).
 * DEMO (no API). Synced to the admin by sync-contracts.mjs – edit here (web), never in the admin copy.
 */
import { z } from 'zod';
import { assignmentsOf, roleOf, whereOf, type AccessDoc } from './access';

export const DASH_KINDS = ['member', 'organization', 'zone', 'masjid', 'area'] as const;
export type DashKind = (typeof DASH_KINDS)[number];
const Kind = z.object({ enabled: z.boolean(), label: z.string().trim().min(2).max(40), help: z.string().max(140) });

export const SignInSchema = z.object({
  methods: z.object({
    google: z.boolean(),
    emailCode: z.boolean(),
    phoneCode: z.boolean(),                                   // needs text messages (Integrations)
    password: z.boolean(),                                    // optional, for people who ask for one (BE)
  }),
  /** Several dashboards: always ask, open the last one used, or open the main role's. A switcher is always in the top bar. */
  chooser: z.enum(['ask', 'last', 'main']),
  kinds: z.object({ member: Kind, organization: Kind, zone: Kind, masjid: Kind, area: Kind }),
  findMasjid: z.boolean(),                                    // "Find your masjid" by ZIP code on the sign-in page
  staffNote: z.string().max(200),
}).superRefine((d, ctx) => {
  if (!d.methods.google && !d.methods.emailCode && !d.methods.phoneCode && !d.methods.password) ctx.addIssue({ code: 'custom', path: ['methods'], message: 'Keep at least one way to sign in.' });
  if (!d.kinds.member.enabled) ctx.addIssue({ code: 'custom', path: ['kinds', 'member', 'enabled'], message: 'Members always need their own dashboard.' });
});
export type SignInSettings = z.infer<typeof SignInSchema>;

export const mockSignIn: SignInSettings = {
  methods: { google: true, emailCode: true, phoneCode: false, password: false },
  chooser: 'ask',
  kinds: {
    member: { enabled: true, label: 'My membership', help: 'Your card, dues, household, votes and your masjid.' },
    organization: { enabled: true, label: 'Organization admin', help: 'Every zone and masjid.' },
    zone: { enabled: true, label: 'Zone dashboard', help: 'The masjids and members of your zone.' },
    masjid: { enabled: true, label: 'Masjid dashboard', help: 'Your masjid’s members, events, money and working body.' },
    area: { enabled: true, label: 'My area', help: 'The families in the ZIP codes you represent.' },
  },
  findMasjid: true,
  staffNote: 'Board members, directors, secretaries and volunteers sign in here too.',
};

export type Dashboard = { kind: DashKind; label: string; role: string; where: string; index: number; adminId: string };
/** Which kind of dashboard an assignment opens (from the role's scope). */
export function kindOf(doc: AccessDoc, roleId: string): Exclude<DashKind, 'member'> {
  const r = doc.roles.find((x) => x.id === roleId);
  return r?.areaScoped ? 'area' : r?.centerScoped ? 'masjid' : r?.zoneScoped ? 'zone' : 'organization';
}
/**
 * The dashboards an email may open, in a stable order: membership first, then organization → zone → masjid → area.
 * Suspended, invited and expired access never shows. Turned-off kinds are hidden.
 */
export function dashboardsFor(doc: AccessDoc, email: string, isMember: boolean, s: SignInSettings, today: string, zoneName: (id: string) => string = (id) => id): Dashboard[] {
  const mail = email.trim().toLowerCase();
  const out: Dashboard[] = [];
  if (isMember && s.kinds.member.enabled) out.push({ kind: 'member', label: s.kinds.member.label, role: 'Member', where: '', index: -1, adminId: '' });
  const a = doc.admins.find((x) => x.email === mail && x.status === 'active');
  if (a) assignmentsOf(a).forEach((x, index) => {
    if (x.expiresOn && x.expiresOn < today) return;
    const kind = kindOf(doc, x.roleId);
    if (!s.kinds[kind].enabled) return;
    out.push({ kind, label: s.kinds[kind].label, role: roleOf(doc, { ...a, roleId: x.roleId })?.name ?? x.roleId, where: whereOf(doc, x, zoneName), index, adminId: a.id });
  });
  const order = (k: DashKind) => DASH_KINDS.indexOf(k);
  return out.sort((p, q) => order(p.kind) - order(q.kind) || p.index - q.index);
}
/** Where to go right after signing in: null = show the chooser. */
export function autoOpen(list: Dashboard[], s: SignInSettings, last?: string): Dashboard | null {
  if (list.length === 1) return list[0];
  if (!list.length) return null;
  if (s.chooser === 'main') return list.find((d) => d.index === 0) ?? list[0];
  if (s.chooser === 'last' && last) return list.find((d) => dashKey(d) === last) ?? null;
  return null;
}
export const dashKey = (d: Pick<Dashboard, 'kind' | 'index' | 'adminId'>) => (d.kind === 'member' ? 'member' : `${d.adminId}:${d.index}`);
