'use client';
/**
 * Communication › Messages. A list of drafts, scheduled and sent messages, and a composer that goes in a fixed order
 * (research: WildApricot email wizard – recipients → compose → review & send; Mailchimp checklist – To → From → Subject
 * → Send time → Content): 1 How and what kind → 2 Who gets it → 3 Write it → 4 When → review, test, send.
 * The right column always shows how many people get it, who is left out and why, the preview and what is still missing.
 * Demo: saved in this browser, nothing is sent. Live: /admin/messages – the server runs checkCampaign + the audience again and sends.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MACROS, SAMPLE_VALUES, type CommunicationDoc } from '@/lib/community/communication';
import {
  CampaignSchema, SKIP_LABEL, STOP_TEXT, TOPICS, TOPIC_KEYS, checkCampaign, finalText, resolveAudience, smsSegments, topicOf,
  type Campaign, type Recipient, type SkipReason, type Topic,
} from '@/lib/community/campaigns';
import type { GroupsDoc } from '@/lib/community/groups';
import { logAudit } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

/* ---------- live mode: messages on the server (it checks the audience, preferences and quiet hours again and sends) ---------- */
const UUID = /^[0-9a-f-]{36}$/;
export async function loadLiveCampaigns(): Promise<Campaign[]> {
  const r = await be<{ messages: { campaign: Campaign }[] }>('GET', 'admin/messages?full=1');
  if (!r.ok) { if (r.status !== 401) notice(`Messages could not be loaded: ${r.message}`); return []; }
  return r.data.messages.map((m) => m.campaign);
}
/** Save a draft, schedule or send – the steps the server needs. Returns the server's id, or null when it refused. */
export async function saveLiveCampaign(x: Campaign, before?: Campaign): Promise<string | null> {
  const body = { name: x.name, channel: x.channel, topic: x.topic, subject: x.subject, body: x.body, audience: x.audience, sendAt: x.sendAt };
  let id = UUID.test(x.id) ? x.id : '';
  if (x.status === 'cancelled') { const r = await be('POST', `admin/messages/${id}/cancel`, {}); if (!r.ok) { notice(r.message); return null; } return id; }
  if (!id) { const r = await be<{ id: string }>('POST', 'admin/messages', body); if (!r.ok) { notice(r.message); return null; } id = r.data.id; }
  else if (!before || before.status === 'draft') { const r = await be('PUT', `admin/messages/${id}`, body); if (!r.ok) { notice(r.message); return null; } }
  if (x.status === 'scheduled' || x.status === 'sent') {
    const r = await be<{ status: string; sent?: number }>('POST', `admin/messages/${id}/send`, {});
    if (!r.ok) { notice(r.message); return null; }
    notice(r.data.status === 'scheduled' ? `“${x.name}” is scheduled.` : `“${x.name}” was sent to ${(r.data.sent ?? 0).toLocaleString('en-US')} people.`, 'ok');
  }
  return id;
}

