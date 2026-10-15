# ISGH Admin – "working on glass"

Controls the public website: theme and branding, home page, menus and footer, announcement bar, pages,
news, giving (verses, impact, needs), membership plans and rules, organization details and feature switches.
Each admin can pick their own look (theme, light/dark, glass level, background, spacing, text size).

## Run it (demo – no BE yet)
```bash
cd admin
npm install
npm run dev          # http://localhost:3001
```
Run the website at the same time (`cd web && npm run dev`, http://localhost:3000) for the live preview.

**Publish** writes JSON files to `../.demo-store/` (next to `web/` and `admin/`). The website reads that folder
in mock mode, so a published change shows on the next page load. Delete the folder (or use History › Reset)
to go back to the built-in content.

## How it works
| Piece | File |
|---|---|
| Documents the admin controls (same zod contracts as the website) | `src/lib/store/registry.ts` |
| Demo store API (GET / PUT publish / DELETE reset, history, conflict check, same-origin) | `src/app/api/store/[key]/route.ts`, `src/lib/store/server-store.ts` |
| Draft, autosave, validation, publish hook | `src/lib/store/use-doc.ts` |
| Form built from the contract (text, money, colors, images, lists, blocks) | `src/components/forms/SchemaForm.tsx`, `src/lib/schema-form/introspect.ts` |
| Page frame (status, publish dialog, history, preview) | `src/components/editor/DocEditor.tsx`, `LivePreview.tsx` |
| Glass design system + admin themes | `src/styles/glass.css`, `src/lib/appearance/*` |
| Copied website contracts | `src/lib/{site-config,content,theme}` – refresh with `npm run contracts:sync` |

## Tests
`tests/e2e/admin.spec.ts` (Playwright, 13 journeys). With both apps running: `npx playwright test`.
