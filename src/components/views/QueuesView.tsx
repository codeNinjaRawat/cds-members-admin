'use client';
/**
 * A4 Work queues – one inbox for the five kinds of cases staff decide (see memory/research/A4-work-queues.md).
 * List on the left, the case on the right with the rule it is judged by; decisions apply at once with Undo.
 * Arrow keys or J/K move through the list. DEMO: decisions saved in this browser + member audit log.
 */
import { useMembershipSettings } from '@/lib/members/use-settings';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  approvalBlockers, centerOf, cityLine, demoMembers, membersWithEdits, planDef, refreshLive, fmtDate, fmtMoney, fullName, initials, PLANS, restoreMemberEdit, saveMember, snapshotMemberEdit, YEAR, ZONES, type Member, ORG_TZ } from '@/lib/members/members';
import {
  applyQueueSettings, assigneeOf, buildCases, daysWaiting, escalation, isOpen, MISSING_LABEL, QUEUES, QUEUES_EVENT, queueMe, readQueueState, rulesFor, setQueueMe, sla, TODAY, writeQueueState,
  type Case, type Decision, type QueueId, type QueueState,
} from '@/lib/queues/queues';
import { useMembers } from './MembersView';
import { LIVE, be } from '@/lib/live/live';
import { useWorkSettings } from '@/lib/work/work-store';
import type { AdminLike } from '@/lib/community/work';
import { useOrg } from './TeamViews';
import { applyCenterRules, CENTER_RULES, centerDeadline, buildLiveCases, setDuplicateCounter } from '@/lib/queues/queues';

type Filter = 'open' | 'mine' | 'overdue' | 'done';
type Ask = null | { kind: 'decline' | 'info' | 'board'; caseIds?: string[] };
type Undo = { text: string; caseIds: string[]; prev: Record<string, Decision | undefined>; members: Record<string, ReturnType<typeof snapshotMemberEdit>> };
const DEMO_CASES = LIVE ? [] : buildCases(demoMembers());   // demo: deterministic → same on server and client
let liveCases: { from: Member[]; cases: Case[] } | null = null;
/** The open work: demo from the demo members; live from the members the API returned (same rules). */
export const allCases = (): Case[] => {
  if (!LIVE) return DEMO_CASES;
  const ms = membersWithEdits(); if (liveCases?.from !== ms) liveCases = { from: ms, cases: buildLiveCases(ms) };
  return liveCases.cases;
};
// the application's "Not an existing or former member" check = no open possible-duplicate case for that applicant
setDuplicateCounter((id) => { const st = readQueueState(); return allCases().filter((c) => c.queue === 'duplicates' && c.memberId === id && isOpen(c, st)).length; });

export function useQueueState() {
  const [s, setS] = useState<QueueState>({ decisions: {}, assignee: {} });
  useEffect(() => { const load = () => setS(readQueueState()); load(); window.addEventListener(QUEUES_EVENT, load); return () => window.removeEventListener(QUEUES_EVENT, load); }, []);
  return s;
}
/** Open counts per queue (sidebar badges, overview). */
export function openCounts(s: QueueState) {
  return Object.fromEntries(QUEUES.map((q) => [q.id, allCases().filter((c) => c.queue === q.id && isOpen(c, s)).length])) as Record<QueueId, number>;
}

