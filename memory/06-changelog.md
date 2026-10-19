# Admin Dashboard – Changelog

- 2026-10-13 – Created memory folder.
- 2026-10-13 – Initialized git repo (branch main), added .gitignore and .gitattributes.
- 2026-10-13 – Added admin-control/settings/flags scope; research-first and testing rules.
- 2026-10-13 – Added build order/module plan; admin glass theme; SQL data layer references.
- 2026-10-13 – Added integration slots (SMS gateway, email gateway, Stripe).
- 2026-10-13 – Added "Admin screens that control the website" traceability table.
- 2026-10-13 – Admin app created (Next.js, port 3001): glass design system, shell, overview, theme/branding editor with live preview + contrast gate, home/menus/announcement/pages/news/giving/membership/org/flags editors, my appearance, demo store publish/history; 13 e2e tests.
- 2026-10-13 – Obsidian default look, icon rail sidebar, dashboard v2 (queue, renewal curve, zones, KPIs, donut, bars); 13/13 tests.
- 2026-10-13 – Obsidian v2: single glass window, graphite palette, rail tooltips (no scrollbar), compact dashboard.
- 2026-10-13 – Nightfall preset, Night hills wallpaper, Command center overview, nav counts, renewal card.
- 2026-10-13 – Onyx and gold luxe theme, sidebar submenus (accordion + rail flyouts), ?tab deep links; 14 tests.

- 2026-10-13 – Onyx and gold default; speed pass (Turbopack dev, `npm run fast`, fast demo forms, no wallpaper animation, debounced drafts, loading screen); A3 Members list + Member 360°; 25 tests.

- 2026-10-13 – A4 Work queues: 5 queues, inbox layout, SLA ages, assign, Board batch approval, undo, audit; 33 tests.
- 2026-10-13 – Family trees: Member 360° tab, /families page with outreach list.
- 2026-10-14 – Join form builder (/membership/form): smart helpers, Bylaws field chips, sections/questions, show-only-if rules, live preview, publish checks; sync-contracts now copies in place; 46 tests.
- 2026-10-15 – SaaS: admin knows its organization from the address (/api/platform/me): name, plan modules (menu + "not in your plan"), banners (support sign-in, payment, trial, announcements, sample records), paused screen, /welcome invitation; store per organization; 52 tests.
- 2026-10-15 – New screens: Events, Members › Groups, Communication (system emails, templates, sending/SMS, log), Settings › Configuration, Membership › Renewals and reminders + “Use ISGH’s current levels”; nav + module gate for events; 58 tests.
- 2026-10-15 – Renewal engine synced (lib/content/renewal.ts); Membership › Renewals preview; Member 360° renewal chip; eligibility uses the published plan and dues coverage. e2e tests/e2e/renewal.spec.ts.
- 2026-10-15 – Member 360 extra fields + duplicates banner + archive/restore; Members import (checked first) and export dialog; tests/e2e/records.spec.ts.
- 2026-10-15 – Groups editor: rule warnings, exceptions, delete blocked when in use; events warn about bad groups; tests/e2e/community.spec.ts.
- 2026-10-15 – Communication: renewal email timeline, field-aware merge buttons, locked receipts, Send a message (CampaignsView); use-doc shows every message per field; tests/e2e/comms.spec.ts.
- 2026-10-15 – Event registrations + check-in panel, sample receipt, code status, security warnings, idle lock, ID keep notice; tests/e2e/steps678.spec.ts.
- 2026-10-15 – A9 Reports (/reports, lib/reports/reports.ts, ReportsView), nav: Reports + Members › Voter list; tests/e2e/reports.spec.ts.
- 2026-10-15 – A10: lib/access (access.ts, use-access.ts, server-access.ts, audit.ts), Settings › Admins and roles + Audit log, Acting as (demo) in the top bar, role checks in DocEditor / members / reports / events / messages; tests/e2e/access.spec.ts.
- 2026-10-15 – A11 Integrations: lib/integrations, IntegrationsView, store doc integrations, four-eyes check in the store API; nav Coming next = Elections, Center records; tests/e2e/integrations.spec.ts.

## 2026-10-15 – fix: older saved documents
- /groups crashed ("reading length") on groups published before match/include/exclude existed. The admin store now returns the schema-parsed document (defaults filled) and useDoc parses on load; GroupsBody guards include/exclude. Regression e2e olddocs.spec (old groups/events/org-config files). Admin e2e 87/87.

## 2026-10-15 – Members readability pass
- List: removed the 5 count cards and the 3 duplicate sidebar links (views stay as one tab row); filters behind a Filters button with removable chips; 6 calm columns (Member, Status, Vote, Plan, Zone, Last paid) – email/phone/center moved to the quick look; photo ID purge notice folded into a "1 notice" button.
- Quick look side panel: click a row (or name) – key facts, Open full profile, Record payment (opens /members/ID?do=payment); up/down arrows move, Esc closes, ?peek=ID in the address. Ctrl/Cmd-click a name still opens the full page in a new tab.
- Profile: one status line, one main button + More actions (Change center, Add note, Archive/Restore); voting checks folded when the member can vote, only failing rules shown when not; empty extra fields hidden behind "Show N empty fields"; "Admins only" is now a lock icon.
- Tests: admin e2e 90/90 (3 new readability tests).

## 2026-10-15 – Members dashboard (/members/overview)
- New sidebar item Members › Dashboard. Tiles: members (with joins sparkline), can vote, renewed % (meter), dues collected vs last year (cumulative sparkline).
- Charts: status share bar; dues payments each month (line, this year vs last year in gray, crosshair tooltip); plans donut; members and voters by zone (stacked bars); age groups (columns, ordinal blue ramp); new members by year joined (area line); how dues were paid (donut).
- One zone filter scopes everything; zone directors see only their zones. Every chart has hover + keyboard focus and a "Show as a table" view.
- Chart kit: components/charts/Charts.tsx (plain SVG, no library) + styles/charts.css. Colors: validated categorical palette (light worst CVD dE 9.1, dark 8.4) with separate light/dark steps; classes prefixed vs*/--vz* to avoid clashing with dashboard.css.
- Numbers: lib/members/overview.ts memberOverview() (white-box 23 tests). Sidebar: a more specific link now wins (Dashboard, not All members).
- Tests: admin e2e 95/95 (5 new dashboard tests).

## 2026-10-15 – Communication flow + dropdown fix
- Dropdowns: solid background + option colors (Windows Chrome showed white text on white). "Start from a template" keeps the chosen template.
- Communication tabs in use order: Messages, Automatic emails, Templates, Delivery log, Settings (sidebar matches). Publish bar only on tabs that change settings (DocEditor actions prop). Status line says "built-in settings" for non-website docs.
- Messages: Drafts/Scheduled/Sent filters, 3 quick starts when empty. Composer: 1 How and what kind, 2 Who gets it, 3 Write it, 4 When – step checks, per-step problems, sticky action bar; draft saves without a name.
- Automatic emails: on/off summary; renewal timeline inside Renewals. Delivery log: automatic + staff, filter. Settings: Sender, Text messages, Tracking (SchemaForm follows `only` order).
- Research: memory/research/communication-flow.md. Tests: admin e2e 99/99 (4 new).

## 2026-10-15 – F1 Zones and Islamic Centers
- New Zones and centers screen (/zones): zone cards (director, term, counts), centers by zone (add/edit dialog with ZIP hint, phone formatting, Jumuah times, services), ZIP codes (lookup, one zone per ZIP, member ZIPs without a zone). Document org-structure; warnings at top. Tests: wb 31, e2e 4, admin 103/103.

