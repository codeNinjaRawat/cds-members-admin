'use client';
/**
 * P1–P3 Membership rules › Plans and dues – a purpose-made editor instead of the generic form. Each plan is a card
 * whose fields follow its term (a lifetime plan never shows renewal or multi-year prices – the cause of the two
 * errors seen in the review call), "Start from a preset" loads ISGH's real categories (or the Wild Apricot levels,
 * or the Bylaws demo set) into the draft, and the rules that used to live in people's heads are switches with
 * editable numbers: monthly contributors (Check-o-matic), lifetime by donation, who a household covers, approval.
 * Nothing is ISGH-only: another organization changes the words and numbers or turns a rule off.
 * DEMO (no API). Live: part of the membership-settings document (GET /public/membership/settings).
 */
import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/editor/DocEditor';
import { Panel, SwitchRow } from '@/components/editor/bits';
import { PLAN_PRESETS, formatUSD, memberClass, noVoteMessage, quote, rulesInWords, type MembershipRules, type MembershipSettings, type Plan } from '@/lib/content/membership';

type Doc = { draft: MembershipSettings; setDraft: (f: (d: MembershipSettings) => MembershipSettings) => void; issues: Record<string, string> };
const TERMS: Record<Plan['term'], string> = { calendar_year: 'Yearly', lifetime: 'Lifetime', recurring: 'Monthly' };
const ANCHORS = { calendar: 'Calendar year (January 1)', join: 'The join date', date: 'A fixed date every year' } as const;
const MODES = { manual: 'Members renew themselves', automatic: 'Charged automatically (card on file)', both: 'Either' } as const;

