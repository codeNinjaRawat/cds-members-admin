/**
 * API CONTRACT – GET {ISGH_API_URL}/public/site-config
 *
 * Everything here is controlled by admins (admin app → BE):
 *   - org        → Settings Center › Organization
 *   - flags      → Feature flags (only public flags are sent)
 *   - announcement → CMS › Announcements
 *   - nav, actions, footer → CMS › Menus & Footer
 *   - theme      → Website theme editor (A8)
 *
 * The BE (module B7) must return JSON matching this schema. The website validates it at runtime;
 * if validation fails the site keeps working on the last good/mock config and logs the error.
 * Documented in memory: web/memory/api-contract.md and BE/memory/api-contract-web.md
 */
import { z } from 'zod';

const href = z.string().min(1).max(500);

export const NavChildSchema = z.object({
  label: z.string().min(1).max(60),
  href,
  description: z.string().max(140).optional(),
});

export const NavItemSchema = z.object({
  label: z.string().min(1).max(40),
  href: href.optional(),
  children: z.array(NavChildSchema).max(12).optional(),
});

export const LinkSchema = z.object({ label: z.string().min(1).max(60), href });

export const AnnouncementSchema = z.object({
  id: z.string().min(1).max(80),
  tone: z.enum(['info', 'warning', 'success']).default('info'),
  text: z.string().min(1).max(220),
  link: LinkSchema.optional(),
  dismissible: z.boolean().default(true),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

/** Admin › Branding – uploaded files (media library URLs). Defaults live in /public/brand. */
export const BrandingSchema = z.object({
  logoLight: z.string(),        // mark for light backgrounds (SVG or PNG)
  logoDark: z.string(),         // mark for dark backgrounds
  logoAlt: z.string(),
  favicon: z.string(),          // SVG favicon (may adapt to light/dark tabs)
  faviconIco: z.string(),       // .ico fallback (older browsers)
  appleTouchIcon: z.string(),   // 180×180 PNG
  manifest: z.string(),         // web app manifest (Android / install)
  ogImage: z.string(),          // social share image 1200×630
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  version: z.string().optional(), // cache-busting when admin uploads a new logo
});
export type Branding = z.infer<typeof BrandingSchema>;

export const DEFAULT_BRANDING: Branding = {
  logoLight: '/brand/logo-mark.svg', logoDark: '/brand/logo-mark-dark.svg', logoAlt: 'ISGH Members',
  favicon: '/brand/favicon.svg', faviconIco: '/brand/favicon.ico', appleTouchIcon: '/brand/apple-touch-icon.png',
  manifest: '/brand/site.webmanifest', ogImage: '/brand/og-default.png', themeColor: '#0E5A45', version: 'concept-a-1',
};

export const SiteConfigSchema = z.object({
  branding: BrandingSchema.optional(),
  version: z.string().optional(), // config version from BE (for cache busting / audit)
  org: z.object({
    name: z.string(),
    shortName: z.string(),
    productName: z.string(),
    address: z.array(z.string()).min(1),
    phone: z.object({ display: z.string(), tel: z.string() }),
    email: z.string().email(),
    taxNote: z.string().optional(),
    founded: z.number().int().optional(),
  }),
  flags: z.record(z.string(), z.boolean()),
  announcement: AnnouncementSchema.nullable().optional(),
  nav: z.array(NavItemSchema).max(8),
  actions: z.object({ signIn: LinkSchema, join: LinkSchema }),
  footer: z.object({
    columns: z.array(z.object({ title: z.string(), links: z.array(LinkSchema).max(10) })).max(5),
    social: z.array(LinkSchema).max(8),
    legal: z.array(LinkSchema).max(6),
    newsletter: z.object({ title: z.string(), text: z.string(), consent: z.string() }).optional(),
    /** Admin: footer call-to-action card (hidden on the join page automatically) */
    cta: z.object({ title: z.string(), text: z.string(), primary: LinkSchema, secondary: LinkSchema.optional(), deadline: z.string().optional() }).optional(),
    /** Admin: short line under the org name */
    tagline: z.string().max(200).optional(),
    /** Admin: office hours in Central Time – drives the live "Open now / Closed" badge. day 0 = Sunday */
    hours: z.array(z.object({ days: z.array(z.number().int().min(0).max(6)), open: z.string(), close: z.string() })).optional(),
    hoursLabel: z.string().optional(),
    mapUrl: z.string().optional(),
  }),
  theme: z.object({
    active: z.string().min(1),          // theme key, e.g. "bayou"
    allowUserModeToggle: z.boolean().default(true),
    /** Admin: what visitors see before they choose (Website theme editor › Default mode) */
    defaultMode: z.enum(['light', 'dark', 'system']).default('system'),
  }),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;
export type NavItem = z.infer<typeof NavItemSchema>;
export type Announcement = z.infer<typeof AnnouncementSchema>;
export type Link = z.infer<typeof LinkSchema>;
