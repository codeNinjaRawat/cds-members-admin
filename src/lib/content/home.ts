/**
 * CONTRACT – GET /public/pages/home  (admin: CMS › Home page)
 * Every text, image, number and zone on the home page is editable by admins. Images are references to the
 * media library (here: files in /public/images, downloaded by scripts/fetch-images.mjs with credits).
 */
import { z } from 'zod';
import { SpotlightSchema } from './spotlight';
import { MEMBER_ICONS } from './icons';

export const ImageRefSchema = z.object({
  src: z.string(),          // /images/... (media library URL later)
  alt: z.string(),          // required – accessibility
  credit: z.string().optional(),
  creditUrl: z.string().optional(),
  focal: z.string().optional(), // CSS object-position, e.g. "50% 30%"
});
export type ImageRef = z.infer<typeof ImageRefSchema>;

/**
 * 2026-10-25 – small "smart slider" on the home page (Website › Home page › Highlights slider). Smart kinds fill
 * themselves from Settings › Membership & dues: deadline = days left to the record date ({days}, {date}, {year});
 * price = the featured (or cheapest) plan ({plan}, {price}, {unit}); custom = exactly what the admin wrote.
 */
export const HighlightSlideSchema = z.object({
  kind: z.enum(['custom', 'deadline', 'price']).default('custom'),
  kicker: z.string().trim().max(40).default(''),
  title: z.string().trim().max(90),
  text: z.string().trim().max(200).default(''),
  icon: z.enum(MEMBER_ICONS).default('star'),
  tone: z.enum(['primary', 'highlight', 'rose', 'dark', 'soft']).default('primary'),
  image: ImageRefSchema.optional(),                       // a photo instead of the icon
  cta: z.object({ label: z.string().trim().max(40), href: z.string().trim().max(300) }).optional(),
});
export const HighlightsSchema = z.object({
  label: z.string().trim().max(60).default('Highlights'),  // read by screen readers
  seconds: z.number().int().min(0).max(30).default(6),     // 0 = no autoplay
  slides: z.array(HighlightSlideSchema).max(6).default([]),
});
export type HighlightSlide = z.infer<typeof HighlightSlideSchema>;

export const HOME_LAYOUTS = ['zones', 'classic', 'editorial', 'spotlight'] as const;
export const HOME_SECTIONS = ['stats', 'heart', 'bento', 'steps', 'plans', 'life', 'verse', 'impact', 'needs', 'journey', 'houston', 'closing',
  // R6.5 editorial layout – live sections (data from the admin modules)
  'today', 'week', 'masajid', 'services', 'programs', 'give', 'election', 'latest', 'deadline',
  // 2026-10-25 spotlight layout (membership landing) – 'plans', 'steps' and 'closing' are shared keys
  'slider', 'benefits', 'numbers', 'status', 'faq'] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

