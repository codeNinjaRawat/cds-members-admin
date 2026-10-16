/**
 * PLATFORM CONTRACT (SaaS) – one source of truth for the SaaS panel, the org admin and the website.
 * Source: saas/src/lib/platform/platform.ts → copied to web/ and admin/ by `npm run platform:sync` (in saas/).
 *
 *   Organization (tenant) = one customer: its own website, admin, members, plans and Bylaws settings.
 *   SaaS plan            = what the organization pays the platform (limits + modules).
 *   Module               = a part of the product an org can use (switched by plan, add-ons and beta rollouts).
 *
 * Pure code only (zod + functions): safe on the server and in the browser. DEMO data lives here too.
 * BE phase: the same shapes become /platform/* endpoints (tables: tenants, saas_plans, tenant_admins, …).
 */
import { z } from 'zod';

/* ---------------- modules ---------------- */
export const MODULES = ['website', 'membership', 'members', 'giving', 'events', 'joinForm', 'queues', 'families', 'idScan', 'sms', 'reports', 'elections', 'customDomain', 'api'] as const;
export type Module = (typeof MODULES)[number];
/** Always on – an organization cannot run without them. */
export const CORE_MODULES: Module[] = ['website', 'membership', 'members'];
export const MODULE_INFO: Record<Module, { label: string; help: string }> = {
  website: { label: 'Website and pages', help: 'Public website, menus, news, announcement bar, theme.' },
  membership: { label: 'Membership plans and rules', help: 'Plans, dues, voting rules, pledge and consents.' },
  members: { label: 'Members', help: 'Member list, Member 360°, exports.' },
  giving: { label: 'Giving', help: 'Donate pages, impact stories, needs.' },
  events: { label: 'Events', help: 'Events with registration types, guests, waitlist, reminders; member- and group-only events.' },
  joinForm: { label: 'Join form builder', help: 'Own questions, steps and show-only-if rules on the sign-up form.' },
  queues: { label: 'Work queues', help: 'Applications, photo ID checks, center changes, duplicates, payments.' },
  families: { label: 'Family trees', help: 'Households and relatives on the member portal and in the admin.' },
  idScan: { label: 'Photo ID scan', help: 'Members scan their ID to fill the sign-up form.' },
  sms: { label: 'Text messages (SMS)', help: 'Reminders and codes by text; monthly credits by plan.' },
  reports: { label: 'Reports', help: 'Reports and the voter list snapshot.' },
  elections: { label: 'Elections', help: 'Record date, eligibility, voter list, election commission tools.' },
  customDomain: { label: 'Own domain', help: 'Use the organization’s own address, like members.example.org.' },
  api: { label: 'API access', help: 'Connect other systems with keys.' },
};

/* ---------------- SaaS plans ---------------- */
const cents = z.number().int().min(0).max(10_000_000);
export const SaasPlanSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,30}$/, 'Use lowercase letters, numbers and dashes'),
  name: z.string().min(1).max(40),
  tagline: z.string().max(120).default(''),
  priceMonthly: cents,           // cents per month
  priceAnnual: cents,            // cents per year
  limits: z.object({
    members: z.number().int().min(0).max(1_000_000),   // 0 = no limit
    centers: z.number().int().min(0).max(1000),
    admins: z.number().int().min(0).max(1000),
    sms: z.number().int().min(0).max(1_000_000),        // texts per month
  }),
  modules: z.array(z.enum(MODULES)),
  highlight: z.boolean().default(false),
  hidden: z.boolean().default(false),               // kept for existing orgs, not offered to new ones
});
export const PlansDocSchema = z.object({
  trialDays: z.number().int().min(0).max(90),
  annualNote: z.string().max(80).default(''),
  plans: z.array(SaasPlanSchema).min(1).max(8),
}).superRefine((d, ctx) => {
  const seen = new Set<string>();
  d.plans.forEach((p, i) => {
    if (seen.has(p.id)) ctx.addIssue({ code: 'custom', path: ['plans', i, 'id'], message: `Two plans use the id “${p.id}”.` });
    seen.add(p.id);
    if (p.priceAnnual > p.priceMonthly * 12) ctx.addIssue({ code: 'custom', path: ['plans', i, 'priceAnnual'], message: 'The yearly price should not be more than 12 monthly payments.' });
  });
});
export type SaasPlan = z.infer<typeof SaasPlanSchema>;
export type PlansDoc = z.infer<typeof PlansDocSchema>;

