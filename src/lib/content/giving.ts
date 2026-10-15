/**
 * CONTRACT – GET /public/giving   (admin: CMS › Giving — Verses, Impact stories, Needs)
 *
 * Everything here is admin content:
 *   verses  → CMS › Giving › Verses      (Arabic + English + reference; translation name required; reviewed by an imam before publishing)
 *   hadith  → CMS › Giving › Hadith      (text + collection + number)
 *   impact  → CMS › Giving › How we helped (programs, events, personal stories; consent + source required)
 *   needs   → CMS › Giving › Who still needs help (cases with goal / raised / status; privacy level required)
 *
 * Rules the BE enforces (admin cannot publish without them):
 *   - A personal story needs consent ('written') or must be 'anonymized' (no names, faces or exact places).
 *   - A public program/event needs a source (link to a news story, report or ISGH page).
 *   - `sample: true` items are DEMO placeholders; the site labels them "Sample" so nothing invented looks real.
 *   - Stock photos of people are marked `stockPhoto` so the site can say "Photo is illustrative".
 *
 * Quran text: Arabic (Uthmani) and English from Quran.com API v4, translation "Saheeh International" (resource 20),
 * checked word-for-word on 2026-10-13. Translator brackets are kept as published.
 */
import { z } from 'zod';
import { ImageRefSchema, pexels, type ImageRef } from './home';

export const VerseSchema = z.object({
  id: z.string(),
  ref: z.string().regex(/^\d{1,3}:\d{1,3}(-\d{1,3})?$/), // surah:ayah
  surah: z.string(),
  arabic: z.string(),
  english: z.string(),
  translation: z.string(),     // e.g. "Saheeh International"
  short: z.string().optional(), // admin-chosen short excerpt for small spaces (must be a verbatim slice of `english`)
});
export const HadithSchema = z.object({ id: z.string(), text: z.string(), source: z.string(), grade: z.string().optional() });

const SourceSchema = z.object({ label: z.string(), url: z.string().url() });
const MetricSchema = z.object({ value: z.string(), label: z.string() });

export const ImpactSchema = z.object({
  id: z.string(),
  kind: z.enum(['program', 'event', 'story']),
  title: z.string().max(90),
  when: z.string().optional(),          // "August 2017", "2024", "Ongoing"
  zone: z.string().optional(),
  summary: z.string().max(260),
  body: z.array(z.string()).max(8),
  metrics: z.array(MetricSchema).max(3),
  image: ImageRefSchema,
  stockPhoto: z.boolean().default(true),
  source: SourceSchema.optional(),
  consent: z.enum(['public-record', 'written', 'anonymized']),
  sample: z.boolean().default(false),
  featured: z.boolean().default(false),
});

export const NEED_CATEGORIES = ['zakat', 'family', 'health', 'education', 'relief', 'masjid', 'funeral'] as const;
export const NeedSchema = z.object({
  id: z.string(),
  title: z.string().max(90),
  category: z.enum(NEED_CATEGORIES),
  zone: z.string().optional(),
  summary: z.string().max(220),
  story: z.array(z.string()).max(6),
  image: ImageRefSchema,
  stockPhoto: z.boolean().default(true),
  status: z.enum(['urgent', 'open', 'ongoing', 'met']),
  goalCents: z.number().int().positive().optional(),   // none for ongoing programs
  raisedCents: z.number().int().min(0).optional(),
  donors: z.number().int().min(0).optional(),
  zakatEligible: z.boolean(),
  privacy: z.enum(['anonymized', 'public']),
  verifiedBy: z.string().optional(),                    // e.g. "ISGH Financial Assistance Office"
  source: SourceSchema.optional(),
  sample: z.boolean().default(false),
  updatedAt: z.string(),                                 // YYYY-MM-DD
});

