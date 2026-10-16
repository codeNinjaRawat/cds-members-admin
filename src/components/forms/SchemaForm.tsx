'use client';
/**
 * SchemaForm – renders an editable form for any part of a website document from its zod contract.
 * Text, long text, money (cents shown as dollars), numbers, switches, choices, colors, images (preview + upload),
 * lists (add / reorder / duplicate / remove), keyed collections and block types. Errors appear under each field.
 */
import { useId, useState, type ReactNode } from 'react';
import type { ZodTypeAny } from 'zod';
import { emptyValue, hintFor, inspect, isCents, isColor, isImageShape, isLongText, itemTitle, labelFor, type Info } from '@/lib/schema-form/introspect';
import type { Issues, Path } from '@/lib/store/use-doc';

type Common = { path: Path; issues: Issues; depth: number };
const pk = (p: Path) => p.join('.');
const fid = (p: Path) => 'f-' + p.join('-').replace(/[^a-zA-Z0-9-]/g, '_');
const errorsUnder = (issues: Issues, p: Path) => { const k = pk(p); return Object.keys(issues).filter((x) => x === k || x.startsWith(k + '.')).length; };

export function SchemaForm({ schema, value, onChange, path = [], issues, only, omit, labels }: {
  schema: ZodTypeAny; value: unknown; onChange: (v: unknown) => void; path?: Path; issues: Issues;
  only?: string[]; omit?: string[]; labels?: Record<string, string>;
}) {
  const info = inspect(schema);
  if (info.kind !== 'object') return <Field name={String(path.at(-1) ?? 'value')} schema={schema} value={value} onChange={onChange} path={path} issues={issues} depth={0} />;
  const obj = (value ?? {}) as Record<string, unknown>;
  // with `only`, fields show in the order given there (so a screen can put the most-used settings first)
  const keys = (only ? only.filter((k) => k in info.shape!) : Object.keys(info.shape!)).filter((k) => !omit?.includes(k) && !k.startsWith('_'));
  return (
    <div className="sf">
      {keys.map((k) => (
        <Field key={k} name={k} label={labels?.[k]} schema={info.shape![k]} value={obj[k]} path={[...path, k]} issues={issues} depth={0}
          onChange={(v) => { const n = { ...obj }; if (v === undefined) delete n[k]; else n[k] = v; onChange(n); }} />
      ))}
    </div>
  );
}

function Field({ name, label, schema, value, onChange, ...c }: Common & { name: string; label?: string; schema: ZodTypeAny; value: unknown; onChange: (v: unknown) => void }) {
  const info = inspect(schema);
  const text = label ?? labelFor(name);
  if (info.kind === 'literal') return null;

  // optional + empty → offer to add
  if (info.optional && value === undefined && (info.kind === 'object' || info.kind === 'array' || info.kind === 'union')) {
    return <button type="button" className="sf-add-opt" onClick={() => onChange(info.kind === 'array' ? [] : emptyValue(info.schema))}>+ Add {text.toLowerCase()}</button>;
  }
  if (info.kind === 'object') {
    if (isImageShape(info)) return <ImageField label={text} info={info} value={value as Record<string, string>} onChange={onChange} {...c} />;
    return (
      <Group title={text} count={errorsUnder(c.issues, c.path)} depth={c.depth} onRemove={info.optional ? () => onChange(undefined) : undefined}>
        {Object.keys(info.shape!).filter((k) => !k.startsWith('_')).map((k) => (
          <Field key={k} name={k} schema={info.shape![k]} value={(value as Record<string, unknown>)?.[k]} path={[...c.path, k]} issues={c.issues} depth={c.depth + 1}
            onChange={(v) => { const n = { ...(value as object) } as Record<string, unknown>; if (v === undefined) delete n[k]; else n[k] = v; onChange(n); }} />
        ))}
      </Group>
    );
  }
  if (info.kind === 'array') return <ArrayField label={text} info={info} value={(value as unknown[]) ?? []} onChange={onChange} {...c} />;
  if (info.kind === 'record') return <RecordField label={text} info={info} value={(value as Record<string, unknown>) ?? {}} onChange={onChange} {...c} />;
  if (info.kind === 'union') return <UnionField label={text} info={info} value={value as Record<string, unknown>} onChange={onChange} {...c} />;
  return <Scalar name={name} label={text} info={info} value={value} onChange={onChange} {...c} />;
}