## 2026-10-15 – Roles added module by module (from the Figma prototype)
- 11 modules (Members, Zones and centers, Zakat and Sadaqah, Donations and finance, Events, Communication, Website, Benefits and community, Reports, Elections, Settings); 34 permissions, each in one module; modules not built yet are marked (F2–F7).
- 22 built-in roles listed by area. New: Executive Board, Associate Director (own center, view only), Center admin (own center), Zakat Committee Chair (L3 + override + rules), Central Committee Member (L2), Local Zakat Coordinator (own center, L1), Zakat Operations Office (pays out), Office admin (intake), Treasurer (view only), Finance team, Communication manager.
- New scope: own Islamic Centers (admins pick centers from Zones and centers). Members list, profile and dashboard follow it.
- Zakat approval level per role (amounts set in Zakat settings, F2). Warnings: nobody can pay out, no chair, same person approves and pays.
- Older saved admin documents upgrade on load (built-in roles follow the current definition, new ones added). Zones map now published with centers.manage.
- Roles screen: list by area + one role at a time, permissions module by module (modules it uses first). Tests: wb access 50, admin e2e 105/105.

## 2026-10-15 – F2 Zakat and Sadaqah
- Rules in web/src/lib/community/zakat.ts (synced): settings (level limits $400/$750/$1,000, response hours 24/12, monthly help up to 6 months, Sadaqah routing + fast threshold, home visit above $1,000, ways to apply), case model, levelFor/nextLevel/isFinal (limits apply to the total of all months), actionsFor per role, approve/decline/pay, separation of duties (one approval per person; approvers never pay), response time and overdue, stats. 12 demo cases.
- Admin: Zakat and Sadaqah menu – Dashboard (needs you, flow, KPIs), Applications (filters, CSV), Approvals (levels, waiting for you/others), Payouts, Reports (4 charts + tables), Settings (/zakat/settings, publish needs zakat.settings). Case side panel with steps and role actions; New application (ZIP routes to zone/center).
- Center-limited coordinators/directors see their centers only; view-only roles see a notice. Audit area zakat.
- Tests: wb zakat 45; e2e zakat 5 (full journey by 5 roles); admin 110/110. BE: BE/memory/api-contract-zakat.md.

## 2026-10-16 – F3 Donations and Check-o-matic
- Rules in web/src/lib/community/donations.ts (synced): funds (restricted, goes to given/main/all centers, Zakat fund, active), main center, platforms (Stripe, PayPal, Medina kiosk, Bloomerang + cash/check), receipt from $250, Check-o-matic setting (off / supporter / application / member, smallest gift $40, funds that count, counts as dues only with "member"). Default: application that the Board approves, does not count as dues (owner can change). Gift model, reconciliation (matched / needs a fund or donor / waiting for deposit / refunded), fund routing, receipts, cash/check checks, Check-o-matic valid until June 30. 48 demo gifts.
- Admin: Donations menu – Overview (4 KPIs, 4 charts), All gifts (filters, CSV), Reconciliation (fix unmatched, "Deposit arrived" per platform batch, platforms), Check-o-matic (donors who qualify → Send to the Board / Add as member, creates the member record), Funds and rules (/donations/settings, publish needs finance.manage). Gift side panel (place, receipt sent, refund); Record cash or check (needs donations.reconcile).
- Center-limited roles see only their centers' gifts. Audit area donations. Other organizations start with Check-o-matic off and no platforms.
- Tests: wb donations 35; e2e donations 9; admin 119/119; tsc admin + web clean. BE: BE/memory/api-contract-donations.md.

## 2026-10-16 – F4 Member benefits
- Rules in web/src/lib/community/benefits.ts (synced): partners (category, near which center, agreement end, status proposed/approved/paused/ended, suitability review: halal, no interest-based products, family-friendly; staff-only contact and notes), offers (percent / dollars off / free / member price; show card / shared code / personal code / link; plans; dues-paid only; once / monthly / yearly / every visit; dates; draft/live/paused; featured), rules (show to members, review required, show offers for other plans as locked). Checks: live offer needs an approved (and reviewed) partner, cannot run past the agreement, code and link formats. Personal codes ISGH-XXXXXX per member and offer. memberSafe() strips staff data before anything reaches members. Warnings (waiting approval, review, agreement ended/ending, offer ending, partner without offers). Separate from the dues/event discount codes in Configuration.
- Admin: Member benefits menu – Overview (KPIs, uses by month, categories donut, top offers, how used), Offers (coupon cards, filters, side-panel editor with member preview), Partners (table, side panel, Mark as reviewed), Use log (filters, CSV, Record a use – plan/dues/limit checked), Rules. Publish needs benefits.manage; new role Benefits coordinator (+ demo admin "benefits"). Audit area benefits. Other organizations start with benefits off and no partners.
- Website: Member portal › My benefits (/portal/benefits) – offers best first, category chips, Use this offer (card / code / personal code / link, use counted), used-up reasons; member home tile "My benefits".
- Tests: wb benefits 70, access 52; e2e admin benefits 7 (admin 126/126), web benefits 4 (web 129/129), saas 15/15; tsc admin + web clean. BE: BE/memory/api-contract-benefits.md.

## 2026-10-16 – F5 Elected officials
- Rules in web/src/lib/community/officials.ts (synced), from the Constitution (Art. V) and Bylaws (Art. V–VII, 28 Sep 2025): seats (4 Board officers, Zonal Directors, Associate Director per center, Area Representatives, 5 Secretaries per center); Area Representative seat formula (1 per 40 eligible voters per ZIP, max 2, 4 from 160+, small ZIPs grouped or joined to the smallest ZIP above 40, minimum 4 with at-large seats, +youth +sister when more than 10); election day (2nd Sunday of December), oath/term start (1st Sunday of January, skipping the New Year weekend and Eid, or the 2nd Sunday after the election), two-year terms, even/odd ballots per seat; one elected office per person; vacancy rules (Board appoints, Council appoints, VP becomes President; orientation within a week); checks against member records (eligible voter, lives in the zone / center / ZIP, 1 year for Board, 2 years for President/VP, consecutive and five-term limits); warnings (empty seats grouped per center, ended terms, missing oath, secretaries after 60 days, zones map disagreement). publicOfficials() for the website (no member IDs, ended terms hidden), findMyRepresentatives() by ZIP.
- Admin: Elected officials menu – Overview (seats filled, must fix, next election and oath, seats by zone chart, who is on the ballot), Board (Shura), Center leadership (Administrative Body + Council with seat table), Vacancies (record appointment), Rules (website, Eid dates, election/oath calendar). Side panel per person with member lookup. View: members.view; publish: officials.manage (Owner, Admin, Election Commission). Audit area officials.
- Website: /leadership – Board, open seats, center leadership, "Who represents me?" by ZIP. Footer and Islamic Centers menu link. Web now reads org-structure from the store (getOrgStructure).
- Tests: wb officials 69; e2e admin officials 8 (admin 134/134), web leadership 2 (web 131/131), saas 15/15; tsc admin + web clean. BE: BE/memory/api-contract-officials.md.

