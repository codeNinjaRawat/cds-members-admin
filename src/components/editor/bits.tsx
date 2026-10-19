'use client';
/** Small shared editor pieces: tabs, scoped form, panel, switch row. */
import { useEffect, useState, type ReactNode } from 'react';
import { REGISTRY, type DocKey } from '@/lib/store/registry';
import { SchemaForm } from '@/components/forms/SchemaForm';
import type { DocApi } from './DocEditor';

export function Panel({ title, intro, children, tone }: { title?: string; intro?: ReactNode; children?: ReactNode; tone?: 'warn' }) {
  return (
    <section className={`panel glass-pane${tone ? ` tone-${tone}` : ''}`}>
      {title && <h2 className="panel-h">{title}</h2>}
      {intro && <p className="panel-intro">{intro}</p>}
      {children}
    </section>
  );
}

/** Form for the given top-level fields of a document. */
export function ScopedForm<T>({ doc, storeKey, only, omit, labels }: { doc: DocApi<T>; storeKey: DocKey; only?: string[]; omit?: string[]; labels?: Record<string, string> }) {
  return <SchemaForm schema={REGISTRY[storeKey].schema} value={doc.draft} onChange={(v) => doc.setDraft(v as T)} issues={doc.issues} only={only} omit={omit} labels={labels} />;
}

export function Tabs({ tabs, initial, label }: { tabs: { id: string; label: string; badge?: number; render: () => ReactNode }[]; initial?: string; label: string }) {
  const [cur, setCurState] = useState(initial ?? tabs[0].id);
  // ?tab= in the address opens a tab directly (sidebar submenus link here); switching tabs updates the address
  useEffect(() => {
    const read = () => { const t = new URLSearchParams(window.location.search).get('tab'); if (t && tabs.some((x) => x.id === t)) setCurState(t); };
    read(); window.addEventListener('isgh:tab', read); window.addEventListener('popstate', read);
    return () => { window.removeEventListener('isgh:tab', read); window.removeEventListener('popstate', read); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setCur = (id: string) => {
    setCurState(id);
    const u = new URL(window.location.href); u.searchParams.set('tab', id); window.history.replaceState(null, '', u);
    window.dispatchEvent(new Event('isgh:tab'));
  };
  const active = tabs.find((t) => t.id === cur) ?? tabs[0];
  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tablist glass-pane"
        onKeyDown={(e) => {
          const i = tabs.findIndex((t) => t.id === cur);
          if (e.key === 'ArrowRight') setCur(tabs[(i + 1) % tabs.length].id);
          if (e.key === 'ArrowLeft') setCur(tabs[(i - 1 + tabs.length) % tabs.length].id);
        }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={t.id === cur} aria-controls={`tp-${t.id}`} tabIndex={t.id === cur ? 0 : -1} onClick={() => setCur(t.id)}>
            {t.label}{t.badge ? <span className="sf-badge">{t.badge}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`tp-${active.id}`} aria-labelledby={`tab-${active.id}`}>{active.render()}</div>
    </div>
  );
}

export const countIssues = (issues: Record<string, string>, prefixes: string[]) =>
  Object.keys(issues).filter((p) => prefixes.some((x) => p === x || p.startsWith(x + '.'))).length;

export function SwitchRow({ id, label, help, checked, onChange, disabled = false }: { id: string; label: string; help?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={`sf-field sf-switch-row${disabled ? ' is-disabled' : ''}`}>
      <label className="switch" htmlFor={id}>
        <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-describedby={help ? `${id}-h` : undefined} />
        <span className="track" aria-hidden="true"><span className="thumb" /></span>
        <span className="sf-label">{label}</span>
      </label>
      {help && <p className="sf-hint" id={`${id}-h`}>{help}</p>}
    </div>
  );
}
