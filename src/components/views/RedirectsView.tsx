'use client';
/** O11.2 – Website › Redirects and short links: old addresses → new pages (exact or prefix with *). */
import { useState } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, ScopedForm } from '@/components/editor/bits';
import type { SiteConfig } from '@/lib/site-config/schema';
import { resolveRedirect } from '@/lib/site-config/redirects';

export function RedirectsView() {
  const [probe, setProbe] = useState('');
  return (
    <DocEditor<SiteConfig> storeKey="site-config" scope={['redirects']} title="Redirects and short links" preview={false}
      intro="Addresses printed on flyers, shared in WhatsApp or used by the previous website keep working: each one is sent to the page where it lives now. “/prayer-schedule-*” sends everything under that address.">
      {(doc) => (
        <div className="cv">
          <Panel title="Try an address" intro="Type an old address to see where visitors would land.">
            <input className="in" value={probe} onChange={(e) => setProbe(e.target.value)} placeholder="/week-schedule" aria-label="Address to test" />
            {probe.trim() && (() => { const r = resolveRedirect(doc.draft.redirects, probe.trim()); return <p className="sf-hint">{r ? <>→ <code>{r.to}</code> ({r.permanent ? 'permanent' : 'temporary'}{r.note ? ` · ${r.note}` : ''})</> : 'No redirect – the website shows its own page or “Page not found”.'}</p>; })()}
          </Panel>
          <Panel title="Rules" intro={`${doc.draft.redirects.length} rule${doc.draft.redirects.length === 1 ? '' : 's'}. Exact matches win; otherwise the longest * prefix. Use short links for QR codes: /give-champions → /masjid/champions/give.`}>
            <ScopedForm doc={doc} storeKey="site-config" only={['redirects']} labels={{ redirects: 'Redirect rules' }} />
          </Panel>
        </div>
      )}
    </DocEditor>
  );
}