/* ---------------- organizations (tenants) ---------------- */
export const ORG_TYPES = ['society', 'masjid', 'association', 'school'] as const;
export const ORG_TYPE_LABEL: Record<(typeof ORG_TYPES)[number], string> = { society: 'Islamic society (several centers)', masjid: 'Masjid or Islamic center', association: 'Community association', school: 'School or academy' };
export const STATUSES = ['trial', 'active', 'past_due', 'suspended', 'cancelled'] as const;
export type TenantStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<TenantStatus, string> = { trial: 'Trial', active: 'Active', past_due: 'Payment failed', suspended: 'Suspended', cancelled: 'Cancelled' };
export const TEMPLATES = ['bylaws-society', 'simple-masjid', 'blank'] as const;
export type Template = (typeof TEMPLATES)[number];
export const TEMPLATE_INFO: Record<Template, { label: string; help: string }> = {
  'bylaws-society': { label: 'Society with Bylaws', help: 'Zones and centers, voting record date, Board approval – like ISGH.' },
  'simple-masjid': { label: 'Single masjid', help: 'One center, simple yearly dues, no elections.' },
  blank: { label: 'Start empty', help: 'Only the basics. Set everything up in the admin.' },
};
export const ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_INFO: Record<Role, { label: string; help: string }> = {
  owner: { label: 'Owner', help: 'Everything, including billing and closing the account. One per organization.' },
  admin: { label: 'Admin', help: 'Everything except billing and closing the account.' },
  editor: { label: 'Editor', help: 'Website content, giving and news. No member data.' },
  viewer: { label: 'Viewer', help: 'Can look, cannot change anything.' },
};

export const AdminUserSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  email: z.string().email(),
  role: z.enum(ROLES),
  status: z.enum(['invited', 'active', 'revoked']),
  invitedOn: z.string(),
  lastActiveOn: z.string().optional(),
  token: z.string().optional(),        // invite token (demo); cleared when accepted
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const DomainSchema = z.object({
  host: z.string().regex(/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, 'Use a domain like members.example.org'),
  status: z.enum(['pending', 'verified', 'failed']),
  token: z.string(),
  addedOn: z.string(),
  checkedOn: z.string().optional(),
});
export type Domain = z.infer<typeof DomainSchema>;

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
export const RESERVED_SLUGS = ['www', 'admin', 'api', 'app', 'saas', 'platform', 'mail', 'help', 'support', 'status', 'member-web', 'member-admin', 'docs', 'blog', 'static', 'cdn', 'assets', 'billing', 'login', 'auth', 'nextgrow', 'localhost'];

export const TenantSchema = z.object({
  slug: z.string().regex(SLUG_RE),
  clientNo: z.number().int().min(1).optional(),   // customer number on the platform – ISGH is 1, the founding client
  name: z.string().min(2).max(100),
  shortName: z.string().min(2).max(20),
  type: z.enum(ORG_TYPES),
  city: z.string().min(1).max(60),
  state: z.string().regex(/^[A-Z]{2}$/),
  address: z.string().max(120).default(''),
  phone: z.string().max(30).default(''),
  email: z.string().email(),
  timezone: z.string().default('America/Chicago'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0E5A45'),
  status: z.enum(STATUSES),
  planId: z.string(),
  cycle: z.enum(['monthly', 'annual']),
  trialEndsOn: z.string().optional(),
  createdOn: z.string(),
  cancelledOn: z.string().optional(),
  template: z.enum(TEMPLATES),
  modules: z.record(z.enum(MODULES), z.enum(['on', 'off'])).default({}),   // add-ons / switched off for this org
  admins: z.array(AdminUserSchema),
  customDomain: DomainSchema.optional(),
  hosts: z.object({ web: z.string().optional(), admin: z.string().optional() }).optional(), // older addresses kept working
  usage: z.object({ members: z.number().int().min(0), centers: z.number().int().min(0), sms: z.number().int().min(0) }),
  suspendedReason: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
  sample: z.boolean().default(false),
});
export type Tenant = z.infer<typeof TenantSchema>;
/** ISGH is the founding client of the platform: always present, client no. 1, cannot be cancelled. */
export const FOUNDING_SLUG = 'isgh';
export const isFounding = (t: Pick<Tenant, 'slug'>) => t.slug === FOUNDING_SLUG;
export const clientLabel = (t: Pick<Tenant, 'slug' | 'clientNo'>) => (isFounding(t) ? 'Client #1 · Founding client' : t.clientNo ? `Client #${t.clientNo}` : '');
export const nextClientNo = (list: Pick<Tenant, 'clientNo'>[]) => Math.max(1, ...list.map((t) => t.clientNo ?? 0)) + 1;

/** What the "New organization" wizard sends. */
export const NewOrgSchema = z.object({
  name: z.string().trim().min(2, 'Enter the organization’s name').max(100),
  shortName: z.string().trim().min(2, 'Enter a short name, like ISGH').max(20),
  type: z.enum(ORG_TYPES),
  city: z.string().trim().min(1, 'Enter the city').max(60),
  state: z.string().trim().regex(/^[A-Z]{2}$/, 'Use the two-letter state, like TX'),
  address: z.string().trim().max(120).default(''),
  phone: z.string().trim().max(30).default(''),
  email: z.string().trim().email('Enter the organization’s email, like office@example.org'),
  slug: z.string().trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#0E5A45'),
  template: z.enum(TEMPLATES),
  planId: z.string().min(1),
  cycle: z.enum(['monthly', 'annual']),
  trial: z.boolean(),
  owner: z.object({ name: z.string().trim().min(2, 'Enter the owner’s full name').max(80), email: z.string().trim().email('Enter the owner’s email') }),
  modules: z.record(z.enum(MODULES), z.enum(['on', 'off'])).default({}),
}).superRefine((d, ctx) => { const m = slugProblem(d.slug); if (m) ctx.addIssue({ code: 'custom', path: ['slug'], message: m }); });
export type NewOrg = z.infer<typeof NewOrgSchema>;

/* ---------------- flags, announcements, support, audit, settings ---------------- */
export const FlagSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{2,40}$/),
  label: z.string().min(1).max(60),
  help: z.string().max(200).default(''),
  module: z.enum(MODULES).optional(),          // beta module: only orgs in the rollout get it
  rollout: z.enum(['off', 'some', 'all']),
  tenants: z.array(z.string()).default([]),
});
export const FlagsDocSchema = z.object({ flags: z.array(FlagSchema) });
export type Flag = z.infer<typeof FlagSchema>;

