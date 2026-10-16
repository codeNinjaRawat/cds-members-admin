'use client';
/**
 * "Viewing" – the one masjid filter every screen shares. Everything in ISGH belongs to a masjid through a ZIP code, so
 * every list and dashboard can be narrowed to one zone or one masjid; the choice sticks as you move between screens
 * (like Planning Center's sticky campus filter) and clears from the top bar. Masjid- and zone-limited roles are locked
 * to their own area: the filter shows it but cannot be changed (the server refuses anything else anyway).
 *
 * Pages call `useMasjidFilter()` and keep a record when `keep(zone, masjid, zip)` is true. Records that are not routed
 * to a masjid yet (a gift with no fund, a Zakat case before intake) show under "Not routed yet".
 */
import { useEffect, useState } from 'react';
import { useAccess } from './use-access';
import { ZONES, type ZoneId } from '@/lib/members/members';
import { centerForZip, mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';

export const UNROUTED = '~none';
const KEY = 'isgh-admin-viewing';
export const VIEW_EVENT = 'isgh:viewing';
type Viewing = { zone: '' | ZoneId; masjid: string };
const read = (): Viewing => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return { zone: v.zone ?? '', masjid: v.masjid ?? '' }; } catch { return { zone: '', masjid: '' }; } };
export function setViewing(v: Partial<Viewing>) {
  const next = { ...read(), ...v };
  if (next.masjid && next.masjid !== UNROUTED) { const c = mockOrgStructure.centers.find((x) => x.name === next.masjid); if (c) next.zone = c.zone as ZoneId; }
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ }
  window.dispatchEvent(new Event(VIEW_EVENT));
}
export const clearViewing = () => setViewing({ zone: '', masjid: '' });

export function useMasjidFilter(org: OrgStructure = mockOrgStructure) {
  const access = useAccess();
  const [v, setV] = useState<Viewing>({ zone: '', masjid: '' });
  useEffect(() => { const on = () => setV(read()); on(); window.addEventListener(VIEW_EVENT, on); window.addEventListener('storage', on); return () => { window.removeEventListener(VIEW_EVENT, on); window.removeEventListener('storage', on); }; }, []);
  const role = access.role;
  const lockedMasjid = role?.centerScoped && access.me?.centers.length === 1 ? access.me.centers[0] : '';
  const lockedZone = role?.zoneScoped && access.me?.zones.length === 1 ? (access.me.zones[0] as ZoneId) : '';
  const masjid = lockedMasjid || (v.masjid === UNROUTED ? UNROUTED : org.centers.some((c) => c.name === v.masjid && access.inScope(c.zone, c.name)) ? v.masjid : '');
  const zone = (lockedZone || (masjid && masjid !== UNROUTED ? (org.centers.find((c) => c.name === masjid)?.zone as ZoneId) : v.zone)) as '' | ZoneId;
  const zoneOf = (center: string) => org.centers.find((c) => c.name === center)?.zone ?? '';
  /** Keep a record? zone/masjid may be '' when the record is not routed; a ZIP alone is enough (masjid comes from it). */
  const keep = (z?: string, center?: string, zip?: string) => {
    const c = center || (zip ? centerForZip(org, zip)?.name ?? '' : '');
    const zz = z || (c ? zoneOf(c) : '');
    if (!access.inScope(zz, c, zip)) return false;
    if (masjid === UNROUTED) return !c;
    if (masjid) return c === masjid;
    if (zone) return zz === zone;
    return true;
  };
  const label = masjid === UNROUTED ? 'Not routed to a masjid yet' : masjid || (zone ? `${ZONES[zone]} Zone` : role?.centerScoped ? access.me?.centers.join(', ') ?? '' : role?.zoneScoped ? (access.me?.zones ?? []).map((z) => `${ZONES[z as ZoneId]} Zone`).join(', ') : 'All masjids');
  const narrowed = !!(masjid || zone) && !lockedMasjid && !lockedZone;
  return { zone, masjid, lockedZone, lockedMasjid, keep, label, narrowed, access, org, zoneOf,
    setZone: (z: '' | ZoneId) => setViewing({ zone: z, masjid: '' }), setMasjid: (m: string) => setViewing({ masjid: m }), clear: clearViewing };
}
export type MasjidFilter = ReturnType<typeof useMasjidFilter>;
