'use client';
/**
 * The organization this admin belongs to (SaaS), from GET /api/platform/me – loaded once and shared by every screen.
 * Gives: name, status, plan, the modules it may use, platform announcements, an open support sign-in, its website.
 */
import { useEffect, useState } from 'react';
import { siblingOrigin, type Module } from './platform';

export type Me = {
  productName: string; supportEmail: string;
  org: { slug: string; name: string; shortName: string; status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled'; color: string; plan: string; trialDaysLeft: number | null; suspendedReason?: string };
  modules: Module[];
  announcements: { id: string; title: string; body: string; tone: 'info' | 'success' | 'warning' }[];
  support: { by: string; reason: string; mode: 'read-only' | 'full'; endsAt: string } | null;
  siteUrl?: string;
};
export const DEFAULT_SITE = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'http://localhost:3000';

let cache: Me | null = null; let loading: Promise<Me | null> | null = null;
const subs = new Set<(m: Me | null) => void>();
export function loadMe(force = false) {
  if (!force && (cache || loading)) return loading ?? Promise.resolve(cache);
  loading = fetch('/api/platform/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((m: Me | null) => { cache = m; loading = null; subs.forEach((f) => f(m)); return m; });
  return loading;
}

/** `me` is null until loaded (and when the platform data is not available – then everything stays visible). */
export function useOrg() {
  const [me, setMe] = useState<Me | null>(cache);
  const [site, setSite] = useState(DEFAULT_SITE);
  useEffect(() => {
    subs.add(setMe); loadMe().then((m) => setMe(m));
    return () => { subs.delete(setMe); };
  }, []);
  useEffect(() => { setSite(me?.siteUrl ?? siblingOrigin(window.location.origin, 'web') ?? DEFAULT_SITE); }, [me]);
  const can = (m?: Module) => !m || !me || me.modules.includes(m);
  return { me, site, can };
}

/** Which module a screen belongs to (for hiding menu items and showing "not in your plan"). */
export function moduleForPath(path: string): Module | undefined {
  const p = path.split('?')[0];
  if (p.startsWith('/website/giving')) return 'giving';
  if (p.startsWith('/website')) return 'website';
  if (p.startsWith('/membership/form')) return 'joinForm';
  if (p.startsWith('/membership')) return 'membership';
  if (p.startsWith('/members')) return 'members';
  if (p.startsWith('/families')) return 'families';
  if (p.startsWith('/queues')) return 'queues';
  return undefined;
}
