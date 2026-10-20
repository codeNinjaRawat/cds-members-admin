/**
 * CONTRACT – bulk messages (review step 5; WildApricot: Email blasts + templates + unsubscribe). One message to an
 * audience built from groups, by email or text. Everything a person can do wrong is checked here, and the server runs
 * the same checks again before it sends:
 *   topics + preferences   – members choose which kinds of email they get; official notices always go
 *   resolveAudience        – groups in / groups out, minus archived, unsubscribed, no consent, no address, duplicates
 *   smsSegments            – GSM-7 vs Unicode (Arabic, emoji) and how many text segments a message costs
 *   checkCampaign          – merge fields, unsubscribe link, one-line subject, schedule in the future, quiet hours
 *   finalText              – the exact text that goes out (footer, preferences link, "Reply STOP")
 */
import { z } from 'zod';
import { MACROS, render, type CommunicationDoc, type MacroKey, type Template } from './communication';
import { inGroup, type Facts, type GroupsDoc } from './groups';

/* ---------- topics and preferences ---------- */
export const TOPICS = {
  newsletter: { label: 'Newsletters', optional: true },
  announcement: { label: 'Announcements', optional: true },
  events: { label: 'Events and programs', optional: true },
  fundraising: { label: 'Fundraising and Zakat appeals', optional: true },
  religious: { label: 'Ramadan, Eid and prayer times', optional: true },
  membership: { label: 'Membership and election notices', optional: false }, // Bylaws notices – always sent
} as const;
export type Topic = keyof typeof TOPICS;
export const TOPIC_KEYS = Object.keys(TOPICS) as Topic[];
/** Template category → topic. Renewal and election messages are official notices. */
export function topicOf(category: Template['category']): Topic {
  return ({ announcement: 'announcement', newsletter: 'newsletter', renewal: 'membership', election: 'membership', fundraising: 'fundraising', religious: 'religious', other: 'announcement' } as const)[category];
}
export type Prefs = { email: boolean; sms: boolean; optOut: Topic[] };
/** Official notices cannot be switched off; everything else is the member's choice. */
export const wants = (p: Prefs, topic: Topic, channel: 'email' | 'sms') => (channel === 'email' ? p.email : p.sms) && (!TOPICS[topic].optional || !p.optOut.includes(topic));

/* ---------- the message ---------- */
export const CampaignSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/),
  name: z.string().trim().min(2, 'Name the message (only staff see it).').max(80),
  channel: z.enum(['email', 'sms']),
  topic: z.enum(TOPIC_KEYS as [Topic, ...Topic[]]),
  subject: z.string().max(150).default(''),
  body: z.string().trim().min(1, 'Write the message.').max(10_000),
  audience: z.object({
    everyone: z.boolean().default(false),
    groupIds: z.array(z.string()).max(30).default([]),
    excludeGroupIds: z.array(z.string()).max(30).default([]),
    memberIds: z.array(z.string().max(20)).max(500).default([]),   // specific people (a reply to one member, a small list) – on top of the groups
  }),
  // pictures shown at the end of an email (uploaded to the API's files, area "comms"); texts cannot carry them
  images: z.array(z.object({ fileId: z.string().min(1).max(40), name: z.string().max(160).default('') })).max(5).default([]),
  sendAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable().default(null), // Houston time; null = send now / draft
  status: z.enum(['draft', 'scheduled', 'sent', 'cancelled']).default('draft'),
  sentTo: z.number().int().min(0).default(0),
  createdBy: z.string().max(120).default(''),
  updatedAt: z.string().default(''),
}).superRefine((c, ctx) => {
  if (c.channel === 'email' && !c.subject.trim()) ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Write a subject.' });
  if (/[\r\n]/.test(c.subject)) ctx.addIssue({ code: 'custom', path: ['subject'], message: 'A subject must be one line.' });
  if (!c.audience.everyone && !c.audience.groupIds.length && !c.audience.memberIds.length) ctx.addIssue({ code: 'custom', path: ['audience', 'groupIds'], message: 'Choose who gets it: everyone, at least one group, or specific members.' });
  if (c.channel === 'sms' && c.images.length) ctx.addIssue({ code: 'custom', path: ['images'], message: 'Pictures go by email only – texts cannot carry them.' });
  if (c.audience.groupIds.some((g) => c.audience.excludeGroupIds.includes(g))) ctx.addIssue({ code: 'custom', path: ['audience', 'excludeGroupIds'], message: 'A group cannot be both in and out.' });
  if (c.channel === 'sms' && smsSegments(c.body).segments > 3) ctx.addIssue({ code: 'custom', path: ['body'], message: 'Keep a text message to 3 parts or fewer.' });
});
export type Campaign = z.infer<typeof CampaignSchema>;

