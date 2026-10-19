/** Admin navigation (A1). `soon` = planned module, shown so staff see what is coming (not clickable). */
/** badge = demo count that needs attention (live: from BE counters) */
/** countKey = live count shown as a badge (e.g. open cases in a work queue) */
export type NavItem = { label: string; href: string; icon: IconName; keywords?: string; soon?: string; badge?: string; countKey?: string };
export type NavGroup = { label: string; items: NavItem[] };
export type IconName = 'members' | 'zakat' | 'donations' | 'ticketing' | 'masjid-crm' | 'home' | 'dashboard' | 'users' | 'groups' | 'family' | 'inbox' | 'ticket' | 'mail' | 'megaphone' | 'card' | 'rules' | 'form' | 'masjid' | 'building' | 'zones' | 'zip' | 'moon' | 'calendar' | 'heart' | 'gift' | 'hand-heart' | 'ledger' | 'target' | 'benefits' | 'ballot' | 'officials' | 'minutes' | 'records' | 'chart' | 'reports' | 'globe' | 'pages' | 'news' | 'menu' | 'layout' | 'palette' | 'brush' | 'settings' | 'shield' | 'audit' | 'key' | 'plug' | 'toggle' | 'tag' | 'sparkle' | 'moon-star' | 'id-card' | 'queue' | 'check';

/** Sidebar tree: top items with submenus. Sub-links may open a tab (?tab=) inside a screen. */
/** `home`: D2 – clicking the group itself opens this page (Members → its Overview) as well as the list of pages. */
export type NavNode = { section?: string; label: string; icon: IconName; href?: string; home?: string; badge?: string; soon?: string; keywords?: string; countKey?: string; children?: NavItem[] };

