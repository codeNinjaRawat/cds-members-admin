/**
 * Family tree – shared model (website member portal + admin; synced to admin by scripts/sync-contracts.mjs).
 *
 * Two layers (owner 2026-10-13: "both"):
 *  - Membership family: the member, spouse, parents, children, siblings, grandchildren – each shows if they are a member,
 *    can vote, or can join soon (e.g. a child turning 18 before the June 30 record date).
 *  - Heritage: older generations kept as plain names and years. Private to the family (admin never sees them).
 *
 * Live (BE B3): GET/PUT /member/family (owner = the member), relatives who are members are linked only after they accept;
 * admin: GET /admin/members/:id/family (membership layer only).
 */

export type Sex = 'm' | 'f';
export type MemberLink = { memberId: string; status: 'active' | 'life' | 'expired' | 'pending'; canVote: boolean; accepted: boolean };
export type Person = {
  id: string; first: string; last: string; sex: Sex;
  born?: string;           // YYYY-MM-DD or YYYY
  died?: string;           // YYYY (or date) – shown as "Late"
  place?: string;          // heritage: where they lived
  heritage?: boolean;      // older generation, names only
  member?: MemberLink;     // linked ISGH member record
  invited?: string;        // date an invitation to join was sent (demo)
  placeholder?: boolean;   // unknown parents that only hold siblings together (never shown)
};
export type Union = { id: string; a: string; b?: string; children: string[] };
export type Family = { rootId: string; people: Person[]; unions: Union[] };

/* ---------- graph helpers ---------- */
export const byId = (f: Family) => new Map(f.people.map((p) => [p.id, p]));
export const unionsOf = (f: Family, id: string) => f.unions.filter((u) => u.a === id || u.b === id);
export const parentUnion = (f: Family, id: string) => f.unions.find((u) => u.children.includes(id));
export const spouseOf = (f: Family, id: string) => { const u = unionsOf(f, id).find((x) => x.b); return u ? (u.a === id ? u.b : u.a) : undefined; };
export const fullName = (p: Person) => `${p.first} ${p.last}`;
const year = (d?: string) => (d ? Number(d.slice(0, 4)) : undefined);

/** Generation of everyone relative to the root (parents −1, children +1, spouses same). */
export function generations(f: Family): Map<string, number> {
  const g = new Map<string, number>([[f.rootId, 0]]);
  const q = [f.rootId];
  while (q.length) {
    const id = q.shift()!; const n = g.get(id)!;
    const visit = (other: string | undefined, gen: number) => { if (other && !g.has(other)) { g.set(other, gen); q.push(other); } };
    for (const u of unionsOf(f, id)) { visit(u.a === id ? u.b : u.a, n); for (const c of u.children) visit(c, n + 1); }
    const pu = parentUnion(f, id); if (pu) { visit(pu.a, n - 1); visit(pu.b, n - 1); }
  }
  return g;
}

