/**
 * R1 Records library – the documents an organization keeps for its members: meeting minutes, annual and financial
 * reports, the Constitution and Bylaws, policies, newsletters and forms – for the whole organization or one masjid
 * (ISGH kept per-masjid "Records" pages and an "ISGH TODAY" page in Wild Apricot). Each record is a link (a file in
 * the organization's own storage or an outside page) with a date, a category and an audience: everyone (website),
 * members (member portal) or elected leaders only. Categories and audiences are words any organization can live with.
 * DEMO (no API). Live: GET/PUT /admin/records, GET /public/records, GET /member/records. Synced to the admin by sync-contracts.mjs.
 */
import { z } from 'zod';

export const RECORD_CATEGORIES = {
  minutes: 'Meeting minutes', report: 'Annual report', financial: 'Financial statement', bylaws: 'Constitution and Bylaws', policy: 'Policy',
  newsletter: 'Newsletter', form: 'Form', election: 'Election notice', other: 'Other',
} as const;
export type RecordCategory = keyof typeof RECORD_CATEGORIES;
export const RECORD_AUDIENCE = { public: 'Everyone (website)', members: 'Members (member portal)', leaders: 'Elected leaders only' } as const;
export type RecordAudience = keyof typeof RECORD_AUDIENCE;

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date.');
export const RecordSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/),
  title: z.string().trim().min(3, 'Give the record a title.').max(140),
  category: z.enum(Object.keys(RECORD_CATEGORIES) as [RecordCategory, ...RecordCategory[]]),
  center: z.string().max(80).default(''),                 // '' = the whole organization
  date: ISO,                                              // the date of the document (meeting date, report year end…)
  audience: z.enum(Object.keys(RECORD_AUDIENCE) as [RecordAudience, ...RecordAudience[]]).default('members'),
  url: z.string().trim().refine((u) => /^https:\/\/\S+$/.test(u) || /^\/\S+$/.test(u), 'Use a full https address or a path on this site, like /files/minutes-2026-09.pdf.'),
  summary: z.string().max(300).default(''),
  source: z.enum(['upload', 'link', 'wildapricot']).default('link'),
  archived: z.boolean().default(false),
});
export const RecordsSchema = z.object({
  items: z.array(RecordSchema).max(5000),
  website: z.object({ enabled: z.boolean().default(true), title: z.string().max(80).default('Records'), intro: z.string().max(400).default('Minutes, reports and documents, by masjid and for the whole organization.') }).default({}),
}).superRefine((d, ctx) => {
  const ids = new Set<string>();
  d.items.forEach((r, i) => { if (ids.has(r.id)) ctx.addIssue({ code: 'custom', path: ['items', i, 'id'], message: `Two records use the ID “${r.id}”.` }); ids.add(r.id); });
});
export type RecordItem = z.infer<typeof RecordSchema>;
export type Records = z.infer<typeof RecordsSchema>;

export const fmtDate = (d: string) => (d ? `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}` : '');
/** What one audience may see: the website gets public records only; a signed-in member gets public + members; leaders everything. */
export function recordsFor(d: Records, who: RecordAudience): RecordItem[] {
  const rank: Record<RecordAudience, number> = { public: 0, members: 1, leaders: 2 };
  return d.items.filter((r) => !r.archived && rank[r.audience] <= rank[who]).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}
