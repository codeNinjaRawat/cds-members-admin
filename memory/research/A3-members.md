# A3 – Members list + Member 360° (research, 2026-10-13)

Sources: our own `memory/10-membership-rules.md` (Bylaws), `11-reference-analysis.md`, `12-competitor-membership-analysis.md` §2.7,
plus common patterns in membership CRMs (association/masjid systems) and data-table UX guidance (Nielsen Norman "data tables",
GOV.UK table + filter patterns, WCAG 2.2 sortable table `aria-sort`).

## What staff do most (job stories)
1. "Is this person allowed to vote this year – and if not, why?" → the answer must be one glance, with the reason in plain words.
2. "Who has not renewed yet?" before the June 30 record date → saved view + export + reminder.
3. "Find a member while on the phone" → one search box for name, email, phone (any format), member ID, ZIP.
4. "Fix a record" (center override, offline check payment, ID verified) → every change needs a reason and lands in the audit log.

## Decisions
- **Saved views first, filters second.** Tabs for the 6 questions staff ask (All · Voting-eligible · Pending approval · Not renewed ·
  ID check · Life) with live counts; filters (zone, center, plan, status) refine inside a view. Views and filters live in the address
  (`/members?view=voters&zone=sw`) so a link can be shared with a colleague.
- **Eligibility is computed, never typed.** One function implements Bylaws Art. I Sec. 2 for a year: Board-approved · age 18+ on
  June 30 · own dues (or a relative's payment) on or before June 30 · Life members exempt · residency set · not resigned/expelled.
  The profile shows each rule with ✓/✗ and the reason ("Paid July 14 – after the June 30 record date").
- **Member 360°**: header (status, plan, center), eligibility card, then tabs Profile · Household · Payments · History · Audit.
- **Actions are explicit and logged**: Approve, Mark ID verified, Record offline payment (check/cash), Change center (reason required,
  5-year lock note for border requests), Add note. Demo: saved in this browser + audit entry; live: BE B3/B4/B6 endpoints.
- **Privacy**: list shows only what is needed (no DOB, no full address); profile reveals them. Export is CSV of the current view,
  with a confirmation that names the count. (Live: role scopes – center admins only see their center, A10.)
- **Speed**: client-side table for the demo (320 members); live: server-side paging/sort/filter (`GET /admin/members?…`), same UI.
  TanStack Table was planned; the registry is not reachable from this workspace, so a small built-in table is used with the same
  features (sort, filter, paging, selection) – can switch later without UI change.
- **Mobile**: rows become cards; actions stay reachable.
