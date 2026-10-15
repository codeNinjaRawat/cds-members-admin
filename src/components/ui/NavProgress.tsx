'use client';
/**
 * Instant feedback for every click that opens another page: a thin progress bar at the top starts the moment the
 * link is pressed and finishes when the new page is shown – so the site never looks "stuck" while it loads.
 * (Shared: website + admin; admin keeps an identical copy.)
 */
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<'idle' | 'run' | 'done'>('idle');
  const from = useRef('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // same page (tabs, views, #anchors) is instant already
      from.current = window.location.pathname;
      setState('run');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState('idle'), 15000); // never stay forever
    };
    // capture phase: Next.js <Link> cancels the browser's own navigation in its click handler, so listen before it
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (state === 'run' && pathname !== from.current) {
      setState('done');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState('idle'), 320);
    }
  }, [pathname, state]);

  if (state === 'idle') return null;
  return <div className={`nav-progress is-${state}`} role="progressbar" aria-label="Opening page" aria-busy={state === 'run'}><span /></div>;
}
