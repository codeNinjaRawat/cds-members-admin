'use client';
/**
 * A3 Member 360°: who they are, can they vote this year (each Bylaws rule with the reason), household, payments,
 * history and audit. Staff actions (Approve · Photo ID verified · Record offline payment · Change center · Add note)
 * need a reason where it matters and always write an audit entry. DEMO: saved in this browser only.
 */
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Tabs } from '@/components/editor/bits';
import {
  ageOn, approvalBlockers, centerOf, centersOf, COMMITMENT_LABEL, digits, eligibility, fmtDate, fmtMoney, fullName, initials, PLANS, recordDate, saveMember,
  renewalOf, cityLine, STATUS_LABEL, statusOf, YEAR, ZONES, type Member, type Payment, type ZoneId, ORG_TZ } from '@/lib/members/members';
import { useMembers } from './MembersView';
import { MemberFamily } from './FamilyView';
import { useOrgConfig } from '@/lib/members/use-org-config';
import { useMembershipSettings } from '@/lib/members/use-settings';
import { useAccess } from '@/lib/access/use-access';
import { LIVE } from '@/lib/live/live';
import { useOrg } from './TeamViews';
import { centerRulesInWords, DEFAULT_CENTER_RULES } from '@/lib/community/org-structure';
import { canEdit, checkValues, findDuplicates, showValue, type FieldValues } from '@/lib/community/member-records';
import type { ProfileField } from '@/lib/community/org-config';

type Action = null | 'payment' | 'center' | 'note' | 'approve' | 'fields' | 'archive';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });

