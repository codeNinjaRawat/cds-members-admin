'use client';
/** Profile › Groups: every group with whether this member is in it; tag or untag by hand (groups.manage).
 *  Manual groups: in or out. Automatic groups: "always in" / "never in" exceptions on top of the rule. Live only. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { be, LIVE } from '@/lib/live/live';

type Row = { id: string; name: string; kind: 'manual' | 'automatic'; description?: string; isIn: boolean; byHand: boolean | 'always' | 'never' | '' };

export function MemberGroupsTab({ memberId, canManage }: { memberId: string; canManage: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = async () => {
    const r = await be<{ enabled: boolean; groups: Row[] }>('GET', `admin/members/${encodeURIComponent(memberId)}/groups`);
    if (r.ok) { setRows(r.data.groups); setEnabled(r.data.enabled); setErr(null); } else setErr(r.message);
  };
  useEffect(() => { if (LIVE) void load(); }, [memberId]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = async (g: Row, add: boolean) => {
    setBusy(g.id);
    const r = await be('POST', `admin/groups/${g.id}/members`, add ? { add: [memberId] } : { remove: [memberId] });
    setBusy(null);
    if (!r.ok) { setErr(r.message); return; }
    await load();
  };
  if (!LIVE) return <section className="panel glass-pane" aria-label="Groups"><p className="panel-intro">Groups show here in live mode.</p></section>;
  return (
    <section className="panel glass-pane" aria-label="Groups">
      <p className="panel-intro">Tick a group to tag this member. Automatic groups follow their rule; ticking one keeps the member in it always, unticking keeps them out. <Link href="/groups">Manage groups</Link>.</p>
      {!enabled && <p className="notice warn-note" role="note">Groups are switched off in Settings – members are not sent group messages.</p>}
      {err && <p className="sf-err" role="alert">{err}</p>}
      {!rows ? <p className="muted">Loading groups…</p> : !rows.length ? <p className="muted">No groups yet.</p> : (
        <ul className="m-groups">
          {rows.map((g) => (
            <li key={g.id} className={g.isIn ? 'in' : ''}>
              <label className="check">
                <input type="checkbox" checked={g.isIn} disabled={!canManage || busy === g.id} onChange={(e) => void change(g, e.target.checked)} />
                <span><b>{g.name}</b> <small className="muted">{g.kind === 'automatic' ? (g.byHand === 'always' ? 'automatic · kept in by hand' : g.byHand === 'never' ? 'automatic · kept out by hand' : 'automatic') : 'by hand'}</small>
                  {g.description && <small className="block-hint">{g.description}</small>}</span>
              </label>
              <Link className="btn sm ghost" href={`/communication?to=${encodeURIComponent(memberId)}`} aria-label={`Message ${g.name}`} hidden>Message</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
