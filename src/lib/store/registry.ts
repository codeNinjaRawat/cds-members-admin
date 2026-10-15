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

export type DocKey = 'site-config' | 'home' | 'membership-settings' | 'giving' | 'pages' | 'news' | 'themes' | 'join-form';
type Entry = { key: DocKey; label: string; schema: ZodTypeAny; initial: unknown; preview: string[]; api: string };

export const REGISTRY: Record<DocKey, Entry> = {
  'site-config': { key: 'site-config', label: 'Site settings', schema: SiteConfigSchema, initial: mockSiteConfig, preview: ['/'], api: 'GET /public/site-config' },
  home: { key: 'home', label: 'Home page', schema: HomeSchema, initial: mockHome, preview: ['/'], api: 'GET /public/pages/home' },
  'membership-settings': { key: 'membership-settings', label: 'Membership rules', schema: MembershipSettingsSchema, initial: mockMembershipSettings, preview: ['/membership/plans', '/membership/join'], api: 'GET /public/membership/settings' },
  giving: { key: 'giving', label: 'Giving', schema: GivingSchema, initial: mockGiving, preview: ['/give', '/needs', '/impact'], api: 'GET /public/giving' },
  pages: { key: 'pages', label: 'Pages', schema: z.record(z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/, 'Use lowercase words and dashes, like about or centers/zones'), PageSchema), initial: mockPages, preview: ['/about'], api: 'GET /public/pages/{slug}' },
  news: { key: 'news', label: 'News', schema: z.array(NewsItemSchema), initial: mockNews, preview: ['/news'], api: 'GET /public/news' },
  'join-form': { key: 'join-form', label: 'Join form', schema: JoinFormSchema, initial: defaultJoinForm, preview: ['/membership/join'], api: 'GET /public/membership/join-form' },
  themes: { key: 'themes', label: 'Website theme', schema: ThemesSchema, initial: defaultThemes, preview: ['/'], api: 'GET /public/theme' },
};
export const DOC_KEYS = Object.keys(REGISTRY) as DocKey[];
export const isDocKey = (k: string): k is DocKey => k in REGISTRY;