function Field({ label, err, hint, children, className = '', group = false }: { label: string; err?: string; hint?: ReactNode; children: ReactNode; className?: string; group?: boolean }) {
  const body = <><span className="sf-label">{label}</span>{children}{hint && <small className="sf-hint">{hint}</small>}{err && <small className="sf-err" role="alert">{err}</small>}</>;
  return group ? <div className={`sf-field ${className}`}>{body}</div> : <label className={`sf-field ${className}`}>{body}</label>;
}
function Money({ label, value, onChange, err, hint, ariaLabel }: { label: string; value: number; onChange: (c: number) => void; err?: string; hint?: ReactNode; ariaLabel?: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <Field label={label} err={err} hint={hint}>
      <span className="in-money"><i aria-hidden="true">$</i>
        <input className="in" inputMode="decimal" aria-label={ariaLabel ?? label} value={text ?? (value / 100).toFixed(2)} onFocus={() => setText((value / 100).toFixed(2))} onBlur={() => setText(null)}
          onChange={(e) => { setText(e.target.value); const n = parseFloat(e.target.value.replace(/[^\d.]/g, '')); onChange(Number.isFinite(n) ? Math.round(n * 100) : 0); }} /></span>
    </Field>
  );
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'plan';

export function PlansEditor({ doc }: { doc: Doc }) {
  const d = doc.draft;
  const [open, setOpen] = useState<number | null>(null);
  const [preset, setPreset] = useState(PLAN_PRESETS[0].id);
  const [ask, setAsk] = useState(false);
  const set = (f: (x: MembershipSettings) => void) => doc.setDraft((x) => { const c = structuredClone(x); f(c); return c; });
  const err = (path: string) => doc.issues[path];
  const planErrs = (i: number) => Object.keys(doc.issues).filter((k) => k.startsWith(`plans.${i}.`)).length;
  const load = () => { const p = PLAN_PRESETS.find((x) => x.id === preset)!; set((x) => { x.plans = structuredClone(p.plans); x.rules = structuredClone(p.rules); }); setAsk(false); setOpen(null); };
  const add = () => {
    const id = (() => { let s = 'new-plan', n = 2; while (d.plans.some((p) => p.id === s)) s = `new-plan-${n++}`; return s; })();
    set((x) => { x.plans.push({ id, name: 'New plan', category: 'individual', memberClass: 'natural', term: 'calendar_year', priceCents: 2500, unit: 'per year', summary: '', perks: [], votingEligible: true, featured: false, maxYearsAhead: 1, multiYearDiscountPct: 0, requiresApproval: true, visible: false, renewal: { anchor: 'calendar', mode: 'manual', prorate: false, aheadLimitDays: 0 }, allowLevelChange: true }); });
    setOpen(d.plans.length);
  };
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= d.plans.length) return; set((x) => { [x.plans[i], x.plans[j]] = [x.plans[j], x.plans[i]]; }); if (open === i) setOpen(j); else if (open === j) setOpen(i); };
  const words = rulesInWords(d);
  return (
    <div className="pe">
      <section className="glass-pane pe-presets" aria-label="Start from a preset">
        <div className="pe-preset-row">
          <Field label="Start from a preset" className="pe-preset-pick"><select className="in" aria-label="Plan preset" value={preset} onChange={(e) => setPreset(e.target.value)}>{PLAN_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <button type="button" className="btn" onClick={() => setAsk(true)}>Load into the draft</button>
        </div>
        <p className="muted small">{PLAN_PRESETS.find((p) => p.id === preset)?.blurb} Loading replaces the plans and rules in the draft; nothing is published until you press Publish.</p>
        {ask && (
          <Modal title={`Load “${PLAN_PRESETS.find((p) => p.id === preset)?.name}”?`} onClose={() => setAsk(false)}>
            <p>{PLAN_PRESETS.find((p) => p.id === preset)?.blurb}</p>
            <p>This replaces the {d.plans.length} plan{d.plans.length === 1 ? '' : 's'} and the rules in the draft. You can still change everything before publishing.</p>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setAsk(false)}>Keep my plans</button><button type="button" className="btn primary" onClick={load}>Load into the draft</button></div>
          </Modal>
        )}
      </section>

      <Field label="Membership year being sold" err={err('year')} className="pe-year"><input className="in in-num" type="number" aria-label="Membership year" value={d.year} onChange={(e) => set((x) => { x.year = Number(e.target.value || 0); })} /></Field>

      <section className="pe-plans" aria-label="Plans">
        <h2 className="pe-h">Plans <span className="pill">{d.plans.length}</span></h2>
        <ul className="pe-list">{d.plans.map((p, i) => (
          <li key={i} className={`pe-card${open === i ? ' open' : ''}${p.visible ? '' : ' hidden-plan'}`} data-plan={p.id}>
            <div className="pe-row">
              <button type="button" className="pe-open" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <b>{p.name}</b>
                <span className="pe-meta">{formatUSD(p.priceCents)} {p.unit} · {TERMS[p.term]} · {p.category === 'household' ? `household${p.bundle ? ` of ${p.bundle.maxMembers}` : ''}` : 'one person'} · {memberClass(d.rules, p.memberClass).label.toLowerCase()}{p.votingEligible ? '' : ' · no vote'}{p.ages ? ` · ages ${p.ages.min ?? 0}${p.ages.max !== undefined ? `–${p.ages.max}` : '+'}` : ''}</span>
                {!p.visible && <span className="pill">Hidden</span>}{p.featured && <span className="pill good">Featured</span>}{planErrs(i) > 0 && <span className="sf-badge" aria-label={`${planErrs(i)} problems`}>{planErrs(i)}</span>}
              </button>
              <span className="row-actions">
                <button type="button" className="sf-icon" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="sf-icon" aria-label={`Move ${p.name} down`} disabled={i === d.plans.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="sf-icon" aria-label={`Duplicate ${p.name}`} onClick={() => set((x) => { const c = structuredClone(x.plans[i]); c.id = `${c.id}-copy`; c.name = `${c.name} (copy)`; x.plans.splice(i + 1, 0, c); })}>⧉</button>
                <button type="button" className="sf-icon danger" aria-label={`Remove ${p.name}`} onClick={() => { set((x) => { x.plans.splice(i, 1); }); setOpen(null); }}>×</button>
              </span>
            </div>
            {open === i && <PlanForm p={p} i={i} err={err} rules={d.rules} up={(f) => set((x) => { f(x.plans[i]); })} />}
          </li>
        ))}</ul>
        <button type="button" className="btn" onClick={add}>+ Add plan</button>
      </section>

      <Rules d={d} set={set} err={err} />
      {words.length > 0 && <Panel title="How the website explains it"><ul className="pe-words">{words.map((w) => <li key={w}>{w}</li>)}</ul></Panel>}
    </div>
  );
}

