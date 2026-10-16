/**
 * Synced to the admin by admin/scripts/sync-contracts.mjs – edit here (web), never in the admin copy. The admin imports it
 * through lib/access/access.ts. The website uses it on the server only (sign-in dashboards) – never in a client bundle.
 *
 * A10 Admin users, roles and scopes (WildApricot: administrator roles – full, read-only, membership, event, donation,
 * website editor…; ISGH adds Board approval, the Election Commission, treasurer and zone directors).
 *   PERMISSIONS        – the single list of things an admin can do (the BE checks the same keys on every endpoint)
 *   BUILT_IN_ROLES     – ready-made roles; organizations can add their own
 *   AccessSchema       – users + roles document, with rules that prevent lock-outs and unsafe set-ups
 *   can / inScope      – the two questions every screen and every endpoint asks
 *   permissionForDoc   – which permission publishes which document
 */
import { z } from 'zod';

/** Modules in the order they appear in the admin. `soon` = the screens arrive with that module (roles can be set up now). */
export const MODULES = ['Members', 'Zones and centers', 'Zakat and Sadaqah', 'Donations and finance', 'Events', 'Communication', 'Website', 'Benefits and community', 'Reports', 'Elections', 'Settings'] as const;
export type ModuleName = (typeof MODULES)[number];
type PermDef = { label: string; group: ModuleName; help: string; sensitive?: true; soon?: string };
export const PERMISSIONS = {
  'members.view': { label: 'See members', group: 'Members', help: 'Names, status, zone, center, voting status.' },
  'members.contact': { label: 'See contact details and export', group: 'Members', help: 'Phone, email, home address, birth date; CSV exports.', sensitive: true },
  'members.edit': { label: 'Edit members', group: 'Members', help: 'Profile fields, center changes, notes, ID checks.' },
  'members.approve': { label: 'Approve applications (Board)', group: 'Members', help: 'Bylaws: the Board approves new members.' },
  'members.archive': { label: 'Archive and import members', group: 'Members', help: 'Archive or restore records, import from a file.', sensitive: true },
  'groups.manage': { label: 'Manage groups', group: 'Members', help: 'Create groups and change who is in them.' },
  'centers.manage': { label: 'Edit zones, centers and ZIP codes', group: 'Zones and centers', help: 'Directors and terms, center details, which ZIP code belongs to which zone.' },
  'center.content': { label: 'Prayer times and meeting minutes', group: 'Zones and centers', help: 'Iqamah times, special prayers and meeting minutes for the centers a person may see. The calculation method needs “Manage settings”.' },
  'zakat.view': { label: 'See Zakat and Sadaqah cases', group: 'Zakat and Sadaqah', help: 'Applications, approvals, payouts and reports – read only.', soon: 'F2' },
  'zakat.intake': { label: 'Take applications', group: 'Zakat and Sadaqah', help: 'Enter applications from the website, the phone or a walk-in.', soon: 'F2' },
  'zakat.verify': { label: 'Verify applicants', group: 'Zakat and Sadaqah', help: 'Check documents and income, record home visits, decide Zakat or Sadaqah.', soon: 'F2' },
  'zakat.approve': { label: 'Approve within the role’s limit', group: 'Zakat and Sadaqah', help: 'Level 1, 2 or 3 – the dollar limit for each level is set in Zakat settings.', soon: 'F2' },
  'zakat.override': { label: 'Override and fast-track', group: 'Zakat and Sadaqah', help: 'Approve a stalled or urgent case at any level (Committee Chair).', sensitive: true, soon: 'F2' },
  'zakat.disburse': { label: 'Pay out approved cases', group: 'Zakat and Sadaqah', help: 'Bank transfer, check or cash after all approvals (Zakat Operations Office).', sensitive: true, soon: 'F2' },
  'zakat.settings': { label: 'Change Zakat rules', group: 'Zakat and Sadaqah', help: 'Approval limits, response times, Sadaqah routing.', sensitive: true, soon: 'F2' },
  'payments.record': { label: 'Record payments', group: 'Donations and finance', help: 'Checks and cash at a center.' },
  'payments.refund': { label: 'Refund payments', group: 'Donations and finance', help: 'Give money back.', sensitive: true },
  'donations.view': { label: 'See donations', group: 'Donations and finance', help: 'Online and in-person gifts by fund, center and platform.' },
  'donations.reconcile': { label: 'Record and reconcile donations', group: 'Donations and finance', help: 'Enter in-person gifts, match platform payouts, fix unmatched ones, send receipts.' },
  'finance.view': { label: 'See funds and financial reports', group: 'Donations and finance', help: 'Fund balances, income and expenses, budgets, aid paid. Who may approve a payment is set in Finance rules.' },
  'finance.manage': { label: 'Manage funds and transfers', group: 'Donations and finance', help: 'Enter payments, transfers between funds and financial aid; change the finance rules and budgets.', sensitive: true },
  'fundraising.manage': { label: 'Run fundraising campaigns', group: 'Donations and finance', help: 'Campaigns, goals, matching sponsors, pledges and approving members’ personal fundraising pages.' },
  'events.manage': { label: 'Manage events', group: 'Events', help: 'Create, publish and cancel events; see registrations.' },
  'events.checkin': { label: 'Check people in at events', group: 'Events', help: 'For volunteers at the door – nothing else.' },
  'comms.send': { label: 'Send messages to members', group: 'Communication', help: 'Bulk email and texts.' },
  'comms.settings': { label: 'Change email settings and templates', group: 'Communication', help: 'Automatic emails, templates, sender, text messages.' },
  'content.publish': { label: 'Publish website content', group: 'Website', help: 'Pages, news, home page, giving, theme, site settings.' },
  'benefits.manage': { label: 'Manage member benefits and discounts', group: 'Benefits and community', help: 'Partner businesses, their offers, which plans can use them, and the use log.' },
  'officials.manage': { label: 'Manage elected officials', group: 'Benefits and community', help: 'Board, Zonal and Associate Directors, Area Representatives, Secretaries – terms, oaths and vacancies.' },
  'reports.view': { label: 'See reports', group: 'Reports', help: 'Membership, dues, events numbers.' },
  'voters.freeze': { label: 'Freeze and correct the voter list', group: 'Elections', help: 'Election Commission only.', sensitive: true },
  'settings.manage': { label: 'Change membership rules and configuration', group: 'Settings', help: 'Plans and dues, join form, configuration, feature switches.' },
  'integrations.manage': { label: 'Manage integrations', group: 'Settings', help: 'Email, text message, Stripe and Google keys and modes. Changes need a second admin.', sensitive: true },
  'team.manage': { label: 'Build the masjid’s working body', group: 'Settings', help: 'Give masjid roles (secretaries, Area Representatives, volunteers) to people of their own masjid. Never more than they have themselves.' },
  'admins.manage': { label: 'Manage admins and roles', group: 'Settings', help: 'Invite admins, change roles, see the audit log.', sensitive: true },
  billing: { label: 'Billing and the subscription', group: 'Settings', help: 'Owner only.', sensitive: true },
} satisfies Record<string, PermDef>;
export type Permission = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];
export const permDef = (p: Permission): PermDef => PERMISSIONS[p];
const ALL = PERMISSION_KEYS;

