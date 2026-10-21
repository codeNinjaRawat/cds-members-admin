/**
 * CONTRACT – GET /public/pages/{slug}  (admin: CMS › Pages – block editor, drafts, versions, scheduled publish)
 * Also GET /public/news?limit=n (admin: CMS › News).
 * Content below is starter content written from the ISGH Constitution & Bylaws (28 Sep 2025) and public ISGH
 * information; admins will edit it. Legal pages are marked as drafts needing legal review.
 */
import { z } from 'zod';
import { ImageRefSchema, pexels } from './home';

/* ---------- Blocks v2 (O1) ----------
 * Static blocks are typed by admins; LIVE blocks only name what to show – the data comes from the admin modules
 * (prayer times, events, campaigns, officials, centers, membership) and is rendered on the server. Unknown block
 * types are skipped by the website, so older content never breaks. Widths: block-level `width` overrides the template.
 */
const Width = z.enum(['narrow', 'wide', 'full']).optional();
const Href = z.string().max(500);
const Text = z.string().max(4000);
export const ALLOWED_EMBED_HOSTS = ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com', 'www.google.com', 'maps.google.com', 'docs.google.com'] as const;
export const EMBED_KINDS = ['video', 'map', 'form', 'other'] as const;
export const LIVE_VIEWS = ['today', 'week', 'month'] as const;
export const LEADERSHIP_SCOPES = ['board', 'zone', 'masjid'] as const;
export const FORM_KINDS = ['feedback', 'complaint', 'verify'] as const;
/** Which masjid a live block is about: a center id from Admin › Zones and centers; empty = the page's masjid (or all). */
const Masjid = z.string().max(40).default('');