/* ---------- kinship words (from the root's point of view) ---------- */
type Step = 'P' | 'C' | 'S';
function pathTo(f: Family, target: string): Step[] | null {
  const prev = new Map<string, [string, Step]>(); const seen = new Set([f.rootId]); const q = [f.rootId];
  while (q.length) {
    const id = q.shift()!;
    if (id === target) break;
    const nb: [string | undefined, Step][] = [];
    for (const u of unionsOf(f, id)) { nb.push([u.a === id ? u.b : u.a, 'S']); u.children.forEach((c) => nb.push([c, 'C'])); }
    const pu = parentUnion(f, id); if (pu) { nb.push([pu.a, 'P']); nb.push([pu.b, 'P']); }
    for (const [o, s] of nb) if (o && !seen.has(o)) { seen.add(o); prev.set(o, [id, s]); q.push(o); }
  }
  if (!seen.has(target)) return null;
  const steps: Step[] = []; let cur = target;
  while (cur !== f.rootId) { const [p, s] = prev.get(cur)!; steps.unshift(s); cur = p; }
  return steps;
}
export function relationTo(f: Family, id: string): string {
  if (id === f.rootId) return 'You';
  const p = byId(f).get(id)!; const m = p.sex === 'm';
  const path = pathTo(f, id)?.join('') ?? '';
  const greats = (n: number) => 'Great-'.repeat(Math.max(0, n));
  if (path === 'S') return m ? 'Husband' : 'Wife';
  if (/^P+$/.test(path)) return path.length === 1 ? (m ? 'Father' : 'Mother') : `${greats(path.length - 2)}${m ? 'grandfather' : 'grandmother'}`.replace(/^g/, 'G');
  if (/^C+$/.test(path)) return path.length === 1 ? (m ? 'Son' : 'Daughter') : `${greats(path.length - 2)}${m ? 'grandson' : 'granddaughter'}`.replace(/^g/, 'G');
  if (path === 'PC') return m ? 'Brother' : 'Sister';
  if (path === 'PCS') return m ? 'Brother-in-law' : 'Sister-in-law';
  if (path === 'PCC') return m ? 'Nephew' : 'Niece';
  if (path === 'PPC') return m ? 'Uncle' : 'Aunt';
  if (path === 'PPCC') return 'Cousin';
  if (path === 'CS') return m ? 'Son-in-law' : 'Daughter-in-law';
  if (path === 'SP') return m ? 'Father-in-law' : 'Mother-in-law';
  if (path === 'SPC') return m ? 'Brother-in-law' : 'Sister-in-law';
  if (/^SP+$/.test(path)) return `Spouse’s ${path.length === 3 ? (m ? 'grandfather' : 'grandmother') : 'ancestor'}`;
  return 'Relative';
}

/* ---------- membership status of each person ---------- */
export type Badge = { tone: 'vote' | 'member' | 'warn' | 'join' | 'soon' | 'child' | 'late' | 'invited'; text: string };
export function ageOn(born: string, on: string) {
  if (born.length === 4) return Number(on.slice(0, 4)) - Number(born);
  const [y, mo, d] = born.split('-').map(Number); const [Y, M, D] = on.split('-').map(Number);
  return Y - y - (M < mo || (M === mo && D < d) ? 1 : 0);
}
export const fmtDate = (d: string) => (d.length === 4 ? d : `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`);
export function eighteenth(born: string) { return born.length === 4 ? `${Number(born) + 18}` : `${Number(born.slice(0, 4)) + 18}-${born.slice(5)}`; }

/** today: YYYY-MM-DD (America/Chicago); recordDate: next June 30 that matters for voting */
export function badgeFor(p: Person, today: string, recordDate: string): Badge {
  if (p.died) return { tone: 'late', text: 'Late' };
  if (p.member) {
    const s = p.member.status;
    if (s === 'pending') return { tone: 'warn', text: 'Applied – waiting' };
    if (s === 'expired') return { tone: 'warn', text: 'Not renewed' };
    return p.member.canVote ? { tone: 'vote', text: s === 'life' ? 'Life · can vote' : 'Member · can vote' } : { tone: 'member', text: s === 'life' ? 'Life member' : 'Member' };
  }
  if (p.heritage) return { tone: 'late', text: 'Family history' };
  if (p.invited) return { tone: 'invited', text: `Invited ${fmtDate(p.invited)}` };
  if (!p.born) return { tone: 'join', text: 'Not a member' };
  const age = ageOn(p.born, today);
  if (age >= 18) return { tone: 'join', text: 'Can join' };
  const e = eighteenth(p.born);
  if (e.length > 4 && e <= recordDate) return { tone: 'soon', text: `Turns 18 on ${fmtDate(e)}` };
  return { tone: 'child', text: `Age ${age}` };
}