/** Role areas – how roles are listed (one heading per area). */
export const ROLE_AREAS = { leadership: 'Leadership', masjid: 'Masjid working body', membership: 'Membership and centers', zakat: 'Zakat and Sadaqah', finance: 'Donations and finance', communication: 'Communication', community: 'Benefits and community', events: 'Events', website: 'Website', elections: 'Elections', general: 'Other' } as const;
export type RoleArea = keyof typeof ROLE_AREAS;
/** Zakat approval levels (amounts live in Zakat settings, F2). */
export const ZAKAT_LEVELS = { 1: 'Level 1 – Local Zakat Coordinator (up to $400)', 2: 'Level 2 – Central Committee Member (up to $750)', 3: 'Level 3 – Committee Chair (up to $1,000)' } as const;

export const RoleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/, 'Lowercase letters, numbers and dashes'),
  name: z.string().trim().min(2).max(60),
  description: z.string().max(200).default(''),
  permissions: z.array(z.enum(PERMISSION_KEYS as [Permission, ...Permission[]])).min(1, 'Give the role at least one permission.'),
  area: z.enum(Object.keys(ROLE_AREAS) as [RoleArea, ...RoleArea[]]).default('general'),
  zoneScoped: z.boolean().default(false),                                     // members limited to the zones set on each user
  centerScoped: z.boolean().default(false),                                   // members (and later Zakat, donations) limited to the user's centers
  areaScoped: z.boolean().default(false),                                     // M2: inside one masjid, only the ZIP codes set on the assignment (Area Representative)
  zakatLevel: z.number().int().min(0).max(3).default(0),                      // 0 = cannot approve Zakat
  builtIn: z.boolean().default(false),
}).superRefine((r, ctx) => {
  if (r.zoneScoped && r.centerScoped) ctx.addIssue({ code: 'custom', path: ['centerScoped'], message: 'A role is limited to zones or to centers, not both.' });
  if (r.areaScoped && !r.centerScoped) ctx.addIssue({ code: 'custom', path: ['areaScoped'], message: 'ZIP-code areas sit inside a masjid – limit the role to a masjid too.' });
  if (r.permissions.includes('team.manage') && !r.centerScoped && !r.permissions.includes('admins.manage')) ctx.addIssue({ code: 'custom', path: ['permissions'], message: '“Build the masjid’s working body” is for masjid roles. Organization-wide roles use “Manage admins and roles”.' });
  if (r.permissions.includes('zakat.approve') && !r.zakatLevel) ctx.addIssue({ code: 'custom', path: ['zakatLevel'], message: 'Pick the Zakat approval level for this role.' });
  if (!r.permissions.includes('zakat.approve') && r.zakatLevel) ctx.addIssue({ code: 'custom', path: ['zakatLevel'], message: 'An approval level needs the “Approve within the role’s limit” permission.' });
});
export type Role = z.infer<typeof RoleSchema>;
type RoleOpts = { area: RoleArea; zone?: boolean; center?: boolean; zips?: boolean; level?: number };
const role = (id: string, name: string, description: string, permissions: Permission[], o: RoleOpts): Role => ({ id, name, description, permissions, area: o.area, zoneScoped: !!o.zone, centerScoped: !!o.center || !!o.zips, areaScoped: !!o.zips, zakatLevel: o.level ?? 0, builtIn: true });
const EB_VIEW: Permission[] = ['members.view', 'members.approve', 'reports.view', 'zakat.view', 'donations.view', 'finance.view'];
export const BUILT_IN_ROLES: Role[] = [
  // Leadership
  role('owner', 'Owner', 'Everything, including billing. At least one active owner is required.', [...ALL], { area: 'leadership', level: 3 }),
  role('admin', 'Admin', 'Everything except billing (Super Admin).', ALL.filter((p) => p !== 'billing'), { area: 'leadership', level: 3 }),
  role('president', 'President', 'Executive Board. Leads the organization: sees every module, approves applications, sends messages, keeps the officials list.', [...EB_VIEW, 'comms.send', 'officials.manage'], { area: 'leadership' }),
  role('vice-president', 'Vice President', 'Executive Board. Sees every module and approves applications; stands in for the President.', [...EB_VIEW, 'comms.send'], { area: 'leadership' }),
  role('general-secretary', 'General Secretary', 'Executive Board. Notices, meetings and minutes, member records and messages.', [...EB_VIEW, 'members.edit', 'center.content', 'comms.send'], { area: 'leadership' }),
  role('executive-board', 'Executive Board', 'Sees every module and approves applications; changes nothing else.', EB_VIEW, { area: 'leadership' }),
  role('board-member', 'Board member', 'Approves applications (Bylaws) and sees reports.', ['members.view', 'members.approve', 'reports.view'], { area: 'leadership' }),
  // Masjid working body (one set per masjid – see the org chart: Associate Director, secretaries, Area Representatives)
  role('associate-director', 'Associate Director', 'Runs the masjid: its members and dues, events, prayer times and minutes, its gifts and finance; sees its Zakat cases; builds its working body.', ['members.view', 'members.contact', 'members.edit', 'payments.record', 'reports.view', 'zakat.view', 'donations.view', 'donations.reconcile', 'finance.view', 'events.manage', 'events.checkin', 'center.content', 'team.manage'], { area: 'masjid', center: true }),
  role('membership-secretary', 'Membership Secretary', 'The masjid’s member records: new applications, renewals, cash and check dues, contact details.', ['members.view', 'members.contact', 'members.edit', 'payments.record', 'reports.view'], { area: 'masjid', center: true }),
  role('finance-secretary', 'Finance Secretary', 'The masjid’s money: records cash and checks, sees donations, funds and budgets.', ['payments.record', 'donations.view', 'donations.reconcile', 'finance.view', 'reports.view'], { area: 'masjid', center: true }),
  role('education-secretary', 'Education Secretary', 'Classes, weekend school and programs: the masjid’s events, check-in and prayer-time notices.', ['members.view', 'events.manage', 'events.checkin', 'center.content'], { area: 'masjid', center: true }),
  role('area-representative', 'Area Representative', 'Represents members in a few ZIP codes of one masjid: sees and contacts only those members.', ['members.view', 'members.contact'], { area: 'masjid', zips: true }),
  // Membership and centers
  role('membership-officer', 'Membership officer', 'Day-to-day member work: records, payments, groups, messages, reports.', ['members.view', 'members.contact', 'members.edit', 'members.archive', 'payments.record', 'groups.manage', 'comms.send', 'reports.view'], { area: 'membership' }),
  role('center-admin', 'Center admin', 'Runs one center: its members, events, prayer times and minutes.', ['members.view', 'members.contact', 'members.edit', 'events.manage', 'events.checkin', 'center.content', 'donations.view', 'finance.view', 'reports.view'], { area: 'membership', center: true }),
  role('zone-director', 'Zone director', 'Members of their own zone(s) only.', ['members.view', 'members.contact', 'members.edit', 'events.checkin', 'reports.view'], { area: 'membership', zone: true }),
  // Zakat and Sadaqah
  role('zakat-chair', 'Zakat Committee Chair', 'Level 3 approval, overrides stalled or urgent cases, sets the Zakat rules.', ['zakat.view', 'zakat.verify', 'zakat.approve', 'zakat.override', 'zakat.settings', 'reports.view'], { area: 'zakat', level: 3 }),
  role('zakat-committee-member', 'Central Committee Member', 'Level 2 approval for cases above the coordinator’s limit.', ['zakat.view', 'zakat.approve'], { area: 'zakat', level: 2 }),
  role('zakat-coordinator', 'Local Zakat Coordinator', 'Level 1 at their own center: takes applications, verifies, home visits, approves small cases.', ['zakat.view', 'zakat.intake', 'zakat.verify', 'zakat.approve'], { area: 'zakat', center: true, level: 1 }),
  role('zakat-operations', 'Zakat Operations Office', 'Pays out fully approved cases and keeps the payout record.', ['zakat.view', 'zakat.disburse', 'finance.view'], { area: 'zakat' }),
  role('office-admin', 'Office admin', 'Front office: enters applications from the phone and walk-ins.', ['zakat.view', 'zakat.intake'], { area: 'zakat' }),
  // Donations and finance
  role('treasurer', 'Treasurer', 'Handles all monies (Bylaws): payments, refunds, funds, budgets and reports; approves and signs payments.', ['members.view', 'members.contact', 'payments.record', 'payments.refund', 'reports.view', 'donations.view', 'finance.view', 'finance.manage', 'fundraising.manage', 'zakat.view'], { area: 'finance' }),
  role('treasurer-view', 'Treasurer (view only)', 'Oversight: sees Zakat, donations, funds and reports; changes nothing.', ['zakat.view', 'donations.view', 'finance.view', 'reports.view'], { area: 'finance' }),
  role('finance-team', 'Finance team', 'Donations, reconciliation, funds and refunds.', ['members.view', 'payments.record', 'payments.refund', 'donations.view', 'donations.reconcile', 'finance.view', 'finance.manage', 'fundraising.manage', 'reports.view'], { area: 'finance' }),
  // Communication, events, website, elections, other
  role('benefits-coordinator', 'Benefits coordinator', 'Partner businesses and member offers. Sees member IDs in the use log, never contact details.', ['benefits.manage'], { area: 'community' }),
  role('communication-manager', 'Communication manager', 'Messages, templates, groups and contact exports.', ['members.view', 'members.contact', 'groups.manage', 'comms.send', 'comms.settings'], { area: 'communication' }),
  role('event-manager', 'Event manager', 'Events, registrations and check-in.', ['events.manage', 'events.checkin'], { area: 'events' }),
  role('checkin-volunteer', 'Check-in volunteer', 'Checks people in at the door. Nothing else.', ['events.checkin'], { area: 'events' }),
  role('website-editor', 'Website editor', 'Website pages, news and giving. No member data.', ['content.publish'], { area: 'website' }),
  role('election-commission', 'Election Commission', 'Freezes and corrects the voter list; sees eligibility reports.', ['members.view', 'reports.view', 'voters.freeze', 'officials.manage'], { area: 'elections' }),
  role('viewer', 'Viewer', 'Can look at members and reports, cannot change anything or see contact details.', ['members.view', 'reports.view'], { area: 'general' }),
];

