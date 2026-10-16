'use client';
/** F8 demo store for campaign gifts and pledges (this browser only). Live: gifts come from Donations with a campaign tag; POST /admin/fundraising/pledges. */
import { useEffect, useState } from 'react';
import { GiftSchema, mockGifts, mockPledges, usd, type Gift, type Pledge } from '@/lib/community/fundraising';
import { logAudit } from '@/lib/access/audit';

const GK = 'isgh-admin-campaign-gifts'; const PK = 'isgh-admin-pledges';
export const FR_EVENT = 'isgh:fundraising';
const read = <T,>(k: string, fb: T): T => { try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T) : structuredClone(fb); } catch { return structuredClone(fb); } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } window.dispatchEvent(new Event(FR_EVENT)); };
export const readGifts = () => read<Gift[]>(GK, mockGifts);
export const readPledges = () => read<Pledge[]>(PK, mockPledges);
export function addGift(g: Gift): string[] {
  const r = GiftSchema.safeParse(g); if (!r.success) return r.error.issues.map((i) => i.message);
  write(GK, [g, ...readGifts()]); logAudit({ area: 'fundraising', action: `Campaign gift recorded – ${g.id}`, detail: `${usd(g.amountCents)} to ${g.campaignId}` }); return [];
}
export function addPledge(p: Pledge) { write(PK, [...readPledges(), p]); logAudit({ area: 'fundraising', action: `Pledge recorded – ${p.id}`, detail: `${usd(p.totalCents)} to ${p.campaignId}` }); }
export const nextGiftId = (list: Gift[]) => `G-${list.reduce((a, g) => Math.max(a, Number(g.id.slice(2))), 7000) + 1}`;
export function useFundraisingRecords() {
  const [gifts, setG] = useState<Gift[]>(() => structuredClone(mockGifts));
  const [pledges, setP] = useState<Pledge[]>(() => structuredClone(mockPledges));
  useEffect(() => { const load = () => { setG(readGifts()); setP(readPledges()); }; load(); window.addEventListener(FR_EVENT, load); return () => window.removeEventListener(FR_EVENT, load); }, []);
  return { gifts, pledges };
}
