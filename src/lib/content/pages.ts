/**
 * CONTRACT – GET /public/pages/{slug}  (admin: CMS › Pages – block editor, drafts, versions, scheduled publish)
 * Also GET /public/news?limit=n (admin: CMS › News).
 * Content below is starter content written from the ISGH Constitution & Bylaws (28 Sep 2025) and public ISGH
 * information; admins will edit it. Legal pages are marked as drafts needing legal review.
 */
import { z } from 'zod';
import { ImageRefSchema, pexels } from './home';

export const BlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: z.string() }),
  z.object({ type: z.literal('paragraph'), text: z.string() }),
  z.object({ type: z.literal('list'), items: z.array(z.string()), ordered: z.boolean().optional() }),
  z.object({ type: z.literal('callout'), tone: z.enum(['info', 'warning', 'success']), title: z.string(), text: z.string() }),
  z.object({ type: z.literal('faq'), items: z.array(z.object({ q: z.string(), a: z.string() })) }),
  z.object({ type: z.literal('facts'), items: z.array(z.object({ value: z.string(), label: z.string() })) }),
  z.object({ type: z.literal('cta'), title: z.string(), text: z.string(), label: z.string(), href: z.string() }),
  z.object({ type: z.literal('contact'), lines: z.array(z.object({ label: z.string(), value: z.string(), href: z.string().optional() })) }),
]);
export type Block = z.infer<typeof BlockSchema>;

export const PageSchema = z.object({
  slug: z.string(),
  title: z.string(),
  intro: z.string().optional(),
  image: ImageRefSchema.optional(),
  status: z.enum(['published', 'draft']).default('published'),
  updatedAt: z.string(),
  blocks: z.array(BlockSchema),
});
export type Page = z.infer<typeof PageSchema>;

export const NewsItemSchema = z.object({ slug: z.string(), title: z.string(), date: z.string(), excerpt: z.string() });
export type NewsItem = z.infer<typeof NewsItemSchema>;

const U = '2026-10-13';