/** Older saved documents: built-in roles always follow the current definition; new built-in roles are added. */
export function upgradeAccess(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { roles?: unknown }).roles)) return raw;
  const d = raw as { roles: { id: string; builtIn?: boolean }[] };
  const custom = d.roles.filter((r) => !BUILT_IN_ROLES.some((b) => b.id === r.id));
  return { ...d, roles: [...BUILT_IN_ROLES, ...custom] };
}

export const ZONE_IDS = ['n', 'nw', 'sw', 's', 'se'] as const;
const ZIP5 = z.string().regex(/^\d{5}$/, 'A ZIP code has 5 digits.');
/** M2: one more role the same person holds somewhere else (role + where). The first role sits on the person itself. */
export const AssignmentSchema = z.object({
  roleId: z.string(),
  zones: z.array(z.enum(ZONE_IDS)).default([]),
  centers: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
  zips: z.array(ZIP5).max(60).default([]),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  givenBy: z.string().max(80).default(''),
  holderId: z.string().max(60).default(''),                                   // the elected/appointed seat this access comes from (Elected officials)
  reviewedOn: z.string().max(10).default(''),                                 // last access review (kept on purpose without a seat)
});
export type Assignment = z.infer<typeof AssignmentSchema>;
export const AdminSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  roleId: z.string(),
  zones: z.array(z.enum(ZONE_IDS)).default([]),
  centers: z.array(z.string().trim().min(2).max(80)).max(30).default([]),     // center names (org-structure) for center-limited roles
  zips: z.array(ZIP5).max(60).default([]),                                    // M2: ZIP codes for area-limited roles (inside the masjid)
  more: z.array(AssignmentSchema).max(10).default([]),                        // M2: other roles this person holds (e.g. AD of one masjid + Area Rep)
  memberId: z.string().max(20).default(''),                                    // M4: their own member record → "My membership" in the dashboard picker
  homeZip: z.union([ZIP5, z.literal('')]).default(''),                         // M5: the ZIP code they live in → their home masjid (everyone but an Owner has one)
  givenBy: z.string().max(80).default(''),
  holderId: z.string().max(60).default(''),                                   // main role's official seat (see Assignment.holderId)
  reviewedOn: z.string().max(10).default(''),
  status: z.enum(['invited', 'active', 'suspended']).default('invited'),
  twoStep: z.boolean().default(false),
  lastActive: z.string().optional(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),            // e.g. Election Commission until the results are certified
});
export type AdminUser = z.infer<typeof AdminSchema>;
/** M5: the ZIP code that places an admin in a masjid – their own, or the first ZIP of an area-limited role. */
export const homeZipOf = (a: Pick<AdminUser, 'homeZip' | 'zips'>) => a.homeZip || a.zips[0] || '';

