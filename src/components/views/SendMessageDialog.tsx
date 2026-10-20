'use client';
/** Profile › Send a message: an email or text to this one member, through the same bulk-message pipeline (preferences,
 *  footer, audit, delivery row) – POST /admin/messages with audience.memberIds, then send. Live only. */
import { useState, type FormEvent } from 'react';
import { be } from '@/lib/live/live';

export function SendMessageDialog({ memberId, name, email, phone, onClose, onSent }: { memberId: string; name: string; email: string; phone: string; onClose: () => void; onSent: (what: string) => void }) {
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(`Assalamu alaikum ${name.split(' ')[0]},\n\n`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (channel === 'email' && !subject.trim()) return setErr('Write a subject.');
    if (!body.trim()) return setErr('Write the message.');
    setBusy(true);
    const d = await be<{ id: string }>('POST', 'admin/messages', { name: `To ${name}`, channel, topic: 'membership', subject: channel === 'email' ? subject.trim() : '', body: body.trim(), audience: { everyone: false, groupIds: [], excludeGroupIds: [], memberIds: [memberId] } });
    if (!d.ok) { setBusy(false); setErr(d.message); return; }
    const s = await be<{ sent?: number; skipped?: Record<string, number> }>('POST', `admin/messages/${d.data.id}/send`, {});
    setBusy(false);
    if (!s.ok) { setErr(s.message); return; }
    if (!s.data.sent) { const why = Object.entries(s.data.skipped ?? {}).filter(([, n]) => n).map(([k]) => k).join(', '); setErr(`Not sent – ${why === 'unsubscribed' ? 'this member chose not to get membership messages' : why === 'no-address' ? `no ${channel === 'email' ? 'email' : 'mobile number'} on file` : why === 'no-consent' ? 'this member did not agree to texts' : why || 'the member was skipped'}.`); return; }
    onSent(channel === 'email' ? `Email sent to ${email}.` : `Text sent to ${phone}.`);
  };
  return (
    <dialog ref={open} className="modal glass-float" aria-label="Send a message" onClose={onClose} onCancel={onClose}>
      <form method="dialog" className="m-form" onSubmit={(e) => void submit(e)} noValidate>
        <h2>Message {name}</h2>
        <div className="choice-row">
          <label className={`choice${channel === 'email' ? ' on' : ''}`}><input type="radio" name="ch" checked={channel === 'email'} onChange={() => setChannel('email')} /> <span><b>Email</b><small>{email || 'no email on file'}</small></span></label>
          <label className={`choice${channel === 'sms' ? ' on' : ''}`}><input type="radio" name="ch" checked={channel === 'sms'} onChange={() => setChannel('sms')} /> <span><b>Text</b><small>{phone || 'no mobile on file'}</small></span></label>
        </div>
        {channel === 'email' && <label className="sf-field"><span className="sf-label">Subject</span><input className="in" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} /></label>}
        <label className="sf-field"><span className="sf-label">Message</span><textarea className="in" rows={channel === 'email' ? 8 : 4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={channel === 'sms' ? 480 : 10000} /></label>
        <p className="muted small">{channel === 'email' ? 'The organization’s footer and the preference link are added. Pictures: use Communication › Messages.' : 'Texts cost per 160 characters and respect quiet hours.'} Kept in the audit log.</p>
        {err && <p className="sf-err" role="alert">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Sending…' : channel === 'email' ? 'Send email' : 'Send text'}</button></div>
      </form>
    </dialog>
  );
}