export const AnnouncementSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  title: z.string().min(1).max(80),
  body: z.string().max(300).default(''),
  tone: z.enum(['info', 'success', 'warning']),
  audience: z.enum(['all', 'plans', 'orgs']),
  ids: z.array(z.string()).default([]),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean(),
}).refine((a) => a.endsOn >= a.startsOn, { path: ['endsOn'], message: 'The end date must be on or after the start date.' });
export const AnnouncementsDocSchema = z.object({ items: z.array(AnnouncementSchema).max(30) });
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const SupportSessionSchema = z.object({
  id: z.string(), slug: z.string(), by: z.string(), reason: z.string().min(10).max(300),
  mode: z.enum(['read-only', 'full']), startedAt: z.string(), endsAt: z.string(), endedAt: z.string().optional(),
});
export type SupportSession = z.infer<typeof SupportSessionSchema>;

export type AuditEntry = { id: string; at: string; by: string; action: string; target?: string; detail: string };

export const PlatformSettingsSchema = z.object({
  productName: z.string().min(2).max(40),
  baseDomain: z.string().regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, 'Like nextgrow.pro'),
  supportEmail: z.string().email(),
  supportHours: z.number().int().min(1).max(24),          // how long a support sign-in lasts
  defaultTemplate: z.enum(TEMPLATES),
  requireReason: z.boolean(),
});
export type PlatformSettings = z.infer<typeof PlatformSettingsSchema>;

export const STAFF_ROLES = ['owner', 'support', 'billing', 'readonly'] as const;
export const STAFF_ROLE_INFO: Record<(typeof STAFF_ROLES)[number], { label: string; help: string }> = {
  owner: { label: 'Platform owner', help: 'Everything: organizations, plans, prices, team, settings.' },
  support: { label: 'Support', help: 'Organizations, support sign-ins, announcements. No prices or team.' },
  billing: { label: 'Billing', help: 'Invoices, plans on organizations, payment problems.' },
  readonly: { label: 'Read only', help: 'Can look at everything, cannot change anything.' },
};
export const StaffSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  role: z.enum(STAFF_ROLES),
  twoFactor: z.boolean(),
  active: z.boolean(),
});
export const TeamDocSchema = z.object({ staff: z.array(StaffSchema).min(1).max(50) }).refine((d) => d.staff.some((x) => x.role === 'owner' && x.active), { path: ['staff'], message: 'Keep at least one active platform owner.' });
export type Staff = z.infer<typeof StaffSchema>;

/* ---------------- defaults (demo) ---------------- */
export const defaultTeam: { staff: Staff[] } = { staff: [
  { id: 'akhter', name: 'Akhter Alam', email: 'akhter@nextgrow.pro', role: 'owner', twoFactor: true, active: true },
  { id: 'support-desk', name: 'Support desk', email: 'support@nextgrow.pro', role: 'support', twoFactor: true, active: true },
  { id: 'accounts', name: 'Accounts', email: 'billing@nextgrow.pro', role: 'billing', twoFactor: false, active: true },
] };
export const defaultSettings: PlatformSettings = {
  productName: 'NextGrow Members', baseDomain: 'nextgrow.pro', supportEmail: 'support@nextgrow.pro', supportHours: 2, defaultTemplate: 'bylaws-society', requireReason: true,
};

export const defaultPlans: PlansDoc = {
  trialDays: 30,
  annualNote: 'Pay yearly, get 2 months free',
  plans: [
    { id: 'starter', name: 'Starter', tagline: 'One masjid getting online', priceMonthly: 4900, priceAnnual: 49000, limits: { members: 500, centers: 1, admins: 3, sms: 0 }, modules: ['website', 'membership', 'members', 'giving', 'events'], highlight: false, hidden: false },
    { id: 'growth', name: 'Growth', tagline: 'Busy communities with several programs', priceMonthly: 14900, priceAnnual: 149000, limits: { members: 5000, centers: 10, admins: 10, sms: 2000 }, modules: ['website', 'membership', 'members', 'giving', 'events', 'joinForm', 'queues', 'families', 'idScan', 'sms', 'reports'], highlight: true, hidden: false },
    { id: 'network', name: 'Network', tagline: 'Societies with many centers and elections', priceMonthly: 39900, priceAnnual: 399000, limits: { members: 0, centers: 0, admins: 25, sms: 10000 }, modules: [...MODULES], highlight: false, hidden: false },
  ],
};

