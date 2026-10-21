/**
 * O1 – page rules shared by the website (and later the admin Page Composer): when a page is live, what its
 * scope and SEO are, and how masjid pages are addressed. Pure functions – no data access.
 */
import type { ImageRef } from './home';
import type { Block, Page, PageScope } from './pages';

/** Houston wall-clock "now" as `YYYY-MM-DDTHH:MM` (what admins type in publishAt/unpublishAt). */
export function houstonNow(d = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}
/** A date without a time means the start of that day. */
const norm = (s: string) => (s.length === 10 ? `${s}T00:00` : s);

/** True when visitors may see the page now (drafts, reviews, archived and out-of-window pages are hidden). */
export function isLive(page: Pick<Page, 'status' | 'publishAt' | 'unpublishAt'>, now = houstonNow()): boolean {
  if (page.status === 'archived' || page.status === 'draft' || page.status === 'review') return false;
  if (page.status === 'scheduled' && (!page.publishAt || norm(page.publishAt) > now)) return false;
  if (page.status === 'published' && page.publishAt && norm(page.publishAt) > now) return false;
  if (page.unpublishAt && norm(page.unpublishAt) <= now) return false;
  return true;
}

/** Why a page is not live – for the admin preview banner and the site-health report. */
export function liveReason(page: Pick<Page, 'status' | 'publishAt' | 'unpublishAt'>, now = houstonNow()): string {
  if (page.status === 'draft') return 'Draft – only admins with a preview link can see it.';
  if (page.status === 'review') return 'Waiting for review.';
  if (page.status === 'archived') return 'Archived.';
  if (page.unpublishAt && norm(page.unpublishAt) <= now) return `Taken down on ${page.unpublishAt.replace('T', ' at ')}.`;
  if (page.publishAt && norm(page.publishAt) > now) return `Goes live on ${page.publishAt.replace('T', ' at ')}.`;
  return '';
}

/** The masjid (center id) a page is about, or '' for an organization page. */
export const pageMasjid = (scope: PageScope | undefined): string => (scope?.kind === 'masjid' ? scope.center : '');

/** Which masjid a live block should show: the block's own choice, else the page's masjid, else '' (= all / the organization). */
export const blockMasjid = (b: { masjid?: string }, page: Pick<Page, 'scope'>): string => b.masjid || pageMasjid(page.scope);

/** Title / description / image used for the browser tab and share cards. */
export function effectiveSeo(page: Pick<Page, 'title' | 'intro' | 'image' | 'seo' | 'status'>): { title: string; description: string; image?: ImageRef; noIndex: boolean } {
  return {
    title: page.seo?.title || page.title,
    description: page.seo?.description || page.intro || '',
    image: page.seo?.image ?? page.image,
    noIndex: !!page.seo?.noIndex || page.status !== 'published',
  };
}

/** Column width of a block: its own setting, else the template's default. */
export function blockWidth(b: Block, template: Page['template']): 'narrow' | 'wide' | 'full' {
  const own = 'width' in b ? b.width : undefined;
  if (own) return own;
  if (b.type === 'cta' || b.type === 'verse') return template === 'article' ? 'narrow' : 'wide';
  return template === 'article' ? 'narrow' : 'wide';
}

/** Address of a masjid page: `masjid/<center-slug>/<page>` (routing arrives with O3; the key shape is fixed here). */
export const masjidPageSlug = (centerSlug: string, page: string) => (page ? `masjid/${centerSlug}/${page}` : `masjid/${centerSlug}`);

/** Only a few hosts may be embedded; anything else is shown as a link (no arbitrary iframes from the CMS). */
export function embedAllowed(url: string, hosts: readonly string[]): boolean {
  try { const u = new URL(url); return u.protocol === 'https:' && hosts.includes(u.hostname); } catch { return false; }
}
