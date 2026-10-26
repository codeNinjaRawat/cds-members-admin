'use client';
/**
 * Admin sign-in (live mode): email + password → second step for sensitive roles (when the organization asks for it) →
 * which dashboard → the admin. Passwords are set with `npm run admin:password -- email` on the API server.
 * The session cookie belongs to this admin address. In demo mode there is nothing to sign in to (Acting as picker).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LIVE, be } from '@/lib/live/live';
import { useOrgBrand, type OrgBrand } from '@/lib/brand/use-org-brand';
import { mockSiteConfig } from '@/lib/site-config/mock-site-config';

/** Shown until the organization's own logo is loaded (admin/public/brand/isgh). */
const FALLBACK_BRAND: OrgBrand = { logoLight: mockSiteConfig.branding?.logoLight ?? '/brand/isgh/isgh-logo.svg', logoDark: mockSiteConfig.branding?.logoDark ?? '/brand/isgh/isgh-logo.svg', logoAlt: mockSiteConfig.branding?.logoAlt ?? '' };

type Dash = { kind: string; label: string; role: string; where: string; index: number; adminId: string };
type Step = 'email' | 'code' | 'two-step' | 'choose';
const safeNext = (raw: string | null) => (raw && /^\/(?!\/)[\w\-/?=&.%]*$/.test(raw) && !raw.startsWith('/sign-in') ? raw : '/');