const AccessObject = z.object({
  roles: z.array(RoleSchema).max(80),
  admins: z.array(AdminSchema).max(300),
  requireTwoStepFor: z.enum(['sensitive', 'everyone', 'none']).default('sensitive'),
}).superRefine((d, ctx) => {
  const bad = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  const roles = new Map(d.roles.map((r) => [r.id, r]));
  d.roles.forEach((r, i) => { if (d.roles.findIndex((x) => x.id === r.id) !== i) bad(['roles', i, 'id'], `Two roles use “${r.id}”.`); });
  const owner = roles.get('owner');
  if (!owner || ALL.some((p) => !owner.permissions.includes(p))) bad(['roles'], 'The Owner role must keep every permission.');
  const emails = new Set<string>();
  d.admins.forEach((a, i) => {
    const r = roles.get(a.roleId);
    if (!r) bad(['admins', i, 'roleId'], `There is no role “${a.roleId}”.`);
    if (emails.has(a.email)) bad(['admins', i, 'email'], `${a.email} is listed twice.`); emails.add(a.email);
    if (r?.zoneScoped && !a.zones.length) bad(['admins', i, 'zones'], `A ${r.name} needs at least one zone.`);
    if (r && !r.zoneScoped && a.zones.length) bad(['admins', i, 'zones'], 'Zones only apply to zone-limited roles.');
    if (r?.centerScoped && !a.centers.length) bad(['admins', i, 'centers'], `A ${r.name} needs at least one Islamic Center.`);
    if (r && !r.centerScoped && a.centers.length) bad(['admins', i, 'centers'], 'Centers only apply to center-limited roles.');
    if (r?.areaScoped && a.centers.length !== 1) bad(['admins', i, 'centers'], `A ${r.name} belongs to exactly one masjid.`);
    if (r?.areaScoped && !a.zips.length) bad(['admins', i, 'zips'], `A ${r.name} needs at least one ZIP code.`);
    if (r && !r.areaScoped && a.zips.length) bad(['admins', i, 'zips'], 'ZIP codes only apply to area roles.');
    a.more.forEach((x, k) => {
      const rr = roles.get(x.roleId);
      const at = ['admins', i, 'more', k];
      if (!rr) { bad([...at, 'roleId'], `There is no role “${x.roleId}”.`); return; }
      if (rr.zoneScoped && !x.zones.length) bad([...at, 'zones'], `A ${rr.name} needs at least one zone.`);
      if (rr.centerScoped && !x.centers.length) bad([...at, 'centers'], `A ${rr.name} needs a masjid.`);
      if (rr.areaScoped && (x.centers.length !== 1 || !x.zips.length)) bad([...at, 'zips'], `A ${rr.name} needs one masjid and its ZIP codes.`);
      if (rr.id === 'owner') bad([...at, 'roleId'], 'Owner is given as the main role only.');
      const same = [{ roleId: a.roleId, zones: a.zones, centers: a.centers }, ...a.more.slice(0, k)].some((y) => y.roleId === x.roleId && y.zones.join() === x.zones.join() && y.centers.join() === x.centers.join());
      if (same) bad([...at, 'roleId'], `${a.name} already has ${rr.name} there.`);
    });
    if (r && a.status === 'active' && d.requireTwoStepFor !== 'none' && !a.twoStep && (d.requireTwoStepFor === 'everyone' || r.permissions.some((p) => 'sensitive' in PERMISSIONS[p]))) {
      bad(['admins', i, 'twoStep'], `${a.name} has sensitive permissions (${r.name}) – two-step sign-in is required.`);
    }
  });
  if (!d.admins.some((a) => a.roleId === 'owner' && a.status === 'active')) bad(['admins'], 'Keep at least one active Owner – otherwise nobody can manage admins or billing.');
});
/** Parsing first brings older saved documents up to date (see upgradeAccess). */
export const AccessSchema = z.preprocess(upgradeAccess, AccessObject);
export type AccessDoc = z.infer<typeof AccessObject>;

