/**
 * The documents the admin controls. Each one = one website API contract (same zod schema the site uses).
 *   key            demo-store file / BE resource
 *   schema, initial  validation + the website's built-in default content
 *   preview        website paths affected (opened in the live preview)
 */
import { z, type ZodTypeAny } from 'zod';
import { SiteConfigSchema } from '@/lib/site-config/schema';
import { mockSiteConfig } from '@/lib/site-config/mock-site-config';
import { HomeSchema, mockHome } from '@/lib/content/home';
import { mockNews, mockPages, NewsItemSchema, PageSchema } from '@/lib/content/pages';
import { MembershipSettingsSchema, mockMembershipSettings } from '@/lib/content/membership';
import { GivingSchema, mockGiving } from '@/lib/content/giving';
import defaultThemes from '@/lib/theme/default-themes.json';
import { defaultJoinForm, JoinFormSchema } from '@/lib/join/form-def';
import { EventsSchema, mockEvents } from '@/lib/community/events';
import { GroupsSchema, mockGroups } from '@/lib/community/groups';
import { CommunicationSchema, mockCommunication } from '@/lib/community/communication';
import { mockOrgConfig, OrgConfigSchema } from '@/lib/community/org-config';
import { AccessSchema, mockAccess } from '@/lib/access/access';
import { IntegrationsSchema, mockIntegrations } from '@/lib/integrations/integrations';
import { OrgStructureSchema, mockOrgStructure } from '@/lib/community/org-structure';
import { SignInSchema, mockSignIn } from '@/lib/community/sign-in';
import { ZakatSettingsSchema, mockZakatSettings } from '@/lib/community/zakat';
import { DonationSettingsSchema, mockDonationSettings } from '@/lib/community/donations';
import { BenefitsSchema, mockBenefits } from '@/lib/community/benefits';
import { OfficialsSchema, mockOfficials } from '@/lib/community/officials';
import { PrayerSettingsSchema, mockPrayerSettings } from '@/lib/community/prayer';
import { FinanceSettingsSchema, mockFinanceSettings } from '@/lib/community/finance';
import { FundraisingSchema, mockFundraising } from '@/lib/community/fundraising';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit color like #0E5A45');
export const ThemesSchema = z.object({
  _help: z.string().optional(),
  default: z.string().regex(/^[a-z0-9-]+$/),
  shared: z.record(z.string(), z.string()),
  themes: z.record(z.string().regex(/^[a-z0-9-]+$/), z.object({
    label: z.string().optional(), story: z.string().optional(),
    light: z.record(z.string(), hex), dark: z.record(z.string(), hex),
  })),
});

export type DocKey = 'site-config' | 'home' | 'membership-settings' | 'giving' | 'pages' | 'news' | 'themes' | 'join-form' | 'events' | 'groups' | 'communication' | 'org-config' | 'admin-access' | 'integrations' | 'org-structure' | 'zakat-settings' | 'donation-settings' | 'benefits' | 'officials' | 'prayer-times' | 'finance-settings' | 'fundraising' | 'sign-in';
type Entry = { key: DocKey; label: string; schema: ZodTypeAny; initial: unknown; preview: string[]; api: string };

