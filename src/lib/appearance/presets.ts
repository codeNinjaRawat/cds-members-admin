/**
 * Admin's OWN look (per admin user; demo: this browser). Live: saved on the admin user record in the BE.
 * Organization default preset: Settings › Admin appearance (planned) – used until a user picks their own.
 */

export type Preset = { id: string; name: string; story: string; onAccent?: string; bundle?: Partial<Pick<Appearance, 'wallpaper' | 'nav' | 'dash'>>; accent: string; accentDark: string; second: string; wallLight: [string, string, string]; wallDark: [string, string, string] };

export const PRESETS: Preset[] = [
  { id: 'luxe', name: 'Onyx and gold', story: 'Ultra-premium: onyx glass with champagne-gold hairlines', accent: '#C9A35C', accentDark: '#E3C58A', second: '#7FC9B8', wallLight: ['#F2EDE3', '#E9E2D2', '#E3E6E6'], wallDark: ['#070709', '#0E0D11', '#17141B'], onAccent: '#17120A', bundle: { wallpaper: 'silk', nav: 'full', dash: 'command' } },
  { id: 'nightfall', name: 'Nightfall', story: 'Indigo night over the hills, full sidebar and command center', accent: '#4F5BF0', accentDark: '#9AA8FF', second: '#A855F7', wallLight: ['#DCE0F5', '#E8E2F6', '#D6E6F5'], wallDark: ['#060A1C', '#0D1434', '#1C1A4A'], bundle: { wallpaper: 'mountains', nav: 'full', dash: 'command' } },
  { id: 'obsidian', name: 'Obsidian', story: 'Smoked glass at night, cyan and violet light', bundle: { wallpaper: 'obsidian', nav: 'rail', dash: 'focus' }, accent: '#1D6FE0', accentDark: '#7DD3FC', second: '#9B87F5', wallLight: ['#D9DEE8', '#E9E5F2', '#D2E4EE'], wallDark: ['#08090C', '#111217', '#1A1B22'] },
  { id: 'bayou', name: 'Bayou', story: 'ISGH green and Houston marigold', accent: '#0E5A45', accentDark: '#5CCDA3', second: '#E3A62B', wallLight: ['#CDE6DA', '#F5E5C3', '#BCD7E8'], wallDark: ['#0A231B', '#1A2C3D', '#2A2310'] },
  { id: 'iznik', name: 'Iznik', story: 'Cobalt and turquoise tile', accent: '#1F4FA3', accentDark: '#8DB4F5', second: '#1E9C94', wallLight: ['#D3E0F6', '#CFEFEA', '#F1DCE3'], wallDark: ['#0C1933', '#0D2D2C', '#29131F'] },
  { id: 'dusk', name: 'Maghrib dusk', story: 'Violet sky, last light in gold', accent: '#6B3FA0', accentDark: '#C7A6F0', second: '#D9962B', wallLight: ['#E5DAF4', '#F7E1C8', '#D6E1F4'], wallDark: ['#19112F', '#2D1D13', '#141F39'] },
  { id: 'palm', name: 'Date palm', story: 'Olive frond and warm sand', accent: '#566318', accentDark: '#C9D46B', second: '#B8702A', wallLight: ['#E6EACF', '#F2DFC2', '#D6E7D6'], wallDark: ['#191E0C', '#2A1C0F', '#122118'] },
  { id: 'midnight', name: 'Midnight', story: 'Night prayer blue, calm and quiet', accent: '#245E9E', accentDark: '#8DBDF0', second: '#E3A62B', wallLight: ['#DAE2EC', '#E8EDF4', '#D3DCE9'], wallDark: ['#090E19', '#101A2B', '#0D131F'] },
];

export type Appearance = {
  preset: string; accent?: string; mode: 'light' | 'dark' | 'system';
  glass: 'clear' | 'frosted' | 'solid'; wallpaper: 'silk' | 'mountains' | 'obsidian' | 'aurora' | 'girih' | 'dusk' | 'plain' | 'arches' | 'ceiling' | 'mosaic' | 'skyline' | 'moon';
  nav: 'rail' | 'full';
  /** Overview layout: focus = compact window dashboard, command = full command center with side column */
  dash: 'focus' | 'command';
  density: 'comfortable' | 'compact'; text: 's' | 'm' | 'l'; motion: 'full' | 'reduced';
  /** Page width: centered (max 1500px) or the whole screen. */
  width: 'centered' | 'full';
  /** Work mode: sidebar as icons, no photo band or banners, the page uses the whole screen (toggle in the top bar, Esc leaves it). */
  work: 'on' | 'off';
};
/** Owner pick (2026-10-13, reference reel): dark smoked glass, icon rail. Each admin can still change it. */
export const DEFAULT_APPEARANCE: Appearance = { preset: 'luxe', mode: 'dark', glass: 'frosted', wallpaper: 'silk', nav: 'full', dash: 'command', density: 'comfortable', text: 'm', motion: 'full', width: 'centered', work: 'off' };
export const APPEARANCE_KEY = 'isgh-admin-appearance';
export const APPEARANCE_EVENT = 'isgh-appearance';

/* ---------- color helpers ---------- */
function rgb(hex: string) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function toHex(c: number[]) { return '#' + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase(); }
export function lighten(hex: string, t: number) { return toHex(rgb(hex).map((x) => x + (255 - x) * t)); }
function lum(hex: string) { return rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0); }
export function contrast(a: string, b: string) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

/** Inline script for <head>: apply saved look before first paint (no flash). Mirrors applyAppearance. */
export const NO_FLASH_SCRIPT = `(function(){try{var P=${JSON.stringify(Object.fromEntries(PRESETS.map((p) => [p.id, [p.accent, p.accentDark, p.second, p.wallLight, p.wallDark, p.onAccent || '#FFFFFF']])))};
var a=Object.assign(${JSON.stringify(DEFAULT_APPEARANCE)},JSON.parse(localStorage.getItem('${APPEARANCE_KEY}')||'{}'));var p=P[a.preset]||P.luxe;var h=document.documentElement;
var d=a.mode==='dark'||(a.mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);h.dataset.mode=d?'dark':'light';
h.dataset.glass=a.glass;h.dataset.wall=a.wallpaper;h.dataset.density=a.density;h.dataset.text=a.text;h.dataset.motion=a.motion;h.dataset.nav=a.nav;h.dataset.preset=a.preset;h.dataset.dash=a.dash;
var w=d?p[4]:p[3];var s=h.style;s.setProperty('--accent',a.accent||p[0]);s.setProperty('--accent-ink',d?(a.accent?a.accent:p[1]):(a.accent||p[0]));s.setProperty('--second',p[2]);s.setProperty('--on-accent',a.accent?'#FFFFFF':p[5]);
s.setProperty('--wall-1',w[0]);s.setProperty('--wall-2',w[1]);s.setProperty('--wall-3',w[2]);}catch(e){}})();`;