/** Grouped the way the pages show them: the organization first, then each masjid. */
export function recordsByCenter(list: RecordItem[], centerOrder: string[] = []): { center: string; label: string; items: RecordItem[] }[] {
  const groups = new Map<string, RecordItem[]>();
  list.forEach((r) => { if (!groups.has(r.center)) groups.set(r.center, []); groups.get(r.center)!.push(r); });
  const centers = Array.from(groups.keys()).filter(Boolean).sort((a, b) => (centerOrder.indexOf(a) - centerOrder.indexOf(b)) || a.localeCompare(b));
  return ['', ...centers].filter((c) => groups.has(c)).map((c) => ({ center: c, label: c || 'Whole organization', items: groups.get(c)! }));
}
/** Things to look at: no minutes for an active masjid in the last N days, a Bylaws record missing, a link that is not https. */
export function recordsWarnings(d: Records, centers: string[], today: string, minutesEveryDays = 60): string[] {
  const out: string[] = [];
  const live = d.items.filter((r) => !r.archived);
  if (!live.some((r) => r.category === 'bylaws' && !r.center)) out.push('No Constitution and Bylaws record for the organization.');
  const cutoff = new Date(Date.parse(`${today}T12:00:00Z`) - minutesEveryDays * 86_400_000).toISOString().slice(0, 10);
  const none: string[] = [];
  for (const c of centers) {
    const mine = live.filter((r) => r.center === c);
    if (!mine.length) { none.push(c); continue; }
    const latest = mine.filter((r) => r.category === 'minutes').map((r) => r.date).sort().at(-1);
    if (!latest) out.push(`${c}: no meeting minutes on file.`); else if (latest < cutoff) out.push(`${c}: the latest minutes are from ${fmtDate(latest)} – more than ${minutesEveryDays} days ago.`);
  }
  if (none.length) out.push(`${none.length === 1 ? `${none[0]} has` : `${none.length} masjids have`} no records yet${none.length > 1 ? ` (${none.slice(0, 3).join(', ')}${none.length > 3 ? ' …' : ''})` : ''}.`);
  live.filter((r) => r.url.startsWith('http://')).forEach((r) => out.push(`“${r.title}” links to an http:// address – use https.`));
  return out;
}

/* ---------------- demo data (fictional) ---------------- */
const R = (id: string, title: string, category: RecordCategory, center: string, date: string, audience: RecordAudience, url: string, summary = ''): RecordItem => ({ id, title, category, center, date, audience, url, summary, source: url.startsWith('/') ? 'upload' : 'link', archived: false });
export const mockRecords: Records = {
  website: { enabled: true, title: 'Records', intro: 'Minutes, reports and documents – for the whole community and for each Islamic Center.' },
  items: [
    R('bylaws-2025', 'Constitution and Bylaws (as amended September 28, 2025)', 'bylaws', '', '2025-09-28', 'public', '/files/constitution-and-bylaws-2025.pdf', 'The governing documents every member agrees to follow.'),
    R('annual-report-2025', 'Annual report 2025', 'report', '', '2026-03-15', 'public', '/files/annual-report-2025.pdf', 'The year in numbers: members, programs, centers.'),
    R('audit-2025', 'Audited financial statements 2025', 'financial', '', '2026-04-30', 'members', '/files/audited-financials-2025.pdf'),
    R('ga-2026-notice', 'General Assembly notice – September 2026', 'election', '', '2026-08-30', 'members', '/files/general-assembly-notice-2026.pdf'),
    R('today-2026-10', 'Community update – October 2026', 'newsletter', '', '2026-10-01', 'public', '/files/community-update-2026-10.pdf', 'What happened this month across the centers.'),
    R('membership-form', 'Membership application (paper form)', 'form', '', '2026-01-01', 'public', '/files/membership-application.pdf'),
    R('sw1-minutes-2026-09', 'Council minutes – September 2026', 'minutes', 'Southwest Islamic Center 1', '2026-09-14', 'members', '/files/sw1-council-2026-09.pdf'),
    R('sw1-minutes-2026-08', 'Council minutes – August 2026', 'minutes', 'Southwest Islamic Center 1', '2026-08-10', 'members', '/files/sw1-council-2026-08.pdf'),
    R('sw1-budget-2026', 'Center budget 2026', 'financial', 'Southwest Islamic Center 1', '2026-01-20', 'leaders', '/files/sw1-budget-2026.pdf'),
    R('n1-minutes-2026-07', 'Council minutes – July 2026', 'minutes', 'North Islamic Center 1', '2026-07-13', 'members', '/files/n1-council-2026-07.pdf'),
    R('n1-school-policy', 'Weekend school policy', 'policy', 'North Islamic Center 1', '2025-08-01', 'public', '/files/n1-weekend-school-policy.pdf'),
    R('se1-minutes-2026-09', 'Council minutes – September 2026', 'minutes', 'Southeast Islamic Center 1', '2026-09-21', 'members', '/files/se1-council-2026-09.pdf'),
  ],
};
