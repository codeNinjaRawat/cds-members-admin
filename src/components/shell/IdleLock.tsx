'use client';
/**
 * Configuration › Security › session length: after that many minutes without activity the admin screen is covered, so
 * member data is not left open on a shared center computer. DEMO: "Continue" unlocks (live: the session cookie expires
 * on the server at the same time and the admin signs in again, with two-step sign-in when it is on).
 */
import { useEffect, useRef, useState } from 'react';
import { useOrgConfig } from '@/lib/members/use-org-config';

export function IdleLock() {
  const minutes = useOrgConfig().security.sessionMinutes;
  const [locked, setLocked] = useState(false);
  const last = useRef(Date.now());
  useEffect(() => {
    const bump = () => { if (!locked) last.current = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = window.setInterval(() => { if (Date.now() - last.current >= minutes * 60_000) setLocked(true); }, 15_000);
    return () => { evs.forEach((e) => window.removeEventListener(e, bump)); window.clearInterval(t); };
  }, [minutes, locked]);
  if (!locked) return null;
  return (
    <div className="idle-lock" role="dialog" aria-modal="true" aria-labelledby="idle-h">
      <div className="idle-card glass-float">
        <h2 id="idle-h">Locked for safety</h2>
        <p>No activity for {minutes} minutes, so member details are hidden. Settings › Configuration › Security sets this time.</p>
        <button type="button" className="btn primary" autoFocus onClick={() => { last.current = Date.now(); setLocked(false); }}>Continue (demo)</button>
      </div>
    </div>
  );
}
