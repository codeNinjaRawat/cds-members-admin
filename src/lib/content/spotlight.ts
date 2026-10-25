/**
 * CONTRACT – part of GET /public/pages/home (admin: Website › Home page › "Spotlight" tab)
 * The "spotlight" home layout: a loud, colorful membership landing page (owner 2026-10-25: "attractive colors,
 * good US English, a crazy landing page"). Every word, color tone, icon and slide is admin-editable. Prices are NOT
 * here – plan cards and the price slide read the plans from Settings › Membership & dues (GET /public/membership/settings).
 * Defaults are tenant-neutral (no organization name, no numbers) so any organization can switch the layout on.
 */
import { z } from 'zod';

/** Our own icon set (components/home/spotlight/SpotIcon.tsx) – admins pick one by name. */
export const SPOT_ICONS = ['ballot', 'tag', 'card', 'masjid', 'family', 'code', 'pin', 'shield', 'calendar', 'receipt', 'megaphone', 'checklist', 'heart', 'star', 'crescent', 'book'] as const;
export type SpotIconName = (typeof SPOT_ICONS)[number];
/** Color tones of the "pop" palette (theme variables --pop-*, with fallbacks for other themes). */
export const SPOT_TONES = ['violet', 'yellow', 'coral', 'sky', 'mint', 'pink', 'white', 'ink'] as const;
export type SpotTone = (typeof SPOT_TONES)[number];

const Link = z.object({ label: z.string().trim().max(40), href: z.string().trim().max(300) });
const Tone = z.enum(SPOT_TONES);
const Icon = z.enum(SPOT_ICONS);

/**
 * Slider slides. "Smart" kinds fill themselves from live data:
 *   deadline – days left until the voting record date (Settings › Membership › record date)
 *   price    – the featured plan (or the cheapest visible plan) with its real price
 *   custom   – exactly the text the admin wrote
 */
export const SpotSlideSchema = z.object({
  kind: z.enum(['custom', 'deadline', 'price']).default('custom'),
  kicker: z.string().trim().max(40).default(''),
  title: z.string().trim().max(90).default(''),               // deadline/price: "{days}", "{date}", "{price}", "{plan}", "{unit}" are filled in
  text: z.string().trim().max(200).default(''),
  icon: Icon.default('star'),
  tone: Tone.default('violet'),
  cta: Link.optional(),
});
export type SpotSlide = z.infer<typeof SpotSlideSchema>;

