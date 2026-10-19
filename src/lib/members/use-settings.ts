'use client';
/** The published membership settings (plans and rules) for screens that act on them; the demo set until published. */
import { useEffect, useState } from 'react';
import { MembershipSettingsSchema, mockMembershipSettings, type MembershipSettings } from '@/lib/content/membership';

export function useMembershipSettings(): MembershipSettings {
  const [s, setS] = useState<MembershipSettings>(mockMembershipSettings);
  useEffect(() => { let on = true; void fetch('/api/store/membership-settings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = MembershipSettingsSchema.safeParse(j?.data); if (on && p.success) setS(p.data); }).catch(() => {}); return () => { on = false; }; }, []);
  return s;
}
