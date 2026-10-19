/**
 * D8 – Team messages: the office talks inside the admin instead of email and WhatsApp (asked for on the 10/17 review
 * call: "send a colleague or a director a note or a screenshot without leaving the dashboard"). Channels per
 * department and direct messages; a message can carry an attachment and links to a member, a ticket or a task, and
 * can be turned into a task with one click. Nothing here is specific to one organization – channels come from the
 * departments the client set up (Admins and roles › areas), people from Admins.
 * DEMO: kept in this browser. Live: GET/POST /admin/inbox/conversations, POST /admin/inbox/:id/messages, PUT …/read.
 */
import { useEffect, useState } from 'react';
import { newId } from '@/lib/community/work';

export type Attachment = { name: string; type: string; size: number; dataUrl?: string };
export type MessageLink = { kind: 'member' | 'ticket' | 'task' | 'case'; id: string; label: string };
export type Message = { id: string; convId: string; from: string; at: string; text: string; attachments: Attachment[]; links: MessageLink[]; taskId?: string };
export type Conversation = { id: string; kind: 'channel' | 'direct'; name: string; about: string; members: string[]; department: string; archived: boolean };
export type Inbox = { conversations: Conversation[]; messages: Message[]; read: Record<string, Record<string, string>> }; // read[convId][adminId] = last read ISO

export const KEY = 'ms:team-inbox';
export const INBOX_EVENT = 'ms:inbox';
export const MAX_ATTACHMENT_BYTES = 2_000_000;       // demo: a screenshot; live: the API's limit
export const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/csv', 'text/plain'];

/** Fictional demo threads for the demo organization – departments as channels, one direct thread. */
export function seedInbox(now: string, admins: { id: string; name: string; roleId: string }[]): Inbox {
  const ids = new Set(admins.map((a) => a.id));
  const has = (id: string) => ids.has(id);
  const shift = (h: number) => new Date(Date.parse(now) - h * 3_600_000).toISOString();
  const everyone = admins.map((a) => a.id);
  const office = admins.filter((a) => ['owner', 'membership-officer', 'membership-secretary', 'office-admin', 'general-secretary'].includes(a.roleId)).map((a) => a.id);
  const money = admins.filter((a) => ['owner', 'treasurer', 'finance-secretary'].includes(a.roleId)).map((a) => a.id);
  const conversations: Conversation[] = [
    { id: 'c-all', kind: 'channel', name: 'All staff', about: 'Notices for everyone with access.', members: everyone, department: '', archived: false },
    { id: 'c-membership', kind: 'channel', name: 'Membership', about: 'Applications, ID checks, renewals, the June 30 rush.', members: office, department: 'membership', archived: false },
    { id: 'c-finance', kind: 'channel', name: 'Finance', about: 'Deposits, refunds, receipts, reconciliation.', members: money, department: 'finance', archived: false },
    ...(has('owner') && has('membership-office') ? [{ id: 'd-owner-office', kind: 'direct' as const, name: '', about: '', members: ['owner', 'membership-office'], department: '', archived: false }] : []),
  ];
  const M = (convId: string, from: string, hoursAgo: number, text: string, extra: Partial<Message> = {}): Message => ({ id: newId('msg'), convId, from, at: shift(hoursAgo), text, attachments: [], links: [], ...extra });
  const messages: Message[] = [
    M('c-all', 'owner', 52, 'Assalamu alaikum all – renewal season opens November 1. Please check the reminder text under Membership rules before then.'),
    M('c-membership', 'membership-office', 30, 'The photo-ID queue is at 35. I will take the ones older than 3 days today; can someone take the new uploads?'),
    M('c-membership', 'owner', 29, 'Take them in order of age. If a photo is unreadable, use the saved reply "We need a photo ID" – do not write a new one each time.', { links: [{ kind: 'case', id: 'id', label: 'Photo ID checks' }] }),
    M('c-finance', 'treasurer', 20, 'Deposit DEP-702 is short by $40 against the check log. Looking for a check that was logged twice.'),
    ...(has('owner') && has('membership-office') ? [
      M('d-owner-office', 'membership-office', 6, 'A member says his center is wrong – he moved to 77036 in March but the record still shows North. Attached what he sent.', { attachments: [{ name: 'lease-first-page.pdf', type: 'application/pdf', size: 184_221 }], links: [{ kind: 'member', id: 'HOU-205032', label: 'HOU-205032' }] }),
      M('d-owner-office', 'owner', 5, 'Proof of address is there – open a center-change case and approve it; the 5-year lock starts today.', {}),
    ] : []),
  ];
  return { conversations, messages, read: {} };
}