export const defaultFlags: { flags: Flag[] } = {
  flags: [
    { key: 'family-trees', label: 'Family trees', help: 'New in October 2026. Turned on for everyone after the ISGH pilot.', module: 'families', rollout: 'all', tenants: [] },
    { key: 'id-scan', label: 'Photo ID scan on sign-up', help: 'Beta – reads the ID on the phone. Pilot orgs only.', module: 'idScan', rollout: 'some', tenants: ['isgh', 'bayou-city'] },
    { key: 'elections', label: 'Elections tools', help: 'Beta – voter list, record date checks.', module: 'elections', rollout: 'some', tenants: ['isgh', 'crescent-valley'] },
    { key: 'command-center', label: 'Command center dashboard', help: 'The newer overview layout in the org admin.', rollout: 'all', tenants: [] },
  ],
};

export const defaultAnnouncements: { items: Announcement[] } = {
  items: [
    { id: 'renewal-season', title: 'Renewal season starts November 1', body: 'Check your 2027 dues and reminder text before members start paying.', tone: 'info', audience: 'all', ids: [], startsOn: '2026-10-01', endsOn: '2026-11-15', active: true },
    { id: 'maintenance-oct', title: 'Short maintenance on Sunday, October 25', body: 'From 2:00 to 2:30 AM Central the admin is read-only. The website stays up.', tone: 'warning', audience: 'all', ids: [], startsOn: '2026-10-18', endsOn: '2026-10-25', active: true },
  ],
};

