/**
 * F1 Zones and Islamic Centers – the organization's map: zones (areas, director, term), Islamic Centers (address,
 * contact, Jumu'ah times, zone) and which ZIP codes belong to which zone. Other modules lean on it: Zakat routing by
 * ZIP (F2), donations by center (F3), officials (F5), prayer times and minutes (F6), member records and voting areas.
 * DEMO (no API). Live: GET/PUT /admin/org-structure; public parts (centers, Jumu'ah) GET /public/centers.
 * Synced to the admin by admin/scripts/sync-contracts.mjs – edit here (web), never in the admin copy.
 */
import { z } from 'zod';

const ID = z.string().regex(/^[a-z0-9-]{1,40}$/, 'Use lowercase letters, numbers and dashes.');
const ZIP = z.string().regex(/^\d{5}$/, 'A ZIP code has 5 digits.');
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date.');
const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 13:15.');
const PHONE = z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/, 'Use a phone number like (713) 555-0100.');

export const ZoneSchema = z.object({
  id: ID,
  name: z.string().trim().min(2).max(60),
  areas: z.string().max(240).default(''),                   // "The Woodlands, Spring, Cypress …"
  director: z.object({ name: z.string().max(80).default(''), email: z.union([z.literal(''), z.string().email('Enter a valid email.')]).default('') }).default({ name: '', email: '' }),
  termEnds: z.union([z.literal(''), DATE]).default(''),
  zips: z.array(ZIP).max(400).default([]),
  active: z.boolean().default(true),
});
export const CenterSchema = z.object({
  id: ID,
  name: z.string().trim().min(2).max(80),
  aka: z.string().max(80).default(''),                      // also known as, e.g. "Adel Road Islamic Center"
  zone: ID,
  address: z.object({ street: z.string().max(120).default(''), city: z.string().max(60).default(''), zip: z.union([z.literal(''), ZIP]).default('') }).default({ street: '', city: '', zip: '' }),
  phone: z.union([z.literal(''), PHONE]).default(''),
  website: z.union([z.literal(''), z.string().url('Use a full web address, like https://example.org')]).default(''),
  jumuah: z.array(z.object({ khutbah: TIME, label: z.string().max(40).default('') })).max(4).default([]),
  services: z.array(z.enum(['daily-prayers', 'jumuah', 'weekend-school', 'full-time-school', 'clinic', 'food-pantry', 'funeral', 'zakat-office'])).default([]),
  /** M1: the masjid's service area – every person living in one of these ZIP codes belongs to this masjid (and its zone). */
  zips: z.array(ZIP).max(200).default([]),
  active: z.boolean().default(true),
});
export const OrgStructureSchema = z.object({
  zones: z.array(ZoneSchema).max(30),
  centers: z.array(CenterSchema).max(200),
}).superRefine((d, ctx) => {
  const zid = new Set<string>();
  d.zones.forEach((z, i) => { if (zid.has(z.id)) ctx.addIssue({ code: 'custom', path: ['zones', i, 'id'], message: `Two zones use the ID “${z.id}”.` }); zid.add(z.id); });
  const zipOwner = new Map<string, string>();
  d.zones.forEach((z, i) => z.zips.forEach((zip, j) => {
    const other = zipOwner.get(zip);
    if (other) ctx.addIssue({ code: 'custom', path: ['zones', i, 'zips', j], message: `ZIP ${zip} is already in ${other}. A ZIP code belongs to one zone.` });
    else zipOwner.set(zip, z.name);
  }));
  const cid = new Set<string>();
  d.centers.forEach((c, i) => {
    if (cid.has(c.id)) ctx.addIssue({ code: 'custom', path: ['centers', i, 'id'], message: `Two centers use the ID “${c.id}”.` });
    cid.add(c.id);
    if (!zid.has(c.zone)) ctx.addIssue({ code: 'custom', path: ['centers', i, 'zone'], message: 'Pick a zone that exists.' });
    const names = d.centers.filter((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
    if (names.length > 1 && names[0] !== c) ctx.addIssue({ code: 'custom', path: ['centers', i, 'name'], message: `Another center is already called “${c.name}”.` });
  });
  // M1: a ZIP code is served by one masjid, and that masjid must be in the ZIP's zone
  const servedBy = new Map<string, string>();
  d.centers.forEach((c, i) => c.zips.forEach((zip, j) => {
    const other = servedBy.get(zip);
    if (other) { ctx.addIssue({ code: 'custom', path: ['centers', i, 'zips', j], message: `ZIP ${zip} is already served by ${other}. A ZIP code belongs to one masjid.` }); return; }
    if (c.active) servedBy.set(zip, c.name);
    const owner = zipOwner.get(zip);
    const mine = d.zones.find((z) => z.id === c.zone)?.name;
    if (!owner) ctx.addIssue({ code: 'custom', path: ['centers', i, 'zips', j], message: `ZIP ${zip} is not in any zone yet – add it to ${mine ?? 'the zone'} first.` });
    else if (owner !== mine) ctx.addIssue({ code: 'custom', path: ['centers', i, 'zips', j], message: `ZIP ${zip} is in ${owner}, but ${c.name} is in ${mine ?? c.zone}.` });
  }));
});
export type Zone = z.infer<typeof ZoneSchema>;
export type Center = z.infer<typeof CenterSchema>;
export type OrgStructure = z.infer<typeof OrgStructureSchema>;

export const SERVICE_LABEL: Record<Center['services'][number], string> = {
  'daily-prayers': 'Daily prayers', jumuah: "Jumu'ah", 'weekend-school': 'Weekend school', 'full-time-school': 'Full-time school',
  clinic: 'Clinic', 'food-pantry': 'Food pantry', funeral: 'Funeral services', 'zakat-office': 'Zakat office',
};

/** Which zone a ZIP code belongs to (null = not assigned yet – the admin sees it in "ZIP codes without a zone"). */
export function zoneForZip(doc: OrgStructure, zip: string): Zone | null {
  const z5 = zip.trim().slice(0, 5);
  return doc.zones.find((z) => z.active && z.zips.includes(z5)) ?? null;
}
export const centersIn = (doc: OrgStructure, zoneId: string, all = false) => doc.centers.filter((c) => c.zone === zoneId && (all || c.active));
/** M1: the masjid whose service area holds this ZIP (null = no masjid serves it yet). */
export function centerForZip(doc: OrgStructure, zip: string): Center | null {
  const z5 = zip.trim().slice(0, 5);
  return doc.centers.find((c) => c.active && c.zips.includes(z5)) ?? null;
}
/** M1: where a person belongs – ZIP → masjid → zone. `why` explains a missing link in plain words. */
export function homeForZip(doc: OrgStructure, zip: string): { zone: Zone | null; center: Center | null; why: string } {
  const z5 = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(z5)) return { zone: null, center: null, why: 'Enter a 5-digit ZIP code.' };
  const zone = zoneForZip(doc, z5); const center = centerForZip(doc, z5);
  if (!zone) return { zone: null, center: null, why: `ZIP ${z5} is outside every zone.` };
  if (!center) return { zone, center: null, why: `ZIP ${z5} is in ${zone.name}, but no masjid serves it yet.` };
  return { zone, center, why: '' };
}
/** M1: ZIP codes of a zone that no active masjid serves. */
export const unservedZips = (doc: OrgStructure, zoneId: string) => (doc.zones.find((z) => z.id === zoneId)?.zips ?? []).filter((zip) => !centerForZip(doc, zip));

/** Plain-language warnings an admin should act on (not errors – the document can still be published). */
export function structureWarnings(doc: OrgStructure, today: string): { zone?: string; center?: string; text: string }[] {
  const out: { zone?: string; center?: string; text: string }[] = [];
  const soon = addDays(today, 90);
  for (const z of doc.zones.filter((x) => x.active)) {
    if (!z.director.name) out.push({ zone: z.id, text: `${z.name} has no director.` });
    else if (z.termEnds && z.termEnds < today) out.push({ zone: z.id, text: `${z.name}: the director's term ended ${fmt(z.termEnds)}.` });
    else if (z.termEnds && z.termEnds <= soon) out.push({ zone: z.id, text: `${z.name}: the director's term ends ${fmt(z.termEnds)} – plan the election or appointment.` });
    if (!z.zips.length) out.push({ zone: z.id, text: `${z.name} has no ZIP codes, so no member or Zakat applicant can be placed in it.` });
    if (!centersIn(doc, z.id).length) out.push({ zone: z.id, text: `${z.name} has no active Islamic Center.` });
    else { const open = unservedZips(doc, z.id); if (open.length) out.push({ zone: z.id, text: `${z.name}: ${open.length === 1 ? `ZIP ${open[0]} is` : `${open.length} ZIP codes are`} not served by any masjid${open.length > 1 ? ` (${open.slice(0, 4).join(', ')}${open.length > 4 ? ' …' : ''})` : ''} – people living there have no home masjid.` }); }
  }
  const noArea = doc.centers.filter((c) => c.active && !c.zips.length);
  if (noArea.length === 1) out.push({ center: noArea[0].id, text: `${noArea[0].name} has no service-area ZIP codes, so no member belongs to it.` });
  else if (noArea.length > 1) out.push({ center: noArea[0].id, text: `${noArea.length} masjids have no service-area ZIP codes (${noArea.slice(0, 3).map((c) => c.name).join(', ')}${noArea.length > 3 ? ' …' : ''}).` });
  for (const c of doc.centers.filter((x) => x.active)) {
    if (c.address.zip) {
      const home = zoneForZip(doc, c.address.zip);
      if (home && home.id !== c.zone) out.push({ center: c.id, text: `${c.name} is in ZIP ${c.address.zip}, which belongs to ${home.name}, but the center is listed under ${doc.zones.find((z) => z.id === c.zone)?.name ?? c.zone}.` });
    }
    if (c.services.includes('jumuah') && !c.jumuah.length) out.push({ center: c.id, text: `${c.name} offers Jumu'ah but has no khutbah time.` });
  }
  return out;
}
/** ZIP codes seen on member or applicant records that no zone covers yet. */
export const unassignedZips = (doc: OrgStructure, zips: string[]) => Array.from(new Set(zips.map((z) => z.slice(0, 5)).filter((z) => /^\d{5}$/.test(z) && !zoneForZip(doc, z)))).sort();

export const fmt = (d: string) => (d ? `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}` : '');
export const fmtTime = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
function addDays(d: string, n: number) { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
export function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'center'; }

/* ---------------- ISGH demo data ----------------
 * Zone IDs and center names match the demo member records (members carry "<Zone> Islamic Center N").
 * Directors are placeholders – the real names are entered by ISGH in the admin (no personal data in code).
 * The owner's Figma prototype lists ISGH's real centers (e.g. Masjid Bilal, Adel Road); load them once approved. */
const AREAS: Record<string, { name: string; areas: string; zips: string[]; city: string[] }> = {
  n: { name: 'North', areas: 'North Houston, Spring, The Woodlands, Conroe', zips: ['77014', '77067', '77090', '77068', '77379', '77388', '77373'], city: ['Houston', 'Spring'] },
  nw: { name: 'Northwest', areas: 'Bear Creek, Spring Branch, Katy, Cypress', zips: ['77040', '77041', '77064', '77084', '77449', '77450', '77494', '77429', '77433'], city: ['Houston', 'Katy', 'Cypress'] },
  sw: { name: 'Southwest', areas: 'Sugar Land, Mission Bend, Richmond, Missouri City', zips: ['77036', '77072', '77074', '77081', '77099', '77478', '77479', '77489'], city: ['Houston', 'Sugar Land', 'Missouri City'] },
  s: { name: 'South', areas: 'Stafford, Medical Center, Pearland', zips: ['77045', '77047', '77075', '77089', '77581', '77584'], city: ['Houston', 'Pearland'] },
  se: { name: 'Southeast', areas: 'Pasadena, Clear Lake, Baytown, League City', zips: ['77502', '77504', '77505', '77034', '77062', '77573'], city: ['Pasadena', 'Houston', 'League City'] },
};
const TERMS: Record<string, string> = { n: '2026-12-31', nw: '2025-12-31', sw: '2026-12-31', s: '2026-12-31', se: '2026-12-31' };
export const mockOrgStructure: OrgStructure = {
  zones: Object.entries(AREAS).map(([id, a]) => ({
    id, name: `${a.name} Zone`, areas: a.areas, zips: a.zips, active: true, termEnds: TERMS[id],
    director: { name: id === 'se' ? '' : `${a.name} Zone Director`, email: `dir.${id}z@isgh.org` },
  })),
  centers: Object.entries(AREAS).flatMap(([id, a], zi) => [1, 2, 3, 4].map((n) => ({
    id: `${id}-${n}`, name: `${a.name} Islamic Center ${n}`, aka: '', zone: id, active: true,
    address: { street: `${1100 + zi * 900 + n * 37} ${['Main St', 'Bellaire Blvd', 'Kuykendahl Rd', 'Westheimer Rd'][n - 1]}`, city: a.city[(n - 1) % a.city.length], zip: a.zips[(n * 2) % a.zips.length] },
    phone: `(${['713', '281', '832', '346'][n - 1]}) 555-${String(100 + zi * 10 + n).padStart(4, '0')}`,
    website: `https://${a.name.toLowerCase()}${n}.isgh.org`,
    jumuah: n === 4 && id === 'se' ? [] : [{ khutbah: '13:15', label: '' }, ...(n === 1 ? [{ khutbah: '14:15', label: 'Second' }] : [])],
    services: ['daily-prayers', 'jumuah', ...(n === 1 ? ['weekend-school', 'zakat-office'] : []), ...(n === 2 ? ['food-pantry'] : [])] as Center['services'],
    zips: a.zips.filter((_, i) => i % 4 === n - 1),         // demo: the zone's ZIPs shared round-robin (same rule as the demo members)
  }))),
};