/* ---------- M2: every role a person holds, and the one they are working in ---------- */
/** All assignments of a person – the main one first. */
export function assignmentsOf(a: AdminUser): Assignment[] {
  return [{ roleId: a.roleId, zones: a.zones, centers: a.centers, zips: a.zips ?? [], expiresOn: a.expiresOn, givenBy: a.givenBy ?? '', holderId: a.holderId ?? '', reviewedOn: a.reviewedOn ?? '' }, ...(a.more ?? [])];
}
/** The person as they act inside one assignment (dashboard). Every check below then works unchanged. */
export function actingIn(a: AdminUser, index: number): AdminUser {
  const list = assignmentsOf(a); const x = list[index] ?? list[0];
  return { ...a, roleId: x.roleId, zones: x.zones, centers: x.centers, zips: x.zips, expiresOn: x.expiresOn ?? a.expiresOn };
}
/** Plain words for where an assignment applies: “Organization”, “North Zone”, “Southwest Islamic Center 2”, “… · ZIP 77072, 77074”. */
export function whereOf(doc: AccessDoc, x: Pick<Assignment, 'roleId' | 'zones' | 'centers' | 'zips'>, zoneName: (id: string) => string = (id) => id.toUpperCase()) {
  const r = doc.roles.find((y) => y.id === x.roleId);
  if (!r) return '';
  if (r.areaScoped) return `${x.centers[0] ?? ''} · ZIP ${x.zips.join(', ')}`;
  if (r.centerScoped) return x.centers.join(', ');
  if (r.zoneScoped) return x.zones.map(zoneName).join(', ');
  return 'Whole organization';
}
/**
 * Who may give a role to whom (RBAC: never more than you have). Organization admins (admins.manage, not center-limited)
 * may give any role. A masjid leader with team.manage may give masjid roles only, only in their own masjid, and only
 * roles whose permissions they hold themselves. '' = allowed.
 */
export function cannotAssign(doc: AccessDoc, giver: AdminUser | null | undefined, x: Pick<Assignment, 'roleId' | 'centers' | 'zones' | 'zips'>, today?: string): string {
  const r = doc.roles.find((y) => y.id === x.roleId); const gr = roleOf(doc, giver);
  if (!giver || !gr || !r) return 'Unknown role.';
  if (can(doc, giver, 'admins.manage', today) && !gr.centerScoped && !gr.zoneScoped) return r.id === 'owner' && gr.id !== 'owner' ? 'Only an Owner can make another Owner.' : '';
  if (!can(doc, giver, 'team.manage', today)) return 'You cannot give roles.';
  if (!r.centerScoped) return `${r.name} covers more than one masjid – ask the organization admin.`;
  if (r.permissions.includes('team.manage')) return `Only the organization admin gives the ${r.name} role.`;
  if (!x.centers.length || x.centers.some((c) => !giver.centers.includes(c))) return 'Only for your own masjid.';
  const extra = r.permissions.filter((p) => !gr.permissions.includes(p));
  if (extra.length) return `${r.name} can do things you cannot (${extra.map((p) => PERMISSIONS[p].label.toLowerCase()).slice(0, 2).join(', ')}).`;
  return '';
}

/**
 * What a masjid leader (team.manage, no admins.manage) changed in the admin list – each added or removed role must pass
 * cannotAssign; roles and organization settings stay as they are. '' = allowed. The server runs the same check.
 */