## 2026-10-16 – F6 Prayer times and Meeting minutes
- Prayer times: web/src/lib/community/prayer.ts (synced). Adhan calculated (solar formulas as PrayTimes.org; ISNA 15°/15°, standard Asr – the method on ISGH's monthly sheets; Houston downtown coordinates; America/Chicago with DST; minute adjustments fajr +2, dhuhr/asr/maghrib/isha +1). Tested against ISGH's printed September 2025 sheet: 161/180 exact, never more than 1 minute off. Other methods (MWL, Egypt, Umm al-Qura, Karachi) and Hanafi Asr selectable. Iqamah rules per center: fixed time or minutes after the adhan, rounded, by season (ranges may wrap the new year; gaps refused). Eid/special prayers, Hijri date (Umm al-Qura, ±2 days), next prayer. Checks: iqamah before adhan, after the next adhan, Fajr <10 min before sunrise, Maghrib >15 min, Isha near midnight.
- Admin /prayer-times: Today (adhan strip + iqamah at every center + Jumu'ah from Zones and centers), Monthly timetable (print, CSV), Iqamah rules (seasons, 7-day preview, copy to my centers), Calculation and Eid (calculation needs settings.manage; center admins edit only their centers). Publish: center.content.
- Minutes: web/src/lib/community/minutes.ts (synced) from Bylaws Art. IX – bodies (Council, Board, Executive Body + ADs, Joint, zone Joint, General Assembly), notice (special Council 48 h, special Board 24 h, GA and special Joint 14 days), quorum (Council/Board majority, Joint one third, GA one fourth), decisions (Board: majority of all members; others: of those present; two-thirds option), approve → publish to leaders/members/public, calendar check (Council and Board monthly, Exec+AD Jan/Mar/Jun/Sep, Joint March and September, GA September, Secretaries at 3+ Council meetings, old drafts, remote regular meetings, no quorum).
- Admin /minutes: Meetings (filters, side panel: roster from Elected officials, attendance → quorum, decisions with live result, approve, publish) and Calendar check (year grid ✓/✕). Council minutes: center.content in scope; Board/Joint/GA: settings.manage. Audit area minutes.
- Website: /prayer-times (center picker remembered, today with next prayer, Jumu'ah, Eid, month table); member portal /portal/minutes (published minutes for members, decisions); links in menus.
- Tests: wb prayer 41, minutes 43; e2e admin f6 7 (admin 141/141), web f6 2 (web 133/133), saas 15/15; tsc admin + web clean. BE: BE/memory/api-contract-prayer-minutes.md.

## 2026-10-16 – F7 Finance
- Rules in web/src/lib/community/finance.ts (synced), from the Bylaws: fiscal year = calendar year (Art. X); Treasurer handles all monies, accounting manual with approval process, quarterly statements, budget to the Board, audited report (Art. IV Sec. 5); center Finance Secretary: budget and quarterly statements to the Treasurer (Art. VI Sec. 3); two-year plan approved every year (Art. III Sec. 3); Art. XII Sec. 4 – cash given/lent to one party over $20,000 in 12 months needs the Joint Board-Councils, over $50,000 the General Body (goods and services and approved disaster relief excluded).
- Settings document `finance-settings`: funds (restricted + purpose), opening balances, bank accounts (last 4 digits only), approval levels per role (center office $1,000 own centers, finance team $5,000, Treasurer/Admin/Owner $20,000 – demo values), two approvals above $5,000, Board decision above $20,000, budgets per center (Council) and HQ (Board), plan and audit dates.
- Ledger records: income, expense, transfer, aid; approvals (no self-approval, no payment to yourself, role limits, own centers), pay/transfer, Board decision linked to a meeting from Meetings and minutes. Donations and Zakat payouts appear as records approved in their modules.
- Reports: fund balances, income vs spending by month, budget vs actual with year marker, activity by fund (CSV), quarterly statements tracker. Grouped warnings.
- Admin /finance: Overview, Transactions, Approvals, Budgets, Statements and reports, Finance rules. Treasurer now has finance.manage; center admin gets finance.view for its centers. Audit area finance.
- Tests: wb finance 56; e2e finance 7 (admin 148/148), web 133/133, saas 15/15; tsc admin + web clean. BE: BE/memory/api-contract-finance.md.

## 2026-10-16 – F8 Fundraising
- Rules in web/src/lib/community/fundraising.ts (synced): campaigns (address, fund from Donations, goal, dates, center, story, draft/published/closed, monthly giving, donor wall, featured), matching sponsors (ratio, cap, window inside the campaign; matched in gift order until the cap), personal (peer-to-peer) pages members start, staff approval, smallest page goal; pledges (paid by pledge gifts, past due); donor insights (new, retained, retention %, LYBUNT, SYBUNT, monthly donors, top donors). Money stays in the campaign's fund (Zakat stays Zakat). publicCampaigns() computes totals on the server – no gift records, no amounts with names; donor wall = first names of donors who allow it.
- Admin /fundraising: Campaigns (cards with thermometer incl. matched part, side panel editor, office gift), Personal pages (approve / do not approve / hide), Pledges (add, status), Donor insights (KPIs, donor mix chart, LYBUNT/SYBUNT lists with CSV, top donors). New permission fundraising.manage (Owner, Admin, Treasurer, Finance team); view needs donations.view. Audit area fundraising.
- Website /campaigns: live campaigns with progress, one campaign (story, "your gift is doubled" while matching lasts, donor wall, personal pages), personal page view, "Raise money with your own page" (sign-in, goal checked, sent for approval – demo). Menu link under Give.
- Tests: wb fundraising 37; e2e admin fundraising 6 (admin 154/154), web f8 3 (web 136/136), saas 15/15; tsc admin + web clean. BE: BE/memory/api-contract-fundraising.md.

## 2026-10-16 – Masjid CRM (M1–M6): masjid by ZIP, scoped roles, one sign-in with dashboards
- Owner request: every masjid has its own admin and working body; the Super Admin sees all; members have their own
  dashboard; login options dynamic; Super Admin creates roles, permissions and assigns them (an AD role must be tied
  to a masjid); everyone belongs to a masjid by ZIP code. Reference: owner's org chart (EB 4 + 5 Zone Directors;
  each center: Associate Director, Membership / Finance / Education Secretaries, other secretaries, Area Reps by ZIP).
- Research: RBAC "role assignment = person + role + scope", scopes nest (organization → zone → masjid → ZIP area)
  and flow downward (Azure RBAC); multi-campus church systems tag people to a campus and limit campus admins to it.
- M1 Masjid service areas: `zips` on each center in org-structure; a ZIP belongs to one masjid, inside that masjid's
  zone (checked); centerForZip / homeForZip / unservedZips; warnings for ZIPs without a masjid and masjids without ZIPs.
  Zones and centers › "ZIP codes and masjids" tab: each ZIP with its home masjid (select), members per ZIP;
  Islamic Centers table shows the service area. Demo members' center now follows their ZIP (same round-robin as the map).
- M2 Scoped role assignments: roles contract moved to web/src/lib/community/access.ts (synced; admin
  lib/access/access.ts re-exports it). A person keeps a main role plus `more` (other roles elsewhere), each with
  zones / masjid / ZIP codes and an end date; `zips` for area roles; `memberId`, `givenBy`. New `areaScoped` roles.
  New built-in roles (30 total): President, Vice President, General Secretary (EB); masjid working body area:
  Associate Director (now runs the masjid + team.manage), Membership / Finance / Education Secretary, Area
  Representative (ZIP-limited). New permission team.manage. inScope takes the member ZIP. actingIn / assignmentsOf /
  whereOf. cannotAssign: organization admins give any role (only an Owner makes an Owner); a masjid leader gives masjid
  roles only, in their own masjid, never more than they have, never an AD. teamChangeProblem + server teamProblem:
  the store API re-checks every change a masjid leader publishes (roles, other masjids, other people refused).
  Warning: masjids without an Associate Director (grouped).
- M3 UI: "Give a role" dialog (person new/existing → role → where → end date, plain-words preview); Admins table lists
  all roles of a person; "Give another role" / take away; Roles: New role, "Only some ZIP codes of their masjid";
  Masjid working bodies tab (zones → masjids with seat meters → one masjid as an org chart with vacant seats and Area
  Reps by ZIP); /team "Working body" for masjid leaders (team.manage). DocEditor got publishPermission.
- M4 One sign-in, many dashboards: settings document `sign-in` (methods Google / email code / text code / password,
  chooser ask / last / main, dashboard names, Find your masjid, staff note) – Admin › Settings › Sign-in and
  dashboards with a live preview per person. Website sign-in follows it; after sign-in POST /api/auth/dashboards
  (demo: code required, no emails returned; another organization never sees ISGH's admins) lists My membership /
  Organization / Zone / Masjid / My area; one → opens, several → chooser with "remember". The admin reads ?as=&dash=
  once (demo hand-over) and has a Dashboard switcher in the top bar (cookie isgh-dash).
- M5 Home by dashboard: masjid roles → Masjid dashboard (iqamah today, members, renewed %, voters, applications,
  to-do, members by ZIP with Area Rep, working body, coming events, links by permission); Area Rep → same, only their
  ZIPs; Zone director → Zone dashboard (every masjid of the zone). Organization roles keep the overview.
- M6 Member home: "My masjid" tile (masjid by home ZIP, Associate Director and Area Rep from public officials,
  office phone, request a change) and "Switch dashboard" link.
- Demo people (fictional): Yasir Karim (demo) – member + AD of Southeast Islamic Center 1 + Area Rep 77062
  (ad.se1@example.org); President (demo); General Secretary (demo); SE1 secretaries; Area representative 77502;
  Southwest zone director is also AD of Southwest Islamic Center 1.
- F9 (paused, logic done): events approval + promotion fields, event-ops.ts (calendar, clashes incl. Jumu'ah and Eid,
  approval checks, promotion steps, analytics, 36 demo past events); center offices send events for approval.
  Screens (calendar / approvals / promotion / analytics) still to build.
- Tests: wb access 91, org-structure 46, signin 25, eventops 54 (all wb green); e2e admin masjid 10 (admin 164),
  web masjid 7 (web 146), saas 15; tsc admin + web clean. BE: BE/memory/api-contract-masjid-crm.md.

## 2026-10-16 – F9 Events extras (screens)
- Admin /events/plan "Event planning" on the same `events` document (Events menu is now a group: All events, Calendar,
  Approvals, Promotion, Analytics):
  - Calendar: month grid (Sunday first), place filter, chips by state (published / draft / waiting for approval),
    clash markers (same place and time, Friday Jumu'ah of that masjid, Eid / special prayers), Eid names on the day,
    a day panel with each event's clashes and prayer-break tips.
  - Approvals: rule (masjid offices need approval, days ahead); each waiting event with 6 checks (lead time,
    description, address/link, capacity for paid events, no clash, promotion plan); Approve and publish / Ask for
    changes (note required); recently decided list. Only organization-wide events.manage approves.
  - Promotion: feature on the website (Events page shows featured first with a label), announcement email audience +
    date (not after the event), text message + date, social post written from the event (edit, copy), timeline of
    everything that goes out incl. registration reminders.
  - Analytics: events, people who came, show-up %, no-shows, seats filled, money; by month and by kind; best and
    low show-up (<60%) events; masjid offices see only their masjid. Demo history = 36 fictional 2026 events.
- Events list shows "Waiting for approval" / "Changes asked" on the row; masjid offices get "Send for approval".
- Tests: wb eventops 54; e2e admin eventsplan 5 (admin 169/169), web 143/143 (featured first), saas 15/15;
  tsc admin + web clean.

## 2026-10-16 – Admin audit (every page and sub-menu, as 11 roles)
- Crawled all 90 admin pages: no script errors, every sub-menu opens the right tab, no blocked links in any role's menu.
- Fixed:
  - Permission bug: '/membership' matched '/members', so anyone who could see members also got the Membership rules
    menu and pages (view-only). Paths now match whole segments (wb test added).
  - Page guard ignored ?tab= (Voter list link showed for Area Reps but the page blocked them).
  - Phones: 30 pages scrolled sideways (wide tables, tab bars, long notices). Everything now scrolls inside its own box.
  - Overview greeted everyone as "Mohammad" – now the signed-in person; member KPI and zone donut use the member records.
  - "Renewal season" sidebar card only for people who can change membership rules.
  - "Working body" link showed an empty page to organization admins – now only masjid roles see it; organization
    admins get "Masjid working bodies" as its own page (/masjids) instead of a tab hidden in Admins and roles.
  - Tab "Join form" renamed "Pledge and consents" (it is not the Join form builder).
  - Ctrl+K: page names rank first; duplicate names (three "Approvals") no longer mix up.
- Menu re-organized into sections: People (Members, Work queues, Communication, Membership rules) · Masjids (Masjids
  and zones, Prayer times, Events) · Money (Zakat, Donations, Fundraising, Finance, Member benefits) · Governance
  (Elected officials, Meetings and minutes, Elections: voter list, candidates, Area Representatives) · Website
  (Website, Giving page) · Admin (Reports, Settings). New icons for Prayer times and Elections.
- Icon rail: one icon per section; hovering shows the section's groups and pages in columns (the old rail had 21 icons
  and the lower ones fell off a 720-px screen).
- Tests: admin 169/169, wb access 92.

## 2026-10-16 – Officials ↔ access (one source of truth) + focused menus for masjid roles
- Research: identity lifecycle "joiner – mover – leaver" – the authoritative record (here: Elected officials) drives
  access; access is given when someone starts serving, changed when the seat changes, removed when they stop; access
  no record explains is reviewed periodically (yearly recertification).
- web/src/lib/community/officials-access.ts (synced): roleForSeat (officers → President / Vice President / General
  Secretary / Treasurer; Zonal Director → zone-director; AD → associate-director; Membership / Finance / Education
  Secretary → same; Area Rep → its ZIPs, at-large → the whole service area; Administrative and Youth Affairs
  Secretaries need no system role) and reconcile → give / update / take away / review, sorted by urgency.
- Access contract: assignments carry holderId (the seat) and reviewedOn (kept on purpose; asked again after a year).
- Admin › Masjid working bodies: tabs "By masjid" and "Officials and access" (tiles + list with Give access – the
  dialog is pre-filled with the official's name, office email, role and scope and links the seat – Update access,
  Take access away, Keep for a year). Each masjid's org chart also shows its own list. Elected officials cards show
  "Has system access" / "No system access" / "Still has system access" (red when the term ended).
- Menus: organization-wide rule pages (Zakat settings, Funds and rules, Finance rules, Calculation and Eid, Officials
  rules, Benefit rules, Zones, Communication settings, Donor insights) are left out of masjid and zone roles' menus
  (still readable by link, read-only).
- Demo: Treasurer and Southwest zone director linked to their seats; Ahmed Jaffer (demo) – AD of Southeast 2 whose
  term ended – still had access (the "leaver" example).
- Tests: wb officials-access 27, access 92; e2e admin 172/172, web masjid 7/7; tsc admin + web clean.

## 2026-10-16 – Overview (Command center) look and feel
- Hero: "the membership year" (components/views/YearRibbon.tsx) – a nine-month band from this month with the dates
  everyone works toward: renewals open Nov 1, Election Day (second Sunday of December), memberships end Dec 31, oath
  of office in January, record date June 30 (own dues paid = a vote). "Today" on the band, a countdown to the next
  date on the left; labels take free lanes so they never overlap; on phones it becomes a list.
- Layout: date moved to the header; row 3 = application pipeline + dues and gifts (wider); "Newest members" is its
  own full-width row with aligned columns (no more cut-off names); renewals chart gets "busiest month / renewals /
  new members" facts and readable axis text; zone donut has a readable center number.
- Charts (dataviz rules): dues bars are solid with 4-px rounded tops, this month in full gold, the rest muted (no
  fading gradients); legend on one line; chart height capped on tablets.
- Light mode (Onyx and gold): KPI icons, the Demo pill and sidebar badges use deep gold so they are readable on ivory.
- Tablet (821–1180 px) keeps the four KPI tiles in one row.
- Tests: admin dashboard/admin/access specs 25/25; tsc admin clean.

## 2026-10-16 – A Dashboard in every menu (filters, report, export)
- Every menu group now opens with **Dashboard** (like Overview): Members, Work queues, Communication, Masjids and zones,
  Events, Zakat and Sadaqah, Donations, Fundraising, Finance, Member benefits, Elected officials, Meetings and minutes,
  Elections, Website. Prayer times starts with "Today". Command palette names them "<Menu> dashboard".
- New pages: /queues/dashboard, /communication/dashboard, /masjids/dashboard, /events/dashboard, /minutes/dashboard,
  /elections, /website (components/views/ModuleDashboards.tsx). Existing overviews renamed to Dashboard tabs.
- One toolbar on every dashboard (components/charts/DashKit.tsx): time (past or ahead), zone, masjid, plus a link to
  the full report, Download CSV and Print. Masjid and zone roles are locked to their own area (shown as a chip).
- Download CSV = totals exactly as filtered on screen (headline numbers + every chart's table). No names, emails or
  phones in dashboard exports; UTF-8 BOM; formula-injection guard; each download is written to the audit log.
- Elections dashboard knows the record date has passed (voter list frozen; "missed only by dues" for next year).
- Events dashboard: weekly columns for 30 days / 3 months, monthly for longer periods.
- Officials dashboard: "To fix" shows 8 with "Show all"; Fundraising opens on its Dashboard tab.
- Permissions: /masjids/dashboard and /elections need members.view (numbers filtered to the role's area).
- Tests: new dashboards.spec (7) – toolbar on 14 dashboards, Dashboard first in each menu, filters change numbers,
  CSV content, masjid and zone locks, week/month buckets. Admin suite 179/179; access white-box 94/94; tsc clean.
- Role builder ↔ dashboards (checked 2026-10-16): a role made in Settings › Admins and roles › New role, with its own
  permissions, tagged to an admin: that admin's menu and dashboards are exactly the role's modules (e2e test
  "a role built from scratch" in dashboards.spec – Zakat reviewer sees Members, Work queues, Zakat, Officials,
  Meetings, Elections; Donations / Finance / Website / Settings pages are hidden and refused by address).

## 2026-10-16 – Everything belongs to a masjid (ZIP code): one shared masjid filter, home ZIP for every admin
- Research: Planning Center uses a sticky per-list "Campus" filter with a "No campus" choice and has NO campus-based
  permissions; Mohid is one tenant per organization. ISGH keeps its scoped roles and adopts the sticky filter.
- Admin model (M5): AdminSchema.homeZip – the ZIP code the person lives in → their home masjid (centerForZip).
  Rule: a couple of Owners are the organization's super admins; everyone else belongs to a masjid + ZIP.
  accessWarnings names admins without a home ZIP; the Admins table has a Masjid column (name + ZIP), the edit row a
  Home ZIP field that shows the masjid it resolves to, and Invite asks for the ZIP. All demo admins have one.
  homeZipOf(): own ZIP, else the first ZIP of an area-limited role.
- One shared filter "Viewing" (lib/access/masjid-filter.ts, components/shell/MasjidPicker.tsx): All masjids › a zone ›
  one masjid, plus "Not routed yet" where records can lack a masjid (gifts, Zakat cases, events, benefit uses).
  The choice sticks across screens (localStorage), shows as a chip in the top bar (× clears it), and is locked for
  masjid and zone roles. Dashboards (DashKit.useScope) read the same choice.
- Filter added to: Work queues (tiles + list), Events (tabs + list; a new event starts at the viewed masjid), Groups
  (members "here", empty groups hidden), Family trees, Donations › All gifts (after fund routing), Zakat applications
  (replaces the zone select), Fundraising campaigns (organization-wide ones always stay), Benefits use log,
  Elected officials › Center leadership (follows and sets it), Reports (all tabs), Admins list, Members list (fills the
  zone/center filters; choices here are shared back) and every dashboard. Finance, Minutes, Prayer times keep their own
  center selects. Communication delivery log has no masjid on a send – left alone on purpose.
- Tests: viewing.spec (4) – sticky across 8 screens, zone + "Not routed yet", locks for masjid and zone roles, home ZIP
  rules and invite; access white-box 101/101; admin suite 184/184; tsc clean (admin, web).

## 2026-10-16 – Masjid admin home brought to the Overview standard
- "/" for masjid roles (components/views/MasjidHome.tsx) now shares the Overview frame: greeting + date, masjid band
  (zone, city, ZIP codes, Jumu'ah times, today's iqamah), the membership-year ribbon, four KPI cards with sparklines,
  two-column grid and a side column; footer status. Area Representatives get the same, limited to their ZIP codes.
- Every number is from the masjid's own records: current members and who joined this year (trend by month), renewed
  for the year, dues collected vs last year by the same date (from member payments), voters; dues payments by month
  (this year vs last, line chart with table); members by ZIP (renewed / not) with the Area Representative per ZIP.
- Needs attention is built from the masjid's queues (applications, photo IDs, moves, payments), not-renewed members,
  events waiting for approval, open Zakat cases (zakat.view only), missing Council meetings (minutes), vacant working-
  body seats and ZIPs without a representative. Newest members (by approval date) with plan, ZIP, status and last dues.
- Side column: working body (seats filled), coming up at the masjid, work-queue counts, the role's page links.
- Tests: masjid.spec +1 (records agree across cards, attention items, secretary sees no Zakat line and cannot manage
  the body); 2 selectors updated. Admin suite 185/185; tsc clean.

## 2026-10-16 – No personal names anywhere
- Owner direction: no real names in the product, demo data, tests or notes. The demo Owner is now "Mohammad (demo)"
  (admin id `owner`, email owner@example.org / owner@isgh.org); the demo official "Junaid Akhtar" is "Junaid Siddiqui".
  Applied across admin, web, saas, BE notes, memory files, e2e and white-box tests and the demo store (rename.sh).
  Admin 185/185, saas 15/15, web 143/143, white-box all green; tsc clean (admin, web).

## 2026-10-16 – Real photos, favicon and app icons
- Photos (Pexels, free license, no credit needed) across the admin via one manifest (src/lib/images.ts): a section
  band with the page title inside it on every module page (SECTION_ART per sidebar group), photo bands behind the
  Overview greeting and the masjid home band, a full-bleed photo behind the Welcome card, six photo wallpapers in
  My appearance (Houston at night, Houston skyline, Arches, Geometric ceiling, Blue mosaic, Crescent night), a faint
  (8–9%) section photo behind filter bars and search panes, and photo empty states (.cv-empty, .empty-state).
- Photo component (components/shell/Photo.tsx): local file first (admin/public/img/<key>.jpg), the Pexels address as
  fallback, so nothing is blank before the files exist. Every photo sits under a veil; light and dark checked.
- One-time fetch: `node tools/get-images.mjs` from the admin folder saves all 32 photos to public/img (needs a normal
  internet connection – the Cowork shell cannot reach images.pexels.com). Re-run with --force to refresh.
- Favicon and icons made in code (PIL, no font): ISGH star-and-arch mark, gold on onyx – favicon.svg, favicon.ico
  (16/32/48), favicon-32x32.png, apple-touch-icon, android-chrome 192/512, maskable 512, og-default; a web manifest;
  layout.tsx lists them; theme color #0B0B0E.
- A stacking-context lesson: the overlapped page title must not give .page a z-index – fixed side panels (quick look,
  officials' holder panel) fell under the top bar. Admin 185/185; tsc clean.

## 2026-10-17 – E1 Elected members history (upload by year and position)
- Owner direction (feedback memory 23): every change must fit other organizations too – nothing hard-wired to ISGH;
  rules are configuration with ISGH's values as the demo preset. E1 is the first item of the recordings backlog.
- Contract (web/src/lib/community/officials.ts, synced to the admin): `history: Term[]` on the officials document –
  one record per election year × position × person (kind incl. 'other' for titles the Bylaws do not know, the title
  as written, zone/center/ZIPs, member ID, how, term dates, end reason, notes, source upload/manual/archived,
  showOnWebsite); `website.pastLeadership` switch. Old saved documents still parse (history defaults to []).
  Functions: readDate (US/ISO/written dates), matchPosition (title + zone/center columns → seat), planHistoryImport
  (CSV check: missing columns, bad dates/years/ZIPs/IDs, unknown centers or zones, same seat twice in a year and
  one person in two elected offices → "already filled", 2,000-row cap, term dates filled from the election year and
  the oath rule), historyByYear, historyByPosition (current holders lead each timeline), boardTermsServed (term
  limits from the history), historyRows/HISTORY_TEMPLATE_ROWS (export = template layout), publicPastLeadership.
- Admin › Elected officials › History tab (components/views/OfficialsHistory.tsx): by year / by position views,
  search, Upload elected members (template download, paste or file, check → add), Add a past term, Export, remove a
  row, per-term website flag. Marking a seat vacant / recording an appointment archives the ended term into the
  history automatically; the holder panel shows earlier Board terms counted from the history. Read-only for roles
  without officials.manage.
- Website › Leadership: "Past leadership" section (by election year, Board and center heads only, never Area
  Representatives, Secretaries or member IDs) when the switch in Elected officials › Rules is on.
- Tests: admin e2e officials-history.spec.ts (5), web leadership.spec.ts (+1), white-box wb/history.test.ts (55).

## 2026-10-18 – P1–P3 Membership plans as configuration (presets, Check-o-matic rule, lifetime by donation)
- Contract (web/src/lib/content/membership.ts, synced): `rules` on the membership-settings document, every rule a
  switch with editable numbers – qualifyingGifts ("monthly contributors are members": plan, label, minimum per
  month, yearly total, cut-off MM-DD, recurring-only or any gift, covers spouse, rollover), lifetimeByDonation
  (threshold, single gift / calendar year / all time, lifetime plan granted, needs approval), household (who a
  household plan covers, in words), approval (who approves, only after full payment, only after ID check).
  Validation: a rule that is on needs an existing plan (lifetime rule: a lifetime plan), total ≥ one month,
  real cut-off date. Old documents parse (rules default off). Helpers: qualifiesByGifts, lifetimeByDonationReached,
  rulesInWords (the website's sentences). PLAN_PRESETS: "ISGH today (isgh.org, 2026)" – Check-o-matic (primary and
  spouse, $10+/month, $40 by June 30), Individual $20, Lifetime $1,000 / $1,500 or by a $25,000 gift – plus the
  older Wild Apricot levels and the Bylaws demo set. Nothing in the product depends on a preset.
- Admin › Membership rules › Plans and dues: a purpose-made editor (components/views/PlansEditor.tsx) replaces the
  generic form. Plan cards whose fields follow the term – a lifetime plan never shows renewal or multi-year prices
  (the two errors seen in the review call came from the generic form offering them); switching the term cleans up.
  Covers / member class / term as segmented choices, household size, fixed multi-year prices, renewal, website
  words and switches; add, duplicate, reorder, remove; "Start from a preset" with a confirm. Rules panels below;
  "How the website explains it" shows the sentences the public plans page will carry.
- Members › eligibility: when the qualifying-contributions rule is on and the member holds that plan, the dues check
  becomes "contributions reach $X by the cut-off" with the shortfall in words (demo members keep the Bylaws plans;
  live: the member module reads the published settings).
- Website › Plans and dues: "How membership works" block from rulesInWords when any rule is on.
- Tests: admin plans.spec.ts (4), community/renewal specs updated to the preset picker, web pages.spec.ts (+1),
  white-box wb/plans.test.ts (33). Admin suite 194/194.

## 2026-10-18 – Z1/Z2 Real zones and Islamic Centers as a preset
- Contract (web/src/lib/community/org-structure.ts, synced): ISGH_REAL_STRUCTURE – the five zones with ISGH's
  masjids and musallas as isgh.org/islamic-centers lists them (21 centers with street, city, ZIP; four seen on the
  Zones map as addresses only are marked "name to confirm"); each center's service area starts as its own ZIP, zone
  ZIPs are the union. Directors, phones, websites, Jumu'ah times left for the admin. STRUCTURE_PRESETS: the real
  set and the demo map (four fictional centers per zone, which the demo members use). Zone IDs are unchanged, so
  members, officials and roles keep working after a load.
- Admin › Masjids and zones: "Start from a preset" (Map preset + Load into the draft, confirm with counts and
  notes). Z1 – the Zones map boundaries are still needed for the full ZIP lists: the admin pastes them on the ZIP
  codes tab (a KML/ZIP export from the Owner would let us ship them in the preset).
- Tests: zones.spec.ts (+1), white-box wb/structure.test.ts (13).

## 2026-10-18 – J1–J3 + A1 Join-form policies, sign-up guide, approval rule
- Contract (membership.ts, synced): `identity` (name must match the photo ID + note, the Identity Collection and
  Verification Policy – a page of your own by URL or the built-in page with your text –, consent required + text +
  version), `guide` (How-to-sign-up page: title, intro, steps, help), `legal` (Terms / Privacy links shown with the
  text-message consent). All default on with plain-English demo text; older documents parse. The application
  carries identityConsentVersion like the other consents.
- Website: join form shows the ID note above the name fields (J2), the SMS consent with Terms and Privacy links
  (J2), and an "Identity check" block on the pledge step with the policy link and a required consent (J1);
  /membership/guide (J3) and /membership/identity-policy pages; Plans links to the guide.
- Admin › Membership rules: "Identity and sign-up guide" tab (identity policy, consent, guide page); Terms/Privacy
  links on Pledge and consents. A1: approvalBlockers() (full payment for the year / lifetime price, ID check) from
  rules.approval; the member profile's Approve dialog lists blockers, offers "Record the payment" and disables
  Approve; the work queue's Board-approval batch holds back and names blocked applications. Demo default: payment
  rule off (the ISGH preset turns it on); useMembershipSettings() reads the published document.
- Tests: admin approval-rule.spec.ts (3), plans.spec.ts (+1); web join/community/joinform specs take the identity
  consent, pages.spec.ts (+1); white-box plans 41/41. Admin 199/199, web 146/146.

## 2026-10-18 – M1 Generic member import with column matching (Wild Apricot preset)
- Contract (member-records.ts, synced): IMPORT_COLUMNS grew (middle name, ID in the old system, membership status,
  member since, renewal due, recurring, Text/SMS consent, subscribed to emails, archived, notes) with Wild Apricot
  heading aliases; IMPORT_PRESETS (any spreadsheet / Wild Apricot contact export / Breeze–Planning Center) carry
  explicit column matches and ignores; STATUS_WORDS + readStatusWord map another system's words (Active, Pending -
  New, Lapsed, Suspended, Archived…) to ours – an unknown word is an error, nobody is silently made active; readYesNo;
  matchColumns(head, {preset, mapping}) – a hand mapping wins over the preset, which wins over heading aliases;
  planImport checks the new columns (dates, yes/no, status).
- Admin › Members › Import: three steps – the file → match the columns (preset picker, every column a select with
  the first row as a sample, needed/duplicate warnings) → check and import. Active rows become approved members with
  this year's dues recorded (unless the renewal was already due), Lapsed → not renewed, Pending → pending, Archived →
  archived; consents become prefs; the old ID, renewal date, recurring flag and follow-up go into the notes.
- Tests: records.spec.ts (+1 Wild Apricot journey, mapping checks), white-box records 62/62.

## 2026-10-18 – I1 Giving platforms (Zeffy) and R1 Records library
- I1 – Settings › Integrations › "Giving platforms": accounts for Zeffy, PayPal Giving, Bloomerang, Givelify, a
  kiosk or another platform – one for the whole organization or a masjid's own, side by side (demo: ISGH Zeffy +
  Southwest Islamic Center 1 Zeffy). Stored: label, scope/masjid, giving-form address, last 4 of the API key and
  webhook secret, sync time – never a secret. Rules: a masjid account names its masjid; one account per platform and
  masjid; an enabled account needs a form address or a key. Readiness card lists each account; per-account webhook
  address /api/webhooks/<org>/giving/<account>; key changes need a second admin (adding an account without keys does
  not). Donations: Zeffy joined the online platforms (ONLINE_PLATFORMS drives the platform lists; demo gifts include
  Zeffy). Live: BE adapters per provider read gifts and payouts into Donations under the account's masjid.
- R1 – Records library (admin › Meetings and minutes › Records library, /records; website /records): minutes, annual and
  financial reports, Constitution and Bylaws, policies, newsletters, forms, election notices – for the organization
  or one masjid, each with a date and an audience (everyone / members / leaders). Follows the shared masjid filter;
  masjid roles see their masjid locked and edit only their own records; warnings (stale or missing minutes, missing
  Bylaws, masjids without records). New `records` document (registry, seed, server store, access: read members.view,
  write center.content). Website page shows public records by organization and masjid; members-only ones belong in
  the member portal (next).
- Tests: integrations.spec.ts (+1, chips now 5), records-library.spec.ts (2), web pages.spec.ts (+1); white-box
  integrations 55/55, records-lib 13/13.
- Verification 2026-10-18 (end of the night): Records library moved under Meetings and minutes (a members.view role
  must not see the Website group). Admin 203/203, web 147/147, saas 15/15; white-box access 101, history 55,
  plans 41, structure 13, records 62, records-lib 13, integrations 55, groups 39; tsc clean (admin, web).
  BE contract notes: BE/memory/api-contract-review-items.md. Status table: admin/memory/23-owner-feedback.md.

## 2026-10-18 – Elections: nominations, ballot and results (the "Next" item in the Elections menu)
- Contract (web/src/lib/community/elections.ts, synced): an election per year – editable rules (nomination window
  in days before Election Day, seconder, self-nomination, one seat per person, standing years for Board / President
  and Vice President, residency, voting method, secret ballot, tie-break, who certifies; ISGH's Bylaws values are the
  defaults), seats (from Elected officials' ballot parity and Masjids and zones – Area Representative seats from the
  eligible voters per ZIP, `seatsOnBallot()`), nominations with status, results per seat (ballots cast, spoiled,
  votes, winners), frozen voter count, certification, sworn-in date. Validation: window order, seconder before
  acceptance, seat must exist, votes + spoiled ≤ ballots cast. Helpers: nominationIssues (eligible voter, standing
  years, residence, one office per person incl. serving holders, duplicates, self-nomination), ballot (uncontested /
  empty), tally + impliedWinners (ties flagged for the tie-break rule), turnout, electionWarnings, holdersFromResults.
- Admin › Elections › Nominations, ballot and results (/elections/run): year picker and status, KPIs (seats,
  nominations, voter list, turnout), warnings; tabs Nominations (record with live checks, accept / not eligible /
  declined / withdraw / reopen), Ballot (who votes, places, candidates, take a seat off, refresh seats from the
  configuration, freeze the voter list, set the ballot → open voting → close and count), Results (count per seat,
  tie-break buttons, accept / reopen a count), Certify and swear in (certify, then the winners become serving
  holders in Elected officials with term dates and the replaced holders go to the history), Rules. Election
  Commission (voters.freeze) runs it; everyone with members.view reads it. New `elections` document.
- Tests: elections-run.spec.ts (3, serial), white-box wb/elections.test.ts (33). Admin suite 207/207.

## 2026-10-18 – Work mode (big screens), Tasks and tickets, configuration map
- Work mode: a top-bar button (Ctrl+Shift+F, Esc leaves it) folds the sidebar to icons, hides the photo band and
  platform banners and lets the page use the whole screen; remembered per admin. My appearance also has "Page width:
  Centered / Whole screen" for those who want the full width but keep the sidebar and band. Tests work-mode.spec.ts (2).
- Work queues › Tasks and tickets (/queues/tickets): complaints and feedback from the website, member requests and
  tasks admins write for each other – owner from Admins and roles, priority with a target (2/7/14 days), status,
  thread of updates, late-first list, Mine/Late/Done filters, shared masjid filter; masjid roles see their masjid
  (and organization tickets assigned to them) and create for their masjid only; sidebar badge and q:all include
  open tickets. DEMO in this browser; contract in BE/memory/api-contract-tickets.md. Tests tickets.spec.ts (3).
- memory/24-configuration-first.md: the single map of what an organization configures itself (screen → document →
  what the BE enforces) – the rule for all new work. Roles and permissions: the role builder (Settings › Admins and
  roles) with the permission catalog, scopes and custom roles is in place and covered by access.spec.ts and
  dashboards.spec.ts ("a role built from scratch").
- 2026-10-18: lib/queues/tickets.ts split – the model (types, demo, dueFor, lateBy, sortTickets, addUpdate) lives in
  tickets-core.ts without React so the API shares it; tickets.ts keeps the browser storage and the hook.

## 2026-10-18 – Product mark replaced (admin + saas public/brand)
- New NextGrow Members mark (arch + sprout in an eight-point lattice) in public/brand of admin and saas: logo-mark.svg,
  logo-mark-dark.svg, favicon.svg, icon-maskable.svg, PNG icons, favicon.ico, og-default.png. Source and brand sheet:
  company-website/brand/. The web app (tenant site) keeps the tenant's own logo.

## 2026-10-18 – Platform rebrand: Masajid Solutions
- platform.ts (web → admin/saas synced): productName "Masajid Solutions", baseDomain masajidsolutions.com, support@/billing@
  masajidsolutions.com, demo hosts member-web/member-admin.masajidsolutions.com, TXT `_masajid.<host>`, reserved slug
  "masajid". communication.ts demo links, SaasShell default product name and mark (/brand/logo-mark-dark.svg),
  saas-harness/serve.cjs serves /brand/. saas e2e 15/15. DEPLOY.md addresses must move to the new domain (DNS, wildcard
  certificate) – not changed on the server by this commit. SAAS_PREVIEW_USER default left as before (env on server).

## 2026-10-18 – Help desk and Team tasks rebuilt (owner: "I have not seen any good thing about ticketing and internal task")
- Research note first: memory/research/tickets-and-tasks.md (two jobs: Help desk for people outside the team, Team tasks for the team's own work).
- Shared contract web/src/lib/community/work.ts (synced): `work-settings` document (categories with routing to a person or "the role at the
  ticket's masjid", targets per priority with business-hours clock, due-soon %, auto-close, satisfaction, saved replies with merge fields,
  restricted categories + senior roles; task board names, labels, project templates with anchor-day offsets) + pure rules (SLA clocks with
  pause while waiting, routing, visibility, reply/note/merge/auto-close, recurring tasks, templates, workload, ticket → task).
- Work queues › Help desk (/queues/tickets): saved views with counts (Needs a reply, Mine, Unassigned, Due soon, Late, Waiting, All open,
  Solved), search, category + masjid filters, bulk assign/status/priority/merge, j/k keys; ticket = conversation (public reply vs yellow
  internal note, @mentions → followers, saved replies), two clocks, owner/priority/category/masjid, followers, tags, restricted switch,
  merge, "Create a team task", satisfaction; Dashboard tab (open, late, median first reply / solve, targets met, satisfaction, by category,
  per week, by masjid, oldest open, per owner). New ticket dialog for phone / walk-in / email with automatic owner preview.
- Work queues › Team tasks (/tasks): My work (Overdue, Today, Next 7 days, Later, No date, I asked others), Board (drag or Move menu),
  List, Calendar, Projects (progress, at risk, archive, new from template with preview), Dashboard; task drawer with checklist, sub-tasks,
  labels, repeat, links, comments with @mentions.
- Settings › Help desk and tasks (/settings/work): presets "Masjid organization" and "Simple start"; other organizations start simple.
- Overview: the fixed "Today's tasks" demo list is replaced by a live My work card (also on masjid home); stale "comes in module A4" text fixed.
- Sidebar: Help desk (open visible tickets) and Team tasks (mine due today/overdue) badges. TicketsView/tickets.ts kept as thin re-exports.
- Tests: tickets.spec.ts (7, rewritten), tasks.spec.ts (5), white-box tests/wb/work.test.ts (14). tsc clean (admin, web) on the PC.
  Full admin e2e in the cloud harness: 123 pass; the 24 that fail also fail on the code before this change (harness: no website on 3000,
  shared store order).

## 2026-10-19 – Admin icon family
- src/components/shell/nav.ts: new IconName union (53) and path map from company-website/brand/icons/icongen.py;
  NAV_TREE uses section-specific icons. Icon component unchanged (currentColor stroke 1.7). Old names kept.

## 2026-10-19 – call transcripts reconciled (no code)
- New: memory/24-call-transcripts.md – the three review calls summarized by meaning, speakers by role.
- memory/23-owner-feedback.md: Recording 1 is now covered (T-A); every "needs confirmation" item answered or marked
  "ask"; 15 new items V1, D1–D15 logged with status and a suggested order. Waiting for the Owner's "go".

## 2026-10-19 – From the review-call transcripts: V1, D1, D2, D3, D5, D7, D8, D10, D11, D12, D13, D14 (admin/memory/23-owner-feedback.md, 10/19 section)
Everything is configuration with the client's values as a preset; nothing is wired to one organization.
- **V1 Member classes are a setting** (web contract lib/content/membership.ts `rules.classes`): each of the two classes has a
  name, a line, "can vote" and "offered on the join form"; the plan editor's vote switch follows the class (Rules › Member
  classes), the eligibility check and the join form's voting preview read the setting, the join form skips the "how are you
  joining" question when only one class is offered. ISGH preset: natural = no dues / no vote, associate = the paid member
  (what the client said on the call); the generic default keeps "member votes, associate does not".
- **D13 Plan editor:** plans can carry an age range (youth / senior plans show only to those ages on the join form); one-person
  plans show "Household: not on this plan" instead of an error; lifetime plans say why renewal is gone; ISGH preset says
  "Checkomatic". Classes and ages are new optional fields – old documents parse unchanged.
- **D5 Work queues route by type** (web contract lib/community/work.ts `queues`: owners per queue = people or "the role at
  the case's masjid", round-robin or first, target days, escalate-to role, own label) – Settings › Help desk and tasks ›
  Work queues shows "today it would land on". QueuesView: "On <name> (by rule)" badge, take it, hand it to anyone (select),
  "Escalated" flag past the target; two new queues **Incomplete applications** and **Missing information** (follow-ups
  configurable: hours before the first reminder, give-up days, which fields count as missing); Overview › My work lists
  "On your desk – queue cases"; the queues dashboard adds "Whose desk the open work is on" and "How fast cases get decided"
  (per person, average days, past target). Sidebar badges for the new queues.
- **D1 Dashboards per role:** every card of the home page (command and focus layouts) and Members › Overview has an id
  (admin lib/dashboards/widgets.ts); a role hides cards under Settings › Admins and roles › role › Dashboard (editable on
  built-in roles; Owner and "manage admins" see everything). Presets from the call: the board loses the office's pipeline /
  fees / newest / suggestions, membership roles lose giving money, finance loses the pipeline. New tile "Membership fees
  this month" (dues only) next to "Giving this month"; Members › Overview's dues tile reads "Membership fee collected".
- **D2 Members opens on its Overview:** the Members group in the sidebar is a link (nav `home`), the chevron folds the list;
  the first child is called Overview.
- **D3 verified:** extra roles per person with an end date already exist (`more` assignments); the Other roles list now shows
  "until …" / "no end date". **D4 verified:** `members.contact` already hides email/phone/DOB/street for roles without it
  (board, president) and gates exports. **D9 verified:** admin and website sessions are separate cookies (Agent B's C1–C3).
- **D14 Center rules are a setting** (web contract lib/community/org-structure.ts `rules`): any center in the zone or nearest
  only, border miles and what may be asked for, proof required, lock years, lock lifted on a move, request deadline, who
  approves. Masjids and zones › Rules tab; the center-change queue's checks and the profile's Change center dialog (proof
  seen) read it; the lock date comes from `lockYears`.
- **D10 Members › Check-o-matic** (new page /members/checkomatic, needs only "See members"): every monthly giver's year held
  against the "monthly contributors are members" rule – member tagged / not in the system; counted-by-cut-off vs given;
  Contacted / "Eligible, information not provided" / Start application; CSV. Demo plan "Monthly contributor" (hidden) with
  the rule on, so the page has something to show.
- **D12 Money per center** (web contract lib/community/donations.ts `centers`): each center may have its own payment account
  (provider, name, last 4 – never a key) and its own fund list; central funds (routed to the main center or shared) always
  go to the organization. Donations › Funds and rules › "Each center's account and funds"; `fundsForCenter` /
  `accountFor` for the sign-up and giving pages (the website sign-up step that shows the center's funds is still to do).
- **D7 Portal ticket:** two help-desk categories "My membership record is wrong" / "My Islamic Center is wrong" (routed to
  the membership office) and one-tap starts on the portal's Ask or tell us page that prefill what the record says.
- **D8 Team messages** (new /inbox, admin lib/team/messages.ts): channels per department and direct threads, attachments
  (picture or file, 2 MB, demo as data URL), links to a member / ticket / task, @mentions, "Make a task" from any
  message, unread badge in the sidebar. Demo in this browser; live routes noted in the file.
- **D11 Become a member with your gift:** the giving dialog's thank-you offers membership to a monthly donor when the rule is
  on (`monthlyOffer` in the contract), with whether the gift already qualifies.
- Website join form: the class question comes from the setting; home-page plan cards show plans of voting classes.
- Tests: wb membership-classes (4), queue-routing (3), dashboards (1), center-money (3); e2e plans/queues/dashboard/
  dashboards/access updated for the new labels; members list waits for the signed-in person's scope before listing anyone.
- Merged with Agent B's live-stats home pages (home-stats.ts: `feesMonth`/`feesPrevMonth` added).
