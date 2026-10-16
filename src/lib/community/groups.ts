/**
 * CONTRACT – member groups (admin: Members › Groups). WildApricot groups are manual only; ours can also be
 * automatic (a rule keeps them up to date), have a join policy, leaders who may email the group, and page access.
 * Used by: Communication (audiences), Events (group-only events), website pages (access), reports.
 */
import { z } from 'zod';
import type { EventsDoc } from './events';

export const RULE_FIELDS = ['zone', 'center', 'plan', 'status', 'renewal', 'voting', 'payment', 'age', 'joinedYear'] as const;
export type RuleField = (typeof RULE_FIELDS)[number];
export const RULE_LABEL: Record<RuleField, string> = { zone: 'Zone', center: 'Islamic Center', plan: 'Plan', status: 'Status', renewal: 'Renewal status', voting: 'Can vote this year', payment: 'Last payment method', age: 'Age', joinedYear: 'Year joined' };
/** Numbers can use "at least / at most"; everything else is "is / is not". */
export const NUMERIC_FIELDS: readonly RuleField[] = ['age', 'joinedYear'];
/** Fields whose values are the same for every organization. Zone, center and plan come from the organization (see ruleIssues). */
export const FIXED_VALUES: Partial<Record<RuleField, readonly string[]>> = {
  status: ['pending', 'active', 'life', 'expired', 'resigned', 'expelled'],
  renewal: ['active', 'renewal-due', 'grace', 'overdue', 'lapsed', 'suspended', 'archived', 'moved', 'lifetime', 'never-paid'],
  voting: ['yes', 'no'],
  payment: ['card', 'check', 'cash', 'none'],
};
export const RuleSchema = z.object({
  field: z.enum(RULE_FIELDS),
  op: z.enum(['is', 'isNot', 'atLeast', 'atMost']).default('is'),
  value: z.string().trim().min(1, 'Enter a value').max(80),
}).superRefine((r, ctx) => {
  const numeric = NUMERIC_FIELDS.includes(r.field);
  if (!numeric && (r.op === 'atLeast' || r.op === 'atMost')) ctx.addIssue({ code: 'custom', path: ['op'], message: `"At least / at most" only works with numbers (age, year joined).` });
  if (numeric && !/^\d{1,4}$/.test(r.value.trim())) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a whole number.' });
  const fixed = FIXED_VALUES[r.field];
  if (fixed && !fixed.includes(r.value.trim().toLowerCase())) ctx.addIssue({ code: 'custom', path: ['value'], message: `Use one of: ${fixed.join(', ')}.` });
});
export const GroupSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/, 'Lowercase letters, numbers and dashes'),
  name: z.string().min(2).max(80),
  description: z.string().max(300).default(''),
  kind: z.enum(['manual', 'automatic']),
  rules: z.array(RuleSchema).max(5).default([]),
  match: z.enum(['all', 'any']).default('all'),                                // automatic: all rules, or any one of them
  include: z.array(z.string()).max(500).default([]),                           // automatic: always in (exceptions, by member ID)
  exclude: z.array(z.string()).max(500).default([]),                           // automatic: never in
  memberIds: z.array(z.string()).max(20_000).default([]),                      // manual
  joinPolicy: z.enum(['admins', 'open', 'request']).default('admins'),         // who can add people
  showInProfile: z.boolean().default(false),                                   // members see (and may pick) it on their profile
  leaders: z.array(z.string().email()).max(10).default([]),
  leadersCanEmail: z.boolean().default(false),
  pageAccess: z.boolean().default(false),                                      // can be used to restrict pages and events
  archived: z.boolean().default(false),
}).refine((g) => g.kind !== 'automatic' || g.rules.length > 0, { path: ['rules'], message: 'An automatic group needs at least one rule.' })
  .refine((g) => !g.leadersCanEmail || g.leaders.length > 0, { path: ['leaders'], message: 'Add a leader, or turn off "leaders can email".' })
  .refine((g) => new Set(g.leaders.map((e) => e.toLowerCase())).size === g.leaders.length, { path: ['leaders'], message: 'A leader is listed twice.' })
  .refine((g) => !g.include.some((id) => g.exclude.includes(id)), { path: ['exclude'], message: 'Someone is both always in and never in.' })
  .refine((g) => !(g.kind === 'automatic' && g.showInProfile && g.joinPolicy !== 'admins'), { path: ['showInProfile'], message: 'Members cannot pick an automatic group.' })
  .refine((g) => !(g.kind === 'automatic' && g.joinPolicy !== 'admins'), { path: ['joinPolicy'], message: 'People cannot join an automatic group – its rule decides.' });
