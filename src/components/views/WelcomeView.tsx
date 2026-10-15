'use client';
/** Accept an admin invitation from the platform (SaaS): shows who it is for, then a first-steps checklist. */
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Info = { org: string; shortName: string; name: string; email: string; role: string };
export function WelcomeView({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) { setErr('This page needs the link from your invitation email.'); return; }
    fetch(`/api/platform/invite?token=${encodeURIComponent(token)}`).then(async (r) => { const j = await r.json(); if (r.ok) setInfo(j); else setErr(j.error); }).catch(() => setErr('No connection. Try again.'));
  }, [token]);
  const accept = async () => {
    setBusy(true);
    const r = await fetch('/api/platform/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const j = await r.json(); setBusy(false);
    if (r.ok) setDone(true); else setErr(j.error);
  };
  return (
    <div className="page welcome">
      <section className="panel glass-pane welcome-card">
        {err ? <><h1>Invitation not found</h1><p>{err}</p></>
          : !info ? <p role="status">Checking your invitation…</p>
          : done ? (<>
            <h1 tabIndex={-1} ref={(el) => el?.focus()}>Welcome to {info.shortName} admin</h1>
            <p>You are signed up as <b>{info.role === 'owner' ? 'the owner' : info.role}</b>. Start here:</p>
            <ol className="welcome-steps">
              <li><Link href="/settings/organization">Check your organization’s name, address and contact</Link></li>
              <li><Link href="/website/theme">Pick colors and upload your logo</Link></li>
              <li><Link href="/membership?tab=plans">Set your membership plans and dues</Link></li>
              <li><Link href="/website/pages">Write your About page</Link></li>
              <li><Link href="/">Open the overview</Link></li>
            </ol>
          </>) : (<>
            <h1>Join {info.org}</h1>
            <p><b>{info.name}</b> ({info.email}) – you were invited as <b>{info.role === 'owner' ? 'owner' : info.role}</b>.</p>
            <p className="sf-hint">Demo: there is no password yet. Sign-in with 2-step verification arrives with the BE.</p>
            <button type="button" className="btn primary" onClick={accept} disabled={busy}>{busy ? 'Joining…' : 'Accept invitation'}</button>
          </>)}
      </section>
    </div>
  );
}
