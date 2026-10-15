# Research – SaaS platform panel (October 2026)

## What we looked at
- **Mosque / church management SaaS** (Mohid, Masjidun, ChurchTrac-style tools; listings on Capterra / GetApp):
  - Pricing is per organization, in tiers by size (members, locations) with features unlocked by tier.
  - Each one has a vendor "back office" for creating customer accounts, plans and support.
- **Support sign-in ("log in as")** – patterns from Ory, Tines, SaaSykit and others:
  - Always time-limited.
  - Needs a reason.
  - Shows a visible banner to the customer.
  - Written to the audit log on both sides.
  - Read-only by default.
  - Not possible without the customer knowing.
- **Multi-tenant addresses and own domains** (Vercel platforms, CloudFront tenants, Azure App Service):
  - A subdomain per tenant on a wildcard DNS record plus a wildcard certificate.
  - Own domains: the customer adds a CNAME to the platform plus a TXT record proving ownership; the platform verifies it, then issues HTTPS.

## What we decided (and why it is ours)
- **One website app + one admin app for all organizations.** The Host header decides the organization (never X-Forwarded-Host). ISGH keeps member-web / member-admin.
- **The SaaS panel is a separate app** (saas/, port 3002, its own password). Org admins never share a login with platform staff.
- **Organization = tenant.**
  - Created with a 6-step wizard: details → web address → plan → starting setup → owner → review.
  - The owner gets an invitation link.
  - Starter content is made from the org's profile and never claims ISGH facts. There is no ISGH history, news, impact stories or Bylaws page.
- **Modules** = plan + add-on − switched off − beta not rolled out. Website, Membership and Members are always on.
- **Health score** (0–100), driven by:
  - a failed payment
  - a trial ending soon
  - members or texts at 90% of the plan (1 of 1 center is normal)
  - nobody having accepted the invitation
  - no sign-in for more than 30 days
  - a broken own domain
- **Support sign-in:**
  - needs a reason (shown to the organization)
  - read-only by default
  - ends by itself after 2 hours (setting)
  - shows a banner in the org admin
  - is written to the audit log
- **Demo:**
  - no DNS lookups (a domain containing "fail" fails)
  - no Stripe (invoices are generated from the plans; "Charge again" succeeds)
  - no emails (invitation links are shown to copy)

## Sources
- https://www.capterra.com/p/10045683/Masjidun/ · https://www.capterra.co.uk/software/212475/mohid
- https://www.ory.com/blog/identity-level-impersonation · https://www.tines.com/docs/admin/impersonation/ · https://saasykit.com/docs/user-impersonation
- https://examples.vercel.com/platforms/docs/multi-tenant-platforms/quickstart · https://docs.aws.amazon.com/pt_pt/AmazonCloudFront/latest/DeveloperGuide/managed-cloudfront-certificates.html
