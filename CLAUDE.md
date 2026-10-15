# Instructions for AI assistants

Before working in `admin`, read `memory/README.md` here and `../memory/README.md`
at the project root. Keep both updated and log changes in the changelogs.

All user-facing text must follow `../memory/09-content-style-guide.md` (American English, Houston TX formats).
Membership rules come from `../memory/10-membership-rules.md`.

CURRENT PHASE (2026-10-13): A0 glass design system + A1 shell + website controls built in DEMO mode (publishes to ../.demo-store, no BE). Owner said "start working on the admin". Next: A3 members, A4 queues, A10 roles, then BE.

Golden rules: admin controls everything (no hard-coded business values – use settings/flags);
research note before any feature; black-box + white-box tests and a test report before delivery;
start with `../memory/00-START-HERE.md`.
Build order: Web UI → Admin UI (glass) → BE (SQL) → integration → mobile, in small approved modules (../memory/17-build-order-and-modules.md).