/** Contents of a list item / collection entry without an extra wrapper box. */
function Inner({ schema, value, onChange, path, issues, depth }: Common & { schema: ZodTypeAny; value: unknown; onChange: (v: unknown) => void }) {
  const info = inspect(schema);
  if (info.kind === 'union') return <UnionField label="" info={info} value={value as Record<string, unknown>} onChange={onChange} path={path} issues={issues} depth={depth} />;
  if (info.kind === 'object' && !isImageShape(info)) {
    const obj = (value ?? {}) as Record<string, unknown>;
    return <>{Object.keys(info.shape!).filter((k) => !k.startsWith('_')).map((k) => (
      <Field key={k} name={k} schema={info.shape![k]} value={obj[k]} path={[...path, k]} issues={issues} depth={depth}
        onChange={(nv) => { const n = { ...obj }; if (nv === undefined) delete n[k]; else n[k] = nv; onChange(n); }} />
    ))}</>;
  }
  return <Field name={String(path.at(-1))} label="Value" schema={schema} value={value} onChange={onChange} path={path} issues={issues} depth={depth} />;
}

/* ---------- scalars ---------- */
function Scalar({ name, label, info, value, onChange, path, issues }: Common & { name: string; label: string; info: Info; value: unknown; onChange: (v: unknown) => void }) {
  const id = fid(path); const err = issues[pk(path)]; const hint = hintFor(name);
  const described = [hint ? `${id}-h` : '', err ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;
  const optionalTag = info.optional ? <span className="sf-opt">optional</span> : null;
  let control: ReactNode;

  if (info.kind === 'boolean') {
    return (
      <div className={`sf-field sf-switch-row${err ? ' has-err' : ''}`}>
        <label className="switch" htmlFor={id}>
          <input id={id} type="checkbox" role="switch" checked={!!value} onChange={(e) => onChange(e.target.checked)} aria-describedby={described} />
          <span className="track" aria-hidden="true"><span className="thumb" /></span>
          <span className="sf-label">{label}</span>
        </label>
        {hint && <p className="sf-hint" id={`${id}-h`}>{hint}</p>}
        {err && <p className="sf-err" id={`${id}-e`}>{err}</p>}
      </div>
    );
  }
  if (info.kind === 'enum') {
    const opts = info.options!;
    control = opts.length <= 4 ? (
      <div className="seg" role="radiogroup" aria-labelledby={`${id}-l`}>
        {opts.map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}>{labelFor(o)}</button>)}
      </div>
    ) : (
      <select id={id} className="in" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} aria-describedby={described}>
        {opts.map((o) => <option key={o} value={o}>{labelFor(o)}</option>)}
      </select>
    );
  } else if (info.kind === 'number' && isCents(name)) {
    control = (
      <span className="in-money"><i aria-hidden="true">$</i>
        <input id={id} className="in" inputMode="decimal" value={value === undefined ? '' : ((value as number) / 100).toFixed(2)} aria-describedby={described} aria-invalid={!!err || undefined}
          onChange={(e) => { const n = parseFloat(e.target.value.replace(/[^\d.]/g, '')); onChange(e.target.value === '' && info.optional ? undefined : Number.isFinite(n) ? Math.round(n * 100) : 0); }} />
      </span>
    );
  } else if (info.kind === 'number') {
    control = <input id={id} className="in in-num" type="number" value={value === undefined ? '' : String(value)} min={info.min} max={info.max} step={info.int ? 1 : 'any'} aria-describedby={described} aria-invalid={!!err || undefined}
      onChange={(e) => onChange(e.target.value === '' ? (info.optional ? undefined : 0) : Number(e.target.value))} />;
  } else if (info.kind === 'string' && isColor(value)) {
    control = (
      <span className="in-color">
        <input type="color" value={String(value)} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={`${label} color picker`} />
        <input id={id} className="in" value={String(value)} onChange={(e) => onChange(e.target.value)} aria-describedby={described} aria-invalid={!!err || undefined} />
      </span>
    );
  } else if (info.kind === 'string' && isLongText(name, info)) {
    control = <textarea id={id} className="in in-area" rows={Math.min(8, Math.max(2, Math.ceil(String(value ?? '').length / 70)))} value={String(value ?? '')} maxLength={info.maxLength}
      dir={name === 'arabic' ? 'rtl' : undefined} lang={name === 'arabic' ? 'ar' : undefined}
      onChange={(e) => onChange(e.target.value === '' && info.optional ? undefined : e.target.value)} aria-describedby={described} aria-invalid={!!err || undefined} />;
  } else {
    control = <input id={id} className="in" value={String(value ?? '')} maxLength={info.maxLength} aria-describedby={described} aria-invalid={!!err || undefined}
      onChange={(e) => onChange(e.target.value === '' && info.optional ? undefined : e.target.value)} />;
  }
  const count = info.kind === 'string' && info.maxLength ? `${String(value ?? '').length}/${info.maxLength}` : null;
  return (
    <div className={`sf-field${err ? ' has-err' : ''}`}>
      <div className="sf-top"><label htmlFor={id} id={`${id}-l`} className="sf-label">{label}</label>{optionalTag}{count && <span className="sf-count">{count}</span>}</div>
      {hint && <p className="sf-hint" id={`${id}-h`}>{hint}</p>}
      {control}
      {err && <p className="sf-err" id={`${id}-e`}>{err}</p>}
    </div>
  );
}

