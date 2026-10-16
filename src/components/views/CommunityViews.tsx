'use client';
/**
 * WildApricot-style areas, rebuilt (research: memory/research/wildapricot-options.md):
 *   Events (registration types, guests, waitlist, cancellation, reminders, member/group-only)
 *   Groups (manual or automatic by rule, join policy, leaders, page access) with live member counts
 *   Communication (system emails on/off + text, templates, merge fields with preview, sending, text messages, log)
 *   Configuration (directory, self-service, member card, profile fields, payments, discount codes, security)
 * Every area has an on/off switch or options – nothing is hard-coded.
 */
import { UNROUTED, useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DocEditor, Modal } from '@/components/editor/DocEditor';
import { Panel, SwitchRow, Tabs, countIssues } from '@/components/editor/bits';
import { SchemaForm } from '@/components/forms/SchemaForm';
import { CATEGORY_LABEL, EventSchema, fmtRange, registrationState, spotsLeft, type EventItem, type EventsDoc } from '@/lib/community/events';
import { FIXED_VALUES, GroupSchema, RULE_LABEL, badEventGroups, groupUsage, membersOf, ruleIssues, type Facts, type Group, type GroupsDoc, type RuleChoices } from '@/lib/community/groups';
import { ALWAYS_ON, CommunicationShape, MACROS, SAMPLE_VALUES, SYSTEM_EMAILS, SYSTEM_EMAIL_KEYS, TemplateSchema, contextOf, render, renewalEmailDates, renewalEmailWarnings, type CommunicationDoc, type SystemEmailKey } from '@/lib/community/communication';
import { DEFAULT_LIFECYCLE, type MembershipSettings } from '@/lib/content/membership';
import type { Recipient } from '@/lib/community/campaigns';
import { CampaignsView, fmtWhen, readCampaigns } from './CampaignsView';
import { EventAttendees } from './EventAttendees';
import { useAccess } from '@/lib/access/use-access';
import { OrgConfigShape, PAY_LABEL, codeStatus, payMethods, securityWarnings, type OrgConfig } from '@/lib/community/org-config';
import { buildReceipt, checkoutTotal, invoiceNumber, dueDate } from '@/lib/community/payments';
import { PLANS, STATUS_LABEL, YEAR, ZONES, ageOn, centerOf, eligibility, fullName, lastPayment, membersWithEdits, prefsOf, renewalOf, statusOf, type Member } from '@/lib/members/members';

