'use client';
/**
 * F2 demo store for Zakat cases (this browser only, like member edits). Live: GET/POST /admin/zakat/cases – the BE
 * re-runs actionsFor / approve / pay from lib/community/zakat.ts and refuses anything the role may not do.
 */
import { useEffect, useState } from 'react';
import { mockZakatCases, mockZakatSettings, ZakatSettingsSchema, type ZakatCase, type ZakatSettings } from '@/lib/community/zakat';
import { OrgStructureSchema, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { logAudit } from '@/lib/access/audit';

const KEY = 'isgh-admin-zakat-cases';
export const ZAKAT_EVENT = 'isgh:zakat';
export function readCases(): ZakatCase[] {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as ZakatCase[]) : structuredClone(mockZakatCases); } catch { return structuredClone(mockZakatCases); }
}
export function saveCase(c: ZakatCase, action: string, detail = '') {
  const list = readCases(); const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c; else list.unshift(c);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ }
  logAudit({ area: 'zakat', action: `${action} – ${c.id}`, detail });
  window.dispatchEvent(new Event(ZAKAT_EVENT));
}
export const nextCaseId = (list: ZakatCase[], year: number) => `ZKT-${year}-${String(list.filter((c) => c.id.startsWith(`ZKT-${year}-`)).reduce((m, c) => Math.max(m, Number(c.id.slice(9))), 0) + 1).padStart(3, '0')}`;

export function useZakatCases() {
  const [list, setList] = useState<ZakatCase[]>(() => structuredClone(mockZakatCases));
  useEffect(() => { const load = () => setList(readCases()); load(); window.addEventListener(ZAKAT_EVENT, load); return () => window.removeEventListener(ZAKAT_EVENT, load); }, []);
  return list;
}
/** Published Zakat settings and zones map (fall back to the built-in ones). */
export function useZakatContext() {
  const [s, setS] = useState<ZakatSettings>(mockZakatSettings);
  const [map, setMap] = useState<OrgStructure>(mockOrgStructure);
  useEffect(() => {
    void fetch('/api/store/zakat-settings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = ZakatSettingsSchema.safeParse(j?.data); if (p.success) setS(p.data); }).catch(() => {});
    void fetch('/api/store/org-structure', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = OrgStructureSchema.safeParse(j?.data); if (p.success) setMap(p.data); }).catch(() => {});
  }, []);
  return { settings: s, map };
}