export const GivingSchema = z.object({
  title: z.string(), intro: z.string(),
  verses: z.array(VerseSchema).min(1).max(12),
  hadith: z.array(HadithSchema).max(6),
  reasons: z.array(z.object({ title: z.string(), text: z.string() })).max(6),
  /** Headline numbers on /impact (admin keeps them current; each should match a sourced impact item) */
  totals: z.array(MetricSchema).max(4),
  impact: z.array(ImpactSchema).max(30),
  needs: z.array(NeedSchema).max(30),
  giveUrl: z.string(),     // external donation page until Stripe giving is built
  zakatUrl: z.string(),
  flags: z.object({ showSamples: z.boolean(), showProgress: z.boolean(), rotateVerses: z.boolean() }),
});
export type Verse = z.infer<typeof VerseSchema>;
export type Impact = z.infer<typeof ImpactSchema>;
export type Need = z.infer<typeof NeedSchema>;
export type Giving = z.infer<typeof GivingSchema>;

const img = (id: number, alt: string, slug: string, focal?: string): ImageRef =>
  ({ src: pexels(id, 1400), alt, credit: 'Pexels', creditUrl: `https://www.pexels.com/photo/${slug}-${id}/`, focal });

/* ---------------- verified verses (Quran.com API v4, Saheeh International) ---------------- */
export const VERSES: Verse[] = [
  { id: 'v-2-261', ref: '2:261', surah: 'Al-Baqarah', translation: 'Saheeh International',
    arabic: 'مَّثَلُ ٱلَّذِينَ يُنفِقُونَ أَمْوَٰلَهُمْ فِى سَبِيلِ ٱللَّهِ كَمَثَلِ حَبَّةٍ أَنۢبَتَتْ سَبْعَ سَنَابِلَ فِى كُلِّ سُنۢبُلَةٍ مِّا۟ئَةُ حَبَّةٍ ۗ وَٱللَّهُ يُضَـٰعِفُ لِمَن يَشَآءُ ۗ وَٱللَّهُ وَٰسِعٌ عَلِيمٌ',
    english: 'The example of those who spend their wealth in the way of Allāh is like a seed [of grain] which grows seven spikes; in each spike is a hundred grains. And Allāh multiplies [His reward] for whom He wills. And Allāh is all-Encompassing and Knowing.',
    short: 'Like a seed [of grain] which grows seven spikes; in each spike is a hundred grains.' },
  { id: 'v-3-92', ref: '3:92', surah: 'Āl ʿImrān', translation: 'Saheeh International',
    arabic: 'لَن تَنَالُوا۟ ٱلْبِرَّ حَتَّىٰ تُنفِقُوا۟ مِمَّا تُحِبُّونَ ۚ وَمَا تُنفِقُوا۟ مِن شَىْءٍ فَإِنَّ ٱللَّهَ بِهِۦ عَلِيمٌ',
    english: 'Never will you attain the good [reward] until you spend [in the way of Allāh] from that which you love. And whatever you spend - indeed, Allāh is Knowing of it.',
    short: 'Never will you attain the good [reward] until you spend [in the way of Allāh] from that which you love.' },
  { id: 'v-34-39', ref: '34:39', surah: 'Saba', translation: 'Saheeh International',
    arabic: 'قُلْ إِنَّ رَبِّى يَبْسُطُ ٱلرِّزْقَ لِمَن يَشَآءُ مِنْ عِبَادِهِۦ وَيَقْدِرُ لَهُۥ ۚ وَمَآ أَنفَقْتُم مِّن شَىْءٍ فَهُوَ يُخْلِفُهُۥ ۖ وَهُوَ خَيْرُ ٱلرَّٰزِقِينَ',
    english: 'Say, "Indeed, my Lord extends provision for whom He wills of His servants and restricts [it] for him. But whatever thing you spend [in His cause] - He will compensate it; and He is the best of providers."',
    short: 'Whatever thing you spend [in His cause] - He will compensate it; and He is the best of providers.' },
  { id: 'v-2-274', ref: '2:274', surah: 'Al-Baqarah', translation: 'Saheeh International',
    arabic: 'ٱلَّذِينَ يُنفِقُونَ أَمْوَٰلَهُم بِٱلَّيْلِ وَٱلنَّهَارِ سِرًّا وَعَلَانِيَةً فَلَهُمْ أَجْرُهُمْ عِندَ رَبِّهِمْ وَلَا خَوْفٌ عَلَيْهِمْ وَلَا هُمْ يَحْزَنُونَ',
    english: "Those who spend their wealth [in Allāh's way] by night and by day, secretly and publicly - they will have their reward with their Lord. And no fear will there be concerning them, nor will they grieve.",
    short: 'They will have their reward with their Lord. And no fear will there be concerning them, nor will they grieve.' },
  { id: 'v-76-8', ref: '76:8-9', surah: 'Al-Insān', translation: 'Saheeh International',
    arabic: 'وَيُطْعِمُونَ ٱلطَّعَامَ عَلَىٰ حُبِّهِۦ مِسْكِينًا وَيَتِيمًا وَأَسِيرًا ۝ إِنَّمَا نُطْعِمُكُمْ لِوَجْهِ ٱللَّهِ لَا نُرِيدُ مِنكُمْ جَزَآءً وَلَا شُكُورًا',
    english: 'And they give food in spite of love for it to the needy, the orphan, and the captive, [Saying], "We feed you only for the face [i.e., approval] of Allāh. We wish not from you reward or gratitude.',
    short: 'We feed you only for the face [i.e., approval] of Allāh. We wish not from you reward or gratitude.' },
  { id: 'v-5-2', ref: '5:2', surah: "Al-Mā'idah", translation: 'Saheeh International',
    arabic: 'وَتَعَاوَنُوا۟ عَلَى ٱلْبِرِّ وَٱلتَّقْوَىٰ ۖ وَلَا تَعَاوَنُوا۟ عَلَى ٱلْإِثْمِ وَٱلْعُدْوَٰنِ',
    english: 'And cooperate in righteousness and piety, but do not cooperate in sin and aggression.',
    short: 'And cooperate in righteousness and piety.' },
  { id: 'v-57-18', ref: '57:18', surah: 'Al-Ḥadīd', translation: 'Saheeh International',
    arabic: 'إِنَّ ٱلْمُصَّدِّقِينَ وَٱلْمُصَّدِّقَـٰتِ وَأَقْرَضُوا۟ ٱللَّهَ قَرْضًا حَسَنًا يُضَـٰعَفُ لَهُمْ وَلَهُمْ أَجْرٌ كَرِيمٌ',
    english: 'Indeed, the men who practice charity and the women who practice charity and [they who] have loaned Allāh a goodly loan - it will be multiplied for them, and they will have a noble reward.',
    short: 'It will be multiplied for them, and they will have a noble reward.' },
  { id: 'v-9-60', ref: '9:60', surah: 'At-Tawbah', translation: 'Saheeh International',
    arabic: 'إِنَّمَا ٱلصَّدَقَـٰتُ لِلْفُقَرَآءِ وَٱلْمَسَـٰكِينِ وَٱلْعَـٰمِلِينَ عَلَيْهَا وَٱلْمُؤَلَّفَةِ قُلُوبُهُمْ وَفِى ٱلرِّقَابِ وَٱلْغَـٰرِمِينَ وَفِى سَبِيلِ ٱللَّهِ وَٱبْنِ ٱلسَّبِيلِ ۖ فَرِيضَةً مِّنَ ٱللَّهِ ۗ وَٱللَّهُ عَلِيمٌ حَكِيمٌ',
    english: 'Zakāh expenditures are only for the poor and for the needy and for those employed for it and for bringing hearts together [for Islām] and for freeing captives [or slaves] and for those in debt and for the cause of Allāh and for the [stranded] traveler - an obligation [imposed] by Allāh. And Allāh is Knowing and Wise.' },
];
/** Note on 5:2 – only the second half of the verse is shown (the giving-related part); the reference marks the full verse. */