/** Plain-language highlights for the family (shown above the tree). */
export function insights(f: Family, today: string, recordDate: string, layer: 'membership' | 'whole' = 'membership') {
  const gen = generations(f); const out: { tone: Badge['tone']; text: string; personId?: string }[] = [];
  const living = f.people.filter((p) => !p.died && !p.heritage && !p.placeholder && gen.has(p.id));
  const members = living.filter((p) => p.member && p.member.status !== 'pending');
  const voters = living.filter((p) => p.member?.canVote);
  out.push({ tone: 'vote', text: `${members.length} of ${living.length} living relatives here are ISGH members · ${voters.length} can vote` });
  for (const p of living) {
    const b = badgeFor(p, today, recordDate);
    if (b.tone === 'soon') out.push({ tone: 'soon', personId: p.id, text: `${p.first} turns 18 on ${fmtDate(eighteenth(p.born!))} – they can join as their own member and vote if dues are paid by ${fmtDate(recordDate)}.` });
  }
  const canJoin = living.filter((p) => badgeFor(p, today, recordDate).tone === 'join');
  if (canJoin.length) out.push({ tone: 'join', text: `${canJoin.map((p) => p.first).join(', ')} can join ISGH – send an invitation.` });
  const expired = living.filter((p) => p.member?.status === 'expired');
  if (expired.length) out.push({ tone: 'warn', text: `${expired.map((p) => p.first).join(', ')} ${expired.length > 1 ? 'have' : 'has'} not renewed yet.` });
  if (layer === 'whole') { const h = f.people.filter((p) => p.heritage && !p.placeholder).length; if (h) out.push({ tone: 'late', text: `${h} names from earlier generations are kept in your family history.` }); }
  return out;
}

/* ---------- layout: generation rows, couples side by side, children under their parents ---------- */
export const CARD = { w: 204, h: 92, coupleGap: 22, gap: 28, rowGap: 64 };
export type LaidOut = {
  nodes: { id: string; x: number; y: number; gen: number }[];
  couples: { x1: number; x2: number; y: number }[];
  links: string[];   // SVG path data
  width: number; height: number;
};
type Unit = { ids: string[]; target: number; x: number; w: number };

export function visibleIds(f: Family, layer: 'membership' | 'whole') {
  const gen = generations(f);
  return new Set(f.people.filter((p) => gen.has(p.id) && !p.placeholder && (layer === 'whole' || (!p.heritage && gen.get(p.id)! >= -1 && gen.get(p.id)! <= 2))).map((p) => p.id));
}