/** Demo organizations. ISGH is real (the first customer); the others are made-up samples, marked `sample`. */
export function demoTenants(): Tenant[] {
  const a = (id: string, name: string, email: string, role: Role, status: AdminUser['status'], invitedOn: string, lastActiveOn?: string): AdminUser => ({ id, name, email, role, status, invitedOn, lastActiveOn, token: status === 'invited' ? `inv-${id}` : undefined });
  const base = { timezone: 'America/Chicago', modules: {}, address: '', phone: '', notes: undefined };
  const s = (t: Omit<Tenant, 'timezone' | 'modules' | 'address' | 'phone' | 'sample'> & Partial<Tenant>): Tenant => ({ ...base, sample: true, ...t } as Tenant);
  const list: Tenant[] = [
    { ...base, slug: 'isgh', clientNo: 1, name: 'Islamic Society of Greater Houston', shortName: 'ISGH', type: 'society', city: 'Houston', state: 'TX', address: '3110 Eastside St, Houston, TX 77098', phone: '(713) 524-6615', email: 'membership@isgh.org', color: '#0E5A45', status: 'active', planId: 'network', cycle: 'annual', createdOn: '2026-09-01', template: 'bylaws-society', sample: false,
      hosts: { web: 'member-web.nextgrow.pro', admin: 'member-admin.nextgrow.pro' }, usage: { members: 4812, centers: 22, sms: 3120 },
      admins: [a('u-aa', 'Akhter Alam', 'akhter@isgh.org', 'owner', 'active', '2026-09-01', '2026-10-15'), a('u-sk', 'Sara Khan', 'sara.k@isgh.org', 'admin', 'active', '2026-09-03', '2026-10-14'), a('u-om', 'Omar Malik', 'omar.m@isgh.org', 'editor', 'invited', '2026-10-12')] },
    s({ slug: 'bayou-city', name: 'Bayou City Muslim Association', shortName: 'BCMA', type: 'association', city: 'Houston', state: 'TX', email: 'office@bayoucity.example', color: '#1F4FA3', status: 'active', planId: 'growth', cycle: 'monthly', createdOn: '2025-11-12', template: 'bylaws-society', usage: { members: 1210, centers: 4, sms: 640 },
      admins: [a('u-b1', 'Hamza Siddiqui', 'hamza@bayoucity.example', 'owner', 'active', '2025-11-12', '2026-10-13')] }),
    s({ slug: 'lakeside', name: 'Lakeside Islamic Center', shortName: 'LIC', type: 'masjid', city: 'Austin', state: 'TX', email: 'info@lakeside.example', color: '#1E9C94', status: 'trial', planId: 'starter', cycle: 'monthly', createdOn: '2026-09-24', trialEndsOn: '2026-10-24', template: 'simple-masjid', usage: { members: 140, centers: 1, sms: 0 },
      admins: [a('u-l1', 'Maryam Qureshi', 'maryam@lakeside.example', 'owner', 'active', '2026-09-24', '2026-10-11')] }),
    s({ slug: 'prairie', name: 'Prairie Masjid Society', shortName: 'PMS', type: 'society', city: 'Dallas', state: 'TX', email: 'board@prairie.example', color: '#6B3FA0', status: 'past_due', planId: 'growth', cycle: 'monthly', createdOn: '2025-06-03', template: 'bylaws-society', usage: { members: 2380, centers: 6, sms: 1980 },
      admins: [a('u-p1', 'Bilal Ahmed', 'bilal@prairie.example', 'owner', 'active', '2025-06-03', '2026-10-02'), a('u-p2', 'Zainab Hussain', 'zainab@prairie.example', 'admin', 'active', '2025-07-19', '2026-10-09')] }),
    s({ slug: 'gulf-coast', name: 'Gulf Coast Muslim Community', shortName: 'GCMC', type: 'association', city: 'Corpus Christi', state: 'TX', email: 'hello@gulfcoast.example', color: '#245E9E', status: 'active', planId: 'starter', cycle: 'annual', createdOn: '2025-03-15', template: 'simple-masjid', usage: { members: 470, centers: 1, sms: 0 },
      admins: [a('u-g1', 'Yusuf Rahman', 'yusuf@gulfcoast.example', 'owner', 'active', '2025-03-15', '2026-10-08')] }),
    s({ slug: 'hill-country', name: 'Hill Country Islamic Society', shortName: 'HCIS', type: 'society', city: 'San Antonio', state: 'TX', email: 'members@hillcountry.example', color: '#566318', status: 'active', planId: 'growth', cycle: 'annual', createdOn: '2024-12-01', template: 'bylaws-society', usage: { members: 3020, centers: 7, sms: 1220 },
      admins: [a('u-h1', 'Amina Farooq', 'amina@hillcountry.example', 'owner', 'active', '2024-12-01', '2026-10-15'), a('u-h2', 'Tariq Shah', 'tariq@hillcountry.example', 'admin', 'active', '2025-01-10', '2026-10-12')] }),
    s({ slug: 'red-river', name: 'Red River Islamic Center', shortName: 'RRIC', type: 'masjid', city: 'Shreveport', state: 'LA', email: 'office@redriver.example', color: '#B8702A', status: 'trial', planId: 'starter', cycle: 'monthly', createdOn: '2026-09-17', trialEndsOn: '2026-10-17', template: 'simple-masjid', usage: { members: 60, centers: 1, sms: 0 },
      admins: [a('u-r1', 'Ibrahim Saleh', 'ibrahim@redriver.example', 'owner', 'invited', '2026-09-17')] }),
    s({ slug: 'pecan-grove', name: 'Pecan Grove Masjid', shortName: 'PGM', type: 'masjid', city: 'Tulsa', state: 'OK', email: 'admin@pecangrove.example', color: '#7A4B2A', status: 'suspended', planId: 'starter', cycle: 'monthly', createdOn: '2025-08-20', template: 'simple-masjid', suspendedReason: 'Paused at the Board’s request during a leadership change.', usage: { members: 220, centers: 1, sms: 0 },
      admins: [a('u-pg1', 'Khalid Mansour', 'khalid@pecangrove.example', 'owner', 'active', '2025-08-20', '2026-08-30')] }),
    s({ slug: 'crescent-valley', name: 'Crescent Valley Muslim Society', shortName: 'CVMS', type: 'society', city: 'Albuquerque', state: 'NM', email: 'contact@crescentvalley.example', color: '#9C2F45', status: 'active', planId: 'network', cycle: 'annual', createdOn: '2024-09-09', template: 'bylaws-society', usage: { members: 9100, centers: 11, sms: 7400 },
      admins: [a('u-c1', 'Fatima Noor', 'fatima@crescentvalley.example', 'owner', 'active', '2024-09-09', '2026-10-15'), a('u-c2', 'Hassan Ali', 'hassan@crescentvalley.example', 'admin', 'active', '2024-10-01', '2026-10-14'), a('u-c3', 'Layla Haddad', 'layla@crescentvalley.example', 'editor', 'active', '2025-02-11', '2026-10-10')] }),
    s({ slug: 'magnolia', name: 'Magnolia Islamic Association', shortName: 'MIA', type: 'association', city: 'Baton Rouge', state: 'LA', email: 'info@magnolia.example', color: '#2A6F97', status: 'active', planId: 'growth', cycle: 'monthly', createdOn: '2025-10-05', template: 'bylaws-society', usage: { members: 980, centers: 3, sms: 410 },
      modules: { customDomain: 'on' }, customDomain: { host: 'members.magnolia.example', status: 'pending', token: 'ngv-7c1e9a', addedOn: '2026-10-12' },
      admins: [a('u-m1', 'Nadia Karim', 'nadia@magnolia.example', 'owner', 'active', '2025-10-05', '2026-10-12')] }),
    s({ slug: 'sunbelt-academy', name: 'Sunbelt Islamic Academy Parents', shortName: 'SIAP', type: 'school', city: 'Phoenix', state: 'AZ', email: 'parents@sunbelt.example', color: '#C9A35C', status: 'active', planId: 'starter', cycle: 'monthly', createdOn: '2026-02-14', template: 'blank', usage: { members: 300, centers: 1, sms: 0 },
      admins: [a('u-s1', 'Aisha Rahim', 'aisha@sunbelt.example', 'owner', 'active', '2026-02-14', '2026-10-06')] }),
    s({ slug: 'lone-oak', name: 'Lone Oak Masjid', shortName: 'LOM', type: 'masjid', city: 'Waco', state: 'TX', email: 'office@loneoak.example', color: '#5B6770', status: 'cancelled', planId: 'starter', cycle: 'monthly', createdOn: '2025-01-22', cancelledOn: '2026-07-31', template: 'simple-masjid', usage: { members: 95, centers: 1, sms: 0 },
      admins: [a('u-lo1', 'Samir Haddad', 'samir@loneoak.example', 'owner', 'revoked', '2025-01-22', '2026-07-30')] }),
  ];
  // sample organizations are numbered after ISGH, oldest first
  list.filter((t) => t.slug !== 'isgh').sort((x, y) => x.createdOn.localeCompare(y.createdOn)).forEach((t, i) => { t.clientNo = i + 2; });
  return list;
}