export function teamChangeProblem(before: AccessDoc, after: AccessDoc, giver: AdminUser, today?: string): string {
  if (JSON.stringify(before.roles) !== JSON.stringify(after.roles)) return 'Only the organization admin can change roles.';
  if (before.requireTwoStepFor !== after.requireTwoStepFor) return 'Only the organization admin can change sign-in rules.';
  const key = (x: Assignment) => `${x.roleId}|${x.zones.join()}|${x.centers.join()}|${x.zips.join()}`;
  const ids = new Set([...before.admins.map((a) => a.id), ...after.admins.map((a) => a.id)]);
  for (const id of ids) {
    const b = before.admins.find((a) => a.id === id); const a = after.admins.find((x) => x.id === id);
    const bl = b ? assignmentsOf(b) : []; const al = a ? assignmentsOf(a) : [];
    const added = al.filter((x) => !bl.some((y) => key(y) === key(x))); const removed = bl.filter((x) => !al.some((y) => key(y) === key(x)));
    for (const x of [...added, ...removed]) { const why = cannotAssign(before, giver, x, today); if (why) return `${(a ?? b)!.name}: ${why}`; }
    const { more: _m1, roleId: _r1, zones: _z1, centers: _c1, zips: _p1, givenBy: _g1, ...restB } = b ?? ({} as AdminUser);
    const { more: _m2, roleId: _r2, zones: _z2, centers: _c2, zips: _p2, givenBy: _g2, ...restA } = a ?? ({} as AdminUser);
    if (b && a && JSON.stringify(restB) !== JSON.stringify(restA)) { const why = bl.map((x) => cannotAssign(before, giver, x, today)).find(Boolean); if (why) return `${a.name} also works outside your masjid – ask the organization admin.`; }
  }
  return '';
}

