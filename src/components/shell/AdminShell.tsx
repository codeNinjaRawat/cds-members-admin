'use client';
/**
 * A1 app shell: glass sidebar (groups, active item, planned modules), top bar (search / Ctrl+K command palette,
 * DEMO environment pill, open website, light/dark, user), mobile drawer. Applies the admin's own appearance.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyAppearance, readAppearance, useAppearance } from '@/lib/appearance/appearance';
import { iconPath, NAV, NAV_TREE, type IconName, type NavItem, type NavNode } from './nav';
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
  const closed = me && (me.org.status === 'suspended' || me.org.status === 'cancelled');

  useEffect(() => { applyAppearance(readAppearance()); }, []);
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, []);

  return (
    <>
    <div className="wall" aria-hidden="true" />
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className={`side glass-nav${drawer ? ' open' : ''}`} aria-label="Admin sections">
        <div className="side-brand">
          <img src="/brand/logo-mark.svg" alt="" width={34} height={34} className="mark-light" />
          <img src="/brand/logo-mark-dark.svg" alt="" width={34} height={34} className="mark-dark" />
          <div><b>{me ? `${me.org.shortName} Admin` : 'ISGH Admin'}</b><span>{me?.org.name ?? 'Islamic Society of Greater Houston'}</span></div>
        </div>
        <SideTree pathname={pathname} can={can} />
        <div className="side-card">
          <svg width="22" height="22" aria-hidden="true" viewBox="0 0 100 100"><g fill="currentColor"><rect x="22" y="22" width="56" height="56" /><rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)" /></g></svg>
          <b>Renewal season</b>
          <p>2027 renewals open November 1. Check dues, dates and reminder text before members start paying.</p>
          <Link href="/membership" className="btn sm side-card-btn">Review plans and dates</Link>
        </div>
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
          <span className="env" title="Changes go to the local demo store (../.demo-store). The real site is not touched.">Demo</span>
          <a className="top-link" href={site} target="_blank" rel="noopener noreferrer">Open website<span className="sr-only"> (opens in a new tab)</span></a>
          <button className="icon-btn" aria-label="Switch light or dark mode"
            onClick={() => update({ mode: document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark' })}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
          <Link href="/appearance" className="me" aria-label={`My appearance – ${a.preset}`}><span className="avatar">AA</span><span className="me-name">Akhter Alam<small>Super admin</small></span></Link>
        </header>
        <main id="main" tabIndex={-1}>
          {me && <PlatformBanners me={me} pathname={pathname} />}
          {closed ? <ClosedPanel me={me!} /> : mod && !can(mod) ? <ModuleOff label={MODULE_INFO[mod].label} plan={me!.org.plan} email={me!.supportEmail} /> : children}
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

function SideTree({ pathname, can }: { pathname: string; can: (m?: Module) => boolean }) {
  const [query, setQuery] = useState('');
  const qc = openCounts(useQueueState());
  const counts: Record<string, number> = { 'q:all': Object.values(qc).reduce((a, b) => a + b, 0), ...Object.fromEntries(Object.entries(qc).map(([k, v]) => [`q:${k}`, v])) };
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
        {NAV_TREE.map((n) => ({ ...n, children: n.children?.filter((c) => c.soon !== undefined || can(moduleForPath(c.href))) })).filter((n) => (n.href ? can(moduleForPath(n.href)) : (n.children?.length ?? 0) > 0)).map((n) => <TreeNode key={n.label} n={n} counts={counts} isActive={isActive} open={open.includes(n.label)} onToggle={() => toggle(n.label)} parentActive={activeParent === n.label} pathname={pathname} />)}
      </ul>
    </nav>
  );
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
      <button type="button" className={`side-link parent${parentActive ? ' is-current' : ''}`} aria-label={nb ? `${n.label}, ${nb} need attention` : n.label} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <Icon name={n.icon} /><span className="lbl">{n.label}</span>{badge}
        <svg className="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
      </button>
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
    const pages = NAV.flatMap((g) => g.items.filter((x) => !x.soon && can(moduleForPath(x.href))).map((x) => ({ label: x.label, hint: g.label, icon: x.icon, keywords: x.keywords ?? '', run: () => { window.location.assign(x.href); } })));
    const actions = [
      { label: 'Switch light / dark', hint: 'Action', icon: 'brush' as IconName, keywords: 'theme mode night', run: toggleMode },
      { label: 'Open the website', hint: 'Action', icon: 'home' as IconName, keywords: 'site preview', run: () => window.open(site, '_blank', 'noopener') },
    ];
    const s = q.trim().toLowerCase();
    return [...pages, ...actions].filter((x) => !s || `${x.label} ${x.keywords} ${x.hint}`.toLowerCase().includes(s));
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
            <li key={it.label} id={`cmdk-${n}`} role="option" aria-selected={n === i} onMouseEnter={() => setI(n)} onClick={() => go(n)}>
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
      {s && <div className="pf-banner warn" role="status"><span><b>Support sign-in by {s.by}</b> ({s.mode === 'full' ? 'full access' : 'read only'}) until {new Date(s.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}. Reason: “{s.reason}”</span></div>}
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
