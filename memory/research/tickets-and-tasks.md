# Research note – Help desk (tickets) and Team tasks (2026-10-18)

Owner feedback: "I have not seen any good thing about ticketing and internal task." The first version (one list,
four kinds, one thread) mixed two different jobs. This note splits them, the way mature teams do.

## Two different jobs
| | Help desk (tickets) | Team tasks |
|---|---|---|
| Who starts it | someone **outside** the team – member, visitor, donor (website form, member portal, phone, email, walk-in) | someone **inside** the team |
| Goal | answer and solve for that person, on time | get the team's own work done (Eid prayer, AGM, election timeline, monthly reports) |
| Shape | a conversation: public replies + internal notes | a plan: projects, owners, due dates, checklists, sub-tasks, recurring work |
| Measured by | first response time, time to solve, targets met %, satisfaction | done on time, overdue, workload per person |
| Proven patterns studied | Zendesk, Freshdesk, Help Scout, Front, Jira Service Management | Asana, Linear, Trello, ClickUp, Basecamp, Microsoft Planner |

(Patterns only – no design or text is copied, golden rule 5.)

## Help desk – what senior teams do and what we build
1. **One inbox, many channels.** Website complaint / feedback / question forms, member portal "My requests", phone and
   walk-in logged by staff, email-in later (BE). Every ticket keeps its channel.
2. **Categories drive routing.** The organization sets categories (Membership and dues, Donations and receipts,
   Facilities and parking, Events, Website, Weekend school, Complaint about conduct, Other) – each with a default
   priority, a default owner (a person or "the masjid's Associate Director"-style role), whether it is shown on the
   website, and whether it is **restricted** (only owner, watchers and senior roles can see it – conduct complaints).
3. **Targets (SLA) with two clocks.** First response target and solve target per priority (Urgent / High / Normal /
   Low), counted in business hours or calendar days (organization choice). The clock **pauses while waiting on the
   requester**. Badges: on track · due soon (< 25 % left) · late.
4. **Replies vs internal notes.** A public reply goes to the requester (email/portal); an internal note stays with
   the team and may @mention colleagues. Visually different (notes are yellow-tinted). Never mixed by accident: the
   composer has two clear tabs.
5. **Saved replies** with merge fields ({{first_name}}, {{ticket}}, {{masjid}}, {{agent}}) – consistent, kind wording.
6. **Statuses with meaning**: New → Open → Waiting on requester / On hold (waiting on us or a third party) → Solved
   → Closed (automatically N days after Solved; a reply re-opens a Solved ticket).
7. **Watchers, tags, links, merge.** Followers get updates; tags for reporting; links to the member record, an event
   or a donation; merge a duplicate into the main ticket (thread moved, requester told).
8. **Requester context.** Side card: member status, masjid, previous tickets – so nobody asks twice.
9. **Bulk actions and saved views**: Unassigned, Mine, My masjid, Due soon, Late, Waiting, Solved; select many →
   assign, set status/priority, merge.
10. **Satisfaction.** On Solved, optional one-click survey (Good / Not good + comment); score on the dashboard.
11. **Escalation.** When a ticket goes late, notify the category's escalation role (demo: a banner + audit line).
12. **Dashboard.** Open by category and masjid, created vs solved per week, median first response and solve time,
    targets met %, satisfaction, oldest open tickets.

## Team tasks – what we build
1. **Projects** (or "lists"): a name, an owner, a masjid or the organization, a due date, members, a color. Personal
   tasks need no project ("My tasks").
2. **Task**: title, notes, owner + helpers, start/due date, priority, status (To do / Doing / Waiting / Done – the
   board columns), labels, checklist, sub-tasks, comments with @mentions, links (member, ticket, event, meeting).
3. **Views**: My work (Overdue · Today · This week · Later · No date), Board (drag and drop **and** a keyboard/menu
   move for accessibility), List grouped by status or owner, Calendar month view.
4. **Recurring tasks**: every week / month / year (e.g. "Monthly finance report", "Friday parking volunteers") – when
   one is done the next one is created with the next date.
5. **Templates with relative dates**: a project template has tasks at "anchor − 30 days" etc. (Eid prayer, Ramadan
   iftar program, Annual General Meeting, Election timeline). Choose the anchor date → all due dates are set.
   ISGH-flavored templates ship as a preset; every organization edits or adds its own.
6. **Ticket → task**: a ticket that needs internal work spawns a linked task; finishing the task posts a note on the
   ticket.
7. **Dashboard**: open, overdue, done this week, workload per person, projects at risk.

## Configuration (golden rule 1) – document `work-settings`
- helpdesk: categories[], priorities (targets), business hours + days, clock mode, auto-close days, satisfaction
  on/off, saved replies[], acknowledgement text, website forms on/off per category, restricted roles.
- tasks: statuses (column names), labels[], templates[] (tasks with offset days, checklist), default reminder.
- ISGH values are a preset; demo data stays fictional.

## Access (A10)
- Seeing and working tickets: `members.view` in the role's scope (masjid roles: their masjid + tickets assigned to
  them). Restricted tickets: owner, creator, watchers, and roles with `admins.manage` or `members.approve`.
- Help desk settings and task templates: `settings.manage`.
- Tasks: every admin; a project is visible to its members, its masjid's roles (if set to "everyone at the masjid"),
  and organization roles when "organization-wide".

## BE (later)
Tables `tickets`, `ticket_events` (reply / note / status / assignment – one append-only thread), `ticket_links`,
`task_projects`, `tasks`, `task_events`; SLA computed server-side from `work-settings`; inbound email webhook per
organization; outbound replies through the Communication module. Contract: BE/memory/api-contract-tickets.md.

## Tests planned
White-box: SLA clocks (business hours, pause while waiting), routing, merge, saved-reply merge fields, recurrence,
template dates, visibility (restricted, masjid scope). E2E: inbox views, reply vs note, bulk assign, merge, settings
change routing; tasks board move, checklist, recurring, template project, ticket → task, My work on Overview.
