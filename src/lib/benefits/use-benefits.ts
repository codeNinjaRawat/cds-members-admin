'use client';
/** F4 demo store for benefit uses (this browser only). Live: GET /admin/benefits/uses, POST /admin/benefits/uses (office),
 *  POST /member/benefits/{offerId}/use (member portal) and the partner check on the Verify page. */
import { useEffect, useState } from 'react';
import { mockRedemptions, type MemberFacts, type Redemption } from '@/lib/community/benefits';
import { statusOf, YEAR, type Member } from '@/lib/members/members';
import { logAudit } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

/* ---------- live mode: the use log on the server (it checks the offer and that the member is current) ---------- */
let live: Redemption[] | null = null; let liveLoading: Promise<void> | null = null;
export function loadLiveUses(force = false): Promise<void> {
  if (!force && live) return Promise.resolve();
  if (!force && liveLoading) return liveLoading;
  liveLoading = be<{ uses: Redemption[] }>('GET', 'admin/benefits/uses').then((r) => {
    liveLoading = null; if (r.ok) live = r.data.uses; else if (r.status !== 401) notice(`Benefit uses could not be loaded: ${r.message}`);
    window.dispatchEvent(new Event(USES_EVENT));
  });
  return liveLoading;
}

const KEY = 'isgh-admin-benefit-uses';
export const USES_EVENT = 'isgh:benefit-uses';
export function readUses(): Redemption[] {
  if (LIVE) { if (typeof window !== 'undefined' && !live) void loadLiveUses(); return live ?? []; }
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Redemption[]) : structuredClone(mockRedemptions); } catch { return structuredClone(mockRedemptions); }
}
export function addUse(r: Redemption, offerTitle: string) {
  if (LIVE) { void be('POST', 'admin/benefits/uses', { offerId: r.offerId, memberId: r.memberId, via: r.via }).then((x) => { if (!x.ok) notice(`${offerTitle}: ${x.message}`); return loadLiveUses(true); }); return; }
  const list = [r, ...readUses()];
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ }
  logAudit({ area: 'benefits', action: `Benefit used – ${r.id}`, detail: `${offerTitle} · ${r.memberId}` });
  window.dispatchEvent(new Event(USES_EVENT));
}
export const nextUseId = (list: Redemption[]) => `R-${list.reduce((m, r) => Math.max(m, Number(r.id.slice(2))), 5000) + 1}`;
export function useUses() {
  const [list, setList] = useState<Redemption[]>(() => (LIVE ? [] : structuredClone(mockRedemptions)));
  useEffect(() => { const load = () => setList(readUses()); load(); window.addEventListener(USES_EVENT, load); return () => window.removeEventListener(USES_EVENT, load); }, []);
  return list;
}
/** What the benefit rules need to know about a member record. */
export function factsOf(m: Member): MemberFacts {
  const st = statusOf(m);
  return { id: m.id, plan: m.plan, active: st === 'active' || st === 'life', goodStanding: m.plan === 'life' || m.payments.some((p) => p.year === YEAR) };
}