const STATIC_BLOCKS = [
  z.object({ type: z.literal('heading'), text: z.string().max(200), level: z.enum(['2', '3']).optional(), width: Width }),
  z.object({ type: z.literal('paragraph'), text: Text, width: Width }),
  z.object({ type: z.literal('list'), items: z.array(z.string().max(600)).max(40), ordered: z.boolean().optional(), width: Width }),
  z.object({ type: z.literal('callout'), tone: z.enum(['info', 'warning', 'success']), title: z.string().max(120), text: Text, width: Width }),
  z.object({ type: z.literal('faq'), items: z.array(z.object({ q: z.string().max(200), a: Text })).max(40), width: Width }),
  z.object({ type: z.literal('facts'), items: z.array(z.object({ value: z.string().max(40), label: z.string().max(60) })).max(8), width: Width }),
  z.object({ type: z.literal('cta'), title: z.string().max(120), text: Text, label: z.string().max(60), href: Href, width: Width }),
  z.object({ type: z.literal('contact'), lines: z.array(z.object({ label: z.string().max(40), value: z.string().max(200), href: Href.optional() })).max(12), width: Width }),
  // --- new in v2 ---
  z.object({ type: z.literal('image'), image: ImageRefSchema, caption: z.string().max(200).optional(), width: Width }),
  z.object({ type: z.literal('gallery'), images: z.array(ImageRefSchema).max(24), caption: z.string().max(200).optional(), width: Width }),
  z.object({ type: z.literal('columns'), columns: z.array(z.object({ title: z.string().max(120).optional(), text: Text })).min(2).max(3), width: Width }),
  z.object({ type: z.literal('cards'), items: z.array(z.object({ title: z.string().max(120), text: Text.optional(), href: Href.optional(), label: z.string().max(40).optional(), image: ImageRefSchema.optional() })).max(24), columns: z.enum(['2', '3', '4']).optional(), width: Width }),
  z.object({ type: z.literal('steps'), items: z.array(z.object({ title: z.string().max(120), text: Text.optional() })).max(12), width: Width }),
  z.object({ type: z.literal('people'), items: z.array(z.object({ name: z.string().max(80), role: z.string().max(120).optional(), note: z.string().max(200).optional(), email: z.string().max(120).optional(), phone: z.string().max(40).optional(), image: ImageRefSchema.optional() })).max(40), width: Width }),
  z.object({ type: z.literal('buttons'), items: z.array(z.object({ label: z.string().max(60), href: Href, style: z.enum(['primary', 'secondary', 'ghost']).optional() })).min(1).max(6), width: Width }),
  z.object({ type: z.literal('documents'), items: z.array(z.object({ title: z.string().max(160), href: Href, kind: z.string().max(12).optional(), size: z.string().max(20).optional(), date: z.string().max(10).optional() })).max(60), width: Width }),
  z.object({ type: z.literal('table'), caption: z.string().max(160).optional(), header: z.array(z.string().max(80)).max(12), rows: z.array(z.array(z.string().max(200)).max(12)).max(200), width: Width }),
  z.object({ type: z.literal('embed'), kind: z.enum(EMBED_KINDS).default('other'), url: Href, title: z.string().max(160), width: Width }),
  z.object({ type: z.literal('verse'), text: Text, arabic: z.string().max(1000).optional(), source: z.string().min(1).max(160), width: Width }),
  z.object({ type: z.literal('divider'), label: z.string().max(60).optional() }),
] as const;
const LIVE_BLOCKS = [
  z.object({ type: z.literal('prayer-times'), masjid: Masjid, view: z.enum(LIVE_VIEWS).default('today'), showIqamah: z.boolean().default(true), width: Width }),
  z.object({ type: z.literal('next-jumuah'), masjid: Masjid, width: Width }),
  z.object({ type: z.literal('events'), masjid: Masjid, category: z.string().max(20).default(''), limit: z.number().int().min(1).max(24).default(6), emptyText: z.string().max(200).default(''), width: Width }),
  z.object({ type: z.literal('campaigns'), masjid: Masjid, limit: z.number().int().min(1).max(12).default(3), emptyText: z.string().max(200).default(''), width: Width }),
  z.object({ type: z.literal('leadership'), scope: z.enum(LEADERSHIP_SCOPES).default('board'), masjid: Masjid, zone: z.string().max(40).default(''), width: Width }),
  z.object({ type: z.literal('masjid-cards'), zone: z.string().max(40).default(''), width: Width }),
  z.object({ type: z.literal('deadline'), title: z.string().max(120).default(''), width: Width }),
  z.object({ type: z.literal('news'), limit: z.number().int().min(1).max(12).default(3), width: Width }),
  z.object({ type: z.literal('plans'), width: Width }),
  z.object({ type: z.literal('form'), kind: z.enum(FORM_KINDS), width: Width }),
  /** O10 – the featured election (year 0) or a given year: status, dates, ballot, results – public parts only */
  z.object({ type: z.literal('election'), year: z.number().int().min(0).max(2200).default(0), width: Width }),
  /** O6 – Friday khutbah schedule: one masjid (coming `weeks`) or, with no masjid on an organization page, every masjid next Friday */
  z.object({ type: z.literal('khutbah'), masjid: Masjid, weeks: z.number().int().min(1).max(12).default(6), width: Width }),
  /** O4 – what is happening (derived from events, news, campaigns, leaders, prayer changes, documents). view: feed = list with filters; week = "this week" digest */
  z.object({ type: z.literal('activity'), masjid: Masjid, view: z.enum(['feed', 'week']).default('week'), kinds: z.array(z.string().max(20)).max(9).default([]), limit: z.number().int().min(1).max(100).default(12), width: Width }),
] as const;
export const StaticBlockSchema = z.discriminatedUnion('type', [...STATIC_BLOCKS]);
export const LiveBlockSchema = z.discriminatedUnion('type', [...LIVE_BLOCKS]);
/** One discriminated union (the admin form builder understands this shape) */
export const BlockSchema = z.discriminatedUnion('type', [...STATIC_BLOCKS, ...LIVE_BLOCKS]);
export type Block = z.infer<typeof BlockSchema>;
export type StaticBlock = z.infer<typeof StaticBlockSchema>;
export type LiveBlock = z.infer<typeof LiveBlockSchema>;
export const BLOCK_TYPES = BlockSchema.options.map((o) => o.shape.type.value) as Block['type'][];
export const LIVE_BLOCK_TYPES = LIVE_BLOCKS.map((o) => o.shape.type.value) as LiveBlock['type'][];
export const isLiveBlock = (b: Block): b is LiveBlock => (LIVE_BLOCK_TYPES as string[]).includes(b.type);

