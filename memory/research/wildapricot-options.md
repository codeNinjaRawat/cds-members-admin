# Research – WildApricot options vs our build (October 2026)

Sources:
- WildApricot help: "Membership renewal settings"
- WildApricot member-communications and online-payments feature pages
- WildApricot API event registration type structure
- WildApricot wishlist forum (groups, waitlist, guest limits)
- ISGH's own admin, as shown in the 14 Oct recording

Every option we build is a setting or a switch (owner rule: "keep some setting toggle based").

## Members – levels and renewals
| WildApricot option | Ours | Where |
|---|---|---|
| Level type individual / bundle (household) with a max size | `bundle.maxMembers` on a plan | Membership › Plans |
| Renewal period 1 / 3 / 5 years / lifetime | `termPrices` – one price per term length (1y $75, 3y $180, 5y $285) | Plans |
| Anchor: join date or a specific date (ISGH: Dec 15) | `renewal.anchor` = calendar / join / date + `anchorDate` | Plans |
| Automatic recurring payment, manual, or both | `renewal.mode` | Plans |
| Proration for new members | `renewal.prorate` | Plans |
| Limit how far ahead members can renew | `renewal.aheadLimitDays` | Plans |
| Public applications on/off; who approves | `visible` + `requiresApproval` | Plans |
| Members may change level | `allowLevelChange` | Plans |
| Reminders 14 / 7 / 0 days before (invoice, status Pending – Renewal) | `lifecycle.reminders[]` | Membership › Renewals and reminders |
| Grace period (7 days) and its action | `lifecycle.graceDays` + `graceAction` | Renewals |
| Overdue (14 days): lapse, suspend, change level, archive, void invoice | `lifecycle.overdueDays` + `overdueAction` + `voidInvoice` | Renewals |
| Reminders to member, bundle coordinator or both | `lifecycle.notify` | Renewals |
| ISGH's real 10 levels | **"Use ISGH's current levels" preset** (one click, then edit) | Renewals |

## Groups
| WildApricot | Ours |
|---|---|
| Manual groups only | Two kinds of group: **manual** ones (admins add people) and **automatic** ones (filled by a rule: center, zone, plan, status, voting, payment) |
| Members can pick some groups in their profile | `joinPolicy`: admins only / members can join / members can ask to join |
| Page access by group | `pageAccess` switch, and events can be limited to groups |
| Leaders are a wishlist item (not available) | `leaders` (emails) can email their group – switchable |
| Group emails | Groups are audiences in Communication |

## Communication – emails, templates, text messages
- **System emails** – each one can be turned on or off, with its own subject and text and who receives it. They cover:
  - applications: application received, member activated, bundle member activated
  - renewals: renewal reminders 1 and 2, renewal day, grace period, lapsed, renewal confirmed
  - payments: automatic renewal failed, card expiring, invoice, payment receipt
  - level change
  - events: registration confirmation, event reminder, waitlist spot opened
  - donation receipt
- **Saved templates** for announcements and newsletters, grouped by category. This replaces ISGH's 2019–2026 template sprawl, and old templates can be archived.
- **Merge fields:** `{Member.FirstName}`, `{Member.Plan}`, `{Member.RenewalDate}`, `{Member.Center}`, `{Org.Name}`, `{Event.Title}`, `{Event.Date}`, `{Invoice.Amount}`, … with a live preview against a sample member.
- **Sending settings:**
  - from name, reply-to and copy to admins
  - a postal address footer (required for bulk email by the CAN-SPAM Act)
  - tracking opens and clicks (on/off)
  - quiet hours for text messages
- **Text messages:** on/off, a consent text, and the purposes texts are used for.
- **Email log:** demo now; the BE will record it.

## Events
| WildApricot | Ours |
|---|---|
| Registration types with base price, guest price, availability (everyone, members, code, levels), limits, availability window | Same fields, per type |
| Waitlist when full | `waitlist` switch – when a spot opens, the first person waiting is offered it |
| Cancellation: not allowed, or allowed up to N days before | `cancellation.policy` + `daysBefore` |
| Guests allowed, with a maximum per registration | `guests.allowed`, `guests.max`, `guestPriceCents` |
| Event reminders | `reminders` (days before) → system email "Event reminder" |
| Members-only or group-only events | `visibility`: public / members / groups |
| At a center, online, or both | Location linked to a center + an online link |

## Configuration (global settings)
- **Member directory:** on/off, members only or public, which fields show, and members opt in.
- **Profile fields** (custom fields): field type, required or not, who can see it (public, members, admins only), whether members can edit it.
  - Admin-only fields that ISGH uses today: Entered by, Payment processed, Notes, Follow up.
- **Member card:** on/off; phone image and PDF; which fields it shows.
- **Self-service:** renew, change level, cancel automatic renewal, update profile.
- **Payments:**
  - methods: card, bank transfer (ACH), check, cash, pay later by invoice
  - a "pending check clearing" status for check payments
  - ask members to add a gift to cover processing fees (%)
  - invoice number prefix and receipts
- **Discount codes:** code, percent or amount, which plans or events it applies to, limit, end date.
- **Security:**
  - 2-step sign-in required for admins
  - session timeout
  - photo ID files kept privately for N days and never at a public link (fixes today's workaround)
- **Start page after sign-in.**
