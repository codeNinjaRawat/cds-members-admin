'use client';
/**
 * A1 app shell: glass sidebar (groups, active item, planned modules), top bar (search / Ctrl+K command palette,
 * DEMO environment pill, open website, light/dark, user), mobile drawer. Applies the admin's own appearance.
 */
import { Photo, useArtUrl } from './Photo';
import { SECTION_ART, WALL_PHOTOS } from '@/lib/images';
import { ViewingChip } from './MasjidPicker';
import { IdleLock } from './IdleLock';
import { useAccess, setActing, setDashboard } from '@/lib/access/use-access';
import { LIVE, signOut } from '@/lib/live/live';
import { NOTICE_EVENT, loadOrgLabels, ORG_TZ } from '@/lib/members/members';
import { assignmentsOf, permissionForPath, PERMISSIONS, whereOf } from '@/lib/access/access';
import { ZONES, type ZoneId } from '@/lib/members/members';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { applyAppearance, readAppearance, useAppearance } from '@/lib/appearance/appearance';
import { useHelpdeskBadge, useMyTasksBadge } from '@/lib/work/work-store';
import { useInboxBadge } from '@/lib/team/messages';
import { iconPath, NAV, NAV_TREE, ORG_ONLY, type IconName, type NavItem, type NavNode } from './nav';
import { openCounts, useQueueState } from '@/components/views/QueuesView';
import { moduleForPath, useOrg, type Me } from '@/lib/platform/use-org';
import { MODULE_INFO, type Module } from '@/lib/platform/platform';

