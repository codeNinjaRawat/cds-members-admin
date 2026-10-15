/**
 * STARTER CONTENT for a new organization (tenant). Until its admins publish their own content, the website and the
 * admin show ISGH's built-in content rewritten for that organization: its name, short name, city, contact details –
 * and nothing that would make claims about it (no ISGH history, impact stories, news or Bylaws page).
 * Source: web/src/lib/platform/seed.ts → copied to admin/ by `npm run contracts:sync` (admin).
 */
import type { Tenant } from './platform';

export type SeedKey = 'site-config' | 'home' | 'membership-settings' | 'giving' | 'pages' | 'news' | 'themes' | 'join-form';
type Profile = Pick<Tenant, 'slug' | 'name' | 'shortName' | 'city' | 'state' | 'address' | 'phone' | 'email' | 'template' | 'usage' | 'createdOn'>;

/** Replace ISGH's names in every text (never inside links, images or ids). */
function rewrite<T>(value: T, t: Profile): T {
  const area = `the ${t.city} area`;
  const swap = (s: string) => (/^(https?:|\/|#|mailto:|tel:)/.test(s) ? s : s
    .replace(/Islamic Society of Greater Houston/g, t.name)
    .replace(/Greater Houston’s/g, `${t.city}’s`).replace(/Greater Houston's/g, `${t.city}'s`)
    .replace(/Greater Houston/g, area)
    .replace(/ISGH/g, t.shortName)
    .replace(/Houston/g, t.city));
  const walk = (v: unknown): unknown => (typeof v === 'string' ? swap(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v);
  return walk(value) as T;
}
const tel = (p: string) => { const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? `+1${d}` : ''; };

/** The starter version of one website document for this organization. `isgh` keeps its own content untouched. */
export function seedFor<T>(key: SeedKey, isghDefault: T, t: Profile): T {
  if (t.slug === 'isgh') return isghDefault;
  const v = rewrite(structuredClone(isghDefault), t) as any;
  const single = t.template !== 'bylaws-society';
  switch (key) {
    case 'site-config':
      v.org = { name: t.name, shortName: t.shortName, productName: `${t.shortName} Members`, address: t.address ? [t.address] : [`${t.city}, ${t.state}`],
        phone: { display: t.phone, tel: tel(t.phone) }, email: t.email, taxNote: `${t.shortName} is a nonprofit organization.` };
      v.announcement = null;
      if (v.footer) { v.footer.social = []; v.footer.mapUrl = undefined; v.footer.tagline = `Membership for ${t.name}.`; }
      return v;
    case 'home':
      v.hero = { ...v.hero, title: single ? `${t.shortName}. One community.` : `${t.name}. One membership.`, lead: `Your dues keep ${t.shortName} running, and your membership gives you a voice in how it is run.` };
      v.classicHero = { title: `Membership that keeps ${t.shortName} strong.`, lead: 'Join or renew in a few minutes and carry your member card on your phone.' };
      v.stats = [{ value: String(Math.max(1, t.usage.centers)), label: Math.max(1, t.usage.centers) > 1 ? 'Islamic Centers' : 'Islamic Center' }, { value: t.city, label: 'Our home' }];
      if (single) { v.layout = 'classic'; v.zones = [{ id: 'main', name: t.city, fromDeg: 0, toDeg: 360, centers: [t.shortName] }]; }
      return v;
    case 'pages': {
      const keep = ['faq', 'contact', 'privacy', 'terms', 'accessibility', 'membership/renew'];
      const out: Record<string, unknown> = Object.fromEntries(Object.entries(v).filter(([k]) => keep.includes(k)));
      out.about = { slug: 'about', title: `About ${t.shortName}`, status: 'published', updatedAt: t.createdOn,
        intro: `${t.name} serves Muslims in ${t.city}, ${t.state}.`,
        blocks: [
          { type: 'callout', tone: 'info', title: 'Starter page', text: `${t.shortName} admins: tell members who you are in Admin › Website › Pages.` },
          { type: 'cta', title: `Join ${t.shortName}`, text: 'Members keep the community strong.', label: 'Become a member', href: '/membership/join' },
        ] };
      return out as T;
    }
    case 'news': return [] as T;
    case 'giving': v.impact = []; v.needs = []; v.totals = []; return v;
    case 'membership-settings':
      v.serviceArea = { states: [t.state], label: `${t.city} area` };
      if (single) v.plans = v.plans.filter((p: { id: string }) => p.id !== 'life');
      return v;
    default: return v;
  }
}