export const SpotlightSchema = z.object({
  ticker: z.array(z.string().trim().max(60)).max(8).default(['Membership is open', 'Join in about five minutes', 'Bring your whole family']),
  /** The headline, word by word: a tone puts the word on a tilted color block; "plain" leaves it as text. */
  headline: z.array(z.object({ text: z.string().trim().max(40), tone: z.enum([...SPOT_TONES, 'plain']).default('plain') })).min(1).max(8)
    .default([{ text: 'Your', tone: 'plain' }, { text: 'masjid.', tone: 'violet' }, { text: 'Your', tone: 'plain' }, { text: 'vote.', tone: 'yellow' }, { text: 'Your', tone: 'plain' }, { text: 'people.', tone: 'mint' }]),
  lead: z.string().trim().max(300).default('Become a member in about five minutes. Vote in community elections, save on programs, and keep your whole family’s membership in one place.'),
  primary: Link.default({ label: 'Become a member', href: '/membership/join' }),
  secondary: Link.default({ label: 'I already have an account', href: '/sign-in' }),
  chips: z.array(z.object({ text: z.string().trim().max(40), tone: Tone.default('white') })).max(4)
    .default([{ text: 'No password needed', tone: 'sky' }, { text: 'Secure checkout', tone: 'white' }]),
  /** Spinning round badge around the lowest price ("JOIN • BELONG • VOTE •"). Empty = no badge. */
  badge: z.string().trim().max(48).default('Join • Belong • Vote • Build •'),
  /** The sample member card in the hero art. */
  card: z.object({ label: z.string().trim().max(20).default('Member'), tag: z.string().trim().max(20).default('Can vote ✓'), name: z.string().trim().max(30).default('Your name here') }).default({}),
  /** The countdown note in the hero art: before the record date / after it. */
  note: z.object({ before: z.string().trim().max(80).default('Pay your dues by then to vote.'), after: z.string().trim().max(80).default('Join today.') }).default({}),
  slides: z.array(SpotSlideSchema).max(6).default([
    { kind: 'deadline', kicker: 'Voting deadline', title: '{days} days left to keep your vote', text: 'Pay your dues by {date} to be on the voter list.', icon: 'ballot', tone: 'yellow', cta: { label: 'Join now', href: '/membership/join' } },
    { kind: 'price', kicker: 'Membership', title: '{plan}: {price} {unit}', text: 'Every plan includes your vote once dues are paid on time.', icon: 'card', tone: 'violet', cta: { label: 'See all plans', href: '#plans' } },
    { kind: 'custom', kicker: 'Families', title: 'Bring your whole family', text: 'Add your spouse and see everyone’s status in one place.', icon: 'family', tone: 'pink' },
  ]),
  /** Seconds per slide (0 = no autoplay). Autoplay always stops for visitors who ask for reduced motion. */
  slideSeconds: z.number().int().min(0).max(30).default(6),
  stripe: z.array(z.string().trim().max(24)).max(8).default(['Vote', 'Save', 'Belong', 'Build']),
  benefitsTitle: z.string().trim().max(80).default('What you get when you join'),
  benefits: z.array(z.object({ icon: Icon, title: z.string().trim().max(40), text: z.string().trim().max(160), tone: Tone })).max(8).default([
    { icon: 'ballot', title: 'A real say.', text: 'Vote for the leaders who run your masjid and your community.', tone: 'yellow' },
    { icon: 'tag', title: 'Member prices.', text: 'Save on programs, classes and services.', tone: 'sky' },
    { icon: 'masjid', title: 'Build your masjid.', text: 'Your dues keep the doors open for everyone.', tone: 'mint' },
    { icon: 'family', title: 'The whole family.', text: 'Add your spouse and see everyone’s status in one place.', tone: 'pink' },
    { icon: 'card', title: 'Card on your phone.', text: 'Your status and renewal date, always in your pocket.', tone: 'white' },
  ]),
  plansTitle: z.string().trim().max(80).default('Pick your plan.'),
  plansNote: z.string().trim().max(200).default(''),            // empty = "Pay by {record date} to vote that year."
  featuredLabel: z.string().trim().max(24).default('Most popular!'), // sticker on the plan marked "featured" in Settings › Membership
  stepsTitle: z.string().trim().max(80).default('Join in a few easy steps.'),
  statusTitle: z.string().trim().max(90).default('“Wait… can I vote this year?”'),
  statusText: z.string().trim().max(240).default('Sign in and find out in seconds. If something is missing, we’ll tell you exactly what to do.'),
  statusCta: Link.default({ label: 'Check my status', href: '/sign-in' }),
  checklist: z.array(z.object({ text: z.string().trim().max(60), done: z.boolean().default(true) })).max(6).default([
    { text: 'Membership approved', done: true }, { text: '18 or older', done: true }, { text: 'Dues paid on time', done: true }, { text: 'Photo ID checked', done: false },
  ]),
  faqTitle: z.string().trim().max(80).default('Got questions?'),
  faq: z.array(z.object({ q: z.string().trim().max(140), a: z.string().trim().max(600) })).max(10).default([]),
  closingTitle: z.string().trim().max(60).default('Ready? Let’s go.'),
  closingCta: Link.default({ label: 'Become a member', href: '/membership/join' }),
});
export type Spotlight = z.infer<typeof SpotlightSchema>;
