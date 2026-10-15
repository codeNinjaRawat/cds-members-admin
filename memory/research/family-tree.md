# Family tree (research, 2026-10-13) – website member portal + admin

Owner asked for a "family tree" in the dashboard and the member portal; chose **both** layers (membership family + older generations).

## Why it helps ISGH
- Bylaws: Family plan = member + spouse; every adult votes on their **own** dues; age 18 on the June 30 record date.
  A tree makes these rules visible: who in the family is a member, who can vote, who can join, which child turns 18 before the record date.
- Outreach: adults in members' families who are not members are the warmest leads (admin "Families to reach").
- Silat ar-rahim (keeping family ties) is a value members care about (hadith shown: Sahih al-Bukhari 5986).

## Patterns studied (not copied)
- Genealogy sites: generation rows, couples side by side, children under parents, zoom/fit, list view for small screens.
- Church/masjid CRMs: "household" records with relationship types; consent before linking two member accounts.
- GEDCOM (family history standard) – export can come later (BE).

## Decisions
- **Two layers:** Membership family (parents → grandchildren, statuses) and Whole family + history (older generations as names/years/place, "Late").
- **Privacy:** only the member sees the whole tree; relatives who are members are linked only after they accept; children's
  details stay with the family; **admin sees the membership layer only**, never the history.
- **Badges:** Member · can vote / Life · can vote / Member / Not renewed / Applied – waiting / Can join / Turns 18 on DATE /
  Age N / Invited DATE / Late. Computed from the same rules as eligibility.
- **Actions:** member – add relative (father, mother, spouse, son, daughter, brother, sister; passed away → history), edit, remove,
  invite to join, birthday reminder, renewal reminder. Admin – send invitation (audited), open the relative's member record.
- Shared code: `web/src/lib/family/family.ts` (+ demo), renderer `web/src/components/family/FamilyTree.tsx`; admin copies via
  `npm run contracts:sync`.
- Live (BE B3): GET/PUT /member/family, POST /member/family/invitations, GET /admin/members/:id/family (membership layer).
