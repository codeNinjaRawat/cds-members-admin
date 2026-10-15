/** Admin navigation (A1). `soon` = planned module, shown so staff see what is coming (not clickable). */
/** badge = demo count that needs attention (live: from BE counters) */
/** countKey = live count shown as a badge (e.g. open cases in a work queue) */
export type NavItem = { label: string; href: string; icon: IconName; keywords?: string; soon?: string; badge?: string; countKey?: string };
export type NavGroup = { label: string; items: NavItem[] };
export type IconName = 'home' | 'palette' | 'layout' | 'menu' | 'megaphone' | 'pages' | 'news' | 'heart' | 'card' | 'building' | 'toggle' | 'brush' | 'users' | 'inbox' | 'chart' | 'shield' | 'plug';

/** Sidebar tree: top items with submenus. Sub-links may open a tab (?tab=) inside a screen. */
export type NavNode = { label: string; icon: IconName; href?: string; badge?: string; soon?: string; keywords?: string; countKey?: string; children?: NavItem[] };

export const NAV_TREE: NavNode[] = [
  { label: 'Overview', icon: 'home', href: '/', keywords: 'dashboard home kpi' },
  { label: 'Website', icon: 'layout', children: [
    { label: 'Theme and branding', href: '/website/theme', icon: 'palette', keywords: 'colors logo favicon dark mode fonts' },
    { label: 'Home page', href: '/website/home', icon: 'layout', keywords: 'hero layout sections stats heart line hadith' },
    { label: 'Menus and footer', href: '/website/menus', icon: 'menu', keywords: 'navigation header footer links social newsletter hours' },
    { label: 'Announcement bar', href: '/website/announcement', icon: 'megaphone', keywords: 'banner top bar notice' },
    { label: 'Pages', href: '/website/pages', icon: 'pages', keywords: 'about faq elections contact privacy terms blocks' },
    { label: 'News', href: '/website/news', icon: 'news', keywords: 'posts blog updates' },
  ] },
  { label: 'Giving', icon: 'heart', badge: '4', children: [
    { label: 'Verses and hadith', href: '/website/giving?tab=verses', icon: 'heart', keywords: 'quran verses hadith' },
    { label: 'How we helped', href: '/website/giving?tab=impact', icon: 'heart', keywords: 'impact stories programs' },
    { label: 'Who still needs help', href: '/website/giving?tab=needs', icon: 'heart', keywords: 'needs cases zakat', badge: '4' },
    { label: 'Giving page and switches', href: '/website/giving?tab=settings', icon: 'heart', keywords: 'donate zakat link samples' },
  ] },
  { label: 'Membership', icon: 'card', children: [
    { label: 'Plans and dues', href: '/membership?tab=plans', icon: 'card', keywords: 'dues prices plans' },
    { label: 'Voting and area', href: '/membership?tab=voting', icon: 'card', keywords: 'voting record date june 30 age zone' },
    { label: 'Join form builder', href: '/membership/form', icon: 'card', keywords: 'sign up form fields questions builder application onboarding steps' },
    { label: 'Pledge and consents', href: '/membership?tab=join', icon: 'card', keywords: 'pledge consent commitments otp code' },
    { label: 'Membership switches', href: '/membership?tab=switches', icon: 'card', keywords: 'family life sms id upload' },
  ] },
  { label: 'Members', icon: 'users', children: [
    { label: 'All members', href: '/members', icon: 'users', keywords: 'people list search directory find member profile' },
    { label: 'Can vote this year', href: '/members?view=voters', icon: 'users', keywords: 'voting eligible good standing election' },
    { label: 'Not renewed', href: '/members?view=not-renewed', icon: 'users', keywords: 'expired lapsed renewal reminder dues' },
    { label: 'Pending approval', href: '/members?view=pending', icon: 'inbox', keywords: 'board approve applications new' },
    { label: 'Family trees', href: '/families', icon: 'users', keywords: 'family tree household relatives children parents spouse outreach' },
    { label: 'Voter list', href: '#', icon: 'chart', soon: 'A9' },
  ] },
  { label: 'Work queues', icon: 'inbox', countKey: 'q:all', children: [
    { label: 'Applications', href: '/queues?tab=applications', icon: 'inbox', countKey: 'q:applications', keywords: 'approve board new members review' },
    { label: 'Photo ID checks', href: '/queues?tab=id', icon: 'inbox', countKey: 'q:id', keywords: 'identity driver license passport verify' },
    { label: 'Center changes', href: '/queues?tab=center', icon: 'inbox', countKey: 'q:center', keywords: 'border 5 miles zone islamic center move' },
    { label: 'Possible duplicates', href: '/queues?tab=duplicates', icon: 'inbox', countKey: 'q:duplicates', keywords: 'merge same person double' },
    { label: 'Payments to fix', href: '/queues?tab=payments', icon: 'inbox', countKey: 'q:payments', keywords: 'declined card failed check bank returned' },
  ] },
  { label: 'Settings', icon: 'building', children: [
    { label: 'Organization', href: '/settings/organization', icon: 'building', keywords: 'address phone email name tax' },
    { label: 'Feature switches', href: '/settings/flags', icon: 'toggle', keywords: 'flags on off enable disable' },
    { label: 'My appearance', href: '/appearance', icon: 'brush', keywords: 'admin theme glass dark wallpaper accent luxe' },
  ] },
  { label: 'Coming next', icon: 'plug', soon: '', children: [
    { label: 'Reports', href: '#', icon: 'chart', soon: 'A9' },
    { label: 'Admin users and roles', href: '#', icon: 'shield', soon: 'A10' },
    { label: 'Integrations', href: '#', icon: 'plug', soon: 'A11' },
  ] },
];

/** Flat list (command palette, older code). */
export const NAV: NavGroup[] = NAV_TREE.map((n) => ({ label: n.label, items: n.children ?? [{ label: n.label, href: n.href ?? '/', icon: n.icon, keywords: n.keywords, badge: n.badge }] }));

const P: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
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
  plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
};
export const iconPath = (n: IconName) => P[n];