/** Mock pages are written in input form (defaults like status=published filled in by the schema). */
const parsePages = (raw: Record<string, z.input<typeof PageSchema>>): Record<string, Page> => Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, PageSchema.parse(v)]));
export const mockPages: Record<string, Page> = parsePages({
  about: {
    slug: 'about', title: 'About ISGH', updatedAt: U,
    image: { src: pexels(9556461, 1800), alt: 'Houston skyline lit up at night, reflected in the bayou', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/city-skyline-during-night-time-9556461/' },
    intro: 'The Islamic Society of Greater Houston serves Muslims across the Houston area through its Islamic Centers, schools, clinics and community programs.',
    blocks: [
      { type: 'facts', items: [{ value: '1969', label: 'Founded' }, { value: '22', label: 'Islamic Centers' }, { value: '5', label: 'Zones' }, { value: '501(c)(3)', label: 'Texas nonprofit' }] },
      { type: 'heading', text: 'Our purpose' },
      { type: 'paragraph', text: 'ISGH works to serve the religious, educational and social needs of Muslims in Greater Houston, to support every Islamic Center, and to build understanding with our neighbors of all faiths.' },
      { type: 'heading', text: 'How ISGH is organized' },
      { type: 'list', items: [
        'Greater Houston is divided into five zones: North, Northwest, Southwest, South and Southeast.',
        'Each zone has one or more Islamic Centers, and each center has an elected Associate Director.',
        'The Board of Directors has nine elected members: four officers elected at large and five Zonal Directors.',
        'Eligible voting members elect the Board and the leaders of their own zone and center.',
      ] },
      { type: 'cta', title: 'Have a say in how ISGH is run', text: 'Members in good standing vote in ISGH elections.', label: 'Become a member', href: '/membership/join' },
    ],
  },
  elections: {
    slug: 'elections', title: 'Elections', updatedAt: U,
    image: { src: pexels(8022480, 1800), alt: 'A masjid with a large dome and minaret', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/the-yanus-emre-mosque-in-karaman-turkey-8022480/' },
    intro: 'ISGH members elect their Board of Directors, Zonal Directors, Associate Directors and Area Representatives.',
    blocks: [
      { type: 'callout', tone: 'warning', title: 'Voting deadline: June 30', text: 'To vote in a year’s elections, your own dues for that year must be paid by June 30. Paying later renews your membership but does not restore your vote for that year.' },
      { type: 'heading', text: 'Who can vote' },
      { type: 'list', items: [
        'Your membership application is approved by the Board.',
        'You are 18 or older.',
        'You paid your own dues for the year by June 30 (or a relative by blood or marriage paid them), or you are a Life member.',
        'You chose at least one commitment: take part in an ISGH program, contribute a fair share, or volunteer.',
        'You live in the area of your zone and Islamic Center.',
      ] },
      { type: 'heading', text: 'When elections happen' },
      { type: 'paragraph', text: 'Elections are held by secret ballot on the second Sunday of December, with all balloting completed between November 15 and December 31. Officers serve two-year terms, so half of the positions are elected each year.' },
      { type: 'heading', text: 'Running for office' },
      { type: 'paragraph', text: 'Board members must be members in good standing for at least one year (two years for President and Vice President) and be U.S. citizens or permanent residents. A Zonal Director must live in that zone.' },
      { type: 'callout', tone: 'info', title: 'Dates are set each year', text: 'The Election Commission publishes the exact dates and deadlines for each election here.' },
    ],
  },
  faq: {
    slug: 'faq', title: 'Frequently asked questions', updatedAt: U,
    blocks: [{ type: 'faq', items: [
      { q: 'Who can become a member?', a: 'Every Muslim in Greater Houston can join as a member. Friends of the community who are not Muslim can join as Associate members (no voting or office).' },
      { q: 'How much are dues?', a: 'Dues are set by the Board each year. Current amounts are shown on the Plans and dues page. Dues are not refundable.' },
      { q: 'When does my membership end?', a: 'Annual memberships run from January 1 to December 31. Life memberships never expire.' },
      { q: 'What is the June 30 deadline?', a: 'To vote in a year’s elections, your dues for that year must be paid by June 30.' },
      { q: 'Can I pay for my spouse or parent?', a: 'Yes. The Bylaws allow dues to be paid by a relative by blood or marriage. We will ask how you are related.' },
      { q: 'How is my Islamic Center chosen?', a: 'By your home address. If you live within five miles of a zone border, you can ask to join a nearby center instead.' },
      { q: 'Is my information safe?', a: 'We collect only what the Bylaws require, card payments are handled by Stripe, and ID images are deleted after review.' },
    ] }],
  },
  contact: {
    slug: 'contact', title: 'Contact us', updatedAt: U,
    intro: 'Questions about your membership, renewals or voting eligibility? We are here to help.',
    blocks: [
      { type: 'contact', lines: [
        { label: 'Phone', value: '(713) 524-6615 ext. 105', href: 'tel:+17135246615,105' },
        { label: 'Email', value: 'membership@isgh.org', href: 'mailto:membership@isgh.org' },
        { label: 'Address', value: '3110 Eastside St, Houston, TX 77098' },
        { label: 'Office hours', value: 'Monday to Friday, 9:00 AM to 5:00 PM CT' },
      ] },
      { type: 'callout', tone: 'info', title: 'Faster answers', text: 'Sign in to see your membership status and eligibility checklist any time.' },
    ],
  },
  'centers/zones': {
    slug: 'centers/zones', title: 'The five zones', updatedAt: U,
    intro: 'For representation, Greater Houston is divided into five zones that meet in central Houston.',
    blocks: [
      { type: 'list', items: ['North zone', 'Northwest zone', 'Southwest zone', 'South zone', 'Southeast zone'] },
      { type: 'paragraph', text: 'Zone boundaries follow roads, creeks and bayous, not ZIP codes. Each zone elects a Zonal Director to the ISGH Board, and each Islamic Center elects an Associate Director.' },
      { type: 'callout', tone: 'info', title: 'Live near a border?', text: 'Members living within five miles of a zone border can ask to join a nearby center. If approved, the choice stays in place for five years.' },
    ],
  },
  centers: {
    slug: 'centers', title: 'Islamic Centers', updatedAt: U,
    image: { src: pexels(30159436, 1800), alt: 'Arches inside a masjid prayer hall', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/30159436/' },
    intro: 'ISGH has 22 Islamic Centers across five zones.',
    blocks: [
      { type: 'callout', tone: 'info', title: 'Directory coming soon', text: 'The full list of centers, with addresses, contacts and programs, is managed by ISGH staff and will appear here.' },
      { type: 'cta', title: 'Not sure which center is yours?', text: 'Your home address decides your zone and center.', label: 'Find my center', href: '/centers/find' },
    ],
  },
  'centers/find': {
    slug: 'centers/find', title: 'Find my Islamic Center', updatedAt: U,
    intro: 'Enter your address during sign-up and we will show your zone and Islamic Center on a map.',
    blocks: [{ type: 'cta', title: 'Join and see your center', text: 'It takes about five minutes.', label: 'Become a member', href: '/membership/join' }],
  },
  'membership/renew': {
    slug: 'membership/renew', title: 'Renew your membership', updatedAt: U,
    intro: 'Renewal for 2027 opens November 1, 2026. Renew by June 30, 2027 to keep your vote in the 2027 ISGH elections.',
    blocks: [
      { type: 'list', ordered: true, items: ['Sign in with Google or a code sent to your email.', 'Check your details and household.', 'Pay your 2027 dues by card, Apple Pay or Google Pay.'] },
      { type: 'callout', tone: 'warning', title: 'June 30 matters', text: 'If you pay after June 30, you stay a member for the year but cannot vote, nominate or hold office that year (Bylaws Article I, Section 3).' },
      { type: 'cta', title: 'See your status now', text: 'Your member home shows your voting checklist and when renewal opens.', label: 'Sign in', href: '/sign-in?next=/portal' },
    ],
  },
  events: {
    slug: 'events', title: 'Events', updatedAt: U,
    blocks: [{ type: 'callout', tone: 'info', title: 'No events listed yet', text: 'Upcoming events from all centers will appear here.' }],
  },
  volunteer: {
    slug: 'volunteer', title: 'Volunteer', updatedAt: U,
    image: { src: pexels(6646900, 1800), alt: 'Two smiling volunteers carrying boxes of food and medicine', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/a-man-and-woman-carrying-medicine-and-food-cardboard-boxes-6646900/' },
    intro: 'Give your time at an Islamic Center, a Shifa clinic, a food drive or an election.',
    blocks: [
      { type: 'list', items: ['Food drives and disaster relief', 'Weekend schools and youth programs', 'Funeral services (janazah) support', 'Election day helpers', 'Events, Ramadan iftars and Eid prayers'] },
      { type: 'callout', tone: 'success', title: 'Volunteering counts', text: 'Volunteering in approved ISGH activities is one of the commitments that make a member eligible to vote.' },
      { type: 'cta', title: 'Ready to help?', text: 'Tell us what you are interested in and a coordinator will contact you.', label: 'Contact us', href: '/contact' },
    ],
  },
  'constitution-bylaws': {
    slug: 'constitution-bylaws', title: 'Constitution and Bylaws', updatedAt: U,
    intro: 'The rules that govern ISGH membership, elections and leadership. Current version: as of September 28, 2025.',
    blocks: [
      { type: 'cta', title: 'Read the full document', text: 'PDF, about 40 pages.', label: 'Download the Constitution and Bylaws (PDF)', href: '/documents/isgh-constitution-bylaws-2025-09-28.pdf' },
      { type: 'heading', text: 'Key membership rules' },
      { type: 'list', items: ['Every Muslim is a natural member; non-Muslims may join as associate members (no voting or office).', 'Voting members must be 18 or older, approved by the Board, and pay their own dues for the year by June 30.', 'Dues are on a calendar year and are not refundable.', 'Life membership: one-time payment of at least $1,000.', 'Members belong to the zone and Islamic Center where they live.'] },
    ],
  },
  reports: {
    slug: 'reports', title: 'Annual and financial reports', updatedAt: U,
    intro: 'ISGH publishes yearly reports so members can see how dues and donations are used.',
    blocks: [{ type: 'callout', tone: 'info', title: 'Reports are being added', text: 'Annual reports and audited financial statements will be listed here by year.' }],
  },
  accessibility: {
    slug: 'accessibility', title: 'Accessibility', updatedAt: U,
    blocks: [
      { type: 'paragraph', text: 'We want everyone to be able to use this website. We design to meet the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.' },
      { type: 'list', items: ['Works with a keyboard and screen readers', 'Readable color contrast in light and dark mode', 'Respects reduced-motion settings'] },
      { type: 'paragraph', text: 'If something is hard to use, email membership@isgh.org or call (713) 524-6615 ext. 105 and we will help.' },
    ],
  },
  privacy: {
    slug: 'privacy', title: 'Privacy policy', status: 'draft', updatedAt: U,
    blocks: [
      { type: 'callout', tone: 'warning', title: 'Draft – pending legal review', text: 'This summary will be replaced by the policy approved by ISGH legal counsel.' },
      { type: 'list', items: ['We collect only what membership and the Bylaws require.', 'Card payments are processed by Stripe; we never store card numbers.', 'ID images are encrypted and deleted after review.', 'You can ask for a copy of your data or ask us to delete it.'] },
    ],
  },
  terms: {
    slug: 'terms', title: 'Terms of use', status: 'draft', updatedAt: U,
    blocks: [{ type: 'callout', tone: 'warning', title: 'Draft – pending legal review', text: 'Terms of use will be published after ISGH legal review.' }],
  },
});

export const mockNews: NewsItem[] = [
  { slug: 'nominations-open-2026', title: 'Nominations open for the 2026 Board elections', date: '2026-10-08', excerpt: 'Who can run, key dates, and how to apply.' },
  { slug: 'north-zone-weekend-school', title: 'New weekend school opens in the North zone', date: '2026-09-29', excerpt: 'Classes start in November for ages 5 to 14.' },
  { slug: 'renewal-2027-open', title: '2027 membership renewal opens November 1', date: '2026-09-15', excerpt: 'Renew early and keep your vote for 2027.' },
];
