/**
 * Admin view of a member's family – the MEMBERSHIP layer only (family history stays private to the member).
 * DEMO: spouse comes from the real household link; parents and children are generated per member (stable),
 * Aisha Rahman uses the same demo family as the website portal.
 * Live: GET /admin/members/:id/family (BE B3) – only relatives the member added, members linked after they accept.
 */
import { DEMO_FAMILIES } from './demo-family';
import type { Family, MemberLink, Person } from './family';
import { eligibility, sexOf, statusOf, type Member } from '@/lib/members/members';

export const TODAY = '2026-10-13';
export const NEXT_RECORD_DATE = '2027-06-30';

function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const M_NAMES = ['Ahmed', 'Omar', 'Yusuf', 'Ibrahim', 'Bilal', 'Hamza', 'Khalid', 'Zaid', 'Idris', 'Musa', 'Isa', 'Harun'];
const F_NAMES = ['Aisha', 'Fatima', 'Maryam', 'Amina', 'Zainab', 'Sara', 'Hana', 'Noor', 'Layla', 'Safiya', 'Ruqayya', 'Asiya'];

export function linkOf(m: Member): MemberLink {
  const s = statusOf(m);
  return { memberId: m.id, status: s === 'life' ? 'life' : s === 'active' ? 'active' : s === 'pending' ? 'pending' : 'expired', canVote: eligibility(m).eligible, accepted: true };
}
const personOf = (m: Member): Person => ({ id: m.id, first: m.first, last: m.last, sex: sexOf(m.first), born: m.dob, member: linkOf(m) });

export function familyFor(m: Member, all: Member[]): Family {
  const byId = new Map(all.map((x) => [x.id, x]));
  if (m.email === 'aisha@example.com') {
    const f = DEMO_FAMILIES['aisha@example.com'];
    const people = f.people.filter((p) => !p.heritage).map((p) => (p.id === f.rootId ? { ...p, id: m.id, member: linkOf(m) } : p));
    const map = (id: string) => (id === f.rootId ? m.id : id);
    const keep = new Set(people.map((p) => p.id));
    const unions = f.unions.map((u) => ({ ...u, a: map(u.a), b: u.b ? map(u.b) : undefined, children: u.children.map(map) }))
      .filter((u) => keep.has(u.a) || (u.b && keep.has(u.b)))
      .map((u) => (keep.has(u.a) ? u : { ...u, a: u.b!, b: undefined }));
    return { rootId: m.id, people, unions };
  }
  const h = hash(m.id); const born = Number(m.dob.slice(0, 4)); const age = 2026 - born;
  const people: Person[] = [personOf(m)]; const unions: Family['unions'] = [];
  const sp = m.spouseId ? byId.get(m.spouseId) : undefined;
  if (sp) people.push(personOf(sp));
  // parents (generated, not members): shown when the member is under 70
  if (age < 70) {
    const fy = born - 26 - (h % 6), my = born - 23 - ((h >>> 3) % 5);
    const father: Person = { id: `${m.id}-fa`, first: M_NAMES[h % M_NAMES.length], last: m.last, sex: 'm', born: String(fy), died: fy < 1942 || (age > 45 && h % 3 === 0) ? String(Math.max(fy + 62, 1995) + (h % 12)) : undefined };
    const mother: Person = { id: `${m.id}-mo`, first: F_NAMES[(h >>> 4) % F_NAMES.length], last: m.last, sex: 'f', born: String(my), died: my < 1938 ? String(Math.max(my + 70, 2000) + (h % 9)) : undefined, invited: my >= 1938 && h % 5 === 0 ? '2026-09-28' : undefined };
    people.push(father, mother);
    unions.push({ id: `${m.id}-u0`, a: father.id, b: mother.id, children: [m.id] });
  }
  // children: 0–4, born when the parents were 24–38 – generated once per couple so both spouses see the same children
  const kids: string[] = [];
  const base = sp && sp.id < m.id ? sp : m; const hb = hash(base.id); const bb = Number(base.dob.slice(0, 4));
  const father = sp ? (sexOf(m.first) === 'm' ? m : sp) : m;
  if (2026 - bb >= 27) {
    const n = (hb >>> 7) % 5;
    for (let i = 0; i < n; i++) {
      const y = bb + 24 + ((hb >>> (9 + i)) % 4) + i * 3; if (y > 2025) break;
      const sex = (hb >>> (12 + i)) & 1 ? 'm' : 'f';
      const mm = 1 + ((hb >>> (2 + i)) % 12), dd = 1 + ((hb >>> (5 + i)) % 28);
      const kid: Person = { id: `${base.id}-c${i}`, first: (sex === 'm' ? M_NAMES : F_NAMES)[(hb >>> (3 * i + 1)) % 12], last: father.last, sex, born: `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}` };
      people.push(kid); kids.push(kid.id);
    }
  }
  if (sp || kids.length) unions.push({ id: `${m.id}-u1`, a: sexOf(m.first) === 'm' || !sp ? m.id : sp.id, b: sp ? (sexOf(m.first) === 'm' ? sp.id : m.id) : undefined, children: kids });
  return { rootId: m.id, people, unions };
}