const NOW = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 16); // Houston local time (CDT/CST close enough for demo)
const chicagoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
/** Read another published document (for cross-checks such as "which events use this group"). */
function useStoreData<T>(key: string): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => { let live = true; void fetch(`/api/store/${key}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live) setV((j?.data ?? null) as T | null); }).catch(() => {}); return () => { live = false; }; }, [key]);
  return v;
}
const uid = (base: string, taken: string[]) => { const s = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'; let id = s, n = 2; while (taken.includes(id)) id = `${s}-${n++}`; return id; };

/* =============================== EVENTS =============================== */
export function EventsView() {
  return (
    <DocEditor<EventsDoc> storeKey="events" title="Events" previewPaths={['/events']}
      intro="Events on the website with registration: types and prices, guests, a waitlist, cancellation rules and reminders. Member-only and group-only events are possible.">
      {(doc) => <EventsBody doc={doc} />}
    </DocEditor>
  );
}
function EventsBody({ doc }: { doc: { draft: EventsDoc; setDraft: (f: (d: EventsDoc) => EventsDoc) => void; issues: Record<string, string> } }) {
  const d = doc.draft; const now = NOW();
  const groupsDoc = useStoreData<GroupsDoc>('groups');
  const access = useAccess();
  const needsApproval = d.approval.required && !!access.role?.centerScoped; // center offices send events for approval
  const [view, setView] = useState<'upcoming' | 'past' | 'drafts'>('upcoming');
  const [open, setOpen] = useState<string | null>(null);
  const mf = useMasjidFilter();
  const set = (fn: (x: EventsDoc) => void) => doc.setDraft((x) => { const c = structuredClone(x); fn(c); return c; });
  const list = d.events.map((e, i) => ({ e, i })).filter(({ e }) => mf.keep('', e.location.center ?? '')).filter(({ e }) => (view === 'drafts' ? e.status === 'draft' : view === 'past' ? e.status !== 'draft' && e.end < now : e.status !== 'draft' && e.end >= now))
    .sort((a, b) => (view === 'past' ? b.e.start.localeCompare(a.e.start) : a.e.start.localeCompare(b.e.start)));
  const add = () => {
    const id = uid('new-event', d.events.map((e) => e.id));
    const home = (mf.masjid && mf.masjid !== UNROUTED ? mf.masjid : '') || (access.role?.centerScoped ? access.me?.centers[0] ?? '' : ''); // the event belongs to the masjid being viewed
    const day = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    set((x) => { x.events.push({ id, title: 'New event', summary: '', category: 'community', status: 'draft', start: `${day}T18:00`, end: `${day}T20:00`, location: { name: home ? home : 'ISGH Main Center', address: '', ...(home ? { center: home } : {}) }, visibility: 'public', groupIds: [],
      registration: { enabled: true, capacity: 0, waitlist: false, guests: { allowed: false, max: 0 }, cancellation: { policy: 'until', daysBefore: 1, refund: 'full', feeCents: 0 }, types: [{ id: 'general', name: 'General admission', priceCents: 0, guestPriceCents: 0, availability: 'everyone', planIds: [], limit: 0, enabled: true }] },
      reminders: [x.defaultReminderDays], registered: 0, waiting: 0, typeCounts: {}, sample: false, approval: { state: 'none', requestedBy: '', by: '', on: '', note: '' }, promotion: { featured: false, email: { audience: 'none', sendOn: '', sent: false }, sms: { enabled: false, sendOn: '' }, social: '' } }); });
    setView('drafts'); setOpen(id);
  };
  return (
    <div className="cv">
      <Panel>
        <SwitchRow id="ev-on" label="Show events on the website" help="Off hides the Events page and all registration." checked={d.enabled} onChange={(v) => set((x) => { x.enabled = v; })} />
        <SwitchRow id="ev-past" label="Show past events" checked={d.showPast} onChange={(v) => set((x) => { x.showPast = v; })} />
      </Panel>
      <div className="cv-bar">
        <div className="seg" role="radiogroup" aria-label="Which events">
          {(['upcoming', 'past', 'drafts'] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}>{v === 'upcoming' ? 'Upcoming' : v === 'past' ? 'Past' : 'Drafts'} <small>{d.events.filter((e) => mf.keep('', e.location.center ?? '')).filter((e) => (v === 'drafts' ? e.status === 'draft' : v === 'past' ? e.status !== 'draft' && e.end < now : e.status !== 'draft' && e.end >= now)).length}</small></button>)}
        </div>
        <MasjidPicker unrouted />
        <button type="button" className="btn primary" onClick={add}>New event</button>
      </div>
      <ul className="cv-list">
        {list.map(({ e, i }) => {
          const st = registrationState(e, now); const left = spotsLeft(e);
          const bad = countIssues(doc.issues, [`events.${i}`]);
          return (
            <li key={e.id} className={`cv-item${open === e.id ? ' open' : ''}${bad ? ' has-err' : ''}`} data-event={e.id}>
              <button type="button" className="cv-row" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                <span className="cv-date">{fmtRange(e)}</span>
                <b>{e.title}</b>
                <span className="cv-meta">{CATEGORY_LABEL[e.category]} · {e.location.center ?? e.location.name} · {e.visibility === 'public' ? 'Everyone' : e.visibility === 'members' ? 'Members only' : 'Groups only'}</span>
                <span className={`pill ${e.status === 'published' ? 'good' : e.status === 'cancelled' ? 'bad' : ''}`}>{e.status === 'published' ? 'Published' : e.status === 'cancelled' ? 'Cancelled' : 'Draft'}</span>
                {e.approval.state === 'pending' && <span className="pill warn">Waiting for approval</span>}
                {e.approval.state === 'changes' && <span className="pill bad">Changes asked</span>}
                {e.registration.enabled && <span className="cv-count">{e.registered}{e.registration.capacity ? ` / ${e.registration.capacity}` : ''} registered{e.waiting ? ` · ${e.waiting} waiting` : ''}</span>}
                {bad > 0 && <span className="sf-badge">{bad}</span>}
              </button>
              {open === e.id && (
                <div className="cv-edit">
                  <div className="row-actions">
                    {e.status !== 'published' && (needsApproval
                      ? (e.approval.state === 'pending' ? <span className="muted">Sent for approval – the organization decides.</span> : <button type="button" className="btn sm primary" onClick={() => set((x) => { x.events[i].approval = { state: 'pending', requestedBy: access.me?.name ?? '', by: '', on: new Date().toISOString().slice(0, 10), note: '' }; })}>Send for approval</button>)
                      : <button type="button" className="btn sm primary" onClick={() => set((x) => { x.events[i].status = 'published'; if (x.events[i].approval.state === 'pending') x.events[i].approval = { ...x.events[i].approval, state: 'approved', by: access.me?.name ?? '', on: new Date().toISOString().slice(0, 10) }; })}>Publish on the website</button>)}
                    {e.approval.state === 'changes' && <span className="pill bad" title={e.approval.note}>Changes asked: {e.approval.note}</span>}
                    {e.status === 'published' && <button type="button" className="btn sm" onClick={() => set((x) => { x.events[i].status = 'draft'; })}>Back to draft</button>}
                    {e.status !== 'cancelled' && <button type="button" className="btn sm" onClick={() => set((x) => { x.events[i].status = 'cancelled'; })}>Cancel event</button>}
                    <button type="button" className="btn sm" onClick={() => set((x) => { const c = structuredClone(x.events[i]); c.id = uid(`${c.id}-copy`, x.events.map((y) => y.id)); c.title += ' (copy)'; c.status = 'draft'; c.approval = { state: 'none', requestedBy: '', by: '', on: '', note: '' }; c.registered = 0; c.waiting = 0; c.typeCounts = {}; c.sample = false; x.events.splice(i + 1, 0, c); })}>Duplicate</button>
                    <button type="button" className="btn sm danger-ghost" onClick={() => { set((x) => { x.events.splice(i, 1); }); setOpen(null); }}>Delete</button>
                  </div>
                  <p className="cv-state" role="status">
                    {e.registration.enabled ? (st.open ? (st.waitlist ? `Full – new registrations join the waitlist.` : `Registration is open${left !== Infinity ? ` – ${left} spots left` : ''}.`) : st.reason) : 'No registration – just come.'}
                    {' '}· Page: <code>/events/{e.id}</code>
                  </p>
                  {e.visibility === 'groups' && groupsDoc && badEventGroups(e.groupIds, groupsDoc).length > 0 && (
                    <p className="notice warn-note ev-group-warn" role="alert">Check the groups: {badEventGroups(e.groupIds, groupsDoc).map((b) => `${b.id} (${b.why})`).join(', ')}. Nobody in those can see this event.</p>
                  )}
                  {e.registration.enabled && e.status !== 'draft' && <EventAttendees e={e} now={now} />}
                  <SchemaForm schema={EventSchema} value={e} path={['events', i]} issues={doc.issues} omit={['approval', 'promotion']} onChange={(v) => set((x) => { x.events[i] = v as EventItem; })} />
                </div>
              )}
            </li>
          );
        })}
        {!list.length && <li className="cv-empty">No {view === 'drafts' ? 'drafts' : `${view} events`}. <button type="button" className="linkish" onClick={add}>Create one</button></li>}
      </ul>
    </div>
  );
}

/* =============================== GROUPS =============================== */
export const factsOf = (m: Member): Facts => ({
  id: m.id, zone: ZONES[m.zone], center: centerOf(m), plan: PLANS[m.plan].name, status: statusOf(m),
  voting: eligibility(m).eligible ? 'yes' : 'no', payment: lastPayment(m)?.method ?? 'none', age: ageOn(m.dob, `${YEAR}-06-30`), joinedYear: m.joined,
  renewal: m.archived ? 'archived' : renewalOf(m, chicagoToday()).status,
});
export function GroupsView() {
  return (
    <DocEditor<GroupsDoc> storeKey="groups" title="Groups" preview={false}
      intro="Committees, centers, nominees, volunteers… A manual group is kept by admins; an automatic group keeps itself up to date from a rule. Groups are audiences for emails and can limit pages and events.">
      {(doc) => <GroupsBody doc={doc} />}
    </DocEditor>
  );
}
function GroupsBody({ doc }: { doc: { draft: GroupsDoc; setDraft: (f: (d: GroupsDoc) => GroupsDoc) => void; issues: Record<string, string> } }) {
  const d = doc.draft;
  const members = useMemo(() => membersWithEdits(), []);
  const facts = useMemo(() => members.map(factsOf), [members]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [find, setFind] = useState('');
  const events = useStoreData<EventsDoc>('events');
  const choices: RuleChoices = useMemo(() => ({ zone: Object.values(ZONES), center: Array.from(new Set(members.map(centerOf))).sort(), plan: Object.values(PLANS).map((p) => p.name) }), [members]);
  const set = (fn: (x: GroupsDoc) => void) => doc.setDraft((x) => { const c = structuredClone(x); fn(c); return c; });
  const mf = useMasjidFilter();
  const inView = useMemo(() => new Set(members.filter((m) => mf.keep(m.zone, centerOf(m), m.zip)).map((m) => m.id)), [members, mf.zone, mf.masjid, mf.access.ready, mf.access.me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = d.groups.map((g, i) => ({ g, i, n: membersOf(g, facts).filter((f) => inView.has(f.id)).length })).filter(({ g, n }) => (!mf.narrowed || n > 0) && (!q || `${g.name} ${g.description}`.toLowerCase().includes(q.toLowerCase())));
  const add = (kind: Group['kind']) => {
    const id = uid(kind === 'manual' ? 'new-group' : 'new-automatic-group', d.groups.map((g) => g.id));
    set((x) => { x.groups.unshift({ id, name: kind === 'manual' ? 'New group' : 'New automatic group', description: '', kind, rules: kind === 'automatic' ? [{ field: 'zone', op: 'is', value: 'North' }] : [], match: 'all', include: [], exclude: [], memberIds: [], joinPolicy: 'admins', showInProfile: false, leaders: [], leadersCanEmail: false, pageAccess: true, archived: false }); });
    setOpen(id);
  };
  return (
    <div className="cv">
      <Panel><SwitchRow id="gr-on" label="Use groups" help="Off hides groups from emails, events and pages (the groups are kept)." checked={d.enabled} onChange={(v) => set((x) => { x.enabled = v; })} /></Panel>
      <div className="cv-bar">
        <label className="sr-only" htmlFor="gr-q">Find a group</label>
        <input id="gr-q" className="in" type="search" placeholder="Find a group" value={q} onChange={(e) => setQ(e.target.value)} />
        <MasjidPicker />
        <button type="button" className="btn" onClick={() => add('automatic')}>New automatic group</button>
        <button type="button" className="btn primary" onClick={() => add('manual')}>New group</button>
      </div>
      <ul className="cv-list">
        {shown.map(({ g, i, n }) => {
          const bad = countIssues(doc.issues, [`groups.${i}`]);
          const people = membersOf(g, facts).filter((f) => inView.has(f.id)).slice(0, 8).map((f) => byId.get(f.id)!).filter(Boolean);
          const warns = ruleIssues(g, choices).map((w) => w.message);
          const empty = g.kind === 'automatic' && !bad && !warns.length && n === 0 && !g.archived;
          const used = groupUsage(g.id, { events });
          return (
            <li key={g.id} className={`cv-item${open === g.id ? ' open' : ''}${g.archived ? ' off' : ''}${bad ? ' has-err' : ''}`} data-group={g.id}>
              <button type="button" className="cv-row" aria-expanded={open === g.id} onClick={() => setOpen(open === g.id ? null : g.id)}>
                <b>{g.name}</b>
                <span className="cv-meta">{g.kind === 'automatic' ? `Automatic: ${g.rules.map((r) => `${RULE_LABEL[r.field]} ${r.op === 'is' ? '=' : r.op === 'isNot' ? '≠' : r.op === 'atLeast' ? '≥' : '≤'} ${r.value}`).join(g.match === 'any' ? ' or ' : ' and ')}${(g.include ?? []).length || (g.exclude ?? []).length ? ` (+${(g.include ?? []).length} / −${(g.exclude ?? []).length} exceptions)` : ''}` : g.joinPolicy === 'open' ? 'Members can join' : g.joinPolicy === 'request' ? 'Members can ask to join' : 'Kept by admins'}</span>
                <span className="cv-count" data-count={n}>{n.toLocaleString('en-US')} members{mf.narrowed ? ' here' : ''}</span>
                {g.archived && <span className="pill">Archived</span>}
                {warns.length > 0 && <span className="pill warn" title={warns.join(' ')}>Check rule</span>}
                {bad > 0 && <span className="sf-badge">{bad}</span>}
              </button>
              {open === g.id && (
                <div className="cv-edit">
                  {warns.length > 0 && <ul className="notice warn-note gr-warns" role="alert">{warns.map((w, k) => <li key={k}>{w}</li>)}</ul>}
                  {empty && <p className="muted gr-empty">Nobody matches today. That can be right (for example nobody is in grace yet) – the group fills itself when people match.</p>}
                  <div className="cv-people">
                    <p className="sf-label">{n ? `First ${people.length} of ${n}` : 'Nobody yet'}</p>
                    <ul>{people.map((m) => <li key={m.id}><Link href={`/members/${m.id}`}>{fullName(m)}</Link><small>{centerOf(m)} · {STATUS_LABEL[statusOf(m)]}</small>
                      {g.kind === 'manual' && <button type="button" className="linkish" onClick={() => set((x) => { x.groups[i].memberIds = x.groups[i].memberIds.filter((id) => id !== m.id); })}>Remove<span className="sr-only"> {fullName(m)}</span></button>}</li>)}</ul>
                    {g.kind === 'automatic' && people.length > 0 && (
                      <ul className="gr-except">{people.map((m) => <li key={m.id}><button type="button" className="linkish" onClick={() => set((x) => { x.groups[i].exclude = [...(x.groups[i].exclude ?? []), m.id]; })}>Leave out {fullName(m)}</button></li>)}</ul>
                    )}
                    {g.kind === 'manual' && (
                      <div className="cv-find">
                        <label className="sr-only" htmlFor={`gf-${g.id}`}>Add a member by name or ID</label>
                        <input id={`gf-${g.id}`} className="in" placeholder="Add a member – type a name or member ID" value={find} onChange={(e) => setFind(e.target.value)} />
                        {find.trim().length > 1 && (
                          <ul className="cv-hits">{members.filter((m) => !g.memberIds.includes(m.id) && `${fullName(m)} ${m.id}`.toLowerCase().includes(find.trim().toLowerCase())).slice(0, 6).map((m) => (
                            <li key={m.id}><button type="button" onClick={() => { set((x) => { x.groups[i].memberIds.push(m.id); }); setFind(''); }}>{fullName(m)} <small>{m.id} · {centerOf(m)}</small></button></li>
                          ))}</ul>
                        )}
                      </div>
                    )}
                    <div className="row-actions">
                      <Link className="btn sm" href="/communication?tab=templates">Email this group</Link>
                      <button type="button" className="btn sm" onClick={() => set((x) => { x.groups[i].archived = !x.groups[i].archived; })}>{g.archived ? 'Bring back' : 'Archive'}</button>
                      <button type="button" className="btn sm danger-ghost" disabled={used.length > 0} title={used.length ? 'Used elsewhere – archive it instead' : undefined} onClick={() => { set((x) => { x.groups.splice(i, 1); }); setOpen(null); }}>Delete group</button>
                    </div>
                    {used.length > 0 && <p className="sf-hint gr-used">In use – archive instead of deleting. {used.join(' · ')}</p>}
                  </div>
                  <SchemaForm schema={GroupSchema} value={g} path={['groups', i]} issues={doc.issues} onChange={(v) => set((x) => { x.groups[i] = v as Group; })} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="sf-hint">Rule values: Zone ({choices.zone.join(', ')}), Islamic Center (its name), Plan ({choices.plan.join(', ')}), Status ({FIXED_VALUES.status!.join(', ')}), Renewal status ({FIXED_VALUES.renewal!.join(', ')}), Can vote (yes / no), Last payment ({FIXED_VALUES.payment!.join(', ')}), Age and Year joined (numbers, with at least / at most). Archived members are never in a group.</p>
    </div>
  );
}

/* =============================== COMMUNICATION =============================== */
const LOG = [
  { at: '10/14/2026 9:02 AM', what: 'Renewal reminder 1', kind: 'auto' as const, to: '1,840 members', ok: '1,812 delivered · 61% opened', tone: 'good' },
  { at: '10/13/2026 6:15 PM', what: 'Membership active', kind: 'auto' as const, to: 'Amina Khan', ok: 'Opened', tone: 'good' },
  { at: '10/12/2026 11:40 AM', what: 'Monthly newsletter (October)', kind: 'staff' as const, to: 'Can vote in 2026 · 4,102', ok: '4,066 delivered · 48% opened', tone: 'good' },
  { at: '10/12/2026 8:00 AM', what: 'Event reminder – Weekend school open house', kind: 'auto' as const, to: '96 registrants', ok: '96 delivered', tone: 'good' },
  { at: '10/11/2026 3:22 PM', what: 'Automatic renewal failed', kind: 'auto' as const, to: 'Yusuf Rahman', ok: 'Bounced – mailbox full', tone: 'bad' },
  { at: '10/10/2026 10:05 AM', what: 'Application received', kind: 'auto' as const, to: 'Fatima Siddiqui', ok: 'Delivered', tone: 'good' },
];
/** Tabs in the order staff use them: send (most often) → automatic emails → templates → delivery log → settings (set once). */
const COMM_TABS: Record<string, { intro: string; scope?: string[]; actions: boolean }> = {
  send: { intro: 'Emails and texts you send to members – drafts, scheduled and sent. Members choose which kinds they get; membership and election notices always go.', actions: false },
  system: { intro: 'Emails that go out by themselves (applications, renewals, payments, events, giving). Turn each on or off and reword it. Merge fields like {Member.FirstName} fill in each person’s details.', scope: ['system'], actions: true },
  templates: { intro: 'Saved starting points for announcements and newsletters. Pick one in Messages › New message.', scope: ['templates'], actions: true },
  log: { intro: 'Every email and text that went out – automatic and sent by staff – with the delivery result.', actions: false },
  sending: { intro: 'Set once: who emails come from, the footer every bulk email needs, text messages and tracking.', scope: ['sender', 'tracking', 'sms', 'groupEmailsByLeaders'], actions: true },
};
function useTabParam(first: string) {
  const read = () => { const t = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('tab'); return t && t in COMM_TABS ? t : first; };
  const [t, setT] = useState(first);
  useEffect(() => { const on = () => setT(read()); on(); window.addEventListener('isgh:tab', on); window.addEventListener('popstate', on); return () => { window.removeEventListener('isgh:tab', on); window.removeEventListener('popstate', on); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return t;
}
export function CommunicationView() {
  const tab = useTabParam('send');
  const cfg = COMM_TABS[tab];
  return (
    <DocEditor<CommunicationDoc> storeKey="communication" title="Communication" preview={false} intro={cfg.intro} scope={cfg.scope} actions={cfg.actions}>
      {(doc) => (
        <Tabs label="Communication" tabs={[
          { id: 'send', label: 'Messages', render: () => <SendTab comm={doc.draft} /> },
          { id: 'system', label: 'Automatic emails', badge: countIssues(doc.issues, ['system']), render: () => <SystemEmails doc={doc} /> },
          { id: 'templates', label: 'Templates', badge: countIssues(doc.issues, ['templates']), render: () => <Templates doc={doc} /> },
          { id: 'log', label: 'Delivery log', render: () => <DeliveryLog /> },
          { id: 'sending', label: 'Settings', badge: countIssues(doc.issues, ['sender', 'tracking', 'sms']), render: () => (
            <Panel intro="These apply to every email and text. Changes go live when you publish.">
              <SchemaForm schema={CommunicationShape} value={doc.draft} issues={doc.issues} onChange={(v) => doc.setDraft(v as CommunicationDoc)} only={['sender', 'sms', 'tracking', 'groupEmailsByLeaders']} />
            </Panel>
          ) },
        ]} />
      )}
    </DocEditor>
  );
}
/** One log for everything that went out: staff messages from this browser (demo) + sample automatic sends. */
function DeliveryLog() {
  const [kind, setKind] = useState<'all' | 'auto' | 'staff'>('all');
  const sent = useMemo(() => readCampaigns().filter((x) => x.status === 'sent' || x.status === 'scheduled'), []);
  const rows = [
    ...sent.map((x) => ({ at: x.updatedAt ? fmtWhen(x.updatedAt) : '', what: x.name, kind: 'staff' as const, to: `${x.sentTo.toLocaleString('en-US')} people`, ok: x.status === 'scheduled' ? `Scheduled ${x.sendAt ? fmtWhen(x.sendAt) : ''}` : 'Demo – not really sent', tone: x.status === 'scheduled' ? 'warn' : 'good' })),
    ...LOG,
  ].filter((r) => kind === 'all' || r.kind === kind);
  return (
    <Panel intro="Demo: sample sends. With the BE every message is logged with delivery, opens and clicks (if tracking is on).">
      <div className="cmp-filters" role="tablist" aria-label="Show">
        {(['all', 'auto', 'staff'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} className="cmp-filter" onClick={() => setKind(k)}>{k === 'all' ? 'Everything' : k === 'auto' ? 'Automatic emails' : 'Sent by staff'}</button>)}
      </div>
      <div className="table-wrap"><table className="t-plain"><thead><tr><th>When</th><th>Email or text</th><th>To</th><th>Result</th></tr></thead>
        <tbody>{rows.map((l, i) => <tr key={l.at + l.what + i}><td>{l.at}</td><td>{l.what}<small className="block">{l.kind === 'auto' ? 'Automatic' : 'Sent by staff'}</small></td><td>{l.to}</td><td><span className={`pill ${l.tone}`}>{l.ok}</span></td></tr>)}</tbody></table></div>
    </Panel>
  );
}
/** Communication › Send a message: members as recipients (email, mobile, choices, group facts). */
function SendTab({ comm }: { comm: CommunicationDoc }) {
  const people = useMemo<Recipient[]>(() => membersWithEdits().map((m) => ({ id: m.id, name: fullName(m), email: m.email, phone: m.phone, archived: !!m.archived, prefs: prefsOf(m), facts: factsOf(m) })), []);
  return <CampaignsView comm={comm} people={people} now={NOW()} />;
}
/** Which renewal email goes out when, from Membership › Renewals and reminders – and what is missing. */
function RenewalMailPlan({ comm }: { comm: CommunicationDoc }) {
  const ms = useStoreData<MembershipSettings>('membership-settings');
  const lc = ms?.lifecycle ?? DEFAULT_LIFECYCLE;
  const paidThrough = `${new Date().getFullYear()}-12-31`;
  const rows = renewalEmailDates(lc, comm, paidThrough);
  const warns = renewalEmailWarnings(lc, comm);
  return (
    <div className="ren-mail-plan"><h3>When they go out</h3><p className="sf-hint">Follows Membership › Renewals and reminders. Example: a member whose membership is paid through {paidThrough.slice(5, 7)}/{paidThrough.slice(8)}/{paidThrough.slice(0, 4)}.</p>
      <ol className="ren-mail">{rows.map((r, i) => <li key={i} className={r.enabled ? '' : 'off'} data-key={r.key}><time dateTime={r.on}>{r.onText}</time><span><b>{r.label}</b> <small>{r.why}</small></span><em>{r.enabled ? 'On' : 'Off'}</em></li>)}</ol>
      {warns.length > 0 && <ul className="notice warn-note ren-mail-warn" role="alert">{warns.map((w, i) => <li key={i}>{w}</li>)}</ul>}
    </div>
  );
}
type CDoc = { draft: CommunicationDoc; setDraft: (f: CommunicationDoc | ((d: CommunicationDoc) => CommunicationDoc)) => void; issues: Record<string, string> };
function MacroBar({ onInsert, only }: { onInsert: (m: string) => void; only?: string[] }) {
  return <div className="cv-macros" aria-label="Insert a merge field">{MACROS.filter((m) => !only || only.includes(m.key.split('.')[0])).map((m) => <button key={m.key} type="button" className="chip-btn" onClick={() => onInsert(`{${m.key}}`)} title={`{${m.key}}`}>{m.label}</button>)}</div>;
}
function Preview({ subject, body }: { subject: string; body: string }) {
  return (
    <div className="cv-preview" aria-label="Preview with a sample member">
      <p className="cv-pv-sub"><small>Subject</small>{render(subject, SAMPLE_VALUES)}</p>
      <div className="cv-pv-body">{render(body, SAMPLE_VALUES).split('\n').map((l, i) => <p key={i}>{l || ' '}</p>)}</div>
    </div>
  );
}
function SystemEmails({ doc }: { doc: CDoc }) {
  const [open, setOpen] = useState<SystemEmailKey | null>(null);
  const groups = Array.from(new Set(SYSTEM_EMAIL_KEYS.map((k) => SYSTEM_EMAILS[k].group)));
  const set = (k: SystemEmailKey, patch: Partial<CommunicationDoc['system'][string]>) => doc.setDraft((d) => ({ ...d, system: { ...d.system, [k]: { ...d.system[k], ...patch } } }));
  return (
    <div className="cv">
      <p className="cv-summary">{SYSTEM_EMAIL_KEYS.filter((k) => doc.draft.system[k]?.enabled).length} of {SYSTEM_EMAIL_KEYS.length} automatic emails are on. Open one to change its words; the preview fills in a sample member.</p>
      {groups.map((g) => (
        <Panel key={g} title={g}>
          <ul className="cv-list flat">
            {SYSTEM_EMAIL_KEYS.filter((k) => SYSTEM_EMAILS[k].group === g).map((k) => {
              const e = doc.draft.system[k]; if (!e) return null;
              const bad = countIssues(doc.issues, [`system.${k}`]);
              return (
                <li key={k} className={`cv-item${open === k ? ' open' : ''}${e.enabled ? '' : ' off'}${bad ? ' has-err' : ''}`} data-email={k}>
                  <div className="cv-row static">
                    <label className="switch" title={ALWAYS_ON.includes(k) ? 'Always sent – people need it as a record' : undefined}><input type="checkbox" role="switch" checked={e.enabled} disabled={ALWAYS_ON.includes(k) && e.enabled} onChange={(ev) => set(k, { enabled: ev.target.checked })} aria-label={`Send “${SYSTEM_EMAILS[k].label}”`} /><span className="track" aria-hidden="true"><span className="thumb" /></span></label>
                    <b>{SYSTEM_EMAILS[k].label}</b><span className="cv-meta">{SYSTEM_EMAILS[k].when}</span>
                    <button type="button" className="linkish" aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}>{open === k ? 'Close' : 'Edit'}<span className="sr-only"> {SYSTEM_EMAILS[k].label}</span></button>
                    {bad > 0 && <span className="sf-badge">{bad}</span>}
                  </div>
                  {open === k && (
                    <div className="cv-edit two">
                      <div className="sf">
                        <div className="sf-field"><label className="sf-label" htmlFor={`se-s-${k}`}>Subject</label><input id={`se-s-${k}`} className="in" value={e.subject} maxLength={150} onChange={(ev) => set(k, { subject: ev.target.value })} />{doc.issues[`system.${k}.subject`] && <p className="sf-err">{doc.issues[`system.${k}.subject`]}</p>}</div>
                        <div className="sf-field"><label className="sf-label" htmlFor={`se-b-${k}`}>Message</label>
                          <textarea id={`se-b-${k}`} className="in in-area" rows={7} value={e.body} onChange={(ev) => set(k, { body: ev.target.value })} />
                          {doc.issues[`system.${k}.body`] && <p className="sf-err">{doc.issues[`system.${k}.body`]}</p>}
                          <MacroBar only={contextOf(k)} onInsert={(m) => set(k, { body: `${e.body}${e.body.endsWith(' ') || !e.body ? '' : ' '}${m}` })} /></div>
                        <div className="sf-field"><label className="sf-label" htmlFor={`se-t-${k}`}>Send to</label>
                          <select id={`se-t-${k}`} className="in" value={e.to} onChange={(ev) => set(k, { to: ev.target.value as typeof e.to })}><option value="member">The member</option><option value="member-and-admins">The member and the admins</option><option value="admins">Admins only</option></select>{doc.issues[`system.${k}.to`] && <p className="sf-err">{doc.issues[`system.${k}.to`]}</p>}</div>
                      </div>
                      <Preview subject={e.subject} body={e.body} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {g === 'Renewals' && <RenewalMailPlan comm={doc.draft} />}
        </Panel>
      ))}
    </div>
  );
}
function Templates({ doc }: { doc: CDoc }) {
  const [open, setOpen] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = doc.draft.templates.map((t, i) => ({ t, i })).filter(({ t }) => showArchived || !t.archived);
  const setT = (i: number, v: CommunicationDoc['templates'][number]) => doc.setDraft((d) => { const c = structuredClone(d); c.templates[i] = v; return c; });
  return (
    <div className="cv">
      <div className="cv-bar">
        <SwitchRow id="tp-arch" label="Show archived templates" checked={showArchived} onChange={setShowArchived} />
        <button type="button" className="btn primary" onClick={() => { doc.setDraft((d) => ({ ...d, templates: [{ id: uid('new-template', d.templates.map((x) => x.id)), name: 'New template', category: 'announcement', subject: 'Message from {Org.ShortName}', body: 'Assalamu alaikum {Member.FirstName},\n\n', archived: false }, ...d.templates] })); setOpen(0); }}>New template</button>
      </div>
      <ul className="cv-list">
        {list.map(({ t, i }) => (
          <li key={t.id} className={`cv-item${open === i ? ' open' : ''}${t.archived ? ' off' : ''}`}>
            <button type="button" className="cv-row" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <b>{t.name}</b><span className="cv-meta">{t.category} · {render(t.subject, SAMPLE_VALUES)}</span>{t.archived && <span className="pill">Archived</span>}
            </button>
            {open === i && (
              <div className="cv-edit two">
                <div>
                  <SchemaForm schema={TemplateSchema} value={t} path={['templates', i]} issues={doc.issues} onChange={(v) => setT(i, v as typeof t)} />
                  <MacroBar only={['Member', 'Org', 'Link']} onInsert={(m) => setT(i, { ...t, body: `${t.body}${m}` })} />
                  <div className="row-actions"><button type="button" className="btn sm danger-ghost" onClick={() => { doc.setDraft((d) => ({ ...d, templates: d.templates.filter((_, j) => j !== i) })); setOpen(null); }}>Delete template</button></div>
                </div>
                <Preview subject={t.subject} body={t.body} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* =============================== CONFIGURATION =============================== */
const M = OrgConfigShape.shape.members;
export function ConfigurationView() {
  return (
    <DocEditor<OrgConfig> storeKey="org-config" title="Configuration" previewPaths={['/membership/join']}
      intro="How membership works day to day: member directory, what members can do themselves, the member card, extra profile fields, ways to pay, discount codes and security.">
      {(doc) => {
        const sub = (key: 'members', only: string[]) => <SchemaForm schema={M} value={doc.draft.members} path={[key]} issues={doc.issues} only={only} onChange={(v) => doc.setDraft((d) => ({ ...d, members: v as OrgConfig['members'] }))} />;
        const top = (only: string[]) => <SchemaForm schema={OrgConfigShape} value={doc.draft} issues={doc.issues} only={only} onChange={(v) => doc.setDraft(v as OrgConfig)} />;
        return (
          <Tabs label="Configuration" tabs={[
            { id: 'members', label: 'Members', badge: countIssues(doc.issues, ['members.directory', 'members.selfService', 'members.card', 'members.duplicateCheck']), render: () => <Panel intro="The directory is off by default – turn it on when the Board agrees. Members always choose whether they appear.">{sub('members', ['directory', 'selfService', 'card', 'duplicateCheck'])}</Panel> },
            { id: 'fields', label: 'Profile fields', badge: countIssues(doc.issues, ['members.fields']), render: () => <Panel intro="Extra fields on the member record. “Admins only” fields are never shown to members (like ISGH’s Entered by, Payment processed, Follow up).">{sub('members', ['fields'])}</Panel> },
            { id: 'payments', label: 'Payments', badge: countIssues(doc.issues, ['payments']), render: () => <Panel intro={<>Turned on now: {payMethods(doc.draft).map((m) => PAY_LABEL[m]).join(', ') || 'none'}.</>}>{top(['payments'])}<ReceiptPreview cfg={doc.draft} /></Panel> },
            { id: 'discounts', label: 'Discount codes', badge: countIssues(doc.issues, ['discounts']), render: () => <Panel intro="Codes for membership or events, e.g. free first year for new Muslims. Off by default."><CodeStatus cfg={doc.draft} />{top(['discounts'])}</Panel> },
            { id: 'security', label: 'Security', badge: countIssues(doc.issues, ['security', 'startPage']), render: () => <Panel intro="Photo ID files are always private (never a public link) and deleted after the time you set.">{securityWarnings(doc.draft).length > 0 && <ul className="notice warn-note sec-warns" role="alert">{securityWarnings(doc.draft).map((w, i) => <li key={i}>{w}</li>)}</ul>}{top(['security', 'startPage'])}</Panel> },
          ]} />
        );
      }}
    </DocEditor>
  );
}

/* =============================== RENEWALS (inside Membership) =============================== */
export function UseIsghLevels({ onUse }: { onUse: () => void }) {
  const [ask, setAsk] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setAsk(true)}>Use ISGH’s current levels (WildApricot)</button>
      {ask && (
        <Modal title="Load ISGH’s current levels?" onClose={() => setAsk(false)}>
          <p>This puts the 7 levels ISGH uses in WildApricot today into the draft: Individual $20, Family $75 (3 years $180, 5 years $285), Lifetime $1,000 / $1,500, Check-o-matic and Unverified – all renewing on December 15.</p>
          <p>Nothing is published until you press Publish. You can still change everything.</p>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setAsk(false)}>Keep my plans</button><button type="button" className="btn primary" onClick={() => { onUse(); setAsk(false); }}>Load into the draft</button></div>
        </Modal>
      )}
    </>
  );
}

/** Configuration › Payments: what a member's receipt looks like with these settings (dues not deductible, gifts are). */
function ReceiptPreview({ cfg }: { cfg: OrgConfig }) {
  const today = chicagoToday();
  const co = checkoutTotal(cfg, { label: 'Family membership 2027', kind: 'dues', priceCents: 4000, method: 'card', coverFees: cfg.payments.coverFees.enabled, today });
  const r = buildReceipt(cfg, { name: 'Islamic Society of Greater Houston' }, { number: invoiceNumber(cfg.payments.invoicePrefix, Number(today.slice(0, 4)), 42), date: today, payer: 'Aisha Rahman', method: 'card', lines: co.lines });
  const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return (
    <section className="rcpt glass-pane" aria-label="Sample receipt">
      <h3>Sample receipt</h3>
      <p className="muted">{r.number} · {today.slice(5, 7)}/{today.slice(8)}/{today.slice(0, 4)} · {r.payer} · {r.method}</p>
      <table className="t-plain"><tbody>{r.lines.map((l, i) => <tr key={i}><td>{l.label}{l.deductible && <small className="block">tax-deductible gift</small>}</td><td className="num">{usd(l.cents)}</td></tr>)}
        <tr className="rcpt-total"><td>Total paid</td><td className="num">{usd(r.totalCents)}</td></tr></tbody></table>
      <ul className="rcpt-notes">{r.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
      {cfg.payments.payLater && <p className="muted">Pay-later invoices are due {cfg.payments.payLaterDays} days after they are sent (an invoice sent today is due {(() => { const d = dueDate(cfg, today); return `${d.slice(5, 7)}/${d.slice(8)}/${d.slice(0, 4)}`; })()}).</p>}
    </section>
  );
}
/** Configuration › Discount codes: where each code stands today. */
function CodeStatus({ cfg }: { cfg: OrgConfig }) {
  const today = chicagoToday();
  if (!cfg.discounts.codes.length) return null;
  const label = { active: 'Active', off: 'Off', scheduled: 'Starts later', expired: 'Expired', 'used-up': 'Used up' } as const;
  return (
    <ul className="code-status" aria-label="Codes today">{cfg.discounts.codes.map((d) => { const st = codeStatus(d, today); return (
      <li key={d.code} data-code={d.code}><code>{d.code}</code> <span className={`pill ${st === 'active' ? 'good' : st === 'off' ? '' : 'warn'}`}>{cfg.discounts.enabled ? label[st] : 'Codes are off'}</span> <small>{d.kind === 'percent' ? `${d.value}% off` : `$${d.value.toFixed(2)} off`}{d.maxUses ? ` · ${d.used} of ${d.maxUses} used` : ` · used ${d.used} times`}{d.oncePerPerson ? ' · once per person' : ''}</small></li>
    ); })}</ul>
  );
}
