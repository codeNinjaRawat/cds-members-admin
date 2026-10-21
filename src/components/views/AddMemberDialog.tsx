'use client';
/**
 * Add a member by hand (walk-in, phone, a paper form). POST /admin/members: the API places the person by ZIP, checks for
 * a look-alike record (409 → "add anyway") and writes the audit line. Nothing is lost on an error – the form stays filled.
 */
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { be } from '@/lib/live/live';
import { orgPlans, refreshLive } from '@/lib/members/members';
import { US_STATES } from '@/lib/join/schema';

type Form = { first: string; middle: string; last: string; email: string; phone: string; dob: string; street: string; city: string; state: string; zip: string; plan: string; idNumber: string; approved: boolean };
const EMPTY: Form = { first: '', middle: '', last: '', email: '', phone: '', dob: '', street: '', city: '', state: 'TX', zip: '', plan: '', idNumber: '', approved: true };

export function AddMemberDialog({ onClose, onAdded, initial }: { onClose: () => void; onAdded: (id: string) => void; initial?: Partial<Form> }) {
  const router = useRouter();
  const plans = orgPlans().filter((p) => p.visible !== false);
  const [f, setF] = useState<Form>({ ...EMPTY, plan: plans[0]?.id ?? '', ...initial });   // initial: from People – a contact becoming a member
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [dup, setDup] = useState<string | null>(null);   // the API's duplicate warning – "Add anyway" sends force
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const up = (k: keyof Form) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const err = (k: string) => issues[k];

  const check = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!f.first.trim()) e.first = 'Enter the first name.';
    if (!f.last.trim()) e.last = 'Enter the last name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Enter a valid email, like name@example.com.';
    if (f.phone && f.phone.replace(/\D/g, '').replace(/^1/, '').length !== 10) e.phone = 'Enter all 10 digits, like (713) 555-0123.';
    if (f.dob && !/^\d{4}-\d{2}-\d{2}$/.test(f.dob)) e.dob = 'Enter the date of birth.';
    if (!/^\d{5}(-\d{4})?$/.test(f.zip.trim())) e.zip = 'Enter a 5-digit ZIP code.';
    if (!f.plan) e.plan = 'Choose a plan.';
    return e;
  };

  const submit = async (e: FormEvent, force = false) => {
    e.preventDefault(); setError(null); setDup(null);
    const e1 = check(); setIssues(e1); if (Object.keys(e1).length) return;
    setBusy(true);
    const body = { first: f.first.trim(), middle: f.middle.trim(), last: f.last.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1'), dob: f.dob, street: f.street.trim(), city: f.city.trim(), state: f.state, zip: f.zip.trim().slice(0, 5), plan: f.plan, approved: f.approved, force, extra: f.idNumber.trim() ? { idNumber: f.idNumber.trim() } : {} };
    const r = await be<{ id: string }>('POST', 'admin/members', body);
    setBusy(false);
    if (r.ok) { await refreshLive(r.data.id); onAdded(r.data.id); router.push(`/members/${r.data.id}`); return; }
    if (r.status === 409 && /already/i.test(r.message)) { setDup(r.message); return; }
    const detail = Array.isArray(r.data.detail) ? (r.data.detail as { path?: string; message?: string }[]) : [];
    if (detail.length) setIssues(Object.fromEntries(detail.map((d) => [String(d.path ?? ''), String(d.message ?? 'Check this.')])));
    setError(r.message);
  };

  const field = (k: keyof Form, label: string, props: Record<string, unknown> = {}, hint?: string) => (
    <label className={`sf-field${err(k) ? ' has-err' : ''}`}><span className="sf-label">{label}</span>
      <input className="in" value={String(f[k])} onChange={up(k)} aria-invalid={!!err(k) || undefined} {...props} />
      {hint && !err(k) && <small className="sf-hint">{hint}</small>}{err(k) && <small className="sf-err" role="alert">{err(k)}</small>}
    </label>
  );

  return (
    <dialog ref={open} className="modal glass-float modal-wide" aria-label="Add a member" onClose={onClose} onCancel={onClose}>
      <form method="dialog" className="m-form" onSubmit={(e) => void submit(e)} noValidate>
        <h2>Add a member</h2>
        <p className="muted small">For a walk-in, a phone call or a paper form. The person is placed in the Islamic Center of their ZIP and gets the usual emails.</p>
        <div className="grid-3">
          {field('first', 'First name', { autoComplete: 'off', required: true })}
          {field('middle', 'Middle name', { autoComplete: 'off' })}
          {field('last', 'Last name', { autoComplete: 'off', required: true })}
        </div>
        <div className="grid-3">
          {field('email', 'Email', { type: 'email', autoComplete: 'off', required: true }, 'Their sign-in and receipts.')}
          {field('phone', 'Mobile phone', { type: 'tel', inputMode: 'tel', placeholder: '(713) 555-0123' })}
          {field('dob', 'Date of birth', { type: 'date', max: new Date().toISOString().slice(0, 10) })}
        </div>
        <div className="grid-3">
          {field('street', 'Street address', { autoComplete: 'off' })}
          {field('city', 'City', { autoComplete: 'off' })}
          <label className="sf-field"><span className="sf-label">State</span>
            <select className="in" value={f.state} onChange={up('state')}>{US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        </div>
        <div className="grid-3">
          {field('zip', 'ZIP code', { inputMode: 'numeric', required: true }, 'Decides the zone and Islamic Center.')}
          <label className={`sf-field${err('plan') ? ' has-err' : ''}`}><span className="sf-label">Plan</span>
            <select className="in" value={f.plan} onChange={up('plan')} aria-invalid={!!err('plan') || undefined}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {err('plan') && <small className="sf-err" role="alert">{err('plan')}</small>}</label>
          {field('idNumber', 'Driver license or ID card number', { autoComplete: 'off' }, 'Optional – kept on the record, admins only.')}
        </div>
        <label className="check"><input type="checkbox" checked={f.approved} onChange={(e) => setF((x) => ({ ...x, approved: e.target.checked }))} /> <span>Approved now (added at the desk). Untick to put them in the Applications queue instead.</span></label>
        {dup && <div className="callout" data-tone="warn" role="alert"><p>{dup}</p><p>Open <a href="/queues" target="_blank" rel="noreferrer">Possible duplicates</a> to compare, or add this person anyway.</p></div>}
        {error && !dup && <p className="sf-err" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          {dup ? <button type="button" className="btn primary" disabled={busy} onClick={(e) => void submit(e as unknown as FormEvent, true)}>Add anyway</button>
            : <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add member'}</button>}
        </div>
      </form>
    </dialog>
  );
}
