'use client';
/**
 * Live mode in the admin (ISGH_USE_MOCK_API=false at build time → NEXT_PUBLIC_LIVE_API=1): who is signed in comes from
 * the API session (GET /auth/me through /api/be), not from the demo "Acting as" picker.
 */
export const LIVE = process.env.NEXT_PUBLIC_LIVE_API === '1';

export type LiveAnswer<T> = { ok: true; status: number; data: T } | { ok: false; status: number; message: string; data: Record<string, unknown> };
export async function be<T = unknown>(method: string, path: string, body?: unknown): Promise<LiveAnswer<T>> {
  try {
    const r = await fetch(`/api/be/${path}`, { method, credentials: 'same-origin', cache: 'no-store', headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (r.ok) return { ok: true, status: r.status, data: data as T };
    return { ok: false, status: r.status, data, message: String(data.error ?? data.message ?? (r.status === 429 ? 'Too many tries – please wait a few minutes.' : 'Something went wrong. Please try again.')) };
  } catch {
    return { ok: false, status: 0, data: {}, message: 'We could not reach the server. Check your connection and try again.' };
  }
}

export type LiveSession = { email: string; current: number; actingAs: { admin?: string; name?: string; member?: string }; twoStep: { required: boolean; ok: boolean }; dashboards: { kind: string; index: number; adminId: string; label: string; role: string; where: string }[] };
let session: LiveSession | null = null; let pending: Promise<LiveSession | null> | null = null;
export const SESSION_EVENT = 'ms:session';
export const currentSession = () => session;
/** The signed-in admin (null = not signed in → the sign-in page). */
export function loadSession(force = false): Promise<LiveSession | null> {
  if (!force && session) return Promise.resolve(session);
  if (!force && pending) return pending;
  pending = be<LiveSession>('GET', 'auth/me').then((r) => {
    pending = null; session = r.ok ? r.data : null;
    if (!r.ok && (r.status === 401 || r.status === 403) && typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-in') && !window.location.pathname.startsWith('/welcome')) {
      window.location.assign(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    window.dispatchEvent(new Event(SESSION_EVENT)); return session;
  });
  return pending;
}
export async function signOut() { await be('POST', 'auth/sign-out', {}); session = null; window.location.assign('/sign-in'); }