/* ---------- groups ---------- */
function Group({ title, count, depth, children, onRemove, actions }: { title: string; count: number; depth: number; children: ReactNode; onRemove?: () => void; actions?: ReactNode }) {
  const [open, setOpen] = useState(depth < 1 || count > 0);
  const id = useId();
  return (
    <section className={`sf-group d${Math.min(depth, 3)}${open ? ' open' : ''}`}>
      <header>
        <button type="button" className="sf-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          <span>{title}</span>{count > 0 && <span className="sf-badge" aria-label={`${count} problems`}>{count}</span>}
        </button>
        {actions}
        {onRemove && <button type="button" className="sf-mini danger" onClick={onRemove}>Remove</button>}
      </header>
      <div id={id} className="sf-group-body" hidden={!open}>{children}</div>
    </section>
  );
}

/* ---------- lists ---------- */
function ArrayField({ label, info, value, onChange, path, issues, depth }: Common & { label: string; info: Info; value: unknown[]; onChange: (v: unknown) => void }) {
  const el = inspect(info.element!);
  const full = info.max !== undefined && value.length >= info.max;
  const move = (i: number, d: number) => { const n = [...value]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  const add = () => onChange([...value, emptyValue(info.element!)]);
  const singular = label.replace(/ies$/, 'y').replace(/s$/, '').toLowerCase();

  if (el.kind === 'string' || el.kind === 'number') {
    return (
      <div className="sf-field">
        <div className="sf-top"><span className="sf-label">{label}</span>{info.max && <span className="sf-count">{value.length}/{info.max}</span>}</div>
        <ul className="sf-plain">
          {value.map((v, i) => (
            <li key={i}>
              <input className="in" aria-label={`${label} ${i + 1}`} value={String(v ?? '')} aria-invalid={!!issues[pk([...path, i])] || undefined}
                onChange={(e) => { const n = [...value]; n[i] = el.kind === 'number' ? Number(e.target.value) : e.target.value; onChange(n); }} />
              <button type="button" className="sf-icon" aria-label={`Move ${label} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="sf-icon" aria-label={`Remove ${label} ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
        </ul>
        <button type="button" className="sf-add" disabled={full} onClick={add}>+ Add {singular}</button>
      </div>
    );
  }
  return (
    <Group title={`${label} (${value.length})`} count={errorsUnder(issues, path)} depth={depth}>
      <ol className="sf-list">
        {value.map((v, i) => (
          <li key={i}>
            <Group title={itemTitle(v, i)} count={errorsUnder(issues, [...path, i])} depth={depth + 1}
              actions={<span className="sf-item-actions">
                <button type="button" className="sf-icon" aria-label={`Move ${itemTitle(v, i)} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="sf-icon" aria-label={`Move ${itemTitle(v, i)} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="sf-icon" aria-label={`Duplicate ${itemTitle(v, i)}`} disabled={full} onClick={() => { const n = [...value]; n.splice(i + 1, 0, structuredClone(v)); onChange(n); }}>⧉</button>
                <button type="button" className="sf-icon danger" aria-label={`Remove ${itemTitle(v, i)}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
              </span>}>
              <Inner schema={info.element!} value={v} path={[...path, i]} issues={issues} depth={depth + 2}
                onChange={(nv) => { const n = [...value]; n[i] = nv; onChange(n); }} />
            </Group>
          </li>
        ))}
      </ol>
      <button type="button" className="sf-add" disabled={full} onClick={add}>+ Add {singular}{full ? ` (max ${info.max})` : ''}</button>
    </Group>
  );
}

/* ---------- keyed collections (feature flags, pages by address) ---------- */
function RecordField({ label, info, value, onChange, path, issues, depth }: Common & { label: string; info: Info; value: Record<string, unknown>; onChange: (v: unknown) => void }) {
  const [newKey, setNewKey] = useState('');
  const vt = inspect(info.valueType!);
  const add = () => { const k = newKey.trim(); if (!k || k in value) return; onChange({ ...value, [k]: emptyValue(info.valueType!) }); setNewKey(''); };
  return (
    <Group title={`${label} (${Object.keys(value).length})`} count={errorsUnder(issues, path)} depth={depth}>
      <div className="sf-record">
        {Object.entries(value).map(([k, v]) => vt.kind === 'boolean' ? (
          <div key={k} className="sf-rec-row">
            <Field name={k} label={k} schema={info.valueType!} value={v} path={[...path, k]} issues={issues} depth={depth + 1} onChange={(nv) => onChange({ ...value, [k]: nv })} />
            <button type="button" className="sf-icon danger" aria-label={`Remove ${k}`} onClick={() => { const n = { ...value }; delete n[k]; onChange(n); }}>×</button>
          </div>
        ) : (
          <Group key={k} title={k} count={errorsUnder(issues, [...path, k])} depth={depth + 1}
            actions={<button type="button" className="sf-icon danger" aria-label={`Remove ${k}`} onClick={() => { const n = { ...value }; delete n[k]; onChange(n); }}>×</button>}>
            <Inner schema={info.valueType!} value={v} path={[...path, k]} issues={issues} depth={depth + 2} onChange={(nv) => onChange({ ...value, [k]: nv })} />
          </Group>
        ))}
      </div>
      <div className="sf-rec-add">
        <input className="in" placeholder="New key, like about-us" value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9./-]/g, '-'))} aria-label={`New ${label} key`}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="sf-add" onClick={add} disabled={!newKey.trim() || newKey.trim() in value}>+ Add</button>
      </div>
      {issues[pk(path)] && <p className="sf-err">{issues[pk(path)]}</p>}
    </Group>
  );
}

/* ---------- block types (page builder) ---------- */
function UnionField({ label, info, value, onChange, path, issues, depth }: Common & { label: string; info: Info; value: Record<string, unknown>; onChange: (v: unknown) => void }) {
  const disc = info.discriminator!; const current = String(value?.[disc] ?? Object.keys(info.variants!)[0]);
  const variant = info.variants![current]; const vi = inspect(variant);
  const id = fid([...path, disc]);
  return (
    <div className="sf-union">
      <div className="sf-field sf-inline">
        <label className="sf-label" htmlFor={id}>{label ? `${label} type` : 'Block type'}</label>
        <select id={id} className="in" value={current} onChange={(e) => onChange(emptyValue(info.variants![e.target.value]))}>
          {Object.keys(info.variants!).map((t) => <option key={t} value={t}>{labelFor(t)}</option>)}
        </select>
      </div>
      {Object.keys(vi.shape!).filter((k) => k !== disc).map((k) => (
        <Field key={k} name={k} schema={vi.shape![k]} value={value?.[k]} path={[...path, k]} issues={issues} depth={depth + 1}
          onChange={(v) => { const n = { ...value }; if (v === undefined) delete n[k]; else n[k] = v; onChange(n); }} />
      ))}
    </div>
  );
}

/* ---------- images (media) ---------- */
function ImageField({ label, info, value, onChange, path, issues, depth }: Common & { label: string; info: Info; value: Record<string, string> | undefined; onChange: (v: unknown) => void }) {
  const [warn, setWarn] = useState('');
  const v = value ?? {};
  const upload = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(f.type)) return setWarn('Use a PNG, JPG, WebP, GIF or SVG image.');
    if (f.size > 600_000) setWarn(`This image is ${(f.size / 1024).toFixed(0)} KB. In the demo, images over ~600 KB make pages slow – the live media library will resize automatically.`);
    else setWarn('');
    const r = new FileReader();
    r.onload = () => onChange({ ...v, src: String(r.result), credit: undefined, creditUrl: undefined });
    r.readAsDataURL(f);
  };
  return (
    <Group title={label} count={errorsUnder(issues, path)} depth={depth} onRemove={info.optional ? () => onChange(undefined) : undefined}>
      <div className="sf-image">
        <div className="sf-thumb">{v.src ? <img src={v.src} alt="" style={{ objectPosition: v.focal || '50% 50%' }} /> : <span>No image</span>}</div>
        <div className="sf-image-fields">
          <label className="sf-upload">
            <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} />
            <span>Upload image</span>
          </label>
          {warn && <p className="sf-warn" role="status">{warn}</p>}
          {Object.keys(info.shape!).map((k) => (
            <Field key={k} name={k} schema={info.shape![k]} value={v[k]} path={[...path, k]} issues={issues} depth={depth + 1}
              onChange={(nv) => { const n = { ...v } as Record<string, unknown>; if (nv === undefined) delete n[k]; else n[k] = nv; onChange(n); }} />
          ))}
        </div>
      </div>
    </Group>
  );
}
