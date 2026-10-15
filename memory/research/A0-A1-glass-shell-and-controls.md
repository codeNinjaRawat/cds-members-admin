# Research + design plan – A0 glass system, A1 shell, website controls (2026-10-13)

## What modern admin/CMS tools do (patterns we used)
- **Schema-driven editing** (Payload CMS, Keystatic, Sanity, Directus): forms are generated from the content model, so the editor can never save what the site rejects. We drive forms from the **website's own zod contracts** (copied with `npm run contracts:sync`).
- **Draft → publish → history** (Sanity, Contentful, WordPress revisions): unpublished-changes banner, publish dialog that says what changed + optional note, last 20 versions, load an old version into the draft, reset to built-in content.
- **Optimistic concurrency** (Stripe, GitHub): publish carries `baseVersion`; server answers 409 if someone published meanwhile → "Publish mine anyway".
- **Live preview beside the form** (Shopify theme editor, Webflow, Framer): the real site in a frame; theme changes are pushed instantly via `postMessage` (origin-checked both sides); content refreshes on publish.
- **Command palette Ctrl+K** (Linear, Vercel, GitHub): find any setting by plain words ("zakat", "logo", "June 30").
- **Contrast gate in theme editors** (tweakcn, Radix Colors guidance): WCAG pairs checked live; server refuses failing themes.
- **Glass with accessibility guardrails** (Apple Liquid Glass 2025, axesslab): frosted panes, near-solid fields, solid fallback, honors `prefers-reduced-transparency`, `prefers-reduced-motion`; per-user "Glass: clear / frosted / solid".

## Design plan (frontend-design pass)
- **Subject:** ISGH staff changing a community website and Bylaws-based rules without fear of breaking it.
- **Palette (default "Bayou"):** accent #0E5A45 (ISGH green), second #E3A62B (Houston marigold), ink #13241F, wallpaper washes #CDE6DA / #F5E5C3 / #BCD7E8; dark: ink #E6F0EC on #0A231B–#1A2C3D.
- **Type:** Bricolage Grotesque (headings, matches the website) + Public Sans (UI text). Sentence case labels, no all-caps eyebrows.
- **Layout:** floating glass sidebar (groups: Start, Website, Membership, Settings, Coming next) + pill top bar; editor left, **live website window** right (the one memorable element); panes frosted, fields near-solid.
- **Admin themes:** Bayou, Iznik, Maghrib dusk, Date palm, Midnight + custom accent (contrast-checked) · light/dark/system · glass clear/frosted/solid · backgrounds: soft light, girih star pattern, Houston dusk photo (blurred), plain · spacing · text size · motion.
- **Revised from generic:** dropped KPI-gradient hero and all-caps labels; overview leads with the **June 30 countdown** (the date that matters most to ISGH), not vanity numbers.

## Demo architecture (no BE, no external API)
Admin `PUT /api/store/{key}` (validates with the contract, contrast-checks themes, atomic write, history) → `../.demo-store/{key}.json` → website `readDemoStore()` in mock mode (zod-validated, falls back to built-in on any problem). Replaced by BE admin endpoints in phase 3 with the same bodies.