const KEY = 'isgh-admin-campaigns';
export const readCampaigns = (): Campaign[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (l: Campaign[]) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* full */ } };
export const fmtWhen = (s: string) => { const [d, t = '00:00'] = s.split('T'); const [y, m, dd] = d.split('-'); const [h, mi] = t.split(':').map(Number); return `${m}/${dd}/${y} ${((h + 11) % 12) + 1}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const blank = (p: Partial<Campaign> = {}): Campaign => ({ id: `msg-${Date.now().toString(36)}`, name: '', channel: 'email', topic: 'announcement', subject: '', body: 'Assalamu alaikum {Member.FirstName},\n\n', audience: { everyone: false, groupIds: [], excludeGroupIds: [] }, sendAt: null, status: 'draft', sentTo: 0, createdBy: 'Mohammad (demo)', updatedAt: '', ...p });
type Filter = 'all' | 'draft' | 'scheduled' | 'sent';
const STATUS_TEXT: Record<Campaign['status'], string> = { draft: 'Draft', scheduled: 'Scheduled', sent: 'Sent', cancelled: 'Cancelled' };

export function CampaignsView({ comm, people, now }: { comm: CommunicationDoc; people: Recipient[]; now: string }) {
  const [list, setList] = useState<Campaign[]>([]);
  const [groups, setGroups] = useState<GroupsDoc | null>(null);
  const [c, setC] = useState<Campaign | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [flash, setFlash] = useState('');
  useEffect(() => { if (LIVE) void loadLiveCampaigns().then(setList); else setList(readCampaigns()); void fetch('/api/store/groups').then((r) => (r.ok ? r.json() : null)).then((j) => setGroups(j?.data ?? { enabled: true, groups: [] })).catch(() => setGroups({ enabled: true, groups: [] })); }, []);
  const save = (next: Campaign[]) => { setList(next); write(next); };
  const upsert = (x: Campaign) => {
    if (LIVE) { void saveLiveCampaign(x, list.find((y) => y.id === x.id)).then(() => loadLiveCampaigns()).then(setList); return; }
    save([{ ...x, updatedAt: now }, ...list.filter((y) => y.id !== x.id)]);
  };
  const say = (t: string) => { setFlash(t); window.setTimeout(() => setFlash(''), 5000); };

  if (c && groups) return <Composer c={c} setC={setC} comm={comm} people={people} groups={groups} now={now}
    onClose={() => setC(null)} onSave={(x, msg) => { upsert(x); setC(null); setFilter('all'); say(msg); }} />;

  const count = (f: Filter) => (f === 'all' ? list.length : list.filter((x) => x.status === f).length);
  const shown = filter === 'all' ? list : list.filter((x) => x.status === filter);
  const hasGroup = (id: string) => !!groups?.groups.some((g) => g.id === id && !g.archived);
  const starts: { title: string; note: string; make: () => Campaign }[] = [
    { title: 'Announcement to everyone', note: 'Email · every member who gets announcements', make: () => blank({ topic: 'announcement', audience: { everyone: true, groupIds: [], excludeGroupIds: [] } }) },
    { title: 'Monthly newsletter', note: 'Email · starts from your newsletter template', make: () => { const t = comm.templates.find((x) => !x.archived && x.category === 'newsletter'); return blank(t ? { name: t.name, subject: t.subject, body: t.body, topic: topicOf(t.category), audience: { everyone: true, groupIds: [], excludeGroupIds: [] } } : { topic: 'newsletter' }); } },
    { title: 'Remind people to renew', note: hasGroup('renewal-due') ? 'Email · the “Renewal due or in grace” group' : 'Email · membership notice', make: () => blank({ topic: 'membership', name: 'Renewal reminder', subject: 'Please renew your {Org.ShortName} membership', body: 'Assalamu alaikum {Member.FirstName},\n\nYour membership is due. Renew here: {Link.Renew}\n', audience: { everyone: false, groupIds: hasGroup('renewal-due') ? ['renewal-due'] : [], excludeGroupIds: [] } }) },
  ];

  return (
    <div className="cv cmp">
      <div className="cmp-top">
        <div className="cmp-filters" role="tablist" aria-label="Show messages">
          {(['all', 'draft', 'scheduled', 'sent'] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} className="cmp-filter" onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'draft' ? 'Drafts' : f === 'scheduled' ? 'Scheduled' : 'Sent'}<span>{count(f)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn primary" disabled={!groups} onClick={() => setC(blank())}>New message</button>
      </div>
      {flash && <p className="notice ok" role="status">{flash}</p>}

      {!list.length ? (
        <section className="cmp-empty glass-pane" aria-label="Start a message">
          <h2>Send your first message</h2>
          <p className="muted">Pick a starting point – you can change everything before it goes out. Members choose which kinds of email they get; membership and election notices always go.</p>
          <div className="cmp-starts">
            {starts.map((s) => <button key={s.title} type="button" className="cmp-start" disabled={!groups} onClick={() => setC(s.make())}><b>{s.title}</b><small>{s.note}</small></button>)}
          </div>
        </section>
      ) : !shown.length ? <p className="cv-empty">Nothing here yet.</p> : (
        <div className="table-wrap glass-pane cmp-table"><table className="t-plain cmp-list">
          <thead><tr><th>Message</th><th>Sent by</th><th>To</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{shown.map((x) => (
            <tr key={x.id} data-msg={x.id}>
              <td><b>{x.name}</b><small className="block">{TOPICS[x.topic].label}{x.subject ? ` · ${x.subject}` : ''}</small></td>
              <td>{x.channel === 'email' ? 'Email' : 'Text'}</td>
              <td>{x.audience.everyone ? 'Every member' : `${x.audience.groupIds.length} group${x.audience.groupIds.length === 1 ? '' : 's'}`}{x.sentTo ? <small className="block">{x.sentTo.toLocaleString('en-US')} people</small> : null}</td>
              <td><span className={`pill ${x.status === 'sent' ? 'good' : x.status === 'cancelled' ? 'bad' : x.status === 'scheduled' ? 'warn' : ''}`}>{x.status === 'scheduled' && x.sendAt ? `Scheduled ${fmtWhen(x.sendAt)}` : STATUS_TEXT[x.status]}</span></td>
              <td className="row-actions">
                {(x.status === 'draft' || x.status === 'scheduled') && <button type="button" className="btn sm" onClick={() => setC(structuredClone(x))}>Open<span className="sr-only"> {x.name}</span></button>}
                {x.status === 'scheduled' && <button type="button" className="btn sm" onClick={() => { upsert({ ...x, status: 'cancelled' }); say(`“${x.name}” will not be sent.`); }}>Cancel<span className="sr-only"> {x.name}</span></button>}
                <button type="button" className="btn sm ghost" onClick={() => setC({ ...structuredClone(x), id: `msg-${Date.now().toString(36)}`, name: `${x.name} (copy)`, status: 'draft', sendAt: null, sentTo: 0 })}>Copy<span className="sr-only"> {x.name}</span></button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

type Step = 'how' | 'who' | 'write' | 'when';
const STEP_OF: Record<string, Step> = { channel: 'how', topic: 'how', audience: 'who', name: 'write', subject: 'write', body: 'write', sendAt: 'when' };

function Composer({ c, setC, comm, people, groups, now, onClose, onSave }: {
  c: Campaign; setC: (c: Campaign) => void; comm: CommunicationDoc; people: Recipient[]; groups: GroupsDoc; now: string;
  onClose: () => void; onSave: (c: Campaign, msg: string) => void;
}) {
  const [when, setWhen] = useState<'now' | 'later'>(c.sendAt ? 'later' : 'now');
  const [confirm, setConfirm] = useState(false);
  const [tested, setTested] = useState('');
  const [tpl, setTpl] = useState(() => comm.templates.find((t) => !t.archived && t.subject === c.subject && t.body === c.body)?.id ?? '');
  const body = useRef<HTMLTextAreaElement>(null);
  const set = (p: Partial<Campaign>) => setC({ ...c, ...p });
  const active = groups.groups.filter((g) => !g.archived);
  const aud = useMemo(() => resolveAudience(c, people, groups), [c, people, groups]);
  const named = c.name.trim() ? c : { ...c, name: c.subject.trim() || 'Untitled message' };
  const parsed = CampaignSchema.safeParse(named);
  const chose = c.audience.everyone || c.audience.groupIds.length > 0;
  const issues = [
    ...(parsed.success ? [] : parsed.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message }))),
    ...checkCampaign(named, comm, now),
    ...(when === 'later' && !c.sendAt ? [{ field: 'sendAt', message: 'Pick the day and time.' }] : []),
    ...(aud.to.length === 0 && chose ? [{ field: 'audience', message: 'Nobody would get this message.' }] : []),
  ];
  const stepIssues = (s: Step) => issues.filter((i) => (STEP_OF[i.field] ?? 'write') === s);
  const out = finalText(named, comm, SAMPLE_VALUES);
  const seg = smsSegments(out.body);
  const skipped = (Object.entries(aud.skipped) as [SkipReason, number][]).filter(([, n]) => n > 0);
  const insert = (m: string) => { const el = body.current; const at = el?.selectionStart ?? c.body.length; set({ body: c.body.slice(0, at) + m + c.body.slice(at) }); };
  const toggle = (k: 'groupIds' | 'excludeGroupIds', id: string) => set({ audience: { ...c.audience, [k]: c.audience[k].includes(id) ? c.audience[k].filter((x) => x !== id) : [...c.audience[k], id] } });
  const finish = () => {
    logAudit({ area: 'messages', action: when === 'later' ? 'Message scheduled' : 'Message sent', detail: `“${named.name}” by ${c.channel === 'email' ? 'email' : 'text'} to ${aud.to.length} people` });
    if (when === 'later') onSave({ ...named, status: 'scheduled' }, `“${named.name}” is scheduled for ${fmtWhen(c.sendAt!)} to ${aud.to.length.toLocaleString('en-US')} people.`);
    else onSave({ ...named, status: 'sent', sendAt: null, sentTo: aud.to.length }, LIVE ? `Sending “${named.name}”…` : `Demo: “${named.name}” would now go to ${aud.to.length.toLocaleString('en-US')} people. Nothing was sent.`);
  };
  const steps: { id: Step; n: number; title: string; summary: string }[] = [
    { id: 'how', n: 1, title: 'How and what kind', summary: `${c.channel === 'email' ? 'Email' : 'Text message'} · ${TOPICS[c.topic].label}` },
    { id: 'who', n: 2, title: 'Who gets it', summary: chose ? `${aud.to.length.toLocaleString('en-US')} ${aud.to.length === 1 ? 'person' : 'people'}` : 'Not chosen yet' },
    { id: 'write', n: 3, title: 'Write it', summary: c.channel === 'email' ? (out.subject.trim() || 'No subject yet') : `${seg.segments} text part${seg.segments === 1 ? '' : 's'}` },
    { id: 'when', n: 4, title: 'When', summary: when === 'later' ? (c.sendAt ? fmtWhen(c.sendAt) : 'Pick a time') : 'Send now' },
  ];
  const done = (s: Step) => stepIssues(s).length === 0 && (s !== 'who' || chose);
  const Head = ({ s }: { s: (typeof steps)[number] }) => (
    <header className="cmp-step-h"><span className={`cmp-num${done(s.id) ? ' ok' : ''}`} aria-hidden="true">{done(s.id) ? '✓' : s.n}</span>
      <h2>{s.title}</h2><span className="cmp-step-sum">{s.summary}</span><span className="sr-only">{done(s.id) ? '(done)' : '(needs attention)'}</span></header>
  );
  const StepErr = ({ s }: { s: Step }) => { const l = stepIssues(s); return l.length ? <ul className="cmp-step-err" role="alert">{l.map((i, k) => <li key={k}>{i.message}</li>)}</ul> : null; };

  return (
    <div className="cv cmp-edit">
      <div className="cmp-head">
        <button type="button" className="linkish cmp-back" onClick={onClose}>‹ Messages</button>
        <label className="cmp-name"><span className="sf-label">Name (only staff see it)</span>
          <input id="cm-name" className="in" value={c.name} onChange={(e) => set({ name: e.target.value })} placeholder={c.subject.trim() || 'Untitled message'} /></label>
        <span className="pill">{STATUS_TEXT[c.status]}</span>
      </div>

      <div className="cmp-grid">
        <div className="cmp-steps">
          <section className="cmp-step glass-pane" aria-label="1. How and what kind" data-step="how">
            <Head s={steps[0]} />
            <div className="cmp-row">
              <div className="sf-field"><span className="sf-label" id="cm-ch">Send by</span>
                <div className="seg" role="radiogroup" aria-labelledby="cm-ch">
                  {(['email', 'sms'] as const).map((ch) => <button key={ch} type="button" role="radio" aria-checked={c.channel === ch} onClick={() => set({ channel: ch, subject: ch === 'sms' ? '' : c.subject })}>{ch === 'email' ? 'Email' : 'Text message'}</button>)}
                </div></div>
              <div className="sf-field"><label className="sf-label" htmlFor="cm-topic">Kind of message</label>
                <select id="cm-topic" className="in" value={c.topic} onChange={(e) => set({ topic: e.target.value as Topic })}>{TOPIC_KEYS.map((t) => <option key={t} value={t}>{TOPICS[t].label}{TOPICS[t].optional ? '' : ' (always sent)'}</option>)}</select>
              </div>
            </div>
            <small className="sf-hint">{TOPICS[c.topic].optional ? 'Members who turned this kind off will not get it.' : 'Official notice – goes to every member who has an address, even if they turned other email off.'}</small>
            <StepErr s="how" />
          </section>

          <section className="cmp-step glass-pane" aria-label="2. Who gets it" data-step="who">
            <Head s={steps[1]} />
            <fieldset className="cmp-aud"><legend className="sr-only">Who gets it</legend>
              <label className="check cmp-every"><input type="checkbox" checked={c.audience.everyone} onChange={(e) => set({ audience: { ...c.audience, everyone: e.target.checked } })} /> <span>Every member</span></label>
              {!c.audience.everyone && <>
                <p className="sf-hint">Or pick groups (people in any of them):</p>
                <div className="cmp-groups" role="group" aria-label="Groups">{active.map((g) => <label key={g.id} className="check"><input type="checkbox" checked={c.audience.groupIds.includes(g.id)} onChange={() => toggle('groupIds', g.id)} /> <span>{g.name}</span></label>)}</div>
              </>}
              <details className="cmp-leave"><summary>Leave out groups{c.audience.excludeGroupIds.length ? ` (${c.audience.excludeGroupIds.length})` : ''}</summary>
                <div className="cmp-groups" role="group" aria-label="Leave out">{active.map((g) => <label key={g.id} className="check"><input type="checkbox" checked={c.audience.excludeGroupIds.includes(g.id)} onChange={() => toggle('excludeGroupIds', g.id)} /> <span>Leave out {g.name}</span></label>)}</div>
              </details>
            </fieldset>
            <StepErr s="who" />
          </section>

          <section className="cmp-step glass-pane" aria-label="3. Write it" data-step="write">
            <Head s={steps[2]} />
            {c.channel === 'email' && (
              <div className="sf-field"><label className="sf-label" htmlFor="cm-tpl">Start from a template</label>
                <select id="cm-tpl" className="in" value={tpl} onChange={(e) => { setTpl(e.target.value); const t = comm.templates.find((x) => x.id === e.target.value); if (t) set({ subject: t.subject, body: t.body, topic: topicOf(t.category), name: c.name || t.name }); }}>
                  <option value="">Choose…</option>{comm.templates.filter((t) => !t.archived).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {tpl && <small className="sf-hint">Filled in from “{comm.templates.find((t) => t.id === tpl)?.name}”. Your changes here do not change the template.</small>}</div>
            )}
            {c.channel === 'email' && <div className="sf-field"><label className="sf-label" htmlFor="cm-sub">Subject</label><input id="cm-sub" className="in" value={c.subject} maxLength={150} onChange={(e) => set({ subject: e.target.value })} placeholder="What is this about?" /></div>}
            <div className="sf-field"><label className="sf-label" htmlFor="cm-body">Message</label>
              <textarea id="cm-body" ref={body} className="in in-area" rows={c.channel === 'sms' ? 4 : 9} value={c.body} onChange={(e) => set({ body: e.target.value })} />
              <div className="cv-macros" aria-label="Insert a merge field">{MACROS.filter((m) => /^(Member|Org|Link)\./.test(m.key)).map((m) => <button key={m.key} type="button" className="chip-btn" onClick={() => insert(`{${m.key}}`)}>{m.label}</button>)}</div>
              {c.channel === 'sms' && <p className={`cmp-seg${seg.segments > 3 ? ' bad' : ''}`} role="status">{seg.segments} text part{seg.segments === 1 ? '' : 's'} · {seg.length}/{seg.perPart * Math.max(1, seg.segments)} characters · {seg.encoding === 'GSM-7' ? 'plain text' : 'Unicode (Arabic or emoji – 70 per part)'} · includes “{STOP_TEXT.trim()}”</p>}
            </div>
            <StepErr s="write" />
          </section>

          <section className="cmp-step glass-pane" aria-label="4. When" data-step="when">
            <Head s={steps[3]} />
            <div className="seg" role="radiogroup" aria-label="When">
              <button type="button" role="radio" aria-checked={when === 'now'} onClick={() => { setWhen('now'); set({ sendAt: null }); }}>Send now</button>
              <button type="button" role="radio" aria-checked={when === 'later'} onClick={() => setWhen('later')}>Schedule</button>
            </div>
            {when === 'later' && <label className="sf-field cmp-when"><span className="sf-label">Day and time (Houston)</span><input className="in" type="datetime-local" aria-label="Send on (Houston time)" value={c.sendAt ?? ''} min={now} onChange={(e) => set({ sendAt: e.target.value || null })} /></label>}
            <StepErr s="when" />
          </section>
        </div>

        <aside className="cmp-side">
          <section className="cmp-count glass-pane" aria-label="Who gets it – summary">
            <p><b data-count={aud.to.length}>{aud.to.length.toLocaleString('en-US')}</b> {aud.to.length === 1 ? 'person gets' : 'people get'} this {c.channel === 'email' ? 'email' : 'text'}</p>
            {skipped.length > 0 && <ul>{skipped.map(([k, n]) => <li key={k} data-skip={k}>{n.toLocaleString('en-US')} left out: {SKIP_LABEL[k]}</li>)}</ul>}
            {aud.missingGroups.length > 0 && <p className="sf-err">Archived or missing groups are ignored: {aud.missingGroups.join(', ')}</p>}
          </section>
          <section className="cv-preview" aria-label="Preview with a sample member">
            <p className="cv-pv-from"><small>From</small>{comm.sender.fromName}</p>
            {c.channel === 'email' && <p className="cv-pv-sub"><small>Subject</small>{out.subject || <i className="muted">No subject yet</i>}</p>}
            <div className="cv-pv-body">{out.body.split('\n').map((l, i) => <p key={i}>{l || ' '}</p>)}</div>
          </section>
          {issues.length > 0
            ? <div className="notice warn-note cmp-issues" role="alert"><b>Before it can go out</b><ul>{issues.map((i, k) => <li key={k}>{i.message}</li>)}</ul></div>
            : <p className="notice ok cmp-ready" role="status">Ready to {when === 'later' ? 'schedule' : 'send'}.</p>}
          {tested && <p className="notice" role="status">{tested}</p>}
        </aside>
      </div>

      <div className="cmp-actions glass-float">
        <button type="button" className="btn ghost" onClick={onClose}>Back</button>
        <span className="cmp-actions-gap" />
        <button type="button" className="btn" onClick={() => onSave({ ...named, status: 'draft' }, `Draft “${named.name}” saved.`)}>Save draft</button>
        <button type="button" className="btn" disabled={issues.length > 0} onClick={() => setTested(`Demo: a test ${c.channel === 'email' ? 'email' : 'text'} would go to you (Mohammad (demo)) with sample details.`)}>Send me a test</button>
        <button type="button" className="btn primary" disabled={issues.length > 0} onClick={() => setConfirm(true)}>{when === 'later' ? 'Schedule' : 'Send now'}…</button>
      </div>
      {confirm && (
        <dialog ref={(el) => { if (el && !el.open) el.showModal(); }} className="modal glass-float" aria-label="Confirm" onClose={() => setConfirm(false)} onCancel={() => setConfirm(false)}>
          <div className="m-form">
            <h2>{when === 'later' ? `Schedule for ${fmtWhen(c.sendAt!)}?` : 'Send now?'}</h2>
            <p>“{named.name}” goes to <b>{aud.to.length.toLocaleString('en-US')}</b> {aud.to.length === 1 ? 'person' : 'people'} by {c.channel === 'email' ? 'email' : 'text'}. {c.channel === 'sms' ? `${seg.segments} part${seg.segments === 1 ? '' : 's'} each – about ${(aud.to.length * seg.segments).toLocaleString('en-US')} texts.` : ''}</p>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setConfirm(false)}>Not yet</button><button type="button" className="btn primary" onClick={finish}>{when === 'later' ? 'Schedule' : 'Send'}</button></div>
          </div>
        </dialog>
      )}
    </div>
  );
}
