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
  - Overview greeted everyone as "Akhter" – now the signed-in person; member KPI and zone donut use the member records.
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
