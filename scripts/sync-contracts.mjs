#!/usr/bin/env node
/**
 * Copies the website's public CONTRACTS (zod schemas + default/mock content + theme tools) into the admin app,
 * so the admin validates exactly what the website accepts. Run after changing a contract in web/:
 *   npm run contracts:sync
 * Later (BE phase) these move to a shared package used by web, admin and BE.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../../web/src/lib');
const dst = path.resolve(here, '../src/lib');
/** Rewrite in place (no delete + recreate) so it also works in folders where deleting is not allowed. */
const copy = (from, to) => writeFileSync(to, readFileSync(from));
const FILES = [
  'site-config/schema.ts', 'site-config/mock-site-config.ts',
  'content/home.ts', 'content/pages.ts', 'content/membership.ts', 'content/giving.ts',
  'theme/theme-css.ts', 'theme/default-themes.json',
  'family/family.ts', 'family/demo-family.ts', 'join/form-def.ts', 'platform/seed.ts',
];
/** Shared UI pieces (same code in both apps). */
const UI = ['family/FamilyTree.tsx'];
for (const f of UI) {
  const from = path.resolve(here, '../../web/src/components', f), to = path.resolve(here, '../src/components', f);
  mkdirSync(path.dirname(to), { recursive: true }); copy(from, to); console.log('synced component', f);
}
for (const f of FILES) {
  mkdirSync(path.dirname(path.join(dst, f)), { recursive: true });
  copy(path.join(web, f), path.join(dst, f));
  console.log('synced', f);
}