export const mockGiving: Giving = GivingSchema.parse({
  title: 'Give, and watch it grow',
  intro: 'Every dollar given through ISGH stays in Greater Houston: food and rent for families, free care at Shifa clinics, open masajid and dignified burials.',
  verses: VERSES,
  hadith: [
    { id: 'h-muslim-2588', text: 'Charity does not decrease wealth.', source: 'Sahih Muslim 2588', grade: 'Sahih' },
  ],
  reasons: [
    { title: 'Your dues keep the doors open', text: 'Membership dues help run 22 Islamic Centers – prayers, schools, youth nights and Ramadan programs.' },
    { title: 'Your vote shapes the work', text: 'Members elect the Board and zone leaders who decide where community funds go.' },
    { title: 'Zakat that stays local', text: 'Zakat given to ISGH is distributed to eligible families in Greater Houston, interviewed and verified by staff.' },
    { title: 'You see the difference', text: 'We publish what your giving did – programs, numbers and stories shared with permission.' },
  ],
  totals: [
    { value: '$4.9M+', label: 'Zakat and Sadaqah distributed in 2024' }, { value: '890+', label: 'families supported every month' },
    { value: '4', label: 'free Shifa clinics' }, { value: '58 acres', label: 'Muslim cemetery in Waller, TX' },
  ],
  impact: [
    { id: 'harvey-2017', kind: 'event', title: 'When Harvey flooded Houston, our masajid opened their doors', when: 'August 2017', featured: true,
      summary: 'About a dozen ISGH-area mosques took in hundreds of people with shelter, food and supplies – open to anyone, Muslim or not.',
      body: [
        'ISGH started organizing before the storm reached Texas, using its social media and center networks to collect supplies and find volunteers and homes.',
        'As water rose across the city, masajid became shelters. ISGH president M.J. Khan said the doors were open to everyone who needed them.',
      ],
      metrics: [{ value: '~12', label: 'masajid opened as shelters' }, { value: 'Hundreds', label: 'people given refuge' }],
      image: img(14216445, 'A flooded street with palm trees under a cloudy sky', 'puddle-of-water-on-the-road'),
      stockPhoto: true, consent: 'public-record', sample: false,
      source: { label: 'The World (PRI), Aug 29, 2017', url: 'https://theworld.org/stories/2017/08/29/after-harvey-hundreds-find-refuge-houston-area-mosques' } },
    { id: 'zakat-2024', kind: 'program', title: '$4.9 million in Zakat and Sadaqah, given locally', when: '2024', featured: true,
      summary: 'ISGH Financial Assistance supports more than 890 families every month with food, rent, utilities, education and transportation.',
      body: [
        'Families apply through the Financial Assistance Office and are interviewed by staff before support is approved.',
        'Help covers the basics that keep a household stable: groceries, rent, utility bills, critical education costs and transportation.',
      ],
      metrics: [{ value: '$4.9M+', label: 'Zakat and Sadaqah distributed in 2024' }, { value: '890+', label: 'families supported each month' }],
      image: img(7345444, 'Two people passing a donation box of groceries hand to hand', 'a-person-holding-an-egg-tray'),
      stockPhoto: true, consent: 'public-record', sample: false,
      source: { label: 'ISGH Financial Assistance', url: 'https://isgh.org/?p=69276' } },
    { id: 'shifa-clinics', kind: 'program', title: 'Free care at four Shifa clinics', when: 'Ongoing',
      summary: 'ISGH-affiliated Shifa clinics offer free medical care to anyone who needs it – from eye and dental care to wellness exams and immunizations.',
      body: ['Four clinics across Greater Houston serve uninsured and underinsured neighbors without charging for care.'],
      metrics: [{ value: '4', label: 'clinics in Greater Houston' }, { value: '$0', label: 'cost to patients' }],
      image: img(8413334, 'A dentist examining an older patient in a bright clinic', 'female-dentist-doing-an-examination-on-her-elderly-patient'),
      stockPhoto: true, consent: 'public-record', sample: false,
      source: { label: 'ISGH Clinics', url: 'https://isgh.org/clinics' } },
    { id: 'attaqwa-families', kind: 'event', title: 'Gift cards for Zakat-eligible families in Sugar Land', zone: 'Southwest',
      summary: 'With Islamic Relief USA and Giving Games Foundation, ISGH hosted distributions at Masjid Attaqwa for families who qualify for Zakat.',
      body: ['The first distribution helped 58 families, with about 250 more families expected at the next one.'],
      metrics: [{ value: '58', label: 'families at the first distribution' }, { value: '~250', label: 'more families expected' }],
      image: img(7156155, 'A donation box filled with food and household supplies', 'close-up-photo-of-food-donations'),
      stockPhoto: true, consent: 'public-record', sample: false,
      source: { label: 'Islamic Relief USA', url: 'https://irusa.org/islamic-relief-usa-to-support-zakat-eligible-families-in-the-greater-houston-area/' } },
    { id: 'waller-cemetery', kind: 'program', title: "Houston's first exclusively Muslim cemetery", when: 'Since December 2020',
      summary: 'ISGH owns and cares for a 58-acre cemetery in Waller, Texas, so families can bury loved ones with dignity and according to the Sunnah.',
      body: ['Phase 1 has more than 600 graves. Volunteers and donors have planted more than 200 trees and added walkways, landscaping and a sprinkler system.'],
      metrics: [{ value: '58', label: 'acres in Waller, TX' }, { value: '600+', label: 'graves in Phase 1' }, { value: '200+', label: 'trees planted' }],
      image: img(22669871, 'Quiet, tree-lined rows of gravestones', 'gravestone-at-muslim-cemetery'),
      stockPhoto: true, consent: 'public-record', sample: false,
      source: { label: 'ISGH Funeral and Cemetery', url: 'https://isgh.org/funeral' } },
    // ---- personal stories: SAMPLE placeholders until admins publish consented stories ----
    { id: 's-lights-on', kind: 'story', title: 'A mother of three kept the lights on', zone: 'Southwest', when: 'Sample',
      summary: 'After her hours were cut, a utility shut-off notice arrived. Zakat paid the overdue bill and two months of rent while she found full-time work.',
      body: ['She asked us not to share her name. Today she volunteers at the same center that helped her.'],
      metrics: [{ value: '2', label: 'months of rent covered' }],
      image: img(9127754, 'A father and son sharing a home-cooked meal', 'father-and-child-sitting-at-the-table'),
      stockPhoto: true, consent: 'anonymized', sample: true },
    { id: 's-first-job', kind: 'story', title: 'A new arrival found his first job in Houston', zone: 'North', when: 'Sample',
      summary: 'Job Networking matched a recently arrived engineer with a mentor and two interviews. Six weeks later he started work.',
      body: ['Details changed to protect privacy.'],
      metrics: [{ value: '6', label: 'weeks from first call to job' }],
      image: img(6568953, 'Two smiling volunteers with name tags at a community event', 'man-and-woman-wearing-beige-sweater'),
      stockPhoto: true, consent: 'anonymized', sample: true },
  ],
  needs: [
    { id: 'n-zakat-monthly', title: 'Monthly Zakat fund for local families', category: 'zakat', status: 'ongoing', zakatEligible: true, privacy: 'public',
      summary: 'More than 890 Houston families rely on this fund every month for food, rent and utilities.',
      story: ['The need does not pause between Ramadans. Regular monthly giving lets the Financial Assistance Office plan ahead instead of turning families away.'],
      image: img(7156158, 'A volunteer packing canned goods into a donation box', 'a-person-packing-donations'),
      verifiedBy: 'ISGH Financial Assistance Office', sample: false, updatedAt: '2026-10-13',
      source: { label: 'ISGH Financial Assistance', url: 'https://isgh.org/?p=69276' } },
    { id: 'n-rent-sw', title: 'Two months of rent for a single mother', category: 'family', zone: 'Southwest', status: 'urgent', zakatEligible: true, privacy: 'anonymized',
      summary: 'A mother of two faces eviction after a hospital stay. Rent for November and December keeps the children in their school.',
      story: ['Verified by the Financial Assistance Office. Name and address are kept private.'],
      image: img(29094497, 'A hand holding a house-shaped keychain with keys', 'hand-holding-house-keychain-in-sunlight'),
      goalCents: 240000, raisedCents: 156000, donors: 31, verifiedBy: 'ISGH Financial Assistance Office', sample: true, updatedAt: '2026-10-11' },
    { id: 'n-senior-care', title: 'Eye surgery follow-up for a senior', category: 'health', zone: 'North', status: 'open', zakatEligible: true, privacy: 'anonymized',
      summary: 'A 71-year-old uncle needs follow-up care and glasses after cataract surgery that Shifa doctors arranged.',
      story: ['Medical details are shared only with the care team.'],
      image: img(4226865, 'A pair of round eyeglasses on a white table', 'stylish-round-eyeglasses-with-optical-lenses'),
      goalCents: 380000, raisedCents: 90000, donors: 12, verifiedBy: 'Shifa clinic social worker', sample: true, updatedAt: '2026-10-09' },
    { id: 'n-students', title: 'School supplies and tuition help for 40 students', category: 'education', zone: 'Southeast', status: 'open', zakatEligible: false, privacy: 'public',
      summary: 'Backpacks, books and partial weekend-school tuition for children whose families are on Zakat support.',
      story: ['Every child starts the semester with what they need.'],
      image: img(5124906, 'School supplies laid out in the shape of a backpack', 'school-supplies-neatly-laid-on-a-cutout-in-a-shape-of-a-backpack'),
      goalCents: 600000, raisedCents: 445000, donors: 88, sample: true, updatedAt: '2026-10-07' },
    { id: 'n-cemetery', title: 'Care and development of the Waller cemetery', category: 'funeral', status: 'ongoing', zakatEligible: false, privacy: 'public',
      summary: 'Donations maintain the grounds and develop new sections so every Muslim family in Houston has a place to rest their loved ones.',
      story: ['Walkways, trees, landscaping and irrigation are funded by the community.'],
      image: img(22669871, 'Quiet, tree-lined rows of gravestones', 'gravestone-at-muslim-cemetery'),
      sample: false, updatedAt: '2026-10-13',
      source: { label: 'ISGH Funeral and Cemetery', url: 'https://isgh.org/funeral' } },
    { id: 'n-winter', title: 'Winter blankets and heaters for seniors', category: 'relief', status: 'met', zakatEligible: false, privacy: 'public',
      summary: 'Blankets and space heaters delivered before the first freeze. Fully funded – thank you.',
      story: ['Volunteers from all five zones delivered the kits.'],
      image: img(6994938, 'A volunteer holding a pile of folded blankets', 'volunteer-standing-and-holding-a-pile-of-blankets'),
      goalCents: 500000, raisedCents: 500000, donors: 140, sample: true, updatedAt: '2026-10-02' },
  ],
  giveUrl: 'https://isgh.org',
  zakatUrl: 'https://isgh.org/zakat',
  flags: { showSamples: true, showProgress: true, rotateVerses: true },
} satisfies z.input<typeof GivingSchema>); // parse applies defaults (stockPhoto, featured…)

/** Verse band image (seed parable, 2:261) */
export const VERSE_IMAGE: ImageRef = img(6038165, 'A ripe field of grain glowing at dusk', 'ripe-barley-field-at-dusk', '50% 60%');

export const percent = (n: Need) => (n.goalCents && n.raisedCents !== undefined ? Math.min(100, Math.round((n.raisedCents / n.goalCents) * 100)) : null);
export const NEED_LABEL: Record<Need['category'], string> = {
  zakat: 'Zakat fund', family: 'Family support', health: 'Health care', education: 'Education', relief: 'Relief', masjid: 'Masjid', funeral: 'Funeral and cemetery',
};
export const STATUS_LABEL: Record<Need['status'], string> = { urgent: 'Urgent', open: 'Open', ongoing: 'Ongoing', met: 'Fully funded' };
/** Public lists respect the admin flag that hides demo samples. */
export const visible = <T extends { sample?: boolean }>(items: T[], g: Pick<Giving, 'flags'>) => items.filter((i) => g.flags.showSamples || !i.sample);
