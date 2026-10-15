'use client';
/** My appearance – each admin picks their own look. Saved in this browser (live: on the admin's user record). */
import { contrast, DEFAULT_APPEARANCE, PRESETS, useAppearance, type Appearance } from '@/lib/appearance/appearance';

const WALLS: { id: Appearance['wallpaper']; name: string; what: string }[] = [
  { id: 'silk', name: 'Onyx silk', what: 'Black silk with soft gold light' },
  { id: 'mountains', name: 'Night hills', what: 'Indigo sky, stars and layered hills' },
  { id: 'obsidian', name: 'Obsidian', what: 'Dark glass shards with soft colored light' },
  { id: 'aurora', name: 'Soft light', what: 'Slow color washes from your theme' },
  { id: 'girih', name: 'Girih', what: 'Eight-point star pattern over color' },
  { id: 'dusk', name: 'Houston dusk', what: 'Skyline photo, heavily blurred' },
  { id: 'plain', name: 'Plain', what: 'One calm color, no pattern' },
];

export function AppearanceView() {
  const [a, update] = useAppearance();
  const accent = a.accent ?? PRESETS.find((p) => p.id === a.preset)?.accent ?? '#0E5A45';
  const onDark = contrast(accent, '#FFFFFF') < 4.5; const cr = Math.max(contrast(accent, '#FFFFFF'), contrast(accent, '#14110A'));
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>My appearance</h1>
          <p className="page-intro">How the admin looks for you. Other admins keep their own choices. The website’s look is set in Theme and branding.</p>
        </div>
        <div className="page-actions"><button type="button" className="btn ghost" onClick={() => update({ ...DEFAULT_APPEARANCE, accent: undefined })}>Reset to default</button></div>
      </header>

      <section className="panel glass-pane" aria-labelledby="ap-theme">
        <h2 id="ap-theme" className="panel-h">Theme</h2>
        <div className="preset-grid" role="radiogroup" aria-labelledby="ap-theme">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={a.preset === p.id} className={`preset${a.preset === p.id ? ' active' : ''}`} onClick={() => update({ preset: p.id, accent: undefined, ...(p.bundle ?? {}) })}
              style={{ ['--p1' as string]: p.wallLight[0], ['--p2' as string]: p.wallLight[1], ['--p3' as string]: p.wallLight[2], ['--pa' as string]: p.accent, ['--ps' as string]: p.second }}>
              <span className="preset-art" aria-hidden="true"><i className="pane" /><i className="dot" /></span>
              <b>{p.name}</b><small>{p.story}</small>
            </button>
          ))}
        </div>
        <div className="field-row inline">
          <label className="sf-label" htmlFor="ap-accent">Accent color</label>
          <span className="in-color"><input id="ap-accent" type="color" value={accent} onChange={(e) => update({ accent: e.target.value.toUpperCase() })} /><code>{accent}</code></span>
          <span className={`pill ${cr >= 4.5 ? 'good' : 'bad'}`}>{cr >= 4.5 ? `Readable on buttons with ${onDark ? 'dark' : 'white'} text (${cr.toFixed(1)}:1)` : `Hard to read on buttons (${cr.toFixed(1)}:1) – pick another color`}</span>
          {a.accent && <button type="button" className="linkish" onClick={() => update({ accent: undefined })}>Use theme accent</button>}
        </div>
      </section>

      <div className="ap-grid">
        <Choice title="Light or dark" value={a.mode} onChange={(v) => update({ mode: v })} options={[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match my device']]} />
        <Choice title="Glass" value={a.glass} onChange={(v) => update({ glass: v })} options={[['clear', 'Clear'], ['frosted', 'Frosted'], ['solid', 'Solid']]}
          help="Solid removes see-through effects – easier to read and lighter on older computers. Turned on automatically if your device asks for reduced transparency." />
 <Choice title="Overview layout" value={a.dash} onChange={(v) => update({ dash: v })} options={[['focus', 'Focused'], ['command', 'Command center']]}
          help="Command center adds a side column with today's tasks, recent activity and suggestions." />
        <Choice title="Sidebar" value={a.nav} onChange={(v) => update({ nav: v })} options={[['rail', 'Icons only'], ['full', 'Icons and names']]}
          help="Icons only gives the page more room – point at the sidebar (or press Tab) to see the names." />
        <Choice title="Spacing" value={a.density} onChange={(v) => update({ density: v })} options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]} />
        <Choice title="Text size" value={a.text} onChange={(v) => update({ text: v })} options={[['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]} />
        <Choice title="Motion" value={a.motion} onChange={(v) => update({ motion: v })} options={[['full', 'Normal'], ['reduced', 'Reduced']]} />
      </div>

      <section className="panel glass-pane" aria-labelledby="ap-wall">
        <h2 id="ap-wall" className="panel-h">Background</h2>
        <div className="wall-grid" role="radiogroup" aria-labelledby="ap-wall">
          {WALLS.map((w) => (
            <button key={w.id} type="button" role="radio" aria-checked={a.wallpaper === w.id} className={`wall-card w-${w.id}${a.wallpaper === w.id ? ' active' : ''}`} onClick={() => update({ wallpaper: w.id })}>
              <span className="wall-art" aria-hidden="true" /><b>{w.name}</b><small>{w.what}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Choice<T extends string>({ title, value, options, onChange, help }: { title: string; value: T; options: [T, string][]; onChange: (v: T) => void; help?: string }) {
  const id = title.toLowerCase().replace(/\W+/g, '-');
  return (
    <section className="panel glass-pane" aria-labelledby={`ch-${id}`}>
      <h2 id={`ch-${id}`} className="panel-h">{title}</h2>
      <div className="seg" role="radiogroup" aria-labelledby={`ch-${id}`}>
        {options.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{l}</button>)}
      </div>
      {help && <p className="sf-hint">{help}</p>}
    </section>
  );
}
