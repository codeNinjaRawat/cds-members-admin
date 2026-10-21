'use client';
/** O11.5 – Website health: what needs attention in the pages document (no server round-trip – computed from the draft). */
import type { Page } from '@/lib/content/pages';
import { liveReason } from '@/lib/content/page-rules';

const DAY = 86_400_000;
export function siteHealth(pages: Record<string, Page>, today = new Date().toISOString().slice(0, 10)) {
  const list = Object.values(pages);
  const stale = list.filter((p) => p.status === 'published' && (Date.parse(today) - Date.parse(p.updatedAt)) / DAY > 180);
  const noOwner = list.filter((p) => p.status === 'published' && !p.owner);
  const drafts = list.filter((p) => p.status === 'draft' || p.status === 'review');
  const scheduled = list.filter((p) => p.status === 'scheduled' || (p.status === 'published' && !!p.unpublishAt));
  const missingAlt: { page: Page; n: number }[] = list.map((p) => ({ page: p, n: p.blocks.reduce((a, b) => a + (b.type === 'image' && !b.image.alt ? 1 : b.type === 'gallery' ? b.images.filter((i) => !i.alt).length : b.type === 'cards' ? b.items.filter((c) => c.image && !c.image.alt).length : 0), 0) + (p.image && !p.image.alt ? 1 : 0) })).filter((x) => x.n > 0);
  const empty = list.filter((p) => p.blocks.length === 0);
  const noSeo = list.filter((p) => p.status === 'published' && !p.intro && !p.seo.description);
  return { stale, noOwner, drafts, scheduled, missingAlt, empty, noSeo, total: list.length };
}

export function SiteHealthPanel({ pages, onOpen }: { pages: Record<string, Page>; onOpen: (slug: string) => void }) {
  const h = siteHealth(pages);
  const Row = ({ label, items, hint }: { label: string; items: { slug: string; title: string; extra?: string }[]; hint: string }) => (
    <details className="health-row" open={items.length > 0 && items.length <= 5}>
      <summary><b>{items.length}</b> {label} <span className="sf-hint">{hint}</span></summary>
      {items.length > 0 && <ul>{items.map((i) => <li key={i.slug}><button type="button" className="linkish" onClick={() => onOpen(i.slug)}>{i.title}</button> <code>/{i.slug}</code>{i.extra && <span className="sf-hint"> · {i.extra}</span>}</li>)}</ul>}
    </details>
  );
  return (
    <div className="health">
      <p className="sf-hint">{h.total} pages. Click a page to open it.</p>
      <Row label="stale pages" hint="published, not updated in 6 months" items={h.stale.map((p) => ({ slug: p.slug, title: p.title, extra: `updated ${p.updatedAt}` }))} />
      <Row label="pages without an owner" hint="set an owner in Page settings so someone reviews it" items={h.noOwner.map((p) => ({ slug: p.slug, title: p.title }))} />
      <Row label="drafts / in review" hint="not visible to visitors" items={h.drafts.map((p) => ({ slug: p.slug, title: p.title, extra: liveReason(p) }))} />
      <Row label="scheduled or expiring" hint="go-live or take-down time set" items={h.scheduled.map((p) => ({ slug: p.slug, title: p.title, extra: liveReason(p) || `until ${p.unpublishAt}` }))} />
      <Row label="images without alt text" hint="required for accessibility" items={h.missingAlt.map((x) => ({ slug: x.page.slug, title: x.page.title, extra: `${x.n} image${x.n === 1 ? '' : 's'}` }))} />
      <Row label="pages without a description" hint="intro or SEO description – shown in search results and share previews" items={h.noSeo.map((p) => ({ slug: p.slug, title: p.title }))} />
      <Row label="empty pages" hint="no blocks yet" items={h.empty.map((p) => ({ slug: p.slug, title: p.title }))} />
    </div>
  );
}
