/**
 * O1.4 – what the Page Composer knows about each block: group, label, one-line help, a starter value and a
 * one-line summary for the collapsed card. The contract itself is web `lib/content/pages.ts` (synced here).
 */
import type { Block, Page } from '@/lib/content/pages';

export type BlockGroup = 'text' | 'media' | 'layout' | 'live' | 'forms';
export const GROUP_LABEL: Record<BlockGroup, string> = { text: 'Text', media: 'Media', layout: 'Layout & lists', live: 'Live data (from your admin modules)', forms: 'Forms' };

type Meta = { group: BlockGroup; label: string; help: string; starter: () => Block; summary: (b: Block) => string };
const t = (b: Block, k: string) => String((b as unknown as Record<string, unknown>)[k] ?? '');
const n = (b: Block, k: string) => ((b as unknown as Record<string, unknown[]>)[k] ?? []).length;

export const CATALOG: Record<Block['type'], Meta> = {
  heading: { group: 'text', label: 'Heading', help: 'A section title.', starter: () => ({ type: 'heading', text: 'New section' }), summary: (b) => t(b, 'text') },
  paragraph: { group: 'text', label: 'Paragraph', help: 'Text. Use **bold** and [link text](/page) – nothing else.', starter: () => ({ type: 'paragraph', text: 'Write here…' }), summary: (b) => t(b, 'text').slice(0, 90) },
  list: { group: 'text', label: 'List', help: 'Bulleted or numbered.', starter: () => ({ type: 'list', items: ['First item', 'Second item'] }), summary: (b) => `${n(b, 'items')} items` },
  callout: { group: 'text', label: 'Callout', help: 'A highlighted note: info, warning or success.', starter: () => ({ type: 'callout', tone: 'info', title: 'Good to know', text: '…' }), summary: (b) => `${t(b, 'tone')} · ${t(b, 'title')}` },
  faq: { group: 'text', label: 'Questions & answers', help: 'Questions that open on tap.', starter: () => ({ type: 'faq', items: [{ q: 'Question?', a: 'Answer.' }] }), summary: (b) => `${n(b, 'items')} questions` },
  verse: { group: 'text', label: 'Verse or hadith', help: 'Arabic (optional) + English + source. Reviewed by an imam.', starter: () => ({ type: 'verse', text: '', arabic: '', source: 'Quran 2:43' }), summary: (b) => t(b, 'source') },
  facts: { group: 'layout', label: 'Facts & numbers', help: 'Up to 8 big numbers with labels.', starter: () => ({ type: 'facts', items: [{ value: '22', label: 'Islamic Centers' }] }), summary: (b) => `${n(b, 'items')} facts` },
  steps: { group: 'layout', label: 'Steps', help: 'Numbered steps (how to join, how to register…).', starter: () => ({ type: 'steps', items: [{ title: 'Step one', text: '' }] }), summary: (b) => `${n(b, 'items')} steps` },
  columns: { group: 'layout', label: 'Columns', help: 'Two or three text columns (stack on phones).', starter: () => ({ type: 'columns', columns: [{ title: 'Left', text: '…' }, { title: 'Right', text: '…' }] }), summary: (b) => `${n(b, 'columns')} columns` },
  cards: { group: 'layout', label: 'Cards', help: 'Linked tiles with optional image – programs, services, quick links.', starter: () => ({ type: 'cards', columns: '3', items: [{ title: 'Card', text: '', href: '/', label: 'Open' }] }), summary: (b) => `${n(b, 'items')} cards` },
  people: { group: 'layout', label: 'People', help: 'Name, role, contact – typed by hand (for live leaders use the Leadership block).', starter: () => ({ type: 'people', items: [{ name: 'Name', role: 'Role' }] }), summary: (b) => `${n(b, 'items')} people` },
  buttons: { group: 'layout', label: 'Buttons', help: 'One to six buttons in a row.', starter: () => ({ type: 'buttons', items: [{ label: 'Become a member', href: '/membership/join', style: 'primary' }] }), summary: (b) => `${n(b, 'items')} buttons` },
  cta: { group: 'layout', label: 'Call to action band', help: 'A dark band with one button.', starter: () => ({ type: 'cta', title: 'Join us', text: '', label: 'Become a member', href: '/membership/join' }), summary: (b) => t(b, 'title') },
  contact: { group: 'layout', label: 'Contact lines', help: 'Phone, email, address, hours.', starter: () => ({ type: 'contact', lines: [{ label: 'Phone', value: '(713) 524-6615', href: 'tel:+17135246615' }] }), summary: (b) => `${n(b, 'lines')} lines` },
  documents: { group: 'layout', label: 'Documents', help: 'PDFs and pages with kind, size and date.', starter: () => ({ type: 'documents', items: [{ title: 'Document', href: '/documents/file.pdf', kind: 'PDF' }] }), summary: (b) => `${n(b, 'items')} documents` },
  table: { group: 'layout', label: 'Table', help: 'Rows and columns; scrolls sideways on phones.', starter: () => ({ type: 'table', header: ['Column 1', 'Column 2'], rows: [['', '']] }), summary: (b) => `${n(b, 'rows')} rows` },
  divider: { group: 'layout', label: 'Divider', help: 'A line, optionally with a small label.', starter: () => ({ type: 'divider', label: '' }), summary: (b) => t(b, 'label') || '—' },
  image: { group: 'media', label: 'Image', help: 'One photo with alt text (required) and caption.', starter: () => ({ type: 'image', image: { src: '', alt: '' }, caption: '' }), summary: (b) => (b as { image: { alt: string } }).image.alt || 'no alt text yet' },
  gallery: { group: 'media', label: 'Gallery', help: 'Up to 24 photos.', starter: () => ({ type: 'gallery', images: [] }), summary: (b) => `${n(b, 'images')} photos` },
  embed: { group: 'media', label: 'Video / map / form embed', help: 'YouTube, Vimeo, Google Maps, Google Forms only.', starter: () => ({ type: 'embed', kind: 'video', url: '', title: '' }), summary: (b) => t(b, 'title') || t(b, 'url') },
  'prayer-times': { group: 'live', label: 'Prayer times', help: 'Today, this week or this month – from Admin › Prayer times.', starter: () => ({ type: 'prayer-times', masjid: '', view: 'today', showIqamah: true }), summary: (b) => `${t(b, 'view')}${t(b, 'masjid') ? ` · ${t(b, 'masjid')}` : ' · page’s masjid / first center'}` },
  'next-jumuah': { group: 'live', label: 'Next Jumuah', help: 'Friday khutbah times from Zones and centers.', starter: () => ({ type: 'next-jumuah', masjid: '' }), summary: (b) => t(b, 'masjid') || 'all masajid' },
  events: { group: 'live', label: 'Upcoming events', help: 'From Admin › Events; filter by masjid and category.', starter: () => ({ type: 'events', masjid: '', category: '', limit: 6, emptyText: '' }), summary: (b) => `next ${t(b, 'limit')}${t(b, 'category') ? ` · ${t(b, 'category')}` : ''}` },
  campaigns: { group: 'live', label: 'Campaigns', help: 'Live campaigns with progress – from Fundraising.', starter: () => ({ type: 'campaigns', masjid: '', limit: 3, emptyText: '' }), summary: (b) => `top ${t(b, 'limit')}` },
  leadership: { group: 'live', label: 'Leadership', help: 'Board, a zone, or a masjid’s leaders – from Elected officials.', starter: () => ({ type: 'leadership', scope: 'board', masjid: '', zone: '' }), summary: (b) => t(b, 'scope') },
  'masjid-cards': { group: 'live', label: 'Masjid cards', help: 'Every active masjid (or one zone) from Zones and centers.', starter: () => ({ type: 'masjid-cards', zone: '' }), summary: (b) => t(b, 'zone') || 'all zones' },
  deadline: { group: 'live', label: 'Voting deadline', help: 'Days left until the membership record date.', starter: () => ({ type: 'deadline', title: '' }), summary: (b) => t(b, 'title') || 'Keep your vote' },
  news: { group: 'live', label: 'Latest news', help: 'From Website › News.', starter: () => ({ type: 'news', limit: 3 }), summary: (b) => `latest ${t(b, 'limit')}` },
  plans: { group: 'live', label: 'Membership plans', help: 'Visible plans from Membership settings.', starter: () => ({ type: 'plans' }), summary: () => 'visible plans' },
  election: { group: 'live', label: 'Election', help: 'The current election (or a year): status, key dates, seats and candidates, certified results.', starter: () => ({ type: 'election', year: 0 }), summary: (b) => (t(b, 'year') === '0' ? 'current election' : t(b, 'year')) },
  khutbah: { group: 'live', label: 'Friday khutbah schedule', help: 'From Prayer times › Friday khutbah: one masjid’s coming Fridays, or every masjid next Friday.', starter: () => ({ type: 'khutbah', masjid: '', weeks: 6 }), summary: (b) => `${t(b, 'weeks')} weeks · ${t(b, 'masjid') || 'page’s masjid / all'}` },
  activity: { group: 'live', label: 'Activity (what’s happening)', help: 'Automatic stream from events, news, campaigns, leaders, prayer changes and documents. “This week” digest or full feed.', starter: () => ({ type: 'activity', masjid: '', view: 'week', kinds: [], limit: 12 }), summary: (b) => `${t(b, 'view')} · ${t(b, 'masjid') || 'page’s masjid / all'}` },
  form: { group: 'forms', label: 'Form', help: 'Feedback, complaint or membership verification.', starter: () => ({ type: 'form', kind: 'feedback' }), summary: (b) => t(b, 'kind') },
};
export const GROUPS: BlockGroup[] = ['text', 'layout', 'media', 'live', 'forms'];