function PlanForm({ p, i, err, rules, up }: { p: Plan; i: number; err: (k: string) => string | undefined; rules: MembershipRules; up: (f: (p: Plan) => void) => void }) {
  const cls = memberClass(rules, p.memberClass);
  const e = (k: string) => err(`plans.${i}.${k}`);
  const yearly = p.term === 'calendar_year';
  const lifetime = p.term === 'lifetime';
  const setTerm = (t: Plan['term']) => up((x) => {
    x.term = t;
    if (t === 'lifetime') { delete x.renewal; delete x.termPrices; x.maxYearsAhead = 1; x.multiYearDiscountPct = 0; if (x.unit === 'per year' || x.unit === 'per month') x.unit = 'one time'; }
    else { x.renewal ??= { anchor: 'calendar', mode: t === 'recurring' ? 'automatic' : 'manual', prorate: false, aheadLimitDays: 0 }; if (x.unit === 'one time') x.unit = t === 'recurring' ? 'per month' : 'per year'; }
    if (t === 'recurring') { delete x.termPrices; x.maxYearsAhead = 1; x.multiYearDiscountPct = 0; }
  });
  const q3 = yearly && p.maxYearsAhead > 1 ? quote(p, Math.min(3, p.maxYearsAhead)) : null;
  return (
    <div className="pe-form">
      <div className="field-row">
        <Field label="Name" err={e('name')}><input className="in" aria-label={`Plan name ${p.name}`} value={p.name} onChange={(ev) => up((x) => { x.name = ev.target.value; })} /></Field>
        <Field label="ID" err={e('id')} hint="Used in links and imports; letters, numbers and dashes."><input className="in mono" aria-label={`Plan ID ${p.name}`} value={p.id} onChange={(ev) => up((x) => { x.id = slug(ev.target.value); })} /></Field>
      </div>
      <div className="field-row three segs">
        <Field label="Covers" group><div className="seg" role="radiogroup" aria-label={`Covers ${p.name}`}>{(['individual', 'household'] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={p.category === c} onClick={() => up((x) => { x.category = c; if (c === 'individual') delete x.bundle; else x.bundle ??= { maxMembers: 2 }; })}>{c === 'individual' ? 'One person' : 'Household'}</button>)}</div></Field>
        <Field label="Member class" err={e('votingEligible')} group hint={cls.blurb || undefined}><div className="seg" role="radiogroup" aria-label={`Member class ${p.name}`}>{(['natural', 'associate'] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={p.memberClass === c} onClick={() => up((x) => { x.memberClass = c; x.votingEligible = memberClass(rules, c).canVote; })}>{memberClass(rules, c).label}</button>)}</div></Field>
        <Field label="Term" group><div className="seg" role="radiogroup" aria-label={`Term ${p.name}`}>{(Object.keys(TERMS) as Plan['term'][]).map((t) => <button key={t} type="button" role="radio" aria-checked={p.term === t} onClick={() => setTerm(t)}>{TERMS[t]}</button>)}</div></Field>
      </div>
      <div className="field-row three">
        <Money label={lifetime ? 'Price (one time)' : p.term === 'recurring' ? 'Minimum each month' : 'Price per year'} value={p.priceCents} onChange={(c) => up((x) => { x.priceCents = c; })} err={e('priceCents')} ariaLabel={`Price ${p.name}`} />
        <Field label="Shown as" err={e('unit')} hint="Next to the price on the website."><input className="in" aria-label={`Unit ${p.name}`} value={p.unit} onChange={(ev) => up((x) => { x.unit = ev.target.value; })} /></Field>
        {p.category === 'household' ? <Field label="People in the household" err={e('bundle')}><input className="in in-num" type="number" min={2} max={20} aria-label={`Household size ${p.name}`} value={p.bundle?.maxMembers ?? 2} onChange={(ev) => up((x) => { x.bundle = { maxMembers: Math.max(2, Math.min(20, Number(ev.target.value || 2))) }; })} /></Field>
          : <Field label="Household" group hint="One-person plans cannot add a spouse or family – switch “Covers” to Household for that."><span className="in in-static muted">Not on this plan</span></Field>}
      </div>
      <div className="field-row three">
        <Field label="Youngest age (blank = the organization's minimum)" err={e('ages.min')}><input className="in in-num" type="number" min={0} max={120} aria-label={`Youngest age ${p.name}`} value={p.ages?.min ?? ''} onChange={(ev) => up((x) => { const v = ev.target.value === '' ? undefined : Math.max(0, Math.min(120, Number(ev.target.value))); x.ages = { ...(x.ages ?? {}), min: v }; if (x.ages.min === undefined && x.ages.max === undefined) delete x.ages; })} /></Field>
        <Field label="Oldest age (blank = no limit)" err={e('ages.max')}><input className="in in-num" type="number" min={0} max={120} aria-label={`Oldest age ${p.name}`} value={p.ages?.max ?? ''} onChange={(ev) => up((x) => { const v = ev.target.value === '' ? undefined : Math.max(0, Math.min(120, Number(ev.target.value))); x.ages = { ...(x.ages ?? {}), max: v }; if (x.ages.min === undefined && x.ages.max === undefined) delete x.ages; })} /></Field>
        <Field label="Why" group hint="A youth plan (under 18) or a senior plan (65 and over) shows only to people of that age on the join form."><span className="in in-static muted">{p.ages ? `Offered to ages ${p.ages.min ?? 0}${p.ages.max !== undefined ? ` to ${p.ages.max}` : ' and over'}` : 'Offered at every age'}</span></Field>
      </div>
      {yearly && (
        <div className="pe-sub">
          <h4>Paying several years at once</h4>
          <div className="field-row three">
            <Field label="Years that can be paid ahead" err={e('maxYearsAhead')}><input className="in in-num" type="number" min={1} max={10} aria-label={`Years ahead ${p.name}`} value={p.maxYearsAhead} onChange={(ev) => up((x) => { x.maxYearsAhead = Math.max(1, Math.min(10, Number(ev.target.value || 1))); })} /></Field>
            <Field label="Discount for paying ahead (%)" err={e('multiYearDiscountPct')} hint={q3 ? `${q3.years} years: ${formatUSD(q3.totalCents)} instead of ${formatUSD(q3.grossCents)}.` : undefined}><input className="in in-num" type="number" min={0} max={100} aria-label={`Multi-year discount ${p.name}`} value={p.multiYearDiscountPct} disabled={p.maxYearsAhead < 2} onChange={(ev) => up((x) => { x.multiYearDiscountPct = Math.max(0, Math.min(100, Number(ev.target.value || 0))); })} /></Field>
          </div>
          {p.maxYearsAhead > 1 && (
            <div className="pe-fixed">
              <span className="sf-label">Fixed prices (instead of the discount)</span>
              {(p.termPrices ?? []).map((t, j) => (
                <div key={j} className="field-row three pe-fixed-row">
                  <Field label="Years" err={e(`termPrices.${j}.years`)}><input className="in in-num" type="number" min={1} max={p.maxYearsAhead} aria-label={`Fixed price years ${j + 1} ${p.name}`} value={t.years} onChange={(ev) => up((x) => { x.termPrices![j].years = Number(ev.target.value || 1); })} /></Field>
                  <Money label="Price" value={t.priceCents} onChange={(c) => up((x) => { x.termPrices![j].priceCents = c; })} err={e(`termPrices.${j}.priceCents`)} ariaLabel={`Fixed price ${j + 1} ${p.name}`} />
                  <button type="button" className="btn sm ghost pe-fixed-rm" onClick={() => up((x) => { x.termPrices!.splice(j, 1); if (!x.termPrices!.length) delete x.termPrices; })}>Remove</button>
                </div>
              ))}
              <button type="button" className="btn sm" disabled={(p.termPrices?.length ?? 0) >= 6} onClick={() => up((x) => { const next = (x.termPrices?.length ? Math.max(...x.termPrices.map((t) => t.years)) : 0) + 1; (x.termPrices ??= []).push({ years: Math.min(x.maxYearsAhead, Math.max(next, 2)), priceCents: x.priceCents * Math.min(x.maxYearsAhead, Math.max(next, 2)) }); })}>+ Add a fixed price</button>
            </div>
          )}
        </div>
      )}
      {lifetime && <p className="muted small pe-note">Paid once – lifetime plans have no renewal, no yearly reminders and no multi-year prices.</p>}
      {!lifetime && p.renewal && (
        <div className="pe-sub">
          <h4>Renewal</h4>
          <div className="field-row three">
            <Field label="Renews on" err={e('renewal.anchor')}><select className="in" aria-label={`Renews on ${p.name}`} value={p.renewal.anchor} onChange={(ev) => up((x) => { x.renewal!.anchor = ev.target.value as 'calendar' | 'join' | 'date'; if (x.renewal!.anchor !== 'date') delete x.renewal!.anchorDate; else x.renewal!.anchorDate ??= '12-15'; })}>{Object.entries(ANCHORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {p.renewal.anchor === 'date' && <Field label="Renewal date (MM-DD)" err={e('renewal.anchorDate')}><input className="in" aria-label={`Renewal date ${p.name}`} value={p.renewal.anchorDate ?? ''} placeholder="12-15" onChange={(ev) => up((x) => { x.renewal!.anchorDate = ev.target.value; })} /></Field>}
            <Field label="How" err={e('renewal.mode')}><select className="in" aria-label={`Renewal mode ${p.name}`} value={p.renewal.mode} onChange={(ev) => up((x) => { x.renewal!.mode = ev.target.value as 'manual' | 'automatic' | 'both'; })}>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          <div className="field-row">
            <Field label="Can renew this many days early (0 = any time)" err={e('renewal.aheadLimitDays')}><input className="in in-num" type="number" min={0} max={365} aria-label={`Renew early days ${p.name}`} value={p.renewal.aheadLimitDays} onChange={(ev) => up((x) => { x.renewal!.aheadLimitDays = Math.max(0, Math.min(365, Number(ev.target.value || 0))); })} /></Field>
            <SwitchRow id={`pe-prorate-${p.id}`} label="Charge less for a part year" checked={p.renewal.prorate} onChange={(v) => up((x) => { x.renewal!.prorate = v; })} />
          </div>
          {e('renewal.prorate') && <small className="sf-err" role="alert">{e('renewal.prorate')}</small>}
        </div>
      )}
      <div className="pe-sub">
        <h4>On the website</h4>
        <Field label="One line about it" err={e('summary')}><input className="in" aria-label={`Summary ${p.name}`} value={p.summary} onChange={(ev) => up((x) => { x.summary = ev.target.value; })} /></Field>
        <Field label="What members get (one per line, up to 6)" err={e('perks')}><textarea className="in in-area" rows={3} aria-label={`Perks ${p.name}`} value={p.perks.join('\n')} onChange={(ev) => up((x) => { x.perks = ev.target.value.split('\n').map((s) => s.trimEnd()).filter((s, k, a) => s || k < a.length - 1).slice(0, 6); })} /></Field>
        <div className="pe-switches">
          <SwitchRow id={`pe-visible-${p.id}`} label="Shown on the website and the join form" checked={p.visible} onChange={(v) => up((x) => { x.visible = v; })} />
          <SwitchRow id={`pe-featured-${p.id}`} label="Featured (highlighted card)" checked={p.featured} onChange={(v) => up((x) => { x.featured = v; })} />
          <SwitchRow id={`pe-vote-${p.id}`} label="Members on this plan can vote" help={!cls.canVote ? noVoteMessage(rules, p.memberClass) + ' Change that under Rules › Member classes.' : undefined} checked={p.votingEligible && cls.canVote} disabled={!cls.canVote} onChange={(v) => up((x) => { x.votingEligible = v; })} />
          <SwitchRow id={`pe-approve-${p.id}`} label="Applications need approval" checked={p.requiresApproval} onChange={(v) => up((x) => { x.requiresApproval = v; })} />
          <SwitchRow id={`pe-change-${p.id}`} label="Members may switch to or from this plan" checked={p.allowLevelChange ?? true} onChange={(v) => up((x) => { x.allowLevelChange = v; })} />
        </div>
      </div>
    </div>
  );
}

function Rules({ d, set, err }: { d: MembershipSettings; set: (f: (x: MembershipSettings) => void) => void; err: (k: string) => string | undefined }) {
  const r = d.rules; const q = r.qualifyingGifts; const l = r.lifetimeByDonation;
  const plans = d.plans;
  const lifetimePlans = plans.filter((p) => p.term === 'lifetime');
  return (
    <section className="pe-rules" aria-label="Membership rules">
      <h2 className="pe-h">Rules</h2>
      <Panel title="Monthly contributors are members" intro="For organizations where regular givers are members without separate dues (ISGH: Check-o-matic). The year's contributions must reach a total by a cut-off date.">
        <SwitchRow id="pe-q-on" label="Use this rule" checked={q.enabled} onChange={(v) => set((x) => { x.rules.qualifyingGifts.enabled = v; if (v && !x.rules.qualifyingGifts.planId) x.rules.qualifyingGifts.planId = x.plans.find((p) => p.term === 'recurring')?.id ?? ''; })} />
        {q.enabled && (<>
          <div className="field-row three">
            <Field label="Plan these members hold" err={err('rules.qualifyingGifts.planId')}><select className="in" aria-label="Qualifying plan" value={q.planId} onChange={(ev) => set((x) => { x.rules.qualifyingGifts.planId = ev.target.value; })}><option value="">Choose…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Name of the rule" err={err('rules.qualifyingGifts.label')}><input className="in" aria-label="Rule name" value={q.label} onChange={(ev) => set((x) => { x.rules.qualifyingGifts.label = ev.target.value; })} /></Field>
            <Field label="Which gifts count"><select className="in" aria-label="Which gifts count" value={q.countsGifts} onChange={(ev) => set((x) => { x.rules.qualifyingGifts.countsGifts = ev.target.value as 'recurring' | 'any'; })}><option value="recurring">Recurring gifts only (bank draft, card)</option><option value="any">Any gift</option></select></Field>
          </div>
          <div className="field-row three">
            <Money label="At least each month" value={q.minMonthlyCents} onChange={(c) => set((x) => { x.rules.qualifyingGifts.minMonthlyCents = c; })} err={err('rules.qualifyingGifts.minMonthlyCents')} ariaLabel="Minimum monthly gift" />
            <Money label="Yearly total that qualifies" value={q.totalCents} onChange={(c) => set((x) => { x.rules.qualifyingGifts.totalCents = c; })} err={err('rules.qualifyingGifts.totalCents')} ariaLabel="Qualifying total" />
            <Field label="Reached by (MM-DD)" err={err('rules.qualifyingGifts.cutoff')} hint="Usually the voting record date."><input className="in" aria-label="Qualifying cut-off" value={q.cutoff} onChange={(ev) => set((x) => { x.rules.qualifyingGifts.cutoff = ev.target.value; })} /></Field>
          </div>
          <div className="pe-switches">
            <SwitchRow id="pe-q-spouse" label="Covers the spouse too (primary and spouse)" checked={q.coversSpouse} onChange={(v) => set((x) => { x.rules.qualifyingGifts.coversSpouse = v; })} />
            <SwitchRow id="pe-q-roll" label="Extra contributions carry into the next year" checked={q.rollover} onChange={(v) => set((x) => { x.rules.qualifyingGifts.rollover = v; })} />
          </div>
        </>)}
      </Panel>
      <Panel title="Lifetime membership by donation" intro="A large gift can make someone a lifetime member (ISGH: $25,000).">
        <SwitchRow id="pe-l-on" label="Use this rule" checked={l.enabled} onChange={(v) => set((x) => { x.rules.lifetimeByDonation.enabled = v; if (v && !x.rules.lifetimeByDonation.planId) x.rules.lifetimeByDonation.planId = x.plans.find((p) => p.term === 'lifetime')?.id ?? ''; })} />
        {l.enabled && (<>
          <div className="field-row three">
            <Money label="Gift amount" value={l.thresholdCents} onChange={(c) => set((x) => { x.rules.lifetimeByDonation.thresholdCents = c; })} err={err('rules.lifetimeByDonation.thresholdCents')} ariaLabel="Lifetime gift threshold" />
            <Field label="Counted as" ><select className="in" aria-label="Lifetime gift window" value={l.window} onChange={(ev) => set((x) => { x.rules.lifetimeByDonation.window = ev.target.value as 'single-gift' | 'calendar-year' | 'all-time'; })}><option value="single-gift">One single gift</option><option value="calendar-year">Gifts within one calendar year</option><option value="all-time">Gifts over the years</option></select></Field>
            <Field label="Lifetime plan granted" err={err('rules.lifetimeByDonation.planId')}><select className="in" aria-label="Lifetime plan granted" value={l.planId} onChange={(ev) => set((x) => { x.rules.lifetimeByDonation.planId = ev.target.value; })}><option value="">Choose…</option>{(lifetimePlans.length ? lifetimePlans : plans).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          </div>
          <SwitchRow id="pe-l-approve" label="Needs approval before the membership is granted" checked={l.needsApproval} onChange={(v) => set((x) => { x.rules.lifetimeByDonation.needsApproval = v; })} />
        </>)}
      </Panel>
      <Panel title="Member classes" intro="Your constitution's words for who is a member and who votes. The two classes are fixed in the records; what they are called, whether they vote and whether the join form offers them is yours to set.">
        {(['natural', 'associate'] as const).map((k) => { const c = memberClass(r, k); return (
          <div key={k} className="pe-class" data-class={k}>
            <div className="field-row three">
              <Field label={`Class ${k === 'natural' ? '1' : '2'} – name`} err={err(`rules.classes.${k}.label`)}><input className="in" aria-label={`Class ${k} name`} value={c.label} onChange={(ev) => set((x) => { x.rules.classes[k].label = ev.target.value; })} /></Field>
              <Field label="One line about it" err={err(`rules.classes.${k}.blurb`)}><input className="in" aria-label={`Class ${k} blurb`} value={c.blurb} onChange={(ev) => set((x) => { x.rules.classes[k].blurb = ev.target.value; })} /></Field>
              <Field label="Plans on this class" group><span className="in in-static muted">{plans.filter((p) => p.memberClass === k).map((p) => p.name).join(', ') || 'none'}</span></Field>
            </div>
            <div className="pe-switches">
              <SwitchRow id={`pe-cls-vote-${k}`} label={`${c.label}s can vote and hold office`} checked={c.canVote} onChange={(v) => set((x) => { x.rules.classes[k].canVote = v; if (!v) x.plans.forEach((p) => { if (p.memberClass === k) p.votingEligible = false; }); })} />
              <SwitchRow id={`pe-cls-offer-${k}`} label="Offered as a choice on the join form" help="When only one class is offered the join form skips the question." checked={c.offered} onChange={(v) => set((x) => { x.rules.classes[k].offered = v; })} />
            </div>
          </div>); })}
        <Field label="Where the rule comes from (shown in messages)" err={err('rules.classes.reference')}><input className="in" aria-label="Class rule reference" value={r.classes?.reference ?? ''} placeholder="Constitution Art. III" onChange={(ev) => set((x) => { x.rules.classes.reference = ev.target.value; })} /></Field>
      </Panel>
      <Panel title="Households and approval">
        <div className="field-row three">
          <Field label="A household plan covers"><select className="in" aria-label="Household definition" value={r.household.definition} onChange={(ev) => set((x) => { x.rules.household.definition = ev.target.value as 'spouse' | 'spouse-children' | 'relatives'; x.rules.household.label = { spouse: 'Husband and wife', 'spouse-children': 'Spouses and their children', relatives: 'Relatives by blood or marriage' }[x.rules.household.definition]; })}><option value="spouse">Husband and wife</option><option value="spouse-children">Spouses and their children</option><option value="relatives">Relatives by blood or marriage</option></select></Field>
          <Field label="In words" err={err('rules.household.label')}><input className="in" aria-label="Household in words" value={r.household.label} onChange={(ev) => set((x) => { x.rules.household.label = ev.target.value; })} /></Field>
          <Field label="Who approves applications" err={err('rules.approval.by')}><input className="in" aria-label="Who approves" value={r.approval.by} onChange={(ev) => set((x) => { x.rules.approval.by = ev.target.value; })} /></Field>
        </div>
        <div className="pe-switches">
          <SwitchRow id="pe-a-pay" label="Approve only after the dues are paid in full" checked={r.approval.requireFullPayment} onChange={(v) => set((x) => { x.rules.approval.requireFullPayment = v; })} />
          <SwitchRow id="pe-a-id" label="Approve only after the ID check" checked={r.approval.requireIdCheck} onChange={(v) => set((x) => { x.rules.approval.requireIdCheck = v; })} />
        </div>
      </Panel>
    </section>
  );
}
