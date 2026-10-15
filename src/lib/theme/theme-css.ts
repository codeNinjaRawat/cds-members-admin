/**
 * Turns the theme JSON (same structure the admin Website Theme editor saves) into CSS variables,
 * and checks WCAG contrast. Shared by: the website (render), scripts/build-theme.mjs (static file),
 * and later the admin editor (live preview + contrast gate).
 */
export type ThemeMode = Record<string, string>;
export type ThemeDef = { label?: string; story?: string; light: ThemeMode; dark: ThemeMode };
export type ThemesFile = { default: string; shared: Record<string, string>; themes: Record<string, ThemeDef> };

const SKIP = new Set(['label', 'story']);
const isSafe = (k: string, v: string) => /^[a-z0-9-]+$/.test(k) && !/[;{}<>]/.test(v);

function vars(obj: Record<string, string>, indent = '  '): string {
  return Object.entries(obj)
    .filter(([k, v]) => !SKIP.has(k) && isSafe(k, v))
    .map(([k, v]) => `${indent}--${k}: ${v};`)
    .join('\n');
}

export function buildThemeCss(file: ThemesFile, only?: string): string {
  const names = only ? [only] : Object.keys(file.themes);
  const def = file.themes[only ?? file.default] ?? Object.values(file.themes)[0];
  let css = `:root {\n${vars(file.shared)}\n${vars(def.light)}\n  color-scheme: light;\n}\n`;
  for (const name of names) {
    const t = file.themes[name];
    if (!t || !/^[a-z0-9-]+$/.test(name)) continue;
    css += `[data-theme="${name}"] {\n${vars(t.light)}\n  color-scheme: light;\n}\n`;
    css += `[data-theme="${name}"][data-mode="dark"] {\n${vars(t.dark)}\n  color-scheme: dark;\n}\n`;
  }
  return css;
}

/* ---------- WCAG contrast ---------- */
function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return 0;
  const [r, g, b] = m.slice(0, 3).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export const CONTRAST_PAIRS: Array<[string, string, number]> = [
  ['foreground', 'background', 4.5], ['foreground', 'card', 4.5], ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'card', 4.5], ['muted-foreground', 'muted', 4.5], ['primary-foreground', 'primary', 4.5],
  ['secondary-foreground', 'secondary', 4.5], ['highlight-foreground', 'highlight', 4.5],
  ['destructive-foreground', 'destructive', 4.5], ['primary', 'background', 4.5], ['primary', 'card', 4.5],
  ['success', 'card', 4.5], ['warning', 'card', 4.5], ['destructive', 'card', 4.5],
  ['ring', 'background', 3], ['hero-foreground', 'hero', 4.5], ['hero-muted', 'hero', 4.5], ['hero-accent', 'hero', 4.5],
];

export function checkContrast(file: ThemesFile): string[] {
  const problems: string[] = [];
  for (const [name, t] of Object.entries(file.themes)) {
    for (const mode of ['light', 'dark'] as const) {
      for (const [fg, bg, min] of CONTRAST_PAIRS) {
        const a = t[mode][fg], b = t[mode][bg];
        if (!a || !b) { problems.push(`${name}/${mode}: missing ${!a ? fg : bg}`); continue; }
        const r = contrastRatio(a, b);
        if (r < min) problems.push(`${name}/${mode}: ${fg} on ${bg} = ${r.toFixed(2)} (needs ${min})`);
      }
    }
  }
  return problems;
}