/* ---------------- rules ---------------- */
export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
/** Plain-language problem with an address name, or null when it is fine. */
export function slugProblem(slug: string, taken: string[] = []): string | null {
  if (!slug) return 'Choose a web address.';
  if (slug.length < 3) return 'Use at least 3 characters.';
  if (slug.length > 30) return 'Use 30 characters or fewer.';
  if (!SLUG_RE.test(slug)) return 'Use lowercase letters, numbers and dashes. It cannot start or end with a dash.';
  if (slug.includes('--')) return 'Do not use two dashes in a row.';
  if (slug.endsWith('-admin')) return 'It cannot end with “-admin” (that is used for the admin address).';
  if (RESERVED_SLUGS.includes(slug)) return `“${slug}” is reserved. Try another name.`;
  if (taken.includes(slug)) return `“${slug}” is already used by another organization.`;
  return null;
}

export const planOf = (plans: PlansDoc, id: string) => plans.plans.find((p) => p.id === id) ?? plans.plans[0];

export function flagOn(flag: Flag | undefined, slug: string) {
  if (!flag) return true;
  return flag.rollout === 'all' || (flag.rollout === 'some' && flag.tenants.includes(slug));
}
/** Modules this organization can use right now: plan + add-ons − switched off − beta not rolled out to it. */
export function effectiveModules(t: Pick<Tenant, 'slug' | 'planId' | 'modules'>, plans: PlansDoc, flags: Flag[]): Module[] {
  const set = new Set<Module>([...CORE_MODULES, ...planOf(plans, t.planId).modules]);
  for (const [m, v] of Object.entries(t.modules ?? {}) as [Module, 'on' | 'off'][]) {
    if (v === 'on') set.add(m);
    else if (!CORE_MODULES.includes(m)) set.delete(m);
  }
  for (const f of flags) if (f.module && !CORE_MODULES.includes(f.module) && !flagOn(f, t.slug)) set.delete(f.module);
  return MODULES.filter((m) => set.has(m));
}
/** Why a module is on or off for this org (shown next to each switch). */
export function moduleSource(m: Module, t: Pick<Tenant, 'slug' | 'planId' | 'modules'>, plans: PlansDoc, flags: Flag[]): string {
  if (CORE_MODULES.includes(m)) return 'Always included';
  const flag = flags.find((f) => f.module === m);
  if (flag && !flagOn(flag, t.slug)) return `Beta – not rolled out (${flag.label})`;
  const o = t.modules?.[m];
  if (o === 'on') return planOf(plans, t.planId).modules.includes(m) ? 'In plan' : 'Add-on for this org';
  if (o === 'off') return 'Switched off for this org';
  return planOf(plans, t.planId).modules.includes(m) ? 'In plan' : 'Not in plan';
}

/** Monthly recurring revenue in cents (trials, suspended and cancelled orgs count as 0). */
export function mrrOf(t: Pick<Tenant, 'status' | 'planId' | 'cycle'>, plans: PlansDoc) {
  if (t.status !== 'active' && t.status !== 'past_due') return 0;
  const p = planOf(plans, t.planId);
  return t.cycle === 'annual' ? Math.round(p.priceAnnual / 12) : p.priceMonthly;
}
export const usd = (c: number, whole = true) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 });

export type Usage = { key: 'members' | 'centers' | 'admins' | 'sms'; label: string; used: number; limit: number; pct: number };
export function usageOf(t: Tenant, plans: PlansDoc): Usage[] {
  const l = planOf(plans, t.planId).limits;
  const admins = t.admins.filter((x) => x.status !== 'revoked').length;
  const row = (key: Usage['key'], label: string, used: number, limit: number): Usage => ({ key, label, used, limit, pct: limit ? Math.round((used / limit) * 100) : 0 });
  return [row('members', 'Members', t.usage.members, l.members), row('centers', 'Islamic Centers', t.usage.centers, l.centers), row('admins', 'Admin users', admins, l.admins), row('sms', 'Texts this month', t.usage.sms, l.sms)];
}

