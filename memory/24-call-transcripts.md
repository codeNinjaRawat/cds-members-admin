# 24 – What was said on the review calls (from the owner's transcripts, 10/19)

Source: three transcripts the Owner pasted in chat on 10/19 (machine transcription, Urdu/Hindi + English). They
are summarized here by meaning, not word for word; speakers are given by role (no personal names rule):
**ML** = the client's membership lead · **CL** = client leadership · **US** = our side. Transcript 1 looped the
same 12 minutes several times (a transcription artifact); only the first pass was used. Which transcript belongs to
which recording is inferred from content (see 23-owner-feedback.md): T-A = dashboard demo call, T-B = plans and
zones call, T-C = Checkomatic call.

---

## T-A – Dashboard demo (roles, work queue, ticketing, internal tasks)

**What the client wants**
1. **Simplify the membership person's view.** The organization overview (pipeline, "15 days in review", every
   KPI) is for directors / the board, not for a membership clerk. Extra numbers create "50,000 questions". For
   non-membership roles the top three tiles and Members by zone are enough. (ML, CL agreed.)
2. **Tile wording:** in the membership context "Giving this month" should read **"Membership fee collected"**
   (membership revenue); donations are a separate number. (CL)
3. **Dashboard configurable per role**, every widget on/off: board / executive body, executive director, office
   manager, department secretaries, zonal counselors / area representatives, office personnel. The client will send
   **sketches** of what each level sees; we put them in configuration so the client can change them later without
   a developer. (CL, ML)
4. **Roles:** a role carries its permissions; a person can also get extra permissions on top (someone covering two
   roles, e.g. membership + Zakat for a while). (US, accepted)
5. **Rule today:** elected officials may not see members' personal information beyond name and address – but it
   must stay a setting, because the rule may change. (ML, CL)
6. **Work queue belongs inside Membership** – the president has no use for it at the top level. (ML, CL)
7. **System-generated tasks route by category to a person**: photo-ID check, address verification, center change,
   duplicates, **incomplete application** (email + phone entered, then left – follow up), **missing information**
   (follow-up bucket). The client gives us the list of task types and who does what; one task type can have
   several people; the manager can reassign; "Assign to me" (self-pick from the unassigned list) stays; the
   assignee sees "today's tasks" at first sign-in. Reporting: how long each task took, overdue tasks escalate a
   level up. (ML asked, CL and US agreed)
8. **Tickets from the member portal / website**: a member who cannot find their membership or has the wrong center
   opens a ticket (which masjid, what the inquiry is) → lands in the queue, routed by category, resolved with a
   sign-off so it is clear who handled it. Replaces today's email handling. (ML, CL: "this was not in our mind –
   good")
9. **Tasks and tickets as one organization-wide module, per department** (finance, reception can create tasks for
   their own people); departments do not see each other's tasks. (CL; ML agreed once clarified)
10. **Internal communication inside the dashboard** (message a colleague or director, attach a screenshot,
    inter-departmental requests) instead of email / WhatsApp. (US proposed, ML: "that alone is going to be amazing")
11. Punch-in/punch-out / time-on-dashboard KPIs: raised half in jest; ML: "don't go there – that's an argument we
    are having right now". **Parked, not requested.**

## T-B – Plans and dues, zones and centers

1. Average member / official age is 60+: keep screens simple (they would not even move from WhatsApp to Slack).
2. **Plans change often** (four changes in three years): every clause must be editable – price, member list
   (grandfather, father…), age thresholds (16/18 above/below), term. The membership lead creates plans; the shura
   decides them. (CL, ML)
3. **Member class:** "Natural" is the legal catch-all (everyone in the community); paid members are "Associate".
   On the call both ML and CL said **"natural cannot vote"** – the opposite of the note our editor shows
   ("Associate members cannot vote"). → **fix the editor rule and check the by-laws wording** (23 › V1).
4. **Rename the recurring plan "Checkomatic"** – that is its name in their rules. (ML)
5. Plan price is **auto-assigned from the plan** (no price drop-down at sign-up). (ML)
6. **Lifetime plans: no renewal settings at all** (one-time payment) – hide/disable so nobody adds one by mistake.
7. **Individual plans: household/bundle option disabled** (only household plans can add people). (ML)
8. Liked: voting-eligibility flag derived from the plan (keep the redundant note), multi-year discount, the
   "about 4 minutes" join form, ID scan (the client has an ID-reader device they want attached later).
9. **Zones:** ZIP-level assignment is not accurate (one ZIP can straddle a boundary). Use the real boundary map;
   US suggested a hexagon (H3-style) grid so each address falls into exactly one zone. Target: ~90% assigned
   automatically, ~10% to a review queue. A new zone is coming soon. The client asked to **attach their boundary
   map in the admin**.
10. **Center choice rules (shura directive):** inside your own zone you may pick any center (default = nearest;
    show the zone's centers as options). Near a border (within 5 miles) you may pick **only the nearest center of
    the next zone**. **Center can be changed only by application with proof of address/ID and is locked for
    5 years** unless the person physically moves. (ML, CL)

## T-C – Checkomatic, logins, membership dashboard

1. **Work by category, not by center** for the membership department (center-level tasks might later go to
   membership secretaries – no process yet). (ML)
2. **Two separate logins:** a personal email = plain member (no authorization); an official `@org` email = staff
   with configured roles. Do not merge them – people must know which hat they wear. (ML, CL)
3. **Members → opens the membership dashboard directly** (no separate Dashboard tab); call it **"Overview"**:
   statistics on top, then the full member list with search and categories, click through to a member. The client
   will sketch the membership dashboard too; make it configurable. (ML)
4. Not everything can be built at once; until the donor system (Bloomerang) is merged, pull donors through its
   **API key** into a Checkomatic list under Members. (ML)
5. **Checkomatic reconciliation under Members** (the membership department's own tab, without needing donation
   permissions): all recurring payments are pulled in; back-end rules check "is this a member?" → tag; if not →
   a separate section to contact / tag as "eligible, information not provided". Eliminates today's manual
   reconciliation. "Unique to us, but keep it configurable." (ML, CL)
6. Blackbaud-style idea: money is money – a recurring gift accumulates toward the membership fee until the
   threshold is hit, then the person qualifies. (CL)
7. **Donor sign-in:** a donor whose gifts qualify is offered "Become a member with your donation". (CL)
8. Wild Apricot could never process Checkomatic monthly (option was off since June 30; donors had to set up the
   donation separately). (ML)
9. **Where the money goes:** a Checkomatic gift is a donation to the member's **own center** (18 centers, each with
   its own bank account; 10–12 Stripe keys today), except **Zakat, Sadaqah for the needy and Weekend school**, which
   go to the central organization. At sign-up the center is assigned by ZIP and **that center's donation types**
   (pre-configured per masjid) are shown; the payment runs through that center's Stripe account; the center's admin
   sees the donation only; the membership department handles the membership side; head office sees both. (ML, CL)
