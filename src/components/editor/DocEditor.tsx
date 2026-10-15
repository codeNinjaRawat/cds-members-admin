'use client';
/**
 * Page frame for editing one website document: status, unpublished-changes banner, problems summary,
 * publish (with "what changed" + optional note), discard, history (load an older version into the draft),
 * reset to built-in content, and an optional live preview next to the form.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { REGISTRY, type DocKey } from '@/lib/store/registry';
import { useDoc, type Path } from '@/lib/store/use-doc';
import { labelFor } from '@/lib/schema-form/introspect';
import { LivePreview, type PreviewHandle } from './LivePreview';

export type DocApi<T> = ReturnType<typeof useDoc<T>>;

const ago = (iso: string | null) => {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function DocEditor<T>({ storeKey, title, intro, scope, preview = true, previewPaths, children, aside }: {
  storeKey: DocKey; title: string; intro: string; scope?: string[]; preview?: boolean; previewPaths?: string[];
  children: (doc: DocApi<T>, previewRef: React.RefObject<PreviewHandle | null>) => ReactNode; aside?: ReactNode;
}) {
  const doc = useDoc<T>(storeKey);
  const previewRef = useRef<PreviewHandle>(null);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState(false);

  // only this screen's part counts for "changed" + problems
  const inScope = (p: string) => !scope || scope.some((s) => p === s || p.startsWith(s + '.'));
  const problems = Object.entries(doc.issues).filter(([p]) => inScope(p));
  const otherProblems = Object.keys(doc.issues).length - problems.length;
  const changed = useMemo(() => {
    if (doc.status !== 'ready' || !doc.dirty) return [];
    const a = (doc.draft ?? {}) as Record<string, unknown>, b = (doc.base ?? {}) as Record<string, unknown>;
    if (typeof a !== 'object' || Array.isArray(a)) return ['content'];
    return Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(labelFor);
  }, [doc.draft, doc.base, doc.dirty, doc.status]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (doc.dirty) { e.preventDefault(); } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [doc.dirty]);

  if (doc.status === 'loading') return <div className="page"><div className="loading-pane glass-pane" role="status"><span className="spinner" />Loading {REGISTRY[storeKey].label.toLowerCase()}…</div></div>;
  if (doc.status === 'error') return <div className="page"><div className="glass-pane notice error" role="alert">{doc.error} <button className="btn sm" onClick={() => void doc.reload()}>Try again</button></div></div>;

  const publish = async () => { const ok = await doc.publish(note || undefined); setConfirm(false); if (ok) setNote(''); }; // result shows in the page banner

  return (
    <div className={`page${preview ? ' with-preview' : ''}`}>
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="page-intro">{intro}</p>
          <p className="page-status">
            {doc.meta?.source === 'published'
              ? <><span className="dot ok" aria-hidden="true" />Published version {doc.meta.version}, {ago(doc.meta.publishedAt)}{doc.meta.by ? ` by ${doc.meta.by}` : ''}</>
              : <><span className="dot" aria-hidden="true" />Website is using its built-in content</>}
            {doc.dirty && <span className="pill warn">Unpublished changes</span>}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn ghost" onClick={() => setHistory(true)}>History</button>
          <button type="button" className="btn ghost" disabled={!doc.dirty} onClick={doc.discard}>Discard changes</button>
          <button type="button" className="btn primary" disabled={!doc.dirty || problems.length > 0 || otherProblems > 0 || doc.busy !== null}
            onClick={() => setConfirm(true)} title={problems.length ? 'Fix the problems first' : undefined}>Publish</button>
        </div>
      </header>

      {doc.restored && <p className="glass-pane notice" role="status">We restored changes you had not published yet. <button className="linkish" onClick={doc.discard}>Discard them</button></p>}
      {doc.flash && (
        <div className={`glass-pane notice ${doc.flash.tone === 'ok' ? 'ok' : 'error'}`} role={doc.flash.tone === 'ok' ? 'status' : 'alert'}>
          {doc.flash.text}
          {doc.flash.issues?.length ? <ul>{doc.flash.issues.slice(0, 6).map((i) => <li key={i.path + i.message}>{i.path}: {i.message}</li>)}</ul> : null}
          {doc.flash.text.startsWith('Someone published') && <button className="btn sm" onClick={() => void doc.publish(note || undefined, true)}>Publish mine anyway</button>}
        </div>
      )}
      {problems.length > 0 && (
        <div className="glass-pane notice error" role="alert">
          <b>{problems.length === 1 ? '1 thing to fix before publishing' : `${problems.length} things to fix before publishing`}</b>
          <ul>{problems.slice(0, 6).map(([p, m]) => <li key={p}><a href={`#f-${p.replace(/\./g, '-').replace(/[^a-zA-Z0-9-]/g, '_')}`}>{p.split('.').map((x) => /^\d+$/.test(x) ? `#${Number(x) + 1}` : labelFor(x)).join(' › ')}</a>: {m}</li>)}</ul>
        </div>
      )}
      {otherProblems > 0 && <p className="glass-pane notice error">This document has {otherProblems} problem(s) on another screen. Fix them there first.</p>}

      <div className="page-grid">
        <div className="editor-col">{children(doc, previewRef)}</div>
        {preview && <div className="preview-col">{aside}<LivePreview ref={previewRef} paths={previewPaths ?? REGISTRY[storeKey].preview} /></div>}
      </div>

      {confirm && (
        <Modal title="Publish to the website?" onClose={() => setConfirm(false)}>
          <p>{changed.length ? <>You changed: <b>{changed.join(', ')}</b>.</> : 'Publish this version.'} Visitors see it on their next page load.</p>
          <label className="sf-label" htmlFor="pub-note">What changed? <span className="sf-opt">optional, shown in History</span></label>
          <input id="pub-note" className="in" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: New Ramadan announcement" />
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Keep editing</button>
            <button type="button" className="btn primary" onClick={() => void publish()} disabled={doc.busy !== null} data-busy={doc.busy === 'publish' || undefined}>{doc.busy === 'publish' ? 'Publishing…' : 'Publish'}</button>
          </div>
        </Modal>
      )}
      {history && <HistoryDrawer storeKey={storeKey} onClose={() => setHistory(false)} onLoad={(d) => { doc.setDraft(d as T); setHistory(false); }} onReset={async () => { await doc.resetToDefault(); setHistory(false); }} />}
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return (
    <dialog ref={ref} className="modal glass-float" aria-labelledby="modal-h" onClose={onClose} onCancel={onClose}>
      <h2 id="modal-h">{title}</h2>
      {children}
    </dialog>
  );
}

type Ver = { version: number; publishedAt: string; by: string; note?: string; data: unknown };
function HistoryDrawer({ storeKey, onClose, onLoad, onReset }: { storeKey: DocKey; onClose: () => void; onLoad: (d: unknown) => void; onReset: () => Promise<void> }) {
  const [list, setList] = useState<Ver[] | null>(null);
  const [sure, setSure] = useState(false);
  useEffect(() => { void fetch(`/api/store/${storeKey}?history=1`, { cache: 'no-store' }).then((r) => r.json()).then(setList).catch(() => setList([])); }, [storeKey]);
  return (
    <Modal title="Version history" onClose={onClose}>
      {!list ? <p role="status">Loading…</p> : !list.length ? <p>Nothing published yet. The website uses its built-in content.</p> : (
        <ol className="history">
          {list.map((v) => (
            <li key={v.version}>
              <div><b>Version {v.version}</b><span>{new Date(v.publishedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · {v.by}</span>{v.note && <em>{v.note}</em>}</div>
              <button type="button" className="btn sm" onClick={() => onLoad(v.data)}>Load into draft</button>
            </li>
          ))}
        </ol>
      )}
      <div className="modal-actions spread">
        {sure
          ? <button type="button" className="btn danger" onClick={() => void onReset()}>Yes, use built-in content</button>
          : <button type="button" className="btn ghost danger-text" onClick={() => setSure(true)}>Reset to built-in content…</button>}
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/** Convenience: SchemaForm bound to a path inside the document. */
export type Bind = { path: Path };