export const HomeSchema = z.object({
  /** Admin › CMS › Home page › Layout: "zones" (interactive five-zone map) or "classic" (member card hero) */
  layout: z.enum(HOME_LAYOUTS).default('editorial'),
  /** Admin: which sections show below the hero, in this order (drag to reorder, toggle to hide) */
  sections: z.array(z.enum(HOME_SECTIONS)).max(12).optional(),
  classicHero: z.object({ title: z.string(), lead: z.string() }).optional(),
  /** R6.5 "editorial" layout: photo hero + quick actions (what isgh.org's five buttons do) + live sections */
  editorial: z.object({
    kicker: z.string().max(80).default(''),                                  // small line above the headline, e.g. "Serving Houston since 1969"
    headline: z.string().max(120).default('One community. Twenty-two masajid.'),
    lead: z.string().max(300).default(''),
    photo: ImageRefSchema.optional(),
    quickActions: z.array(z.object({ label: z.string().max(40), href: z.string().max(300), tone: z.enum(['primary', 'accent', 'dark', 'light']).default('light'), hint: z.string().max(60).default('') })).max(6).default([]),
    prayerCenter: z.string().max(40).default(''),                           // center id for the home prayer strip ('' = first active center)
    services: z.array(z.object({ title: z.string().max(60), text: z.string().max(140).default(''), href: z.string().max(300) })).max(8).default([]),
    giveTitle: z.string().max(80).default('Give where it matters'), giveText: z.string().max(200).default(''),
  }).optional(),
  /** 2026-10-25 small smart slider (section 'slider' in the editorial layout) */
  highlights: HighlightsSchema.optional(),
  /** 2026-10-25 "spotlight" layout: loud membership landing page (see spotlight.ts) */
  spotlight: SpotlightSchema.optional(),
  /** Photos shown on the Become a member page (CMS › Join page) */
  joinImages: z.array(ImageRefSchema).max(3).optional(),
  /** Admin: one short, heart-touching line (hadith) under the stats. Source required; reviewed by an imam. */
  heartLine: z.object({ text: z.string().max(160), arabic: z.string().max(160).optional(), source: z.string() }).optional(),
  hero: z.object({
    title: z.string(), lead: z.string(),
    primary: z.object({ label: z.string(), href: z.string() }),
    secondary: z.object({ label: z.string(), href: z.string() }),
    mapHint: z.string(),
  }),
  zones: z.array(z.object({
    id: z.string(), name: z.string(), centers: z.array(z.string()),
    fromDeg: z.number(), toDeg: z.number(),   // wedge on the stylized map (admin can tune)
  })),
  stats: z.array(z.object({ value: z.string(), label: z.string() })).max(4),
  bento: z.object({
    title: z.string(),
    deadlineTitle: z.string(),
    walletTitle: z.string(), walletText: z.string(), walletImage: ImageRefSchema,
    findTitle: z.string(), findText: z.string(),
    statusTitle: z.string(),
    newsTitle: z.string(), newsText: z.string(),
  }),
  life: z.object({ title: z.string(), text: z.string(), tiles: z.array(z.object({ title: z.string(), text: z.string(), image: ImageRefSchema, href: z.string().optional() })).max(6) }),
  journey: z.object({ title: z.string(), steps: z.array(z.object({ title: z.string(), text: z.string() })).max(6) }),
  houston: z.object({ title: z.string(), text: z.string(), image: ImageRefSchema, cta: z.object({ label: z.string(), href: z.string() }) }),
  closing: z.object({ title: z.string(), text: z.string(), image: ImageRefSchema, cta: z.object({ label: z.string(), href: z.string() }) }),
});
export type Home = z.infer<typeof HomeSchema>;

/**
 * Free stock photos (Pexels License – free to use). During the demo they load straight from the Pexels CDN so
 * the pages are full without any setup; for production run `npm run images` to self-host them (scripts/fetch-images.mjs)
 * and admins manage them in the media library.
 */
export const pexels = (id: number, w = 1600) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
const px = (file: string, alt: string, credit: string, creditUrl: string, focal?: string): ImageRef => {
  const id = Number(creditUrl.match(/-(\d+)\/?$/)?.[1]);
  return { src: id ? pexels(id, file.includes('skyline') ? 2400 : 1600) : `/images/${file}`, alt, credit, creditUrl, focal };
};

export const DEFAULT_SECTIONS: Record<(typeof HOME_LAYOUTS)[number], HomeSection[]> = {
  zones: ['stats', 'heart', 'bento', 'life', 'verse', 'impact', 'needs', 'journey', 'houston', 'closing'],
  classic: ['heart', 'steps', 'plans', 'life', 'verse', 'impact', 'needs', 'houston', 'closing'],
  editorial: ['slider', 'today', 'deadline', 'week', 'masajid', 'services', 'programs', 'give', 'latest', 'election', 'verse', 'closing'],
  spotlight: ['slider', 'benefits', 'numbers', 'plans', 'steps', 'status', 'faq', 'closing'],
};

