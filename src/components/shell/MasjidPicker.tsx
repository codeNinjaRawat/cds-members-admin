'use client';
/**
 * The masjid filter as it appears on a screen: one select grouped by zone (All masjids › a zone › one masjid), the same
 * on every page because the choice is shared (lib/access/masjid-filter). A locked role sees a chip instead.
 * `unrouted` adds "Not routed yet" for screens whose records can exist before a masjid is known.
 */
import { UNROUTED, useMasjidFilter, type MasjidFilter } from '@/lib/access/masjid-filter';
import { ZONES, type ZoneId } from '@/lib/members/members';

export function MasjidPicker({ f, unrouted = false, label = 'Masjid', className = '' }: { f?: MasjidFilter; unrouted?: boolean; label?: string; className?: string }) {
  const own = useMasjidFilter();
  const m = f ?? own;
  if (m.lockedMasjid || m.lockedZone) return <span className={`dbar-lock ${className}`} title="Your role">{m.lockedMasjid || `${ZONES[m.lockedZone as ZoneId]} Zone`}</span>;
  const value = m.masjid || (m.zone ? `zone:${m.zone}` : '');
  const zones = (Object.keys(ZONES) as ZoneId[]).filter((z) => m.org.centers.some((c) => c.active && c.zone === z && m.access.inScope(z, c.name)));
  return (
    <select className={`in pill-select masjid-pick ${className}`} aria-label={label} value={value}
      onChange={(e) => { const v = e.target.value; if (!v) m.clear(); else if (v.startsWith('zone:')) m.setZone(v.slice(5) as ZoneId); else m.setMasjid(v); }}>
      <option value="">All masjids</option>
      {unrouted && <option value={UNROUTED}>Not routed yet</option>}
      {zones.map((z) => (
        <optgroup key={z} label={`${ZONES[z]} Zone`}>
          <option value={`zone:${z}`}>All of {ZONES[z]} Zone</option>
          {m.org.centers.filter((c) => c.active && c.zone === z && m.access.inScope(z, c.name)).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/** Top bar: shows what the screens are narrowed to; one click shows everything again. */
export function ViewingChip() {
  const m = useMasjidFilter();
  if (!m.narrowed) return null;
  return (
    <button type="button" className="viewing-chip" onClick={m.clear} title="Show all masjids" aria-label={`Viewing ${m.label} – show all masjids`}>
      <span>Viewing</span><b>{m.label}</b><i aria-hidden="true">×</i>
    </button>
  );
}
