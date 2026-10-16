'use client';
/** F4 demo store for benefit uses (this browser only). Live: GET /admin/benefits/uses, POST /admin/benefits/uses (office),
 *  POST /member/benefits/{offerId}/use (member portal) and the partner check on the Verify page. */
import { useEffect, useState } from 'react';
import { mockRedemptions, type MemberFacts, type Redemption } from '@/lib/community/benefits';
import { statusOf, YEAR, type Member } from '@/lib/members/members';
import { logAudit } from '@/lib/access/audit';

const KEY = 'isgh-admin-benefit-uses';
export const USES_EVENT = 'isgh:benefit-uses';
export function readUses(): Redemption[] {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Redemption[]) : structuredClone(mockRedemptions); } catch { return structuredClone(mockRedemptions); }
}
export function addUse(r: Redemption, offerTitle: string) {
  const list = [r, ...readUses()];
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ }
  logAudit({ area: 'benefits', action: `Benefit used – ${r.id}`, detail: `${offerTitle} · ${r.memberId}` });
  window.dispatchEvent(new Event(USES_EVENT));
}
export const nextUseId = (list: Redemption[]) => `R-${list.reduce((m, r) => Math.max(m, Number(r.id.slice(2))), 5000) + 1}`;
export function useUses() {
  const [list, setList] = useState<Redemption[]>(() => structuredClone(mockRedemptions));
  useEffect(() => { const load = () => setList(readUses()); load(); window.addEventListener(USES_EVENT, load); return () => window.removeEventListener(USES_EVENT, load); }, []);
  return list;
}
/** What the benefit rules need to know about a member record. */
export function factsOf(m: Member): MemberFacts {
  const st = statusOf(m);
  return { id: m.id, plan: m.plan, active: st === 'active' || st === 'life', goodStanding: m.plan === 'life' || m.payments.some((p) => p.year === YEAR) };
}
