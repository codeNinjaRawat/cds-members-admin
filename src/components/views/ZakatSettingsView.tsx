'use client';
/**
 * F2 Zakat and Sadaqah › Settings: approval limits per level, response times, monthly help, Sadaqah routing,
 * home visits and ways to apply. Published like every other document; only "Change Zakat rules" may publish.
 */
import type { ReactNode } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel } from '@/components/editor/bits';
import { usd, type ZakatSettings } from '@/lib/community/zakat';

type Doc = { draft: ZakatSettings; setDraft: (f: ZakatSettings | ((d: ZakatSettings) => ZakatSettings)) => void; issues: Record<string, string> };
const ROLE = { 1: 'Local Zakat Coordinator', 2: 'Central Committee Member', 3: 'Committee Chair' } as const;

export function ZakatSettingsView() {
  return (
    <DocEditor<ZakatSettings> storeKey="zakat-settings" title="Zakat and Sadaqah settings" preview={false}
      intro="The rules every case follows: how much each level may approve, how fast cases must be answered, and when a home visit is needed. Who holds each level is set in Settings › Admins and roles.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

function Money({ label, value, onChange, err, hint }: { label: string; value: number; onChange: (c: number) => void; err?: string; hint?: ReactNode }) {
  return (
    <label className="sf-field"><span className="sf-label">{label}</span>
      <span className="in-money"><i>$</i><input className="in" type="number" min="0" step="1" value={value / 100} onChange={(e) => onChange(Math.round(Number(e.target.value || 0) * 100))} aria-invalid={!!err} /></span>
      {hint && <small className="sf-hint">{hint}</small>}{err && <small className="sf-err">{err}</small>}</label>
  );
}

function Body({ doc }: { doc: Doc }) {
  const d = doc.draft;
  const set = (f: (x: ZakatSettings) => ZakatSettings) => doc.setDraft((x) => f(structuredClone(x)));
  const e = (k: string) => doc.issues[k];
  return (
    <div className="cv zk-settings">
      <Panel title="Approval levels" intro="A case is approved level by level until the level whose limit covers the total (monthly help counts every month). Above the Level 3 limit the Chair approves with an override.">
        <div className="zk-level-edit">
          {([1, 2, 3] as const).map((l) => (
            <div key={l} className="zk-level-card" data-level={l}>
              <b>Level {l}</b><span>{ROLE[l]}</span>
              <Money label="Can approve up to" value={d.levels[l]} onChange={(c) => set((x) => { x.levels[l] = c; return x; })} />
            </div>
          ))}
        </div>
        {e('levels') && <p className="sf-err" role="alert">{e('levels')}</p>}
      </Panel>
      <Panel title="Response times" intro="How long each step may take before the case shows as overdue.">
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Regular cases (hours per step)</span><input className="in in-num" type="number" min="1" max="240" value={d.hours.regular} onChange={(ev) => set((x) => { x.hours.regular = Number(ev.target.value); return x; })} /></label>
          <label className="sf-field"><span className="sf-label">Urgent cases (hours per step)</span><input className="in in-num" type="number" min="1" max="72" value={d.hours.emergency} onChange={(ev) => set((x) => { x.hours.emergency = Number(ev.target.value); return x; })} aria-invalid={!!e('hours.emergency')} />{e('hours.emergency') && <small className="sf-err">{e('hours.emergency')}</small>}</label>
        </div>
      </Panel>
      <Panel title="Amounts and monthly help">
        <div className="field-row">
          <Money label="Most a regular case may ask for" value={d.maxRequestCents.regular} onChange={(c) => set((x) => { x.maxRequestCents.regular = c; return x; })} />
          <Money label="Most an urgent case may ask for" value={d.maxRequestCents.emergency} onChange={(c) => set((x) => { x.maxRequestCents.emergency = c; return x; })} />
        </div>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Monthly help can run up to (months)</span><input className="in in-num" type="number" min="1" max="12" value={d.recurringMaxMonths} onChange={(ev) => set((x) => { x.recurringMaxMonths = Number(ev.target.value); return x; })} /></label>
          <Money label="Home visit needed above" value={d.homeVisitAboveCents} onChange={(c) => set((x) => { x.homeVisitAboveCents = c; return x; })} hint={d.homeVisitAboveCents === 0 ? 'Every case needs a home visit.' : `Cases totaling more than ${usd(d.homeVisitAboveCents)} need a visit before the decision.`} />
        </div>
      </Panel>
      <Panel title="Sadaqah">
        <label className="check"><input type="checkbox" checked={d.sadaqah.routing} onChange={(ev) => set((x) => { x.sadaqah.routing = ev.target.checked; return x; })} /> <span>Cases that do not qualify for Zakat can be helped from the Sadaqah fund</span></label>
        <Money label="Sadaqah cases up to this total need only Level 1 (0 = always all levels)" value={d.sadaqah.autoApproveUnderCents} onChange={(c) => set((x) => { x.sadaqah.autoApproveUnderCents = c; return x; })} err={e('sadaqah.autoApproveUnderCents')} />
      </Panel>
      <Panel title="Ways to apply">
        {([['website', 'Website (isgh.org)'], ['app', 'Mobile app'], ['inPerson', 'In person or by phone (office or Local Zakat Coordinator)']] as const).map(([k, label]) => (
          <label key={k} className="check"><input type="checkbox" checked={d.channels[k]} onChange={(ev) => set((x) => { x.channels[k] = ev.target.checked; return x; })} /> <span>{label}</span></label>
        ))}
        {e('channels') && <p className="sf-err" role="alert">{e('channels')}</p>}
      </Panel>
    </div>
  );
}
