'use client';
/**
 * useDoc(key) – load a website document, edit a DRAFT, publish it.
 *  - Draft autosaves in this browser (localStorage) so nothing is lost on refresh; banner offers to discard.
 *  - Live validation with the website's own zod schema (errors by field path).
 *  - Publish sends baseVersion → the server refuses if someone else published meanwhile (409).
 *  - Speed: typing never waits for saving or checking – the draft is saved 400 ms after the last change and
 *    validation / "unsaved" run on a deferred copy (large docs with uploaded images stay smooth).
 * Live (BE phase): same hook, endpoints switch to the BE admin API.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { REGISTRY, type DocKey } from './registry';

export type DocMeta = { version: number; publishedAt: string | null; by: string | null; source: 'published' | 'default' };
export type Issues = Record<string, string>;
type State = { status: 'loading' | 'ready' | 'error'; meta: DocMeta | null; base: unknown; draft: unknown; restored: boolean; error?: string };

const draftKey = (k: DocKey) => `isgh-admin-draft:${k}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useDoc<T = unknown>(key: DocKey) {
  const [s, setS] = useState<State>({ status: 'loading', meta: null, base: null, draft: null, restored: false });
  const [busy, setBusy] = useState<null | 'publish' | 'reset'>(null);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'error'; text: string; issues?: { path: string; message: string }[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/store/${key}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      // Older saved documents may miss fields added later: let the schema fill the defaults.
      const up = (v: unknown) => { const p = REGISTRY[key].schema.safeParse(v); return p.success ? p.data : v; };
      j.data = up(j.data);
      let draft = j.data, restored = false;
      try {
        const saved = localStorage.getItem(draftKey(key));
        if (saved) { const d = JSON.parse(saved); if (d.baseVersion === j.version && !same(d.data, j.data)) { draft = up(d.data); restored = true; } }
      } catch { /* ignore */ }
      setS({ status: 'ready', meta: { version: j.version, publishedAt: j.publishedAt, by: j.by, source: j.source }, base: j.data, draft, restored });
    } catch (e) {
      setS((x) => ({ ...x, status: 'error', error: 'Could not load this document. Is the admin app running?' }));
    }
  }, [key]);
  useEffect(() => { void load(); }, [load]);

  const edited = useRef(false);
  const setDraft = useCallback((next: unknown | ((d: unknown) => unknown)) => {
    setS((x) => ({ ...x, draft: typeof next === 'function' ? (next as (d: unknown) => unknown)(x.draft) : next }));
    edited.current = true;
  }, []);

  // autosave the draft (debounced, only after a real edit)
  useEffect(() => {
    if (!edited.current || s.status !== 'ready') return;
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey(key), JSON.stringify({ baseVersion: s.meta?.version ?? 0, data: s.draft })); } catch { /* storage full */ }
    }, 400);
    return () => clearTimeout(t);
  }, [s.draft, s.meta, s.status, key]);
  const flushDraft = () => { try { if (edited.current) localStorage.setItem(draftKey(key), JSON.stringify({ baseVersion: s.meta?.version ?? 0, data: s.draft })); } catch { /* */ } };
  useEffect(() => { window.addEventListener('pagehide', flushDraft); return () => window.removeEventListener('pagehide', flushDraft); });

  const schema = REGISTRY[key].schema;
  const checked = useDeferredValue(s.draft);
  const issues: Issues = useMemo(() => {
    if (s.status !== 'ready') return {};
    const r = schema.safeParse(checked);
    if (r.success) return {};
    const out: Issues = {};
    for (const i of r.error.issues) { const p = i.path.join('.'); out[p] = !out[p] ? i.message : out[p].includes(i.message) ? out[p] : `${out[p]} ${i.message}`; }
    return out;
  }, [checked, s.status, schema]);

  const dirty = useMemo(() => s.status === 'ready' && checked !== s.base && !same(checked, s.base), [checked, s.base, s.status]);

  const discard = () => { edited.current = false; try { localStorage.removeItem(draftKey(key)); } catch { /* */ } setS((x) => ({ ...x, draft: x.base, restored: false })); setFlash(null); };

  const publish = async (note?: string, force = false) => {
    setBusy('publish'); setFlash(null);
    try {
      const r = await fetch(`/api/store/${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: s.draft, baseVersion: force ? undefined : s.meta?.version, note }) });
      const j = await r.json();
      if (!r.ok) { setFlash({ tone: 'error', text: j.error ?? 'Publish failed.', issues: j.issues }); return false; }
      edited.current = false; try { localStorage.removeItem(draftKey(key)); } catch { /* */ }
      setS((x) => ({ ...x, base: x.draft, restored: false, meta: { version: j.version, publishedAt: j.publishedAt, by: 'You', source: 'published' } }));
      setFlash({ tone: 'ok', text: `Published version ${j.version}. The website shows it now.` });
      window.dispatchEvent(new CustomEvent('isgh:published', { detail: { key } }));
      return true;
    } catch { setFlash({ tone: 'error', text: 'Could not reach the admin server. Your draft is saved in this browser.' }); return false; }
    finally { setBusy(null); }
  };

  const resetToDefault = async () => {
    setBusy('reset');
    try { await fetch(`/api/store/${key}`, { method: 'DELETE' }); edited.current = false; try { localStorage.removeItem(draftKey(key)); } catch { /* */ } await load();
      setFlash({ tone: 'ok', text: 'Back to the built-in content. Earlier versions stay in History.' });
      window.dispatchEvent(new CustomEvent('isgh:published', { detail: { key } }));
    } finally { setBusy(null); }
  };

  return { ...s, draft: s.draft as T, base: s.base as T, setDraft: setDraft as (n: T | ((d: T) => T)) => void, issues, dirty, busy, flash, setFlash, publish, discard, resetToDefault, reload: load };
}

/* ---------- immutable path helpers ---------- */
export type Path = (string | number)[];
export function getIn(obj: unknown, path: Path): unknown {
  return path.reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string | number, unknown>)[k]), obj);
}
export function setIn<T>(obj: T, path: Path, value: unknown): T {
  if (!path.length) return value as T;
  const [k, ...rest] = path;
  const base: Record<string | number, unknown> | unknown[] = Array.isArray(obj) ? [...obj] : { ...(obj as object) };
  const nextVal = setIn((obj as Record<string | number, unknown> | undefined)?.[k], rest, value);
  if (nextVal === undefined && !Array.isArray(base)) delete (base as Record<string | number, unknown>)[k];
  else (base as Record<string | number, unknown>)[k] = nextVal;
  return base as T;
}
