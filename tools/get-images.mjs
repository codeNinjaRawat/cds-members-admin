#!/usr/bin/env node
/**
 * Fetch the admin's photos once into admin/public/img so the app works offline (see src/lib/images.ts).
 * Pexels photos, free license (https://www.pexels.com/license/). Run from the admin folder:  node tools/get-images.mjs
 * Skips files that already exist; pass --force to refresh. Uses only Node's built-in fetch – no packages.
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = await import('node:fs').then((fs) => fs.readFileSync(path.join(here, '..', 'src', 'lib', 'images.ts'), 'utf8'));
const entries = [...src.matchAll(/'([a-z-]+)': \{ id: (\d+)/g)].map((m) => ({ key: m[1], id: Number(m[2]) }));
const out = path.join(here, '..', 'public', 'img');
await mkdir(out, { recursive: true });
const force = process.argv.includes('--force');
let ok = 0, skipped = 0, failed = 0;
for (const { key, id } of entries) {
  const file = path.join(out, `${key}.jpg`);
  if (!force && (await stat(file).catch(() => null))) { skipped++; continue; }
  const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1800`;
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'ISGH-admin-images/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await writeFile(file, Buffer.from(await r.arrayBuffer()));
    ok++; console.log(`saved  ${key}.jpg`);
  } catch (e) { failed++; console.log(`FAILED ${key}.jpg – ${e.message}`); }
}
console.log(`\n${ok} saved, ${skipped} already there, ${failed} failed → ${out}`);
if (failed) process.exitCode = 1;