/* ---------- questions every screen and endpoint asks ---------- */
export const roleOf = (doc: AccessDoc, a: AdminUser | null | undefined) => (a ? doc.roles.find((r) => r.id === a.roleId) : undefined);
export function can(doc: AccessDoc, a: AdminUser | null | undefined, p: Permission, today?: string): boolean {
  if (!a || a.status !== 'active') return false;
  if (a.expiresOn && today && today > a.expiresOn) return false;
  return !!roleOf(doc, a)?.permissions.includes(p);
}
/** Zone-limited roles see only their zones, center-limited roles only their centers; everyone else sees all. */
export const inScope = (doc: AccessDoc, a: AdminUser | null | undefined, memberZone: string, memberCenter?: string, memberZip?: string) => {
  const r = roleOf(doc, a);
  if (!a || !r) return false;
  if (r.areaScoped) return !!memberCenter && a.centers.includes(memberCenter) && !!memberZip && (a.zips ?? []).includes(memberZip.slice(0, 5));
  if (r.centerScoped) return !!memberCenter && a.centers.includes(memberCenter);
  return !r.zoneScoped || a.zones.includes(memberZone as (typeof ZONE_IDS)[number]);
};
/** The admin's Zakat approval level (0 = none). The dollar limit per level is in Zakat settings (F2). */
export const zakatLevelOf = (doc: AccessDoc, a: AdminUser | null | undefined, today?: string) => (can(doc, a, 'zakat.approve', today) ? roleOf(doc, a)?.zakatLevel ?? 0 : 0);
/** Modules a role opens (for the role summary). */
export const modulesOf = (r: Role) => MODULES.filter((m) => r.permissions.some((p) => PERMISSIONS[p].group === m));
/** Which permission publishes which admin document (the store API checks it). */
export function permissionForDoc(key: string): Permission {
  if (['site-config', 'home', 'pages', 'news', 'themes', 'giving'].includes(key)) return 'content.publish';
  if (key === 'events') return 'events.manage';
  if (key === 'groups') return 'groups.manage';
  if (key === 'communication') return 'comms.settings';
  if (key === 'admin-access') return 'admins.manage'; // masjid leaders change their own working body through the team API (cannotAssign)
  if (key === 'integrations') return 'integrations.manage';
  if (key === 'org-structure') return 'centers.manage';
  if (key === 'zakat-settings') return 'zakat.settings';
  if (key === 'donation-settings') return 'finance.manage';
  if (key === 'benefits') return 'benefits.manage';
  if (key === 'officials') return 'officials.manage';
  if (key === 'prayer-times') return 'center.content';
  if (key === 'finance-settings') return 'finance.manage';
  if (key === 'fundraising') return 'fundraising.manage';
  return 'settings.manage'; // membership-settings, join-form, org-config
}
/** Which permission opens which admin screen (menu + page guard). */
export function permissionForPath(path: string): Permission | null {
  const p = path.split('?')[0];
  // whole path segments only: '/membership' is not '/members', '/teams' is not '/team'
  const at = (base: string) => p === base || p.startsWith(base + '/');
  if (at('/membership')) return 'settings.manage';
  if (p === '/masjids/dashboard' || at('/elections')) return 'members.view'; // dashboards: numbers are filtered to the role's area
  if (at('/masjids')) return 'admins.manage';
  if (p.startsWith('/reports')) return path.includes('tab=voters') ? 'members.view' : 'reports.view';
  if (at('/members') || at('/families') || at('/queues')) return 'members.view';
  if (p.startsWith('/zakat')) return 'zakat.view';
  if (p.startsWith('/donations')) return 'donations.view';
  if (p.startsWith('/benefits')) return 'benefits.manage';
  if (p.startsWith('/officials')) return 'members.view';
  if (p.startsWith('/prayer-times') || p.startsWith('/minutes')) return 'members.view';
  if (p.startsWith('/finance')) return 'finance.view';
  if (p.startsWith('/fundraising')) return 'donations.view'; // leaders see them; changes need center.content // everyone who sees members sees who serves; changes need officials.manage
  if (p.startsWith('/zones')) return 'members.view'; // everyone who sees members sees the map; publishing needs settings.manage
  if (p.startsWith('/groups')) return 'groups.manage';
  if (p.startsWith('/events')) return 'events.checkin';
  if (p.startsWith('/communication')) return 'comms.send';
  if (p.startsWith('/website') || p.startsWith('/appearance')) return p.startsWith('/appearance') ? null : 'content.publish';
  if (p.startsWith('/settings/admins') || p.startsWith('/settings/audit')) return 'admins.manage';
  if (p.startsWith('/team')) return 'team.manage';
  if (p.startsWith('/settings/integrations')) return 'integrations.manage';
  if (p.startsWith('/membership') || p.startsWith('/settings')) return 'settings.manage';
  return null;
}
/** Warnings that are allowed but worth a second look. */
export function accessWarnings(doc: AccessDoc, today: string, masjids: string[] = []): string[] {
  const w: string[] = [];
  // M2: every masjid needs someone in the system to run it
  const led = new Set(doc.admins.filter((a) => a.status === 'active').flatMap((a) => assignmentsOf(a).filter((x) => x.roleId === 'associate-director').flatMap((x) => x.centers)));
  const noLead = masjids.filter((m) => !led.has(m));
  if (noLead.length === 1) w.push(`${noLead[0]} has no Associate Director with access – nobody runs it in the system.`);
  else if (noLead.length > 1) w.push(`${noLead.length} masjids have no Associate Director with access (${noLead.slice(0, 3).join(', ')}${noLead.length > 3 ? ' …' : ''}).`);
  const active = doc.admins.filter((a) => a.status === 'active');
  const holders = (p: Permission) => active.filter((a) => can(doc, a, p, today));
  // the Election Commission should run the voter list – Owners and Admins technically can, but should not be the only ones
  const ec = holders('voters.freeze').filter((a) => !['owner', 'admin'].includes(a.roleId));
  if (ec.length === 1) w.push('Only one Election Commission member can freeze the voter list – add a second so nobody acts alone.');
  if (ec.length === 0) w.push('No Election Commission member can freeze the voter list. Add them before the record date.');
  const both = active.filter((a) => can(doc, a, 'payments.record', today) && can(doc, a, 'payments.refund', today) && roleOf(doc, a)?.id !== 'owner');
  if (both.length) w.push(`${both.map((a) => a.name).join(', ')} can both record and refund payments – fine for a treasurer, but have someone else review refunds.`);
  // Zakat: approvals must be able to finish and be paid
  const approvers = holders('zakat.approve').filter((a) => !['owner', 'admin'].includes(a.roleId));
  if (approvers.length && !holders('zakat.disburse').some((a) => !['owner', 'admin'].includes(a.roleId))) w.push('Zakat cases can be approved, but nobody outside Owner and Admin can pay them out – add the Zakat Operations Office.');
  const levels = new Set(approvers.map((a) => roleOf(doc, a)?.zakatLevel ?? 0));
  if (approvers.length && !levels.has(3) && !holders('zakat.override').some((a) => !['owner', 'admin'].includes(a.roleId))) w.push('No Zakat Committee Chair: cases above the Level 2 limit cannot be approved.');
  const selfPay = active.filter((a) => !['owner', 'admin'].includes(a.roleId) && can(doc, a, 'zakat.approve', today) && can(doc, a, 'zakat.disburse', today));
  if (selfPay.length) w.push(`${selfPay.map((a) => a.name).join(', ')} can both approve and pay out Zakat – keep these with different people.`);
  const owners = active.filter((a) => a.roleId === 'owner');
  // M5: everyone belongs to a masjid through a ZIP code; only the Owners (the organization's super admins) may be without one
  const noHome = active.filter((a) => a.roleId !== 'owner' && !homeZipOf(a));
  if (noHome.length) w.push(`No home ZIP code: ${noHome.slice(0, 4).map((a) => a.name).join(', ')}${noHome.length > 4 ? ` and ${noHome.length - 4} more` : ''}. Everyone except an Owner belongs to a masjid – add the ZIP code they live in.`);
  if (owners.length > 2) w.push(`${owners.length} Owners. Owners can close the account – keep it to one or two.`);
  for (const a of active) if (a.expiresOn && a.expiresOn < today) w.push(`${a.name}’s access ended on ${a.expiresOn.slice(5, 7)}/${a.expiresOn.slice(8)}/${a.expiresOn.slice(0, 4)} – suspend or extend it.`);
  const stale = active.filter((a) => a.lastActive && Date.parse(`${today}T12:00:00Z`) - Date.parse(`${a.lastActive}T12:00:00Z`) > 180 * 86_400_000);
  if (stale.length) w.push(`Not used for 6 months: ${stale.map((a) => a.name).join(', ')}. Suspend accounts nobody uses.`);
  return w;
}