export const PAGE_TEMPLATES = ['article', 'landing', 'hub'] as const;
export const PAGE_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const;
/** Who a page belongs to: the organization, or one masjid (center id from Admin › Zones and centers). */
export const PageScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('org') }),
  z.object({ kind: z.literal('masjid'), center: z.string().min(1).max(40) }),
]);
export const SeoSchema = z.object({
  title: z.string().max(70).default(''),
  description: z.string().max(160).default(''),
  image: ImageRefSchema.optional(),
  noIndex: z.boolean().default(false),
});
const ISO_DATETIME = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Use a date like 2026-11-01 or 2026-11-01T09:00')]);

export const PageSchema = z.object({
  slug: z.string(),
  title: z.string(),
  intro: z.string().optional(),
  image: ImageRefSchema.optional(),
  status: z.enum(PAGE_STATUSES).default('published'),
  updatedAt: z.string(),
  blocks: z.array(BlockSchema),
  // v2 (all optional – every v1 page stays valid)
  scope: PageScopeSchema.default({ kind: 'org' }),
  template: z.enum(PAGE_TEMPLATES).default('article'),
  seo: SeoSchema.default({ title: '', description: '', noIndex: false }),
  visibility: z.enum(['public', 'members']).default('public'),
  /** Houston time. `scheduled` pages go live at publishAt; any page disappears at unpublishAt. */
  publishAt: ISO_DATETIME.default(''),
  unpublishAt: ISO_DATETIME.default(''),
  owner: z.string().max(80).default(''),
  reviewedAt: z.string().max(10).default(''),
});
export type Page = z.infer<typeof PageSchema>;
export type PageScope = z.infer<typeof PageScopeSchema>;

