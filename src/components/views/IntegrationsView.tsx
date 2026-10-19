'use client';
/**
 * A11 Settings › Integrations: email gateway, text messages, Stripe and Google sign-in. Each card shows its status
 * (Live · Test · Off · Needs attention), a readiness checklist (including what other modules expect), the provider
 * and mode, masked keys (only the last 4 are ever kept here), the webhook address, and a test send through the
 * fake adapter. Changing a provider, a mode or a key needs a second admin's approval (checked by the server too).
 */
import { ORG_TZ } from '@/lib/members/members';
import { useEffect, useState, type ReactNode } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel } from '@/components/editor/bits';
import {
  GIVING_PROVIDERS, EMAIL_PROVIDERS, SMS_PROVIDERS, checkKey, fakeSend, masked, readiness, sensitiveChanges, webhookUrl,
  type IntegrationsDoc, type Ready,
} from '@/lib/integrations/integrations';
import type { CommunicationDoc } from '@/lib/community/communication';
import type { OrgConfig } from '@/lib/community/org-config';
import { mockOrgStructure, type OrgStructure } from '@/lib/community/org-structure';
import { useAccess } from '@/lib/access/use-access';
import { can as canDo } from '@/lib/access/access';
import { logAudit } from '@/lib/access/audit';
import { useOrg } from '@/lib/platform/use-org';

type IDoc = { draft: IntegrationsDoc; base: IntegrationsDoc; setDraft: (f: IntegrationsDoc | ((d: IntegrationsDoc) => IntegrationsDoc)) => void; issues: Record<string, string> };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
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

      <Giving doc={doc} r={card('giving')} origin={origin} org={org} />

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