export function MemberProfile({ id }: { id: string }) {
  const members = useMembers();
  const cfg = useOrgConfig();
  const [action, setAction] = useState<Action>(null);
  const [flash, setFlash] = useState('');
  const org = useOrg();
  const access = useAccess();
  const [more, setMore] = useState(false);
  const [allChecks, setAllChecks] = useState(false);
  const settings = useMembershipSettings();
  // From the list's quick look: /members/ID?do=payment opens the payment form at once.
  useEffect(() => { const u = new URL(window.location.href); if (u.searchParams.get('do') === 'payment') { setAction('payment'); u.searchParams.delete('do'); window.history.replaceState(null, '', u); } }, []);
  useEffect(() => { if (!more) return; const off = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.m-more')) setMore(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc); return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); }; }, [more]);
  if (!members) return <div className="page"><div className="loading-pane glass-pane" role="status"><span className="spinner" />Loading member…</div></div>;
  const m = members.find((x) => x.id.toLowerCase() === id.toLowerCase());
  if (!m) return (
    <div className="page"><div className="panel glass-pane"><h1 className="panel-h">No member with ID {id}</h1><p className="panel-intro">Check the number or search the list.</p><Link className="btn" href="/members">Back to members</Link></div></div>
  );
  if (!access.inScope(m.zone, centerOf(m), m.zip)) return (
    <div className="page"><div className="panel glass-pane" role="alert"><h1 className="panel-h">Not in your zones</h1><p className="panel-intro">{access.me?.name} sees members of {access.me?.zones.map((z) => ZONES[z as keyof typeof ZONES] ?? z).join(', ')} only. {m.id} is in another zone.</p><Link className="btn" href="/members">Back to members</Link></div></div>
  );
  const status = statusOf(m); const ren = renewalOf(m, today()); const vote = eligibility(m); const next = eligibility(m, YEAR + 1);
  const spouse = m.spouseId ? members.find((x) => x.id === m.spouseId) : undefined;
  const dups = cfg.members.duplicateCheck && !m.archived ? findDuplicates(m, members.filter((x) => !x.archived && !(m.notDuplicateOf ?? []).includes(x.id) && !(x.notDuplicateOf ?? []).includes(m.id))) : [];
  const done = (text: string) => { setAction(null); setFlash(text); window.setTimeout(() => setFlash(''), 4000); };
  const act = (patch: Partial<Member>, what: string, detail: string, msg: string) => { saveMember({ ...m, ...patch }, what, detail); done(msg); };
  const blockers = approvalBlockers(m, settings.rules);

  return (
    <div className="page m360">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/members">Members</Link><span aria-hidden="true">›</span><span aria-current="page">{fullName(m)}</span></nav>
      <header className="m-head glass-pane">
        <span className="m-av lg" aria-hidden="true">{initials(m)}</span>
        <div className="m-head-txt">
          <h1>{fullName(m)}</h1>
          <p>{m.id} · {PLANS[m.plan].name} plan · member since {m.joined}</p>
          <div className="m-status-line">
            <span className={`st ${status === 'active' || status === 'life' ? 'st-active' : status === 'pending' ? 'st-board-review' : status === 'expired' ? 'st-needs-info' : 'st-bad'}`}>{STATUS_LABEL[status]}</span>
            {status !== 'pending' && m.standing === 'good' && ren.status !== 'lifetime' && <span className={`ren-chip ren-${ren.status}`} title={ren.next ? `Next: ${ren.next.label} on ${fmtDate(ren.next.on)}` : undefined}>{ren.label === STATUS_LABEL[status] ? (ren.paidThrough ? `Paid through ${fmtDate(ren.paidThrough)}` : ren.label) : `${ren.label}${ren.paidThrough ? ` · paid through ${fmtDate(ren.paidThrough)}` : ''}`}</span>}
            <span className={`m-vote ${vote.eligible ? 'yes' : 'no'}`}><i aria-hidden="true">{vote.eligible ? '✓' : '–'}</i>{vote.eligible ? `Can vote in ${YEAR}` : `Cannot vote in ${YEAR}`}</span>
            {m.idCheck !== 'verified' && <span className="st st-id-check">Photo ID to check</span>}
          </div>
        </div>
        <div className="m-actions">
          {!m.approvedOn && m.standing === 'good' && access.can('members.approve')
            ? <button className="btn primary" onClick={() => setAction('approve')}>Approve</button>
            : m.plan !== 'life' && m.approvedOn && access.can('payments.record') && <button className="btn primary" onClick={() => setAction('payment')}>Record payment</button>}
          {m.idCheck !== 'verified' && access.can('members.edit') && <button className="btn" onClick={() => act({ idCheck: 'verified' }, 'Photo ID verified', 'Checked against the uploaded ID', 'Photo ID marked as verified.')}>Mark ID verified</button>}
          {(access.can('members.edit') || access.can('members.archive')) && (
            <div className="m-more">
              <button type="button" className="btn" aria-expanded={more} aria-haspopup="true" onClick={() => setMore((x) => !x)}>More actions
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg></button>
              {more && (
                <div className="m-more-list glass-float" onClick={() => setMore(false)}>
                  {access.can('members.edit') && <button type="button" onClick={() => setAction('center')}>Change center</button>}
                  {access.can('members.edit') && <button type="button" onClick={() => setAction('note')}>Add note</button>}
                  {!access.can('members.archive') ? null : m.archived
                    ? <button type="button" onClick={() => act({ archived: undefined }, 'Restored', 'Archived record restored', `${fullName(m)} is back on the member list.`)}>Restore</button>
                    : <button type="button" className="danger" onClick={() => setAction('archive')}>Archive</button>}
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      {m.archived && <p className="notice warn-note glass-pane m-archived" role="note">Archived {fmtDate(m.archived.on)} by {m.archived.by}: {m.archived.reason}. Hidden from lists, cannot sign in and cannot vote. History is kept.</p>}
      {dups.length > 0 && (
        <section className="notice glass-pane m-dups" aria-label="Possible duplicates">
          <b>{dups[0].level === 'likely' ? 'This looks like a duplicate record.' : 'There may be a duplicate record.'}</b>
          <ul>{dups.map((d) => { const o = members.find((x) => x.id === d.id)!; return (
            <li key={d.id}><Link href={`/members/${d.id}`}>{fullName(o)} · {d.id}</Link> <small>{d.reasons.join(' · ')}</small>{' '}
              <button type="button" className="linkish" onClick={() => act({ notDuplicateOf: [...(m.notDuplicateOf ?? []), d.id] }, 'Not a duplicate', `Checked against ${d.id}: different people`, 'Marked as different people.')}>Not the same person</button></li>
          ); })}</ul>
          <small className="muted">To merge, use Work queues › Possible duplicates.</small>
        </section>
      )}
      {flash && <p className="notice glass-pane" role="status">{flash} <span className="muted">{LIVE ? 'Saved and added to the audit log.' : 'Demo – saved in this browser and in the audit log.'}</span></p>}

      <div className="m360-grid">
        <aside className="m-elig glass-pane" aria-labelledby="el-h">
          <h2 id="el-h" className="panel-h">Voting {YEAR}</h2>
          <p className={`m-verdict ${vote.eligible ? 'yes' : 'no'}`}>{vote.eligible ? `Yes – meets every Bylaws rule on ${fmtDate(recordDate(YEAR))}` : `No – ${vote.summary}`}</p>
          {(() => { const bad = vote.checks.filter((c) => !c.ok).length; return (
            <details className="m-why" key={String(vote.eligible)} open={!vote.eligible}>
              <summary>{vote.eligible ? `Show the ${vote.checks.length} Bylaws checks` : `${bad} rule${bad === 1 ? '' : 's'} not met`}</summary>
              <ol className="m-checks">
                {vote.checks.map((c) => (
                  <li key={c.id} className={c.ok ? 'ok' : 'bad'} hidden={!vote.eligible && c.ok && !allChecks}>
                    <span className="m-mark" aria-hidden="true">{c.ok ? '✓' : '✕'}</span>
                    <div><b>{c.label}</b><small>{c.reason}</small>
                      {!c.ok && c.fix === 'approve' && access.can('members.approve') && <button className="linkish" onClick={() => setAction('approve')}>Approve now</button>}
                      {!c.ok && c.fix === 'payment' && <button className="linkish" onClick={() => setAction('payment')}>Record a payment</button>}
                    </div>
                    <span className="sr-only">{c.ok ? 'met' : 'not met'}</span>
                  </li>
                ))}
              </ol>
              {!vote.eligible && !allChecks && <button type="button" className="linkish m-all" onClick={() => setAllChecks(true)}>Show all {vote.checks.length} checks</button>}
              <p className="m-src">Bylaws Art. I Sec. 2. Paying after June 30 renews membership but does not restore the vote for that year.</p>
            </details>
          ); })()}
          <p className="m-next"><b>{YEAR + 1} renewal</b> <span>{next.checks.find((c) => c.id === 'dues')?.ok ? 'Paid' : `opens November 1 · due by ${fmtDate(recordDate(YEAR + 1))} to vote`}</span></p>
        </aside>

        <div className="m360-main">
          <Tabs label="Member details" tabs={[
            { id: 'profile', label: 'Profile', render: () => <ProfileTab m={m} fields={cfg.members.fields} onEdit={access.can('members.edit') ? () => setAction('fields') : undefined} contact={access.can('members.contact')} /> },
            { id: 'household', label: 'Household', render: () => <HouseholdTab m={m} spouse={spouse} /> },
            { id: 'family', label: 'Family tree', render: () => <MemberFamily m={m} members={members} /> },
            { id: 'payments', label: 'Payments', badge: m.payments.length, render: () => <PaymentsTab m={m} /> },
            { id: 'history', label: 'Notes', badge: m.notes.length || undefined, render: () => <NotesTab m={m} onAdd={() => setAction('note')} /> },
            { id: 'audit', label: 'Audit log', render: () => <AuditTab m={m} /> },
          ]} />
        </div>
      </div>

      {action === 'approve' && <ActionDialog title={`Approve ${fullName(m)}`} submit="Approve" onClose={() => setAction(null)} disabled={blockers.length > 0}
        onSubmit={(f) => { if (blockers.length) return; act({ approvedOn: today() }, 'Approved', String(f.get('ref') || `${settings.rules.approval.by || 'Board'} approval`), `${fullName(m)} is approved. Status updates now.`); }}>
        <p>The Bylaws need {settings.rules.approval.by || 'Board'} approval before a member can vote. Note where it was approved.</p>
        {blockers.length > 0 && <ul className="notice warn-note m-blockers" role="alert">{blockers.map((b) => <li key={b}>{b}{b.startsWith('Dues') && access.can('payments.record') && <> <button type="button" className="linkish" onClick={() => setAction('payment')}>Record the payment</button></>}</li>)}<li className="muted">The approval rule in Membership rules › Plans and dues asks for this first.</li></ul>}
        <label className="sf-field"><span className="sf-label">{settings.rules.approval.by || 'Board'} meeting or reference</span><input className="in" name="ref" required placeholder="Board meeting, October 2026" /></label>
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

      {action === 'center' && <CenterDialog m={m} rules={org.rules ?? DEFAULT_CENTER_RULES} onClose={() => setAction(null)} onSave={(zone, center, reason, proof) => act({ zone, centerOverride: { center, reason: proof ? `${reason} (proof: ${proof})` : reason, ...(org.rules?.lockYears ? { lockedUntil: `${YEAR + (org.rules.lockYears) - 1}-12-31` } : {}) } }, 'Center changed', `${centerOf(m)} → ${center}. Reason: ${reason}${proof ? ` · proof: ${proof}` : ''}`, `Center changed to ${center}.${org.rules?.lockYears ? ` Locked for ${org.rules.lockYears} years (Masjids and zones › Rules).` : ''}`)} />}

      {action === 'fields' && <FieldsDialog m={m} fields={cfg.members.fields} onClose={() => setAction(null)}
        onSave={(values, changed) => act({ extra: values }, 'Profile fields changed', changed.map((id) => { const f = cfg.members.fields.find((x) => x.id === id)!; return f.access === 'admins' ? `${f.label} (admin-only, value not logged)` : `${f.label}: ${showValue(f, values[id])}`; }).join('; '), 'Profile fields saved.')} />}

      {action === 'archive' && <ActionDialog title={`Archive ${fullName(m)}`} submit="Archive" onClose={() => setAction(null)}
        onSubmit={(f) => act({ archived: { on: today(), reason: String(f.get('reason')), by: access.me?.name || 'Admin' } }, 'Archived', String(f.get('reason')), `${fullName(m)} is archived. You can restore the record at any time.`)}>
        <p>Use this for a record that should not be active any more – a duplicate that was merged, someone who passed away, a test record. Payments, notes and history are kept. Archived people do not appear in lists, cannot sign in and cannot vote.</p>
        <label className="sf-field"><span className="sf-label">Reason (required, goes in the audit log)</span><textarea className="in in-area" name="reason" required minLength={5} rows={3} placeholder="Merged into HOU-… / passed away (Inna lillahi wa inna ilayhi raji'un) / test record" /></label>
      </ActionDialog>}

      {action === 'note' && <ActionDialog title="Add a note" submit="Save note" onClose={() => setAction(null)}
        onSubmit={(f) => act({ notes: [...m.notes, { at: new Date().toISOString(), by: access.me?.name || 'Admin', text: String(f.get('text')) }] }, 'Note added', String(f.get('text')).slice(0, 80), 'Note saved.')}>
        <label className="sf-field"><span className="sf-label">Note (staff only – the member never sees it)</span><textarea className="in in-area" name="text" required maxLength={1000} rows={4} /></label>
      </ActionDialog>}
    </div>
  );
}

function ActionDialog({ title, submit, children, onClose, onSubmit, disabled = false }: { title: string; submit: string; children: ReactNode; onClose: () => void; onSubmit: (f: FormData) => void; disabled?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = (el: HTMLDialogElement | null) => { ref.current = el; if (el && !el.open) el.showModal(); };
  return (
    <dialog ref={open} className="modal glass-float" aria-label={title} onClose={onClose} onCancel={onClose}>
      <form method="dialog" className="m-form" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}>
        <h2>{title}</h2>
        {children}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary" disabled={disabled}>{submit}</button></div>
      </form>
    </dialog>
  );
}

function CenterDialog({ m, rules, onClose, onSave }: { m: Member; rules: typeof DEFAULT_CENTER_RULES; onClose: () => void; onSave: (z: ZoneId, c: string, reason: string, proof: string) => void }) {
  const [zone, setZone] = useState<ZoneId>(m.zone);
  const locked = m.centerOverride?.lockedUntil && m.centerOverride.lockedUntil >= new Date().toISOString().slice(0, 10);
  return (
    <ActionDialog title="Change Islamic Center" submit="Save change" onClose={onClose} onSubmit={(f) => onSave(zone, String(f.get('center')), String(f.get('reason')), String(f.get('proof') ?? ''))}>
      <p>{centerRulesInWords(rules)}</p>
      {locked && <p className="notice warn-note" role="alert">This member’s center is locked until {fmtDate(m.centerOverride!.lockedUntil!)}.{rules.unlockOnMove ? ' Only a new address lifts the lock – say so in the reason.' : ''}</p>}
      <p className="muted">Now: {ZONES[m.zone]} zone · {centerOf(m)}</p>
      <div className="field-row">
        <label className="sf-field"><span className="sf-label">Zone</span><select className="in" value={zone} onChange={(e) => setZone(e.target.value as ZoneId)}>{(Object.keys(ZONES) as ZoneId[]).map((z) => <option key={z} value={z}>{ZONES[z]}</option>)}</select></label>
        <label className="sf-field"><span className="sf-label">Islamic Center</span><select className="in" name="center" key={zone}>{centersOf(zone).map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <label className="sf-field"><span className="sf-label">Reason (required, goes in the audit log)</span><textarea className="in in-area" name="reason" required minLength={10} rows={3} placeholder="Moved to a new address / Board approved border request on …" /></label>
      {rules.needsProof && <label className="sf-field"><span className="sf-label">Proof seen (required by the rules)</span><select className="in" name="proof" required defaultValue=""><option value="" disabled>Choose…</option><option>Driver license with the new address</option><option>Utility bill</option><option>Lease or deed</option><option>Government ID</option><option>Other document on file</option></select></label>}
    </ActionDialog>
  );
}

const Def = ({ k, children }: { k: string; children: ReactNode }) => <div className="m-def"><dt>{k}</dt><dd>{children}</dd></div>;

const HIDDEN = <span className="m-hidden">Hidden for your role</span>;
function ProfileTab({ m, fields, onEdit, contact }: { m: Member; fields: ProfileField[]; onEdit?: () => void; contact: boolean }) {
  return (
    <section className="panel glass-pane" aria-label="Profile">
      <dl className="m-defs">
        <Def k="Email">{contact ? <a href={`mailto:${m.email}`}>{m.email}</a> : HIDDEN}</Def>
        <Def k="Mobile">{contact ? <a href={`tel:+1${digits(m.phone)}`}>{m.phone}</a> : HIDDEN}</Def>
        <Def k="Date of birth">{contact ? <>{fmtDate(m.dob)} · age {ageOn(m.dob, new Date().toISOString().slice(0, 10))}</> : <>age {ageOn(m.dob, new Date().toISOString().slice(0, 10))}</>}</Def>
        <Def k="Home address">{contact ? <>{m.street}<br />{cityLine(m)}</> : <>{[m.city, m.state].filter(Boolean).join(', ')}</>}</Def>
        <Def k="Zone and center">{ZONES[m.zone]} · {centerOf(m)}{m.centerOverride && <small className="m-sub">Changed: {m.centerOverride.reason}{m.centerOverride.lockedUntil ? ` · locked until ${fmtDate(m.centerOverride.lockedUntil)}` : ''}</small>}</Def>
        <Def k="Commitment">{COMMITMENT_LABEL[m.commitment]}</Def>
        <Def k="Applied">{fmtDate(m.appliedOn)}</Def>
        <Def k="Approved">{m.approvedOn ? fmtDate(m.approvedOn) : 'Not yet'}</Def>
      </dl>
      {fields.length > 0 && <ExtraFields m={m} fields={fields} onEdit={onEdit} />}
    </section>
  );
}

const LOCK = <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
/** Extra fields: filled ones first; empty ones wait behind one button so the page stays short. */
function ExtraFields({ m, fields, onEdit }: { m: Member; fields: ProfileField[]; onEdit?: () => void }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const filled = (f: ProfileField) => { const v = m.extra?.[f.id]; return v !== undefined && v !== '' && v !== null; };
  const empty = fields.filter((f) => !filled(f)).length;
  const who = (f: ProfileField) => [f.access === 'admins' ? 'Admins only' : f.access === 'members' ? 'Members can see' : 'Public', f.memberEditable ? 'member can edit' : '', f.inDirectory ? 'in directory' : ''].filter(Boolean).join(' · ');
  return (
    <div className="m-extra">
      <div className="m-extra-head"><h3>More details</h3>{onEdit && <button type="button" className="btn sm" onClick={onEdit}>Edit details</button>}</div>
      {empty === fields.length && <p className="muted m-extra-none">Nothing filled in yet.</p>}
      <dl className="m-defs">{fields.map((f) => (
        <div key={f.id} className="m-def" hidden={!filled(f) && !showEmpty}>
          <dt>{f.label}<span className={`m-who-sees${f.access === 'admins' ? ' admins' : ''}`} title={who(f)}>{f.access === 'admins' && LOCK}<span className="sr-only">{who(f)}</span></span></dt>
          <dd>{f.type === 'file' ? (m.extra?.[f.id] ? 'File on record' : 'No file') : showValue(f, m.extra?.[f.id])}</dd>
        </div>
      ))}</dl>
      {empty > 0 && <button type="button" className="linkish m-empty-toggle" onClick={() => setShowEmpty((x) => !x)}>{showEmpty ? 'Hide empty fields' : `Show ${empty} empty field${empty === 1 ? '' : 's'}`}</button>}
    </div>
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
        <ul className="history">{[...m.notes].reverse().map((n) => <li key={n.at}><div><b>{n.text}</b><span>{n.by} · {new Date(n.at).toLocaleString('en-US', { timeZone: ORG_TZ, dateStyle: 'medium', timeStyle: 'short' })}</span></div></li>)}</ul>
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
        <li key={i}><span className="tl-dot" aria-hidden="true" /><div><b>{a.action}</b> <span>{a.detail}</span><small>{a.by} · {a.at.length > 10 ? new Date(a.at).toLocaleString('en-US', { timeZone: ORG_TZ, dateStyle: 'medium', timeStyle: 'short' }) : fmtDate(a.at)}</small></div></li>
      ))}</ol>
    </section>
  );
}

function FieldsDialog({ m, fields, onClose, onSave }: { m: Member; fields: ProfileField[]; onClose: () => void; onSave: (v: FieldValues, changed: string[]) => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editable = fields.filter((f) => canEdit(f, 'admin'));
  return (
    <ActionDialog title="Edit details" submit="Save details" onClose={onClose} onSubmit={(fd) => {
      const input: Record<string, unknown> = {};
      for (const f of editable) input[f.id] = f.type === 'yesno' ? fd.get(f.id) === 'yes' : String(fd.get(f.id) ?? '');
      const r = checkValues(fields, input, 'admin', m.extra ?? {});
      setErrors(r.errors);
      if (r.ok) { if (r.changed.length) onSave(r.values, r.changed); else onClose(); }
    }}>
      <p>Extra fields from Settings › Configuration › Profile fields. Admin-only values are never shown to the member, and their values are not written to the audit log.</p>
      {editable.map((f) => { const v = m.extra?.[f.id]; const id = `xf-${f.id}`; return (
        <label key={f.id} className="sf-field" htmlFor={id}><span className="sf-label">{f.label}{f.required ? ' (required)' : ''}</span>
          {f.type === 'choice' ? <select id={id} className="in" name={f.id} defaultValue={String(v ?? '')}><option value="">—</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
            : f.type === 'yesno' ? <select id={id} className="in" name={f.id} defaultValue={v === true ? 'yes' : 'no'}><option value="no">No</option><option value="yes">Yes</option></select>
            : <input id={id} className="in" name={f.id} defaultValue={v === undefined ? '' : String(v)} type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'} aria-invalid={!!errors[f.id]} />}
          {errors[f.id] && <small className="sf-err" role="alert">{errors[f.id]}</small>}
        </label>
      ); })}
      {fields.some((f) => f.type === 'file') && <p className="muted">File fields (like the paper membership form) are uploaded to private storage in the BE phase.</p>}
    </ActionDialog>
  );
}
