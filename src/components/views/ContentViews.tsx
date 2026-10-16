'use client';
/** Website + settings screens built on DocEditor + SchemaForm (each edits part of one website contract). */
import { useMemo, useState } from 'react';
import type { SiteConfig } from '@/lib/site-config/schema';
import type { Giving } from '@/lib/content/giving';
import { ISGH_WILDAPRICOT_LEVELS, DEFAULT_LIFECYCLE, type MembershipSettings } from '@/lib/content/membership';
import { UseIsghLevels } from './CommunityViews';
import { RenewalPreview } from './RenewalPreview';
import type { Page } from '@/lib/content/pages';
import { PageSchema } from '@/lib/content/pages';
import { DocEditor, Modal, type DocApi } from '@/components/editor/DocEditor';
import { REGISTRY } from '@/lib/store/registry';
import { countIssues, Panel, ScopedForm, SwitchRow, Tabs } from '@/components/editor/bits';
import { SchemaForm } from '@/components/forms/SchemaForm';
import { emptyValue } from '@/lib/schema-form/introspect';

/* ---------- Menus and footer ---------- */
export function MenusView() {
  return (
    <DocEditor<SiteConfig> storeKey="site-config" scope={['nav', 'actions', 'footer']} title="Menus and footer"
      intro="The main menu (with dropdown descriptions), the Sign in and Join buttons, and everything in the footer.">
      {(doc) => (
        <Tabs label="Menus and footer" tabs={[
          { id: 'menu', label: 'Main menu', badge: countIssues(doc.issues, ['nav', 'actions']), render: () => <Panel intro="Up to 8 top items. An item with sub-items becomes a dropdown; descriptions show under each link."><ScopedForm doc={doc} storeKey="site-config" only={['nav', 'actions']} /></Panel> },
          { id: 'footer', label: 'Footer', badge: countIssues(doc.issues, ['footer']), render: () => <Panel intro="Columns, social links, office hours (drives the live “Open now” badge), newsletter text and the call-to-action card."><ScopedForm doc={doc} storeKey="site-config" only={['footer']} /></Panel> },
        ]} />
      )}
    </DocEditor>
  );
}

/* ---------- Announcement ---------- */
export function AnnouncementView() {
  return (
    <DocEditor<SiteConfig> storeKey="site-config" scope={['announcement', 'flags']} title="Announcement bar"
      intro="The thin bar at the top of every page. Give it start and end dates and it shows and hides by itself.">
      {(doc) => {
        const on = !!doc.draft.flags?.['site.announcement'];
        const a = doc.draft.announcement;
        const live = on && a && (!a.startsAt || new Date(a.startsAt) <= new Date()) && (!a.endsAt || new Date(a.endsAt) >= new Date());
        return (<>
          <Panel>
            <SwitchRow id="ann-on" label="Show the announcement bar" help="Turning this off hides it everywhere, without losing the text." checked={on}
              onChange={(v) => doc.setDraft({ ...doc.draft, flags: { ...doc.draft.flags, 'site.announcement': v } })} />
            <p className={`state-line ${live ? 'ok' : ''}`}>{live ? 'Visible on the website right now.' : !on ? 'Hidden (switched off).' : !a ? 'No announcement written yet.' : 'Hidden – outside its start/end dates.'}</p>
            {a && <div className={`ann-mock tone-${a.tone}`} aria-label="How it looks"><span>{a.text || 'Your announcement text'}</span>{a.link && <u>{a.link.label}</u>}</div>}
          </Panel>
          <Panel title="Text and timing"><ScopedForm doc={doc} storeKey="site-config" only={['announcement']} /></Panel>
        </>);
      }}
    </DocEditor>
  );
}

/* ---------- Organization ---------- */
export function OrganizationView() {
  return (
    <DocEditor<SiteConfig> storeKey="site-config" scope={['org']} title="Organization"
      intro="Name, address, phone and email used across the website, receipts and emails.">
      {(doc) => <Panel><ScopedForm doc={doc} storeKey="site-config" only={['org']} /></Panel>}
    </DocEditor>
  );
}

