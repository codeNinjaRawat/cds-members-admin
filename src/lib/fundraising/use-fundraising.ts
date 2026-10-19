'use client';
/** F8 demo store for campaign gifts and pledges (this browser only). Live: gifts come from Donations with a campaign tag; POST /admin/fundraising/pledges. */
import { useEffect, useState } from 'react';
import { GiftSchema, mockGifts, mockPledges, usd, type Gift, type Pledge } from '@/lib/community/fundraising';
import { logAudit } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

/* ---------- live mode: campaign gifts and pledges from GET /admin/fundraising?gifts=1 ---------- */
let live: { gifts: Gift[]; pledges: Pledge[] } | null = null; let liveLoading: Promise<void> | null = null;
export function loadLiveFundraising(force = false): Promise<void> {
  if (!force && live) return Promise.resolve();
  if (!force && liveLoading) return liveLoading;
  liveLoading = be<{ gifts: Gift[]; pledges: Pledge[] }>('GET', 'admin/fundraising?gifts=1').then((r) => {
    liveLoading = null;
    if (!r.ok && r.status !== 401) notice(`Campaign gifts and pledges could not be loaded: ${r.message}`);
    live = { gifts: r.ok ? r.data.gifts ?? [] : live?.gifts ?? [], pledges: r.ok ? r.data.pledges : live?.pledges ?? [] };
    window.dispatchEvent(new Event(FR_EVENT));
  });
  return liveLoading;
}

const GK = 'isgh-admin-campaign-gifts'; const PK = 'isgh-admin-pledges';
export const FR_EVENT = 'isgh:fundraising';
const read = <T,>(k: string, fb: T): T => { try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T) : structuredClone(fb); } catch { return structuredClone(fb); } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } window.dispatchEvent(new Event(FR_EVENT)); };
export const readGifts = (): Gift[] => { if (LIVE) { if (typeof window !== 'undefined' && !live) void loadLiveFundraising(); return live?.gifts ?? []; } return read<Gift[]>(GK, mockGifts); };
export const readPledges = (): Pledge[] => { if (LIVE) return live?.pledges ?? []; return read<Pledge[]>(PK, mockPledges); };
export function addGift(g: Gift): string[] {
  const r = GiftSchema.safeParse(g); if (!r.success) return r.error.issues.map((i) => i.message);
  if (LIVE) {   // an office gift for the campaign = a cash gift with the campaign (the API routes it to the campaign's fund)
    void fetch('/api/store/donation-settings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)   // booked at the organization's main masjid
      .then((j: { data?: { mainCenter?: string } } | null) => be('POST', 'admin/donations', { amountCents: g.amountCents, platform: 'cash', campaignId: g.campaignId, pageId: g.pageId, givenOn: g.at.slice(0, 10), name: g.donor.name, memberId: g.donor.memberId, anonymous: g.donor.anonymous, showName: g.donor.showName, center: j?.data?.mainCenter ?? '' }))
      .then((r) => { if (!r.ok) notice(`Campaign gift: ${r.message}`); return loadLiveFundraising(true); });
    return [];
  }
  write(GK, [g, ...readGifts()]); logAudit({ area: 'fundraising', action: `Campaign gift recorded – ${g.id}`, detail: `${usd(g.amountCents)} to ${g.campaignId}` }); return [];
}
export function addPledge(p: Pledge) {
  if (LIVE) { void be('POST', 'admin/pledges', { campaignId: p.campaignId, name: p.donor.name, totalCents: p.totalCents, dueBy: p.dueBy }).then((r) => { if (!r.ok) notice(`Pledge: ${r.message}`); return loadLiveFundraising(true); }); return; } write(PK, [...readPledges(), p]); logAudit({ area: 'fundraising', action: `Pledge recorded – ${p.id}`, detail: `${usd(p.totalCents)} to ${p.campaignId}` }); }
export const nextGiftId = (list: Gift[]) => `G-${list.reduce((a, g) => Math.max(a, Number(g.id.slice(2))), 7000) + 1}`;
export function useFundraisingRecords() {
  const [gifts, setG] = useState<Gift[]>(() => (LIVE ? [] : structuredClone(mockGifts)));
  const [pledges, setP] = useState<Pledge[]>(() => (LIVE ? [] : structuredClone(mockPledges)));
  useEffect(() => { const load = () => { setG(readGifts()); setP(readPledges()); }; load(); window.addEventListener(FR_EVENT, load); return () => window.removeEventListener(FR_EVENT, load); }, []);
  return { gifts, pledges };
}
