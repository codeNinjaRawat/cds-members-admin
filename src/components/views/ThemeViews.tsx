'use client';
/**
 * A8 Website theme editor: colors per theme and mode with a live contrast check and instant preview,
 * logo/favicon uploads, and visitor options (active theme, default light/dark, visitor toggle).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SiteConfig, Branding } from '@/lib/site-config/schema';
import { DEFAULT_BRANDING } from '@/lib/site-config/schema';
import { buildThemeCss, contrastRatio, CONTRAST_PAIRS, type ThemesFile } from '@/lib/theme/theme-css';
import { DocEditor, Modal, type DocApi } from '@/components/editor/DocEditor';
import type { PreviewHandle } from '@/components/editor/LivePreview';
import { Panel, SwitchRow } from '@/components/editor/bits';

const GROUPS: [string, string[]][] = [
  ['Page', ['background', 'foreground', 'muted', 'muted-foreground', 'border', 'input', 'ring']],
  ['Cards and soft areas', ['card', 'card-foreground', 'secondary', 'secondary-foreground', 'accent', 'accent-foreground']],
  ['Brand', ['primary', 'primary-foreground', 'highlight', 'highlight-foreground']],
  ['Dark hero band', ['hero', 'hero-foreground', 'hero-muted', 'hero-accent']],
  ['Messages', ['success', 'warning', 'destructive', 'destructive-foreground']],
];
const TOKEN_LABEL = (t: string) => t.replace(/-/g, ' ').replace('foreground', 'text').replace(/^./, (c) => c.toUpperCase());

export function ThemePage() {
  const [tab, setTab] = useState<'colors' | 'brand' | 'visitor'>('colors');
  return (
    <div>
      <nav className="subnav glass-pane" aria-label="Theme and branding">
        {([['colors', 'Colors'], ['brand', 'Logo and icons'], ['visitor', 'Visitor options']] as const).map(([id, l]) => (
          <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{l}</button>
        ))}
      </nav>
      {tab === 'colors' && <ColorsEditor />}
      {tab === 'brand' && <BrandingEditor />}
      {tab === 'visitor' && <VisitorEditor />}
    </div>
  );
}

/* ---------- Colors ---------- */
function ColorsEditor() {
  return (
    <DocEditor<ThemesFile> storeKey="themes" title="Website colors" intro="Every color on the website, for light and dark mode. Changes show in the preview right away; publish when the contrast check is all green.">
      {(doc, preview) => <ColorsBody doc={doc} preview={preview} />}
    </DocEditor>
  );
}