export function QueuesView({ search = '' }: { search?: string }) {
  const loaded = useMembers();
  const members = loaded ?? (LIVE ? [] : demoMembers());
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const qs = useQueueState();
  const initialTab = (new URLSearchParams(search).get('tab') as QueueId) || 'applications';
  const [tab, setTabState] = useState<QueueId>(QUEUES.some((q) => q.id === initialTab) ? initialTab : 'applications');
  const [filter, setFilter] = useState<Filter>('open');
  const [selId, setSelId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [ask, setAsk] = useState<Ask>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  const listRef = useRef<HTMLUListElement>(null);

  // tab ↔ address (sidebar sub-links use ?tab=)
  useEffect(() => {
    const read = () => { const t = new URLSearchParams(window.location.search).get('tab') as QueueId; if (t && QUEUES.some((q) => q.id === t)) setTabState(t); };
    window.addEventListener('isgh:tab', read); window.addEventListener('popstate', read);
    return () => { window.removeEventListener('isgh:tab', read); window.removeEventListener('popstate', read); };
  }, []);
  const setTab = (t: QueueId) => {
    setTabState(t); setSelId(null); setChecked([]); setAsk(null);
    const u = new URL(window.location.href); u.searchParams.set('tab', t); window.history.replaceState(null, '', u);
    window.dispatchEvent(new Event('isgh:tab'));
  };

  const mf = useMasjidFilter();
  if (LIVE) setQueueMe(mf.access.me?.id ?? '');   // live: decisions and cases carry the signed-in admin
  // D5 – routing by queue type (Settings › Help desk and tasks › Work queues): who a case is on when nobody took it
  const ws = useWorkSettings();
  useEffect(() => { applyQueueSettings(ws.queues); }, [ws]);
  const org = useOrg();
  useEffect(() => { applyCenterRules(org.rules); }, [org]);   // D14 – the center-change rules
  const admins = (mf.access.doc?.admins ?? []) as unknown as AdminLike[];
  const meId = mf.access.me?.id ?? (LIVE ? '' : 'owner');
  const nameOf = (id: string) => admins.find((a) => a.id === id)?.name ?? (id === queueMe() ? queueMe() : id);
  const onFor = (c: Case) => assigneeOf(c, qs, ws.queues, admins, byId.get(c.memberId) ? centerOf(byId.get(c.memberId)!) : '');
  const visible = useMemo(() => allCases().filter((c) => { const m = byId.get(c.memberId); return !m || mf.keep(m.zone, centerOf(m), m.zip); }), [byId, mf.zone, mf.masjid, mf.access.ready, mf.access.me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const inTab = useMemo(() => visible.filter((c) => c.queue === tab), [tab, visible]);
  const list = useMemo(() => inTab.filter((c) => {
    const open = isOpen(c, qs);
    if (filter === 'done') return !open;
    if (!open) return false;
    if (filter === 'mine') { const a = onFor(c).id; return a === meId || a === queueMe(); }
    if (filter === 'overdue') return sla(c).tone === 'late';
    return true;
  }).sort((a, b) => daysWaiting(b) - daysWaiting(a)), [inTab, qs, filter]);
  const sel = list.find((c) => c.id === selId) ?? list[0] ?? null;
  const counts = Object.fromEntries(QUEUES.map((q) => [q.id, visible.filter((c) => c.queue === q.id && isOpen(c, qs)).length])) as Record<QueueId, number>;
  const overdue = (q: QueueId) => visible.filter((c) => c.queue === q && isOpen(c, qs) && sla(c).tone === 'late').length;

  /* ---------- deciding ---------- */
  const decide = useCallback((cases: Case[], d: Omit<Decision, 'by' | 'at'>, memberChange?: (m: Member) => [Partial<Member>, string, string] | null, text?: string) => {
    const s = readQueueState();
    const u: Undo = { text: text ?? `${d.outcome}.`, caseIds: cases.map((c) => c.id), prev: {}, members: {} };
    for (const c of cases) {
      u.prev[c.id] = s.decisions[c.id];
      s.decisions[c.id] = { ...d, by: queueMe(), at: new Date().toISOString() };
      const m = byId.get(c.memberId);
      if (m) {
        u.members[m.id] = snapshotMemberEdit(m.id);
        const ch = memberChange?.(m);
        if (ch) saveMember({ ...m, ...ch[0] }, ch[1], ch[2]);
        else saveMember(m, `${QUEUES.find((q) => q.id === c.queue)!.short}: ${d.outcome}`, d.note ?? '');
      }
    }
    writeQueueState(s);
    // move on to the next open case
    const idx = list.findIndex((c) => c.id === cases[0].id);
    const next = list.slice(idx + 1).find((c) => !cases.includes(c)) ?? list.slice(0, idx).reverse().find((c) => !cases.includes(c));
    setSelId(next?.id ?? null); setChecked([]); setAsk(null);
    setUndo(u); window.clearTimeout(undoTimer.current); undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
  }, [byId, list]);

  const doUndo = () => {
    if (!undo) return;
    const s = readQueueState();
    for (const id of undo.caseIds) { if (undo.prev[id]) s.decisions[id] = undo.prev[id]!; else delete s.decisions[id]; }
    writeQueueState(s);
    for (const [mid, snap] of Object.entries(undo.members)) restoreMemberEdit(mid, snap);
    setSelId(undo.caseIds[0]); setUndo(null);
  };
  const assign = (c: Case, to?: string) => { const s = readQueueState(); const want = to === undefined ? meId : to; if (!want || s.assignee[c.id] === want) delete s.assignee[c.id]; else s.assignee[c.id] = want; writeQueueState(s); };

  // keyboard: ↑/↓ or J/K
  const onKey = (e: ReactKeyboardEvent) => {
    if ((e.target as HTMLElement).closest('textarea, input, select')) return;
    const i = list.findIndex((c) => c.id === sel?.id);
    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); const n = list[Math.min(i + 1, list.length - 1)]; if (n) { setSelId(n.id); focusItem(n.id); } }
    if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); const n = list[Math.max(i - 1, 0)]; if (n) { setSelId(n.id); focusItem(n.id); } }
  };
  const focusItem = (id: string) => requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>(`[data-case="${id}"]`)?.focus());

  const ready = inTab.filter((c) => qs.decisions[c.id]?.state === 'ready');
  const settings = useMembershipSettings();
  const blocked = (ask?.kind === 'board' ? inTab.filter((c) => ask.caseIds?.includes(c.id)) : []).map((c) => ({ c, why: approvalBlockers(byId.get(c.memberId)!, settings.rules, settings.year, settings.plans) })).filter((x) => x.why.length);
  const q = QUEUES.find((x) => x.id === tab)!;

  return (
    <div className="page queues" onKeyDown={onKey}>
      <header className="page-head">
        <div>
          <h1>Work queues</h1>
          <p className="page-intro">Everything waiting for a decision, oldest first. Each case shows the rule it is judged by.{LIVE ? '' : ' Demo data – decisions stay in this browser.'}</p>
        </div>
      </header>

      <div className="wq-tabs" role="tablist" aria-label="Queues">
        {QUEUES.map((x) => (
          <button key={x.id} role="tab" type="button" aria-selected={tab === x.id} className="wq-tab glass-pane" onClick={() => setTab(x.id)}>
            <span>{x.label}</span><b>{counts[x.id]}</b>
            <small>{overdue(x.id) ? <em className="late">{overdue(x.id)} overdue</em> : `target ${x.slaDays} day${x.slaDays > 1 ? 's' : ''}`}</small>
          </button>
        ))}
      </div>

      <div className="wq glass-pane">
        <section className="wq-list" aria-label={`${q.label} list`}>
          <p className="wq-intro">{q.intro}</p>
          <div className="chip-row" role="group" aria-label="Show">
            {(['open', 'mine', 'overdue', 'done'] as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setSelId(null); }}>
                {f === 'open' ? 'Open' : f === 'mine' ? 'Assigned to me' : f === 'overdue' ? 'Overdue' : 'Done'}
              </button>
            ))}
            <MasjidPicker className="chip-select" />
          </div>
          {tab === 'applications' && filter === 'open' && ready.length > 0 && (
            <div className="wq-batch">
              <span><b>{ready.length}</b> ready for the Board</span>
              <button className="btn primary sm" onClick={() => setAsk({ kind: 'board', caseIds: ready.map((c) => c.id) })}>Record Board approval</button>
            </div>
          )}
          {!list.length ? <p className="wq-empty">{LIVE && !loaded ? 'Loading the cases…' : filter === 'done' ? 'Nothing decided here yet.' : 'All clear – nothing waiting. Alhamdulillah.'}</p> : (
            <ul className="wq-items" ref={listRef}>
              {list.map((c) => {
                const m = byId.get(c.memberId)!; const t = sla(c); const d = qs.decisions[c.id];
                return (
                  <li key={c.id}>
                    {tab === 'applications' && filter !== 'done' && (
                      <input type="checkbox" aria-label={`Select ${fullName(m)}`} checked={checked.includes(c.id)} onChange={() => setChecked((x) => x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id])} />
                    )}
                    <button type="button" data-case={c.id} className={`wq-item${sel?.id === c.id ? ' on' : ''}`} aria-current={sel?.id === c.id ? 'true' : undefined} onClick={() => setSelId(c.id)}>
                      <span className="m-av" aria-hidden="true">{initials(m)}</span>
                      <span className="wq-item-txt"><b>{fullName(m)}</b><small>{summary(c, m)}</small></span>
                      <span className="wq-item-side">
                        <span className={`wq-age ${t.tone}`} title={`Target ${t.target} days`}>{t.days === 0 ? 'Today' : `${t.days} d`}</span>
                        {d && d.state !== 'done' && <span className="wq-flag">{d.state === 'ready' ? 'Ready' : 'Asked'}</span>}
                        {d?.state === 'done' && <span className="wq-flag done">{d.outcome}</span>}
                        {(() => { const a = onFor(c); const esc = escalation(c, qs, ws.queues); return <>
                          {a.id && <span className={`wq-who${a.byRule ? ' by-rule' : ''}`} title={`${a.byRule ? 'By the routing rule: ' : 'Taken by '}${nameOf(a.id)}`}>{nameOf(a.id).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>}
                          {esc && <span className="wq-flag esc" title={`Past the target – escalated to ${esc}`}>Escalated</span>}
                        </>; })()}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {checked.length > 0 && (
            <div className="wq-batch">
              <span><b>{checked.length}</b> selected</span>
              <button className="btn sm" onClick={() => decide(inTab.filter((c) => checked.includes(c.id)), { state: 'ready', outcome: 'Ready for the Board' }, undefined, `${checked.length} marked ready for the Board.`)}>Mark ready for the Board</button>
            </div>
          )}
          <p className="wq-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> or <kbd>J</kbd><kbd>K</kbd> to move</p>
        </section>

        <section className="wq-case" aria-live="polite" aria-label="Case">
          {!sel ? <p className="wq-empty">Pick a case on the left.</p> : <CaseDetail key={sel.id} c={sel} m={byId.get(sel.memberId)!} d={qs.decisions[sel.id]} on={onFor(sel)} meId={meId} admins={admins.filter((a) => a.status === 'active')} escalatedTo={escalation(sel, qs, ws.queues)} onAssign={(to) => assign(sel, to)} ask={ask} setAsk={setAsk} decide={decide} />}
        </section>
      </div>

      {ask?.kind === 'board' && (
        <dialog className="modal glass-float" ref={(el) => { if (el && !el.open) el.showModal(); }} aria-label="Record Board approval" onClose={() => setAsk(null)} onCancel={() => setAsk(null)}>
          <form className="m-form" onSubmit={(e) => {
            e.preventDefault(); const ref = String(new FormData(e.currentTarget).get('ref'));
            const cs = inTab.filter((c) => ask.caseIds?.includes(c.id) && !blocked.some((b) => b.c.id === c.id));
            if (!cs.length) { setAsk(null); return; }
            decide(cs, { state: 'done', outcome: 'Approved by the Board', note: ref }, () => [{ approvedOn: TODAY }, 'Approved', ref], `${cs.length} application${cs.length > 1 ? 's' : ''} approved by the Board.`);
          }}>
            <h2>Record Board approval</h2>
            <p>The Bylaws need the Board to approve each application. This records one Board decision for {(ask.caseIds?.length ?? 0) - blocked.length} application{(ask.caseIds?.length ?? 0) - blocked.length === 1 ? '' : 's'}.</p>
            {blocked.length > 0 && <div className="notice warn-note wq-blocked" role="alert"><b>{blocked.length} held back by the approval rule</b> (Membership rules › Plans and dues):
              <ul>{blocked.map(({ c, why }) => <li key={c.id}>{fullName(byId.get(c.memberId)!)} – {why.join(' ')}</li>)}</ul></div>}
            <label className="sf-field"><span className="sf-label">Board meeting or reference</span><input className="in" name="ref" required placeholder="Board meeting, October 2026" /></label>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setAsk(null)}>Cancel</button><button className="btn primary">Approve {ask.caseIds?.length}</button></div>
          </form>
        </dialog>
      )}
      {undo && <div className="m-toast glass-float wq-undo" role="status"><span>{undo.text}</span><button className="btn sm" onClick={doUndo}>Undo</button></div>}
    </div>
  );
}

function summary(c: Case, m: Member) {
  switch (c.queue) {
    case 'applications': return `${PLANS[m.plan].name} · ${ZONES[m.zone]} · applied ${fmtDate(c.submitted)}`;
    case 'id': return `${c.doc} · uploaded ${fmtDate(c.submitted)}`;
    case 'center': return `${ZONES[m.zone]} → ${ZONES[c.toZone]} · ${c.miles.toFixed(1)} mi`;
    case 'duplicates': return `${c.score}% alike · ${c.other.source}`;
    case 'payments': return `${fmtMoney(c.amountCents)} · ${c.detail}`;
    case 'incomplete': return `Stopped at ${c.stepReached} · last seen ${fmtDate(c.lastSeen)}${c.reminders ? ` · ${c.reminders} reminder${c.reminders > 1 ? 's' : ''}` : ''}`;
    case 'missing': return `${c.fields.map((f) => MISSING_LABEL[f]).join(', ')}${c.lastAsked ? ` · asked ${fmtDate(c.lastAsked)}` : ''}`;
  }
}

type DecideFn = (cases: Case[], d: Omit<Decision, 'by' | 'at'>, memberChange?: (m: Member) => [Partial<Member>, string, string] | null, text?: string) => void;
function CaseDetail({ c, m, d, on, meId, admins, escalatedTo, onAssign, ask, setAsk, decide }: { c: Case; m: Member; d?: Decision; on: { id: string; byRule: boolean }; meId: string; admins: AdminLike[]; escalatedTo: string; onAssign: (to?: string) => void; ask: Ask; setAsk: (a: Ask) => void; decide: DecideFn }) {
  const nameOf = (id: string) => admins.find((a) => a.id === id)?.name ?? id;
  const mine = on.id === meId || on.id === queueMe();
  const rules = rulesFor(c, m);
  const t = sla(c);
  const blocked = rules.some((r) => r.ok === false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const done = d?.state === 'done';
  const declineLabel = c.queue === 'duplicates' ? 'Not the same person' : c.queue === 'payments' ? 'Cancel this payment' : c.queue === 'incomplete' ? 'Not interested – close' : c.queue === 'missing' ? 'Could not reach – close' : 'Decline';
  const infoLabel = c.queue === 'id' ? 'Ask for a new photo' : c.queue === 'payments' ? 'Send a new payment link' : c.queue === 'incomplete' ? 'Send a reminder' : c.queue === 'missing' ? 'Ask for the information' : 'Ask for more information';

  return (
    <article className="wq-detail">
      <header className="wq-dhead">
        <span className="m-av lg" aria-hidden="true">{initials(m)}</span>
        <div>
          <h2><Link href={`/members/${m.id}`}>{fullName(m)}</Link></h2>
          <p>{m.id} · {m.email} · {m.phone}</p>
          <p className="wq-meta"><span className={`wq-age ${t.tone}`}>{t.days === 0 ? 'Arrived today' : `Waiting ${t.days} day${t.days > 1 ? 's' : ''}`}</span> target {t.target} · since {fmtDate(c.submitted)}</p>
        </div>
        <div className="wq-on">
          <button type="button" className="btn sm wq-assign" onClick={() => onAssign()} aria-pressed={mine && !on.byRule}>{mine ? (on.byRule ? 'On your desk (by rule) – take it' : 'Assigned to me') : on.id ? `On ${nameOf(on.id)}${on.byRule ? ' (by rule)' : ''}` : 'Assign to me'}</button>
          <label className="sr-only" htmlFor={`wq-handto-${c.id}`}>Hand this case to</label>
          <select id={`wq-handto-${c.id}`} className="in sm wq-handto" value={on.byRule ? '' : on.id} onChange={(e) => onAssign(e.target.value)} title="Hand this case to someone">
            <option value="">{on.byRule && on.id ? `By rule: ${nameOf(on.id)}` : 'Unassigned'}</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </header>
      {escalatedTo && <p className="notice warn-note glass-pane" role="status"><b>Past its target</b> – this case is flagged to the {escalatedTo.replace(/-/g, ' ')} role (Settings › Work queues).</p>}

      {done && <p className="notice glass-pane" role="status"><b>{d!.outcome}</b> by {d!.by} · {new Date(d!.at).toLocaleString('en-US', { timeZone: ORG_TZ, dateStyle: 'medium', timeStyle: 'short' })}{d!.note ? ` – ${d!.note}` : ''}</p>}
      {d && !done && <p className="notice glass-pane">{d.outcome}{d.note ? ` – “${d.note}”` : ''}</p>}

      <CaseBody c={c} m={m} />

      <section aria-labelledby="rules-h">
        <h3 id="rules-h" className="wq-h3">{c.queue === 'duplicates' ? 'Why they look alike' : 'Checks'}</h3>
        <ol className="m-checks">
          {rules.map((r, i) => (
            <li key={i} className={r.ok === true ? 'ok' : r.ok === false ? 'bad' : 'look'}>
              <span className="m-mark" aria-hidden="true">{r.ok === true ? '✓' : r.ok === false ? '✕' : '•'}</span>
              <div><b>{r.label}</b>{r.note && <small>{r.note}</small>}</div>
              <span className="sr-only">{r.ok === true ? 'met' : r.ok === false ? 'not met' : 'check by eye'}</span>
            </li>
          ))}
        </ol>
      </section>

      {!done && (ask?.kind === 'decline' || ask?.kind === 'info') ? (
        <form className="wq-ask" onSubmit={(e) => {
          e.preventDefault(); const note = reasonRef.current!.value.trim(); if (note.length < 5) return;
          if (ask.kind === 'decline') decide([c], { state: 'done', outcome: c.queue === 'duplicates' ? 'Not the same person' : c.queue === 'payments' ? 'Cancelled' : 'Declined', note });
          else decide([c], { state: 'needs-info', outcome: c.queue === 'payments' ? 'Payment link sent' : 'Asked the member', note }, undefined, c.queue === 'payments' ? 'Demo: a new payment link would be emailed and texted.' : 'Demo: the member would get this by email and SMS.');
        }}>
          <label className="sf-field"><span className="sf-label">{ask.kind === 'decline' ? 'Reason (the member sees this; kept in the audit log)' : 'Message to the member'}</span>
            <textarea ref={reasonRef} className="in in-area" required minLength={5} rows={3} defaultValue={defaultMessage(c, ask.kind)} autoFocus /></label>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setAsk(null)}>Cancel</button><button className={`btn ${ask.kind === 'decline' ? 'danger' : 'primary'}`}>{ask.kind === 'decline' ? declineLabel : 'Send'}</button></div>
        </form>
      ) : !done && (
        <div className="wq-actions">
          {c.queue === 'applications' && <>
            <button className="btn primary" disabled={blocked} onClick={() => decide([c], { state: 'ready', outcome: 'Ready for the Board' })}>Ready for the Board</button>
            {blocked && <small className="wq-why">Finish the red checks first (photo ID is checked in its own queue).</small>}
          </>}
          {c.queue === 'id' && <>
            <button className="btn primary" disabled={blocked} onClick={() => decide([c], { state: 'done', outcome: 'Verified' }, () => [{ idCheck: 'verified' }, 'Photo ID verified', `${c.doc} checked`])}>Photo ID is good</button>
            {blocked && <small className="wq-why">A check failed – ask the member for a new photo (or a current ID).</small>}
          </>}
          {c.queue === 'center' && <>
            <button className="btn primary" disabled={blocked} onClick={() => decide([c], { state: 'done', outcome: 'Center changed' }, () => [{ zone: c.toZone, centerOverride: { center: c.toCenter, reason: `Border request (${c.miles.toFixed(1)} mi): ${c.reason}`, ...(CENTER_RULES.lockYears ? { lockedUntil: `${YEAR + CENTER_RULES.lockYears}-12-31` } : {}) } }, 'Center changed', `${centerOf(m)} → ${c.toCenter} (border request${CENTER_RULES.lockYears ? `, locked ${CENTER_RULES.lockYears} years` : ''})`])}>Approve change</button>
            {blocked && <small className="wq-why">The rules (Masjids and zones › Rules) only allow this within {CENTER_RULES.borderMiles} miles of the border{centerDeadline() ? ' and before the deadline' : ''}{CENTER_RULES.lockYears ? ', and not while a change is locked' : ''}.</small>}
          </>}
          {c.queue === 'incomplete' && <button className="btn primary" onClick={() => decide([c], { state: 'done', outcome: 'Came back and finished' }, () => [{}, 'Application finished', `Finished after a follow-up (stopped at ${c.stepReached})`])}>They finished – move to Applications</button>}
          {c.queue === 'missing' && <button className="btn primary" onClick={() => decide([c], { state: 'done', outcome: 'Information received' }, () => [{ idCheck: c.fields.includes('id') ? 'pending' : m.idCheck }, 'Missing information received', c.fields.map((f) => MISSING_LABEL[f]).join(', ')])}>Information received</button>}
          {c.queue === 'duplicates' && <button className="btn primary" onClick={() => decide([c], { state: 'done', outcome: 'Merged' }, () => [{}, 'Duplicate merged', `${c.other.name} (${c.other.email}, ${c.other.source}) merged into this record`])}>Merge into {m.first}’s record</button>}
          {c.queue === 'payments' && c.kind === 'check_pending' && <button className="btn primary" onClick={() => decide([c], { state: 'done', outcome: 'Check received' }, () => [{ payments: [...m.payments, { year: YEAR, paidOn: TODAY, amountCents: c.amountCents, method: 'check', payer: 'self', ref: `CHK-${c.id.slice(-4)}` }] }, 'Payment recorded', `${YEAR} dues ${fmtMoney(c.amountCents)} by check`])}>Check received</button>}
          {c.queue === 'incomplete' && LIVE ? <JoinReminder m={m} /> : <button className="btn" onClick={() => setAsk({ kind: 'info' })}>{infoLabel}</button>}
          <button className="btn danger-ghost" onClick={() => setAsk({ kind: 'decline' })}>{declineLabel}</button>
        </div>
      )}
    </article>
  );
}

function defaultMessage(c: Case, kind: 'decline' | 'info') {
  if (kind === 'info') {
    if (c.queue === 'id') return 'Assalamu alaikum. The photo of your ID was hard to read. Please upload a clear photo of the front, with all four corners showing.';
    if (c.queue === 'payments') return 'Assalamu alaikum. Your membership payment did not go through. Here is a new secure link to finish it.';
    if (c.queue === 'incomplete') return `Assalamu alaikum. You started your membership application and stopped at “${c.stepReached}”. Your answers are saved – here is the link to pick up where you left off. Reply to this message if something was unclear.`;
    if (c.queue === 'missing') return `Assalamu alaikum. To keep your membership record complete we still need: ${c.fields.map((f) => MISSING_LABEL[f].toLowerCase()).join(', ')}. You can add it from your member home in a minute, or reply here.`;
    return 'Assalamu alaikum. We need one more detail to finish your application: ';
  }
  if (c.queue === 'center') return `Your home is more than ${CENTER_RULES.borderMiles} miles from the zone border, so the rules keep you with your current Islamic Center.`;
  return '';
}

function CaseBody({ c, m }: { c: Case; m: Member }) {
  if (c.queue === 'id') return (
    <div className="wq-id">
      <figure className="wq-idcard" aria-label={`${c.doc} (demo image)`}>
        <div className="wq-idtop">{c.nameOnId ? c.doc.toUpperCase() : 'NO ID UPLOADED YET'}</div>
        <div className="wq-idbody"><span className="wq-photo" aria-hidden="true">{initials(m)}</span>
          <dl><div><dt>Name</dt><dd>{c.nameOnId || '—'}</dd></div><div><dt>Date of birth</dt><dd>{c.dobOnId ? fmtDate(c.dobOnId) : '—'}</dd></div><div><dt>Expires</dt><dd>{c.expires ? fmtDate(c.expires) : '—'}</dd></div></dl></div>
        <figcaption>Demo picture – the real upload shows here (stored encrypted, deleted 90 days after the check)</figcaption>
      </figure>
      <dl className="m-defs wq-app"><div className="m-def"><dt>Application name</dt><dd>{fullName(m)}</dd></div><div className="m-def"><dt>Application date of birth</dt><dd>{fmtDate(m.dob)}</dd></div></dl>
    </div>
  );
  if (c.queue === 'center') return (
    <div className="wq-move">
      <div><small>Now</small><b>{ZONES[m.zone]}</b><span>{centerOf(m)}</span></div>
      <span aria-hidden="true" className="wq-arrow">→</span>
      <div className="to"><small>Asks for</small><b>{ZONES[c.toZone]}</b><span>{c.toCenter}</span></div>
      <blockquote>“{c.reason}”</blockquote>
    </div>
  );
  if (c.queue === 'duplicates') return (
    <div className="wq-compare">
      <table className="m-grid compact">
        <thead><tr><th scope="col"></th><th scope="col">Member record</th><th scope="col">New record</th></tr></thead>
        <tbody>
          {([['Name', fullName(m), c.other.name], ['Email', m.email, c.other.email], ['Mobile', m.phone, c.other.phone], ['Date of birth', fmtDate(m.dob), fmtDate(c.other.dob)], ['Source', `Member since ${m.joined}`, `${c.other.source}, ${fmtDate(c.other.created)}`]] as const).map(([k, a, b]) => (
            <tr key={k} className={a.toLowerCase() === b.toLowerCase() ? 'same' : undefined}><th scope="row">{k}</th><td>{a}</td><td>{b}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="wq-score"><b>{c.score}%</b> alike. Merging keeps the member record, adds the new email and phone as extra contacts, and moves any payments.</p>
    </div>
  );
  if (c.queue === 'incomplete') return (
    <div className="wq-steps-wrap">
      {c.stepTotal ? (
        <ol className="wq-steps" aria-label={`Reached step ${(c.stepIndex ?? 0) + 1} of ${c.stepTotal}`}>
          {Array.from({ length: c.stepTotal }, (_, i) => <li key={i} className={i < (c.stepIndex ?? 0) ? 'done' : i === (c.stepIndex ?? 0) ? 'here' : ''}><span aria-hidden="true">{i < (c.stepIndex ?? 0) ? '✓' : i + 1}</span>{i === (c.stepIndex ?? 0) && <b>{c.stepReached}</b>}</li>)}
        </ol>
      ) : <p className="wq-score">{c.fromImport ? 'Imported from the old system – they never finished joining.' : `Stopped at: ${c.stepReached}`}</p>}
      <dl className="m-defs">
        <div className="m-def"><dt>Reach them</dt><dd>{m.email}{c.hasPhone ? ` · ${m.phone}` : ' · no phone given'}</dd></div>
        {m.join?.startedAt && <div className="m-def"><dt>Started</dt><dd>{fmtWhen(m.join.startedAt)}</dd></div>}
        <div className="m-def"><dt>Last seen</dt><dd>{m.join?.lastSeen ? fmtWhen(m.join.lastSeen) : fmtDate(c.lastSeen)}</dd></div>
        <div className="m-def"><dt>Reminders</dt><dd>{c.reminders ? `${c.reminders}${m.join?.lastReminded ? ` · last ${fmtWhen(m.join.lastReminded)}` : ''}` : 'none yet'}</dd></div>
      </dl>
      <JoinAnswers m={m} />
    </div>
  );
  if (c.queue === 'missing') return (
    <dl className="m-defs">
      <div className="m-def"><dt>Missing</dt><dd>{c.fields.map((f) => MISSING_LABEL[f]).join(', ')}</dd></div>
      <div className="m-def"><dt>On the record</dt><dd>{[m.phone && `mobile ${m.phone}`, m.street && `address ${m.street}, ${m.city} ${m.zip}`, m.dob && `born ${fmtDate(m.dob)}`, m.idCheck === 'verified' && 'ID checked'].filter(Boolean).join(' · ') || '—'}</dd></div>
      <div className="m-def"><dt>Member since</dt><dd>{m.joined} · {PLANS[m.plan].name}</dd></div>
    </dl>
  );
  if (c.queue === 'payments') return (
    <dl className="m-defs">
      <div className="m-def"><dt>What happened</dt><dd>{c.detail}</dd></div>
      <div className="m-def"><dt>Amount</dt><dd>{fmtMoney(c.amountCents)} · {PLANS[m.plan].name} plan {YEAR}</dd></div>
      <div className="m-def"><dt>Method</dt><dd>{c.kind === 'check_pending' ? 'Check at the center' : c.kind === 'bank_returned' ? 'Bank account (ACH)' : 'Card (Stripe, later)'}</dd></div>
      <div className="m-def"><dt>Started</dt><dd>{fmtDate(c.submitted)}</dd></div>
    </dl>
  );
  return (
    <dl className="m-defs">
      <div className="m-def"><dt>Plan</dt><dd>{PLANS[m.plan].name} · {fmtMoney(PLANS[m.plan].cents)}</dd></div>
      <div className="m-def"><dt>Zone and center</dt><dd>{ZONES[m.zone]} · {centerOf(m)}</dd></div>
      <div className="m-def"><dt>Home</dt><dd>{[m.street, cityLine(m)].filter(Boolean).join(', ')}</dd></div>
      <div className="m-def"><dt>Applied</dt><dd>{fmtDate(m.appliedOn)}</dd></div>
    </dl>
  );
}

/** "10/20/2026, 3:42 PM" in the organization's time zone */
function fmtWhen(iso: string) { const t = new Date(iso); return Number.isNaN(t.getTime()) ? iso : t.toLocaleString('en-US', { timeZone: ORG_TZ, month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }

/** Everything an unfinished applicant typed – the office can call them with it in front of them. */
function JoinAnswers({ m }: { m: Member }) {
  type Draft = { about?: Record<string, string>; plan?: { planId?: string; years?: number; spouse?: { firstName?: string; lastName?: string; email?: string } };
    pledge?: { commitments?: string[]; pledgeAccepted?: boolean; signature?: string; emailConsent?: boolean; smsConsent?: boolean };
    lookup?: { center?: { name?: string } | null; zone?: { name?: string } | null } | null; custom?: Record<string, unknown> };
  const d = (m.join?.draft ?? {}) as Draft;
  const about = d.about ?? {}; const plan = d.plan ?? {}; const pledge = d.pledge ?? {}; const custom = d.custom ?? {};
  const rows: [string, string][] = [
    ['Name', [about.firstName, about.middleName, about.lastName].filter(Boolean).join(' ') || [m.first, m.last].filter(Boolean).join(' ')],
    ['Preferred name', about.preferredName ?? ''],
    ['Date of birth', about.dob ? fmtDate(about.dob) : m.dob && !m.dob.startsWith('1900') ? fmtDate(m.dob) : ''],
    ['Mobile', about.phone || m.phone],
    ['Address', [[about.street, about.unit].filter(Boolean).join(' '), [about.city, [about.state, about.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ') || [m.street, cityLine(m)].filter(Boolean).join(', ')],
    ['Islamic Center', d.lookup?.center?.name ? `${d.lookup.center.name}${d.lookup.zone?.name ? ` · ${d.lookup.zone.name} zone` : ''}` : m.center],
    ['Plan', plan.planId ? `${planDef({ plan: plan.planId as Member['plan'] }).name}${(plan.years ?? 1) > 1 ? ` · ${plan.years} years` : ''}` : ''],
    ['Spouse', plan.spouse?.firstName ? `${plan.spouse.firstName} ${plan.spouse.lastName ?? ''}${plan.spouse.email ? ` · ${plan.spouse.email}` : ''}` : ''],
    ['Commitment', Array.isArray(pledge.commitments) ? pledge.commitments.join(', ') : ''],
    ['Pledge', pledge.pledgeAccepted ? `Accepted${pledge.signature ? ` – signed “${pledge.signature}”` : ''}` : ''],
    ['Messages', [pledge.emailConsent ? 'email: yes' : '', pledge.smsConsent ? 'text: yes' : ''].filter(Boolean).join(' · ')],
    ...Object.entries(custom).filter(([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && !v.length)).map(([k, v]) => [k.replace(/-/g, ' ').replace(/^./, (x) => x.toUpperCase()), Array.isArray(v) ? v.join(', ') : String(v)] as [string, string]),
  ].filter(([, v]) => v && String(v).trim()) as [string, string][];
  return (
    <section aria-labelledby={`ans-${m.id}`} className="wq-answers">
      <h3 id={`ans-${m.id}`} className="wq-h3">What they filled in</h3>
      {rows.length ? <dl className="m-defs">{rows.map(([k, v]) => <div key={k} className="m-def"><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : <p className="wq-why">Only the email so far.</p>}
    </section>
  );
}

/** Live: email them the link to finish (a fresh 30-day link; also shown here to copy into a text message). */
const sentLinks = new Map<string, string>();   // survives the case list re-drawing after the member reloads
function JoinReminder({ m }: { m: Member }) {
  const [state, setState] = useState<{ busy: boolean; link: string; error: string }>({ busy: false, link: sentLinks.get(m.id) ?? '', error: '' });
  const send = async () => {
    setState({ busy: true, link: '', error: '' });
    const r = await be<{ sent: boolean; to: string; link: string }>('POST', `admin/members/${encodeURIComponent(m.id)}/join-reminder`, {});
    if (!r.ok) { setState({ busy: false, link: '', error: r.message }); return; }
    sentLinks.set(m.id, r.data.link); setState({ busy: false, link: r.data.link, error: '' });
    // stays on this case (no decision = no jump to the next one); the API counted the reminder and wrote the audit log
    void refreshLive(m.id);
  };
  return (
    <div className="wq-remind">
      <button className="btn primary" disabled={state.busy} onClick={() => void send()}>{state.busy ? 'Sending…' : state.link ? 'Email the link again' : 'Email them the link to finish'}</button>
      {state.error && <small className="wq-why" role="alert">{state.error}</small>}
      {state.link && <p className="wq-why" role="status">Emailed to {m.email}. To text it instead, copy: <input className="in" readOnly value={state.link} onFocus={(e) => e.target.select()} aria-label="Link to finish the application" /></p>}
    </div>
  );
}
