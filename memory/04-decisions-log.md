# Admin Dashboard – Decisions Log

## 2026-10-13 – App created
- **Decision:** Separate `admin` folder with its own memory
- **Status:** Active

## 2026-10-13 – Admin controls everything; research-first; full testing
- **Decision:** Follow root decisions: Bylaws = defaults, all rules are admin settings/feature flags; research note before any feature; black-box + white-box testing and test report before delivery
- **Status:** Active

## 2026-10-13 – UI-first modular build order
- **Decision:** Web UI → Admin UI (glass) → BE (SQL) → integration → mobile; small modules, each approved
- **Status:** Active

## 2026-10-13 – Admin started: A0 glass + A1 shell + website controls (demo)
- **Decision:** Next.js 15 admin on port 3001, plain CSS design tokens (no shadcn yet – its defaults fight the glass look; Radix primitives may be added for complex widgets). Forms are generated from the website's zod contracts (SchemaForm). Publishing goes to a local demo store folder until the BE exists.
- **Screens:** Overview · Theme and branding (colors + contrast gate + live preview, logo/icon uploads, visitor options) · Home page (layout, section order/visibility, all content) · Menus and footer · Announcement bar · Pages (block builder, new/delete) · News · Giving (verses, impact, needs, switches) · Plans and rules · Organization · Feature switches · My appearance. Planned modules shown greyed (A3, A4, A9, A10, A11).
- **Safety:** same-origin writes only, key whitelist, 2 MB limit, schema validation, theme contrast gate, version conflict check, history (20), reset to built-in; draft autosave in the browser.
- **Research:** memory/research/A0-A1-glass-shell-and-controls.md
- **Status:** Active (demo)

## 2026-10-13 – Default look: "Obsidian" smoked glass + icon rail (owner reference)
- **Why:** owner shared a reference reel (Code XR, "Glassy CRM Dashboard": dark smoky glass panels, icon-only sidebar, glowing spline chart with peak label, KPI glass cards, status chips, donut). Used as STYLE direction only – our layout, content and code are original and ISGH-specific.
- **Decision:** new admin preset Obsidian (dark, neutral smoke tinted by the theme), wallpaper "Obsidian" (dark glass shards + soft colored glows + faint eight-point star), sidebar "Icons only" rail that slides out on hover/keyboard focus; these are the defaults; every admin can switch back (My appearance › Theme / Background / Sidebar).
- **Overview redesigned:** application queue with status filters, renewal curve (smooth line, June 30 peak callout, crosshair tooltip), members by zone bars, KPI cards with change, giving by fund donut (validated colorblind-safe palette, legend + labels), giving by month bars, key dates, website content chips. Every chart has "Show as a table". Demo numbers.
- **Status:** Active

## 2026-10-13 – Obsidian v2 after owner review ("not matching the reference", "sidebar scrollbar")
- **Fixes:** the whole admin now sits in ONE rounded glass window on a graphite background (sidebar + top bar inside it, content scrolls inside); neutral graphite colors instead of blue/purple glow; compact type (1.6rem page titles, small quiet labels); cyan data line with point markers and "(peak)" callout; violet bars; KPI cards with icon circles; date chip; compact queue rows.
- **Sidebar:** icon rail is now slim with name tooltips (hover / keyboard focus) – no expanding panel and **no scrollbar** (planned modules hide on screens shorter than 900px; thin invisible scrolling only below 700px). Full sidebar mode got a thin themed scrollbar.
- Original ISGH design and code; reference used for style only. 13/13 tests.

