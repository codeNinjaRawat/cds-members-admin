'use client';
/**
 * O1.4 Page Composer – admins build a page from blocks: add from a grouped palette, reorder (drag, or keyboard
 * ↑ ↓), duplicate, collapse, edit each block with the schema form, and set the page's own settings
 * (template, scope, status + schedule, SEO, members-only). The preview window (DocEditor) shows the page with
 * ?preview=1 after Publish. Content contract: web lib/content/pages.ts (synced).
 */
import { useMemo, useState, type DragEvent } from 'react';
import { BlockSchema, PageSchema, type Block, type Page } from '@/lib/content/pages';
import { liveReason } from '@/lib/content/page-rules';
import { SchemaForm } from '@/components/forms/SchemaForm';
import { Modal } from '@/components/editor/DocEditor';
import { countIssues } from '@/components/editor/bits';
import { CATALOG, GROUPS, GROUP_LABEL } from '@/lib/content/block-catalog';

type Issues = Record<string, string>;
const PAGE_FIELDS = ['title', 'intro', 'image', 'template', 'scope', 'visibility', 'status', 'publishAt', 'unpublishAt', 'seo', 'owner', 'reviewedAt'];
const blockSchemaFor = (type: Block['type']) => BlockSchema.options.find((o) => o.shape.type.value === type)!;