export const mockHome: Home = {
  editorial: {
    kicker: 'Serving Greater Houston since 1969', headline: 'One community. Twenty-two masajid. Every door open.', lead: 'Prayer times, Friday khutbahs, programs, giving and membership for every masjid in the network – in one place.',
    photo: { src: pexels(30159436, 2000), alt: 'Arches inside a masjid prayer hall', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/30159436/', focal: '50% 40%' },
    quickActions: [
      { label: 'Friday prayer schedule', href: '/khutbah', tone: 'light', hint: 'This week’s khateebs and times' },
      { label: 'Become a member', href: '/membership/join', tone: 'primary', hint: 'Join or renew for the year' },
      { label: 'Support a cause', href: '/campaigns', tone: 'accent', hint: 'Relief, Zakat, cemetery' },
      { label: 'Support the organization', href: '/give', tone: 'dark', hint: 'Operations and the masajid' },
      { label: 'Elections', href: '/elections', tone: 'light', hint: 'Dates, candidates, results' },
    ],
    prayerCenter: '',
    services: [
      { title: 'Financial assistance', text: 'Zakat and emergency help for families.', href: '/services/financial-assistance' },
      { title: 'Islamic education', text: 'Weekend schools, full-time schools, hifz.', href: '/services/islamic-education' },
      { title: 'Nikah', text: 'Counseling, the ceremony, the certificate.', href: '/services/nikah' },
      { title: 'Funerals and cemetery', text: 'Ghusl, janazah, burial – every day.', href: '/services/funerals' },
      { title: 'Job networking', text: 'Resumes, referrals, employers.', href: '/services/job-networking' },
      { title: 'Dawah', text: 'Masjid tours, new-Muslim classes.', href: '/services/dawah' },
    ],
    giveTitle: 'Give where it matters', giveText: 'Every gift is tax-deductible and goes to the fund you choose – Zakat, a masjid, a relief campaign or the organization’s daily work.',
  },
  heartLine: {
    text: 'None of you truly believes until he loves for his brother what he loves for himself.',
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    source: 'Sahih al-Bukhari 13 · Sahih Muslim 45',
  },
  highlights: {
    label: 'Membership highlights',
    seconds: 6,
    slides: [
      { kind: 'deadline', kicker: 'Election countdown', title: '{days} days left to keep your vote', text: 'Pay your {year} dues by {date} to be on the ISGH voter list.', icon: 'vote', tone: 'primary', cta: { label: 'Become a member', href: '/membership/join' } },
      { kind: 'price', kicker: 'Membership', title: '{plan}: {price} {unit}', text: 'Every plan includes your vote once your dues are paid on time.', icon: 'plan', tone: 'highlight', cta: { label: 'See all plans', href: '/membership/plans' } },
      { kind: 'custom', kicker: 'Families', title: 'Add your spouse in the same checkout', text: 'Each adult gets their own vote and their own member record.', icon: 'family', tone: 'rose', image: { src: pexels(35105921, 900), alt: 'Three generations of a family reading together', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/family-reading-together-generational-connection-35105921/' }, cta: { label: 'How to join', href: '/membership/guide' } },
      { kind: 'custom', kicker: 'Member card', title: 'Your card and status, always on your phone', text: 'Sign in with a code – no password – to see whether you can vote this year.', icon: 'phone', tone: 'dark', cta: { label: 'Sign in', href: '/sign-in' } },
    ],
  },
  layout: 'editorial', // 2026-10-25 owner: back to the previous look (spotlight stays available in Website › Home page, with its content below)
  spotlight: {
    ticker: ['Membership is open', 'Pay by June 30 = your vote', 'Join in about five minutes', 'Bring your whole family'],
    headline: [{ text: 'Your', tone: 'plain' }, { text: 'masjid.', tone: 'violet' }, { text: 'Your', tone: 'plain' }, { text: 'vote.', tone: 'yellow' }, { text: 'Your', tone: 'plain' }, { text: 'people.', tone: 'mint' }],
    lead: 'Become an ISGH member in about five minutes. Vote in community elections, save on programs, and keep your whole family’s membership in one place.',
    primary: { label: 'Become a member', href: '/membership/join' },
    secondary: { label: 'I already have an account', href: '/sign-in' },
    chips: [{ text: 'No password needed', tone: 'sky' }, { text: 'Secure checkout', tone: 'white' }, { text: 'Muslims 18+ in Greater Houston', tone: 'pink' }],
    badge: 'Join • Belong • Vote • Build •',
    card: { label: 'Member', tag: 'Can vote ✓', name: 'Your name here' },
    note: { before: 'Pay your dues by then to vote.', after: 'Join today.' },
    slides: [
      { kind: 'deadline', kicker: 'Election countdown', title: '{days} days left to keep your vote', text: 'Pay your dues by {date} to be on the ISGH voter list.', icon: 'ballot', tone: 'yellow', cta: { label: 'Join now', href: '/membership/join' } },
      { kind: 'price', kicker: 'Membership', title: '{plan}: {price} {unit}', text: 'Every plan comes with a vote once your dues are paid on time.', icon: 'card', tone: 'violet', cta: { label: 'See all plans', href: '#plans' } },
      { kind: 'custom', kicker: 'Twenty-two centers', title: 'Your dues keep every masjid open', text: 'Daily prayers, Jumuah, weekend schools and youth programs across Greater Houston.', icon: 'masjid', tone: 'mint', cta: { label: 'About ISGH', href: '/about' } },
      { kind: 'custom', kicker: 'Families', title: 'Bring your spouse along', text: 'Each adult gets their own vote. Manage everyone from one account.', icon: 'family', tone: 'pink' },
    ],
    slideSeconds: 6,
    stripe: ['Vote', 'Save', 'Belong', 'Build'],
    benefitsTitle: 'What you get when you join',
    benefits: [
      { icon: 'ballot', title: 'A real say.', text: 'Vote in ISGH elections and help choose the leaders who run your masjid and your community.', tone: 'yellow' },
      { icon: 'tag', title: 'Member prices.', text: 'Save on funeral services, weekend schools and youth programs.', tone: 'sky' },
      { icon: 'masjid', title: 'Build your masjid.', text: 'Your dues help keep 22 Islamic Centers and the Shifa clinics running.', tone: 'mint' },
      { icon: 'family', title: 'The whole family.', text: 'Add your spouse and see everyone’s status in one place.', tone: 'pink' },
      { icon: 'card', title: 'Card on your phone.', text: 'Your member card, status and renewal date – always in your pocket.', tone: 'white' },
    ],
    plansTitle: 'Pick your plan.',
    plansNote: '',
    featuredLabel: 'Most popular!',
    stepsTitle: 'Four steps. That’s it.',
    statusTitle: '“Wait… can I vote this year?”',
    statusText: 'Sign in and find out in seconds. If something is missing, we’ll tell you exactly what to do.',
    statusCta: { label: 'Check my status', href: '/sign-in' },
    checklist: [{ text: 'Membership approved', done: true }, { text: '18 or older', done: true }, { text: 'Dues paid by June 30', done: true }, { text: 'Photo ID checked', done: false }],
    faqTitle: 'Got questions?',
    faq: [
      { q: 'Who can become a member?', a: 'Any Muslim 18 or older who lives in the Greater Houston area.' },
      { q: 'When do I get to vote?', a: 'Once your dues for the year are paid by June 30, you are on the voter list for that year’s elections.' },
      { q: 'Can I sign up my spouse too?', a: 'Yes. Each adult gets their own vote and their own member record. You can pay for your spouse in the same checkout.' },
      { q: 'How does the monthly plan work?', a: 'Your monthly gift goes to the masjid you choose. Once the year’s total reaches the amount set by the Board by June 30, you can vote.' },
      { q: 'Do I need a password?', a: 'No. We email you a 6-digit code every time you sign in.' },
    ],
    closingTitle: 'Ready? Let’s go.',
    closingCta: { label: 'Become a member', href: '/membership/join' },
  },
  // R6.5 website v2 (owner 2026-10-21: isgh.org reimagined with a modern look). 'zones' (map hero) and 'classic' stay available in CMS › Home page
  joinImages: [
    { src: pexels(35105921, 900), alt: 'Three generations of a family reading together', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/family-reading-together-generational-connection-35105921/' },
    { src: pexels(6557125, 900), alt: 'A smiling young woman in a hijab', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/a-woman-wearing-hijab-taking-a-selfie-6557125/', focal: '50% 25%' },
    { src: pexels(9127597, 900), alt: 'A father and son in traditional dress praying together', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/father-and-son-kneeling-on-the-floor-9127597/' },
  ],
  classicHero: {
    title: "Membership that keeps Greater Houston's masajid strong.",
    lead: 'Join or renew in a few minutes, see whether you can vote this year, and carry your member card on your phone.',
  },
  hero: {
    title: 'Five zones. Twenty-two masajid. One membership.',
    lead: 'Your dues keep every Islamic Center in Greater Houston open, and your membership gives you a vote in how ISGH is run.',
    primary: { label: 'Become a member', href: '/membership/join' },
    secondary: { label: 'Renew for 2027', href: '/membership/renew' },
    mapHint: 'Hover or tap a zone to see its Islamic Centers.',
  },
  // Sample center names – the real list of 22 centers comes from admin (Centers module)
  zones: [
    { id: 'se', name: 'Southeast', fromDeg: -60, toDeg: 55, centers: ['Center 1', 'Center 2', 'Center 3', 'Center 4', 'Center 5'] },
    { id: 's', name: 'South', fromDeg: 55, toDeg: 112, centers: ['Center 6', 'Center 7', 'Center 8'] },
    { id: 'sw', name: 'Southwest', fromDeg: 112, toDeg: 165, centers: ['Center 9', 'Center 10', 'Center 11', 'Center 12'] },
    { id: 'nw', name: 'Northwest', fromDeg: 165, toDeg: 228, centers: ['Center 13', 'Center 14', 'Center 15', 'Center 16', 'Center 17'] },
    { id: 'n', name: 'North', fromDeg: 228, toDeg: 300, centers: ['Center 18', 'Center 19', 'Center 20', 'Center 21', 'Center 22'] },
  ],
  stats: [
    { value: '1969', label: 'Serving Houston since' },
    { value: '22', label: 'Islamic Centers' },
    { value: '5', label: 'Zones across Greater Houston' },
    { value: '501(c)(3)', label: 'Texas nonprofit' },
  ],
  bento: {
    title: 'Everything about your membership, in one place.',
    deadlineTitle: 'Days left to keep your vote',
    walletTitle: 'Your card, on your phone',
    walletText: 'Add it to Apple Wallet or Google Wallet. It works offline at any center.',
    walletImage: px('home/phone-member.jpg', 'A woman in a hijab smiling while using her phone', 'Pexels', 'https://www.pexels.com/photo/woman-in-white-hijab-holding-a-smartphone-7847650/', '50% 30%'),
    findTitle: 'Find your Islamic Center',
    findText: 'Your home address decides your zone and center.',
    statusTitle: 'Know where you stand',
    newsTitle: 'News from ISGH',
    newsText: 'Updates from the Board, the centers and the election commission.',
  },
  life: {
    title: 'What your membership supports',
    text: 'Dues and member giving keep programs running at centers across the city.',
    tiles: [
      { title: 'Masajid open every day', text: 'Daily prayers, Jumuah and Ramadan nights at 22 centers.', image: px('home/masjid-interior.jpg', 'Prayer hall of a masjid with arches and a large chandelier', 'Pexels', 'https://www.pexels.com/photo/majestic-interior-of-mosque-in-mannheim-germany-40053903/'), href: '/centers' },
      { title: 'Weekend and Quran schools', text: 'Classes for children and adults in every zone.', image: px('home/children-quran.jpg', 'A family reading the Quran together at home', 'Pexels', 'https://www.pexels.com/photo/children-reading-quran-in-traditional-attire-35105938/') },
      { title: 'Free care at Shifa clinics', text: 'Health care for families who need it most.', image: px('home/clinic.jpg', 'A doctor checking the blood pressure of a patient wearing a headscarf', 'Pexels', 'https://www.pexels.com/photo/a-doctor-taking-blood-pressure-of-a-patient-7659572/') },
      { title: 'Neighbors helping neighbors', text: 'Food drives, disaster relief and volunteer days.', image: px('home/volunteers.jpg', 'Volunteers packing food donations together', 'Pexels', 'https://www.pexels.com/photo/volunteers-boxing-foods-to-be-distributed-6591165/') },
      { title: 'Ramadan and Eid together', text: 'Community iftars and Eid prayers for thousands of families.', image: px('home/iftar.jpg', 'A group of friends sharing an iftar meal', 'Pexels', 'https://www.pexels.com/photo/indonesian-family-celebrating-iftar-together-36087668/') },
    ],
  },
  journey: {
    title: 'Join in about five minutes.',
    steps: [
      { title: 'Verify your email', text: 'We send a 6-digit code. No password needed.' },
      { title: 'Add your address', text: 'We match you to your zone and Islamic Center.' },
      { title: 'Choose and pay', text: 'Card, Apple Pay or Google Pay. Receipt by email.' },
      { title: 'Get approved', text: "Follow each step and see exactly what's needed to vote." },
    ],
  },
  houston: {
    title: 'Rooted in Houston since 1969',
    text: 'ISGH began with a handful of families and grew into one of the largest Muslim communities in North America, organized into five zones so every neighborhood has a voice on the Board.',
    image: px('home/houston-skyline.jpg', 'Downtown Houston skyline under a clear blue sky', 'Pexels', 'https://www.pexels.com/photo/modern-houston-skyline-in-daylight-29781715/', '50% 60%'),
    cta: { label: 'About ISGH', href: '/about' },
  },
  closing: {
    title: 'Be counted in 2027.',
    text: 'Join or renew before June 30 so your voice is part of the next ISGH elections.',
    image: px('home/family-prayer.jpg', 'A father and his young son sitting together', 'Pexels', 'https://www.pexels.com/photo/father-and-son-kneeling-on-the-floor-9127577/'),
    cta: { label: 'Become a member', href: '/membership/join' },
  },
};
