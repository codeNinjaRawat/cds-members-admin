'use client';
/** Admin appearance – apply + React hook (client). Data and the no-flash script live in ./presets. */
import { useCallback, useEffect, useState } from 'react';
import { APPEARANCE_EVENT as EVT, APPEARANCE_KEY, DEFAULT_APPEARANCE, PRESETS, contrast, lighten, type Appearance } from './presets';
export { PRESETS, DEFAULT_APPEARANCE, contrast, lighten, type Appearance, type Preset } from './presets';

export function readAppearance(): Appearance {
  try { return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}') }; } catch { return DEFAULT_APPEARANCE; }
}

/** Applies the appearance to <html> (data attributes + a few CSS variables). Also used by the no-flash script. */
export function applyAppearance(a: Appearance) {
  const html = document.documentElement;
  const p = PRESETS.find((x) => x.id === a.preset) ?? PRESETS[0];
  const dark = a.mode === 'dark' || (a.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  html.dataset.mode = dark ? 'dark' : 'light';
  html.dataset.glass = a.glass; html.dataset.wall = a.wallpaper; html.dataset.density = a.density; html.dataset.text = a.text; html.dataset.motion = a.motion; html.dataset.nav = a.work === 'on' ? 'rail' : a.nav; html.dataset.width = a.width; html.dataset.work = a.work; html.dataset.preset = p.id; html.dataset.dash = a.dash;
  const wall = dark ? p.wallDark : p.wallLight;
  const accent = a.accent || p.accent;
  const s = html.style;
  s.setProperty('--accent', accent);
  s.setProperty('--accent-ink', dark ? (a.accent ? lighten(a.accent, 0.45) : p.accentDark) : accent);
  s.setProperty('--second', p.second);
  s.setProperty('--on-accent', a.accent ? (contrast(a.accent, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#14110A') : (p.onAccent ?? '#FFFFFF'));
  s.setProperty('--wall-1', wall[0]); s.setProperty('--wall-2', wall[1]); s.setProperty('--wall-3', wall[2]);
}

export function useAppearance() {
  const [a, setA] = useState<Appearance>(DEFAULT_APPEARANCE);
  useEffect(() => {
    setA(readAppearance()); applyAppearance(readAppearance());
    const on = () => setA(readAppearance());
    window.addEventListener(EVT, on);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sys = () => applyAppearance(readAppearance());
    mq.addEventListener('change', sys);
    return () => { window.removeEventListener(EVT, on); mq.removeEventListener('change', sys); };
  }, []);
  const update = useCallback((patch: Partial<Appearance>) => {
    const next = { ...readAppearance(), ...patch };
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)); } catch { /* */ }
    applyAppearance(next); window.dispatchEvent(new Event(EVT));
  }, []);
  return [a, update] as const;
}

