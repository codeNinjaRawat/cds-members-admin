'use client';
/**
 * Settings › Help desk and tasks – the `work-settings` document. Everything an organization decides differently:
 * categories and who gets them, targets per priority, working hours, saved replies, satisfaction, auto-close;
 * task board names, labels and project templates. ISGH-flavored values are the default; "Simple start" is a preset
 * for a small masjid with one office. Publishing needs “Change membership rules and configuration”.
 */
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, SwitchRow, Tabs, countIssues } from '@/components/editor/bits';
import { useAccess } from '@/lib/access/use-access';
import { PRIORITY_KEYS, PRIORITY_LABEL, QUEUE_KEYS, QUEUE_LABEL, SIMPLE_WORK_PRESET, TASK_STATUS_KEYS, mockWorkSettings, routeQueueCase, unfilledFields, type AdminLike, type WorkSettings } from '@/lib/community/work';

type Doc = { draft: WorkSettings; setDraft: (f: WorkSettings | ((d: WorkSettings) => WorkSettings)) => void; issues: Record<string, string> };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
const uniq = (base: string, taken: string[]) => { let id = base, n = 2; while (taken.includes(id)) id = `${base}-${n++}`; return id; };
const MERGE = ['first_name', 'name', 'ticket', 'subject', 'masjid', 'agent', 'organization'];