export const SITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'http://localhost:3000';

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="ico"><path d={iconPath(name)} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [a, update] = useAppearance();
  const { me, site, can } = useOrg();
  const mod = moduleForPath(pathname);
  // the photo for this part of the admin (sidebar group → SECTION_ART); dashboards carry their own band
  const group = pathname === '/' ? 'Overview' : pathname.startsWith('/families') ? 'Family trees' : (NAV_TREE.find((n) => n.href && n.href !== '/' && pathname.startsWith(n.href.split('?')[0])) ?? NAV_TREE.find((n) => n.children?.some((c) => c.href !== '#' && pathname.split('?')[0] === c.href.split('?')[0] || (c.href !== '#' && c.href.split('?')[0] !== '/' && pathname.startsWith(c.href.split('?')[0] + '/')))))?.label ?? '';
  const artKey = SECTION_ART[group] ?? null;
  const artUrl = useArtUrl(artKey);
  const wallKey = WALL_PHOTOS[a.wallpaper] ?? null;
  const closed = me && (me.org.status === 'suspended' || me.org.status === 'cancelled');
  const access = useAccess();
  const canHref = (href: string) => can(moduleForPath(href)) && (() => { const p = permissionForPath(href); return !p || access.can(p); })()
    && (href !== '/team' || !!access.role?.centerScoped)          // a masjid's own working body – organization admins use Masjid working bodies
    && (href !== '/masjids' || !access.role?.centerScoped)
    && (!ORG_ONLY.has(href) || (!access.role?.centerScoped && !access.role?.zoneScoped));
  // icon rail on wide screens: one icon per section, its groups fly out (the full tree on phones and tablets)
  const [wide, setWide] = useState(true);
  useEffect(() => { const m = window.matchMedia('(min-width: 1081px)'); const on = () => setWide(m.matches); on(); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  const work = a.work === 'on';
  const rail = (a.nav === 'rail' || work) && wide;
  const [search, setSearch] = useState('');
  useEffect(() => { const read = () => setSearch(window.location.search); read(); window.addEventListener(TAB_EVENT, read); window.addEventListener('popstate', read); return () => { window.removeEventListener(TAB_EVENT, read); window.removeEventListener('popstate', read); }; }, [pathname]);
  const need = permissionForPath(pathname + search);
  const blocked = need && !access.can(need);

  useEffect(() => { applyAppearance(readAppearance()); }, []);
  // this organization's zone and plan names (the screens read them at render; a change redraws the page once)
  const [labels, setLabels] = useState(0);
  useEffect(() => { void loadOrgLabels().then((changed) => { if (changed) setLabels((n) => n + 1); }); }, []);
  // M4 DEMO: the website's sign-in opens the chosen dashboard as /?as=<person>&dash=<role index> (live: the session).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const as = q.get('as'); const dash = Number(q.get('dash') ?? 0);
    if (LIVE) return;   // live: the session decides (the sign-in page picks the dashboard)
    if (!as || !/^[a-z0-9-]{2,40}$/.test(as) || !Number.isInteger(dash) || dash < 0 || dash > 10) return;
    setActing(as); setDashboard(dash, 'Opened from sign-in');
    q.delete('as'); q.delete('dash');
    window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}`);
  }, []);
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
      if (e.key === 'Escape' && !(e.target as HTMLElement | null)?.closest('dialog') && readAppearance().work === 'on') update({ work: 'off' });   // Esc leaves work mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); update({ work: readAppearance().work === 'on' ? 'off' : 'on' }); }
    };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, []);

  if (pathname === '/sign-in') return <>{children}</>;   // the sign-in page has no shell (nobody is signed in yet)
  return (
    <>
    <div className="wall" aria-hidden="true">{wallKey && <Photo k={wallKey} className="wall-photo" priority />}</div>
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <IdleLock />
      <aside className={`side glass-nav${drawer ? ' open' : ''}`} aria-label="Admin sections">
        <div className="side-brand">
          <img src="/brand/logo-mark.svg" alt="" width={34} height={34} className="mark-light" />
          <img src="/brand/logo-mark-dark.svg" alt="" width={34} height={34} className="mark-dark" />
          <div><b>{me ? `${me.org.shortName} Admin` : 'ISGH Admin'}</b><span>{me?.org.name ?? 'Islamic Society of Greater Houston'}</span></div>
        </div>
        <SideTree pathname={pathname} can={canHref} rail={rail} />
        {access.can('settings.manage') && <div className="side-card">
          <svg width="22" height="22" aria-hidden="true" viewBox="0 0 100 100"><g fill="currentColor"><rect x="22" y="22" width="56" height="56" /><rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)" /></g></svg>
          <b>Renewal season</b>
          <p>2027 renewals open November 1. Check dues, dates and reminder text before members start paying.</p>
          <Link href="/membership" className="btn sm side-card-btn">Review plans and dates</Link>
        </div>}
        <p className="side-foot">Demo mode – changes publish to a local folder, not the live site.</p>
      </aside>
      {drawer && <button className="scrim" aria-label="Close menu" onClick={() => setDrawer(false)} />}

      <div className="main-col">
        <header className="top glass-nav">
          <button className="icon-btn menu-btn" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Icon name="menu" /></button>
          <button className="search" onClick={() => setPalette(true)} aria-keyshortcuts="Control+K">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" /></svg>
            <span>Find a setting or page</span><kbd>Ctrl K</kbd>
          </button>
          <ViewingChip />
          {LIVE
            ? <span className="env live" title="Connected to the API – changes are saved to the database">Live</span>
            : <span className="env" title="Changes go to the local demo store (../.demo-store). The real site is not touched.">Demo</span>}
          <a className="top-link" href={site} target="_blank" rel="noopener noreferrer">Open website<span className="sr-only"> (opens in a new tab)</span></a>
          <button className={`icon-btn work-btn${work ? ' on' : ''}`} aria-label={work ? 'Leave work mode (Esc)' : 'Work mode – full page (Ctrl+Shift+F)'} aria-pressed={work} title={work ? 'Leave work mode (Esc)' : 'Work mode: the whole screen for the page (Ctrl+Shift+F)'} onClick={() => update({ work: work ? 'off' : 'on' })}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">{work ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" strokeWidth="1.8" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" />}</svg>
          </button>
          <button className="icon-btn" aria-label="Switch light or dark mode"
            onClick={() => update({ mode: document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark' })}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
          <Link href="/appearance" className="me" aria-label={`My appearance – ${a.preset}`}><span className="avatar">{(access.me?.name ?? 'Admin').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span><span className="me-name">{access.me?.name ?? 'Admin'}<small>{access.role?.name ?? ''}</small></span></Link>
          {access.person && (assignmentsOf(access.person).length > 1 || access.person.memberId) && (
            <label className="dash-switch"><span className="sr-only">Dashboard</span>
              <select className="in pill-select" aria-label="Dashboard" value={String(access.dashIndex)} onChange={(e) => {
                if (e.target.value === 'member') { window.open(`${site}/portal`, '_blank', 'noopener'); return; }
                const i = Number(e.target.value); const x = assignmentsOf(access.person!)[i];
                setDashboard(i, `${access.doc.roles.find((r) => r.id === x.roleId)?.name ?? x.roleId} – ${whereOf(access.doc, x, (z) => `${ZONES[z as ZoneId] ?? z} Zone`)}`);
              }}>
                {assignmentsOf(access.person).map((x, i) => <option key={i} value={i}>{access.doc.roles.find((r) => r.id === x.roleId)?.name ?? x.roleId} · {whereOf(access.doc, x, (z) => `${ZONES[z as ZoneId] ?? z} Zone`)}</option>)}
                {access.person.memberId && <option value="member">My membership ↗</option>}
              </select></label>
          )}
          {LIVE ? (
            <span className="acting signed-in"><span className="sr-only">Signed in as</span>{access.me?.name ?? ''} <button type="button" className="btn sm ghost" onClick={() => void signOut()}>Sign out</button></span>
          ) : <label className="acting"><span className="sr-only">Acting as (demo)</span>
            <select className="in pill-select" aria-label="Acting as (demo)" value={access.me?.id ?? ''} onChange={(e) => { const x = access.doc.admins.find((y) => y.id === e.target.value); setActing(e.target.value, x?.name); }}>
              {access.doc.admins.filter((x) => x.status === 'active').map((x) => <option key={x.id} value={x.id}>{x.name} – {access.doc.roles.find((r) => r.id === x.roleId)?.name ?? x.roleId}</option>)}
            </select></label>}
        </header>
        {LIVE && <LiveNotices />}
        <main id="main" tabIndex={-1} data-art={artKey ?? undefined} style={artUrl ? ({ '--sec-img': `url("${artUrl}")` } as CSSProperties) : undefined}>
          {me && !work && <PlatformBanners me={me} pathname={pathname} />}
          {artKey && pathname !== '/' && !blocked && !closed && !work && <div className="sec-art" aria-hidden="true"><Photo k={artKey} priority /><span className="sec-art-name">{group}</span></div>}
          {closed ? <ClosedPanel me={me!} /> : mod && !can(mod) ? <ModuleOff label={MODULE_INFO[mod].label} plan={me!.org.plan} email={me!.supportEmail} />
            : blocked ? <div className="page"><section className="panel glass-pane no-access" role="alert"><h1 className="panel-h">Not part of your role</h1><p>{access.me?.name} ({access.role?.name}) cannot open this page – it needs “{PERMISSIONS[need!].label}”. Ask an Owner or Admin if you need it.</p><Link className="btn" href="/">Back to the overview</Link></section></div>
            : <div key={labels} className="labels-root" style={{ display: "contents" }}>{children}</div>}
        </main>
      </div>
      {palette && <CommandPalette site={site} can={can} onClose={() => setPalette(false)} toggleMode={() => update({ mode: document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark' })} />}
    </div>
    </>
  );
}

/* ---------- sidebar tree with submenus ----------
   Full sidebar: accordion (the section with the current page opens by itself; your open/closed choice is remembered).
   Icon rail: each section shows its submenu as a floating glass panel on hover or keyboard focus. */
const OPEN_KEY = 'isgh-admin-nav-open';
export const TAB_EVENT = 'isgh:tab';
const currentQuery = () => (typeof window === 'undefined' ? '' : window.location.search);

function SideTree({ pathname, can, rail = false }: { pathname: string; can: (href: string) => boolean; rail?: boolean }) {
  const [query, setQuery] = useState('');
  const qc = openCounts(useQueueState());
  const openTickets = useHelpdeskBadge();
  const myTasks = useMyTasksBadge();
  const inbox = useInboxBadge(useAccess().me?.id ?? (LIVE ? '' : 'owner'));
  const counts: Record<string, number> = { 'q:all': Object.values(qc).reduce((a, b) => a + b, 0) + openTickets, 'q:tickets': openTickets, 'q:tasks': myTasks, 'q:inbox': inbox, ...Object.fromEntries(Object.entries(qc).map(([k, v]) => [`q:${k}`, v])) };
  const [open, setOpen] = useState<string[]>([]);
  useEffect(() => {
    const read = () => setQuery(currentQuery());
    read(); window.addEventListener(TAB_EVENT, read); window.addEventListener('popstate', read);
    return () => { window.removeEventListener(TAB_EVENT, read); window.removeEventListener('popstate', read); };
  }, [pathname]);
  const isActive = (href?: string) => {
    if (!href || href === '#') return false;
    // sub-links may point at a tab (?tab=) or a saved view (?view=) of a screen
    const [base, q] = href.split('?');
    // a link with ?tab= / ?view= belongs to that exact screen; a plain link also covers its sub-pages (e.g. /members/HOU-…)
    const onPage = base === '/' ? pathname === '/' : q ? pathname === base : pathname === base || pathname.startsWith(base + '/');
    // a more specific link wins (e.g. /members/overview is "Dashboard", not "All members")
    if (onPage && !q && pathname !== base && NAV_TREE.flatMap((n) => [n, ...(n.children ?? [])]).some((c) => c.href && c.href !== href && c.href.split('?')[0].length > base.length && (pathname === c.href.split('?')[0] || pathname.startsWith(c.href.split('?')[0] + '/')))) return false;
    const siblings = NAV_TREE.flatMap((n) => n.children ?? []).filter((c) => c.href === base || c.href.startsWith(base + '?'));
    if (!onPage || siblings.length < 2) return onPage;
    const [key, want] = q ? [...new URLSearchParams(q).entries()][0] : [siblings.find((c) => c.href.includes('?'))!.href.split('?')[1].split('=')[0], null];
    const now = pathname === base ? new URLSearchParams(query).get(key) : null;
    if (want == null) return !now || !siblings.some((c) => c.href.endsWith(`${key}=${now}`));
    return now ? now === want : siblings[0]?.href === href;
  };
  const activeParent = NAV_TREE.find((n) => n.children?.some((c) => isActive(c.href)))?.label;
  useEffect(() => {
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(OPEN_KEY) || '[]'); } catch { /* */ }
    setOpen(Array.from(new Set([...saved, ...(activeParent ? [activeParent] : [])])));
  }, [activeParent]);
  const toggle = (label: string) => setOpen((o) => {
    const n = o.includes(label) ? o.filter((x) => x !== label) : [...o, label];
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(n)); } catch { /* */ }
    return n;
  });
  return (
    <nav className="side-tree">
      <ul className="tree">
        {rail ? <RailSections can={can} isActive={isActive} counts={counts} pathname={pathname} /> : (() => {
          // each node belongs to the last section named above it; a heading shows once per section that has something visible
          let sec = ''; let shown = '';
          return NAV_TREE.map((n) => { sec = n.section ?? sec; return { ...n, sec, children: n.children?.filter((c) => c.soon !== undefined || can(c.href)) }; })
            .filter((n) => (n.href ? can(n.href) : (n.children?.some((c) => !c.soon) || n.soon !== undefined) && (n.children?.length ?? 0) > 0))
            .flatMap((n) => {
              const head = n.sec && n.sec !== shown ? [<li key={`sec-${n.sec}`} className="side-sec" role="presentation"><span>{n.sec}</span></li>] : [];
              shown = n.sec || shown;
              return [...head, <TreeNode key={n.label} n={n} counts={counts} isActive={isActive} open={open.includes(n.label)} onToggle={() => toggle(n.label)} parentActive={activeParent === n.label} pathname={pathname} />];
            });
        })()}
      </ul>
    </nav>
  );
}

const SECTION_ICON: Record<string, IconName> = { People: 'users', Masjids: 'building', Money: 'card', Governance: 'ballot', Website: 'layout', Admin: 'shield' };
/** Icon rail: Overview + one icon per section; hovering or focusing a section shows its groups and their pages. */
function RailSections({ can, isActive, counts, pathname }: { can: (href: string) => boolean; isActive: (h?: string) => boolean; counts: Record<string, number>; pathname: string }) {
  let sec = '';
  const nodes = NAV_TREE.map((n) => { sec = n.section ?? sec; return { ...n, sec, children: n.children?.filter((c) => !c.soon && can(c.href)) }; })
    .filter((n) => (n.href ? can(n.href) : (n.children?.length ?? 0) > 0));
  const top = nodes.filter((n) => !n.sec);
  const sections = Array.from(new Set(nodes.filter((n) => n.sec).map((n) => n.sec)));
  return (<>
    {top.map((n) => <TreeNode key={n.label} n={n} counts={counts} isActive={isActive} open={false} onToggle={() => undefined} parentActive={false} pathname={pathname} />)}
    {sections.map((name, k) => {
      const groups = nodes.filter((n) => n.sec === name);
      const current = groups.some((g) => (g.href ? isActive(g.href) : g.children!.some((c) => isActive(c.href))));
      const id = `sub-${name.toLowerCase()}`;
      const nb = groups.reduce((a, g) => a + (g.countKey ? counts[g.countKey] ?? 0 : Number(g.badge ?? 0)), 0);
      return (
        <li key={name} className={`node has-sub rail-sec${current ? ' is-current' : ''}${k >= sections.length / 2 ? ' up' : ''}`}>
          <button type="button" className={`side-link parent${current ? ' is-current' : ''}`} aria-label={nb ? `${name}, ${nb} need attention` : name} aria-expanded="false" aria-controls={id}>
            <Icon name={SECTION_ICON[name] ?? 'menu'} /><span className="lbl">{name}</span>{nb ? <b className="side-badge">{nb}</b> : null}
          </button>
          <ul className="sub glass-float rail-fly" id={id}>
            <li className="sub-title" aria-hidden="true">{name}</li>
            {groups.map((g) => g.href
              ? <li key={g.label}><SubLink c={{ label: g.label, href: g.href, icon: g.icon }} active={isActive(g.href)} pathname={pathname} /></li>
              : <li key={g.label} className="rail-group"><span className="rail-group-h">{g.label}</span><ul>{g.children!.map((c) => <li key={c.label}><SubLink c={c.countKey ? { ...c, badge: counts[c.countKey] ? String(counts[c.countKey]) : undefined } : c} active={isActive(c.href)} pathname={pathname} /></li>)}</ul></li>)}
          </ul>
        </li>
      );
    })}
  </>);
}

function TreeNode({ n, counts, isActive, open, onToggle, parentActive, pathname }: { n: NavNode; counts: Record<string, number>; isActive: (h?: string) => boolean; open: boolean; onToggle: () => void; parentActive: boolean; pathname: string }) {
  const id = `sub-${n.label.toLowerCase().replace(/\W+/g, '-')}`;
  const nb = n.countKey ? (counts[n.countKey] ? String(counts[n.countKey]) : undefined) : n.badge;
  const badge = nb ? <b className="side-badge" aria-label={`${nb} need attention`}>{nb}</b> : null;
  if (!n.children) {
    const active = isActive(n.href);
    return <li className="node"><Link className={`side-link${active ? ' active' : ''}`} href={n.href!} aria-current={active ? 'page' : undefined}><Icon name={n.icon} /><span className="lbl">{n.label}</span>{badge}</Link></li>;
  }
  return (
    <li className={`node has-sub${open ? ' open' : ''}${parentActive ? ' is-current' : ''}`}>
      {n.home ? (
        // D2 – the group opens its own page (Members → Overview); the chevron alone folds the list
        <span className={`side-link parent with-home${parentActive ? ' is-current' : ''}`}>
          <Link className="home-link" href={n.home} aria-label={nb ? `${n.label}, ${nb} need attention` : n.label} aria-current={isActive(n.home) ? 'page' : undefined} onClick={() => { if (!open) onToggle(); }}><Icon name={n.icon} /><span className="lbl">{n.label}</span>{badge}</Link>
          <button type="button" className="chev-btn" aria-label={`${open ? 'Hide' : 'Show'} ${n.label} pages`} aria-expanded={open} aria-controls={id} onClick={onToggle}><svg className="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg></button>
        </span>
      ) : (
      <button type="button" className={`side-link parent${parentActive ? ' is-current' : ''}`} aria-label={nb ? `${n.label}, ${nb} need attention` : n.label} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <Icon name={n.icon} /><span className="lbl">{n.label}</span>{badge}
        <svg className="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
      </button>)}
      <ul className="sub glass-float" id={id}>
        <li className="sub-title" aria-hidden="true">{n.label}</li>
        {n.children.map((c) => <li key={c.label}><SubLink c={c.countKey ? { ...c, badge: counts[c.countKey] ? String(counts[c.countKey]) : undefined } : c} active={isActive(c.href)} pathname={pathname} /></li>)}
      </ul>
    </li>
  );
}

function SubLink({ c, active, pathname }: { c: NavItem; active: boolean; pathname: string }) {
  const badge = c.badge ? <b className="side-badge">{c.badge}</b> : null;
  if (c.soon) return <span className="sub-link soon" aria-disabled="true"><span className="lbl">{c.label}</span>{badge}<em>{c.soon}</em></span>;
  const [base] = c.href.split('?');
  const plain = !c.href.includes('?') && base === pathname; // e.g. "All members" while a view is open
  const sameScreenTab = c.href.includes('?') && base === pathname; // same screen, other tab/view: no reload
  return (
    <Link className={`sub-link${active ? ' active' : ''}`} href={c.href} aria-current={active ? 'page' : undefined}
      onClick={(e) => { if (sameScreenTab || plain) { e.preventDefault(); window.history.pushState(null, '', c.href); window.dispatchEvent(new Event(TAB_EVENT)); } }}>
      <span className="lbl">{c.label}</span>{badge}
    </Link>
  );
}

/* ---------- Ctrl+K command palette ---------- */
function CommandPalette({ onClose, toggleMode, site, can }: { onClose: () => void; toggleMode: () => void; site: string; can: (m?: Module) => boolean }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => {
    const pages = NAV.flatMap((g) => g.items.filter((x) => !x.soon && can(moduleForPath(x.href))).map((x) => ({ label: x.label === 'Dashboard' ? `${g.label} dashboard` : x.label, hint: g.label, icon: x.icon, keywords: x.keywords ?? '', run: () => { window.location.assign(x.href); } })));
    const actions = [
      { label: 'Switch light / dark', hint: 'Action', icon: 'brush' as IconName, keywords: 'theme mode night', run: toggleMode },
      { label: 'Open the website', hint: 'Action', icon: 'home' as IconName, keywords: 'site preview', run: () => window.open(site, '_blank', 'noopener') },
    ];
    const s = q.trim().toLowerCase();
    // best match first: the page name, then its section, then its keywords
    const rank = (x: { label: string; hint: string; keywords: string }) => (x.label.toLowerCase().startsWith(s) ? 0 : x.label.toLowerCase().includes(s) ? 1 : x.hint.toLowerCase().includes(s) ? 2 : 3);
    return [...pages, ...actions].filter((x) => !s || `${x.label} ${x.keywords} ${x.hint}`.toLowerCase().includes(s)).map((x, n) => ({ x, n })).sort((a, b) => (s ? rank(a.x) - rank(b.x) : 0) || a.n - b.n).map(({ x }) => x);
  }, [q, toggleMode, site, can]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setI(0); }, [q]);
  const go = (n: number) => { const it = items[n]; if (it) { onClose(); it.run(); } };
  return (
    <div className="cmdk-wrap" role="dialog" aria-modal="true" aria-label="Find a setting or page" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        else if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, items.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); go(i); }
      }}>
      <div className="cmdk glass-float">
        <input ref={input} className="cmdk-in" aria-label="Find a setting or page" placeholder="Type what you want to change, like logo, zakat or June 30…" value={q} onChange={(e) => setQ(e.target.value)}
          role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={items[i] ? `cmdk-${i}` : undefined} />
        <ul id="cmdk-list" role="listbox">
          {items.map((it, n) => (
            <li key={`${it.hint}-${it.label}`} id={`cmdk-${n}`} role="option" aria-selected={n === i} onMouseEnter={() => setI(n)} onClick={() => go(n)}>
              <Icon name={it.icon} /><span>{it.label}</span><small>{it.hint}</small>
            </li>
          ))}
          {!items.length && <li className="empty">Nothing matches “{q}”. Try a simpler word.</li>}
        </ul>
        <p className="cmdk-foot"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</p>
      </div>
    </div>
  );
}

/* ---------- SaaS: messages from the platform ---------- */
const DISMISS_KEY = 'isgh-platform-dismissed';
function PlatformBanners({ me, pathname }: { me: Me; pathname: string }) {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => { try { setHidden(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch { /* private mode */ } }, []);
  const hide = (id: string) => { const n = [...hidden, id]; setHidden(n); try { localStorage.setItem(DISMISS_KEY, JSON.stringify(n)); } catch { /* */ } };
  const s = me.support; const o = me.org;
  return (
    <div className="pf-banners">
      {s && <div className="pf-banner warn" role="status"><span><b>Support sign-in by {s.by}</b> ({s.mode === 'full' ? 'full access' : 'read only'}) until {new Date(s.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ORG_TZ })}. Reason: “{s.reason}”</span></div>}
      {o.status === 'past_due' && <div className="pf-banner bad" role="alert"><span><b>Your last payment to {me.productName} failed.</b> Update the card in billing to avoid a pause. Questions: <a href={`mailto:${me.supportEmail}`}>{me.supportEmail}</a></span></div>}
      {o.status === 'trial' && o.trialDaysLeft !== null && o.trialDaysLeft <= 14 && <div className="pf-banner info" role="status"><span><b>{o.trialDaysLeft === 0 ? 'Your free trial ends today.' : `${o.trialDaysLeft} day${o.trialDaysLeft === 1 ? '' : 's'} left in your free trial`}</b> ({o.plan} plan).</span></div>}
      {o.slug !== 'isgh' && (pathname === '/' || /^\/(members|queues|families)/.test(pathname)) && <div className="pf-banner info" role="note"><span><b>Sample records.</b> This screen shows demo members until {o.shortName}’s own member data is connected (BE phase).</span></div>}
      {me.announcements.filter((x) => !hidden.includes(x.id)).map((x) => (
        <div key={x.id} className={`pf-banner ${x.tone === 'warning' ? 'warn' : x.tone === 'success' ? 'good' : 'info'}`} role="status">
          <span><b>{x.title}</b>{x.body && ` ${x.body}`}</span>
          <button type="button" className="icon-btn sm" aria-label={`Hide “${x.title}”`} onClick={() => hide(x.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
function ClosedPanel({ me }: { me: Me }) {
  return (
    <div className="page"><section className="panel glass-pane pf-closed">
      <h1>{me.org.status === 'suspended' ? `${me.org.shortName} admin is paused` : `${me.org.shortName} admin is closed`}</h1>
      {me.org.suspendedReason && <p>{me.org.suspendedReason}</p>}
      <p>Nothing has been deleted. To continue, contact <a href={`mailto:${me.supportEmail}`}>{me.supportEmail}</a>.</p>
    </section></div>
  );
}
function ModuleOff({ label, plan, email }: { label: string; plan: string; email: string }) {
  return (
    <div className="page"><section className="panel glass-pane pf-closed">
      <h1>{label} is not part of your plan</h1>
      <p>Your organization is on the <b>{plan}</b> plan. To add {label.toLowerCase()}, ask <a href={`mailto:${email}`}>{email}</a> about a bigger plan or an add-on.</p>
      <Link className="btn" href="/">Back to the overview</Link>
    </section></div>
  );
}

/** Live mode: what the server said about a save (refused, not reachable, done) – a short message at the bottom. */
function LiveNotices() {
  const [n, setN] = useState<{ text: string; tone: 'ok' | 'error'; at: number } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setN({ ...(e as CustomEvent<{ text: string; tone: 'ok' | 'error' }>).detail, at: Date.now() });
    window.addEventListener(NOTICE_EVENT, on); return () => window.removeEventListener(NOTICE_EVENT, on);
  }, []);
  useEffect(() => { if (!n) return; const t = window.setTimeout(() => setN(null), n.tone === 'error' ? 9000 : 4000); return () => window.clearTimeout(t); }, [n]);
  if (!n) return null;
  return (
    <div className={`toast live-notice ${n.tone === 'error' ? 'toast-error' : ''}`} role={n.tone === 'error' ? 'alert' : 'status'} style={{ position: 'fixed', insetInline: 16, bottom: 16, zIndex: 80, maxWidth: 560, marginInline: 'auto' }}>
      {n.text} <button type="button" className="btn sm ghost" onClick={() => setN(null)} aria-label="Close message">×</button>
    </div>
  );
}
