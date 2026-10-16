'use client';
/** F3 demo store for gifts (this browser only). Live: GET /admin/donations, POST /admin/donations (cash/check),
 *  PATCH /admin/donations/{id} (fund/donor fixes, receipt sent); platform gifts arrive by webhook. */
import { useEffect, useState } from 'react';
import { DonationSettingsSchema, mockDonationSettings, mockDonations, type Donation, type DonationSettings } from '@/lib/community/donations';
import { OrgStructureSchema, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { logAudit } from '@/lib/access/audit';

const KEY = 'isgh-admin-donations';
export const DONATIONS_EVENT = 'isgh:donations';
export function readDonations(): Donation[] {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Donation[]) : structuredClone(mockDonations); } catch { return structuredClone(mockDonations); }
}
export function saveDonation(d: Donation, action: string, detail = '') {
  const list = readDonations(); const i = list.findIndex((x) => x.id === d.id);
  if (i >= 0) list[i] = d; else list.unshift(d);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ }
  logAudit({ area: 'donations', action: `${action} – ${d.id}`, detail });
  window.dispatchEvent(new Event(DONATIONS_EVENT));
}
export const nextDonationId = (list: Donation[]) => `D-${list.reduce((m, d) => Math.max(m, Number(d.id.slice(2))), 10000) + 1}`;
export function useDonations() {
  const [list, setList] = useState<Donation[]>(() => structuredClone(mockDonations));
  useEffect(() => { const load = () => setList(readDonations()); load(); window.addEventListener(DONATIONS_EVENT, load); return () => window.removeEventListener(DONATIONS_EVENT, load); }, []);
  return list;
}
export function useDonationContext() {
  const [s, setS] = useState<DonationSettings>(mockDonationSettings);
  const [map, setMap] = useState<OrgStructure>(mockOrgStructure);
  useEffect(() => {
    void fetch('/api/store/donation-settings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = DonationSettingsSchema.safeParse(j?.data); if (p.success) setS(p.data); }).catch(() => {});
    void fetch('/api/store/org-structure', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = OrgStructureSchema.safeParse(j?.data); if (p.success) setMap(p.data); }).catch(() => {});
  }, []);
  return { settings: s, map };
}