export function PageComposer({ page, path, issues, onChange, masjids, editorOnly = false }: {
  page: Page; path: string[]; issues: Issues; onChange: (p: Page) => void;
  /** O1.5 masjid editor: no publishing – the status stays draft / review */
  editorOnly?: boolean;
  /** Active centers – shown as hints for live blocks (ids are what the blocks store). */
  masjids: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [settings, setSettings] = useState(false);
  const [palette, setPalette] = useState<number | null>(null);   // insert position
  const [drag, setDrag] = useState<number | null>(null);
  const blocks = page.blocks;
  const set = (next: Block[]) => onChange({ ...page, blocks: next, updatedAt: new Date().toISOString().slice(0, 10) });
  const move = (from: number, to: number) => { if (to < 0 || to >= blocks.length || from === to) return; const n = blocks.slice(); const [b] = n.splice(from, 1); n.splice(to, 0, b); set(n); setOpen({}); };
  const remove = (i: number) => { set(blocks.filter((_, k) => k !== i)); setOpen({}); };
  const duplicate = (i: number) => { const n = blocks.slice(); n.splice(i + 1, 0, JSON.parse(JSON.stringify(blocks[i]))); set(n); };
  const insert = (type: Block['type'], at: number) => { const n = blocks.slice(); n.splice(at, 0, CATALOG[type].starter()); set(n); setOpen({ [at]: true }); setPalette(null); };
  const reason = liveReason(page);
  const pageIssues = countIssues(issues, [path.join('.')]) - countIssues(issues, [[...path, 'blocks'].join('.')]);
  const masjidHint = useMemo(() => (masjids.length ? `Masjid ids: ${masjids.map((m) => `${m.name} = ${m.id}`).join(' · ')}` : ''), [masjids]);

  const onDrop = (e: DragEvent, to: number) => { e.preventDefault(); if (drag !== null) move(drag, to); setDrag(null); };

  return (
    <div className="pc">
      <section className={`pc-settings ${settings ? 'open' : ''}`}>
        <button type="button" className="pc-settings-toggle" aria-expanded={settings} onClick={() => setSettings((v) => !v)}>
          <span><b>Page settings</b> · {page.template} · {page.scope.kind === 'masjid' ? `masjid ${page.scope.center}` : 'organization'} · {page.visibility === 'members' ? 'members only' : 'public'}</span>
          <span className="pc-status" data-live={reason ? 'no' : 'yes'}>{reason || 'Live for visitors'}{pageIssues > 0 && <em className="sf-badge">{pageIssues}</em>}</span>
        </button>
        {settings && (
          <div className="pc-settings-body">
            {editorOnly && <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
              {page.status !== 'review' ? <button type="button" className="btn primary sm" onClick={() => onChange({ ...page, status: 'review' })}>Submit for review</button> : <button type="button" className="btn sm" onClick={() => onChange({ ...page, status: 'draft' })}>Back to draft</button>}
            </div>}
            <SchemaForm schema={PageSchema} value={page} path={path} issues={issues} only={editorOnly ? PAGE_FIELDS.filter((k) => !['status', 'scope', 'publishAt', 'unpublishAt'].includes(k)) : PAGE_FIELDS} onChange={(v) => onChange(v as Page)}
              labels={{ scope: 'Belongs to', template: 'Layout', publishAt: 'Go live at (Houston time)', unpublishAt: 'Take down at', seo: 'Search & share (SEO)', reviewedAt: 'Last reviewed on' }} />
            {masjidHint && <p className="sf-hint">{masjidHint}</p>}
          </div>
        )}
      </section>

      <ol className="pc-blocks" aria-label="Page blocks">
        {blocks.map((b, i) => {
          const meta = CATALOG[b.type]; const isOpen = !!open[i]; const bPath = [...path, 'blocks', String(i)];
          const n = countIssues(issues, [bPath.join('.')]);
          return (
            <li key={`${i}-${b.type}`} className={`pc-block ${isOpen ? 'open' : ''} ${drag === i ? 'dragging' : ''}`} data-group={meta?.group}
              draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, i)} onDragEnd={() => setDrag(null)}>
              <div className="pc-block-head">
                <span className="pc-grip" aria-hidden title="Drag to reorder">⋮⋮</span>
                <button type="button" className="pc-block-title" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
                  <b>{meta?.label ?? b.type}</b><span>{meta?.summary(b) || meta?.help}</span>
                  {n > 0 && <em className="sf-badge" title="Problems in this block">{n}</em>}
                </button>
                <span className="pc-block-actions" role="group" aria-label={`Block ${i + 1} actions`}>
                  <button type="button" className="icon-btn sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                  <button type="button" className="icon-btn sm" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)}>↓</button>
                  <button type="button" className="icon-btn sm" aria-label="Duplicate" onClick={() => duplicate(i)}>⧉</button>
                  <button type="button" className="icon-btn sm danger-text" aria-label="Remove block" onClick={() => remove(i)}>✕</button>
                </span>
              </div>
              {isOpen && (
                <div className="pc-block-body">
                  <p className="sf-hint">{meta?.help}{meta?.group === 'live' && masjidHint ? ` ${masjidHint}` : ''}</p>
                  <SchemaForm schema={blockSchemaFor(b.type)} value={b} path={bPath} issues={issues} omit={['type']}
                    onChange={(v) => { const nb = blocks.slice(); nb[i] = v as Block; set(nb); }} />
                </div>
              )}
              <button type="button" className="pc-insert" onClick={() => setPalette(i + 1)} aria-label={`Add a block after block ${i + 1}`}>+ Add block here</button>
            </li>
          );
        })}
        {blocks.length === 0 && <li className="pc-empty"><p>This page has no blocks yet.</p></li>}
      </ol>
      <button type="button" className="btn primary pc-add" onClick={() => setPalette(blocks.length)}>+ Add block</button>

      {palette !== null && (
        <Modal title="Add a block" onClose={() => setPalette(null)}>
          <div className="pc-palette">
            {GROUPS.map((g) => (
              <section key={g}>
                <h4>{GROUP_LABEL[g]}</h4>
                <div className="pc-palette-grid">
                  {(Object.keys(CATALOG) as Block['type'][]).filter((t) => CATALOG[t].group === g).map((t) => (
                    <button key={t} type="button" className="pc-palette-item" onClick={() => insert(t, palette)}>
                      <b>{CATALOG[t].label}</b><span>{CATALOG[t].help}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
