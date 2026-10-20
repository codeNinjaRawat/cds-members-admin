'use client';
import { LIVE } from '@/lib/live/live';
/**
 * Admin › family trees. The MEMBERSHIP family of a member (family history stays private to the member):
 * who is a member, who can vote, adults who could join, children turning 18 before the record date.
 * Used in Member 360° (tab) and on Members › Family trees (search + outreach list). DEMO data.
 */
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FamilyTree } from '@/components/family/FamilyTree';
import { badgeFor, eighteenth, fmtDate, fullName, insights, lifeYears, relationTo } from '@/lib/family/family';
import { familyFor, NEXT_RECORD_DATE, TODAY } from '@/lib/family/admin-family';
import { centerOf, demoMembers, fullName as memberName, saveMember, ZONES, type Member } from '@/lib/members/members';
import { useMembers } from './MembersView';

export function MemberFamily({ m, members }: { m: Member; members: Member[] }) {
  const fam = useMemo(() => familyFor(m, members), [m, members]);
  const [sel, setSel] = useState<string>(fam.rootId);
  const [note, setNote] = useState('');
  const tips = insights(fam, TODAY, NEXT_RECORD_DATE);
  const p = fam.people.find((x) => x.id === sel) ?? fam.people[0];
  const b = badgeFor(p, TODAY, NEXT_RECORD_DATE);
  const linked = p.member && members.some((x) => x.id === p.member!.memberId) ? p.member.memberId : null;
  const flash = (t: string) => { setNote(t); window.setTimeout(() => setNote(''), 4000); };

  return (
    <section className="panel glass-pane fam-admin" aria-label="Family tree">
      <ul className="fam-tips">{tips.map((t, i) => <li key={i} className={`t-${t.tone}`}>{t.text}</li>)}</ul>
      <div className="fam-admin-grid">
        <FamilyTree family={fam} today={TODAY} recordDate={NEXT_RECORD_DATE} layer="membership" selected={sel} onSelect={setSel} label={`${memberName(m)}’s family tree`} />
        <aside className="fam-admin-side" aria-live="polite">
          <h3>{fullName(p)}</h3>
          <p className="muted">{relationTo(fam, p.id) === 'You' ? 'This member' : `${relationTo(fam, p.id)} of ${m.first}`}{lifeYears(p) ? ` · ${lifeYears(p)}` : ''}</p>
          <p><span className={`ft-badge t-${b.tone}`}>{b.text}</span></p>
          {b.tone === 'soon' && <p className="fam-line">Can join from {fmtDate(eighteenth(p.born!))} and vote in 2027 if dues are paid by {fmtDate(NEXT_RECORD_DATE)}.</p>}
          {b.tone === 'join' && <p className="fam-line">Adult, not a member – a good person to invite.</p>}
          <div className="row-actions">
            {linked && p.id !== fam.rootId && <Link className="btn sm" href={`/members/${linked}`}>Open member record</Link>}
            {(b.tone === 'join' || b.tone === 'soon') && (
              <button className="btn sm primary" onClick={() => { saveMember(m, 'Family outreach', `Invitation to join sent for ${fullName(p)} (${relationTo(fam, p.id).toLowerCase()})`); flash(`Demo: ${p.first} would get an invitation through ${m.first}. Logged in ${m.first}’s audit.`); }}>
                {b.tone === 'soon' ? 'Schedule invitation for the 18th birthday' : 'Send invitation to join'}
              </button>
            )}
          </div>
          {note && <p className="notice" role="status">{note}</p>}
          <p className="fam-privacy">Staff see the membership family only. Older generations and family history are private to the member.</p>
        </aside>
      </div>
    </section>
  );
}

/** Members › Family trees: find a member, see their family; outreach list of families with adults who can join. */
export function FamiliesView({ search = '' }: { search?: string }) {
  const all = useMembers() ?? (LIVE ? [] : demoMembers());
  const mf = useMasjidFilter();
  const members = useMemo(() => all.filter((x) => mf.keep(x.zone, centerOf(x), x.zip)), [all, mf.zone, mf.masjid, mf.access.ready, mf.access.me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const initial = new URLSearchParams(search).get('member');
  const [id, setId] = useState<string>(initial && all.some((x) => x.id === initial) ? initial : (all.find((x) => x.email === 'aisha@example.com') ?? all[0])?.id ?? '');
  const [q, setQ] = useState('');
  const m = all.find((x) => x.id === id) ?? members[0] ?? all[0];
  const hits = q.trim().length < 2 ? [] : members.filter((x) => `${memberName(x)} ${x.id} ${x.email}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  const outreach = useMemo(() => members.filter((x) => x.standing === 'good').map((x) => {
    const f = familyFor(x, members);
    const tones = f.people.filter((p) => p.id !== f.rootId).map((p) => badgeFor(p, TODAY, NEXT_RECORD_DATE).tone);
    return { x, join: tones.filter((t) => t === 'join').length, soon: tones.filter((t) => t === 'soon').length };
  }).filter((r) => r.join + r.soon > 0).sort((a, b) => b.soon * 2 + b.join - (a.soon * 2 + a.join)).slice(0, 12), [members]);
  const pick = (nid: string) => { setId(nid); setQ(''); const u = new URL(window.location.href); u.searchParams.set('member', nid); window.history.replaceState(null, '', u); };

  if (!m) return <div className="page families"><p className="muted">No members yet.</p></div>;
  return (
    <div className="page families">
      <header className="page-head">
        <div>
          <h1>Family trees</h1>
          <p className="page-intro">See a member’s family: who is a member, who can vote, and who could join – like children turning 18 before {fmtDate(NEXT_RECORD_DATE)}.{LIVE ? '' : ' Demo data.'}</p>
        </div>
      </header>
      <div className="fam-page">
        <aside className="fam-find glass-pane">
          <label className="m-search">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" /></svg>
            <span className="sr-only">Find a member</span>
            <input className="in" type="search" placeholder="Find a member by name or ID" value={q} onChange={(e) => setQ(e.target.value)} />
            <MasjidPicker />
          </label>
          {hits.length > 0 && <ul className="fam-hits" aria-label="Matches">{hits.map((h) => <li key={h.id}><button type="button" onClick={() => pick(h.id)}><b>{memberName(h)}</b><small>{h.id} · {ZONES[h.zone]}</small></button></li>)}</ul>}
          <h2 className="wq-h3">Families to reach</h2>
          <p className="muted fam-small">Members with relatives who could join now or turn 18 before the record date.</p>
          <ul className="fam-hits">
            {outreach.map(({ x, join, soon }) => (
              <li key={x.id}><button type="button" aria-pressed={x.id === id} onClick={() => pick(x.id)}>
                <b>{memberName(x)}</b><small>{[join ? `${join} can join` : '', soon ? `${soon} turn${soon > 1 ? '' : 's'} 18 soon` : ''].filter(Boolean).join(' · ')}</small>
              </button></li>
            ))}
          </ul>
        </aside>
        <div className="fam-main">
          <div className="fam-who glass-pane"><b>{memberName(m)}</b><span>{m.id} · {ZONES[m.zone]}</span><Link className="btn sm" href={`/members/${m.id}`}>Open Member 360°</Link></div>
          <MemberFamily key={m.id} m={m} members={all} />
        </div>
      </div>
    </div>
  );
}