/** Worth a warning: members/texts at 90% or more of the plan; centers/admins only when over the limit (1 of 1 is normal). */
export const nearLimit = (u: Usage) => !!u.limit && (u.key === 'members' || u.key === 'sms' ? u.pct >= 90 : u.used > u.limit);

const day = 86_400_000;
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / day);
export const addDays = (iso: string, n: number) => isoDay(new Date(Date.parse(iso) + n * day));
export const trialDaysLeft = (t: Pick<Tenant, 'status' | 'trialEndsOn'>, today: string) => (t.status === 'trial' && t.trialEndsOn ? Math.max(0, daysBetween(today, t.trialEndsOn)) : null);

export type Health = { score: number; label: 'Healthy' | 'Watch' | 'At risk' | 'Closed'; reasons: string[] };
export function healthOf(t: Tenant, plans: PlansDoc, today: string): Health {
  if (t.status === 'cancelled') return { score: 0, label: 'Closed', reasons: ['Cancelled'] };
  if (t.status === 'suspended') return { score: 0, label: 'Closed', reasons: [t.suspendedReason ? `Suspended – ${t.suspendedReason}` : 'Suspended'] };
  let score = 100; const reasons: string[] = [];
  if (t.status === 'past_due') { score -= 35; reasons.push('Last payment failed'); }
  const left = trialDaysLeft(t, today);
  if (left !== null && left <= 3) { score -= 15; reasons.push(left === 0 ? 'Trial ends today' : `Trial ends in ${left} day${left === 1 ? '' : 's'}`); }
  for (const u of usageOf(t, plans)) if (nearLimit(u)) { score -= 15; reasons.push(`${u.label} at ${u.pct}% of the plan`); }
  if (!t.admins.some((x) => x.status === 'active')) { score -= 20; reasons.push('Nobody has accepted the admin invitation yet'); }
  const last = t.admins.map((x) => x.lastActiveOn ?? '').sort().pop();
  if (last && daysBetween(last, today) > 30) { score -= 15; reasons.push(`No admin sign-in for ${daysBetween(last, today)} days`); }
  if (t.customDomain?.status === 'failed') { score -= 10; reasons.push('Own domain is not working'); }
  score = Math.max(0, score);
  return { score, label: score >= 75 ? 'Healthy' : score >= 50 ? 'Watch' : 'At risk', reasons };
}

/* ---------------- addresses ---------------- */
export type HostInfo = { slug: string; app: 'web' | 'admin' };
/** Web and admin addresses of an org (older addresses win, so ISGH keeps member-web / member-admin). */
export function hostsFor(t: Pick<Tenant, 'slug' | 'hosts' | 'customDomain'>, s: Pick<PlatformSettings, 'baseDomain'>) {
  return {
    web: t.hosts?.web ?? `${t.slug}.${s.baseDomain}`,
    admin: t.hosts?.admin ?? `${t.slug}-admin.${s.baseDomain}`,
    custom: t.customDomain?.status === 'verified' ? t.customDomain.host : undefined,
  };
}
/**
 * Which org (and which app) an address belongs to. Uses the Host header only (set by our proxy, see DEPLOY.md).
 *   isgh.nextgrow.pro → isgh web · isgh-admin.nextgrow.pro → isgh admin · members.example.org → its org (verified only)
 *   On your PC: clear-lake.localhost:3000 → web, clear-lake.localhost:3001 → admin (any port; app comes from the caller).
 *   Plain localhost / 127.0.0.1 → null (the app then uses ISGH_TENANT, default "isgh").
 */
