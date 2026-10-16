/** Admin navigation (A1). `soon` = planned module, shown so staff see what is coming (not clickable). */
/** badge = demo count that needs attention (live: from BE counters) */
/** countKey = live count shown as a badge (e.g. open cases in a work queue) */
export type NavItem = { label: string; href: string; icon: IconName; keywords?: string; soon?: string; badge?: string; countKey?: string };
export type NavGroup = { label: string; items: NavItem[] };
export type IconName = 'calendar' | 'mail' | 'home' | 'palette' | 'layout' | 'menu' | 'megaphone' | 'pages' | 'news' | 'heart' | 'card' | 'building' | 'toggle' | 'brush' | 'users' | 'inbox' | 'chart' | 'shield' | 'plug' | 'tag' | 'moon' | 'ballot';

/** Sidebar tree: top items with submenus. Sub-links may open a tab (?tab=) inside a screen. */
export type NavNode = { section?: string; label: string; icon: IconName; href?: string; badge?: string; soon?: string; keywords?: string; countKey?: string; children?: NavItem[] };

export const NAV_TREE: NavNode[] = [
  { label: 'Overview', icon: 'home', href: '/', keywords: 'dashboard home kpi' },
  { section: 'People', label: 'Members', icon: 'users', children: [
    { label: 'Dashboard', href: '/members/overview', icon: 'chart', keywords: 'dashboard charts graphs statistics members trends plans zones ages payments renewals' },
    { label: 'All members', href: '/members', icon: 'users', keywords: 'people list search directory find member profile voting eligible not renewed expired lapsed pending approval board' },
    { label: 'Groups', href: '/groups', icon: 'users', keywords: 'groups committee center zone nominees volunteers rules automatic' },
    { label: 'Family trees', href: '/families', icon: 'users', keywords: 'family tree household relatives children parents spouse outreach' },
  ] },
  { label: 'Work queues', icon: 'inbox', countKey: 'q:all', children: [
    { label: 'Dashboard', href: '/queues/dashboard', icon: 'chart', keywords: 'dashboard queues waiting overdue sla backlog' },
    { label: 'Applications', href: '/queues?tab=applications', icon: 'inbox', countKey: 'q:applications', keywords: 'approve board new members review' },
    { label: 'Photo ID checks', href: '/queues?tab=id', icon: 'inbox', countKey: 'q:id', keywords: 'identity driver license passport verify' },
    { label: 'Center changes', href: '/queues?tab=center', icon: 'inbox', countKey: 'q:center', keywords: 'border 5 miles zone islamic center move' },
    { label: 'Possible duplicates', href: '/queues?tab=duplicates', icon: 'inbox', countKey: 'q:duplicates', keywords: 'merge same person double' },
    { label: 'Payments to fix', href: '/queues?tab=payments', icon: 'inbox', countKey: 'q:payments', keywords: 'declined card failed check bank returned' },
  ] },
  { label: 'Communication', icon: 'mail', children: [
    { label: 'Dashboard', href: '/communication/dashboard', icon: 'chart', keywords: 'dashboard messages sent opened delivery reach' },
    { label: 'Messages', href: '/communication?tab=send', icon: 'mail', keywords: 'send email text sms announcement newsletter blast bulk drafts scheduled sent compose' },
    { label: 'Automatic emails', href: '/communication?tab=system', icon: 'mail', keywords: 'system emails automatic welcome reminder receipt notifications renewal' },
    { label: 'Templates', href: '/communication?tab=templates', icon: 'mail', keywords: 'templates newsletter announcement merge fields macros' },
    { label: 'Delivery log', href: '/communication?tab=log', icon: 'mail', keywords: 'email log sent history delivered opened bounced' },
    { label: 'Settings', href: '/communication?tab=sending', icon: 'mail', keywords: 'from name reply footer sms text tracking quiet hours sender' },
  ] },
  { label: 'Membership rules', icon: 'card', children: [
    { label: 'Plans and dues', href: '/membership?tab=plans', icon: 'card', keywords: 'dues prices plans' },
    { label: 'Voting and area', href: '/membership?tab=voting', icon: 'card', keywords: 'voting record date june 30 age zone' },
    { label: 'Renewals and reminders', href: '/membership?tab=renewals', icon: 'card', keywords: 'renewal grace overdue lapse reminder invoice levels wildapricot december 15 bundle' },
    { label: 'Pledge and consents', href: '/membership?tab=join', icon: 'card', keywords: 'pledge consent commitments otp code' },
    { label: 'Join form builder', href: '/membership/form', icon: 'card', keywords: 'sign up form fields questions builder application onboarding steps' },
    { label: 'Membership switches', href: '/membership?tab=switches', icon: 'card', keywords: 'family life sms id upload' },
  ] },
  { section: 'Masjids', label: 'Masjids and zones', icon: 'building', children: [
    { label: 'Dashboard', href: '/masjids/dashboard', icon: 'chart', keywords: 'dashboard masjids seats vacant coverage zip' },
    { label: 'Masjid working bodies', href: '/masjids', icon: 'users', keywords: 'all masjids org chart associate director secretaries area representatives seats vacant working body' },
    { label: 'My masjid’s working body', href: '/team', icon: 'users', keywords: 'masjid team working body associate director secretary area representative assign role volunteers' },
    { label: 'Zones', href: '/zones?tab=zones', icon: 'building', keywords: 'zone director term area north northwest southwest south southeast' },
    { label: 'Islamic Centers', href: '/zones?tab=centers', icon: 'building', keywords: 'masjid mosque center address phone website jumuah khutbah services' },
    { label: 'ZIP codes and masjids', href: '/zones?tab=zips', icon: 'building', keywords: 'zip code routing zone lookup' },
  ] },
  { label: 'Prayer times', icon: 'moon', children: [
    { label: 'Today', href: '/prayer-times?tab=today', icon: 'calendar', keywords: 'prayer salah adhan iqamah today fajr dhuhr asr maghrib isha jumuah' },
    { label: 'Monthly timetable', href: '/prayer-times?tab=month', icon: 'calendar', keywords: 'prayer timetable month calendar print' },
    { label: 'Iqamah rules', href: '/prayer-times?tab=iqamah', icon: 'calendar', keywords: 'iqamah rules fixed minutes after adhan center' },
    { label: 'Calculation and Eid', href: '/prayer-times?tab=settings', icon: 'calendar', keywords: 'calculation method isna hanafi asr eid special prayer hijri' },
  ] },
  { label: 'Events', icon: 'calendar', children: [
    { label: 'Dashboard', href: '/events/dashboard', icon: 'chart', keywords: 'dashboard events upcoming registrations fill' },
    { label: 'All events', href: '/events', icon: 'calendar', keywords: 'events registration tickets waitlist guests reminders new event' },
    { label: 'Calendar', href: '/events/plan?tab=calendar', icon: 'calendar', keywords: 'calendar month clash jumuah eid conflict schedule' },
    { label: 'Approvals', href: '/events/plan?tab=approvals', icon: 'calendar', keywords: 'event approval masjid office send for approval lead time' },
    { label: 'Promotion', href: '/events/plan?tab=promotion', icon: 'megaphone', keywords: 'promote event feature email text social post' },
    { label: 'Analytics', href: '/events/plan?tab=analytics', icon: 'chart', keywords: 'event attendance no-show fill rate revenue turnout' },
  ] },
  { section: 'Money', label: 'Zakat and Sadaqah', icon: 'heart', children: [
    { label: 'Dashboard', href: '/zakat?tab=overview', icon: 'heart', keywords: 'zakat sadaqah assistance needy help cases dashboard' },
    { label: 'Applications', href: '/zakat?tab=cases', icon: 'heart', keywords: 'zakat applications cases applicants intake new' },
    { label: 'Approvals', href: '/zakat?tab=approvals', icon: 'heart', keywords: 'zakat approve level coordinator committee chair override' },
    { label: 'Payouts', href: '/zakat?tab=payouts', icon: 'heart', keywords: 'zakat disbursement payout pay check transfer cash' },
    { label: 'Reports', href: '/zakat?tab=reports', icon: 'heart', keywords: 'zakat reports sadaqah distribution turnaround zone' },
    { label: 'Settings', href: '/zakat/settings', icon: 'heart', keywords: 'zakat limits levels response time sadaqah routing home visit' },
  ] },
  { label: 'Donations', icon: 'card', children: [
    { label: 'Dashboard', href: '/donations?tab=overview', icon: 'card', keywords: 'donations gifts giving totals funds platforms' },
    { label: 'All gifts', href: '/donations?tab=gifts', icon: 'card', keywords: 'donations list gifts donors receipts refund' },
    { label: 'Reconciliation', href: '/donations?tab=recon', icon: 'card', keywords: 'reconcile unmatched pending payout deposit stripe paypal medina' },
    { label: 'Check-o-matic', href: '/donations?tab=checkomatic', icon: 'card', keywords: 'checkomatic check-o-matic donation membership qualify supporter' },
    { label: 'Funds and rules', href: '/donations/settings', icon: 'card', keywords: 'funds restricted zakat sadaqah building routing main center platforms receipts checkomatic rules' },
  ] },
  { label: 'Fundraising', icon: 'heart', children: [
    { label: 'Dashboard', href: '/fundraising?tab=insights', icon: 'heart', keywords: 'donors retention lybunt sybunt new recurring monthly top' },
    { label: 'Campaigns', href: '/fundraising?tab=campaigns', icon: 'heart', keywords: 'fundraising campaigns goal thermometer ramadan building matching' },
    { label: 'Personal pages', href: '/fundraising?tab=pages', icon: 'heart', keywords: 'peer to peer p2p personal fundraising page approve' },
    { label: 'Pledges', href: '/fundraising?tab=pledges', icon: 'heart', keywords: 'pledge promise due reminder' },
  ] },
  { label: 'Finance', icon: 'chart', children: [
    { label: 'Dashboard', href: '/finance?tab=overview', icon: 'chart', keywords: 'finance funds balances restricted cash ledger' },
    { label: 'Transactions', href: '/finance?tab=transactions', icon: 'chart', keywords: 'transactions expenses income payments checks transfers aid grants' },
    { label: 'Approvals', href: '/finance?tab=approvals', icon: 'chart', keywords: 'approve payment sign check two signatures' },
    { label: 'Budgets', href: '/finance?tab=budgets', icon: 'chart', keywords: 'budget actual variance center council' },
    { label: 'Statements and reports', href: '/finance?tab=reports', icon: 'chart', keywords: 'statement quarterly report audit fund activities csv' },
    { label: 'Finance rules', href: '/finance?tab=rules', icon: 'chart', keywords: 'approval limits accounts funds opening balances plan audit' },
  ] },
  { label: 'Member benefits', icon: 'tag', children: [
    { label: 'Dashboard', href: '/benefits?tab=overview', icon: 'tag', keywords: 'benefits perks discounts partners offers use' },
    { label: 'Offers', href: '/benefits?tab=offers', icon: 'tag', keywords: 'offers discounts codes plans valid until featured' },
    { label: 'Partners', href: '/benefits?tab=partners', icon: 'tag', keywords: 'partners businesses agreement review halal approve' },
    { label: 'Use log', href: '/benefits?tab=uses', icon: 'tag', keywords: 'redemptions used benefit log record' },
    { label: 'Benefit rules', href: '/benefits?tab=rules', icon: 'tag', keywords: 'benefits rules review locked offers members' },
  ] },
  { section: 'Governance', label: 'Elected officials', icon: 'users', children: [
    { label: 'Dashboard', href: '/officials?tab=overview', icon: 'users', keywords: 'officials leaders elected terms oath vacancies shura board' },
    { label: 'Board (Shura)', href: '/officials?tab=board', icon: 'users', keywords: 'shura board president vice president general secretary treasurer zonal director' },
    { label: 'Center leadership', href: '/officials?tab=centers', icon: 'users', keywords: 'associate director council area representatives secretaries administrative body' },
    { label: 'Vacancies', href: '/officials?tab=vacancies', icon: 'users', keywords: 'vacant empty seat appoint orientation' },
    { label: 'Officials rules', href: '/officials?tab=rules', icon: 'users', keywords: 'eid oath dates website leadership find representative zip' },
  ] },
  { label: 'Meetings and minutes', icon: 'pages', children: [
    { label: 'Dashboard', href: '/minutes/dashboard', icon: 'chart', keywords: 'dashboard meetings quorum minutes overdue' },
    { label: 'Meetings', href: '/minutes?tab=meetings', icon: 'pages', keywords: 'minutes meeting council board general assembly quorum decisions' },
    { label: 'Required meetings check', href: '/minutes?tab=calendar', icon: 'pages', keywords: 'monthly council meeting required bylaws notice quorum' },
  ] },
  { label: 'Elections', icon: 'ballot', children: [
    { label: 'Dashboard', href: '/elections', icon: 'chart', keywords: 'dashboard elections voters eligible countdown' },
    { label: 'Voter list', href: '/reports?tab=voters', icon: 'chart', keywords: 'election eligible voters snapshot record date freeze' },
    { label: 'Candidates', href: '/reports?tab=candidates', icon: 'chart', keywords: 'candidates nominees eligibility election ballot' },
    { label: 'Area Representatives', href: '/reports?tab=area-reps', icon: 'chart', keywords: 'area representatives seats per center zip election' },
    { label: 'Nominations, ballots and results', href: '#', icon: 'chart', soon: 'Next' },
  ] },
  { section: 'Website', label: 'Website', icon: 'layout', children: [
    { label: 'Dashboard', href: '/website', icon: 'chart', keywords: 'dashboard website pages published drafts' },
    { label: 'Theme and branding', href: '/website/theme', icon: 'palette', keywords: 'colors logo favicon dark mode fonts' },
    { label: 'Home page', href: '/website/home', icon: 'layout', keywords: 'hero layout sections stats heart line hadith' },
    { label: 'Menus and footer', href: '/website/menus', icon: 'menu', keywords: 'navigation header footer links social newsletter hours' },
    { label: 'Announcement bar', href: '/website/announcement', icon: 'megaphone', keywords: 'banner top bar notice' },
    { label: 'Pages', href: '/website/pages', icon: 'pages', keywords: 'about faq elections contact privacy terms blocks' },
    { label: 'News', href: '/website/news', icon: 'news', keywords: 'posts blog updates' },
  ] },
  { label: 'Giving page', icon: 'heart', badge: '4', children: [
    { label: 'Verses and hadith', href: '/website/giving?tab=verses', icon: 'heart', keywords: 'quran verses hadith' },
    { label: 'How we helped', href: '/website/giving?tab=impact', icon: 'heart', keywords: 'impact stories programs' },
    { label: 'Who still needs help', href: '/website/giving?tab=needs', icon: 'heart', keywords: 'needs cases zakat', badge: '4' },
    { label: 'Giving page and switches', href: '/website/giving?tab=settings', icon: 'heart', keywords: 'donate zakat link samples' },
  ] },
  { section: 'Admin', label: 'Reports', icon: 'chart', href: '/reports', keywords: 'report dues renewal rate zone area representatives candidates events export csv' },
  { label: 'Settings', icon: 'building', children: [
    { label: 'Organization', href: '/settings/organization', icon: 'building', keywords: 'address phone email name tax' },
    { label: 'Configuration', href: '/settings/configuration', icon: 'toggle', keywords: 'directory member card profile fields payments check ach discount codes security two-step start page' },
    { label: 'Feature switches', href: '/settings/flags', icon: 'toggle', keywords: 'flags on off enable disable' },
    { label: 'Admins and roles', href: '/settings/admins', icon: 'shield', keywords: 'admin users roles permissions invite zone director election commission treasurer two-step' },
    { label: 'Sign-in and dashboards', href: '/settings/sign-in', icon: 'shield', keywords: 'login sign in methods google email code text password dashboard chooser switch portal masjid zone organization member' },
    { label: 'Integrations', href: '/settings/integrations', icon: 'plug', keywords: 'email sms text stripe google provider keys webhook test send 10dlc dkim dmarc' },
    { label: 'Audit log', href: '/settings/audit', icon: 'shield', keywords: 'who changed history log export security' },
    { label: 'My appearance', href: '/appearance', icon: 'brush', keywords: 'admin theme glass dark wallpaper accent luxe' },
  ] },
  { label: 'Coming next', icon: 'plug', soon: '', children: [
    { label: 'Center records library', href: '#', icon: 'pages', soon: 'Later' },
  ] },
];

