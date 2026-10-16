'use client';
/**
 * A11 Settings › Integrations: email gateway, text messages, Stripe and Google sign-in. Each card shows its status
 * (Live · Test · Off · Needs attention), a readiness checklist (including what other modules expect), the provider
 * and mode, masked keys (only the last 4 are ever kept here), the webhook address, and a test send through the
 * fake adapter. Changing a provider, a mode or a key needs a second admin's approval (checked by the server too).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel } from '@/components/editor/bits';
import {
  EMAIL_PROVIDERS, SMS_PROVIDERS, checkKey, fakeSend, masked, readiness, sensitiveChanges, webhookUrl,
  type IntegrationsDoc, type Ready,
} from '@/lib/integrations/integrations';
import type { CommunicationDoc } from '@/lib/community/communication';
import type { OrgConfig } from '@/lib/community/org-config';
import { useAccess } from '@/lib/access/use-access';
import { can as canDo } from '@/lib/access/access';
import { logAudit } from '@/lib/access/audit';
import { useOrg } from '@/lib/platform/use-org';

type IDoc = { draft: IntegrationsDoc; base: IntegrationsDoc; setDraft: (f: IntegrationsDoc | ((d: IntegrationsDoc) => IntegrationsDoc)) => void; issues: Record<string, string> };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const STATUS = { live: 'Live', test: 'Test mode', off: 'Off', problem: 'Needs attention' } as const;
function useStore<T>(key: string) {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => { void fetch(`/api/store/${key}`).then((r) => (r.ok ? r.json() : null)).then((j) => setV(j?.data ?? null)).catch(() => {}); }, [key]);
  return v;
}

export function IntegrationsView() {
  return (
    <DocEditor<IntegrationsDoc> storeKey="integrations" title="Integrations" preview={false}
      intro="How the system sends email and texts, takes payments and lets people sign in with Google. Keys are stored encrypted on the server – this page only ever shows the last 4 characters. A change to a provider, mode or key needs a second admin.">
      {(doc) => <Body doc={doc as unknown as IDoc} />}
    </DocEditor>
  );
}

function Body({ doc }: { doc: IDoc }) {
  const d = doc.draft;
  const comm = useStore<CommunicationDoc>('communication');
  const cfg = useStore<OrgConfig>('org-config');
  const access = useAccess();
  const { me } = useOrg();
  const ready = readiness(d, { smsOn: !!comm?.sms.enabled, smsPurposes: comm?.sms.purposes ?? [], cardOn: !!cfg?.payments.card, achOn: !!cfg?.payments.ach, googleOnSite: true });
  const changes = sensitiveChanges(doc.base, d);
  const approvers = access.doc.admins.filter((a) => a.id !== access.me?.id && canDo(access.doc, a, 'integrations.manage', today()));
  const set = <K extends keyof IntegrationsDoc>(k: K, patch: Partial<IntegrationsDoc[K]>) => doc.setDraft((x) => ({ ...x, [k]: { ...(x[k] as object), ...patch } }));
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const org = me?.org.slug ?? 'isgh';
  const card = (id: Ready['id']) => ready.find((r) => r.id === id)!;
  return (
    <div className="cv integ">
      <div className="integ-sum" role="list" aria-label="Status">
        {ready.map((r) => <a key={r.id} href={`#int-${r.id}`} role="listitem" className={`integ-chip st-${r.status}`} data-int={r.id}><b>{r.title}</b><span>{STATUS[r.status]}</span></a>)}
      </div>
      {changes.length > 0 && (
        <section className="notice warn-note integ-approve" aria-label="Second admin approval">
          <b>These changes need a second admin before they can be published:</b>
          <ul>{changes.map((c) => <li key={c}>{c}</li>)}</ul>
          <label className="sf-field"><span className="sf-label">Approved by</span>
            <select className="in" value={d.lastChange?.summary === changes.join('; ') ? d.lastChange.approvedBy : ''} onChange={(e) => doc.setDraft((x) => ({ ...x, lastChange: e.target.value ? { summary: changes.join('; '), requestedBy: access.me?.id ?? '', approvedBy: e.target.value, at: new Date().toISOString() } : undefined }))}>
              <option value="">Choose an admin…</option>{approvers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select></label>
          <small className="muted">Demo: picking a name stands in for that admin approving on their own screen (BE: they get a request and approve it themselves).</small>
        </section>
      )}

      <Card r={card('email')} id="email" on={d.email.enabled} onToggle={(v) => set('email', { enabled: v })}>
        <div className="integ-grid">
          <Sel label="Provider" value={d.email.provider} options={EMAIL_PROVIDERS} onChange={(v) => set('email', { provider: v as IntegrationsDoc['email']['provider'] })} err={doc.issues['email.provider']} />
          <Mode value={d.email.mode} onChange={(v) => set('email', { mode: v })} />
          <Field label="Your domain" value={d.email.domain} onChange={(v) => set('email', { domain: v })} err={doc.issues['email.domain']} />
          <Field label="Sender for receipts, codes and reminders" value={d.email.fromTransactional} onChange={(v) => set('email', { fromTransactional: v })} err={doc.issues['email.fromTransactional']} />
          <Field label="Sender for newsletters and announcements" value={d.email.fromBulk} onChange={(v) => set('email', { fromBulk: v })} err={doc.issues['email.fromBulk']} />
          <Key label="API key" kind={`email:${d.email.provider}`} value={d.email.apiKey} onSet={(s) => set('email', { apiKey: s })} err={doc.issues['email.apiKey']} />
          <Key label="Webhook signing secret" kind="webhook" value={d.email.webhookSecret} onSet={(s) => set('email', { webhookSecret: s })} err={doc.issues['email.webhookSecret']} />
          <Hook url={webhookUrl(origin, org, 'email')} />
          <fieldset className="sf-field integ-dns"><legend className="sf-label">DNS records (BE checks them; demo: set by hand)</legend>
            {(['spf', 'dkim', 'dmarc'] as const).map((k) => <label key={k}>{k.toUpperCase()} <select className="in pill-select" value={d.email.dns[k]} onChange={(e) => set('email', { dns: { ...d.email.dns, [k]: e.target.value as 'ok' } })}><option value="unknown">Not checked</option><option value="ok">Found</option><option value="missing">Missing</option></select></label>)}
          </fieldset>
          <Sel label="Backup provider (if the main one fails)" value={d.fallback.emailProvider ?? ''} options={{ '': 'None', ...EMAIL_PROVIDERS }} onChange={(v) => set('fallback', { emailProvider: (v || null) as IntegrationsDoc['fallback']['emailProvider'] })} err={doc.issues['fallback.emailProvider']} />
        </div>
        <TestSend kind="email" d={d} placeholder="you@example.com" />
      </Card>

      <Card r={card('sms')} id="sms" on={d.sms.enabled} onToggle={(v) => set('sms', { enabled: v })}>
        <div className="integ-grid">
          <Sel label="Provider" value={d.sms.provider} options={SMS_PROVIDERS} onChange={(v) => set('sms', { provider: v as IntegrationsDoc['sms']['provider'] })} err={doc.issues['sms.provider']} />
          <Mode value={d.sms.mode} onChange={(v) => set('sms', { mode: v })} />
          <Field label="Sending number" value={d.sms.from} onChange={(v) => set('sms', { from: v })} err={doc.issues['sms.from']} />
          <Sel label="Carrier registration" value={d.sms.registration.type} options={{ '10dlc': '10DLC (local number)', 'toll-free': 'Toll-free verification', 'short-code': 'Short code', none: 'None yet' }} onChange={(v) => set('sms', { registration: { ...d.sms.registration, type: v as '10dlc' } })} err={doc.issues['sms.registration.type']} />
          <Sel label="Registration status" value={d.sms.registration.status} options={{ 'not-started': 'Not started', pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }} onChange={(v) => set('sms', { registration: { ...d.sms.registration, status: v as 'approved' } })} err={doc.issues['sms.registration.status']} />
          <Key label="API key / auth token" kind={`sms:${d.sms.provider}`} value={d.sms.apiKey} onSet={(s) => set('sms', { apiKey: s })} err={doc.issues['sms.apiKey']} />
          <Key label="Webhook signing secret" kind="webhook" value={d.sms.webhookSecret} onSet={(s) => set('sms', { webhookSecret: s })} />
          <Hook url={webhookUrl(origin, org, 'sms')} />
          <p className="muted integ-note">Texts go to US numbers only (blocks SMS pumping fraud). Quiet hours and consent text are in Communication › Sending and text messages.</p>
        </div>
        <TestSend kind="sms" d={d} placeholder="+17135550100" quiet={comm?.sms.quietHours} />
      </Card>

      <Card r={card('stripe')} id="stripe" on={d.stripe.enabled} onToggle={(v) => set('stripe', { enabled: v })}>
        <div className="integ-grid">
          <Mode value={d.stripe.mode} onChange={(v) => set('stripe', { mode: v })} />
          <Field label="Publishable key" value={d.stripe.publishableKey} onChange={(v) => set('stripe', { publishableKey: v.trim() })} err={doc.issues['stripe.publishableKey']} />
          <Key label="Secret key" kind={`stripe:${d.stripe.mode}`} value={d.stripe.secretKey} onSet={(s) => set('stripe', { secretKey: s })} err={doc.issues['stripe.secretKey']} />
          <Key label="Webhook signing secret" kind="webhook" value={d.stripe.webhookSecret} onSet={(s) => set('stripe', { webhookSecret: s })} err={doc.issues['stripe.webhookSecret']} />
          <Hook url={webhookUrl(origin, org, 'stripe')} />
          <Field label="Statement descriptor (on bank statements)" value={d.stripe.statementDescriptor} onChange={(v) => set('stripe', { statementDescriptor: v })} err={doc.issues['stripe.statementDescriptor']} />
          <label className="check"><input type="checkbox" checked={d.stripe.ach} onChange={(e) => set('stripe', { ach: e.target.checked })} /> <span>Bank transfer (ACH) is turned on in Stripe</span></label>
          <label className="check"><input type="checkbox" checked={d.stripe.applePayDomainVerified} onChange={(e) => set('stripe', { applePayDomainVerified: e.target.checked })} /> <span>Apple Pay domain verified</span></label>
        </div>
        <TestSend kind="stripe" d={d} />
      </Card>

      <Card r={card('google')} id="google" on={d.google.enabled} onToggle={(v) => set('google', { enabled: v })}>
        <div className="integ-grid">
          <Field label="Client ID" value={d.google.clientId} onChange={(v) => set('google', { clientId: v.trim() })} err={doc.issues['google.clientId']} />
          <Key label="Client secret" kind="google" value={d.google.clientSecret} onSet={(s) => set('google', { clientSecret: s })} />
          <Field label="Redirect addresses (one per line)" area value={d.google.redirectUris.join('\n')} onChange={(v) => set('google', { redirectUris: v.split('\n').map((x) => x.trim()).filter(Boolean) })} err={Object.entries(doc.issues).find(([k]) => k.startsWith('google.redirectUris'))?.[1]} />
        </div>
      </Card>
    </div>
  );
}

function Card({ r, id, on, onToggle, children }: { r: Ready; id: string; on: boolean; onToggle: (v: boolean) => void; children: ReactNode }) {
  return (
    <Panel title={r.title}>
      <section id={`int-${id}`} className={`integ-card st-${r.status}`} data-card={id}>
        <div className="integ-head"><span className={`pill integ-status st-${r.status}`}>{STATUS[r.status]}</span>
          <label className="switch"><input type="checkbox" role="switch" aria-label={`Use ${r.title}`} checked={on} onChange={(e) => onToggle(e.target.checked)} /><span className="track" aria-hidden="true"><span className="thumb" /></span></label></div>
        <ul className="integ-checks">{r.checks.map((c) => <li key={c.label} className={`c-${c.state}`}><span aria-hidden="true">{c.state === 'ok' ? '✓' : c.state === 'warn' ? '!' : '✕'}</span><span>{c.label}{c.help && <small className="block">{c.help}</small>}</span><span className="sr-only">{c.state === 'ok' ? 'done' : c.state === 'warn' ? 'check' : 'missing'}</span></li>)}</ul>
        {children}
      </section>
    </Panel>
  );
}
function Field({ label, value, onChange, err, area }: { label: string; value: string; onChange: (v: string) => void; err?: string; area?: boolean }) {
  return <label className="sf-field"><span className="sf-label">{label}</span>{area ? <textarea className="in in-area" rows={3} value={value} onChange={(e) => onChange(e.target.value)} /> : <input className="in" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!err} />}{err && <small className="sf-err">{err}</small>}</label>;
}
function Sel({ label, value, options, onChange, err }: { label: string; value: string; options: Record<string, string>; onChange: (v: string) => void; err?: string }) {
  return <label className="sf-field"><span className="sf-label">{label}</span><select className="in" value={value} onChange={(e) => onChange(e.target.value)}>{Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>{err && <small className="sf-err">{err}</small>}</label>;
}
function Mode({ value, onChange }: { value: 'test' | 'live'; onChange: (v: 'test' | 'live') => void }) {
  return <div className="sf-field"><span className="sf-label">Mode</span><div className="seg" role="radiogroup" aria-label="Mode">{(['test', 'live'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={value === m} onClick={() => onChange(m)}>{m === 'test' ? 'Test' : 'Live'}</button>)}</div></div>;
}
/** A key is typed once, checked for shape, and only its last 4 characters are kept. */
function Key({ label, kind, value, onSet, err }: { label: string; kind: string; value?: { last4: string; setAt: string; setBy: string }; onSet: (s: { last4: string; setAt: string; setBy: string } | undefined) => void; err?: string }) {
  const [v, setV] = useState(''); const [msg, setMsg] = useState('');
  const access = useAccess();
  return (
    <div className="sf-field integ-key"><span className="sf-label">{label}</span>
      <p className="integ-key-now">{masked(value)}{value && <small className="muted"> · set {value.setAt.slice(5, 7)}/{value.setAt.slice(8, 10)}/{value.setAt.slice(0, 4)} by {value.setBy}</small>}</p>
      <div className="integ-key-row">
        <input className="in" type="password" autoComplete="off" spellCheck={false} aria-label={`New ${label}`} placeholder={value ? 'Paste a new key to replace it' : 'Paste the key'} value={v} onChange={(e) => { setV(e.target.value); setMsg(''); }} />
        <button type="button" className="btn sm" disabled={!v} onClick={() => { const r = checkKey(kind, v, access.me?.name ?? 'Admin', today()); if (!r.ok) { setMsg(r.message); return; } onSet(r.secret); setV(''); setMsg('Key accepted – only the last 4 characters are kept here.'); logAudit({ area: 'access', action: `${label} replaced`, detail: `${kind} ••••${r.secret.last4}` }); }}>Save key</button>
        {value && <button type="button" className="btn sm ghost" onClick={() => { onSet(undefined); setMsg('Key removed.'); }}>Remove</button>}
      </div>
      {(msg || err) && <small className={msg.startsWith('Key accepted') || msg === 'Key removed.' ? 'muted' : 'sf-err'} role="status">{msg || err}</small>}
    </div>
  );
}
function Hook({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return <div className="sf-field"><span className="sf-label">Webhook address (paste it in the provider)</span><div className="integ-key-row"><code className="integ-hook">{url}</code><button type="button" className="btn sm" onClick={() => { void navigator.clipboard?.writeText(url).catch(() => {}); setOk(true); window.setTimeout(() => setOk(false), 1500); }}>{ok ? 'Copied' : 'Copy'}</button></div></div>;
}
function TestSend({ kind, d, placeholder, quiet }: { kind: 'email' | 'sms' | 'stripe'; d: IntegrationsDoc; placeholder?: string; quiet?: { from: string; to: string } }) {
  const [to, setTo] = useState(''); const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  const label = kind === 'email' ? 'Send a test email' : kind === 'sms' ? 'Send a test text' : 'Run a $1 test payment';
  return (
    <div className="integ-test">
      {kind !== 'stripe' && <input className="in" aria-label={kind === 'email' ? 'Test email address' : 'Test mobile number'} placeholder={placeholder} value={to} onChange={(e) => setTo(e.target.value)} />}
      <button type="button" className="btn sm" onClick={() => { const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit' }); const r = fakeSend(kind, to.trim(), d, now, quiet); setRes(r); if (r.ok) logAudit({ area: 'messages', action: label, detail: r.message }); }}>{label}</button>
      {res && <p className={`integ-res ${res.ok ? 'ok' : 'bad'}`} role="status">{res.message}</p>}
    </div>
  );
}