export function readInbox(): Inbox | null { try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as Inbox) : null; } catch { return null; } }
export function writeInbox(i: Inbox) { try { localStorage.setItem(KEY, JSON.stringify(i)); } catch { /* storage blocked */ } window.dispatchEvent(new Event(INBOX_EVENT)); }

/** Conversations this person is part of (channels they belong to + their direct threads), newest activity first. */
export function conversationsFor(i: Inbox, me: string): (Conversation & { last?: Message; unread: number })[] {
  return i.conversations.filter((c) => !c.archived && c.members.includes(me)).map((c) => {
    const msgs = i.messages.filter((m) => m.convId === c.id).sort((a, b) => a.at.localeCompare(b.at));
    const last = msgs[msgs.length - 1];
    const seen = i.read[c.id]?.[me] ?? '';
    return { ...c, last, unread: msgs.filter((m) => m.from !== me && m.at > seen).length };
  }).sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? ''));
}
export const unreadFor = (i: Inbox | null, me: string) => (i ? conversationsFor(i, me).reduce((a, c) => a + c.unread, 0) : 0);
export function markRead(i: Inbox, convId: string, me: string, at: string): Inbox { return { ...i, read: { ...i.read, [convId]: { ...(i.read[convId] ?? {}), [me]: at } } }; }
export function send(i: Inbox, m: Omit<Message, 'id'>): Inbox { return { ...i, messages: [...i.messages, { ...m, id: newId('msg') }] }; }
/** A direct thread between two people – reused when it exists. */
export function directWith(i: Inbox, me: string, other: string): { inbox: Inbox; conv: Conversation } {
  const found = i.conversations.find((c) => c.kind === 'direct' && c.members.length === 2 && c.members.includes(me) && c.members.includes(other));
  if (found) return { inbox: i, conv: found };
  const conv: Conversation = { id: newId('dm'), kind: 'direct', name: '', about: '', members: [me, other], department: '', archived: false };
  return { inbox: { ...i, conversations: [...i.conversations, conv] }, conv };
}
export function newChannel(i: Inbox, name: string, about: string, members: string[], department = ''): { inbox: Inbox; conv: Conversation } {
  const conv: Conversation = { id: newId('ch'), kind: 'channel', name: name.trim(), about: about.trim(), members, department, archived: false };
  return { inbox: { ...i, conversations: [...i.conversations, conv] }, conv };
}
/** @mentions – admin ids named in the text ("@Membership office"). */
export function mentionsIn(text: string, admins: { id: string; name: string }[]): string[] {
  return admins.filter((a) => text.toLowerCase().includes(`@${a.name.toLowerCase()}`)).map((a) => a.id);
}
export function attachmentProblem(f: { type: string; size: number }): string {
  if (!ALLOWED_TYPES.includes(f.type)) return 'Only pictures, PDFs, CSV and text files can be attached.';
  if (f.size > MAX_ATTACHMENT_BYTES) return `Keep attachments under ${Math.round(MAX_ATTACHMENT_BYTES / 1_000_000)} MB.`;
  return '';
}

/** Unread team messages for the sidebar badge (demo: this browser; live: GET /admin/inbox/unread). */
export function useInboxBadge(me: string): number {
  const [n, setN] = useState(0);
  useEffect(() => { const load = () => setN(unreadFor(readInbox(), me)); load(); window.addEventListener(INBOX_EVENT, load); window.addEventListener('storage', load); return () => { window.removeEventListener(INBOX_EVENT, load); window.removeEventListener('storage', load); }; }, [me]);
  return n;
}