export function AdminSignIn() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Dash[]>([]);
  const brand = useOrgBrand() ?? FALLBACK_BRAND;   // the organization's logo; until it is known, the logo shipped with this admin
  const [org, setOrg] = useState<{ name: string; shortName: string; productName: string; founded?: number }>({ name: mockSiteConfig.org.name, shortName: mockSiteConfig.org.shortName, productName: mockSiteConfig.org.productName ?? '', founded: mockSiteConfig.org.founded });
  const head = useRef<HTMLHeadingElement>(null);
  const q = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  useEffect(() => { const e = q.get('email'); if (e) setEmail(e); }, []);   // from the website's dashboard chooser
  // Opened from a website login menu (e.g. a masjid site): "?as=staff|official&from=<masjid name>" – shown as context only, it grants nothing.
  const [ctx, setCtx] = useState<{ as: string; from: string } | null>(null);
  useEffect(() => { const as = q.get('as'); const from = (q.get('from') ?? '').replace(/[^\p{L}\p{N} '’.&()-]/gu, '').slice(0, 60); if (as === 'staff' || as === 'official') setCtx({ as, from }); }, []);
  useEffect(() => { head.current?.focus(); }, [step]);
  useEffect(() => { if (LIVE) void be<{ data: { org?: typeof org } }>('GET', 'public/documents/site-config').then((r) => { if (r.ok && r.data.data?.org) setOrg((o) => ({ ...o, ...r.data.data.org })); }); }, []);   // the organization's own name (never hard-coded)

  if (!LIVE) return <main className="page"><section className="panel glass-pane"><h1 className="panel-h">Demo mode</h1><p>The admin runs without sign-in in demo mode – pick who you act as in the top bar.</p><a className="btn" href="/">Open the admin</a></section></main>;

  const go = () => window.location.assign(safeNext(q.get('next')));
  const open = async (d: Dash) => {
    setBusy(true); setError('');
    const r = await be('POST', 'auth/dashboard', { index: d.index });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    go();
  };
  const afterSignIn = async (dashboards: Dash[], current: number, twoStep?: { required: boolean; ok: boolean }) => {
    const admin = dashboards.filter((d) => d.kind !== 'member');
    if (!admin.length) return setError('This address has no admin access here. Members sign in on the website.');
    if (twoStep?.required && !twoStep.ok) { const t = await be<{ devCode?: string }>('POST', 'auth/two-step/start', {}); setDevCode(t.ok ? t.data.devCode ?? '' : ''); setCode(''); setList(admin); setStep('two-step'); return; }
    const want = Number(q.get('dash'));
    const pick = admin.find((d) => d.index === want) ?? (admin.length === 1 ? admin[0] : null);
    if (pick) { if (pick.index === current) return go(); return open(pick); }
    setList(admin); setStep('choose');
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError('Enter your email address.');
    if (!password) return setError('Enter your password.');
    setBusy(true); setError('');
    const r = await be<{ dashboards: Dash[]; current: number; twoStep: { required: boolean; ok: boolean } }>('POST', 'auth/password', { email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (!r.ok) { setPassword(''); return setError(r.status === 401 ? 'That email and password do not match.' : r.message); }
    setPassword('');
    await afterSignIn(r.data.dashboards, r.data.current, r.data.twoStep);
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from the email.');
    setBusy(true); setError('');
    const r = await be<{ dashboards: Dash[]; current: number; twoStep: { required: boolean; ok: boolean } }>('POST', 'auth/code/verify', { address: email.trim().toLowerCase(), code });
    setBusy(false);
    if (!r.ok) return setError(r.status === 403 ? r.message : 'That code is not right or has expired. Check the email or send a new code.');
    await afterSignIn(r.data.dashboards, r.data.current, r.data.twoStep);
  };
  const second = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code.');
    setBusy(true); setError('');
    const r = await be('POST', 'auth/two-step/verify', { code });
    setBusy(false);
    if (!r.ok) return setError('That code is not right or has expired.');
    const me = await be<{ dashboards: Dash[]; current: number }>('GET', 'auth/me');
    if (me.ok) await afterSignIn(me.data.dashboards, me.data.current, { required: false, ok: true });
  };

  const stepNo = step === 'choose' ? 2 : 1;
  const short = org.shortName || 'Admin';
  return (
    <main className="si" aria-busy={busy || undefined}>
      <aside className="si-art" aria-hidden="true">
        <svg className="si-pattern" width="100%" height="100%"><defs>
          <pattern id="si-star" width="96" height="96" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="currentColor" strokeWidth="1.1">
              <path d="M48 8 L58 38 L88 48 L58 58 L48 88 L38 58 L8 48 L38 38 Z" />
              <rect x="27" y="27" width="42" height="42" transform="rotate(45 48 48)" />
              <rect x="27" y="27" width="42" height="42" />
              <circle cx="48" cy="48" r="9" />
              <path d="M0 0 L8 8 M96 0 L88 8 M0 96 L8 88 M96 96 L88 88" />
            </g>
          </pattern></defs><rect width="100%" height="100%" fill="url(#si-star)" /></svg>
        <svg className="si-arch" viewBox="0 0 400 520" preserveAspectRatio="xMidYMax meet">
          <path d="M40 520 V250 C40 120 140 40 200 10 C260 40 360 120 360 250 V520" />
          <path d="M80 520 V262 C80 160 150 92 200 62 C250 92 320 160 320 262 V520" />
          <circle cx="200" cy="200" r="34" /><path d="M200 166 V234 M166 200 H234 M176 176 L224 224 M224 176 L176 224" />
        </svg>
        <div className="si-brand">
          <span className="si-mark si-img"><img src={brand.logoLight} alt="" /></span>
          <div><b>{org.name}</b><small>Admin</small></div>
        </div>
        <div className="si-copy">
          <h2>Manage {short} in one place.</h2>
          <ul>
            <li><span>01</span>Members and renewals</li>
            <li><span>02</span>Elections and voting</li>
            <li><span>03</span>Events, donations and Zakat</li>
          </ul>
        </div>
        <p className="si-foot">{org.founded ? `Since ${org.founded}` : 'For staff and officials'}</p>
      </aside>

      <section className="si-side">
      <div className="si-card">
        <div className="si-card-top">
          <span className="si-mark sm si-img"><img src={brand.logoLight} alt="" /></span>
          <ol className="si-steps" aria-label="Sign-in steps">
            {['Sign in', 'Dashboard'].map((t, i) => <li key={t} className={i + 1 < stepNo ? 'done' : i + 1 === stepNo ? 'now' : ''} aria-current={i + 1 === stepNo ? 'step' : undefined}>{t}</li>)}
          </ol>
        </div>
        {step === 'email' && (
          <form onSubmit={send} noValidate>
            {ctx && <p className="si-ctx"><span aria-hidden="true">{ctx.as === 'official' ? '★' : '◆'}</span>{ctx.as === 'official' ? 'Elected officials' : 'Staff sign-in'}{ctx.from && <> · {ctx.from}</>}</p>}
            <h1 className="si-h" ref={head} tabIndex={-1}>Sign in</h1>
            <p className="si-lead">{ctx?.as === 'official' ? 'Use the email you gave us as an elected official.' : 'Use your admin email and password.'}</p>
            <label className="field"><span>Email</span><input className="in si-in" type="email" placeholder="you@example.org" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={error ? 'si-err' : undefined} autoFocus /></label>
            <label className="field"><span>Password</span><input className="in si-in" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={error ? 'si-err' : undefined} /></label>
            {error && <p className="field-error" id="si-err" role="alert">{error}</p>}
            <button className="btn primary si-go" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        )}
        {(step === 'code' || step === 'two-step') && (
          <form onSubmit={step === 'code' ? verify : second} noValidate>
            <h1 className="si-h" ref={head} tabIndex={-1}>{step === 'code' ? 'Check your email' : 'One more step'}</h1>
            <p className="si-lead">{step === 'code' ? <>We sent a 6-digit code to <b>{email}</b>. It works for 10 minutes.</> : 'Your role can change sensitive things, so we sent a second code to your email.'}</p>
            <label className="field"><span>6-digit code</span><input className="in si-code" inputMode="numeric" placeholder="••••••" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-invalid={!!error || undefined} aria-describedby={error ? 'si-err' : undefined} autoFocus /></label>
            {devCode && <p className="si-dev">Development: the code is <b>{devCode}</b> <button type="button" className="linkish" onClick={() => setCode(devCode)}>Fill it in</button></p>}
            {error && <p className="field-error" id="si-err" role="alert">{error}</p>}
            <div className="row-actions">
              <button className="btn primary si-go" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
              {step === 'code' && <button className="btn ghost" type="button" onClick={() => { setStep('email'); setError(''); }}>Use another email</button>}
            </div>
          </form>
        )}
        {step === 'choose' && (
          <div>
            <h1 className="si-h" ref={head} tabIndex={-1}>Which dashboard?</h1>
            <p>You have more than one role. You can switch later from the top bar.</p>
            <ul className="signin-dashes">
              {list.map((d) => <li key={d.index}><button type="button" className="btn" disabled={busy} onClick={() => void open(d)}><b>{d.role}</b>{d.where && <span> · {d.where}</span>}</button></li>)}
            </ul>
            {error && <p className="field-error" role="alert">{error}</p>}
          </div>
        )}
        <p className="si-secure"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6Z"/></svg>Only people the organization gave admin access can sign in. Every sign-in is recorded.</p>
      </div>
      </section>
    </main>
  );
}