/** Page templates offered in "New page" – a starting set of blocks admins then edit. */
export const PAGE_TEMPLATES: { id: string; label: string; help: string; make: (title: string) => Pick<Page, 'template' | 'blocks' | 'intro'> }[] = [
  { id: 'blank', label: 'Blank article', help: 'One paragraph to start.', make: () => ({ template: 'article', intro: '', blocks: [{ type: 'paragraph', text: 'Write the first paragraph here.' }] }) },
  { id: 'info', label: 'Information page', help: 'Intro, sections, FAQ, contact, call to action.', make: () => ({ template: 'article', intro: 'One sentence that says what this page is about.', blocks: [
    { type: 'heading', text: 'Overview' }, { type: 'paragraph', text: '…' }, { type: 'heading', text: 'How it works' }, { type: 'steps', items: [{ title: 'Step one', text: '' }, { title: 'Step two', text: '' }] },
    { type: 'faq', items: [{ q: 'Question?', a: 'Answer.' }] }, { type: 'contact', lines: [{ label: 'Email', value: 'info@example.org', href: 'mailto:info@example.org' }] },
    { type: 'cta', title: 'Need help?', text: 'We answer within two business days.', label: 'Contact us', href: '/contact' } ] }) },
  { id: 'masjid', label: 'Masjid overview', help: 'Prayer strip, next Jumuah, events, leaders, campaigns, visit.', make: () => ({ template: 'hub', intro: '', blocks: [
    { type: 'prayer-times', masjid: '', view: 'today', showIqamah: true }, { type: 'next-jumuah', masjid: '' },
    { type: 'heading', text: 'This week' }, { type: 'events', masjid: '', category: '', limit: 6, emptyText: 'No events this week.' },
    { type: 'heading', text: 'Support this masjid' }, { type: 'campaigns', masjid: '', limit: 3, emptyText: '' },
    { type: 'heading', text: 'Leadership' }, { type: 'leadership', scope: 'masjid', masjid: '', zone: '' },
    { type: 'heading', text: 'Visit' }, { type: 'contact', lines: [{ label: 'Address', value: '' }, { label: 'Phone', value: '' }] } ] }) },
  { id: 'campaign', label: 'Campaign / appeal', help: 'Hero image, story, numbers, live progress, give button.', make: () => ({ template: 'landing', intro: 'Why this matters, in one line.', blocks: [
    { type: 'facts', items: [{ value: '$0', label: 'Raised' }, { value: '0', label: 'Families helped' }] }, { type: 'paragraph', text: 'The story…' },
    { type: 'campaigns', masjid: '', limit: 1, emptyText: '' }, { type: 'buttons', items: [{ label: 'Give now', href: '/give', style: 'primary' }] }, { type: 'verse', text: '', arabic: '', source: '' } ] }) },
  { id: 'ramadan', label: 'Ramadan / Eid page', help: 'Timings table, taraweeh, iftar, documents, FAQ.', make: () => ({ template: 'hub', intro: 'Everything for the month, in one place.', blocks: [
    { type: 'callout', tone: 'info', title: 'Moon sighting', text: 'The start date will be announced here.' }, { type: 'prayer-times', masjid: '', view: 'month', showIqamah: true },
    { type: 'heading', text: 'Taraweeh and iftar' }, { type: 'table', header: ['Masjid', 'Isha', 'Taraweeh', 'Iftar'], rows: [['', '', '', '']] },
    { type: 'documents', items: [{ title: 'Excuse letter for school / work (PDF)', href: '', kind: 'PDF' }] }, { type: 'faq', items: [{ q: 'Where do I park?', a: '' }] } ] }) },
  { id: 'announcement', label: 'Announcement', help: 'Short text first, flyer image second, one button.', make: () => ({ template: 'article', intro: '', blocks: [
    { type: 'paragraph', text: 'What, when, where – in two or three sentences.' }, { type: 'image', image: { src: '', alt: '' }, caption: '' }, { type: 'buttons', items: [{ label: 'Register', href: '', style: 'primary' }] } ] }) },
];