export function layout(f: Family, layer: 'membership' | 'whole' = 'membership'): LaidOut {
  const gen = generations(f); const show = visibleIds(f, layer);
  const gens = [...new Set([...show].map((id) => gen.get(id)!))].sort((a, b) => a - b);
  const pos = new Map<string, number>(); // person center x
  const unitOf = (ids: string[]): Unit => ({ ids, target: 0, x: 0, w: ids.length * CARD.w + (ids.length - 1) * CARD.coupleGap });
  const rowUnits = (g: number): Unit[] => {
    const done = new Set<string>(); const units: Unit[] = [];
    const inRow = [...show].filter((id) => gen.get(id) === g);
    for (const id of inRow) {
      if (done.has(id)) continue;
      const sp = spouseOf(f, id);
      const pair = sp && show.has(sp) && gen.get(sp) === g && !done.has(sp) ? orderCouple(f, id, sp) : [id];
      pair.forEach((x) => done.add(x)); units.push(unitOf(pair));
    }
    return units;
  };
  const place = (units: Unit[]) => {
    units.sort((a, b) => a.target - b.target);
    let edge = -Infinity;
    for (const u of units) { u.x = Math.max(u.target - u.w / 2, edge + CARD.gap); edge = u.x + u.w; }
    // pull the row back so its average error is zero (keeps it balanced under/over its family)
    const shift = units.reduce((s, u) => s + (u.target - (u.x + u.w / 2)), 0) / (units.length || 1);
    for (const u of units) { u.x += shift; u.ids.forEach((id, i) => pos.set(id, u.x + CARD.w / 2 + i * (CARD.w + CARD.coupleGap))); }
  };
  const birthOrder = (a: string, b: string) => (year(byId(f).get(a)?.born) ?? 0) - (year(byId(f).get(b)?.born) ?? 0);

  // generation 0: the root's unit with siblings around it in birth order
  const r0 = rowUnits(0);
  const sibs = (parentUnion(f, f.rootId)?.children ?? [f.rootId]).filter((id) => show.has(id)).sort(birthOrder);
  // pack siblings side by side in birth order (each with their spouse)
  const idx = (u: Unit) => u.ids.map((id) => sibs.indexOf(id)).find((x) => x >= 0) ?? sibs.length;
  r0.sort((a, b) => idx(a) - idx(b));
  let cx = 0; r0.forEach((u) => { u.target = cx + u.w / 2; cx += u.w + CARD.gap; });
  place(r0);
  // ancestors: each parent couple above its child
  for (const g of gens.filter((x) => x < 0).sort((a, b) => b - a)) {
    const units = rowUnits(g);
    units.forEach((u) => {
      const kids = u.ids.flatMap((id) => unionsOf(f, id).flatMap((x) => x.children)).filter((c) => pos.has(c));
      u.target = kids.length ? kids.reduce((s, c) => s + pos.get(c)!, 0) / kids.length : 0;
    });
    place(units);
  }
  // descendants: children spread under their parents' center
  for (const g of gens.filter((x) => x > 0)) {
    const units = rowUnits(g);
    const groups = new Map<string, Unit[]>();
    units.forEach((u) => { const pu = u.ids.map((id) => parentUnion(f, id)).find((x) => x && (pos.has(x.a) || (x.b && pos.has(x.b)))); const k = pu?.id ?? '_'; groups.set(k, [...(groups.get(k) ?? []), u]); });
    for (const [k, us] of groups) {
      const pu = f.unions.find((x) => x.id === k);
      const center = pu ? [pu.a, pu.b].filter((x): x is string => !!x && pos.has(x)).reduce((s, x, _i, arr) => s + pos.get(x)! / arr.length, 0) : 0;
      us.sort((a, b) => birthOrder(a.ids.find((id) => pu?.children.includes(id)) ?? a.ids[0], b.ids.find((id) => pu?.children.includes(id)) ?? b.ids[0]));
      const total = us.reduce((s, u) => s + u.w, 0) + CARD.gap * (us.length - 1);
      let x = center - total / 2;
      us.forEach((u) => { u.target = x + u.w / 2; x += u.w + CARD.gap; });
    }
    place(units);
  }

  // coordinates
  const minX = Math.min(...[...pos.values()]) - CARD.w / 2 - 24;
  const minG = gens[0] ?? 0;
  const yOf = (g: number) => 24 + (g - minG) * (CARD.h + CARD.rowGap);
  const nodes = [...show].map((id) => ({ id, gen: gen.get(id)!, x: pos.get(id)! - CARD.w / 2 - minX, y: yOf(gen.get(id)!) }));
  const at = new Map(nodes.map((n) => [n.id, n]));
  const couples: LaidOut['couples'] = []; const links: string[] = [];
  for (const u of f.unions) {
    const a = at.get(u.a), b = u.b ? at.get(u.b) : undefined;
    if (a && b) { const [l, r] = a.x < b.x ? [a, b] : [b, a]; couples.push({ x1: l.x + CARD.w, x2: r.x, y: l.y + CARD.h / 2 }); }
    const kids = u.children.map((c) => at.get(c)).filter((n): n is NonNullable<typeof n> => !!n);
    const parents = [a, b].filter((n): n is NonNullable<typeof n> => !!n);
    if (!kids.length || !parents.length) continue;
    const px = parents.reduce((s, p) => s + p.x + CARD.w / 2, 0) / parents.length;
    const py = parents.length === 2 ? parents[0].y + CARD.h / 2 : parents[0].y + CARD.h;
    const busY = parents[0].y + CARD.h + CARD.rowGap / 2;
    links.push(`M${px},${py}V${busY}`);
    const xs = kids.map((k) => k.x + CARD.w / 2);
    links.push(`M${Math.min(px, ...xs)},${busY}H${Math.max(px, ...xs)}`);
    kids.forEach((k) => links.push(`M${k.x + CARD.w / 2},${busY}V${k.y}`));
  }
  const width = Math.max(...nodes.map((n) => n.x + CARD.w), 0) + 24;
  const height = Math.max(...nodes.map((n) => n.y + CARD.h), 0) + 24;
  return { nodes, couples, links, width, height };
}
/** Husband on the left, wife on the right (stable look across the tree). */
function orderCouple(f: Family, a: string, b: string) { const m = byId(f); return m.get(a)?.sex === 'f' && m.get(b)?.sex === 'm' ? [b, a] : [a, b]; }