## 2026-10-13 – Second look option: "Nightfall" + Command center overview (owner reference #2)
- **Why:** owner shared a second dashboard screenshot (indigo night glass, full sidebar with counts, KPI tiles with sparklines, side column with tasks/activity/assistant card) – "option like this also".
- **Decision (an OPTION, not a replacement):** new admin preset **Nightfall** (indigo night palette, original "night hills" wallpaper with stars, full sidebar with glowing active item and attention counts, renewal-season card) and a new **Overview layout: Command center** (KPI tiles with icon + change + sparkline; renewals vs new members – 2 series, one axis, legend; members by zone donut – 5 validated colors; recent members; application pipeline; dues and gifts by month; side column: today's tasks (tick off, remembered in this browser), recent activity, suggestions; status bar). Picking Nightfall switches sidebar/background/layout together; each can be changed separately in My appearance. Obsidian + Focused stays the default.
- Original ISGH content and artwork; reference used for style direction only. Full sidebar now never shows a scrollbar on laptop heights (planned modules fold away first). 13/13 tests.

## 2026-10-13 – "Onyx and gold" luxe theme + sidebar submenus (owner: "luxury-grade CRM dashboard, ultra-premium glassmorphism, also with submenus")
- **Theme Onyx and gold (luxe):** onyx glass with champagne-gold gradient hairline edges, specular sheen, fine grain, onyx-silk wallpaper (gold light sweeps + faint eight-point lattice), Fraunces display face for titles and big figures, gold buttons with dark text (new `--on-accent` token so any light accent stays readable), gold KPI icons/sparklines; charts keep validated series colors (gold #c98500 + blue #3987e5). Picking it switches to full sidebar + Command center.
- **Submenus:** sidebar is now a tree – Overview · Website ▸ (6) · Giving ▸ verses, impact, needs, page/switches · Membership ▸ plans, voting, join form, switches · Members ▸ (planned A3/A4/A9 with counts) · Settings ▸ (3) · Coming next ▸. Full sidebar = accordion (current section opens itself, open/closed remembered); icon rail = floating glass flyout on hover/focus. Sub-links deep-link to tabs with `?tab=` and tabs keep the address in sync.
- **Bug fixed:** class name `.in` (current section) collided with input class `.in` → renamed `is-current`.
- 14/14 admin tests.

## 2026-10-13 – Onyx and gold is the live default · speed pass · A3 Members (owner: "I need it live that way", "it's taking time completing the actions", "work according to the plan")
- **Default look:** Onyx and gold (luxe) + silk wallpaper + full sidebar + Command center for everyone who has not picked a look. Other 7 presets stay in My appearance.
- **Website option:** new website theme "Onyx and Gold" (light + dark, passes every contrast pair) – selectable in Theme and branding; the website default stays Bayou until the owner switches it.
- **Speed – causes found on the PC (measured):** (1) `next dev` (webpack) compiled each screen on first open: 2–3 s per screen, 1.1 s even after; (2) demo forms waited on purpose 0.65–2.4 s; (3) the wallpaper drifted forever under 15 frosted panes, so the GPU re-blurred every pane every frame; (4) every keystroke in an editor saved the whole draft and re-validated it.
- **Speed – fixes:** `npm run dev` now uses Turbopack (`dev:webpack` kept as fallback); new `npm run fast` = production build + start (pages in milliseconds – best for reviewing); demo forms default to `NEXT_PUBLIC_DEMO_SPEED=fast` (¼ delay; `real` to review loader steps; per browser via localStorage `isgh-demo-speed`); loader "Done" frame 650→380 ms; wallpaper no longer animates (`contain: strict`); draft autosave debounced 400 ms + validation on a deferred copy; instant route loading screen (`app/loading.tsx`); members list renders real rows on the server (no "Loading…").
- **A3 Members:** research `research/A3-members.md`. Saved views (All · Can vote · Pending · Not renewed · Photo ID · Life) with counts, search (name/email/phone digits/ID/ZIP), zone→center/plan/status filters, sortable columns (`aria-sort`), paging 25/50/100, select + CSV export, demo renewal reminder; state in the address (`/members?view=voters&zone=sw`). Member 360° `/members/:id`: Bylaws eligibility checklist with reasons (approved · not Associate · 18+ on June 30 · own/relative dues by June 30 · Life exempt · residency · good standing), next-year renewal, tabs Profile · Household · Payments · Notes · Audit log; actions Approve, ID verified, Record offline payment, Change center (reason required, 5-year lock), Add note – each writes an audit entry (demo: this browser).
- Built-in table instead of TanStack Table (package registry not reachable from the build workspace); same features, swap later without UI change.
- **Type fixes** so `next build` passes: mock content parsed through its schema (defaults applied); loaders accept schemas whose input differs from output; SiteHeader DOM KeyboardEvent.
- Tests: admin 25/25 (11 new members + speed), web 95 pass (new speed test), store white-box 6/6, eligibility white-box 15/15, `tsc` clean in web and admin.

## 2026-10-13 – A4 Work queues (owner: "move to the next task")
- Research: `research/A4-work-queues.md`. One inbox (`/queues`) with 5 queues as tabs + live counts (also as sidebar badges): Applications · Photo ID checks · Center changes · Possible duplicates · Payments to fix. List left (oldest first, age chip vs target: apps 7 d, ID 3, center 14, duplicates 7, payments 3), case right with the rule it is judged by. Filters Open · Assigned to me · Overdue · Done. Keyboard ↑↓ / J K.
- **Rules enforced in the UI:** application can go to the Board only when every check is green (photo ID is checked in its own queue); Board approval is recorded in a batch with the meeting reference (Bylaws: BOARD approves). Photo ID: name, date of birth, expiry checked; a failed check blocks "Photo ID is good". Center change: ≤ 5 miles from the border and before the request deadline (demo 03/31/2027), approved change is locked 5 years. Duplicates: side-by-side compare with reasons + score; merge or "not the same person". Payments: check received writes the payment (member becomes Active); new payment link (demo); cancel with reason.
- Decisions apply at once with **Undo** (6 s) instead of "Are you sure?"; declines/messages need text (prefilled polite templates). Every decision writes the member's audit log. Demo storage: browser (`isgh-admin-queues`); live: BE B3/B4/B6.
- Demo data: pending applicants now applied in the last 15 days (so ages are realistic).
- Tests: admin 33/33 (8 new queue journeys), queue white-box 21/21, eligibility 15/15, `tsc` clean on the PC.

## 2026-10-13 – Family tree (owner: "family tree in the dashboard and on the member portal"; chose BOTH layers)
- Research: `research/family-tree.md`. Shared engine `web/src/lib/family/family.ts` (generations, kinship words, badges, insights, layout, add/edit/remove) + renderer `web/src/components/family/FamilyTree.tsx`; admin gets copies via `npm run contracts:sync` (script now also copies the renderer).
- **Member portal** `/portal/family` + "Family tree" tile on member home: Membership family (parents → grandchildren) and Whole family + history (older generations, "Late"); highlights (members/voters, child turning 18 before 06/30/2027, adults who can join, not renewed); add/edit/remove relatives, invite to join, birthday reminder, renewal reminder; tree and list views, zoom/fit; saved in the browser (demo). Hadith on kinship: Sahih al-Bukhari 5986.
- **Admin:** Member 360° › Family tree tab + Members › Family trees (`/families`): search, "Families to reach" outreach list, invite (audited). **Staff see the membership layer only – family history is private to the member.**
- Tests: web 104 pass (9 new), admin 38/38 (5 new), family white-box 42/42, admin family builder over all 320 members clean; `tsc` clean in both apps.

## 2026-10-13 – Speed pass 2 (owner: "actions getting very slow, sometimes stuck – menus, any action – admin + website")
- **Measured on the PC:** both apps still ran the old `next dev` (webpack): every click went to the dev server – admin 0.4–2.1 s, website 0.6–2.5 s per page, ~9 MB of dev JavaScript. Admin also painted 15 frosted-blur panels on every scroll/hover; website photos went through the dev server's image optimizer.
- **Fixes:** (1) one-click launchers in `membership/`: `start-fast.cmd` (build once + run like the real servers; pages open in milliseconds) and `start-dev.cmd` (Turbopack dev); both stop old servers on 3000/3001 first and set the admin↔website preview origins. (2) Instant feedback on every click to another page: thin progress bar (`NavProgress`, capture-phase click listener) + loading screens (`app/loading.tsx` in both apps). (3) Admin glass: real frosted blur only on sidebar, top bar, menus and dialogs; content panels use deep tinted glass (blurred elements 15 → 2, same look). (4) Website photos load straight from the Pexels CDN at the right width (custom next/image loader – no server work). (5) `noStore()` guarded so `next build` never fails on build-time page lists.
- Verified on the PC: progress bar shows within 60 ms of a click; blurred elements 2. Tests: admin 41/41 (3 new speed tests), web 104, `tsc` clean.

## 2026-10-13 – Preview addresses: member-web.nextgrow.pro + member-admin.nextgrow.pro
- `web/.env.production` and `admin/.env.production` (no secrets, allowed in git) point the apps at each other: admin "Open website" + live preview → member-web; website allows framing only from member-admin; publish origin check trusts the proxy's forwarded host / NEXT_PUBLIC_ADMIN_URL.
- Admin preview protection (`admin/src/middleware.ts`): HTTP Basic sign-in on the server (ISGH_ADMIN_PREVIEW_USER / ISGH_ADMIN_PREVIEW_PASSWORD, set on the server only); closed if no password; open only in dev or with ISGH_ADMIN_OPEN=true (start-fast.cmd). Host headers are not trusted. White-box 8/8.
- Website preview sends `X-Robots-Tag: noindex` (ISGH_NOINDEX=true) – demo content stays out of search.
- `membership/DEPLOY.md`: build, pm2 start, nginx example, checks.