export const GroupsSchema = z.object({
  enabled: z.boolean().default(true),
  groups: z.array(GroupSchema).max(300),
}).superRefine((d, ctx) => { const seen = new Set<string>(); d.groups.forEach((g, i) => { if (seen.has(g.id)) ctx.addIssue({ code: 'custom', path: ['groups', i, 'id'], message: `Two groups use the id “${g.id}”.` }); seen.add(g.id); }); });
export type Group = z.infer<typeof GroupSchema>;
export type GroupsDoc = z.infer<typeof GroupsSchema>;
export type Rule = z.infer<typeof RuleSchema>;

/** Facts about one member that rules can test (built by the admin / BE from the member record). */
export type Facts = { id: string; zone: string; center: string; plan: string; status: string; renewal?: string; voting: 'yes' | 'no'; payment: string; age: number; joinedYear: number };
export function ruleMatches(r: Rule, f: Facts) {
  const v = f[r.field]; const want = r.value.trim().toLowerCase();
  if (r.op === 'atLeast' || r.op === 'atMost') { const n = Number(v), w = Number(r.value); if (!Number.isFinite(n) || !Number.isFinite(w)) return false; return r.op === 'atLeast' ? n >= w : n <= w; }
  const eq = String(v).toLowerCase() === want;
  return r.op === 'is' ? eq : !eq;
}
/** Archived member records are never in a group. Automatic: exceptions first, then all / any rules. */
export function inGroup(g: Group, f: Facts) {
  if (f.status === 'archived') return false;
  if (g.kind === 'manual') return g.memberIds.includes(f.id);
  if ((g.exclude ?? []).includes(f.id)) return false;
  if ((g.include ?? []).includes(f.id)) return true;
  return (g.match ?? 'all') === 'any' ? g.rules.some((r) => ruleMatches(r, f)) : g.rules.every((r) => ruleMatches(r, f));
}
export const membersOf = (g: Group, all: Facts[]) => all.filter((f) => inGroup(g, f));

const auto = (id: string, name: string, rules: Rule[], description = '', match: 'all' | 'any' = 'all'): Group => ({ id, name, description, kind: 'automatic', rules, match, include: [], exclude: [], memberIds: [], joinPolicy: 'admins', showInProfile: false, leaders: [], leadersCanEmail: false, pageAccess: true, archived: false });
const manual = (id: string, name: string, description = '', extra: Partial<Group> = {}): Group => ({ id, name, description, kind: 'manual', rules: [], match: 'all', include: [], exclude: [], memberIds: [], joinPolicy: 'admins', showInProfile: false, leaders: [], leadersCanEmail: false, pageAccess: true, archived: false, ...extra });

/** ISGH's groups, rebuilt from the WildApricot groups seen on 14 Oct 2026 – most are now automatic. */
export const mockGroups: GroupsDoc = {
  enabled: true,
  groups: [
    auto('zone-north', 'North zone', [{ field: 'zone', op: 'is', value: 'North' }], 'Everyone whose home address is in the North zone.'),
    auto('zone-northwest', 'Northwest zone', [{ field: 'zone', op: 'is', value: 'Northwest' }]),
    auto('zone-southwest', 'Southwest zone', [{ field: 'zone', op: 'is', value: 'Southwest' }]),
    auto('zone-south', 'South zone', [{ field: 'zone', op: 'is', value: 'South' }]),
    auto('zone-southeast', 'Southeast zone', [{ field: 'zone', op: 'is', value: 'Southeast' }]),
    auto('voting-2026', 'Can vote in 2026', [{ field: 'voting', op: 'is', value: 'yes' }], 'Replaces the hand-made “Voting eligible” lists. Updates itself.'),
    auto('non-voting-2026', 'Non-voting members 2026', [{ field: 'voting', op: 'is', value: 'no' }, { field: 'status', op: 'isNot', value: 'pending' }]),
    auto('paid-by-check', 'Last paid by check', [{ field: 'payment', op: 'is', value: 'check' }], 'Replaces WildApricot’s manual “Check payment pending” list (154 people). “Waiting to clear” comes from the payment itself once the BE records check status.'),
    auto('renewal-due', 'Renewal due or in grace', [{ field: 'renewal', op: 'is', value: 'renewal-due' }, { field: 'renewal', op: 'is', value: 'grace' }], 'Audience for renewal reminders. Updates itself every day.', 'any'),
    auto('youth-18-24', 'Youth (18–24)', [{ field: 'age', op: 'atMost', value: '24' }], 'Used for the youth seat at Champions.'),
    manual('nominees-2026', '2026 nominees', 'Filled by the Election Commission from accepted nominations.', { leaders: ['ecisgh@example.org'], leadersCanEmail: true }),
    manual('elected-2026', '2026 elected officials', 'Board, zone directors and associate directors.'),
    manual('missing-info-2026', 'Missing information 2026', 'Applications that need a document or an answer.', { pageAccess: false }),
    manual('volunteers', 'Volunteers', 'Members who offered to help. Members can join this group from their profile.', { joinPolicy: 'open', showInProfile: true, pageAccess: false }),
    manual('sisters-quran-sw', 'Sisters’ Quran circle (Southwest)', 'Weekly circle at the Southwest center. Ask to join – the circle leader answers.', { joinPolicy: 'request', showInProfile: true, pageAccess: true, leaders: ['quran.sw@example.org'] }),
  ],
};

