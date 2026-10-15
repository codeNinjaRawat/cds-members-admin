'use client';
/**
 * A3 Member 360°: who they are, can they vote this year (each Bylaws rule with the reason), household, payments,
 * history and audit. Staff actions (Approve · Photo ID verified · Record offline payment · Change center · Add note)
 * need a reason where it matters and always write an audit entry. DEMO: saved in this browser only.
 */
import Link from 'next/link';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Tabs } from '@/components/editor/bits';
import {
  ageOn, centerOf, centersOf, COMMITMENT_LABEL, digits, eligibility, fmtDate, fmtMoney, fullName, initials, PLANS, recordDate, saveMember,
  STATUS_LABEL, statusOf, YEAR, ZONES, type Member, type Payment, type ZoneId,
} from '@/lib/members/members';
import { useMembers } from './MembersView';
import { MemberFamily } from './FamilyView';

type Action = null | 'payment' | 'center' | 'note' | 'approve';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

export function MemberProfile({ id }: { id: string }) {
  const members = useMembers();
  const [action, setAction] = useState<Action>(null);
  const [flash, setFlash] = useState('');
  if (!members) return <div className="page"><div className="loading-pane glass-pane" role="status"><span className="spinner" />Loading member…</div></div>;
  const m = members.find((x) => x.id.toLowerCase() === id.toLowerCase());
  if (!m) return (
    <div className="page"><div className="panel glass-pane"><h1 className="panel-h">No member with ID {id}</h1><p className="panel-intro">Check the number or search the list.</p><Link className="btn" href="/members">Back to members</Link></div></div>
  );
  const status = statusOf(m); const vote = eligibility(m); const next = eligibility(m, YEAR + 1);
  const spouse = m.spouseId ? members.find((x) => x.id === m.spouseId) : undefined;
  const done = (text: string) => { setAction(null); setFlash(text); window.setTimeout(() => setFlash(''), 4000); };
  const act = (patch: Partial<Member>, what: string, detail: string, msg: string) => { saveMember({ ...m, ...patch }, what, detail); done(msg); };

  return (
    <div className="page m360">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/members">Members</Link><span aria-hidden="true">›</span><span aria-current="page">{fullName(m)}</span></nav>
      <header className="m-head glass-pane">
        <span className="m-av lg" aria-hidden="true">{initials(m)}</span>
        <div className="m-head-txt">
          <h1>{fullName(m)}</h1>
          <p>{m.id} · Member since {m.joined} · {PLANS[m.plan].name} plan</p>
          <div className="chip-line">
            <span className={`st ${status === 'active' || status === 'life' ? 'st-active' : status === 'pending' ? 'st-board-review' : status === 'expired' ? 'st-needs-info' : 'st-bad'}`}>{STATUS_LABEL[status]}</span>
            <span className={`st ${vote.eligible ? 'st-approved' : 'st-needs-info'}`}>{vote.eligible ? `Can vote in ${YEAR}` : `Cannot vote in ${YEAR}`}</span>
            <span className={`st ${m.idCheck === 'verified' ? 'st-approved' : 'st-id-check'}`}>{m.idCheck === 'verified' ? 'Photo ID verified' : 'Photo ID to check'}</span>
          </div>
        </div>
        <div className="m-actions">
          {!m.approvedOn && m.standing === 'good' && <button className="btn primary" onClick={() => setAction('approve')}>Approve</button>}
          {m.idCheck !== 'verified' && <button className="btn" onClick={() => act({ idCheck: 'verified' }, 'Photo ID verified', 'Checked against the uploaded ID', 'Photo ID marked as verified.')}>Mark ID verified</button>}
          {m.plan !== 'life' && m.approvedOn && <button className="btn" onClick={() => setAction('payment')}>Record payment</button>}
          <button className="btn" onClick={() => setAction('center')}>Change center</button>
          <button className="btn" onClick={() => setAction('note')}>Add note</button>
        </div>
      </header>
      {flash && <p className="notice glass-pane" role="status">{flash} <span className="muted">Demo – saved in this browser and in the audit log.</span></p>}

      <div className="m360-grid">
        <aside className="m-elig glass-pane" aria-labelledby="el-h">
          <h2 id="el-h" className="panel-h">Voting {YEAR}</h2>
          <p className={`m-verdict ${vote.eligible ? 'yes' : 'no'}`}>{vote.eligible ? `Yes – meets every Bylaws rule on ${fmtDate(recordDate(YEAR))}` : `No – ${vote.summary}`}</p>
          <ol className="m-checks">
            {vote.checks.map((c) => (
              <li key={c.id} className={c.ok ? 'ok' : 'bad'}>
                <span className="m-mark" aria-hidden="true">{c.ok ? '✓' : '✕'}</span>
                <div><b>{c.label}</b><small>{c.reason}</small>
                  {!c.ok && c.fix === 'approve' && <button className="linkish" onClick={() => setAction('approve')}>Approve now</button>}
                  {!c.ok && c.fix === 'payment' && <button className="linkish" onClick={() => setAction('payment')}>Record a payment</button>}
                </div>
                <span className="sr-only">{c.ok ? 'met' : 'not met'}</span>
              </li>
            ))}
          </ol>
          <p className="m-src">Bylaws Art. I Sec. 2. Paying after June 30 renews membership but does not restore the vote for that year.</p>
          <div className="m-next">
            <b>{YEAR + 1} renewal</b>
            <span>{next.checks.find((c) => c.id === 'dues')?.ok ? 'Paid' : `Opens November 1 · due by ${fmtDate(recordDate(YEAR + 1))} to vote`}</span>
          </div>
        </aside>

        <div className="m360-main">
          <Tabs label="Member details" tabs={[
            { id: 'profile', label: 'Profile', render: () => <ProfileTab m={m} /> },
            { id: 'household', label: 'Household', render: () => <HouseholdTab m={m} spouse={spouse} /> },
            { id: 'family', label: 'Family tree', render: () => <MemberFamily m={m} members={members} /> },
            { id: 'payments', label: 'Payments', badge: m.payments.length, render: () => <PaymentsTab m={m} /> },
            { id: 'history', label: 'Notes', badge: m.notes.length || undefined, render: () => <NotesTab m={m} onAdd={() => setAction('note')} /> },
            { id: 'audit', label: 'Audit log', render: () => <AuditTab m={m} /> },
          ]} />
        </div>
      </div>

      {action === 'approve' && <ActionDialog title={`Approve ${fullName(m)}`} submit="Approve" onClose={() => setAction(null)}
        onSubmit={(f) => act({ approvedOn: today() }, 'Approved', String(f.get('ref') || 'Board approval'), `${fullName(m)} is approved. Status updates now.`)}>
        <p>The Bylaws need Board approval before a member can vote. Note where it was approved.</p>
        <label className="sf-field"><span className="sf-label">Board meeting or reference</span><input className="in" name="ref" required placeholder="Board meeting, October 2026" /></label>
      </ActionDialog>}

      {action === 'payment' && <ActionDialog title="Record an offline payment" submit="Record payment" onClose={() => setAction(null)}
        onSubmit={(f) => {
          const p: Payment = { year: Number(f.get('year')), paidOn: String(f.get('paidOn')), amountCents: Math.round(Number(f.get('amount')) * 100), method: f.get('method') as Payment['method'], payer: f.get('payer') as Payment['payer'], ref: String(f.get('ref') || `OFF-${Date.now() % 100000}`) };
          act({ payments: [...m.payments.filter((x) => x.year !== p.year), p] }, 'Payment recorded', `${p.year} dues ${fmtMoney(p.amountCents)} by ${p.method}, paid ${fmtDate(p.paidOn)}`, `Payment of ${fmtMoney(p.amountCents)} recorded for ${p.year}.`);
        }}>
        <p>For a check or cash paid at a center. Card payments arrive by themselves (Stripe, later).</p>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Membership year</span><select className="in" name="year" defaultValue={YEAR}><option>{YEAR}</option><option>{YEAR + 1}</option></select></label>
          <label className="sf-field"><span className="sf-label">Amount</span><span className="in-money"><i>$</i><input className="in" name="amount" type="number" min="1" step="0.01" required defaultValue={PLANS[m.plan].cents / 100} /></span></label>
        </div>
        <div className="field-row">
          <label className="sf-field"><span className="sf-label">Paid on</span><input className="in" name="paidOn" type="date" required defaultValue={today()} max={today()} /></label>
          <label className="sf-field"><span className="sf-label">Method</span><select className="in" name="method" defaultValue="check"><option value="check">Check</option><option value="cash">Cash</option><option value="card">Card at the desk</option></select></label>
        </div>
        <label className="sf-field"><span className="sf-label">Who paid</span>
          <select className="in" name="payer" defaultValue="self"><option value="self">The member</option><option value="spouse">Spouse</option><option value="parent">Parent</option><option value="other">Someone else (not a relative)</option></select>
          <small className="sf-hint">The Bylaws need own dues, or a relative by blood or marriage. “Someone else” renews but does not give a vote.</small>
        </label>
        <label className="sf-field"><span className="sf-label">Check number or receipt (optional)</span><input className="in" name="ref" placeholder="Check 1042" /></label>
      </ActionDialog>}

      {action === 'center' && <CenterDialog m={m} onClose={() => setAction(null)} onSave={(zone, center, reason) => act({ zone, centerOverride: { center, reason, lockedUntil: `${YEAR + 4}-12-31` } }, 'Center changed', `${centerOf(m)} → ${center}. Reason: ${reason}`, `Center changed to ${center}. Locked for 5 years (Bylaws).`)} />}

      {action === 'note' && <ActionDialog title="Add a note" submit="Save note" onClose={() => setAction(null)}
        onSubmit={(f) => act({ notes: [...m.notes, { at: new Date().toISOString(), by: 'Akhter Alam', text: String(f.get('text')) }] }, 'Note added', String(f.get('text')).slice(0, 80), 'Note saved.')}>
        <label className="sf-field"><span className="sf-label">Note (staff only – the member never sees it)</span><textarea className="in in-area" name="text" required maxLength={1000} rows={4} /></label>
      </ActionDialog>}
    </div>
  );
}

