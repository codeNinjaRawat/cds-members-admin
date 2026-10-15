# Admin Dashboard – Purpose

For **ISGH admins / staff**.

## Features
- Login (admin roles only)
- Dashboard: KPI cards and charts (total, active, expiring, new members)
- Members table: search, filter, sort, paginate, export CSV
- Member detail: view/edit, approve, renew, deactivate
- Plans and fees management
- Payments list
- Notifications / email reminders

## Talks to
- `BE` API (admin endpoints, role-protected)

## Admin control (added 2026-10-13)
- **Settings Center**: every business rule is a setting (Bylaws defaults, compliance badge, scope, effective dates, approval, history, rollback, impact preview) – see `../../memory/13-admin-settings-and-feature-flags.md`
- **Feature flags**: turn major features on/off per environment / zone / center / test users
- **Environment tools**: compare and promote settings dev → staging → production
- **CMS**: pages, blog, events, centers directory, FAQ, announcements, media, SEO – see `../../memory/15-website-cms-scope.md`
- **Bylaws library**: upload versions, link settings to sections

## Build order & look (2026-10-13)
Phase 2: Admin UI/UX modules A0–A10 after web UI approval (`../../memory/17-build-order-and-modules.md`).
Look: glassmorphism "working on glass" + theme engine (personal themes, website theme editor) – `../../memory/18-admin-glass-theme.md`.

## Integrations page (2026-10-13)
A11: SMS gateway, email gateway, Stripe – status, test/live, encrypted credentials, test send, webhooks, usage – `../../memory/20-integrations.md`.

## Admin screens that control the website (traceability, 2026-10-13)
| Admin screen | Website part | API |
|---|---|---|
| CMS › Menus | Header menus, dropdown descriptions, Sign in / Join buttons | `/public/site-config` → nav, actions |
| CMS › Announcements | Top announcement bar (text, tone, link, start/end, dismissible) | site-config.announcement |
| CMS › Footer | Footer columns, social links, legal links, newsletter texts | site-config.footer |
| Settings › Organization | Org name, address, phone, email, 501(c)(3) note | site-config.org |
| Settings › Feature flags | `site.announcement`, `cms.newsletter`, `site.themeToggle`, `i18n.languages` | site-config.flags |
| Website theme editor (A8) | All colors, fonts, radii; active theme; visitor light/dark toggle allowed | `/public/theme`, site-config.theme |
| Marketing › Subscribers | Newsletter sign-ups | `POST /public/newsletter/subscriptions` |

| CMS › Home page | Hero texts, zones and center lists, stats, bento texts, "what membership supports" tiles and photos, journey steps, Houston band, closing | `/public/pages/home` |
| CMS › Pages | About, Elections, FAQ, Contact, Centers, Zones, Events, Accessibility, Privacy, Terms | `/public/pages/{slug}` |
| CMS › News | News list + home tile | `/public/news` |
| Settings › Membership & dues | Plans, prices, units, multi-year limits/discount, record date (June 30), ages, commitments, pledge, consent texts, who may pay | `/public/membership/settings` |
| Applications queue | New applications from the website sign-up | `POST /public/membership/applications` |
| Media library | All website photos (alt text required, credit) | image refs in CMS content |
| Website theme editor › Theme & mode | Active theme, **default light/dark mode**, visitor toggle allowed | site-config.theme (`active`, `defaultMode`, `allowUserModeToggle`) |
| CMS › Home page › Layout | **Home layout: Classic or Five zones**; which sections show and their order | `/public/pages/home` → `layout`, `sections` |
| Feedback inbox | "Rate your experience" ratings + comments (dashboard, export) | `POST /public/feedback` |
| Complaints queue | Complaints with reference, category, SLA, assignee, confidential notes, resolution | `POST /public/complaints` |
| Settings › Verification | Public membership check on/off and what it may show | `POST /public/membership/verify` |
| CMS › Join page | Photos and texts on Become a member | `pages/home.joinImages` |
| CMS › Footer (v2) | Footer call-to-action card + deadline, tagline, office hours (drives Open now badge), map link | site-config.footer.cta/tagline/hours/mapUrl |
| Feedback inbox › Page ratings | "Was this page helpful?" yes/no per page | `POST /public/feedback` |
| **Branding (uploads)** | Logo light + dark, favicon, app icon (auto-generates all sizes), social share image, theme color – with preview, approval, rollback | `site-config.branding` (logoLight, logoDark, logoAlt, favicon, faviconIco, appleTouchIcon, manifest, ogImage, themeColor, version) |
| CMS › Giving › Verses | Quran verses (Arabic, English, translation name, reference) and hadith shown on home, /give, join page, loaders. Imam/education review before publish | `/public/giving` → verses, hadith |
| CMS › Giving › How we helped | Programs, community responses and personal stories with photo, metrics, source link, consent level (public record / written consent upload / anonymized), featured toggle | `/public/giving` → impact, totals |
| CMS › Giving › Who still needs help | Cases: title, story, photo (no faces for anonymized), category, zone, goal, status (urgent/open/ongoing/met), Zakat-eligible, verified by; raised + donors come from donations | `/public/giving` → needs |
| Settings › Giving | Show sample items, show progress bars, auto-rotate verses, external give/Zakat URLs | `/public/giving` → flags, giveUrl, zakatUrl |
| Settings › Microcopy › Loaders | Step messages for the smart loader per task (send code, lookup, submit, give…) | planned (now `LOADER_PLANS` in code) |
| CMS › Home page › Heart line | One short hadith/saying under the stats (text, Arabic, source) | pages/home.heartLine |
| Settings › Renewal | Renewal opens date (default Nov 1), reminders; member home Renew button follows it | membership settings (planned field renewalOpensAt) |