/* ---------- Feature switches ---------- */
const FLAG_HELP: Record<string, { label: string; help: string }> = {
  'site.announcement': { label: 'Announcement bar', help: 'The thin message bar at the top of every page.' },
  'cms.newsletter': { label: 'Newsletter sign-up', help: 'The email sign-up form in the footer.' },
  'site.themeToggle': { label: 'Visitors can switch light/dark', help: 'Shows the light/dark button in the header.' },
  'i18n.languages': { label: 'Other languages', help: 'Language switcher (Spanish, Urdu, Arabic) – translations are not ready yet.' },
};
export function FlagsView() {
  const [newKey, setNewKey] = useState('');
  return (
    <DocEditor<SiteConfig> storeKey="site-config" scope={['flags']} title="Feature switches"
      intro="Turn website features on or off without a developer. Membership and Giving have their own switches on their screens.">
      {(doc) => (
        <Panel>
          <ul className="flag-list">
            {Object.entries(doc.draft.flags ?? {}).map(([k, v]) => (
              <li key={k}>
                <SwitchRow id={`flag-${k}`} label={FLAG_HELP[k]?.label ?? k} help={`${FLAG_HELP[k]?.help ?? 'Custom switch.'} Key: ${k}`} checked={v}
                  onChange={(nv) => doc.setDraft({ ...doc.draft, flags: { ...doc.draft.flags, [k]: nv } })} />
              </li>
            ))}
          </ul>
          <div className="sf-rec-add">
            <input className="in" placeholder="New switch key, like site.ramadanBanner" value={newKey} aria-label="New switch key" onChange={(e) => setNewKey(e.target.value.replace(/[^a-zA-Z0-9.]/g, ''))} />
            <button type="button" className="sf-add" disabled={!newKey || newKey in (doc.draft.flags ?? {})} onClick={() => { doc.setDraft({ ...doc.draft, flags: { ...doc.draft.flags, [newKey]: false } }); setNewKey(''); }}>+ Add switch</button>
          </div>
          <p className="panel-intro">New switches do nothing until the website code reads them – add them together with a developer.</p>
        </Panel>
      )}
    </DocEditor>
  );
}

/* ---------- News ---------- */
export function NewsView() {
  return (
    <DocEditor<unknown[]> storeKey="news" title="News" intro="Short updates shown on the News page and the home page tile. Newest first.">
      {(doc) => <Panel><SchemaForm schema={REGISTRY.news.schema} value={doc.draft} onChange={(v) => doc.setDraft(v as unknown[])} issues={doc.issues} path={[]} /></Panel>}
    </DocEditor>
  );
}

/* ---------- Pages ---------- */
const SLUG = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
export function PagesView() {
  const [sel, setSel] = useState<string>('about');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [slug, setSlug] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  return (
    <DocEditor<Record<string, Page>> storeKey="pages" title="Pages" intro="Every content page on the website, built from blocks: headings, text, lists, callouts, FAQs, facts, buttons and contact lists." previewPaths={[`/${sel}`]}>
      {(doc) => {
        const pages = doc.draft;
        const slugs = Object.keys(pages).filter((s) => !q || `${s} ${pages[s].title}`.toLowerCase().includes(q.toLowerCase())).sort();
        const current = pages[sel] ? sel : Object.keys(pages)[0];
        return (
          <div className="pages-split">
            <Panel title="All pages">
              <input className="in" placeholder="Search pages" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pages" />
              <ul className="page-list">
                {slugs.map((s) => (
                  <li key={s}>
                    <button type="button" className={s === current ? 'active' : ''} aria-current={s === current || undefined} onClick={() => setSel(s)}>
                      <b>{pages[s].title}</b><span>/{s}{pages[s].status === 'draft' ? ' · draft' : ''}</span>
                      {countIssues(doc.issues, [s]) > 0 && <span className="sf-badge">{countIssues(doc.issues, [s])}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="sf-add" onClick={() => setAdding(true)}>+ New page</button>
            </Panel>
            {current && (
              <Panel title={pages[current].title} intro={<>Address: <code>/{current}</code> · <button type="button" className="linkish danger-text" onClick={() => setRemoving(current)}>Delete page</button></>}>
                <SchemaForm schema={PageSchema} value={pages[current]} path={[current]} issues={doc.issues}
                  onChange={(v) => doc.setDraft({ ...pages, [current]: v as Page })} />
              </Panel>
            )}
            {adding && (
              <Modal title="New page" onClose={() => setAdding(false)}>
                <label className="sf-label" htmlFor="new-slug">Web address</label>
                <p className="sf-hint">Lowercase words and dashes. Example: <code>youth-programs</code> → /youth-programs</p>
                <input id="new-slug" className="in" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, '-'))} />
                {slug && (!SLUG.test(slug) ? <p className="sf-err">Use lowercase letters, numbers and dashes.</p> : pages[slug] ? <p className="sf-err">A page with this address already exists.</p> : null)}
                <div className="modal-actions">
                  <button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
                  <button type="button" className="btn primary" disabled={!SLUG.test(slug) || !!pages[slug]} onClick={() => {
                    const p = { ...(emptyValue(PageSchema) as Page), slug, title: slug.split('/').pop()!.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()), status: 'draft' as const, updatedAt: new Date().toISOString().slice(0, 10), blocks: [{ type: 'paragraph' as const, text: 'Write the first paragraph here.' }] };
                    doc.setDraft({ ...pages, [slug]: p }); setSel(slug); setSlug(''); setAdding(false);
                  }}>Create page</button>
                </div>
              </Modal>
            )}
            {removing && (
              <Modal title={`Delete “${pages[removing]?.title}”?`} onClose={() => setRemoving(null)}>
                <p>Links to <code>/{removing}</code> will show “page not found” after you publish. You can bring it back from History.</p>
                <div className="modal-actions">
                  <button type="button" className="btn ghost" onClick={() => setRemoving(null)}>Keep page</button>
                  <button type="button" className="btn danger" onClick={() => { const n = { ...pages }; delete n[removing]; doc.setDraft(n); setRemoving(null); setSel(Object.keys(n)[0]); }}>Delete page</button>
                </div>
              </Modal>
            )}
          </div>
        );
      }}
    </DocEditor>
  );
}

