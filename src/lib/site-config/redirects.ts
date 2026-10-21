/** O11 – resolve an old address to its redirect (exact match first, then the longest prefix rule `…*`). */
export type Redirect = { from: string; to: string; permanent: boolean; note?: string };
export function resolveRedirect(rules: Redirect[], path: string): Redirect | null {
  const p = ('/' + path.replace(/^\/+/, '')).replace(/\/+$/, '') || '/';
  const exact = rules.find((r) => r.from.replace(/\/+$/, '') === p);
  if (exact) return exact;
  const prefix = rules.filter((r) => r.from.endsWith('*')).map((r) => ({ r, base: r.from.slice(0, -1).replace(/\/+$/, '') })).filter(({ base }) => p === base || p.startsWith(base + '/') || (base && p.startsWith(base)))
    .sort((a, b) => b.base.length - a.base.length)[0];
  if (!prefix) return null;
  if (prefix.r.to === prefix.r.from) return null; // never loop
  return prefix.r;
}
