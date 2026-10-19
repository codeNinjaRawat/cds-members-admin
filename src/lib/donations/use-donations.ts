'use client';
/** F3 gifts. Demo: this browser only. Live: GET /admin/donations, POST /admin/donations (cash/check), PATCH (fund, masjid,
 *  donor), refund, receipt, POST /admin/payouts (a platform deposit, once for all its gifts); platform gifts arrive by import. */
import { useEffect, useState } from 'react';
import { DonationSettingsSchema, mockDonationSettings, mockDonations, type Donation, type DonationSettings } from '@/lib/community/donations';
import { OrgStructureSchema, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { logAudit } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

/* ---------- live mode: gifts from the API; each change goes to its endpoint (online gifts arrive from the platforms) ---------- */
let live: Donation[] | null = null; let liveLoading: Promise<void> | null = null;
export function loadLiveDonations(force = false): Promise<void> {
  if (!force && live) return Promise.resolve();
  if (!force && liveLoading) return liveLoading;
  liveLoading = be<{ donations: Donation[] }>('GET', 'admin/donations?limit=100000').then((r) => {
    liveLoading = null; if (r.ok) live = r.data.donations; else if (r.status !== 401) notice(`Gifts could not be loaded: ${r.message}`);
    window.dispatchEvent(new Event(DONATIONS_EVENT));
  });
  return liveLoading;
}
type Step = [string, string, unknown];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
/** One gift's change → the API calls (a platform deposit is sent once for all its gifts – see payoutBatch). */
export function liveDonationSteps(before: Donation | undefined, d: Donation, action: string, detail: string): Step[] {
  if (!before) {
    if (d.platform !== 'cash' && d.platform !== 'check') return [];   // online gifts are imported from the platform, never typed in
    return [['POST', 'admin/donations', { amountCents: d.amountCents, platform: d.platform, ref: d.ref, fund: d.fund, center: d.center, givenOn: d.at.slice(0, 10), name: d.donor.name, email: d.donor.email, memberId: d.donor.memberId, anonymous: d.donor.anonymous }]];
  }
  const id = encodeURIComponent(d.id); const steps: Step[] = [];
  const patch: Record<string, unknown> = {};
  if (d.fund !== before.fund) patch.fund = d.fund;
  if (d.center !== before.center) patch.center = d.center;
  if (JSON.stringify(d.donor) !== JSON.stringify(before.donor)) patch.donor = d.donor;
  if (Object.keys(patch).length) steps.push(['PATCH', `admin/donations/${id}`, patch]);
  if (d.refunded && !before.refunded) steps.push(['POST', `admin/donations/${id}/refund`, { reason: detail || action }]);
  if (d.receiptSent && !before.receiptSent) steps.push(['POST', `admin/donations/${id}/receipt`, {}]);
  return steps;
}
const payouts = new Map<string, Donation[]>(); let flushing = false;
function payoutBatch(d: Donation) {
  payouts.set(`${d.platform}|${d.payout}`, [...(payouts.get(`${d.platform}|${d.payout}`) ?? []), d]);
  if (flushing) return; flushing = true;
  setTimeout(() => { flushing = false; const all = [...payouts]; payouts.clear();
    void (async () => {
      for (const [k, gifts] of all) {
        const [platform, id] = k.split('|');
        const r = await be<{ matched: boolean; differenceCents: number }>('POST', 'admin/payouts', { platform, id, amountCents: gifts.reduce((a, g) => a + g.amountCents - g.feeCents, 0), feeCents: gifts.reduce((a, g) => a + g.feeCents, 0), arrivedOn: today(), refs: gifts.map((g) => g.ref) });
        notice(r.ok ? `Deposit ${id}: ${gifts.length} gift${gifts.length === 1 ? '' : 's'} matched.` : `Deposit ${id}: ${r.message}`, r.ok ? 'ok' : 'error');
      }
      await loadLiveDonations(true);
    })();
  }, 0);
}
async function saveLive(d: Donation, action: string, detail: string) {
  const before = live?.find((x) => x.id === d.id);
  if (before && d.payout && d.payout !== before.payout) payoutBatch(d);
  if (!before && d.platform !== 'cash' && d.platform !== 'check') { notice('Online gifts arrive from the giving platform – they cannot be typed in.'); return; }
  for (const [method, path, body] of liveDonationSteps(before, d, action, detail)) { const r = await be(method, path, body); if (!r.ok) { notice(`${action}: ${r.message}`); break; } }
  await loadLiveDonations(true);
}

const KEY = 'isgh-admin-donations';
export const DONATIONS_EVENT = 'isgh:donations';
export function readDonations(): Donation[] {
  if (LIVE) { if (typeof window !== 'undefined' && !live) void loadLiveDonations(); return live ?? []; }
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Donation[]) : structuredClone(mockDonations); } catch { return structuredClone(mockDonations); }
}
export function saveDonation(d: Donation, action: string, detail = '') {
  if (LIVE) { void saveLive(d, action, detail); return; }
  const list = readDonations(); const i = list.findIndex((x) => x.id === d.id);
  if (i >= 0) list[i] = d; else list.unshift(d);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ }
  logAudit({ area: 'donations', action: `${action} – ${d.id}`, detail });
  window.dispatchEvent(new Event(DONATIONS_EVENT));
}
export const nextDonationId = (list: Donation[]) => `D-${list.reduce((m, d) => Math.max(m, Number(d.id.slice(2))), 10000) + 1}`;
export function useDonations() {
  const [list, setList] = useState<Donation[]>(() => (LIVE ? [] : structuredClone(mockDonations)));
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
