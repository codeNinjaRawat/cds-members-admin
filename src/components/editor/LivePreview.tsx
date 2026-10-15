'use client';
/**
 * The website, live, inside a glass "window". Reloads after every publish. The theme editor can also push an
 * unsaved theme into it (postMessage → web PreviewBridge, origin-checked on both sides).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useOrg } from '@/lib/platform/use-org';

const DEVICES = { desktop: 1280, tablet: 820, phone: 390 } as const;
type Device = keyof typeof DEVICES;
export type PreviewHandle = { post: (msg: unknown) => void; reload: () => void };

export const LivePreview = forwardRef<PreviewHandle, { paths: string[]; onReady?: () => void }>(function LivePreview({ paths, onReady }, ref) {
  const [path, setPath] = useState(paths[0] ?? '/');
  const [device, setDevice] = useState<Device>('desktop');
  const [nonce, setNonce] = useState(0);
  const [width, setWidth] = useState(600);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const { site: SITE_URL } = useOrg();   // SaaS: this organization's own website

  useImperativeHandle(ref, () => ({
    post: (msg) => frame.current?.contentWindow?.postMessage(msg, new URL(SITE_URL).origin),
    reload: () => setNonce((n) => n + 1),
  }), [SITE_URL]);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const onPub = () => setNonce((n) => n + 1);
    const onMsg = (e: MessageEvent) => { if (e.origin === new URL(SITE_URL).origin && e.data?.type === 'isgh:preview-ready') onReady?.(); };
    window.addEventListener('isgh:published', onPub); window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('isgh:published', onPub); window.removeEventListener('message', onMsg); };
  }, [onReady, SITE_URL]);

  const w = DEVICES[device];
  const scale = Math.min(1, width / w);
  const h = 760;
  return (
    <section className="preview glass-float" aria-label="Live website preview">
      <div className="pv-bar">
        <span className="pv-dots" aria-hidden="true"><i /><i /><i /></span>
        <label className="sr-only" htmlFor="pv-path">Page to preview</label>
        <select id="pv-path" className="pv-path" value={path} onChange={(e) => setPath(e.target.value)}>
          {Array.from(new Set([...paths, '/', '/membership/join', '/give', '/about'])).map((p) => <option key={p} value={p}>{SITE_URL.replace(/^https?:\/\//, '')}{p}</option>)}
        </select>
        <div className="seg seg-sm" role="radiogroup" aria-label="Device size">
          {(Object.keys(DEVICES) as Device[]).map((d) => <button key={d} type="button" role="radio" aria-checked={device === d} onClick={() => setDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
        </div>
        <button type="button" className="icon-btn sm" aria-label="Reload preview" onClick={() => setNonce((n) => n + 1)}>↻</button>
      </div>
      <div className="pv-stage" ref={box} style={{ height: h * scale + 2 }}>
        <iframe key={`${path}-${nonce}`} ref={frame} title="Website preview" src={`${SITE_URL}${path}`}
          style={{ width: w, height: h, transform: `scale(${scale})` }} />
      </div>
      <p className="pv-hint">Shows the running website ({SITE_URL}). Not loading? Start it with <code>npm run dev</code> in the web folder.</p>
    </section>
  );
});
