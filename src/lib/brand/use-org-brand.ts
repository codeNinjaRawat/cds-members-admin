'use client';
/**
 * The organization's own logo (Website › Theme and branding › Logo and icons = site-config.branding) for the admin's
 * sidebar and sign-in page. Live only – demo mode and an organization without its own logo keep the product mark.
 */
import { useEffect, useState } from 'react';
import { LIVE, be } from '@/lib/live/live';

export type OrgBrand = { logoLight: string; logoDark: string; logoAlt: string };
let cache: OrgBrand | null | undefined;
let loading: Promise<OrgBrand | null> | null = null;
const own = (v?: string) => !!v && !v.startsWith('/brand/');   // the product's own files = no organization logo yet

export function useOrgBrand(): OrgBrand | null {
  const [b, setB] = useState<OrgBrand | null>(cache ?? null);
  useEffect(() => {
    if (!LIVE || cache !== undefined) return;
    loading ??= be<{ data?: { branding?: Partial<OrgBrand> } }>('GET', 'public/documents/site-config').then((r) => {
      const x = r.ok ? r.data.data?.branding : undefined;
      cache = x && own(x.logoLight) ? { logoLight: x.logoLight!, logoDark: own(x.logoDark) ? x.logoDark! : x.logoLight!, logoAlt: x.logoAlt ?? '' } : null;
      return cache;
    });
    let on = true; void loading.then((v) => { if (on) setB(v); }); return () => { on = false; };
  }, []);
  return b;
}
