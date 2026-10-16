/**
 * Officials ↔ access – one source of truth for who serves (Elected officials) and what they may do in the system
 * (Admins and roles). Follows the identity-lifecycle pattern "joiner – mover – leaver": the official seat is the
 * authoritative record; access is given when someone starts serving, changed when their seat changes, taken away when
 * they stop, and access that no seat explains is reviewed.
 *   roleForSeat   – which built-in role and scope a seat should get (or null: no system role needed)
 *   reconcile     – what to do now: give / change / take away / review, with plain-language reasons
 * DEMO (no API). Synced to the admin by sync-contracts.mjs – edit here (web), never in the admin copy.
 */
import { assignmentsOf, type AccessDoc, type AdminUser, type Assignment } from './access';
import { seatLabel, type Holder, type Officials } from './officials';

export type Seat = Pick<Assignment, 'roleId' | 'zones' | 'centers' | 'zips'>;
const SECRETARY_ROLE: Record<string, string> = { membership: 'membership-secretary', finance: 'finance-secretary', education: 'education-secretary' };
/** Roles that only make sense for someone holding an official seat (reviewed when no seat explains them). */
export const SEAT_ROLES = ['president', 'vice-president', 'general-secretary', 'treasurer', 'zone-director', 'associate-director', 'membership-secretary', 'finance-secretary', 'education-secretary', 'area-representative'];

/** The access an official seat should come with. At-large Area Representatives get the whole service area. */
export function roleForSeat(h: Holder, zipsOf: (center: string) => string[] = () => []): Seat | null {
  if (h.kind === 'officer') return ['president', 'vice-president', 'general-secretary', 'treasurer'].includes(h.office) ? { roleId: h.office, zones: [], centers: [], zips: [] } : null;
  if (h.kind === 'zonal-director') return h.zone ? { roleId: 'zone-director', zones: [h.zone as Assignment['zones'][number]], centers: [], zips: [] } : null;
  if (h.kind === 'associate-director') return h.center ? { roleId: 'associate-director', zones: [], centers: [h.center], zips: [] } : null;
  if (h.kind === 'secretary') return SECRETARY_ROLE[h.office] && h.center ? { roleId: SECRETARY_ROLE[h.office], zones: [], centers: [h.center], zips: [] } : null;
  if (h.kind === 'area-rep') { const zips = h.zips.length ? h.zips : zipsOf(h.center); return h.center && zips.length ? { roleId: 'area-representative', zones: [], centers: [h.center], zips: [...zips].sort() } : null; }
  return null;
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const same = (a: Seat, b: Seat) => a.roleId === b.roleId && a.zones.join() === b.zones.join() && a.centers.join() === b.centers.join() && [...a.zips].sort().join() === [...b.zips].sort().join();
const serving = (h: Holder, today: string) => h.status === 'serving' && !!h.name && !(h.kind !== 'secretary' && h.termEnd && h.termEnd < today);

export type Action =
  | { kind: 'give'; holder: Holder; seat: Seat; why: string }
  | { kind: 'change'; holder: Holder; seat: Seat; admin: AdminUser; index: number; why: string }
  | { kind: 'remove'; holder: Holder | null; admin: AdminUser; index: number; why: string }
  | { kind: 'review'; admin: AdminUser; index: number; why: string };

/** What needs doing so access matches the officials list. `center` limits the list to one masjid. */
export function reconcile(off: Officials, access: AccessDoc, today: string, zipsOf: (center: string) => string[] = () => [], center = '', zoneName: (id: string) => string = (z) => z): Action[] {
  const out: Action[] = [];
  const holders = new Map(off.holders.map((h) => [h.id, h]));
  const linked = new Map<string, { admin: AdminUser; index: number; x: Assignment }>();
  const live = access.admins.filter((a) => a.status !== 'suspended');
  for (const a of live) assignmentsOf(a).forEach((x, index) => { if (x.holderId) linked.set(x.holderId, { admin: a, index, x }); });
  const inScope = (c: string) => !center || c === center;
  for (const h of off.holders) {
    const want = roleForSeat(h, zipsOf);
    const has = linked.get(h.id);
    const label = seatLabel(h, zoneName);
    if (serving(h, today)) {
      if (!want || !inScope(want.centers[0] ?? h.center)) continue;
      if (!has) out.push({ kind: 'give', holder: h, seat: want, why: `${h.name} serves as ${label} but has no access to the system yet.` });
      else if (!same(has.x, want)) out.push({ kind: 'change', holder: h, seat: want, admin: has.admin, index: has.index, why: `${h.name}’s seat changed (${label}) – their access still points to the old one.` });
    } else if (has && inScope(has.x.centers[0] ?? h.center)) {
      out.push({ kind: 'remove', holder: h, admin: has.admin, index: has.index, why: h.status === 'vacant' ? `${label} is vacant${h.vacancy.reason ? '' : ''} – ${has.admin.name} still has its access.` : `${label}: the term ended – ${has.admin.name} still has its access.` });
    }
  }
  // access no seat explains (seat roles only; office accounts with other roles are not reviewed here)
  for (const a of live) assignmentsOf(a).forEach((x, index) => {
    if (!SEAT_ROLES.includes(x.roleId) || !inScope(x.centers[0] ?? '') || (center && !x.centers.length)) return;
    if (x.holderId && holders.has(x.holderId)) return;
    if (!x.holderId && x.reviewedOn && daysBetween(x.reviewedOn, today) < 365) return;   // reviewed in the last year (yearly access review)
    out.push({ kind: 'review', admin: a, index, why: x.holderId ? `${a.name}: the official seat this access came from was removed.` : `${a.name} has ${x.roleId.replace(/-/g, ' ')} access${x.centers[0] ? ` at ${x.centers[0]}` : ''} without an official seat in Elected officials.` });
  });
  const order = { remove: 0, change: 1, give: 2, review: 3 } as const;
  return out.sort((p, q) => order[p.kind] - order[q.kind]);
}
/** Counts for badges. */
export const reconcileCounts = (list: Action[]) => ({ give: list.filter((x) => x.kind === 'give').length, change: list.filter((x) => x.kind === 'change').length, remove: list.filter((x) => x.kind === 'remove').length, review: list.filter((x) => x.kind === 'review').length });
