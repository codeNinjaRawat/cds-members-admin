# Research – member sign-up and the Join form builder (October 2026)

## What we looked at
- **WildApricot** (current ISGH tool). Membership application forms are tied to each membership level, so you keep several copies of nearly the same form.
  - No real conditional logic ("show this question only if…"). It is a long-standing request on their wishlist (about 91 votes).
  - A form is all-or-nothing: one long page, with no save-and-come-back.
  - It does not prefill from last year at renewal.
- **Church and mosque membership forms** (several US congregations): the usual extras are household and children, how you heard about us, volunteer interests, skills, and languages.

## What we decided (and why it is different)
- **One form for every plan.** A question can be limited to certain plans or shown by a rule ("only if the plan is Family", "only if children ≥ 1", "only if the answer is Other").
- **Bylaws fields are locked.** The admin can rename them or add help text, but cannot switch off a required one. Each one shows *why* it is needed (for example, being 18 or older on the June 30 record date).
- **Admin sections can sit inside a core step** (About you, Plan, Pledge) or be their own step. A step with no questions that apply is skipped automatically.
- **Problems block Publish:** duplicate ids, a choice question with no choices, or a rule that points to a missing question. The server checks the same rules and answers 400 with the list of issues.
- **The server never stores answers to questions that were not shown** (`cleanAnswers`).
- **Smart helpers** (each one can be switched off in the builder):
  - Scan photo ID to fill your name, date of birth and address. In demo mode it uses sample data.
  - Renewing? Prefill from last year.
  - Save and continue later, using a resume link.
  - Address finds the Islamic Center and the family.
- **Who can see each answer:** Member, Staff, or Board only.

## Tests
- Website `harness/run/tests/joinform.spec.ts` (5) and the updated `join.spec.ts`.
- Admin `admin-harness/run/tests/joinform.spec.ts` (5).
- White-box `wb/formdef.test.ts` (26).