export function WorkSettingsView() {
  return (
    <DocEditor<WorkSettings> storeKey="work-settings" title="Help desk and tasks" preview={false}
      intro="How questions from members are sorted, who gets them and how fast they must be answered – and the board, labels and templates of the team’s own tasks.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function Body({ doc }: { doc: Doc }) {
  return (
    <Tabs label="Help desk and tasks settings" tabs={[
      { id: 'helpdesk', label: 'Help desk', badge: countIssues(doc.issues, ['helpdesk']), render: () => <HelpDesk doc={doc} /> },
      { id: 'tasks', label: 'Team tasks', badge: countIssues(doc.issues, ['tasks']), render: () => <TasksSettings doc={doc} /> },
      { id: 'queues', label: 'Work queues', badge: countIssues(doc.issues, ['queues']), render: () => <QueuesSettings doc={doc} /> },
    ]} />
  );
}

function HelpDesk({ doc }: { doc: Doc }) {
  const access = useAccess();
  const d = doc.draft.helpdesk;
  const set = (f: (x: WorkSettings['helpdesk']) => void) => doc.setDraft((x) => { const n = structuredClone(x); f(n.helpdesk); return n; });
  const e = (k: string) => doc.issues[`helpdesk.${k}`];
  const admins = access.doc.admins.filter((a) => a.status === 'active');
  const roles = access.doc.roles;
  return (
    <div className="cv ws">
      <Panel title="Start from" intro="Load a ready set into the draft, then change anything. Nothing is published until you press Publish.">
        <div className="row-actions">
          <button type="button" className="btn sm" onClick={() => doc.setDraft((x) => ({ ...x, helpdesk: structuredClone(mockWorkSettings.helpdesk) }))}>Masjid organization (8 categories, business hours)</button>
          <button type="button" className="btn sm" onClick={() => doc.setDraft((x) => ({ ...x, helpdesk: structuredClone(SIMPLE_WORK_PRESET.helpdesk) }))}>Simple start (3 categories, calendar hours)</button>
        </div>
      </Panel>
      <Panel title="On or off">
        <SwitchRow id="ws-on" label="Use the help desk" help="Off: website forms send an email to the office instead of creating tickets." checked={d.enabled} onChange={(v) => set((x) => { x.enabled = v; })} />
        <SwitchRow id="ws-web" label="Website and member-portal forms create tickets" checked={d.websiteForms} onChange={(v) => set((x) => { x.websiteForms = v; })} />
        <SwitchRow id="ws-csat" label="Ask for a rating when a ticket is solved" help="One click: Good or Not good, with an optional comment." checked={d.satisfaction} onChange={(v) => set((x) => { x.satisfaction = v; })} />
      </Panel>
      <Panel title="Working hours and targets" intro="Targets count working hours only (business) or every hour (calendar). The solve clock stops while a ticket waits on the requester.">
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Clock</span><select className="in" aria-label="Clock" value={d.clock} onChange={(ev) => set((x) => { x.clock = ev.target.value as 'business'; })}><option value="business">Working hours only</option><option value="calendar">Every hour (calendar)</option></select></label>
          <label className="sf-field"><span className="sf-label">Day starts</span><input className="in" type="time" aria-label="Day starts" value={d.hours.start} onChange={(ev) => set((x) => { x.hours.start = ev.target.value; })} /></label>
          <label className="sf-field"><span className="sf-label">Day ends</span><input className="in" type="time" aria-label="Day ends" value={d.hours.end} aria-invalid={!!e('hours.end')} onChange={(ev) => set((x) => { x.hours.end = ev.target.value; })} />{e('hours.end') && <small className="sf-err">{e('hours.end')}</small>}</label>
        </div>
        <div className="ws-days" role="group" aria-label="Working days">{DAYS.map((n, i) => <button key={n} type="button" aria-pressed={d.hours.days.includes(i)} onClick={() => set((x) => { x.hours.days = x.hours.days.includes(i) ? x.hours.days.filter((y) => y !== i) : [...x.hours.days, i].sort(); })}>{n}</button>)}</div>
        <table className="ws-table"><thead><tr><th scope="col">Priority</th><th scope="col">First reply within (hours)</th><th scope="col">Solve within (hours)</th></tr></thead>
          <tbody>{PRIORITY_KEYS.map((p) => (
            <tr key={p}><th scope="row">{PRIORITY_LABEL[p]}</th>
              <td><input className="in in-num" type="number" min="0.5" step="0.5" aria-label={`${PRIORITY_LABEL[p]} first reply hours`} value={d.targets[p].firstResponseHours} aria-invalid={!!e(`targets.${p}.firstResponseHours`)} onChange={(ev) => set((x) => { x.targets[p].firstResponseHours = Number(ev.target.value); })} />{e(`targets.${p}.firstResponseHours`) && <small className="sf-err">{e(`targets.${p}.firstResponseHours`)}</small>}</td>
              <td><input className="in in-num" type="number" min="1" aria-label={`${PRIORITY_LABEL[p]} solve hours`} value={d.targets[p].solveHours} onChange={(ev) => set((x) => { x.targets[p].solveHours = Number(ev.target.value); })} /></td></tr>
          ))}</tbody></table>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">“Due soon” when less than (%) is left</span><input className="in in-num" type="number" min="5" max="75" value={d.dueSoonPercent} onChange={(ev) => set((x) => { x.dueSoonPercent = Number(ev.target.value); })} /></label>
          <label className="sf-field"><span className="sf-label">Close solved tickets after (days, 0 = never)</span><input className="in in-num" type="number" min="0" max="90" value={d.autoCloseDays} onChange={(ev) => set((x) => { x.autoCloseDays = Number(ev.target.value); })} /></label>
        </div>
      </Panel>
      <Panel title="Categories" intro="What people can ask about, who gets it first and how urgent it is by default. “The role at the ticket’s masjid” sends a parking complaint at a masjid to that masjid’s Associate Director, for example.">
        {e('categories') && <p className="sf-err" role="alert">{e('categories')}</p>}
        <div className="ws-cats">{d.categories.map((c, i) => (
          <div key={i} className={`ws-cat glass-pane${c.archived ? ' archived' : ''}`} data-category={c.id}>
            <div className="field-row three">
              <label className="sf-field"><span className="sf-label">Name</span><input className="in" aria-label={`Category ${i + 1} name`} value={c.label} onChange={(ev) => set((x) => { x.categories[i].label = ev.target.value; })} /></label>
              <label className="sf-field"><span className="sf-label">Default priority</span><select className="in" aria-label={`Category ${i + 1} priority`} value={c.defaultPriority} onChange={(ev) => set((x) => { x.categories[i].defaultPriority = ev.target.value as 'normal'; })}>{PRIORITY_KEYS.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></label>
              <label className="sf-field"><span className="sf-label">Goes to</span>
                <select className="in" aria-label={`Category ${i + 1} goes to`} value={c.owner.kind === 'none' ? 'none' : `${c.owner.kind}:${c.owner.id}`} aria-invalid={!!e(`categories.${i}.owner.id`)} onChange={(ev) => { const v = ev.target.value; set((x) => { x.categories[i].owner = v === 'none' ? { kind: 'none', id: '' } : { kind: v.split(':')[0] as 'admin', id: v.split(':')[1] }; }); }}>
                  <option value="none">Nobody – Unassigned</option>
                  <optgroup label="A person">{admins.map((a) => <option key={a.id} value={`admin:${a.id}`}>{a.name}</option>)}</optgroup>
                  <optgroup label="The role at the ticket’s masjid">{roles.map((r) => <option key={r.id} value={`role:${r.id}`}>{r.name}</option>)}</optgroup>
                </select>{e(`categories.${i}.owner.id`) && <small className="sf-err">{e(`categories.${i}.owner.id`)}</small>}</label>
            </div>
            <label className="sf-field"><span className="sf-label">Description shown on the form</span><input className="in" aria-label={`Category ${i + 1} description`} value={c.description} onChange={(ev) => set((x) => { x.categories[i].description = ev.target.value; })} /></label>
            <div className="ws-cat-flags">
              <label><input type="checkbox" checked={c.onWebsite} onChange={(ev) => set((x) => { x.categories[i].onWebsite = ev.target.checked; })} /> On the website and portal forms</label>
              <label><input type="checkbox" checked={c.restricted} aria-label={`Category ${i + 1} restricted`} onChange={(ev) => set((x) => { x.categories[i].restricted = ev.target.checked; })} /> Restricted (private)</label>
              <label>When late, tell <select className="in in-sm" aria-label={`Category ${i + 1} escalate to`} value={c.escalateTo} onChange={(ev) => set((x) => { x.categories[i].escalateTo = ev.target.value; })}><option value="">the owner only</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              <button type="button" className="btn sm ghost" onClick={() => set((x) => { x.categories[i].archived = !x.categories[i].archived; })}>{c.archived ? 'Use again' : 'Stop using'}</button>
            </div>
          </div>
        ))}</div>
        <button type="button" className="btn sm" onClick={() => set((x) => { x.categories.push({ id: uniq('new-category', x.categories.map((c) => c.id)), label: 'New category', description: '', defaultPriority: 'normal', owner: { kind: 'none', id: '' }, onWebsite: true, restricted: false, escalateTo: '', archived: false }); })}>Add a category</button>
        <div className="field-row"><label className="sf-field"><span className="sf-label">Roles that also see restricted tickets</span>
          <select className="in" multiple size={5} aria-label="Senior roles" value={d.seniorRoles} onChange={(ev) => set((x) => { x.seniorRoles = Array.from(ev.target.selectedOptions).map((o) => o.value); })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <small className="sf-hint">Besides the owner, the person who wrote it and anyone following it.</small></label></div>
      </Panel>
      <Panel title="Saved replies" intro={<>Kind, consistent answers. Fields you can use: {MERGE.map((m) => <code key={m}>{`{{${m}}}`} </code>)}</>}>
        <label className="sf-field"><span className="sf-label">Automatic acknowledgement</span><textarea className="in in-area" rows={2} aria-label="Acknowledgement" value={d.acknowledgement} onChange={(ev) => set((x) => { x.acknowledgement = ev.target.value; })} />
          {unfilledFields(d.acknowledgement).filter((f) => !MERGE.includes(f)).length > 0 && <small className="sf-err">Unknown field: {unfilledFields(d.acknowledgement).filter((f) => !MERGE.includes(f)).join(', ')}</small>}</label>
        {d.savedReplies.map((r, i) => {
          const bad = unfilledFields(r.body).filter((f) => !MERGE.includes(f));
          return (
            <div key={i} className="ws-reply glass-pane" data-reply={r.id}>
              <div className="field-row">
                <label className="sf-field"><span className="sf-label">Title</span><input className="in" aria-label={`Reply ${i + 1} title`} value={r.title} onChange={(ev) => set((x) => { x.savedReplies[i].title = ev.target.value; })} /></label>
                <label className="sf-field"><span className="sf-label">Only for</span><select className="in" aria-label={`Reply ${i + 1} category`} value={r.categoryId} onChange={(ev) => set((x) => { x.savedReplies[i].categoryId = ev.target.value; })}><option value="">Every category</option>{d.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
              </div>
              <label className="sf-field"><span className="sf-label">Text</span><textarea className="in in-area" rows={4} aria-label={`Reply ${i + 1} text`} value={r.body} onChange={(ev) => set((x) => { x.savedReplies[i].body = ev.target.value; })} />{bad.length > 0 && <small className="sf-err">Unknown field: {bad.join(', ')}</small>}</label>
              <button type="button" className="btn sm ghost" onClick={() => set((x) => { x.savedReplies.splice(i, 1); })}>Remove</button>
            </div>
          );
        })}
        <button type="button" className="btn sm" onClick={() => set((x) => { x.savedReplies.push({ id: uniq('reply', x.savedReplies.map((r) => r.id)), title: 'New reply', body: 'Assalamu alaikum {{first_name}},\n\n\n{{agent}}', categoryId: '' }); })}>Add a saved reply</button>
      </Panel>
    </div>
  );
}

function TasksSettings({ doc }: { doc: Doc }) {
  const access = useAccess();
  const d = doc.draft.tasks;
  const set = (f: (x: WorkSettings['tasks']) => void) => doc.setDraft((x) => { const n = structuredClone(x); f(n.tasks); return n; });
  const e = (k: string) => doc.issues[`tasks.${k}`];
  return (
    <div className="cv ws">
      <Panel title="Board columns" intro="The four steps every task goes through. Change the words; the steps stay the same so reports keep working.">
        <SwitchRow id="ws-tasks-on" label="Use team tasks" checked={d.enabled} onChange={(v) => set((x) => { x.enabled = v; })} />
        <div className="field-row">{TASK_STATUS_KEYS.map((k) => <label key={k} className="sf-field"><span className="sf-label">{k === 'todo' ? 'Not started' : k === 'doing' ? 'In progress' : k === 'waiting' ? 'Blocked' : 'Finished'}</span><input className="in" aria-label={`Column ${k}`} value={d.statusLabels[k]} onChange={(ev) => set((x) => { x.statusLabels[k] = ev.target.value; })} /></label>)}</div>
      </Panel>
      <Panel title="Labels">
        <div className="ws-labels">{d.labels.map((l, i) => (
          <span key={i} className="ws-label-edit"><input className="in in-sm" aria-label={`Label ${i + 1}`} value={l.label} onChange={(ev) => set((x) => { x.labels[i].label = ev.target.value; })} />
            <select className="in in-sm" aria-label={`Label ${i + 1} color`} value={l.color} onChange={(ev) => set((x) => { x.labels[i].color = ev.target.value as 'gray'; })}>{['green', 'blue', 'amber', 'red', 'violet', 'gray'].map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <button type="button" className="icon-btn sm" aria-label={`Remove label ${l.label}`} onClick={() => set((x) => { x.labels.splice(i, 1); })}>×</button></span>
        ))}</div>
        <button type="button" className="btn sm" onClick={() => set((x) => { x.labels.push({ id: uniq('label', x.labels.map((l) => l.id)), label: 'New label', color: 'gray' }); })}>Add a label</button>
      </Panel>
      <Panel title="Project templates" intro="A template is a list of tasks with days counted from an anchor day (minus = before). Creating a project from it sets every due date at once.">
        {d.templates.map((t, i) => (
          <details key={i} className="ws-tpl glass-pane" data-template={t.id}>
            <summary><b>{t.name}</b> <span className="muted small">{t.tasks.length} tasks · anchor “{t.anchorLabel}”</span></summary>
            <div className="field-row">
              <label className="sf-field"><span className="sf-label">Name</span><input className="in" aria-label={`Template ${i + 1} name`} value={t.name} onChange={(ev) => set((x) => { x.templates[i].name = ev.target.value; })} /></label>
              <label className="sf-field"><span className="sf-label">Anchor day is called</span><input className="in" aria-label={`Template ${i + 1} anchor`} value={t.anchorLabel} onChange={(ev) => set((x) => { x.templates[i].anchorLabel = ev.target.value; })} /></label>
            </div>
            <table className="ws-table"><thead><tr><th scope="col">Task</th><th scope="col">Days from anchor</th><th scope="col">Usually done by</th><th scope="col">Checklist (one per line)</th><th /></tr></thead>
              <tbody>{t.tasks.map((k, j) => (
                <tr key={j}>
                  <td><input className="in" aria-label={`Template ${i + 1} task ${j + 1}`} value={k.title} onChange={(ev) => set((x) => { x.templates[i].tasks[j].title = ev.target.value; })} /></td>
                  <td><input className="in in-num" type="number" aria-label={`Template ${i + 1} task ${j + 1} days`} value={k.offsetDays} onChange={(ev) => set((x) => { x.templates[i].tasks[j].offsetDays = Math.round(Number(ev.target.value)); })} /></td>
                  <td><select className="in" aria-label={`Template ${i + 1} task ${j + 1} role`} value={k.roleId} onChange={(ev) => set((x) => { x.templates[i].tasks[j].roleId = ev.target.value; })}><option value="">The project creator</option>{access.doc.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                  <td><textarea className="in in-area" rows={2} aria-label={`Template ${i + 1} task ${j + 1} checklist`} value={k.checklist.join('\n')} onChange={(ev) => set((x) => { x.templates[i].tasks[j].checklist = ev.target.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 30); })} /></td>
                  <td><button type="button" className="icon-btn sm" aria-label="Remove task" onClick={() => set((x) => { x.templates[i].tasks.splice(j, 1); })}>×</button></td>
                </tr>
              ))}</tbody></table>
            {e(`templates.${i}.tasks`) && <p className="sf-err">{e(`templates.${i}.tasks`)}</p>}
            <div className="row-actions">
              <button type="button" className="btn sm" onClick={() => set((x) => { x.templates[i].tasks.push({ title: 'New task', offsetDays: 0, priority: 'normal', checklist: [], roleId: '' }); })}>Add a task</button>
              <button type="button" className="btn sm ghost" onClick={() => set((x) => { x.templates.splice(i, 1); })}>Remove template</button>
            </div>
          </details>
        ))}
        <button type="button" className="btn sm" onClick={() => set((x) => { const name = 'New template'; x.templates.push({ id: uniq(slugify(name), x.templates.map((t) => t.id)), name, description: '', anchorLabel: 'Event day', tasks: [{ title: 'First step', offsetDays: -14, priority: 'normal', checklist: [], roleId: '' }] }); })}>Add a template</button>
      </Panel>
    </div>
  );
}

/* ---------------- D5 – Work queues: who gets what by default, targets, escalation, the follow-up queues ---------------- */
const MISSING_FIELDS = [['phone', 'Mobile number'], ['address', 'Home address'], ['dob', 'Date of birth'], ['id', 'Photo ID check'], ['email', 'Email address']] as const;
function QueuesSettings({ doc }: { doc: Doc }) {
  const access = useAccess();
  const q = doc.draft.queues;
  const set = (f: (x: WorkSettings['queues']) => void) => doc.setDraft((x) => { const n = structuredClone(x); f(n.queues); return n; });
  const admins = access.doc.admins.filter((a) => a.status === 'active');
  const roles = access.doc.roles;
  const nameOf = (id: string) => admins.find((a) => a.id === id)?.name ?? roles.find((r) => r.id === id)?.name ?? id;
  const sample = (key: string) => { const who = routeQueueCase(q.routing[key], '', admins as unknown as AdminLike[], `sample-${key}`); return who ? nameOf(who) : 'Unassigned'; };
  return (
    <div className="cv ws">
      <Panel title="Who gets each kind of case" intro="The system fills these queues by itself (new applications, uploaded IDs, center requests…). Say who they land on, so nobody has to pick through a shared pile. A person can take any case by hand, and a manager can hand one over – these are the defaults.">
        <table className="m-grid compact ws-routing">
          <thead><tr><th scope="col">Queue</th><th scope="col">Goes to</th><th scope="col">Spread</th><th scope="col">Target (days)</th><th scope="col">When late, tell</th><th scope="col">Today it would land on</th></tr></thead>
          <tbody>{QUEUE_KEYS.map((key) => { const r = q.routing[key] ?? { owners: [], share: 'round-robin' as const, targetDays: 7, escalateTo: '', label: '' }; const ensure = (f: (rr: typeof r) => void) => set((x) => { x.routing[key] ??= { owners: [], share: 'round-robin', targetDays: 7, escalateTo: '', label: '' }; f(x.routing[key]); }); return (
            <tr key={key} data-queue={key}>
              <th scope="row"><input className="in sm" aria-label={`${QUEUE_LABEL[key]} – name`} value={r.label || QUEUE_LABEL[key]} onChange={(ev) => ensure((rr) => { rr.label = ev.target.value === QUEUE_LABEL[key] ? '' : ev.target.value; })} /></th>
              <td>
                <ul className="ws-owners">{r.owners.map((o, j) => <li key={j}><span className="pill">{o.kind === 'role' ? 'role' : 'person'}</span> {nameOf(o.id)} <button type="button" className="sf-icon" aria-label={`Remove ${nameOf(o.id)} from ${QUEUE_LABEL[key]}`} onClick={() => ensure((rr) => { rr.owners.splice(j, 1); })}>×</button></li>)}</ul>
                <select className="in sm" aria-label={`Add who gets ${QUEUE_LABEL[key]}`} value="" onChange={(ev) => { const v = ev.target.value; if (!v) return; ensure((rr) => { if (rr.owners.length < 10 && !rr.owners.some((o) => `${o.kind}:${o.id}` === v)) rr.owners.push({ kind: v.split(':')[0] as 'admin', id: v.split(':')[1] }); }); }}>
                  <option value="">+ Add a person or role…</option>
                  <optgroup label="People">{admins.map((a) => <option key={a.id} value={`admin:${a.id}`}>{a.name}</option>)}</optgroup>
                  <optgroup label="Roles (the role at the case's masjid)">{roles.map((ro) => <option key={ro.id} value={`role:${ro.id}`}>{ro.name}</option>)}</optgroup>
                </select>
              </td>
              <td><select className="in sm" aria-label={`${QUEUE_LABEL[key]} – spread`} value={r.share} onChange={(ev) => ensure((rr) => { rr.share = ev.target.value as 'first'; })}><option value="round-robin">Evenly (round-robin)</option><option value="first">Always the first</option></select></td>
              <td><input className="in sm in-num" type="number" min={1} max={90} aria-label={`${QUEUE_LABEL[key]} – target days`} value={r.targetDays} onChange={(ev) => ensure((rr) => { rr.targetDays = Math.max(1, Math.min(90, Number(ev.target.value || 1))); })} /></td>
              <td><select className="in sm" aria-label={`${QUEUE_LABEL[key]} – escalate to`} value={r.escalateTo} onChange={(ev) => ensure((rr) => { rr.escalateTo = ev.target.value; })}><option value="">Nobody</option>{roles.map((ro) => <option key={ro.id} value={ro.id}>{ro.name}</option>)}</select></td>
              <td className="muted small" data-sample={key}>{sample(key)}</td>
            </tr>); })}</tbody>
        </table>
      </Panel>
      <Panel title="Follow-up queues" intro="Two queues the office asked for: people who stopped half-way through the join form, and members whose record is missing something.">
        <SwitchRow id="ws-q-inc" label="Incomplete applications – follow up people who verified their email and left" checked={q.followUps.incomplete.enabled} onChange={(v) => set((x) => { x.followUps.incomplete.enabled = v; })} />
        {q.followUps.incomplete.enabled && <div className="field-row">
          <label className="sf-field"><span className="sf-label">First automatic reminder after (hours)</span><input className="in in-num" type="number" min={1} max={720} aria-label="Reminder after hours" value={q.followUps.incomplete.afterHours} onChange={(ev) => set((x) => { x.followUps.incomplete.afterHours = Math.max(1, Math.min(720, Number(ev.target.value || 1))); })} /></label>
          <label className="sf-field"><span className="sf-label">Give up after (days)</span><input className="in in-num" type="number" min={1} max={365} aria-label="Give up after days" value={q.followUps.incomplete.giveUpDays} onChange={(ev) => set((x) => { x.followUps.incomplete.giveUpDays = Math.max(1, Math.min(365, Number(ev.target.value || 1))); })} /></label>
        </div>}
        <SwitchRow id="ws-q-mis" label="Missing information – chase members whose record lacks what the office needs" checked={q.followUps.missing.enabled} onChange={(v) => set((x) => { x.followUps.missing.enabled = v; })} />
        {q.followUps.missing.enabled && <div className="chip-row" role="group" aria-label="What counts as missing">
          {MISSING_FIELDS.map(([k, l]) => <button key={k} type="button" aria-pressed={q.followUps.missing.fields.includes(k)} onClick={() => set((x) => { const f = x.followUps.missing.fields; x.followUps.missing.fields = f.includes(k) ? f.filter((y) => y !== k) : [...f, k]; })}>{l}</button>)}
        </div>}
        <SwitchRow id="ws-q-today" label="Show “On your desk” first when someone signs in" checked={q.todayOnSignIn} onChange={(v) => set((x) => { x.todayOnSignIn = v; })} />
      </Panel>
    </div>
  );
}