/**
 * Organization-wide rule pages. Masjid and zone roles may open them (read-only) but they are left out of their menu,
 * so a masjid's menu shows the masjid's work, not the organization's settings.
 */
export const ORG_ONLY = new Set(['/zakat/settings', '/donations/settings', '/finance?tab=rules', '/prayer-times?tab=settings', '/officials?tab=rules', '/benefits?tab=rules', '/zones?tab=zones', '/communication?tab=sending', '/fundraising?tab=insights']);

/** Flat list (command palette, older code). */
export const NAV: NavGroup[] = NAV_TREE.map((n) => ({ label: n.label, items: n.children ?? [{ label: n.label, href: n.href ?? '/', icon: n.icon, keywords: n.keywords, badge: n.badge }] }));

const P: Record<IconName, string> = {
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5zM17 3v3M15.5 4.5h3',
  ballot: 'M4 12h16v8H4zM8 12V5h8v7M10.5 8.5l1.2 1.2 2.3-2.4M8 16h8',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  calendar: 'M8 3v4M16 3v4M3 9h18M5 5h14v16H5zM8 13h3v3H8z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.2-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10zM7.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  layout: 'M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z',
  menu: 'M4 6h16M4 12h16M4 18h10',
  megaphone: 'M4 10v4h3l7 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  pages: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  building: 'M4 21V7l8-4 8 4v14M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01',
  toggle: 'M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7zm10 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  brush: 'M14 4l6 6-8 8H6v-6zM4 20h4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
};
export const iconPath = (n: IconName) => P[n];
