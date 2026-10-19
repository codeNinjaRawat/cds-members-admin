'use client';
/**
 * A photo from the manifest: the local file first (admin/public/img), the Pexels address when the local copy is
 * missing (before `node tools/get-images.mjs` has been run). Decorative by default (alt="") – the words next to it
 * carry the meaning. `useArtUrl` gives the same local-or-remote address for CSS backgrounds.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { localSrc, PHOTOS, remoteSrc, type PhotoKey } from '@/lib/images';

const known = new Map<PhotoKey, string>();  // resolved once per key per page load
function resolve(k: PhotoKey): Promise<string> {
  const hit = known.get(k); if (hit) return Promise.resolve(hit);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { known.set(k, localSrc(k)); res(localSrc(k)); };
    img.onerror = () => { known.set(k, remoteSrc(k)); res(remoteSrc(k)); };
    img.src = localSrc(k);
  });
}
export function useArtUrl(k: PhotoKey | null | undefined) {
  const [url, setUrl] = useState<string>(k ? known.get(k) ?? '' : '');
  useEffect(() => { let on = true; if (k) void resolve(k).then((u) => { if (on) setUrl(u); }); else setUrl(''); return () => { on = false; }; }, [k]);
  return url;
}

export function Photo({ k, className = '', alt = '', style, width = 1800, priority = false }: { k: PhotoKey; className?: string; alt?: string; style?: CSSProperties; width?: number; priority?: boolean }) {
  const [src, setSrc] = useState(localSrc(k));
  useEffect(() => { setSrc(known.get(k) ?? localSrc(k)); }, [k]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt || ''} title={alt ? undefined : PHOTOS[k].alt} className={`photo ${className}`} style={style} loading={priority ? 'eager' : 'lazy'} decoding="async"
      onError={() => { if (src !== remoteSrc(k, width)) { known.set(k, remoteSrc(k, width)); setSrc(remoteSrc(k, width)); } }} />
  );
}

/** A photo with a dark-to-transparent veil so text on top stays readable; `side` says where the words are. */
export function ArtBand({ k, side = 'left', className = '', strength = 'normal' }: { k: PhotoKey; side?: 'left' | 'right' | 'top' | 'all'; className?: string; strength?: 'soft' | 'normal' | 'strong' }) {
  return (
    <span className={`art-band veil-${side} veil-${strength} tone-${PHOTOS[k].tone} ${className}`} aria-hidden="true">
      <Photo k={k} />
    </span>
  );
}
