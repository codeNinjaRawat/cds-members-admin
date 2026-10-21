/**
 * MOCK of GET /public/site-config – used while ISGH_USE_MOCK_API=true (before the BE exists)
 * and as the safe fallback if the BE is down or returns invalid data.
 * When the BE is ready, admins edit all of this in the admin app; this file stays only as fallback/test data.
 */
import { DEFAULT_BRANDING, type SiteConfig } from './schema';

export const mockSiteConfig: SiteConfig = {
  version: 'mock-2026-10-13',
  branding: DEFAULT_BRANDING, // concept A "Star & Arch"; admin › Branding replaces these files
  org: {
    name: 'Islamic Society of Greater Houston',
    shortName: 'ISGH',
    productName: 'ISGH Members',
    address: ['3110 Eastside St', 'Houston, TX 77098'],
    phone: { display: '(713) 524-6615 ext. 105', tel: '+17135246615,105' },
    email: 'membership@isgh.org',
    taxNote: 'ISGH is a 501(c)(3) nonprofit organization in Texas.',
    founded: 1969,
  },
  flags: {
    'site.announcement': true,
    'cms.newsletter': true,
    'site.themeToggle': true,
    'i18n.languages': false,
  },
  announcement: {
    id: 'renew-2027',
    tone: 'info',
    text: 'Renew by June 30, 2027 to keep your vote in the 2027 ISGH elections.',
    link: { label: 'Renew now', href: '/membership/renew' },
    dismissible: true,
    startsAt: '2026-10-01T00:00:00-05:00',
    endsAt: '2027-06-30T23:59:59-05:00',
  },
  nav: [
    {
      label: 'Membership',
      children: [
        { label: 'Become a member', href: '/membership/join', description: 'Join in about five minutes.' },
        { label: 'Renew', href: '/membership/renew', description: 'Pay your 2027 dues and keep your vote.' },
        { label: 'Plans and dues', href: '/membership/plans', description: 'Single, family and life membership.' },
        { label: 'Check my status', href: '/portal', description: 'See your eligibility checklist.' },
      ],
    },
    {
      label: 'Islamic Centers',
      children: [
        { label: 'Find my center', href: '/centers/find', description: 'Your address decides your zone and center.' },
        { label: 'All masajid', href: '/masajid', description: 'Every masjid’s own pages: prayer times, Jumuah, events, giving.' },
        { label: 'What’s happening', href: '/activity', description: 'Events, announcements and campaigns across the network.' },
        { label: 'The five zones', href: '/centers/zones', description: 'How Greater Houston is organized.' },
        { label: 'Leadership', href: '/leadership', description: 'Who serves you – find your representatives by ZIP.' },
        { label: 'Prayer times', href: '/prayer-times', description: 'Adhan, iqamah and Jumu’ah at every center.' },
      ],
    },
    {
      label: 'Give',
      children: [
        { label: 'Give', href: '/give', description: 'Zakat, Sadaqah and why we give.' },
        { label: 'Campaigns', href: '/campaigns', description: 'Goals the community is raising for now.' },
        { label: 'Who still needs help', href: '/needs', description: 'Verified cases you can help today.' },
        { label: 'How we helped', href: '/impact', description: 'Real programs and stories, with sources.' },
      ],
    },
    { label: 'Elections', href: '/elections' },
    { label: 'News', href: '/news' },
    { label: 'About', href: '/about' },
  ],
  actions: {
    signIn: { label: 'Sign in', href: '/sign-in' },
    join: { label: 'Join ISGH', href: '/membership/join' },
  },
  footer: {
    columns: [
      { title: 'Membership', links: [
        { label: 'Become a member', href: '/membership/join' }, { label: 'Renew', href: '/membership/renew' },
        { label: 'Plans and dues', href: '/membership/plans' }, { label: 'Verify a membership', href: '/verify' },
        { label: 'Check my status', href: '/portal' } ] },
      { title: 'Community', links: [
        { label: 'All masajid', href: '/masajid' }, { label: 'Elections', href: '/elections' },
        { label: 'News', href: '/news' }, { label: 'Events', href: '/events' }, { label: 'Volunteer', href: '/volunteer' },
        { label: 'Give', href: '/give' }, { label: 'Who still needs help', href: '/needs' }, { label: 'How we helped', href: '/impact' } ] },
      { title: 'About ISGH', links: [
        { label: 'About us', href: '/about' }, { label: 'Constitution and Bylaws', href: '/constitution-bylaws' },
        { label: 'Annual reports', href: '/reports' }, { label: 'Leadership', href: '/leadership' }, { label: 'The five zones', href: '/centers/zones' } ] },
      { title: 'Help and feedback', links: [
        { label: 'FAQ', href: '/faq' }, { label: 'Contact us', href: '/contact' },
        { label: 'Rate your experience', href: '/feedback' }, { label: 'File a complaint', href: '/complaints' },
        { label: 'Report a website problem', href: '/feedback?topic=website' }, { label: 'Accessibility', href: '/accessibility' } ] },
    ],
    social: [
      { label: 'Facebook', href: 'https://www.facebook.com/' },
      { label: 'Instagram', href: 'https://www.instagram.com/isgh50' },
      { label: 'TikTok', href: 'https://www.tiktok.com/@htx.isgh50' },
    ],
    legal: [{ label: 'Privacy policy', href: '/privacy' }, { label: 'Terms of use', href: '/terms' }],
    tagline: 'Serving the Muslim community of Greater Houston since 1969 through 22 Islamic Centers, schools, clinics and programs.',
    hours: [{ days: [1, 2, 3, 4, 5], open: '09:00', close: '17:00' }],
    hoursLabel: 'Mon–Fri, 9:00 AM–5:00 PM CT',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=3110+Eastside+St+Houston+TX+77098',
    cta: {
      title: 'Your voice in ISGH starts with membership.',
      text: 'Join or renew before the June 30 deadline to vote in the next elections.',
      primary: { label: 'Become a member', href: '/membership/join' },
      secondary: { label: 'Renew', href: '/membership/renew' },
      deadline: '2027-06-30T23:59:59-05:00',
    },
    newsletter: {
      title: 'Get ISGH news by email',
      text: 'Election dates, renewal reminders and community updates. About two emails a month.',
      consent: 'I agree to receive emails from ISGH. I can unsubscribe at any time.',
    },
  },
  // Old isgh.org addresses still printed on flyers and shared in WhatsApp (see isgh-org/README.md §4) → the new site
  redirects: [
    { from: '/donate', to: '/give', permanent: true, note: 'isgh.org giving hub' }, { from: '/general-donation', to: '/give', permanent: true, note: '' },
    { from: '/join', to: '/membership/join', permanent: true, note: '' }, { from: '/member-login', to: '/sign-in', permanent: true, note: '' }, { from: '/members-evoting', to: '/verify', permanent: true, note: 'membership verification' },
    { from: '/prayer-schedule', to: '/prayer-times', permanent: true, note: '' }, { from: '/prayer-schedule-*', to: '/prayer-times', permanent: true, note: 'monthly pages' }, { from: '/week-schedule', to: '/khutbah', permanent: true, note: '' }, { from: '/schedule', to: '/khutbah', permanent: true, note: '' },
    { from: '/islamic-centers', to: '/masajid', permanent: true, note: '' }, { from: '/elected-officials', to: '/leadership', permanent: true, note: '' }, { from: '/staff', to: '/about', permanent: true, note: '' },
    { from: '/2026election', to: '/elections', permanent: false, note: 'current election' }, { from: '/nominations', to: '/elections', permanent: false, note: '' }, { from: '/elections*', to: '/elections', permanent: true, note: 'past election pages' },
    { from: '/annual-reports', to: '/documents', permanent: true, note: '' }, { from: '/annual-report-*', to: '/documents', permanent: true, note: '' }, { from: '/isgh-constitution-and-bylaws', to: '/constitution-bylaws', permanent: true, note: '' },
    { from: '/isgh-blog', to: '/news', permanent: true, note: '' }, { from: '/membership-updates', to: '/news', permanent: false, note: '' }, { from: '/assistance', to: '/services/financial-assistance', permanent: true, note: '' },
    { from: '/funerals', to: '/services/funerals', permanent: true, note: '' }, { from: '/marriage', to: '/services/nikah', permanent: true, note: '' }, { from: '/dawah', to: '/services/dawah', permanent: true, note: '' }, { from: '/networking', to: '/services/job-networking', permanent: true, note: '' }, { from: '/education', to: '/services/islamic-education', permanent: true, note: '' },
  ],
  theme: { active: 'editorial', allowUserModeToggle: true, defaultMode: 'light' }, // R6.5 website v2 look (admin can switch back to bayou / iznik / dusk) // previous design restored (2026-10-13); admin can set 'dark'
};
