# Admin Dashboard – How to Use

## Run (demo)
1. `cd web && npm run dev` (http://localhost:3000)
2. `cd admin && npm install && npm run dev` (http://localhost:3001)
3. Edit anything → **Publish** → the website shows it on the next page load (files in `../.demo-store/`).

## Folder structure
```
admin/src/
  app/                    routes (thin) + api/store/[key] (demo store API)
  components/shell/       AdminShell (sidebar, top bar, Ctrl+K), nav.ts
  components/editor/      DocEditor (status, publish, history), LivePreview, bits (Panel, Tabs, SwitchRow)
  components/forms/       SchemaForm (form from zod contract)
  components/views/       one file per area (Overview, Theme, Home, Content, Appearance)
  lib/store/              registry (documents), server-store (files), use-doc (draft/publish hook)
  lib/schema-form/        zod introspection, labels, hints
  lib/appearance/         admin themes (presets.ts = server-safe, appearance.ts = client)
  lib/{site-config,content,theme}/  COPIED website contracts – run `npm run contracts:sync` after changing them in web/
  styles/                 glass.css (tokens), shell.css, forms.css, editors.css
tests/e2e/admin.spec.ts
```

## Add a new website setting
1. Add the field to the contract in `web/src/lib/...` (zod + mock) and use it in the website.
2. `npm run contracts:sync` in admin – the field appears in the matching form automatically.
3. Optional: friendly label/hint in `src/lib/schema-form/introspect.ts` (LABELS / HINTS).

## Faster review (2026-10-13)
- `npm run dev` now uses Turbopack (much faster first open of each screen). If anything looks odd, `npm run dev:webpack` is the old way.
- Fastest: `npm run fast` (build once, then pages open in milliseconds). Re-run it after code changes.
- Website demo forms are quick by default. To watch the step loaders slowly: set `NEXT_PUBLIC_DEMO_SPEED=real` in `web/.env.local`, or in the browser console `localStorage.setItem('isgh-demo-speed','real')`.
- Members: sidebar › Members. Open anyone to see if they can vote this year and why. Changes are demo-only (this browser); "Reset" = clear site data.

## Work queues (A4)
- Sidebar › Work queues. Pick a queue, pick a case, decide. Undo appears for 6 seconds. Photo ID first, then the application can go to the Board.
- Demo decisions live in this browser: clear site data to start over.