/* ---------- editing (member portal) ---------- */
export type Relation = 'father' | 'mother' | 'spouse' | 'son' | 'daughter' | 'brother' | 'sister';
let seq = 0;
const newId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;
/** Add a relative of `of`. Returns a new Family (immutable). Parents/siblings create the parent couple if needed. */
export function addRelative(f: Family, of: string, rel: Relation, p: Omit<Person, 'id' | 'sex'>): Family {
  const sex: Sex = ['father', 'son', 'brother'].includes(rel) ? 'm' : rel === 'spouse' ? (byId(f).get(of)?.sex === 'm' ? 'f' : 'm') : 'f';
  const person: Person = { ...p, id: newId(), sex };
  const people = [...f.people, person]; let unions = f.unions.map((u) => ({ ...u, children: [...u.children] }));
  if (rel === 'spouse') unions.push({ id: newId(), a: of, b: person.id, children: [] });
  if (rel === 'son' || rel === 'daughter') {
    const u = unions.find((x) => x.a === of || x.b === of);
    if (u) u.children.push(person.id); else unions.push({ id: newId(), a: of, children: [person.id] });
  }
  if (rel === 'father' || rel === 'mother') {
    const u = unions.find((x) => x.children.includes(of));
    if (u && !u.b) u.b = person.id; else if (!u) unions.push({ id: newId(), a: person.id, children: [of] });
    else return f; // already has two parents
  }
  if (rel === 'brother' || rel === 'sister') {
    let u = unions.find((x) => x.children.includes(of));
    if (!u) { u = { id: newId(), a: '', children: [of] }; unions.push(u); }
    u.children.push(person.id);
    if (!u.a) { // unknown parents: keep siblings together under a placeholder couple-less union
      const ph: Person = { id: newId(), first: 'Parents', last: '', sex: 'm', placeholder: true };
      people.push(ph); u.a = ph.id;
    }
  }
  unions = unions.filter((u) => u.a);
  return { ...f, people, unions };
}
export function updatePerson(f: Family, id: string, patch: Partial<Person>): Family { return { ...f, people: f.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }; }
/** Remove a person you added (not yourself); their unions are tidied. */
export function removePerson(f: Family, id: string): Family {
  if (id === f.rootId) return f;
  const unions = f.unions.map((u) => ({ ...u, children: u.children.filter((c) => c !== id), b: u.b === id ? undefined : u.b, a: u.a === id ? (u.b ?? '') : u.a }))
    .map((u) => (u.a === u.b ? { ...u, b: undefined } : u)).filter((u) => u.a && (u.b || u.children.length));
  return { ...f, people: f.people.filter((p) => p.id !== id), unions };
}
export const RELATIONS: { id: Relation; label: string }[] = [
  { id: 'father', label: 'Father' }, { id: 'mother', label: 'Mother' }, { id: 'spouse', label: 'Spouse' },
  { id: 'son', label: 'Son' }, { id: 'daughter', label: 'Daughter' }, { id: 'brother', label: 'Brother' }, { id: 'sister', label: 'Sister' },
];
export const lifeYears = (p: Person) => (p.born || p.died ? `${p.born ? p.born.slice(0, 4) : '?'}${p.died ? `–${p.died.slice(0, 4)}` : ''}` : '');