export function resolveHost(rawHost: string | null | undefined, tenants: Pick<Tenant, 'slug' | 'hosts' | 'customDomain' | 'status'>[], s: Pick<PlatformSettings, 'baseDomain'>): HostInfo | null {
  if (!rawHost) return null;
  const host = rawHost.toLowerCase().trim().replace(/:\d+$/, '').replace(/\.$/, '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return null;
  for (const t of tenants) {
    if (t.hosts?.web === host) return { slug: t.slug, app: 'web' };
    if (t.hosts?.admin === host) return { slug: t.slug, app: 'admin' };
    if (t.customDomain?.status === 'verified' && t.customDomain.host === host) return { slug: t.slug, app: 'web' };
  }
  const local = host.match(/^([a-z0-9-]+)\.localhost$/);
  const sub = local ? local[1] : host.endsWith(`.${s.baseDomain}`) ? host.slice(0, -(s.baseDomain.length + 1)) : null;
  if (!sub || sub.includes('.')) return null;
  const isAdmin = sub.endsWith('-admin');
  const slug = isAdmin ? sub.slice(0, -6) : sub;
  if (!tenants.some((t) => t.slug === slug)) return null;
  return { slug, app: isAdmin ? 'admin' : 'web' };
}
/** The website address that belongs to an admin page (and back) – used by the live preview. */
export function siblingOrigin(origin: string, to: 'web' | 'admin'): string | null {
  try {
    const u = new URL(origin);
    const local = u.hostname.match(/^([a-z0-9-]+)\.localhost$/);
    if (local) { u.port = to === 'web' ? (u.port === '4322' ? '4321' : '3000') : (u.port === '4321' ? '4322' : '3001'); return u.origin; }
    const [sub, ...rest] = u.hostname.split('.');
    if (rest.length < 2) return null;
    if (to === 'web' && sub.endsWith('-admin')) u.hostname = [sub.slice(0, -6), ...rest].join('.');
    else if (to === 'admin' && !sub.endsWith('-admin')) u.hostname = [`${sub}-admin`, ...rest].join('.');
    else return null;
    return u.origin;
  } catch { return null; }
}
/** DNS records the org adds for its own domain. */
export const dnsRecordsFor = (d: Domain, s: Pick<PlatformSettings, 'baseDomain'>) => [
  { type: 'CNAME', name: d.host, value: `orgs.${s.baseDomain}`, why: 'Points the address at the platform.' },
  { type: 'TXT', name: `_nextgrow.${d.host}`, value: d.token, why: 'Proves the organization owns the domain.' },
];

/* ---------------- announcements, support ---------------- */
export function announcementsFor(t: Pick<Tenant, 'slug' | 'planId'>, items: Announcement[], today: string) {
  return items.filter((a) => a.active && a.startsOn <= today && today <= a.endsOn
    && (a.audience === 'all' || (a.audience === 'plans' && a.ids.includes(t.planId)) || (a.audience === 'orgs' && a.ids.includes(t.slug))));
}
export const sessionActive = (s: SupportSession, now: Date) => !s.endedAt && Date.parse(s.endsAt) > now.getTime();

/* ---------------- money (demo history) ---------------- */
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** MRR for each of the last 12 months (orgs count from the month after their trial, until they cancel). */
export function mrrHistory(tenants: Tenant[], plans: PlansDoc, today: string) {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const end = isoDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
    const value = tenants.reduce((s, t) => {
      const paidFrom = addDays(t.createdOn, plans.trialDays);
      if (paidFrom > end || (t.cancelledOn && t.cancelledOn < end) || t.status === 'trial') return s;
      if (t.status === 'suspended' && i === 11) return s;
      return s + mrrOf({ ...t, status: 'active' }, plans);
    }, 0);
    return { label: MONTH[d.getUTCMonth()], value };
  });
}
export function signupsByMonth(tenants: Tenant[], today: string) {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const key = isoDay(d).slice(0, 7);
    return { label: MONTH[d.getUTCMonth()], value: tenants.filter((t) => t.createdOn.slice(0, 7) === key).length };
  });
}

export type Invoice = { id: string; slug: string; org: string; period: string; issuedOn: string; amount: number; status: 'paid' | 'open' | 'failed' | 'void'; method: string };
/** Demo invoices: one per paid month (or year) since the trial ended; the latest one of a "payment failed" org failed. */
export function demoInvoices(tenants: Tenant[], plans: PlansDoc, today: string, overrides: Record<string, Invoice['status']> = {}): Invoice[] {
  const out: Invoice[] = [];
  for (const t of tenants) {
    if (t.status === 'trial') continue;
    const p = planOf(plans, t.planId);
    let at = addDays(t.createdOn, plans.trialDays); let n = 0;
    const stop = t.cancelledOn && t.cancelledOn < today ? t.cancelledOn : today;
    const list: Invoice[] = [];
    while (at <= stop && n < 36) {
      const id = `INV-${at.slice(0, 4)}${at.slice(5, 7)}-${t.slug.slice(0, 4).toUpperCase()}${String(n + 1).padStart(2, '0')}`;
      list.push({ id, slug: t.slug, org: t.name, period: t.cycle === 'annual' ? `${at.slice(0, 4)}–${Number(at.slice(0, 4)) + 1}` : at.slice(0, 7), issuedOn: at, amount: t.cycle === 'annual' ? p.priceAnnual : p.priceMonthly, status: 'paid', method: t.slug === 'isgh' || t.slug === 'hill-country' ? 'Bank (ACH)' : 'Card' });
      at = t.cycle === 'annual' ? addDays(at, 365) : isoDay(new Date(Date.UTC(Number(at.slice(0, 4)), Number(at.slice(5, 7)), Number(at.slice(8, 10)))));
      n++;
    }
    if (t.status === 'past_due' && list.length) list[list.length - 1].status = 'failed';
    out.push(...list);
  }
  return out.map((i) => (overrides[i.id] ? { ...i, status: overrides[i.id] } : i)).sort((a, b) => (a.issuedOn < b.issuedOn ? 1 : a.issuedOn > b.issuedOn ? -1 : a.id.localeCompare(b.id)));
}