function ColorsBody({ doc, preview }: { doc: DocApi<ThemesFile>; preview: React.RefObject<PreviewHandle | null> }) {
  const names = Object.keys(doc.draft.themes);
  const [edit, setEdit] = useState(doc.draft.default in doc.draft.themes ? doc.draft.default : names[0]);
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [dup, setDup] = useState(false);
  const theme = doc.draft.themes[edit] ?? doc.draft.themes[names[0]];
  const tokens = theme[mode];

  const push = useCallback(() => {
    preview.current?.post({ type: 'isgh:preview-theme', css: buildThemeCss(doc.draft, edit), theme: edit, mode });
  }, [doc.draft, edit, mode, preview]);
  useEffect(() => { const t = setTimeout(push, 120); return () => clearTimeout(t); }, [push]);
  useEffect(() => { const on = (e: MessageEvent) => { if (e.data?.type === 'isgh:preview-ready') push(); }; window.addEventListener('message', on); return () => window.removeEventListener('message', on); }, [push]);

  const setToken = (k: string, v: string) => {
    const next = { ...tokens, [k]: v };
    // smart: keep focus ring + text-on-brand readable when the brand color changes
    if (k === 'primary' && /^#[0-9a-f]{6}$/i.test(v)) {
      next.ring = v;
      next['primary-foreground'] = contrastRatio('#FFFFFF', v) >= 4.5 ? '#FFFFFF' : '#10221B';
    }
    doc.setDraft({ ...doc.draft, themes: { ...doc.draft.themes, [edit]: { ...theme, [mode]: next } } });
  };

  const checks = useMemo(() => CONTRAST_PAIRS.map(([fg, bg, min]) => {
    const a = tokens[fg], b = tokens[bg];
    const r = a && b && /^#[0-9a-f]{6}$/i.test(a) && /^#[0-9a-f]{6}$/i.test(b) ? contrastRatio(a, b) : 0;
    return { fg, bg, min, r, ok: r >= min, a, b };
  }), [tokens]);
  const fails = checks.filter((c) => !c.ok).length;
  const allFails = useMemo(() => names.reduce((n, t) => n + (['light', 'dark'] as const).reduce((m, md) => m + CONTRAST_PAIRS.filter(([f, b, min]) => {
    const x = doc.draft.themes[t][md][f], y = doc.draft.themes[t][md][b]; return !x || !y || contrastRatio(x, y) < min; }).length, 0), 0), [doc.draft, names]);

  const other = Object.keys(tokens).filter((k) => !GROUPS.some(([, ks]) => ks.includes(k)));

  return (<>
    <Panel title="Themes">
      <ul className="theme-cards">
        {names.map((n) => { const t = doc.draft.themes[n]; return (
          <li key={n}>
            <button type="button" className={`theme-card${n === edit ? ' active' : ''}`} aria-pressed={n === edit} onClick={() => setEdit(n)}>
              <span className="sw-strip" aria-hidden="true">{['hero', 'primary', 'highlight', 'background'].map((k) => <i key={k} style={{ background: t[mode][k] }} />)}</span>
              <b>{t.label ?? n}</b>{n === doc.draft.default && <em>Fallback default</em>}
              {t.story && <small>{t.story}</small>}
            </button>
          </li>
        ); })}
      </ul>
      <div className="row-actions">
        <button type="button" className="btn sm" onClick={() => setDup(true)}>Duplicate “{theme.label ?? edit}”</button>
        <button type="button" className="btn sm ghost" disabled={edit === doc.draft.default} onClick={() => doc.setDraft({ ...doc.draft, default: edit })}>Make fallback default</button>
        <button type="button" className="btn sm ghost danger-text" disabled={names.length < 2 || edit === doc.draft.default} onClick={() => { const t = { ...doc.draft.themes }; delete t[edit]; doc.setDraft({ ...doc.draft, themes: t }); setEdit(doc.draft.default); }}>Delete theme</button>
      </div>
      <p className="panel-intro">Which theme visitors see is set in <b>Visitor options</b>. Seasonal idea: duplicate a theme as “Ramadan” and switch to it for the month.</p>
    </Panel>

    <Panel title={`Edit “${theme.label ?? edit}”`}>
      <div className="row-between">
        <div className="seg" role="radiogroup" aria-label="Mode to edit">
          {(['light', 'dark'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>{m === 'light' ? 'Light mode' : 'Dark mode'}</button>)}
        </div>
        <span className={`pill ${fails ? 'bad' : 'good'}`}>{fails ? `${fails} contrast problem${fails > 1 ? 's' : ''} in ${mode} mode` : `All readable in ${mode} mode`}</span>
      </div>
      <div className="field-row">
        <label className="sf-label" htmlFor="th-label">Name</label>
        <input id="th-label" className="in" value={theme.label ?? ''} onChange={(e) => doc.setDraft({ ...doc.draft, themes: { ...doc.draft.themes, [edit]: { ...theme, label: e.target.value } } })} />
      </div>
      {[...GROUPS, ...(other.length ? [['Other', other] as [string, string[]]] : [])].map(([g, keys]) => (
        <fieldset key={g} className="token-group">
          <legend>{g}</legend>
          <div className="tokens">
            {keys.filter((k) => k in tokens).map((k) => (
              <div key={k} className="token">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(tokens[k]) ? tokens[k] : '#000000'} onChange={(e) => setToken(k, e.target.value.toUpperCase())} aria-label={`${TOKEN_LABEL(k)} color picker`} />
                <div><label htmlFor={`tk-${k}`}>{TOKEN_LABEL(k)}</label>
                  <input id={`tk-${k}`} className="in mono" value={tokens[k]} onChange={(e) => setToken(k, e.target.value)} aria-invalid={!!doc.issues[`themes.${edit}.${mode}.${k}`] || undefined} /></div>
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </Panel>

    <Panel title="Contrast check (WCAG AA)" intro={allFails ? `Publishing is blocked until every pair passes in all themes and modes (${allFails} left).` : 'Every text color is readable on its background. Ready to publish.'}>
      <ul className="contrast">
        {checks.map((c) => (
          <li key={c.fg + c.bg} className={c.ok ? 'ok' : 'bad'}>
            <span className="sample" style={{ color: c.a, background: c.b }}>Aa</span>
            <span>{TOKEN_LABEL(c.fg)} on {TOKEN_LABEL(c.bg).toLowerCase()}</span>
            <b>{c.r ? c.r.toFixed(2) : '–'}</b><small>needs {c.min}</small>
            <i aria-label={c.ok ? 'passes' : 'fails'}>{c.ok ? '✓' : '✕'}</i>
          </li>
        ))}
      </ul>
    </Panel>

    {dup && <DuplicateTheme existing={names} onClose={() => setDup(false)} onCreate={(id, label) => {
      doc.setDraft({ ...doc.draft, themes: { ...doc.draft.themes, [id]: { ...structuredClone(theme), label, story: `Copy of ${theme.label ?? edit}` } } }); setEdit(id); setDup(false);
    }} />}
  </>);
}

function DuplicateTheme({ existing, onClose, onCreate }: { existing: string[]; onClose: () => void; onCreate: (id: string, label: string) => void }) {
  const [label, setLabel] = useState('Ramadan');
  const id = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const bad = !id || existing.includes(id);
  return (
    <Modal title="Duplicate theme" onClose={onClose}>
      <label className="sf-label" htmlFor="dup-name">Name of the new theme</label>
      <input id="dup-name" className="in" value={label} onChange={(e) => setLabel(e.target.value)} />
      {bad && <p className="sf-err">{id ? 'A theme with this name exists.' : 'Enter a name.'}</p>}
      <div className="modal-actions"><button className="btn ghost" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" disabled={bad} onClick={() => onCreate(id, label)}>Create</button></div>
    </Modal>
  );
}

/* ---------- Logo and icons ---------- */
const BRAND_FILES: { key: keyof Branding; label: string; help: string; bg: 'light' | 'dark'; accept: string }[] = [
  { key: 'logoLight', label: 'Logo for light backgrounds', help: 'Header on white pages. SVG or PNG, square, at least 256×256.', bg: 'light', accept: 'image/svg+xml,image/png' },
  { key: 'logoDark', label: 'Logo for dark backgrounds', help: 'Over the dark hero, in dark mode and in the footer.', bg: 'dark', accept: 'image/svg+xml,image/png' },
  { key: 'favicon', label: 'Browser tab icon (SVG)', help: 'Small and simple – it shows at 16×16 pixels.', bg: 'light', accept: 'image/svg+xml' },
  { key: 'faviconIco', label: 'Tab icon for older browsers (.ico or PNG)', help: '48×48 pixels.', bg: 'light', accept: 'image/x-icon,image/vnd.microsoft.icon,image/png' },
  { key: 'appleTouchIcon', label: 'iPhone home screen icon', help: 'PNG, 180×180, no transparency.', bg: 'light', accept: 'image/png' },
  { key: 'ogImage', label: 'Share image', help: 'Shown when a link is shared on WhatsApp, Facebook or X. PNG/JPG, 1200×630.', bg: 'light', accept: 'image/png,image/jpeg' },
];
function BrandingEditor() {
  return (
    <DocEditor<SiteConfig> storeKey="site-config" scope={['branding']} title="Logo and icons" intro="Upload the logo, browser tab icons and the image shown when someone shares the website.">
      {(doc) => {
        const b = doc.draft.branding ?? DEFAULT_BRANDING;
        const set = (patch: Partial<Branding>) => doc.setDraft({ ...doc.draft, branding: { ...b, ...patch } });
        return (<>
          {BRAND_FILES.map((f) => <BrandFile key={f.key} f={f} value={String(b[f.key] ?? '')} onChange={(v, uploaded) => set({ [f.key]: v, ...(uploaded ? { version: `upload-${Date.now().toString(36)}` } : {}) } as Partial<Branding>)} />)}
          <Panel title="Text and color">
            <div className="field-row"><label className="sf-label" htmlFor="br-alt">Logo text alternative</label><input id="br-alt" className="in" value={b.logoAlt} onChange={(e) => set({ logoAlt: e.target.value })} /></div>
            <div className="field-row"><label className="sf-label" htmlFor="br-color">Browser bar color (phones)</label>
              <span className="in-color"><input type="color" value={b.themeColor} onChange={(e) => set({ themeColor: e.target.value.toUpperCase() })} aria-label="Browser bar color picker" /><input id="br-color" className="in mono" value={b.themeColor} onChange={(e) => set({ themeColor: e.target.value })} /></span>
              {doc.issues['branding.themeColor'] && <p className="sf-err">{doc.issues['branding.themeColor']}</p>}
            </div>
            <div className="field-row"><label className="sf-label" htmlFor="br-ver">Version</label><input id="br-ver" className="in mono" value={b.version ?? ''} onChange={(e) => set({ version: e.target.value })} /><p className="sf-hint">Changes automatically when you upload, so browsers fetch the new files.</p></div>
            <button type="button" className="btn sm ghost" onClick={() => doc.setDraft({ ...doc.draft, branding: DEFAULT_BRANDING })}>Use the original ISGH files</button>
          </Panel>
        </>);
      }}
    </DocEditor>
  );
}
function BrandFile({ f, value, onChange }: { f: (typeof BRAND_FILES)[number]; value: string; onChange: (v: string, uploaded: boolean) => void }) {
  const [warn, setWarn] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const src = value.startsWith('data:') || /^https?:/.test(value) ? value : value ? `${process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'http://localhost:3000'}${value}` : '';
  const upload = (file?: File) => {
    if (!file) return;
    if (file.size > 400_000) return setWarn(`That file is ${(file.size / 1024).toFixed(0)} KB. Use one under 400 KB.`);
    setWarn('');
    const r = new FileReader(); r.onload = () => onChange(String(r.result), true); r.readAsDataURL(file);
  };
  return (
    <Panel>
      <div className="brand-row">
        <div className={`brand-prev ${f.bg}`}>{src ? <img src={src} alt="" /> : <span>None</span>}</div>
        <div className="brand-fields">
          <label className="sf-label" htmlFor={`bf-${f.key}`}>{f.label}</label>
          <p className="sf-hint">{f.help}</p>
          <div className="row-actions">
            <button type="button" className="btn sm" onClick={() => input.current?.click()}>Upload</button>
            <input ref={input} type="file" accept={f.accept} hidden onChange={(e) => upload(e.target.files?.[0])} />
            <input id={`bf-${f.key}`} className="in mono" value={value.startsWith('data:') ? `Uploaded file (${Math.round(value.length * 0.75 / 1024)} KB)` : value}
              readOnly={value.startsWith('data:')} onChange={(e) => onChange(e.target.value, false)} />
          </div>
          {warn && <p className="sf-err" role="alert">{warn}</p>}
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Visitor options ---------- */
function VisitorEditor() {
  const [themes, setThemes] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => { void fetch('/api/store/themes').then((r) => r.json()).then((j) => setThemes(Object.entries((j.data as ThemesFile).themes).map(([id, t]) => ({ id, label: t.label ?? id })))).catch(() => setThemes([])); }, []);
  return (
    <DocEditor<SiteConfig> storeKey="site-config" scope={['theme']} title="Visitor options" intro="Which theme the website uses and how light and dark mode behave for visitors.">
      {(doc) => {
        const t = doc.draft.theme;
        const set = (p: Partial<SiteConfig['theme']>) => doc.setDraft({ ...doc.draft, theme: { ...t, ...p } });
        const missing = themes.length > 0 && !themes.some((x) => x.id === t.active);
        return (
          <Panel>
            <div className="field-row">
              <label className="sf-label" htmlFor="v-active">Website theme</label>
              <select id="v-active" className="in" value={t.active} onChange={(e) => set({ active: e.target.value })}>
                {themes.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                {missing && <option value={t.active}>{t.active} (not found – publish it in Colors first)</option>}
              </select>
              <p className="sf-hint">Make new themes in Colors. Unpublished themes are not available here yet.</p>
            </div>
            <div className="field-row">
              <span className="sf-label" id="v-mode">What visitors see first</span>
              <div className="seg" role="radiogroup" aria-labelledby="v-mode">
                {(['light', 'dark', 'system'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={t.defaultMode === m} onClick={() => set({ defaultMode: m })}>{m === 'system' ? 'Match their device' : m === 'light' ? 'Light' : 'Dark'}</button>)}
              </div>
            </div>
            <SwitchRow id="v-toggle" label="Let visitors switch light/dark" help="Their choice is remembered in their browser." checked={t.allowUserModeToggle} onChange={(v) => set({ allowUserModeToggle: v })} />
          </Panel>
        );
      }}
    </DocEditor>
  );
}