function ActionDialog({ title, submit, children, onClose, onSubmit }: { title: string; submit: string; children: ReactNode; onClose: () => void; onSubmit: (f: FormData) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = (el: HTMLDialogElement | null) => { ref.current = el; if (el && !el.open) el.showModal(); };
  return (
    <dialog ref={open} className="modal glass-float" aria-label={title} onClose={onClose} onCancel={onClose}>
      <form method="dialog" className="m-form" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}>
        <h2>{title}</h2>
        {children}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">{submit}</button></div>
      </form>
    </dialog>
  );
}

function CenterDialog({ m, onClose, onSave }: { m: Member; onClose: () => void; onSave: (z: ZoneId, c: string, reason: string) => void }) {
  const [zone, setZone] = useState<ZoneId>(m.zone);
  return (
    <ActionDialog title="Change Islamic Center" submit="Save change" onClose={onClose} onSubmit={(f) => onSave(zone, String(f.get('center')), String(f.get('reason')))}>
      <p>Members belong where they live. A member within 5 miles of a zone border may ask for a nearby center; once the Board approves, it stays for 5 years.</p>
      <p className="muted">Now: {ZONES[m.zone]} zone · {centerOf(m)}</p>
      <div className="field-row">
        <label className="sf-field"><span className="sf-label">Zone</span><select className="in" value={zone} onChange={(e) => setZone(e.target.value as ZoneId)}>{(Object.keys(ZONES) as ZoneId[]).map((z) => <option key={z} value={z}>{ZONES[z]}</option>)}</select></label>
        <label className="sf-field"><span className="sf-label">Islamic Center</span><select className="in" name="center" key={zone}>{centersOf(zone).map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <label className="sf-field"><span className="sf-label">Reason (required, goes in the audit log)</span><textarea className="in in-area" name="reason" required minLength={10} rows={3} placeholder="Moved to a new address / Board approved border request on …" /></label>
    </ActionDialog>
  );
}

const Def = ({ k, children }: { k: string; children: ReactNode }) => <div className="m-def"><dt>{k}</dt><dd>{children}</dd></div>;

function ProfileTab({ m }: { m: Member }) {
  return (
    <section className="panel glass-pane" aria-label="Profile">
      <dl className="m-defs">
        <Def k="Email"><a href={`mailto:${m.email}`}>{m.email}</a></Def>
        <Def k="Mobile"><a href={`tel:+1${digits(m.phone)}`}>{m.phone}</a></Def>
        <Def k="Date of birth">{fmtDate(m.dob)} · age {ageOn(m.dob, new Date().toISOString().slice(0, 10))}</Def>
        <Def k="Home address">{m.street}<br />{m.city}, TX {m.zip}</Def>
        <Def k="Zone and center">{ZONES[m.zone]} · {centerOf(m)}{m.centerOverride && <small className="m-sub">Changed: {m.centerOverride.reason}{m.centerOverride.lockedUntil ? ` · locked until ${fmtDate(m.centerOverride.lockedUntil)}` : ''}</small>}</Def>
        <Def k="Commitment">{COMMITMENT_LABEL[m.commitment]}</Def>
        <Def k="Applied">{fmtDate(m.appliedOn)}</Def>
        <Def k="Approved">{m.approvedOn ? fmtDate(m.approvedOn) : 'Not yet'}</Def>
      </dl>
    </section>
  );
}

function HouseholdTab({ m, spouse }: { m: Member; spouse?: Member }) {
  return (
    <section className="panel glass-pane" aria-label="Household">
      {m.plan !== 'family' ? <p className="panel-intro">{PLANS[m.plan].name} plan – no household on this membership.</p> : spouse ? (
        <>
          <p className="panel-intro">Family plan covers the member and spouse. Each adult has their own vote status.</p>
          <Link className="m-who card" href={`/members/${spouse.id}`}><span className="m-av" aria-hidden="true">{initials(spouse)}</span><span><b>{fullName(spouse)}</b><small>Spouse · {spouse.id} · {eligibility(spouse).eligible ? `can vote in ${YEAR}` : eligibility(spouse).summary}</small></span></Link>
        </>
      ) : <p className="panel-intro">Family plan, but no spouse is linked yet. The member can add one from their portal.</p>}
    </section>
  );
}

function PaymentsTab({ m }: { m: Member }) {
  const list = [...m.payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  return (
    <section className="panel glass-pane" aria-label="Payments">
      {!list.length ? <p className="panel-intro">No payments yet.</p> : (
        <div className="m-scroll"><table className="m-grid compact">
          <thead><tr><th scope="col">Year</th><th scope="col">Paid on</th><th scope="col" className="num">Amount</th><th scope="col">Method</th><th scope="col">Paid by</th><th scope="col">Counts for the vote</th><th scope="col">Reference</th></tr></thead>
          <tbody>{list.map((p) => { const onTime = p.paidOn <= recordDate(p.year) && p.payer !== 'other'; return (
            <tr key={p.ref + p.year}><td>{p.year}</td><td className="num">{fmtDate(p.paidOn)}</td><td className="num">{fmtMoney(p.amountCents)}</td><td>{p.method === 'card' ? 'Card' : p.method === 'check' ? 'Check' : 'Cash'}</td><td>{p.payer === 'self' ? 'Member' : p.payer[0].toUpperCase() + p.payer.slice(1)}</td>
              <td>{m.plan === 'life' ? 'Life' : onTime ? <span className="m-vote yes">Yes</span> : <span className="m-vote no">No<small>{p.payer === 'other' ? 'not own dues' : 'after June 30'}</small></span>}</td><td><code>{p.ref}</code></td></tr>); })}</tbody>
        </table></div>
      )}
    </section>
  );
}

function NotesTab({ m, onAdd }: { m: Member; onAdd: () => void }) {
  return (
    <section className="panel glass-pane" aria-label="Notes">
      {!m.notes.length ? <p className="panel-intro">No staff notes yet.</p> : (
        <ul className="history">{[...m.notes].reverse().map((n) => <li key={n.at}><div><b>{n.text}</b><span>{n.by} · {new Date(n.at).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })}</span></div></li>)}</ul>
      )}
      <button className="btn sm" onClick={onAdd}>Add note</button>
    </section>
  );
}

function AuditTab({ m }: { m: Member }) {
  return (
    <section className="panel glass-pane" aria-label="Audit log">
      <p className="panel-intro">Every change: who, what and when (Central Time). Live: also before/after values and IP, kept for 7 years.</p>
      <ol className="m-audit">{[...m.audit].reverse().map((a, i) => (
        <li key={i}><span className="tl-dot" aria-hidden="true" /><div><b>{a.action}</b> <span>{a.detail}</span><small>{a.by} · {a.at.length > 10 ? new Date(a.at).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }) : fmtDate(a.at)}</small></div></li>
      ))}</ol>
    </section>
  );
}