/* ---------- audience ---------- */
export type Recipient = { id: string; name: string; email?: string; phone?: string; archived?: boolean; prefs: Prefs; facts: Facts };
export type SkipReason = 'archived' | 'unsubscribed' | 'no-consent' | 'no-address' | 'duplicate-address' | 'excluded';
export const SKIP_LABEL: Record<SkipReason, string> = {
  archived: 'archived records', unsubscribed: 'chose not to get this kind of message', 'no-consent': 'did not agree to texts', 'no-address': 'no email or mobile on file',
  'duplicate-address': 'share an address with someone already on the list (sent once)', excluded: 'in a left-out group',
};
export function resolveAudience(c: Pick<Campaign, 'channel' | 'topic' | 'audience'>, people: Recipient[], groups: GroupsDoc) {
  const usable = (ids: string[]) => groups.groups.filter((g) => ids.includes(g.id) && !g.archived && groups.enabled);
  const inc = usable(c.audience.groupIds), exc = usable(c.audience.excludeGroupIds);
  const skipped: Record<SkipReason, number> = { archived: 0, unsubscribed: 0, 'no-consent': 0, 'no-address': 0, 'duplicate-address': 0, excluded: 0 };
  const to: Recipient[] = []; const seen = new Set<string>();
  for (const p of people) {
    const picked = c.audience.everyone || inc.some((g) => inGroup(g, p.facts)) || c.audience.memberIds.includes(p.id);
    if (!picked) continue;
    if (p.archived || p.facts.status === 'archived') { skipped.archived++; continue; }
    if (!c.audience.memberIds.includes(p.id) && exc.some((g) => inGroup(g, p.facts))) { skipped.excluded++; continue; }   // a person named by hand is never left out
    const addr = c.channel === 'email' ? p.email?.trim().toLowerCase() : p.phone?.replace(/\D/g, '').slice(-10);
    if (!addr) { skipped['no-address']++; continue; }
    if (!wants(p.prefs, c.topic, c.channel)) { skipped[c.channel === 'sms' && !p.prefs.sms ? 'no-consent' : 'unsubscribed']++; continue; }
    if (seen.has(addr)) { skipped['duplicate-address']++; continue; }
    seen.add(addr); to.push(p);
  }
  return { to, skipped, missingGroups: c.audience.groupIds.filter((id) => !inc.some((g) => g.id === id)) };
}

/* ---------- text messages ---------- */
const GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€';
/** One text = 160 GSM-7 characters (153 per part when split) or 70 Unicode characters (67 per part). Arabic or emoji switch to Unicode. */
export function smsSegments(text: string) {
  const chars = Array.from(text);
  const gsm = chars.every((ch) => GSM.includes(ch) || GSM_EXT.includes(ch));
  const len = gsm ? chars.reduce((n, ch) => n + (GSM_EXT.includes(ch) ? 2 : 1), 0) : chars.length;
  const [one, part] = gsm ? [160, 153] : [70, 67];
  return { encoding: gsm ? 'GSM-7' as const : 'Unicode' as const, length: len, segments: len === 0 ? 0 : len <= one ? 1 : Math.ceil(len / part), perPart: len <= one ? one : part };
}
/** Quiet hours like 21:00–08:00 wrap past midnight. */
export function inQuietHours(hhmm: string, q: { from: string; to: string }) {
  return q.from <= q.to ? hhmm >= q.from && hhmm < q.to : hhmm >= q.from || hhmm < q.to;
}
export const STOP_TEXT = ' Reply STOP to opt out.';

/* ---------- checks before sending ---------- */
const BULK_PREFIX = ['Member', 'Org', 'Link'];
export function checkCampaign(c: Campaign, comm: Pick<CommunicationDoc, 'sender' | 'sms'>, now: string): { field: string; message: string }[] {
  const out: { field: string; message: string }[] = [];
  const text = `${c.subject}\n${c.body}`;
  for (const m of text.matchAll(/\{([A-Za-z]+)\.([A-Za-z]+)\}/g)) {
    const key = `${m[1]}.${m[2]}`;
    if (!MACROS.some((x) => x.key === key)) out.push({ field: 'body', message: `Unknown merge field {${key}}.` });
    else if (!BULK_PREFIX.includes(m[1])) out.push({ field: 'body', message: `{${key}} has no value in a message to many people.` });
  }
  if (c.channel === 'email' && !/\d{5}/.test(comm.sender.footer)) out.push({ field: 'body', message: 'The email footer needs your postal address (Communication › Sending).' });
  if (c.channel === 'sms') {
    if (!comm.sms.enabled) out.push({ field: 'channel', message: 'Text messages are switched off (Communication › Sending and text messages).' });
    if (c.sendAt && inQuietHours(c.sendAt.slice(11, 16), comm.sms.quietHours)) out.push({ field: 'sendAt', message: `That time is inside quiet hours (${comm.sms.quietHours.from}–${comm.sms.quietHours.to}). Pick a daytime hour.` });
    if (/https?:\/\/\S+/.test(c.body) && !/\{Link\./.test(c.body)) out.push({ field: 'body', message: 'Use a merge-field link like {Link.Renew} – carriers often block unknown links.' });
  }
  if (c.sendAt && c.sendAt <= now) out.push({ field: 'sendAt', message: 'Pick a time in the future, or send now.' });
  return out;
}
/** The exact text that goes out: merge fields filled, email footer + preferences line, or "Reply STOP" for texts. */
export function finalText(c: Pick<Campaign, 'channel' | 'topic' | 'subject' | 'body'>, comm: Pick<CommunicationDoc, 'sender'>, values: Partial<Record<MacroKey, string>>) {
  if (c.channel === 'sms') return { subject: '', body: render(c.body, values) + STOP_TEXT };
  const prefs = TOPICS[c.topic].optional
    ? `You get this because you chose “${TOPICS[c.topic].label}”. Change what you get: ${values['Link.Unsubscribe'] ?? '[Email preferences link]'}`
    : `This is an official ${TOPICS[c.topic].label.toLowerCase().replace(' notices', ' notice')} sent to every member. Your other email choices: ${values['Link.Unsubscribe'] ?? '[Email preferences link]'}`;
  return { subject: render(c.subject, values), body: `${render(c.body, values)}\n\n—\n${comm.sender.footer}\n${prefs}` };
}
