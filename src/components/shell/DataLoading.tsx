'use client';
/**
 * Loader for data that comes after the page (2026-10-29). Pages open at once (route loader + top progress bar);
 * the member records of a large organization take a moment more – this pill says so instead of showing zeros.
 * Live mode also starts that download in the background as soon as the admin is open.
 */
import { useEffect, useState } from 'react';
import { MEMBERS_EVENT, MEMBERS_LOADING_EVENT, membersLoading, prefetchLiveMembers } from '@/lib/members/members';
import { LIVE } from '@/lib/live/live';

export function DataLoading({ signedIn }: { signedIn: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(membersLoading());
    read();
    window.addEventListener(MEMBERS_LOADING_EVENT, read); window.addEventListener(MEMBERS_EVENT, read);
    return () => { window.removeEventListener(MEMBERS_LOADING_EVENT, read); window.removeEventListener(MEMBERS_EVENT, read); };
  }, []);
  useEffect(() => {
    if (!LIVE || !signedIn) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(prefetchLiveMembers, { timeout: 1500 }); else window.setTimeout(prefetchLiveMembers, 600);
  }, [signedIn]);
  if (!on) return null;
  return <div className="data-pill glass-float" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />Loading member records…</div>;
}