export const REGISTRY: Record<DocKey, Entry> = {
  'site-config': { key: 'site-config', label: 'Site settings', schema: SiteConfigSchema, initial: mockSiteConfig, preview: ['/'], api: 'GET /public/site-config' },
  home: { key: 'home', label: 'Home page', schema: HomeSchema, initial: mockHome, preview: ['/'], api: 'GET /public/pages/home' },
  'membership-settings': { key: 'membership-settings', label: 'Membership rules', schema: MembershipSettingsSchema, initial: mockMembershipSettings, preview: ['/membership/plans', '/membership/join'], api: 'GET /public/membership/settings' },
  giving: { key: 'giving', label: 'Giving', schema: GivingSchema, initial: mockGiving, preview: ['/give', '/needs', '/impact'], api: 'GET /public/giving' },
  pages: { key: 'pages', label: 'Pages', schema: z.record(z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/, 'Use lowercase words and dashes, like about or centers/zones'), PageSchema), initial: mockPages, preview: ['/about'], api: 'GET /public/pages/{slug}' },
  news: { key: 'news', label: 'News', schema: z.array(NewsItemSchema), initial: mockNews, preview: ['/news'], api: 'GET /public/news' },
  'join-form': { key: 'join-form', label: 'Join form', schema: JoinFormSchema, initial: defaultJoinForm, preview: ['/membership/join'], api: 'GET /public/membership/join-form' },
  events: { key: 'events', label: 'Events', schema: EventsSchema, initial: mockEvents, preview: ['/events'], api: 'GET /public/events' },
  groups: { key: 'groups', label: 'Groups', schema: GroupsSchema, initial: mockGroups, preview: [], api: 'GET /admin/groups' },
  communication: { key: 'communication', label: 'Communication', schema: CommunicationSchema, initial: mockCommunication, preview: [], api: 'GET /admin/communication' },
  'org-config': { key: 'org-config', label: 'Configuration', schema: OrgConfigSchema, initial: mockOrgConfig, preview: ['/membership/join'], api: 'GET /public/config (public parts) · /admin/config' },
  'admin-access': { key: 'admin-access', label: 'Admins and roles', schema: AccessSchema, initial: mockAccess, preview: [], api: 'GET/PUT /admin/access (A10)' },
  integrations: { key: 'integrations', label: 'Integrations', schema: IntegrationsSchema, initial: mockIntegrations, preview: [], api: 'GET/PUT /admin/integrations (A11 – secrets stored encrypted by the BE, never in this document)' },
  'org-structure': { key: 'org-structure', label: 'Zones and Islamic Centers', schema: OrgStructureSchema, initial: mockOrgStructure, preview: [], api: 'GET/PUT /admin/org-structure · GET /public/centers (F1)' },
  'zakat-settings': { key: 'zakat-settings', label: 'Zakat and Sadaqah settings', schema: ZakatSettingsSchema, initial: mockZakatSettings, preview: [], api: 'GET/PUT /admin/zakat/settings (F2)' },
  'donation-settings': { key: 'donation-settings', label: 'Funds and donation rules', schema: DonationSettingsSchema, initial: mockDonationSettings, preview: [], api: 'GET/PUT /admin/donations/settings (F3)' },
  benefits: { key: 'benefits', label: 'Member benefits', schema: BenefitsSchema, initial: mockBenefits, preview: [], api: 'GET/PUT /admin/benefits · GET /member/benefits (F4)' },
  officials: { key: 'officials', label: 'Elected officials', schema: OfficialsSchema, initial: mockOfficials, preview: ['/leadership'], api: 'GET/PUT /admin/officials · GET /public/leadership (F5)' },
  'prayer-times': { key: 'prayer-times', label: 'Prayer times', schema: PrayerSettingsSchema, initial: mockPrayerSettings, preview: ['/prayer-times'], api: 'GET/PUT /admin/prayer-times · GET /public/prayer-times (F6)' },
  'finance-settings': { key: 'finance-settings', label: 'Finance rules and budgets', schema: FinanceSettingsSchema, initial: mockFinanceSettings, preview: [], api: 'GET/PUT /admin/finance/settings (F7)' },
  'sign-in': { key: 'sign-in', label: 'Sign-in and dashboards', schema: SignInSchema, initial: mockSignIn, preview: ['/sign-in'], api: 'GET/PUT /admin/sign-in · GET /public/sign-in · GET /auth/dashboards (M4)' },
  fundraising: { key: 'fundraising', label: 'Fundraising campaigns', schema: FundraisingSchema, initial: mockFundraising, preview: ['/campaigns'], api: 'GET/PUT /admin/fundraising · GET /public/campaigns (F8)' },
  themes: { key: 'themes', label: 'Website theme', schema: ThemesSchema, initial: defaultThemes, preview: ['/'], api: 'GET /public/theme' },
};
export const DOC_KEYS = Object.keys(REGISTRY) as DocKey[];
export const isDocKey = (k: string): k is DocKey => k in REGISTRY;