/* ---------- Giving ---------- */
export function GivingView() {
  return (
    <DocEditor<Giving> storeKey="giving" title="Giving" intro="Quran verses and hadith, How we helped, Who still needs help, and giving settings.">
      {(doc) => (
        <Tabs label="Giving sections" tabs={[
          { id: 'verses', label: 'Verses and hadith', badge: countIssues(doc.issues, ['verses', 'hadith']), render: () => (<>
            <Panel tone="warn" intro="Copy Arabic and English exactly from the named translation, with the reference. Have the imam or education committee approve before publishing." />
            <Panel><ScopedForm doc={doc} storeKey="giving" only={['verses', 'hadith']} /></Panel>
          </>) },
          { id: 'impact', label: 'How we helped', badge: countIssues(doc.issues, ['impact', 'totals']), render: () => <Panel intro="Real programs need a source link. Personal stories need written consent or must be anonymized."><ScopedForm doc={doc} storeKey="giving" only={['totals', 'impact']} /></Panel> },
          { id: 'needs', label: 'Who still needs help', badge: countIssues(doc.issues, ['needs']), render: () => <NeedsPanel doc={doc} /> },
          { id: 'settings', label: 'Page text and switches', badge: countIssues(doc.issues, ['title', 'intro', 'reasons', 'flags', 'giveUrl', 'zakatUrl']), render: () => <Panel><ScopedForm doc={doc} storeKey="giving" only={['title', 'intro', 'reasons', 'flags', 'giveUrl', 'zakatUrl']} /></Panel> },
        ]} />
      )}
    </DocEditor>
  );
}
function NeedsPanel({ doc }: { doc: DocApi<Giving> }) {
  const s = useMemo(() => {
    const open = doc.draft.needs.filter((n) => n.status !== 'met');
    return { open: open.length, urgent: open.filter((n) => n.status === 'urgent').length, samples: doc.draft.needs.filter((n) => n.sample).length };
  }, [doc.draft.needs]);
  return (
    <Panel intro={<>{s.open} open · {s.urgent} urgent · {s.samples} sample cases {s.samples > 0 && doc.draft.flags.showSamples ? '(visible on the site – turn off “Show sample items” before launch)' : ''}</>}>
      <ScopedForm doc={doc} storeKey="giving" only={['needs']} />
    </Panel>
  );
}

/* ---------- Membership plans and rules ---------- */
export function MembershipView() {
  return (
    <DocEditor<MembershipSettings> storeKey="membership-settings" title="Plans and rules"
      intro="Dues, plans and the Bylaws rules the join form follows. Defaults come from the ISGH Constitution and Bylaws; change them when the Board decides.">
      {(doc) => (
        <Tabs label="Membership settings" tabs={[
          { id: 'plans', label: 'Plans and dues', badge: countIssues(doc.issues, ['plans', 'year']), render: () => <Panel intro="Bylaws minimums: Single $25, Family $40 per year. Multi-year discount up to 25%. Each plan can also have WildApricot-style options: a household size, fixed prices for 3 or 5 years, a renewal date and automatic renewal."><div className="row-actions"><UseIsghLevels onUse={() => doc.setDraft((d) => ({ ...d, plans: structuredClone(ISGH_WILDAPRICOT_LEVELS), lifecycle: d.lifecycle ?? DEFAULT_LIFECYCLE }))} /></div><ScopedForm doc={doc} storeKey="membership-settings" only={['year', 'plans']} /></Panel> },
          { id: 'renewals', label: 'Renewals and reminders', badge: countIssues(doc.issues, ['lifecycle']), render: () => <Panel intro="What happens before and after each renewal date: reminder emails, invoices, the grace period and what to do when someone does not renew. The emails themselves are in Communication › System emails."><ScopedForm doc={doc} storeKey="membership-settings" only={['lifecycle']} /><RenewalPreview settings={doc.draft} /></Panel> },
          { id: 'voting', label: 'Voting and area', badge: countIssues(doc.issues, ['recordDate', 'timezone', 'minVotingAge', 'minMemberAge', 'serviceArea']), render: () => <Panel intro="Bylaws Art. I §2–3: age 18+, own dues paid by June 30, lives in the service area."><ScopedForm doc={doc} storeKey="membership-settings" only={['recordDate', 'timezone', 'minVotingAge', 'minMemberAge', 'serviceArea']} /></Panel> },
          { id: 'join', label: 'Pledge and consents', badge: countIssues(doc.issues, ['commitments', 'pledge', 'consents', 'payerRelationships', 'otp']), render: () => <Panel intro="Changing the pledge or consent text? Also change its version, so we know who agreed to which text."><ScopedForm doc={doc} storeKey="membership-settings" only={['commitments', 'pledge', 'consents', 'payerRelationships', 'otp']} /></Panel> },
          { id: 'switches', label: 'Switches', badge: countIssues(doc.issues, ['flags']), render: () => <Panel><ScopedForm doc={doc} storeKey="membership-settings" only={['flags']} /></Panel> },
        ]} />
      )}
    </DocEditor>
  );
}
