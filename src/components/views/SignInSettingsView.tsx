'use client';
/**
 * M4 Settings › Sign-in and dashboards. The website has one sign-in for everyone; this screen decides which ways to
 * sign in are offered, what each dashboard is called, and what happens when a person has several. A live preview shows
 * exactly what one person would see after signing in (their roles come from Admins and roles).
 */
import { useEffect, useState } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, SwitchRow } from '@/components/editor/bits';
import { DASH_KINDS, dashboardsFor, type DashKind, type SignInSettings } from '@/lib/community/sign-in';
import { AccessSchema, mockAccess, type AccessDoc } from '@/lib/access/access';
import { ZONES, type ZoneId } from '@/lib/members/members';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const KIND_HINT: Record<DashKind, string> = {
  member: 'Every member – always on.', organization: 'Roles for the whole organization (Board, Treasurer, offices).',
  zone: 'Zone directors.', masjid: 'Associate Directors, secretaries and other masjid roles.', area: 'Area Representatives (some ZIP codes of one masjid).',
};

export function SignInSettingsView() {
  return (
    <DocEditor<SignInSettings> storeKey="sign-in" title="Sign-in and dashboards" preview={false}
      intro="One sign-in on the website for members and everyone who serves. Choose the ways to sign in, name the dashboards, and decide what happens when someone has more than one.">
      {(doc) => <Body draft={doc.draft} set={(f) => doc.setDraft(f)} issues={doc.issues} />}
    </DocEditor>
  );
}

