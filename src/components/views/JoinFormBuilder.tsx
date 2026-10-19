'use client';
/**
 * Membership › Join form builder. The admin decides what the sign-up form asks:
 *  - Bylaws core fields are locked in place (rename them, change help text, switch off the optional ones);
 *  - sections of extra questions, inside a core step or as their own step; questions with type, required, choices,
 *    "show only if" rules, which plans see them, who may see the answer, prefill from last year;
 *  - smart helpers (scan ID, save for later, renew with last year's answers, Google).
 * Every change shows at once in the live preview of the real sign-up page; Publish makes it live (with history).
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { DocEditor, type DocApi } from '@/components/editor/DocEditor';
import { SwitchRow } from '@/components/editor/bits';
import type { PreviewHandle } from '@/components/editor/LivePreview';
import { useDoc } from '@/lib/store/use-doc';
import { memberClass, type MembershipRules, type MembershipSettings } from '@/lib/content/membership';
import {
  CORE_FIELDS, FIELD_TYPE_LABEL, FIELD_TYPES, PLACEMENT_LABEL, PLACEMENTS, VISIBILITY, VISIBILITY_LABEL,
  type CoreKey, type FieldType, type JoinField, type JoinForm, type JoinSection, type Placement,
} from '@/lib/join/form-def';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'question';
const uniqueId = (base: string, taken: Set<string>) => { let id = /^[a-z]/.test(base) ? base : `q-${base}`; let n = 2; while (taken.has(id)) id = `${base}-${n++}`; return id; };
const CHOICE_TYPES: FieldType[] = ['select', 'radio', 'checkboxes'];
const STEP_OF: Record<Placement, string> = { about: 'about', plan: 'plan', pledge: 'pledge', 'step-after-about': '', 'step-after-plan': '', 'step-after-pledge': '' };
const OPS = { equals: 'is', notEquals: 'is not', includes: 'includes', answered: 'is answered', atLeast: 'is at least', atMost: 'is at most' } as const;
const CORE_ORDER: { step: string; title: string; keys: CoreKey[] }[] = [
  { step: 'about', title: 'About you', keys: ['firstName', 'lastName', 'middleName', 'preferredName', 'dob', 'phone', 'address', 'unit'] },
  { step: 'plan', title: 'Plan', keys: ['plan'] },
  { step: 'pledge', title: 'Pledge', keys: ['commitments', 'pledge'] },
];

export function JoinFormBuilderView() {
  return (
    <DocEditor<JoinForm> storeKey="join-form" title="Join form builder"
      intro="Decide what the sign-up form asks. Bylaws fields stay locked in place; add your own questions inside a step or as a new step. Changes show in the preview at once – Publish to make them live.">
      {(doc, previewRef) => <Builder doc={doc} previewRef={previewRef} />}
    </DocEditor>
  );
}

function Builder({ doc, previewRef }: { doc: DocApi<JoinForm>; previewRef: React.RefObject<PreviewHandle | null> }) {
  const form = doc.draft;
  const settings = useDoc<MembershipSettings>('membership-settings');
  const plans = settings.status === 'ready' ? settings.draft.plans : [];
  const rules = settings.status === 'ready' ? settings.draft.rules : undefined;
  const [open, setOpen] = useState<string | null>(null);           // field being edited
  const [focusStep, setFocusStep] = useState<string>('about');      // step shown in the preview
  const [coreOpen, setCoreOpen] = useState<CoreKey | null>(null);

  // live preview: push the unsaved definition into the sign-up page
  const push = useCallback(() => previewRef.current?.post({ type: 'isgh:preview-join-form', form, step: focusStep }), [form, focusStep, previewRef]);
  useEffect(() => { const t = setTimeout(push, 150); return () => clearTimeout(t); }, [push]);
  useEffect(() => { const on = (e: MessageEvent) => { if (e.data?.type === 'isgh:preview-ready') push(); }; window.addEventListener('message', on); return () => window.removeEventListener('message', on); }, [push]);

  const update = (fn: (f: JoinForm) => JoinForm) => doc.setDraft((f) => fn(structuredClone(f)));
  const allIds = new Set(form.sections.flatMap((s) => s.fields.map((f) => f.id)));
  const issueAt = (prefix: string) => Object.entries(doc.issues).filter(([p]) => p === prefix || p.startsWith(prefix + '.')).map(([, m]) => m);
  const stepFor = (s: JoinSection) => STEP_OF[s.placement] || `s:${s.id}`;

  const addSection = () => update((f) => {
    const id = uniqueId('section', new Set(f.sections.map((s) => s.id)));
    f.sections.push({ id, title: 'New section', placement: 'step-after-plan', hidden: false, fields: [] });
    setFocusStep(`s:${id}`); return f;
  });
  const addField = (si: number, type: FieldType = 'text') => update((f) => {
    const id = uniqueId('question', allIds);
    f.sections[si].fields.push({ id, type, label: 'New question', required: false, plans: [], visibility: 'staff', prefill: 'none', hidden: false, ...(CHOICE_TYPES.includes(type) ? { options: [{ value: 'option-1', label: 'Option 1' }] } : {}) });
    setOpen(`${f.sections[si].id}#${f.sections[si].fields.length - 1}`); setFocusStep(stepFor(f.sections[si])); return f;
  });
  const moveSection = (si: number, d: -1 | 1) => update((f) => { const t = si + d; if (t < 0 || t >= f.sections.length) return f; [f.sections[si], f.sections[t]] = [f.sections[t], f.sections[si]]; return f; });

  return (
    <div className="jfb">
      <section className="panel glass-pane" aria-labelledby="jfb-help">
        <h2 id="jfb-help" className="panel-h">Smart helpers</h2>
        <p className="panel-intro">These fill in answers for the member, so the form feels short.</p>
        <div className="jfb-switches">
          <SwitchRow id="h-id" label="Scan photo ID" help="Fills name, date of birth and address from a photo of a Texas ID or license; the photo also counts as the photo ID check." checked={form.helpers.idScan} onChange={(v) => update((f) => { f.helpers.idScan = v; return f; })} />
          <SwitchRow id="h-renew" label="Renew with last year’s answers" help="Existing members start from what they told us last year (questions marked “prefill”)." checked={form.helpers.renewPrefill} onChange={(v) => update((f) => { f.helpers.renewPrefill = v; return f; })} />
          <SwitchRow id="h-save" label="Save and finish later" help="Gives a link to continue on any device (emailed and texted; 30 days)." checked={form.helpers.saveForLater} onChange={(v) => update((f) => { f.helpers.saveForLater = v; return f; })} />
          <SwitchRow id="h-google" label="Continue with Google" help="Verified email and name from Google; no code needed." checked={form.helpers.google} onChange={(v) => update((f) => { f.helpers.google = v; return f; })} />
        </div>
        <label className="sf-label" htmlFor="jfb-intro">Short line at the top of “About you”</label>
        <input id="jfb-intro" className="in" maxLength={400} value={form.intro ?? ''} onChange={(e) => update((f) => { f.intro = e.target.value; return f; })} />
      </section>

      <section className="panel glass-pane" aria-labelledby="jfb-outline">
        <div className="row-between"><h2 id="jfb-outline" className="panel-h">Form outline</h2><button className="btn sm" onClick={addSection}>Add section</button></div>
        <p className="panel-intro">The order the member sees. Locked fields come from the Bylaws – you can rename them but not remove them.</p>
        <ol className="jfb-steps">
          <StepRow title="Email" locked note="Google or a 6-digit code. Checks for an existing membership." onPreview={() => setFocusStep('account')} active={focusStep === 'account'} />
          {CORE_ORDER.map((c) => (
            <li key={c.step} className="jfb-steplist">
              <StepRow title={c.title} core onPreview={() => setFocusStep(c.step)} active={focusStep === c.step} />
              <div className="jfb-core">
                {c.keys.map((k) => (
                  <button key={k} type="button" className={`jfb-chip${CORE_FIELDS[k].required ? ' locked' : ''}${form.core[k]?.show === false ? ' off' : ''}`} aria-expanded={coreOpen === k} onClick={() => setCoreOpen(coreOpen === k ? null : k)}>
                    {CORE_FIELDS[k].required && <LockIcon />}{form.core[k]?.label || CORE_FIELDS[k].label}{form.core[k]?.show === false && ' (off)'}
                  </button>
                ))}
              </div>
              {coreOpen && c.keys.includes(coreOpen) && <CoreEditor k={coreOpen} form={form} update={update} />}
              {form.sections.map((s, si) => s.placement === c.step && <SectionCard key={s.id} s={s} si={si} n={form.sections.length} {...{ form, update, open, setOpen, addField, moveSection, issueAt, plans, rules, setFocusStep, stepFor }} />)}
              {form.sections.map((s, si) => s.placement === `step-after-${c.step}` && (
                <div key={s.id} className="jfb-ownstep"><StepRow title={s.title} custom onPreview={() => setFocusStep(`s:${s.id}`)} active={focusStep === `s:${s.id}`} />
                  <SectionCard s={s} si={si} n={form.sections.length} {...{ form, update, open, setOpen, addField, moveSection, issueAt, plans, rules, setFocusStep, stepFor }} /></div>
              ))}
            </li>
          ))}
          <StepRow title="Review and pay" locked note="Who is paying (own dues or a relative – Bylaws), price, voting check." onPreview={() => setFocusStep('review')} active={focusStep === 'review'} />
        </ol>
      </section>
    </div>
  );
}

function StepRow({ title, note, locked, core, custom, onPreview, active }: { title: string; note?: string; locked?: boolean; core?: boolean; custom?: boolean; onPreview: () => void; active: boolean }) {
  return (
    <div className={`jfb-step${active ? ' on' : ''}`}>
      <span className={`jfb-kind ${custom ? 'custom' : 'core'}`}>{custom ? 'Your step' : locked ? 'Fixed step' : 'Bylaws step'}</span>
      <b>{title}</b>{note && <small>{note}</small>}
      <button type="button" className="linkish jfb-pv" onClick={onPreview} aria-pressed={active}>{active ? 'In preview' : 'Show in preview'}</button>
      {core && null}
    </div>
  );
}

function CoreEditor({ k, form, update }: { k: CoreKey; form: JoinForm; update: (fn: (f: JoinForm) => JoinForm) => void }) {
  const meta = CORE_FIELDS[k]; const o = form.core[k] ?? {};
  const set = (patch: Partial<typeof o>) => update((f) => { f.core[k] = { ...f.core[k], ...patch }; if (!f.core[k].label) delete f.core[k].label; if (!f.core[k].help) delete f.core[k].help; return f; });
  return (
    <div className="jfb-edit glass-pane" role="group" aria-label={`Edit ${meta.label}`}>
      {meta.required ? <p className="jfb-why"><LockIcon /> Always asked and required. {meta.why}</p> : <SwitchRow id={`core-${k}-show`} label="Ask this" checked={o.show !== false} onChange={(v) => set({ show: v })} />}
      <div className="field-row">
        <label className="sf-field"><span className="sf-label">Label</span><input className="in" value={o.label ?? ''} placeholder={meta.label} maxLength={80} onChange={(e) => set({ label: e.target.value })} /></label>
        <label className="sf-field"><span className="sf-label">Help text</span><input className="in" value={o.help ?? ''} placeholder="Optional" maxLength={300} onChange={(e) => set({ help: e.target.value })} /></label>
      </div>
    </div>
  );
}

type CardProps = { s: JoinSection; si: number; n: number; form: JoinForm; update: (fn: (f: JoinForm) => JoinForm) => void; open: string | null; setOpen: (id: string | null) => void; rules?: MembershipRules;
  addField: (si: number, t?: FieldType) => void; moveSection: (si: number, d: -1 | 1) => void; issueAt: (p: string) => string[]; plans: { id: string; name: string }[]; setFocusStep: (s: string) => void; stepFor: (s: JoinSection) => string };

function SectionCard({ s, si, n, form, update, open, setOpen, addField, moveSection, issueAt, plans, rules, setFocusStep, stepFor }: CardProps) {
  const [confirmDel, setConfirmDel] = useState(false);
  const problems = issueAt(`sections.${si}`);
  // the open editor is remembered by place (section + position), so renaming a question's id never closes it
  const keyOf = (fi: number) => `${s.id}#${fi}`;
  const moveField = (fi: number, d: -1 | 1) => { const t = fi + d; if (t < 0 || t >= s.fields.length) return; if (open === keyOf(fi)) setOpen(keyOf(t)); else if (open === keyOf(t)) setOpen(keyOf(fi)); update((f) => { const a = f.sections[si].fields; [a[fi], a[t]] = [a[t], a[fi]]; return f; }); };
  return (
    <div className={`jfb-section${s.hidden ? ' off' : ''}${problems.length ? ' has-err' : ''}`} data-section={s.id} onFocusCapture={() => setFocusStep(stepFor(s))}>
      <div className="jfb-sec-head">
        <input className="in jfb-sec-title" aria-label="Section title" value={s.title} maxLength={80} onChange={(e) => update((f) => { f.sections[si].title = e.target.value; return f; })} />
        <select className="in pill-select" aria-label="Where it appears" value={s.placement} onChange={(e) => update((f) => { f.sections[si].placement = e.target.value as Placement; return f; })}>
          {PLACEMENTS.map((p) => <option key={p} value={p}>{PLACEMENT_LABEL[p]}</option>)}
        </select>
        <div className="jfb-tools">
          <button type="button" className="icon-btn sm" aria-label="Move section up" disabled={si === 0} onClick={() => moveSection(si, -1)}>↑</button>
          <button type="button" className="icon-btn sm" aria-label="Move section down" disabled={si === n - 1} onClick={() => moveSection(si, 1)}>↓</button>
          <button type="button" className="btn sm" aria-pressed={s.hidden} onClick={() => update((f) => { f.sections[si].hidden = !f.sections[si].hidden; return f; })}>{s.hidden ? 'Hidden' : 'Hide'}</button>
          {confirmDel ? <><button type="button" className="btn sm danger" onClick={() => update((f) => { f.sections.splice(si, 1); return f; })}>Delete section</button><button type="button" className="linkish" onClick={() => setConfirmDel(false)}>Keep</button></>
            : <button type="button" className="btn sm danger-ghost" onClick={() => setConfirmDel(true)}>Delete</button>}
        </div>
      </div>
      <input className="in jfb-sec-intro" aria-label="Section intro (optional)" placeholder="Intro text (optional)" value={s.intro ?? ''} maxLength={400} onChange={(e) => update((f) => { f.sections[si].intro = e.target.value || undefined; return f; })} />
      <ul className="jfb-fields">
        {s.fields.map((fl, fi) => (
          <li key={fi} className={`jfb-field${fl.hidden ? ' off' : ''}${issueAt(`sections.${si}.fields.${fi}`).length ? ' has-err' : ''}`}>
            <div className="jfb-frow">
              <span className="jfb-type">{FIELD_TYPE_LABEL[fl.type]}</span>
              <button type="button" className="jfb-flabel" aria-expanded={open === keyOf(fi)} onClick={() => setOpen(open === keyOf(fi) ? null : keyOf(fi))}>{fl.label || 'Untitled question'}</button>
              {fl.required && <span className="jfb-tag req">Required</span>}
              {fl.showIf && <span className="jfb-tag rule">Only if…</span>}
              {fl.plans.length > 0 && <span className="jfb-tag">{fl.plans.length} plan{fl.plans.length > 1 ? 's' : ''}</span>}
              {fl.visibility === 'board' && <span className="jfb-tag">Board only</span>}
              {fl.hidden && <span className="jfb-tag">Off</span>}
              <span className="jfb-ftools">
                <button type="button" className="icon-btn sm" aria-label={`Move ${fl.label} up`} disabled={fi === 0} onClick={() => moveField(fi, -1)}>↑</button>
                <button type="button" className="icon-btn sm" aria-label={`Move ${fl.label} down`} disabled={fi === s.fields.length - 1} onClick={() => moveField(fi, 1)}>↓</button>
              </span>
            </div>
            {issueAt(`sections.${si}.fields.${fi}`).map((m) => <p key={m} className="sf-err">{m}</p>)}
            {open === keyOf(fi) && <FieldEditor f={fl} si={si} fi={fi} form={form} update={update} plans={plans} rules={rules} onClose={() => setOpen(null)} />}
          </li>
        ))}
      </ul>
      <div className="jfb-add">
        <button type="button" className="btn sm" onClick={() => addField(si)}>Add question</button>
        <button type="button" className="linkish" onClick={() => addField(si, 'select')}>+ Drop-down</button>
        <button type="button" className="linkish" onClick={() => addField(si, 'checkboxes')}>+ Pick any</button>
        <button type="button" className="linkish" onClick={() => addField(si, 'yesno')}>+ Yes / No</button>
      </div>
    </div>
  );
}

function FieldEditor({ f, si, fi, form, update, plans, rules, onClose }: { f: JoinField; si: number; fi: number; form: JoinForm; update: (fn: (f: JoinForm) => JoinForm) => void; plans: { id: string; name: string }[]; rules?: MembershipRules; onClose: () => void }) {
  const set = (patch: Partial<JoinField>) => update((x) => { x.sections[si].fields[fi] = { ...x.sections[si].fields[fi], ...patch }; return x; });
  const [confirmDel, setConfirmDel] = useState(false);
  const others = form.sections.flatMap((s) => s.fields).filter((x) => x.id !== f.id && x.type !== 'info');
  const ruleField = f.showIf?.field;
  const ruleTarget = others.find((x) => x.id === ruleField);
  const ruleChoices = ruleField === 'plan.category' ? [{ value: 'individual', label: 'One person' }, { value: 'household', label: 'Family (household)' }]
    : ruleField === 'plan.memberClass' ? [{ value: 'natural', label: memberClass(rules, 'natural').label }, { value: 'associate', label: memberClass(rules, 'associate').label }]
    : ruleField === 'plan.planId' ? plans.map((p) => ({ value: p.id, label: p.name }))
    : ruleTarget?.type === 'yesno' ? [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] : ruleTarget?.options;
  const setOptions = (labels: string[]) => {
    const seen = new Set<string>();
    set({ options: labels.map((l, i) => { let v = slugify(l) || `option-${i + 1}`; while (seen.has(v)) v += '-x'; seen.add(v); return { value: v, label: l }; }) });
  };
  return (
    <div className="jfb-edit glass-pane" role="group" aria-label={`Edit ${f.label}`}>
      <div className="field-row">
        <label className="sf-field"><span className="sf-label">Question</span><input className="in" value={f.label} maxLength={160} onChange={(e) => set({ label: e.target.value })} /></label>
        <label className="sf-field"><span className="sf-label">Answer type</span>
          <select className="in" value={f.type} onChange={(e) => { const t = e.target.value as FieldType; set({ type: t, ...(CHOICE_TYPES.includes(t) && !f.options?.length ? { options: [{ value: 'option-1', label: 'Option 1' }] } : {}) }); }}>
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>)}
          </select></label>
      </div>
      <label className="sf-field"><span className="sf-label">Help text <span className="sf-opt">optional</span></span><input className="in" value={f.help ?? ''} maxLength={400} onChange={(e) => set({ help: e.target.value || undefined })} /></label>
      {CHOICE_TYPES.includes(f.type) && (
        <label className="sf-field"><span className="sf-label">Choices – one per line</span>
          <textarea className="in in-area" rows={Math.min(8, (f.options?.length ?? 1) + 1)} value={(f.options ?? []).map((o) => o.label).join('\n')} onChange={(e) => setOptions(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />
          <small className="sf-hint">Changing a choice’s words keeps answers only if the meaning stays the same.</small></label>
      )}
      {f.type === 'number' && <div className="field-row">
        <label className="sf-field"><span className="sf-label">Lowest</span><input className="in in-num" type="number" value={f.min ?? ''} onChange={(e) => set({ min: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        <label className="sf-field"><span className="sf-label">Highest</span><input className="in in-num" type="number" value={f.max ?? ''} onChange={(e) => set({ max: e.target.value === '' ? undefined : Number(e.target.value) })} /></label></div>}
      {['text', 'textarea'].includes(f.type) && <div className="field-row">
        <label className="sf-field"><span className="sf-label">Example answer <span className="sf-opt">optional</span></span><input className="in" value={f.placeholder ?? ''} maxLength={80} onChange={(e) => set({ placeholder: e.target.value || undefined })} /></label>
        <label className="sf-field"><span className="sf-label">Longest answer (characters)</span><input className="in in-num" type="number" min={1} value={f.maxLength ?? ''} onChange={(e) => set({ maxLength: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) })} /></label></div>}

      <div className="jfb-switches">
        {f.type !== 'info' && <SwitchRow id={`${f.id}-req`} label="Required" checked={f.required} onChange={(v) => set({ required: v })} help="Only when the question is shown." />}
        {f.type !== 'info' && <SwitchRow id={`${f.id}-pre`} label="Prefill from last year" checked={f.prefill === 'lastYear'} onChange={(v) => set({ prefill: v ? 'lastYear' : 'none' })} help="Renewing members see last year’s answer to confirm." />}
        <SwitchRow id={`${f.id}-off`} label="Switched off" checked={f.hidden} onChange={(v) => set({ hidden: v })} help="Stop asking without deleting earlier answers." />
      </div>

      <fieldset className="jfb-rule">
        <legend>Show only if</legend>
        <div className="field-row three">
          <select className="in" aria-label="Depends on" value={f.showIf?.field ?? ''} onChange={(e) => set({ showIf: e.target.value ? { field: e.target.value, op: 'equals', value: '' } : undefined })}>
            <option value="">Always show</option>
            <optgroup label="Membership"><option value="plan.category">Plan type</option><option value="plan.planId">Plan</option><option value="plan.memberClass">Joining as</option><option value="about.age">Age</option></optgroup>
            <optgroup label="Other questions">{others.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
          </select>
          {f.showIf && <select className="in" aria-label="Condition" value={f.showIf.op} onChange={(e) => set({ showIf: { ...f.showIf!, op: e.target.value as keyof typeof OPS } })}>
            {Object.entries(OPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>}
          {f.showIf && f.showIf.op !== 'answered' && (ruleChoices?.length
            ? <select className="in" aria-label="Value" value={f.showIf.value ?? ''} onChange={(e) => set({ showIf: { ...f.showIf!, value: e.target.value } })}><option value="">Choose…</option>{ruleChoices.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input className="in" aria-label="Value" value={f.showIf.value ?? ''} onChange={(e) => set({ showIf: { ...f.showIf!, value: e.target.value } })} placeholder="Value" />)}
        </div>
      </fieldset>

      {plans.length > 0 && (
        <fieldset className="jfb-rule">
          <legend>Ask on these plans</legend>
          <div className="chip-row">
            <button type="button" aria-pressed={f.plans.length === 0} onClick={() => set({ plans: [] })}>All plans</button>
            {plans.map((p) => <button key={p.id} type="button" aria-pressed={f.plans.includes(p.id)} onClick={() => set({ plans: f.plans.includes(p.id) ? f.plans.filter((x) => x !== p.id) : [...f.plans, p.id] })}>{p.name}</button>)}
          </div>
        </fieldset>
      )}
      <div className="field-row">
        <label className="sf-field"><span className="sf-label">Who can see the answer</span>
          <select className="in" value={f.visibility} onChange={(e) => set({ visibility: e.target.value as JoinField['visibility'] })}>{VISIBILITY.map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}</select></label>
        <label className="sf-field"><span className="sf-label">Id (for exports)</span><input className="in" value={f.id} maxLength={41} onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
          <small className="sf-hint">Changing it after members answered starts a new column.</small></label>
      </div>
      <div className="modal-actions spread">
        {confirmDel ? <span><button type="button" className="btn sm danger" onClick={() => { update((x) => { x.sections[si].fields.splice(fi, 1); return x; }); onClose(); }}>Delete question</button> <button type="button" className="linkish" onClick={() => setConfirmDel(false)}>Keep</button></span>
          : <button type="button" className="btn sm danger-ghost" onClick={() => setConfirmDel(true)}>Delete question</button>}
        <span>
          <button type="button" className="btn sm" onClick={() => update((x) => { const copy = structuredClone(x.sections[si].fields[fi]); const taken = new Set(x.sections.flatMap((s) => s.fields.map((y) => y.id))); copy.id = uniqueId(`${copy.id}-copy`.slice(0, 38), taken); copy.label += ' (copy)'; x.sections[si].fields.splice(fi + 1, 0, copy); return x; })}>Duplicate</button>{' '}
          <button type="button" className="btn sm primary" onClick={onClose}>Done</button>
        </span>
      </div>
    </div>
  );
}

const LockIcon = (): ReactNode => <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" className="jfb-lock"><path d="M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>;
