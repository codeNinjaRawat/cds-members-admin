'use client';
/**
 * The signed-in admin's role on every screen (A10). Demo: "Acting as" in the top bar picks the admin (cookie
 * `isgh-acting`, read by the store API too). Live: the API session (GET /auth/me) says who is signed in and in which role.
 * The screens hide what a role cannot do; the server refuses it anyway.
 */
import { useEffect, useState } from 'react';
import { AccessSchema, actingIn, assignmentsOf, can as canDo, inScope as inScopeOf, mockAccess, roleOf, zakatLevelOf, type AccessDoc, type AdminUser, type Permission } from './access';
import { logAudit } from './audit';
import { LIVE, SESSION_EVENT, be, currentSession, loadSession } from '@/lib/live/live';

const COOKIE = 'isgh-acting';
export const ACCESS_EVENT = 'isgh:access';
let cache: AccessDoc | null = null; let loading: Promise<AccessDoc> | null = null;
const DASH = 'isgh-dash';
const readDash = () => (typeof document === 'undefined' ? 0 : Number(/(?:^|;\s*)isgh-dash=(\d+)/.exec(document.cookie)?.[1] ?? 0));
/** M4: switch the dashboard (which of the person's roles they work in). 0 = main role. */
export function setDashboard(index: number, label?: string) {
  if (LIVE) { void be('POST', 'auth/dashboard', { index }).then(() => loadSession(true)).then(() => window.dispatchEvent(new Event(ACCESS_EVENT))); return; }   // the API re-checks the roles
  document.cookie = index ? `${DASH}=${index}; path=/; SameSite=Lax` : `${DASH}=; path=/; max-age=0; SameSite=Lax`;
  logAudit({ area: 'access', action: 'Switched dashboard', detail: label ?? String(index) });
  window.dispatchEvent(new Event(ACCESS_EVENT));
}
const readActing = () => (typeof document === 'undefined' ? null : /(?:^|;\s*)isgh-acting=([a-z0-9-]+)/.exec(document.cookie)?.[1] ?? null);
export function loadAccess(force = false): Promise<AccessDoc> {
  if (!force && cache) return Promise.resolve(cache);
  if (!force && loading) return loading;
  loading = fetch('/api/store/admin-access', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
    const p = AccessSchema.safeParse(j?.data); cache = p.success ? p.data : (j?.data as AccessDoc) ?? mockAccess; loading = null;
    window.dispatchEvent(new Event(ACCESS_EVENT)); return cache!;
  });
  return loading;
}
/** Switch who the demo acts as (and tell every open screen). */
export function setActing(id: string | null, name?: string) {
  if (LIVE) return;   // live: you are who you signed in as
  document.cookie = id ? `${COOKIE}=${id}; path=/; SameSite=Lax` : `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${DASH}=; path=/; max-age=0; SameSite=Lax`; // a new person starts in their main role
  logAudit({ area: 'access', action: 'Acting as', detail: name ?? id ?? 'Owner' });
  window.dispatchEvent(new Event(ACCESS_EVENT));
}
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

export function useAccess() {
  const [doc, setDoc] = useState<AccessDoc | null>(cache);
  const [acting, setActingId] = useState<string | null>(null);
  const [dash, setDash] = useState(0);
  useEffect(() => {
    const read = () => {
      if (LIVE) { const s = currentSession(); setActingId(s?.actingAs.admin ?? null); setDash(Math.max(0, s?.current ?? 0)); setDoc(s ? cache : null); return; }
      setActingId(readActing()); setDash(readDash()); setDoc(cache);
    };
    read(); void (LIVE ? loadSession().then(() => loadAccess()) : loadAccess()).then(read);
    window.addEventListener(ACCESS_EVENT, read); window.addEventListener(SESSION_EVENT, read);
    return () => { window.removeEventListener(ACCESS_EVENT, read); window.removeEventListener(SESSION_EVENT, read); };
  }, []);
  const d = doc ?? mockAccess;
  // live: only the signed-in admin (never a fallback owner) · demo: the picked admin, else the first owner
  const person: AdminUser | null = LIVE ? (acting ? d.admins.find((a) => a.id === acting) ?? null : null) : (acting && d.admins.find((a) => a.id === acting)) || d.admins.find((a) => a.roleId === 'owner' && a.status === 'active') || null;
  const dashIndex = person && dash < assignmentsOf(person).length ? dash : 0;
  const me: AdminUser | null = person ? actingIn(person, dashIndex) : null;
  const ready = !!doc;
  if (typeof window !== 'undefined' && me) (window as unknown as { __isghAdminName?: string }).__isghAdminName = me.name;
  return {
    ready, doc: d, me, role: roleOf(d, me),
    /** M2/M4: the person with all their roles, and which one they are working in now. */
    person, dashIndex,
    /** Until the roles are loaded nothing is hidden (the server checks anyway). */
    can: (p: Permission) => !ready || canDo(d, me, p, today()),
    /** Pass the member's center too – center-limited roles (Associate Director, Center admin, Zakat coordinator) need it. */
    inScope: (zoneId: string, center?: string, zip?: string) => !ready || inScopeOf(d, me, zoneId, center, zip),
    /** Zakat approval level of the signed-in admin (0 = cannot approve). */
    zakatLevel: zakatLevelOf(d, me, today()),
  };
}