function Body({ draft: d, set, issues }: { draft: SignInSettings; set: (f: (d: SignInSettings) => SignInSettings) => void; issues: Record<string, string> }) {
  const access = useAccessDoc();
  const [who, setWho] = useState('ad.se1@example.org');
  const people = access.admins.filter((a) => a.status === 'active');
  const preview = dashboardsFor(access, who, who === 'aisha@example.com' || !!people.find((a) => a.email === who)?.memberId, d, today(), (z) => `${ZONES[z as ZoneId] ?? z} Zone`);
  const meth = (k: keyof SignInSettings['methods'], v: boolean) => set((x) => ({ ...x, methods: { ...x.methods, [k]: v } }));
  const kind = (k: DashKind, patch: Partial<SignInSettings['kinds'][DashKind]>) => set((x) => ({ ...x, kinds: { ...x.kinds, [k]: { ...x.kinds[k], ...patch } } }));
  return (
    <div className="si-admin">
      <div className="si-admin-main">
        <Panel title="Ways to sign in" intro="Members never need a password. Turn on only what your team can support.">
          {issues.methods && <p className="sf-err" role="alert">{issues.methods}</p>}
          <SwitchRow id="m-google" label="Continue with Google" help="Fastest for most people." checked={d.methods.google} onChange={(v) => meth('google', v)} />
          <SwitchRow id="m-email" label="A 6-digit code by email" help="Works for everyone with an email address." checked={d.methods.emailCode} onChange={(v) => meth('emailCode', v)} />
          <SwitchRow id="m-phone" label="A 6-digit code by text message" help="Needs text messages in Integrations. Good for elders without email." checked={d.methods.phoneCode} onChange={(v) => meth('phoneCode', v)} />
          <SwitchRow id="m-pass" label="Password" help="For people who ask for one. Staff with sensitive roles still need two-step sign-in." checked={d.methods.password} onChange={(v) => meth('password', v)} />
        </Panel>

        <Panel title="When someone has several dashboards" intro="For example a member who is also an Associate Director and an Area Representative.">
          <fieldset className="si-choice">
            <legend className="sr-only">After signing in</legend>
            {([['ask', 'Ask every time', 'Show the list of dashboards after signing in.'], ['last', 'Open the last one used', 'Ask only the first time on a device.'], ['main', 'Open the main role', 'The first role on the person’s record.']] as const).map(([v, label, help]) => (
              <label key={v} className={`si-choice-opt${d.chooser === v ? ' on' : ''}`}><input type="radio" name="chooser" checked={d.chooser === v} onChange={() => set((x) => ({ ...x, chooser: v }))} /> <span><b>{label}</b><small>{help}</small></span></label>
            ))}
          </fieldset>
          <p className="muted">A switcher in the top bar always lets people change dashboards without signing out.</p>
        </Panel>

        <Panel title="Dashboards" intro="Which dashboards exist and what they are called. Who sees which one follows the roles in Admins and roles.">
          <div className="table-wrap"><table className="t-plain si-kinds">
            <thead><tr><th>On</th><th>Name</th><th>What it is for</th></tr></thead>
            <tbody>{DASH_KINDS.map((k) => (
              <tr key={k} data-kind={k}>
                <td><input type="checkbox" aria-label={`${d.kinds[k].label} on`} checked={d.kinds[k].enabled} disabled={k === 'member'} onChange={(e) => kind(k, { enabled: e.target.checked })} /></td>
                <td><input className="in" aria-label={`Name of the ${k} dashboard`} value={d.kinds[k].label} maxLength={40} onChange={(e) => kind(k, { label: e.target.value })} /><small className="block muted">{KIND_HINT[k]}</small>{issues[`kinds.${k}.label`] && <small className="sf-err block">{issues[`kinds.${k}.label`]}</small>}</td>
                <td><input className="in" aria-label={`Description of the ${k} dashboard`} value={d.kinds[k].help} maxLength={140} onChange={(e) => kind(k, { help: e.target.value })} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        </Panel>

        <Panel title="Sign-in page">
          <SwitchRow id="si-find" label="“Find your masjid” by ZIP code" help="Everyone belongs to a masjid by home ZIP code (Zones and centers › ZIP codes)." checked={d.findMasjid} onChange={(v) => set((x) => ({ ...x, findMasjid: v }))} />
          <label className="sf-field"><span className="sf-label">Note under the sign-in box</span><input className="in" value={d.staffNote} maxLength={200} onChange={(e) => set((x) => ({ ...x, staffNote: e.target.value }))} /></label>
        </Panel>
      </div>

      <aside className="si-admin-preview glass-pane" aria-label="Preview after signing in">
        <h2>After signing in</h2>
        <label className="sf-field"><span className="sf-label">Preview as</span>
          <select className="in" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="aisha@example.com">A member (no roles)</option>
            {people.map((a) => <option key={a.id} value={a.email}>{a.name}</option>)}
          </select></label>
        {preview.length === 0 ? <p className="muted">No dashboard – this person would be asked to join.</p>
          : preview.length === 1 || (d.chooser === 'main' && preview.length > 1) ? <p className="si-pv-note">Opens <b>{(preview.find((x) => x.index === 0) ?? preview[0]).label}</b> straight away.</p>
          : <p className="si-pv-note">{d.chooser === 'last' ? 'Asked once on a new device, then opens the last one:' : 'Chooses from:'}</p>}
        <ul className="si-pv">{preview.map((x) => <li key={`${x.kind}-${x.index}`} data-kind={x.kind}><b>{x.label}</b><small>{x.kind === 'member' ? d.kinds.member.help : `${x.role}${x.where ? ` · ${x.where}` : ''}`}</small></li>)}</ul>
        <p className="muted si-pv-foot">Methods shown: {[d.methods.google && 'Google', d.methods.emailCode && 'email code', d.methods.phoneCode && 'text code', d.methods.password && 'password'].filter(Boolean).join(', ') || 'none'}.</p>
      </aside>
    </div>
  );
}

/** The published admin list (for the preview). */
function useAccessDoc(): AccessDoc {
  const [doc, setDoc] = useState<AccessDoc>(mockAccess);
  useEffect(() => { void fetch('/api/store/admin-access', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = AccessSchema.safeParse(j?.data); if (p.success) setDoc(p.data); }).catch(() => undefined); }, []);
  return doc;
}
