'use client';
/**
 * F2 demo store for Zakat cases (this browser only, like member edits). Live: GET/POST /admin/zakat/cases – the BE
 * re-runs actionsFor / approve / pay from lib/community/zakat.ts and refuses anything the role may not do.
 */
import { useEffect, useState } from 'react';
import { mockZakatCases, mockZakatSettings, ZakatSettingsSchema, type ZakatCase, type ZakatSettings } from '@/lib/community/zakat';
import { OrgStructureSchema, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { logAudit } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

const KEY = 'isgh-admin-zakat-cases';
export const ZAKAT_EVENT = 'isgh:zakat';

/* ---------- live mode: cases from the API – its rules decide each step (levels, response times, who may pay) ---------- */
let live: ZakatCase[] | null = null; let liveLoading: Promise<void> | null = null;
export function loadLiveCases(force = false): Promise<void> {
  if (!force && live) return Promise.resolve();
  if (!force && liveLoading) return liveLoading;
  liveLoading = be<{ cases: ZakatCase[] }>('GET', 'admin/zakat/cases').then((r) => {
    liveLoading = null; if (r.ok) live = r.data.cases; else if (r.status !== 401) notice(`Zakat cases could not be loaded: ${r.message}`);
    window.dispatchEvent(new Event(ZAKAT_EVENT));
  });
  return liveLoading;
}
type Step = [string, string, unknown];
/** One case's change (made with the shared rules on the screen) → the API step that makes it on the server. */
export function liveCaseSteps(before: ZakatCase | undefined, c: ZakatCase): Step[] {
  if (!before) return [['POST', 'admin/zakat/cases', { applicant: c.applicant, category: c.category, reason: c.reason, requestedCents: c.requestedCents, months: c.months, urgent: c.urgent }]];
  const id = encodeURIComponent(c.id); const steps: Step[] = []; const base = `admin/zakat/cases/${id}`;
  if (c.coordinator !== before.coordinator && c.coordinator) steps.push(['POST', `${base}/assign`, { coordinator: c.coordinator }]);
  if (JSON.stringify(c.checks) !== JSON.stringify(before.checks) || (c.homeVisit && JSON.stringify(c.homeVisit) !== JSON.stringify(before.homeVisit)))
    steps.push(['POST', `${base}/checks`, { ...c.checks, ...(c.homeVisit && JSON.stringify(c.homeVisit) !== JSON.stringify(before.homeVisit) ? { homeVisit: { on: c.homeVisit.on, note: c.homeVisit.note } } : {}) }]);
  const newNotes = c.notes.slice(before.notes.length);
  let noteUsed = false;
  if (c.status === 'info-requested' && before.status !== 'info-requested') { steps.push(['POST', `${base}/request-info`, { note: newNotes.at(-1)?.text ?? '' }]); noteUsed = true; }
  if (c.fund && !before.fund) steps.push(['POST', `${base}/decide`, { fund: c.fund }]);
  else if (c.status === 'rejected' && before.status !== 'rejected' && c.approvals.length === before.approvals.length) steps.push(['POST', `${base}/decide`, { fund: 'none' }]);
  for (const a of c.approvals.slice(before.approvals.length)) {
    if (a.decision === 'approve') steps.push(['POST', `${base}/approve`, { amountCents: a.amountCents ?? c.requestedCents, note: a.note ?? '', override: !!a.override }]);
    else steps.push(['POST', `${base}/${a.decision}`, { note: a.note ?? '' }]);
  }
  for (const p of c.payouts.slice(before.payouts.length)) steps.push(['POST', `${base}/pay`, { method: p.method, ref: p.ref }]);
  if (!noteUsed) for (const n of newNotes) steps.push(['POST', `${base}/notes`, { text: n.text }]);
  return steps;
}
async function saveLive(c: ZakatCase, action: string) {
  const before = live?.find((x) => x.id === c.id);
  for (const [m, p, b] of liveCaseSteps(before, c)) { const r = await be<{ note?: string }>(m, p, b); if (!r.ok) { notice(`${action}: ${r.message}`); break; } if (r.data?.note) notice(r.data.note, 'ok'); }
  await loadLiveCases(true);
}
export function readCases(): ZakatCase[] {
  if (LIVE) { if (typeof window !== 'undefined' && !live) void loadLiveCases(); return live ?? []; }
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as ZakatCase[]) : structuredClone(mockZakatCases); } catch { return structuredClone(mockZakatCases); }
}
export function saveCase(c: ZakatCase, action: string, detail = '') {
  if (LIVE) { void saveLive(c, action); return; }
  const list = readCases(); const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c; else list.unshift(c);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ }
  logAudit({ area: 'zakat', action: `${action} – ${c.id}`, detail });
  window.dispatchEvent(new Event(ZAKAT_EVENT));
}
export const nextCaseId = (list: ZakatCase[], year: number) => `ZKT-${year}-${String(list.filter((c) => c.id.startsWith(`ZKT-${year}-`)).reduce((m, c) => Math.max(m, Number(c.id.slice(9))), 0) + 1).padStart(3, '0')}`;

export function useZakatCases() {
  const [list, setList] = useState<ZakatCase[]>(() => (LIVE ? [] : structuredClone(mockZakatCases)));
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
