'use client';
/** The organization's published configuration (Admin › Settings › Configuration) for member screens. Falls back to the defaults. */
import { useEffect, useState } from 'react';
import { mockOrgConfig, OrgConfigSchema, type OrgConfig } from '@/lib/community/org-config';

export function useOrgConfig(): OrgConfig {
  const [cfg, setCfg] = useState<OrgConfig>(mockOrgConfig);
  useEffect(() => {
    let live = true;
    void fetch('/api/store/org-config').then((r) => (r.ok ? r.json() : null)).then((j) => {
      const p = OrgConfigSchema.safeParse(j?.data);
      if (live && p.success) setCfg(p.data);
    }).catch(() => { /* keep defaults */ });
    return () => { live = false; };
  }, []);
  return cfg;
}