export const NAV_TREE: NavNode[] = [
  { label: 'Overview', icon: 'home', href: '/', keywords: 'dashboard home kpi' },
  { section: 'People', label: 'Members', icon: 'users', home: '/members/overview', children: [
    { label: 'Overview', href: '/members/overview', icon: 'dashboard', keywords: 'overview dashboard charts graphs statistics members trends plans zones ages payments renewals' },
    { label: 'All members', href: '/members', icon: 'users', keywords: 'people list search directory find member profile voting eligible not renewed expired lapsed pending approval board' },
    { label: 'Check-o-matic', href: '/members/checkomatic', icon: 'card', keywords: 'checkomatic monthly givers recurring contributions reconcile eligible not a member qualify' },
    { label: 'Groups', href: '/groups', icon: 'groups', keywords: 'groups committee center zone nominees volunteers rules automatic' },
    { label: 'Family trees', href: '/families', icon: 'family', keywords: 'family tree household relatives children parents spouse outreach' },
  ] },
  { label: 'Work queues', icon: 'inbox', countKey: 'q:all', children: [
    { label: 'Dashboard', href: '/queues/dashboard', icon: 'dashboard', keywords: 'dashboard queues waiting overdue sla backlog' },
    { label: 'Applications', href: '/queues?tab=applications', icon: 'inbox', countKey: 'q:applications', keywords: 'approve board new members review' },
    { label: 'Photo ID checks', href: '/queues?tab=id', icon: 'id-card', countKey: 'q:id', keywords: 'identity driver license passport verify' },
    { label: 'Center changes', href: '/queues?tab=center', icon: 'inbox', countKey: 'q:center', keywords: 'border 5 miles zone islamic center move' },
    { label: 'Possible duplicates', href: '/queues?tab=duplicates', icon: 'inbox', countKey: 'q:duplicates', keywords: 'merge same person double' },
    { label: 'Payments to fix', href: '/queues?tab=payments', icon: 'inbox', countKey: 'q:payments', keywords: 'declined card failed check bank returned' },
    { label: 'Incomplete applications', href: '/queues?tab=incomplete', icon: 'form', countKey: 'q:incomplete', keywords: 'incomplete abandoned stopped half way follow up join form reminder' },
    { label: 'Missing information', href: '/queues?tab=missing', icon: 'id-card', countKey: 'q:missing', keywords: 'missing phone address date of birth id follow up chase' },
    { label: 'Tasks and tickets', href: '/queues/tickets', icon: 'ticket', countKey: 'q:tickets', keywords: 'tasks tickets complaints feedback requests assign owner due' },
    { label: 'Team messages', href: '/inbox', icon: 'mail', countKey: 'q:inbox', keywords: 'team messages chat internal communication colleague channel direct message screenshot mention' },
  ] },
  { label: 'Communication', icon: 'megaphone', children: [
    { label: 'Dashboard', href: '/communication/dashboard', icon: 'dashboard', keywords: 'dashboard messages sent opened delivery reach' },
    { label: 'Messages', href: '/communication?tab=send', icon: 'mail', keywords: 'send email text sms announcement newsletter blast bulk drafts scheduled sent compose' },
    { label: 'Automatic emails', href: '/communication?tab=system', icon: 'mail', keywords: 'system emails automatic welcome reminder receipt notifications renewal' },
    { label: 'Templates', href: '/communication?tab=templates', icon: 'mail', keywords: 'templates newsletter announcement merge fields macros' },
    { label: 'Delivery log', href: '/communication?tab=log', icon: 'mail', keywords: 'email log sent history delivered opened bounced' },
    { label: 'Settings', href: '/communication?tab=sending', icon: 'mail', keywords: 'from name reply footer sms text tracking quiet hours sender' },
  ] },
  { label: 'Membership rules', icon: 'rules', children: [
    { label: 'Plans and dues', href: '/membership?tab=plans', icon: 'card', keywords: 'dues prices plans' },
    { label: 'Voting and area', href: '/membership?tab=voting', icon: 'card', keywords: 'voting record date june 30 age zone' },
    { label: 'Renewals and reminders', href: '/membership?tab=renewals', icon: 'card', keywords: 'renewal grace overdue lapse reminder invoice levels wildapricot december 15 bundle' },
    { label: 'Pledge and consents', href: '/membership?tab=join', icon: 'card', keywords: 'pledge consent commitments otp code' },
    { label: 'Join form builder', href: '/membership/form', icon: 'form', keywords: 'sign up form fields questions builder application onboarding steps' },
    { label: 'Membership switches', href: '/membership?tab=switches', icon: 'card', keywords: 'family life sms id upload' },
  ] },
  { section: 'Masjids', label: 'Masjids and zones', icon: 'masjid', children: [
    { label: 'Dashboard', href: '/masjids/dashboard', icon: 'dashboard', keywords: 'dashboard masjids seats vacant coverage zip' },
    { label: 'Masjid working bodies', href: '/masjids', icon: 'users', keywords: 'all masjids org chart associate director secretaries area representatives seats vacant working body' },
    { label: 'My masjid’s working body', href: '/team', icon: 'users', keywords: 'masjid team working body associate director secretary area representative assign role volunteers' },
    { label: 'Zones', href: '/zones?tab=zones', icon: 'zones', keywords: 'zone director term area north northwest southwest south southeast' },
    { label: 'Islamic Centers', href: '/zones?tab=centers', icon: 'building', keywords: 'masjid mosque center address phone website jumuah khutbah services' },
    { label: 'ZIP codes and masjids', href: '/zones?tab=zips', icon: 'zip', keywords: 'zip code routing zone lookup' },
  ] },
  { label: 'Prayer times', icon: 'moon', children: [
    { label: 'Today', href: '/prayer-times?tab=today', icon: 'calendar', keywords: 'prayer salah adhan iqamah today fajr dhuhr asr maghrib isha jumuah' },
    { label: 'Monthly timetable', href: '/prayer-times?tab=month', icon: 'calendar', keywords: 'prayer timetable month calendar print' },
    { label: 'Iqamah rules', href: '/prayer-times?tab=iqamah', icon: 'calendar', keywords: 'iqamah rules fixed minutes after adhan center' },
    { label: 'Calculation and Eid', href: '/prayer-times?tab=settings', icon: 'calendar', keywords: 'calculation method isna hanafi asr eid special prayer hijri' },
  ] },
  { label: 'Events', icon: 'calendar', children: [
    { label: 'Dashboard', href: '/events/dashboard', icon: 'dashboard', keywords: 'dashboard events upcoming registrations fill' },
    { label: 'All events', href: '/events', icon: 'calendar', keywords: 'events registration tickets waitlist guests reminders new event' },
    { label: 'Calendar', href: '/events/plan?tab=calendar', icon: 'calendar', keywords: 'calendar month clash jumuah eid conflict schedule' },
    { label: 'Approvals', href: '/events/plan?tab=approvals', icon: 'calendar', keywords: 'event approval masjid office send for approval lead time' },
    { label: 'Promotion', href: '/events/plan?tab=promotion', icon: 'megaphone', keywords: 'promote event feature email text social post' },
    { label: 'Analytics', href: '/events/plan?tab=analytics', icon: 'chart', keywords: 'event attendance no-show fill rate revenue turnout' },
  ] },
  { section: 'Money', label: 'Zakat and Sadaqah', icon: 'hand-heart', children: [
    { label: 'Dashboard', href: '/zakat?tab=overview', icon: 'heart', keywords: 'zakat sadaqah assistance needy help cases dashboard' },
    { label: 'Applications', href: '/zakat?tab=cases', icon: 'heart', keywords: 'zakat applications cases applicants intake new' },
    { label: 'Approvals', href: '/zakat?tab=approvals', icon: 'heart', keywords: 'zakat approve level coordinator committee chair override' },
    { label: 'Payouts', href: '/zakat?tab=payouts', icon: 'heart', keywords: 'zakat disbursement payout pay check transfer cash' },
    { label: 'Reports', href: '/zakat?tab=reports', icon: 'heart', keywords: 'zakat reports sadaqah distribution turnaround zone' },
    { label: 'Settings', href: '/zakat/settings', icon: 'heart', keywords: 'zakat limits levels response time sadaqah routing home visit' },
  ] },
  { label: 'Donations', icon: 'gift', children: [
    { label: 'Dashboard', href: '/donations?tab=overview', icon: 'card', keywords: 'donations gifts giving totals funds platforms' },
    { label: 'All gifts', href: '/donations?tab=gifts', icon: 'card', keywords: 'donations list gifts donors receipts refund' },
    { label: 'Reconciliation', href: '/donations?tab=recon', icon: 'card', keywords: 'reconcile unmatched pending payout deposit stripe paypal medina' },
    { label: 'Check-o-matic', href: '/donations?tab=checkomatic', icon: 'card', keywords: 'checkomatic check-o-matic donation membership qualify supporter' },
    { label: 'Funds and rules', href: '/donations/settings', icon: 'card', keywords: 'funds restricted zakat sadaqah building routing main center platforms receipts checkomatic rules' },
  ] },
  { label: 'Fundraising', icon: 'target', children: [
    { label: 'Dashboard', href: '/fundraising?tab=insights', icon: 'heart', keywords: 'donors retention lybunt sybunt new recurring monthly top' },
    { label: 'Campaigns', href: '/fundraising?tab=campaigns', icon: 'heart', keywords: 'fundraising campaigns goal thermometer ramadan building matching' },
    { label: 'Personal pages', href: '/fundraising?tab=pages', icon: 'heart', keywords: 'peer to peer p2p personal fundraising page approve' },
    { label: 'Pledges', href: '/fundraising?tab=pledges', icon: 'heart', keywords: 'pledge promise due reminder' },
  ] },
  { label: 'Finance', icon: 'ledger', children: [
    { label: 'Dashboard', href: '/finance?tab=overview', icon: 'chart', keywords: 'finance funds balances restricted cash ledger' },
    { label: 'Transactions', href: '/finance?tab=transactions', icon: 'chart', keywords: 'transactions expenses income payments checks transfers aid grants' },
    { label: 'Approvals', href: '/finance?tab=approvals', icon: 'chart', keywords: 'approve payment sign check two signatures' },
    { label: 'Budgets', href: '/finance?tab=budgets', icon: 'chart', keywords: 'budget actual variance center council' },
    { label: 'Statements and reports', href: '/finance?tab=reports', icon: 'chart', keywords: 'statement quarterly report audit fund activities csv' },
    { label: 'Finance rules', href: '/finance?tab=rules', icon: 'chart', keywords: 'approval limits accounts funds opening balances plan audit' },
  ] },
  { label: 'Member benefits', icon: 'benefits', children: [
    { label: 'Dashboard', href: '/benefits?tab=overview', icon: 'tag', keywords: 'benefits perks discounts partners offers use' },
    { label: 'Offers', href: '/benefits?tab=offers', icon: 'tag', keywords: 'offers discounts codes plans valid until featured' },
    { label: 'Partners', href: '/benefits?tab=partners', icon: 'tag', keywords: 'partners businesses agreement review halal approve' },
    { label: 'Use log', href: '/benefits?tab=uses', icon: 'tag', keywords: 'redemptions used benefit log record' },
    { label: 'Benefit rules', href: '/benefits?tab=rules', icon: 'tag', keywords: 'benefits rules review locked offers members' },
  ] },
  { section: 'Governance', label: 'Elected officials', icon: 'officials', children: [
    { label: 'Dashboard', href: '/officials?tab=overview', icon: 'users', keywords: 'officials leaders elected terms oath vacancies shura board' },
    { label: 'Board (Shura)', href: '/officials?tab=board', icon: 'users', keywords: 'shura board president vice president general secretary treasurer zonal director' },
    { label: 'Center leadership', href: '/officials?tab=centers', icon: 'users', keywords: 'associate director council area representatives secretaries administrative body' },
    { label: 'Vacancies', href: '/officials?tab=vacancies', icon: 'users', keywords: 'vacant empty seat appoint orientation' },
    { label: 'Officials rules', href: '/officials?tab=rules', icon: 'users', keywords: 'eid oath dates website leadership find representative zip' },
  ] },
  { label: 'Meetings and minutes', icon: 'minutes', children: [
    { label: 'Dashboard', href: '/minutes/dashboard', icon: 'dashboard', keywords: 'dashboard meetings quorum minutes overdue' },
    { label: 'Meetings', href: '/minutes?tab=meetings', icon: 'pages', keywords: 'minutes meeting council board general assembly quorum decisions' },
    { label: 'Required meetings check', href: '/minutes?tab=calendar', icon: 'pages', keywords: 'monthly council meeting required bylaws notice quorum' },
    { label: 'Records library', href: '/records', icon: 'records', keywords: 'records minutes reports bylaws documents files per masjid library' },
  ] },
  { label: 'Elections', icon: 'ballot', children: [
    { label: 'Dashboard', href: '/elections', icon: 'dashboard', keywords: 'dashboard elections voters eligible countdown' },
    { label: 'Voter list', href: '/reports?tab=voters', icon: 'chart', keywords: 'election eligible voters snapshot record date freeze' },
    { label: 'Candidates', href: '/reports?tab=candidates', icon: 'chart', keywords: 'candidates nominees eligibility election ballot' },
    { label: 'Area Representatives', href: '/reports?tab=area-reps', icon: 'chart', keywords: 'area representatives seats per center zip election' },
    { label: 'Nominations, ballot and results', href: '/elections/run', icon: 'ballot', keywords: 'nominations candidates ballot results count certify swear in election commission' },
  ] },
  { section: 'Website', label: 'Website', icon: 'globe', children: [
    { label: 'Dashboard', href: '/website', icon: 'dashboard', keywords: 'dashboard website pages published drafts' },
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
  { section: 'Admin', label: 'Reports', icon: 'reports', href: '/reports', keywords: 'report dues renewal rate zone area representatives candidates events export csv' },
  { label: 'Settings', icon: 'settings', children: [
    { label: 'Organization', href: '/settings/organization', icon: 'building', keywords: 'address phone email name tax' },
    { label: 'Configuration', href: '/settings/configuration', icon: 'toggle', keywords: 'directory member card profile fields payments check ach discount codes security two-step start page' },
    { label: 'Feature switches', href: '/settings/flags', icon: 'toggle', keywords: 'flags on off enable disable' },
    { label: 'Admins and roles', href: '/settings/admins', icon: 'shield', keywords: 'admin users roles permissions invite zone director election commission treasurer two-step' },
    { label: 'Sign-in and dashboards', href: '/settings/sign-in', icon: 'key', keywords: 'login sign in methods google email code text password dashboard chooser switch portal masjid zone organization member' },
    { label: 'Integrations', href: '/settings/integrations', icon: 'plug', keywords: 'email sms text stripe google provider keys webhook test send 10dlc dkim dmarc' },
    { label: 'Audit log', href: '/settings/audit', icon: 'audit', keywords: 'who changed history log export security' },
    { label: 'My appearance', href: '/appearance', icon: 'palette', keywords: 'admin theme glass dark wallpaper accent luxe' },
  ] },
  { label: 'Coming next', icon: 'sparkle', soon: '', children: [
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
  'members': 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16.5 10.5a3 3 0 1 0 0-6M21 20a5.5 5.5 0 0 0-3.5-5.1',
  'zakat': 'M12 21c-1.2-1-6-4.3-6-8.4A3.4 3.4 0 0 1 12 10a3.4 3.4 0 0 1 6 2.6c0 4.1-4.8 7.4-6 8.4zM3 12.5V8l3.5-2 4 1.5M21 12.5V8l-3.5-2-4 1.5',
  'donations': 'M12 21a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM12 8.5v8M14.5 10.5a2.5 2 0 0 0-2.5-1.3c-1.4 0-2.4.8-2.4 1.8 0 2.4 4.8 1 4.8 3.4 0 1-1 1.8-2.4 1.8a2.5 2 0 0 1-2.5-1.3',
  'ticketing': 'M3 9V6h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM10 6v1.5M10 10v1.5M10 14v1.5M13.5 10h4M13.5 13h3',
  'masjid-crm': 'M4 21V12l8-5 8 5v9M9 21v-4a3 3 0 0 1 6 0v4M12 7V4M12 4l1.5-1M2 21h20',
  'home': 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  'dashboard': 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  'users': 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16.5 10.5a3 3 0 1 0 0-6M21 20a5.5 5.5 0 0 0-3.5-5.1',
  'groups': 'M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2.5 14a4.5 4.5 0 0 1 6.5-2M21.5 14a4.5 4.5 0 0 0-6.5-2M7 21a5 5 0 0 1 10 0',
  'family': 'M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 8v4M12 12H6v3M12 12h6v3M6 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  'inbox': 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5',
  'ticket': 'M3 9V6h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM10 6v1.5M10 10v1.5M10 14v1.5',
  'mail': 'M3 6h18v12H3zM3 7l9 6 9-6',
  'megaphone': 'M4 10v4h3l7 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  'card': 'M3 6h18v12H3zM3 10h18M7 15h4',
  'rules': 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3M7 3v18',
  'form': 'M7 3h7l5 5v13H7zM14 3v5h5M10 12h6M10 16h6M10 8h2',
  'masjid': 'M4 21V12l8-5 8 5v9M9 21v-4a3 3 0 0 1 6 0v4M12 7V4M2 21h20',
  'building': 'M4 21V12l8-5 8 5v9M9 21v-4a3 3 0 0 1 6 0v4M12 7V4M2 21h20',
  'zones': 'M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  'zip': 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M7 14h10',
  'moon': 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5zM17 3v3M15.5 4.5h3',
  'calendar': 'M8 3v4M16 3v4M3 9h18M5 5h14v16H5zM8 13h3v3H8z',
  'heart': 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  'gift': 'M12 21a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM12 8.5v8M14.5 10.5a2.5 2 0 0 0-2.5-1.3c-1.4 0-2.4.8-2.4 1.8 0 2.4 4.8 1 4.8 3.4 0 1-1 1.8-2.4 1.8a2.5 2 0 0 1-2.5-1.3',
  'hand-heart': 'M12 21c-1.2-1-6-4.3-6-8.4A3.4 3.4 0 0 1 12 10a3.4 3.4 0 0 1 6 2.6c0 4.1-4.8 7.4-6 8.4zM3 12.5V8l3.5-2 4 1.5M21 12.5V8l-3.5-2-4 1.5',
  'ledger': 'M5 3h14v18H5zM9 3v18M12 8h4M12 12h4M12 16h4',
  'target': 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12h.01M21 3l-5 5',
  'benefits': 'M3 11h18v2H3zM5 13v8h14v-8M12 11v10M12 11c-1.5 0-4-1-4-3.5S10.5 4 12 7.5c1.5-3.5 4-2.5 4 0S13.5 11 12 11z',
  'ballot': 'M4 12h16v8H4zM8 12V5h8v7M10.5 8.5l1.2 1.2 2.3-2.4M8 16h8',
  'officials': 'M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM9 13.5 7.5 21l4.5-2.5 4.5 2.5-1.5-7.5',
  'minutes': 'M7 3h10v18H7zM10 8h4M10 12h4M10 16h2',
  'records': 'M3 5h18v4H3zM5 9v11h14V9M10 13h4',
  'chart': 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  'reports': 'M4 4h16v16H4zM8 15l3-3 2 2 3-4',
  'globe': 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  'pages': 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  'news': 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5',
  'menu': 'M4 6h16M4 12h16M4 18h10',
  'layout': 'M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z',
  'palette': 'M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.2-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10zM7.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  'brush': 'M14 4l6 6-8 8H6v-6zM4 20h4',
  'settings': 'M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0M14 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM16 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  'shield': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9.5 12l2 2 3.5-4',
  'audit': 'M7 4h10v17H7zM10 4V3h4v1M9.5 12l2 2 3.5-4M10 17h4',
  'key': 'M8 15a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM11 12l9-9M16 7l2 2M13 10l2 2',
  'plug': 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
  'toggle': 'M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7zm10 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  'tag': 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  'sparkle': 'M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z',
  'moon-star': 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5zM17 3v3M15.5 4.5h3',
  'id-card': 'M3 6h18v12H3zM8 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 16a3 3 0 0 1 4 0M14 10h4M14 14h4',
  'queue': 'M4 6h16M4 12h10M4 18h7M17 15l2 2 4-4',
  'check': 'M5 13l4 4L19 7',
};
export const iconPath = (n: IconName) => P[n];