/* ---------- checks that need the organization's own lists ---------- */
export type RuleChoices = { zone: string[]; center: string[]; plan: string[] };
/**
 * Warnings for values that cannot match anybody here (a typo like "Nort", a center that was renamed, a plan that no
 * longer exists). Not schema errors – the organization's lists live in other documents – but shown before publishing.
 */
export function ruleIssues(g: Group, choices: RuleChoices): { rule: number; message: string }[] {
  if (g.kind !== 'automatic') return [];
  const out: { rule: number; message: string }[] = [];
  g.rules.forEach((r, i) => {
    const list = (choices as Record<string, string[]>)[r.field];
    if (list && !list.some((v) => v.toLowerCase() === r.value.trim().toLowerCase())) out.push({ rule: i, message: `No ${RULE_LABEL[r.field].toLowerCase()} is called "${r.value}". Use one of: ${list.slice(0, 8).join(', ')}${list.length > 8 ? '…' : ''}.` });
  });
  if (g.match === 'all') {
    const isRules = g.rules.filter((r) => r.op === 'is');
    for (const f of RULE_FIELDS) { const vals = new Set(isRules.filter((r) => r.field === f).map((r) => r.value.trim().toLowerCase())); if (vals.size > 1) out.push({ rule: g.rules.findIndex((r) => r.field === f && r.op === 'is'), message: `Nobody can have two different ${RULE_LABEL[f].toLowerCase()} values at once – choose "any rule" or remove one.` }); }
  }
  return out;
}

/* ---------- where a group is used ---------- */
/** Events (and later pages and saved emails) that point at a group. A group in use is archived, not deleted. */
export function groupUsage(id: string, docs: { events?: EventsDoc | null }): string[] {
  return (docs.events?.events ?? []).filter((e) => e.visibility === 'groups' && e.groupIds.includes(id)).map((e) => `Event: ${e.title}`);
}
/** Groups an event points at that do not exist, or are archived, or cannot be used for access. */
export function badEventGroups(groupIds: string[], doc: GroupsDoc): { id: string; why: string }[] {
  return groupIds.flatMap((id) => {
    const g = doc.groups.find((x) => x.id === id);
    if (!g) return [{ id, why: 'no such group' }];
    if (g.archived) return [{ id, why: 'archived' }];
    if (!g.pageAccess) return [{ id, why: '"can limit pages and events" is off' }];
    return [];
  });
}
/** Group IDs that grant access for one member (groups switched on, not archived, allowed for access). */
export function accessGroupIds(doc: GroupsDoc, f: Facts): string[] {
  if (!doc.enabled) return [];
  return doc.groups.filter((g) => !g.archived && g.pageAccess && inGroup(g, f)).map((g) => g.id);
}

/* ---------- what a member can do from their profile ---------- */
export type GroupAction = 'join' | 'request' | 'leave' | null;
/** Only groups shown on the profile; automatic groups follow their rule; "admins" groups are view-only. */
export function memberAction(g: Group, isIn: boolean, requested = false): GroupAction {
  if (g.archived || !g.showInProfile || g.kind === 'automatic') return null;
  if (isIn) return g.joinPolicy === 'admins' ? null : 'leave';
  if (requested) return null;
  return g.joinPolicy === 'open' ? 'join' : g.joinPolicy === 'request' ? 'request' : null;
}
/** Groups a member sees on their profile: the ones they are in (shown on profile) plus ones they may join or ask to join. */
export function profileGroups(doc: GroupsDoc, f: Facts, extraIds: string[] = []) {
  if (!doc.enabled) return [];
  return doc.groups.filter((g) => !g.archived && g.showInProfile).map((g) => {
    const isIn = inGroup(g, f) || extraIds.includes(g.id);
    return { id: g.id, name: g.name, description: g.description, isIn, action: memberAction(g, isIn) };
  }).filter((x) => x.isIn || x.action);
}
