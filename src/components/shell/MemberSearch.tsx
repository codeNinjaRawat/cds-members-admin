'use client';
/**
 * Top-bar member search (replaces the "Find a setting or page" palette, owner 2026-10-29).
 * Type a name, member ID, email, phone or ZIP → the first matches in the admin's own scope → Enter opens the profile.
 * Ctrl+K (⌘K) puts the cursor here. The member list is only loaded once someone types (no cost on other pages).
 */
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMembers } from '@/components/views/MembersView';
import { useAccess } from '@/lib/access/use-access';
import { centerOf, digits, fullName, STATUS_LABEL, statusOf, ZONES } from '@/lib/members/members';

const MAX = 8;

export function MemberSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); input.current?.select(); setOpen(true); } };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, []);
  const active = open && q.trim().length >= 2;
  return (
    <div className="msearch" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" /></svg>
      <input ref={input} type="search" className="msearch-in" placeholder="Search members – name, ID, email, phone" aria-label="Search members" aria-keyshortcuts="Control+K"
        role="combobox" aria-expanded={active} aria-controls="msearch-list" aria-autocomplete="list" autoComplete="off" spellCheck={false}
        value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); setOpen(false); (e.target as HTMLInputElement).blur(); } }} />
      <kbd>Ctrl K</kbd>
      {active && <Results q={q.trim()} onPick={() => { setQ(''); setOpen(false); }} input={input} />}
    </div>
  );
}

function Results({ q, onPick, input }: { q: string; onPick: () => void; input: React.RefObject<HTMLInputElement | null> }) {
  const members = useMembers();
  const access = useAccess();
  const router = useRouter();
  const [sel, setSel] = useState(0);
  const { hits, total } = useMemo(() => {
    if (!members) return { hits: [], total: 0 };
    const s = q.toLowerCase(); const d = digits(q);
    const all = members.filter((m) => access.inScope(m.zone, centerOf(m), m.zip) && (
      `${fullName(m)} ${m.id} ${m.email} ${m.zip}`.toLowerCase().includes(s) || (d.length >= 4 && digits(m.phone).includes(d))));
    // exact ID first, then names that start with the text, then the rest; archived last
    const rank = (m: (typeof all)[number]) => (m.id.toLowerCase() === s ? 0 : fullName(m).toLowerCase().startsWith(s) || m.last.toLowerCase().startsWith(s) ? 1 : 2) + (m.archived ? 3 : 0);
    all.sort((a, b) => rank(a) - rank(b) || fullName(a).localeCompare(fullName(b)));
    return { hits: all.slice(0, MAX), total: all.length };
  }, [members, q, access.ready, access.me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel(0); }, [q]);
  const go = (href: string) => { onPick(); router.push(href); };
  useEffect(() => {
    const el = input.current; if (!el) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => Math.min(i + 1, hits.length)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); go(sel < hits.length ? `/members/${hits[sel].id}` : `/members?q=${encodeURIComponent(q)}`); }
    };
    el.addEventListener('keydown', on); return () => el.removeEventListener('keydown', on);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="msearch-pop glass-float" id="msearch-list" role="listbox" aria-label="Members found">
      {!members ? <p className="msearch-note">Loading members…</p> : !hits.length ? <p className="msearch-note">No member matches “{q}”.</p> : <>
        {hits.map((m, i) => { const st = statusOf(m); return (
          <button key={m.id} type="button" role="option" aria-selected={i === sel} className={`msearch-row${i === sel ? ' on' : ''}`} onMouseEnter={() => setSel(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/members/${m.id}`)}>
            <span className="msearch-who"><b>{fullName(m)}</b><small>{m.id} · {centerOf(m) || ZONES[m.zone] || 'No masjid'}</small></span>
            <span className={`msearch-st st-${st}`}>{STATUS_LABEL[st]}</span>
          </button>
        ); })}
      </>}
      {members && <button type="button" role="option" aria-selected={sel === hits.length} className={`msearch-all${sel === hits.length ? ' on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/members?q=${encodeURIComponent(q)}`)}>
        {total > hits.length ? `See all ${total.toLocaleString('en-US')} matches in the member list` : 'Open the member list'} →</button>}
    </div>
  );
}