/* ---------- demo data ---------- */
export const mockAccess: AccessDoc = AccessObject.parse({
  requireTwoStepFor: 'sensitive',
  roles: BUILT_IN_ROLES,
  admins: [
    { id: 'akhter', name: 'Akhter Alam', email: 'akhter@nextgrow.pro', roleId: 'owner', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-15' },
    { id: 'membership-office', homeZip: '77036', name: 'Membership office', email: 'membership@isgh.org', roleId: 'membership-officer', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-14' },
    { id: 'treasurer', homeZip: '77036', name: 'ISGH Treasurer', email: 'treasurer@isgh.org', roleId: 'treasurer', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-10', holderId: 'treasurer' },
    { id: 'board-secretary', homeZip: '77014', name: 'Board secretary', email: 'board@isgh.org', roleId: 'board-member', zones: [], centers: [], status: 'active', twoStep: false, lastActive: '2026-10-08' },
    { id: 'ec-chair', homeZip: '77072', name: 'Election Commission chair', email: 'ecisgh@example.org', roleId: 'election-commission', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-12', expiresOn: '2026-12-31' },
    { id: 'ec-member', homeZip: '77040', name: 'Election Commission member', email: 'ec2@example.org', roleId: 'election-commission', zones: [], centers: [], status: 'invited', twoStep: false, expiresOn: '2026-12-31' },
    { id: 'sw-director', homeZip: '77074', name: 'Southwest zone director', email: 'sw.director@isgh.org', roleId: 'zone-director', zones: ['sw'], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-11', holderId: 'zd-sw',
      more: [{ roleId: 'associate-director', zones: [], centers: ['Southwest Islamic Center 1'], zips: [], givenBy: 'Akhter Alam' }] },
    { id: 'web-editor', homeZip: '77036', name: 'Website editor', email: 'web@isgh.org', roleId: 'website-editor', zones: [], centers: [], status: 'active', twoStep: false, lastActive: '2026-09-30' },
    { id: 'katy-door', homeZip: '77449', name: 'Katy check-in desk', email: 'katy.events@isgh.org', roleId: 'checkin-volunteer', zones: [], centers: [], status: 'active', twoStep: false, lastActive: '2026-03-02' },
    { id: 'zakat-chair', homeZip: '77036', name: 'Zakat Committee Chair', email: 'zakat.chair@isgh.org', roleId: 'zakat-chair', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-14' },
    { id: 'zakat-ccm', homeZip: '77081', name: 'Central Committee Member', email: 'zakat.committee@isgh.org', roleId: 'zakat-committee-member', zones: [], centers: [], status: 'active', twoStep: false, lastActive: '2026-10-13' },
    { id: 'lzc-north', homeZip: '77014', name: 'North zakat coordinator', email: 'zakat.north@isgh.org', roleId: 'zakat-coordinator', zones: [], centers: ['North Islamic Center 1'], status: 'active', twoStep: false, lastActive: '2026-10-15' },
    { id: 'zakat-ops', homeZip: '77036', name: 'Zakat Operations Office', email: 'zakat.ops@isgh.org', roleId: 'zakat-operations', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-14' },
    { id: 'front-office', homeZip: '77036', name: 'Front office', email: 'office@isgh.org', roleId: 'office-admin', zones: [], centers: [], status: 'active', twoStep: false, lastActive: '2026-10-15' },
    { id: 'ad-sw2', homeZip: '77072', name: 'Southwest Center 2 associate director', email: 'ad.sw2@isgh.org', roleId: 'associate-director', zones: [], centers: ['Southwest Islamic Center 2'], status: 'active', twoStep: true, lastActive: '2026-10-12' },
    { id: 'center-admin-n1', homeZip: '77014', name: 'North Center 1 office', email: 'north1.office@isgh.org', roleId: 'center-admin', zones: [], centers: ['North Islamic Center 1'], status: 'active', twoStep: true, lastActive: '2026-10-15' },
    { id: 'benefits', homeZip: '77478', name: 'Benefits coordinator', email: 'benefits@isgh.org', roleId: 'benefits-coordinator', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-14' },
    // M2 demo: the Executive Board and one full masjid working body (Southeast Islamic Center 1). Placeholder names only.
    { id: 'president', homeZip: '77036', name: 'President (demo)', email: 'president@example.org', roleId: 'president', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-15' },
    { id: 'gen-secretary', homeZip: '77479', name: 'General Secretary (demo)', email: 'gensec@example.org', roleId: 'general-secretary', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-13' },
    { id: 'ad-se1', homeZip: '77502', name: 'Yasir Karim (demo)', email: 'ad.se1@example.org', roleId: 'associate-director', zones: [], centers: ['Southeast Islamic Center 1'], status: 'active', twoStep: true, lastActive: '2026-10-15', memberId: 'HOU-DEMO-AD',
      more: [{ roleId: 'area-representative', zones: [], centers: ['Southeast Islamic Center 1'], zips: ['77062'], givenBy: 'Akhter Alam' }] },
    { id: 'ms-se1', homeZip: '77502', name: 'Southeast Center 1 membership secretary', email: 'members.se1@example.org', roleId: 'membership-secretary', zones: [], centers: ['Southeast Islamic Center 1'], status: 'active', twoStep: true, lastActive: '2026-10-14', givenBy: 'Yasir Karim (demo)' },
    { id: 'fs-se1', homeZip: '77062', name: 'Southeast Center 1 finance secretary', email: 'finance.se1@example.org', roleId: 'finance-secretary', zones: [], centers: ['Southeast Islamic Center 1'], status: 'active', twoStep: false, lastActive: '2026-10-12', givenBy: 'Yasir Karim (demo)' },
    { id: 'ar-se1', name: 'Area representative 77502', email: 'area.77502@example.org', roleId: 'area-representative', zones: [], centers: ['Southeast Islamic Center 1'], zips: ['77502'], status: 'active', twoStep: true, lastActive: '2026-10-10', givenBy: 'Yasir Karim (demo)' },
    // an Associate Director whose term ended in January – the access was never taken away (Officials ↔ access finds it)
    { id: 'ad-se2', homeZip: '77504', name: 'Ahmed Jaffer (demo)', email: 'ad.se2@example.org', roleId: 'associate-director', zones: [], centers: ['Southeast Islamic Center 2'], status: 'active', twoStep: true, lastActive: '2026-02-02', holderId: 'ad-se-2' },
    { id: 'comms', homeZip: '77036', name: 'Communication manager', email: 'comms@isgh.org', roleId: 'communication-manager', zones: [], centers: [], status: 'active', twoStep: true, lastActive: '2026-10-14' },
  ],
});
