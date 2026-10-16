# Communication – flow research (2026-10-15)

Question: in what order should staff meet the Communication screens and the "send a message" steps?

## What others do
- WildApricot: Emails area has the manual email wizard (template → recipients → compose → review & send), drafts, scheduling, an email log with delivery/tracking, automatic emails as a separate area, and email settings set once. (gethelp.wildapricot.com articles 35, 36, 55, 59, 569 – pages are JS-rendered, topics confirmed from search results.)
- Mailchimp: the campaign builder became a checklist – To, From, Subject, Send time, Content – all on one page with a preview; any order, each item ticks when done.

## Our order (most used first, set-once last)
1. Messages (drafts / scheduled / sent; quick starts when empty)
2. Automatic emails (renewal timeline inside the Renewals group)
3. Templates
4. Delivery log (automatic + staff messages, filter)
5. Settings (sender + footer → text messages → tracking)
Publish/Discard/History only on tabs that change saved settings (Automatic emails, Templates, Settings).

## Composer order
1 How and what kind (channel + topic first – the topic decides who is left out) → 2 Who gets it → 3 Write it (template, subject, message) → 4 When → review: count, left out and why, preview, "Before it can go out" list, then test / send. Each step shows a check when done; actions stay in a sticky bar. A draft can be saved without a name (takes the subject).

## Dropdown bug
Chrome on Windows paints an open <select> list with the select's own background. Our glass fields were ~4% opaque, so the list was white-on-white and looked broken. Fix: solid select background and solid option colors (styles/forms.css).