/** `masjid`: center id when the item is one masjid's announcement; `showOnMasjids`: an organization item that every masjid page shows too. */
export const NewsItemSchema = z.object({ slug: z.string(), title: z.string(), date: z.string(), excerpt: z.string(), masjid: z.string().max(40).default(''), showOnMasjids: z.boolean().default(false),
  /** O9 – text first: the flyer is an attachment, never the only content */
  image: ImageRefSchema.optional(), attachments: z.array(z.object({ title: z.string().max(120), href: z.string().max(500) })).max(6).default([]), pinned: z.boolean().default(false), expiresAt: z.string().max(10).default('') });
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
      { type: 'election' },
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
  services: {
    slug: 'services', title: 'Services', updatedAt: U, template: 'hub',
    intro: 'What the organization and its masajid do for the community: help in hard times, education, marriage, dawah and funerals.',
    blocks: [
      { type: 'cards', columns: '3', items: [
        { title: 'Financial assistance', text: 'Zakat and emergency help for families, by application and interview.', href: '/services/financial-assistance', label: 'How to apply' },
        { title: 'Islamic education', text: 'Weekend schools, full-time schools, hifz and adult classes.', href: '/services/islamic-education', label: 'Find a class' },
        { title: 'Job networking', text: 'Resumes, referrals and employer contacts within the community.', href: '/services/job-networking', label: 'Learn more' },
        { title: 'Nikah', text: 'Marriage services, pre-marital counseling and the nikah ceremony.', href: '/services/nikah', label: 'Reserve a nikah' },
        { title: 'Dawah', text: 'Masjid tours, new-Muslim classes and interfaith programs.', href: '/services/dawah', label: 'Learn more' },
        { title: 'Funerals and cemetery', text: 'Ghusl, janazah, burial and the cemetery – available every day.', href: '/services/funerals', label: 'Urgent help' },
      ] },
      { type: 'heading', text: 'Programs at every masjid' },
      { type: 'buttons', items: [{ label: 'Browse programs', href: '/programs', style: 'primary' }, { label: 'All masajid', href: '/masajid', style: 'secondary' }] },
      { type: 'form', kind: 'feedback' },
    ],
  },
  'services/financial-assistance': {
    slug: 'services/financial-assistance', title: 'Financial assistance', updatedAt: U, owner: 'Zakat office',
    intro: 'Help for individuals and families in Greater Houston facing hardship, funded by zakat and sadaqah.',
    blocks: [
      { type: 'steps', items: [{ title: 'Apply', text: 'Complete the application and gather your ID, proof of address and income documents.' }, { title: 'Interview', text: 'A case worker meets you at the zakat office or by phone.' }, { title: 'Decision', text: 'Approved help is paid to the landlord, utility or provider directly whenever possible.' }] },
      { type: 'callout', tone: 'info', title: 'Who can apply', text: 'Residents of the Greater Houston area in need, regardless of membership. Zakat is distributed according to the eligible categories.' },
      { type: 'contact', lines: [{ label: 'Zakat office', value: '(713) 684-8939 ext. 200', href: 'tel:+17136848939,200' }, { label: 'Email', value: 'zakat@isgh.org', href: 'mailto:zakat@isgh.org' }] },
      { type: 'faq', items: [{ q: 'How long does a decision take?', a: 'Usually within two weeks of the interview; emergencies are reviewed faster.' }, { q: 'Can I apply for someone else?', a: 'You may refer a family; the application must be completed by the person in need.' }] },
      { type: 'cta', title: 'Give zakat', text: 'Every dollar of zakat goes to eligible recipients in our community.', label: 'Give zakat', href: '/give?fund=zakat' },
    ],
  },
  'services/islamic-education': {
    slug: 'services/islamic-education', title: 'Islamic education', updatedAt: U,
    intro: 'Weekend schools at the masajid, full-time Islamic schools, hifz and adult learning.',
    blocks: [
      { type: 'events', masjid: '', category: 'education', limit: 8, emptyText: 'Classes for the coming weeks will appear here.' },
      { type: 'cards', columns: '3', items: [{ title: 'Weekend schools', text: 'Quran, Islamic studies and Arabic for children, at most masajid.', href: '/programs', label: 'Find one' }, { title: 'Full-time schools', text: 'Accredited Islamic schools from pre-K to 12.', href: '/programs', label: 'Schools' }, { title: 'Adults', text: 'Tajweed, Arabic, seerah and new-Muslim classes.', href: '/programs', label: 'Classes' }] },
      { type: 'cta', title: 'Support a student', text: 'Education funds keep tuition within reach.', label: 'Give to education', href: '/give' },
    ],
  },
  'services/job-networking': {
    slug: 'services/job-networking', title: 'Job networking', updatedAt: U,
    intro: 'Community members helping each other find work: resume reviews, referrals and employer contacts.',
    blocks: [
      { type: 'list', items: ['Share your resume with volunteer reviewers.', 'Monthly networking meet-ups at a masjid.', 'Employers in the community post openings.'] },
      { type: 'buttons', items: [{ label: 'Post or find a job', href: '/contact', style: 'primary' }, { label: 'Volunteer as a reviewer', href: '/volunteer', style: 'secondary' }] },
    ],
  },
  'services/nikah': {
    slug: 'services/nikah', title: 'Nikah', updatedAt: U,
    intro: 'Marriage services: counseling before marriage, the nikah ceremony at a masjid, and the certificate.',
    blocks: [
      { type: 'steps', items: [{ title: 'Request a date', text: 'Tell us the masjid, date and the two witnesses.' }, { title: 'Documents', text: 'Government IDs and, where required, the marriage license.' }, { title: 'Ceremony', text: 'An imam conducts the nikah; the certificate follows within a week.' }] },
      { type: 'callout', tone: 'info', title: 'Pre-marital workshop', text: 'Couples are encouraged to attend the workshop before the nikah.' },
      { type: 'buttons', items: [{ label: 'Reserve a nikah', href: '/contact', style: 'primary' }] },
    ],
  },
  'services/dawah': {
    slug: 'services/dawah', title: 'Dawah', updatedAt: U,
    intro: 'Sharing Islam with neighbors: masjid tours, new-Muslim classes, literature and interfaith programs.',
    blocks: [
      { type: 'cards', columns: '3', items: [{ title: 'Visit a masjid', text: 'Every masjid welcomes visitors – ask for a tour.', href: '/masajid', label: 'Find a masjid' }, { title: 'New-Muslim classes', text: 'Weekly classes for those new to Islam.', href: '/programs', label: 'Classes' }, { title: 'Interfaith', text: 'Dialogues and service projects with other faith communities.', href: '/events', label: 'Events' }] },
      { type: 'cta', title: 'Questions about Islam?', text: 'Write to us and an imam will answer.', label: 'Contact us', href: '/contact' },
    ],
  },
  'services/funerals': {
    slug: 'services/funerals', title: 'Funerals and cemetery', updatedAt: U, owner: 'Funeral services',
    intro: 'When a loved one passes, call us first – ghusl, janazah prayer, burial and the cemetery are arranged the same day whenever possible.',
    blocks: [
      { type: 'callout', tone: 'warning', title: 'Urgent: a death has occurred', text: 'Call the funeral manager now, any hour. Then gather the ID of the deceased and the name of the next of kin.' },
      { type: 'contact', lines: [{ label: 'Funeral manager', value: '(832) 421-0671', href: 'tel:+18324210671' }, { label: 'Email', value: 'funeral.manager@isgh.org', href: 'mailto:funeral.manager@isgh.org' }] },
      { type: 'steps', items: [{ title: 'Call', text: 'The manager coordinates with the hospital or home.' }, { title: 'Ghusl and shroud', text: 'At the ghusl center; family may take part.' }, { title: 'Janazah', text: 'After a daily prayer at the nearest masjid.' }, { title: 'Burial', text: 'At the community cemetery; plots can be reserved in advance.' }] },
      { type: 'faq', items: [{ q: 'What does it cost?', a: 'A standard package covers ghusl, shroud, transport and the plot; families in need are never turned away.' }, { q: 'Can I reserve a plot?', a: 'Yes – plot reservations are available for members and non-members.' }] },
      { type: 'buttons', items: [{ label: 'Reserve a plot', href: '/give', style: 'secondary' }, { label: 'Support the funeral fund', href: '/give', style: 'ghost' }] },
    ],
  },
  'style-guide': {
    slug: 'style-guide', title: 'Page blocks – style guide', status: 'draft', updatedAt: U, template: 'hub', owner: 'Website team',
    intro: 'Every block admins can place on a page, shown once. Draft: not listed in search engines. Copy any block from here into your own page.',
    blocks: [
      { type: 'heading', text: 'Text blocks' },
      { type: 'paragraph', text: 'Paragraphs support **bold** words and [links](/membership). Keep paragraphs short on phones.' },
      { type: 'columns', columns: [{ title: 'Two columns', text: 'Side by side on wide screens, stacked on phones.' }, { title: 'Second column', text: 'Use for before/after, brothers/sisters, English/Arabic.' }] },
      { type: 'list', items: ['A list item', 'Another item', 'Items wrap nicely'] },
      { type: 'callout', tone: 'info', title: 'Callout', text: 'For a note, a deadline or a warning (tones: info, warning, success).' },
      { type: 'verse', arabic: 'وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ', text: 'And establish prayer and give zakah.', source: 'Quran 2:43' },
      { type: 'facts', items: [{ value: '1969', label: 'Founded' }, { value: '22', label: 'Islamic Centers' }, { value: '5', label: 'Zones' }, { value: '3', label: 'Jumuah prayers' }] },
      { type: 'steps', items: [{ title: 'Choose a plan', text: 'Individual, Checkomatic or Lifetime.' }, { title: 'Tell us about you', text: 'Name as on your ID, address, phone.' }, { title: 'Pay dues', text: 'Card, Apple Pay or Google Pay.' }] },
      { type: 'faq', items: [{ q: 'What is an FAQ block?', a: 'Questions that open on tap. Good for rules and deadlines.' }] },
      { type: 'divider', label: 'Media' },
      { type: 'image', image: { src: pexels(30159436, 1600), alt: 'Arches inside a masjid prayer hall', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/30159436/' }, caption: 'A single photo with a caption and credit.' },
      { type: 'gallery', images: [
        { src: pexels(8022480, 900), alt: 'A masjid with a large dome and minaret', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/the-yanus-emre-mosque-in-karaman-turkey-8022480/' },
        { src: pexels(9556461, 900), alt: 'Houston skyline at night', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/city-skyline-during-night-time-9556461/' },
        { src: pexels(6646900, 900), alt: 'Volunteers carrying boxes', credit: 'Pexels', creditUrl: 'https://www.pexels.com/photo/a-man-and-woman-carrying-medicine-and-food-cardboard-boxes-6646900/' },
      ], caption: 'Gallery: two columns on phones, more on wide screens.' },
      { type: 'embed', kind: 'video', url: 'https://www.youtube-nocookie.com/embed/MBAzMxTj-w8', title: 'How to sign up for membership (video)' },
      { type: 'embed', kind: 'other', url: 'https://example.org/not-allowed', title: 'An embed from a host that is not allowed shows as a link' },
      { type: 'divider', label: 'Cards, people, buttons, documents, table' },
      { type: 'cards', columns: '3', items: [
        { title: 'Prayer times', text: 'Adhan and iqamah at every masjid.', href: '/prayer-times', label: 'Open' },
        { title: 'Events', text: 'Classes, iftars, family nights.', href: '/events', label: 'See events' },
        { title: 'Give', text: 'Zakat, sadaqah and campaigns.', href: '/give', label: 'Give' },
      ] },
      { type: 'people', items: [{ name: 'Associate Director', role: 'Example card', note: 'Term ends 12/31/2027', email: 'ad.example@isgh.org' }, { name: 'Imam', role: 'Religious director', phone: '(713) 524-6615' }] },
      { type: 'buttons', items: [{ label: 'Become a member', href: '/membership/join', style: 'primary' }, { label: 'Sign in', href: '/sign-in', style: 'secondary' }, { label: 'Learn more', href: '/membership', style: 'ghost' }] },
      { type: 'documents', items: [{ title: 'Constitution and Bylaws (as of September 28, 2025)', href: '/documents/isgh-constitution-bylaws-2025-09-28.pdf', kind: 'PDF', size: '1.2 MB', date: '2025-09-28' }, { title: 'Membership sign-up guide', href: '/membership/guide', kind: 'Page' }] },
      { type: 'table', caption: 'Membership levels (example)', header: ['Level', 'Dues', 'Renews', 'Votes'], rows: [['Individual', '$20 / year', 'Yearly', 'Yes, if paid by June 30'], ['Checkomatic', '$10 / month', 'Monthly', 'Yes, once $40 reached by June 30'], ['Lifetime (individual)', '$1,000 once', 'Never', 'Yes']] },
      { type: 'cta', title: 'Call to action', text: 'A dark band with one button.', label: 'Become a member', href: '/membership/join' },
      { type: 'contact', lines: [{ label: 'Phone', value: '(713) 524-6615', href: 'tel:+17135246615' }, { label: 'Email', value: 'info@isgh.org', href: 'mailto:info@isgh.org' }] },
      { type: 'divider', label: 'Live blocks – data from the admin modules' },
      { type: 'deadline' },
      { type: 'prayer-times', view: 'today' },
      { type: 'next-jumuah' },
      { type: 'events', limit: 3, emptyText: 'No upcoming events.' },
      { type: 'campaigns', limit: 2 },
      { type: 'leadership', scope: 'board' },
      { type: 'masjid-cards' },
      { type: 'news', limit: 3 },
      { type: 'plans' },
      { type: 'form', kind: 'feedback' },
    ],
  },
  terms: {
    slug: 'terms', title: 'Terms of use', status: 'draft', updatedAt: U,
    blocks: [{ type: 'callout', tone: 'warning', title: 'Draft – pending legal review', text: 'Terms of use will be published after ISGH legal review.' }],
  },
});

export const mockNews: NewsItem[] = z.array(NewsItemSchema).parse([
  { slug: 'nominations-open-2026', title: 'Nominations open for the 2026 Board elections', date: '2026-10-08', excerpt: 'Who can run, key dates, and how to apply.' },
  { slug: 'north-zone-weekend-school', title: 'New weekend school opens in the North zone', date: '2026-09-29', excerpt: 'Classes start in November for ages 5 to 14.' },
  { slug: 'renewal-2027-open', title: '2027 membership renewal opens November 1', date: '2026-09-15', excerpt: 'Renew early and keep your vote for 2027.' },
]);
