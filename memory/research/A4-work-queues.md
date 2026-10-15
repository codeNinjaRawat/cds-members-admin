# A4 – Work queues (research, 2026-10-13)

Sources: `memory/10-membership-rules.md` (Bylaws Art. I Sec. 2–7), `12-competitor-membership-analysis.md` §2.7 (queues: applications,
ID/document review, border-change requests, duplicate merges, failed payments), `16-member-flow.md` (join steps, ID upload),
help-desk/inbox patterns (shared inbox with SLA, assign-to-me, keyboard triage, undo instead of "Are you sure?"), Stripe decline codes.

## Decisions
- **One inbox, five queues** (tabs with counts): Applications · Photo ID checks · Center change requests · Possible duplicates · Payments to fix.
  List on the left, the case on the right, so staff never lose their place. Arrow keys / J K move, the case opens with every fact needed to decide.
- **Every case shows the rule it is judged by**, computed – never typed: applications use the Bylaws checklist (Board approval comes last);
  center changes check "within 5 miles of the border" and "before the request deadline" and lock the new center for 5 years;
  duplicates show *why* two records look alike (same phone, same date of birth, similar name/email) with a score.
- **SLA**: each queue has a target (applications 7 days, photo ID 3, center change 14, duplicates 7, payments 3). Age chip turns amber at
  the target and red after; "Overdue" filter. (Live: targets are admin settings, A6.)
- **Assign to me** so two staff do not work the same case. Filter: Open · Mine · Overdue · Done.
- **Undo, not confirm**: decisions apply at once and show an Undo toast (5 s). Declines need a reason (sent to the member, kept in audit).
- **Board batch**: staff mark applications "Ready for the Board"; the Board decision is recorded for many at once with the meeting reference
  (Bylaws: approval by the BOARD).
- **Payments to fix** (Stripe later): card declined (reason from the decline code in plain words), bank payment returned, pledged check not
  received. Actions: send a new payment link (demo), record the check (writes the payment → eligibility updates), cancel with reason.
- Everything writes the member's audit log. Demo: decisions saved in this browser; live: BE B3/B4/B6 endpoints + role scopes (A10).