/** I1 Giving platforms: accounts – one for the organization or a masjid's own (Zeffy, PayPal Giving, Bloomerang…). */
function Giving({ doc, r, origin, org }: { doc: IDoc; r: Ready; origin: string; org: string }) {
  const d = doc.draft;
  const map = useStore<OrgStructure>('org-structure') ?? mockOrgStructure;
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<{ provider: keyof typeof GIVING_PROVIDERS; label: string; scope: 'organization' | 'center'; center: string; formUrl: string }>({ provider: 'zeffy', label: '', scope: 'organization', center: map.centers[0]?.name ?? '', formUrl: '' });
  const up = (i: number, patch: Partial<IntegrationsDoc['giving']['accounts'][number]>) => doc.setDraft((x) => ({ ...x, giving: { accounts: x.giving.accounts.map((a, k) => (k === i ? { ...a, ...patch } : a)) } }));
  const add = () => {
    const base = `${f.provider}-${(f.scope === 'center' ? f.center : 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 36);
    let id = base; let n = 2; while (d.giving.accounts.some((a) => a.id === id)) id = `${base}-${n++}`;
    doc.setDraft((x) => ({ ...x, giving: { accounts: [...x.giving.accounts, { id, provider: f.provider, enabled: true, label: f.label.trim() || `${f.scope === 'center' ? f.center : 'Organization'} – ${GIVING_PROVIDERS[f.provider]}`, scope: f.scope, center: f.scope === 'center' ? f.center : '', formUrl: f.formUrl.trim(), lastSync: '' }] } }));
    setAdding(false); setF({ ...f, label: '', formUrl: '' });
  };
  const err = (i: number, k: string) => doc.issues[`giving.accounts.${i}.${k}`];
  return (
    <Panel title="Giving platforms" intro="Where online gifts come from besides Stripe: Zeffy, PayPal Giving, Bloomerang, Givelify, a kiosk… One account for the whole organization, or a masjid's own account – both can exist side by side. Gifts land in Donations under the masjid of the account.">
      <section id="int-giving" className={`integ-card st-${r.status}`} data-card="giving">
        <div className="integ-head"><span className={`pill integ-status st-${r.status}`}>{STATUS[r.status]}</span><span className="muted small">{d.giving.accounts.length} account{d.giving.accounts.length === 1 ? '' : 's'}</span></div>
        <ul className="integ-checks">{r.checks.map((c) => <li key={c.label} className={`c-${c.state}`}><span aria-hidden="true">{c.state === 'ok' ? '✓' : c.state === 'warn' ? '!' : '✕'}</span><span>{c.label}{c.help && <small className="block">{c.help}</small>}</span></li>)}</ul>
        <ul className="integ-accounts">{d.giving.accounts.map((a, i) => (
          <li key={a.id} className={`integ-account${a.enabled ? '' : ' off'}`} data-account={a.id}>
            <div className="integ-acc-head">
              <b>{a.label}</b><span className="pill">{GIVING_PROVIDERS[a.provider]}</span><span className="pill">{a.scope === 'center' ? a.center : 'Organization'}</span>
              <label className="switch"><input type="checkbox" role="switch" aria-label={`Use ${a.label}`} checked={a.enabled} onChange={(e) => up(i, { enabled: e.target.checked })} /><span className="track" aria-hidden="true"><span className="thumb" /></span></label>
              <button type="button" className="btn sm ghost" onClick={() => doc.setDraft((x) => ({ ...x, giving: { accounts: x.giving.accounts.filter((_, k) => k !== i) } }))}>Remove<span className="sr-only"> {a.label}</span></button>
            </div>
            <div className="integ-grid">
              <Field label="Account name" value={a.label} onChange={(v) => up(i, { label: v })} err={err(i, 'label')} />
              {a.scope === 'center' && <Sel label="Masjid" value={a.center} options={Object.fromEntries(map.centers.map((c) => [c.name, c.name]))} onChange={(v) => up(i, { center: v })} err={err(i, 'center')} />}
              <Field label="Giving form address (shown on the website)" value={a.formUrl} onChange={(v) => up(i, { formUrl: v.trim() })} err={err(i, 'formUrl')} />
              <Key label="API key" kind="giving" value={a.apiKey} onSet={(s) => up(i, { apiKey: s })} err={err(i, 'apiKey')} />
              <Key label="Webhook signing secret" kind="webhook" value={a.webhookSecret} onSet={(s) => up(i, { webhookSecret: s })} />
              <Hook url={webhookUrl(origin, org, `giving/${a.id}`)} />
              {err(i, 'provider') && <p className="sf-err" role="alert">{err(i, 'provider')}</p>}
              <p className="muted small">{a.lastSync ? `Last sync ${new Date(a.lastSync).toLocaleString('en-US', { timeZone: ORG_TZ, dateStyle: 'medium', timeStyle: 'short' })}` : 'Never synced'} · {a.apiKey ? 'gifts and payouts are read from the platform' : 'without a key, import the platform’s export in Donations'}.</p>
            </div>
          </li>
        ))}</ul>
        {!adding ? <button type="button" className="btn sm" onClick={() => setAdding(true)}>+ Add an account</button> : (
          <form className="integ-grid integ-add" onSubmit={(e) => { e.preventDefault(); add(); }} aria-label="New giving account">
            <Sel label="Platform" value={f.provider} options={GIVING_PROVIDERS} onChange={(v) => setF({ ...f, provider: v as keyof typeof GIVING_PROVIDERS })} />
            <Sel label="Belongs to" value={f.scope} options={{ organization: 'The whole organization', center: 'One masjid' }} onChange={(v) => setF({ ...f, scope: v as 'organization' | 'center' })} />
            {f.scope === 'center' && <Sel label="Masjid" value={f.center} options={Object.fromEntries(map.centers.map((c) => [c.name, c.name]))} onChange={(v) => setF({ ...f, center: v })} />}
            <Field label="Account name (optional)" value={f.label} onChange={(v) => setF({ ...f, label: v })} />
            <Field label="Giving form address" value={f.formUrl} onChange={(v) => setF({ ...f, formUrl: v })} />
            <div className="row-actions"><button type="button" className="btn sm" onClick={() => setAdding(false)}>Cancel</button><button className="btn sm primary">Add account</button></div>
          </form>
        )}
      </section>
    </Panel>
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
      <button type="button" className="btn sm" onClick={() => { const now = new Date().toLocaleTimeString('en-GB', { timeZone: ORG_TZ, hour: '2-digit', minute: '2-digit' }); const r = fakeSend(kind, to.trim(), d, now, quiet); setRes(r); if (r.ok) logAudit({ area: 'messages', action: label, detail: r.message }); }}>{label}</button>
      {res && <p className={`integ-res ${res.ok ? 'ok' : 'bad'}`} role="status">{res.message}</p>}
    </div>
  );
}
