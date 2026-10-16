'use client';
/**
 * A10 Settings › Admins and roles + Audit log.
 *   Admins: invite, role, zones (zone directors), two-step sign-in, expiry date (e.g. Election Commission), suspend.
 *   Roles: listed by area (leadership, membership, Zakat, finance…); each role's permissions shown module by module.
 *   Scopes: all, own zones, or own Islamic Centers (Associate Director, Center admin, Local Zakat Coordinator).
 *   Audit log: publishes (each document's history), member changes (each member's log) and browser-only actions
 *   (exports, voter-list snapshots, messages, acting-as) in one list with filters and a CSV.
 * Changes to admins and roles are published like any other document – versioned, with the publisher's name.
 */
import { useEffect, useMemo, useState } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, Tabs, countIssues } from '@/components/editor/bits';
import { MODULES, PERMISSIONS, PERMISSION_KEYS, ROLE_AREAS, ZAKAT_LEVELS, ZONE_IDS, accessWarnings, assignmentsOf, homeZipOf, modulesOf, permDef, whereOf, type AccessDoc, type AdminUser, type Permission, type Role, type RoleArea } from '@/lib/access/access';
import { centerForZip, type OrgStructure } from '@/lib/community/org-structure';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { MasjidPicker } from '@/components/shell/MasjidPicker';
import { DOC_KEYS, REGISTRY } from '@/lib/store/registry';
import { AUDIT_EVENT, readAudit, type AuditEntry } from '@/lib/access/audit';
import { membersWithEdits, fullName, ZONES, fmtDate, type ZoneId } from '@/lib/members/members';
import { csvCell } from '@/lib/community/member-records';
import { useAccess } from '@/lib/access/use-access';
import { AssignDialog, MasjidsOverview, OfficialsAccess, WorkingBody, useOrg, withoutAssignment } from './TeamViews';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
type ADoc = { draft: AccessDoc; setDraft: (f: AccessDoc | ((d: AccessDoc) => AccessDoc)) => void; issues: Record<string, string> };
const slug = (s: string, taken: string[]) => { const b = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'admin'; let id = b, n = 2; while (taken.includes(id)) id = `${b}-${n++}`; return id; };

export function AdminsView() {
  return (
    <DocEditor<AccessDoc> storeKey="admin-access" title="Admins and roles" preview={false}
      intro="Who can sign in to the admin and what each person may do. Give people the smallest role that fits; sensitive permissions need two-step sign-in. Changes are versioned like everything else.">
      {(doc) => <AdminsBody doc={doc} />}
    </DocEditor>
  );
}

function AdminsBody({ doc }: { doc: ADoc }) {
  const org = useOrg();
  const warns = accessWarnings(doc.draft, today(), org.centers.filter((c) => c.active).map((c) => c.name));
  return (
    <div className="cv">
      {warns.length > 0 && <ul className="notice warn-note acc-warns" role="note">{warns.map((w) => <li key={w}>{w}</li>)}</ul>}
      <Tabs label="Admins and roles" tabs={[
        { id: 'admins', label: 'Admins', badge: countIssues(doc.issues, ['admins']), render: () => <Admins doc={doc} /> },
        { id: 'roles', label: 'Roles', badge: countIssues(doc.issues, ['roles']), render: () => <Roles doc={doc} /> },
      ]} />
    </div>
  );
}

/** M3: every masjid's working body – overview by zone, then one masjid as an org chart (its own page: /masjids). */
export function MasjidsView() {
  return (
    <DocEditor<AccessDoc> storeKey="admin-access" title="Masjid working bodies" preview={false}
      intro="Every masjid's working body, zone by zone: the Associate Director, the secretaries and an Area Representative for each ZIP code. Open a masjid to fill a seat. Who may do what is set in Settings › Admins and roles.">
      {(doc) => <MasjidsTabs doc={doc} />}
    </DocEditor>
  );
}
function MasjidsTabs({ doc }: { doc: ADoc }) {
  const access = useAccess(); const org = useOrg();
  return (
    <Tabs label="Masjid working bodies" tabs={[
      { id: 'masjids', label: 'By masjid', render: () => <Masjids doc={doc} /> },
      { id: 'officials', label: 'Officials and access', render: () => (access.me ? <OfficialsAccess doc={doc} org={org} giver={access.me} editable={access.can('admins.manage')} /> : null) },
    ]} />
  );
}
function Masjids({ doc }: { doc: ADoc }) {
  const access = useAccess(); const org = useOrg();
  const [open, setOpen] = useState<string | null>(null);
  const all = org.centers.filter((c) => c.active);
  if (!access.me) return null;
  return open ? (
    <div className="tm-wrap">
      <button type="button" className="btn sm ghost tm-back" onClick={() => setOpen(null)}>← All masjids</button>
      <WorkingBody key={open} doc={doc} org={org} giver={access.me} masjids={[...all.filter((c) => c.name === open), ...all.filter((c) => c.name !== open)]} editable={access.can('admins.manage')} />
    </div>
  ) : <MasjidsOverview doc={doc} org={org} onOpen={setOpen} />;
}

function Admins({ doc }: { doc: ADoc }) {
  const access = useAccess(); const org = useOrg();
  const [give, setGive] = useState<string | null>(null);
  const d = doc.draft;
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [roleId, setRoleId] = useState('viewer');
  const set = (i: number, patch: Partial<AdminUser>) => doc.setDraft((x) => ({ ...x, admins: x.admins.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const roleName = (id: string) => d.roles.find((r) => r.id === id)?.name ?? id;
  const err = (i: number, k: string) => doc.issues[`admins.${i}.${k}`];
  const centers = useCenters();
  const mf = useMasjidFilter();
  // M5: everyone belongs to a masjid through their home ZIP code (Owners – the organization's super admins – may be without one)
  const homeOf = (a: AdminUser) => { const z = homeZipOf(a); return z ? centerForZip(org, z) : null; };
  const [newZip, setNewZip] = useState('');
  const shown = d.admins.map((a, i) => ({ a, i })).filter(({ a }) => { const h = homeOf(a); return mf.keep(h?.zone ?? '', h?.name ?? '', homeZipOf(a)) || assignmentsOf(a).some((x) => x.centers.some((c) => mf.keep('', c)) || x.zones.some((z) => mf.keep(z))); });
  return (
    <Panel intro="Invited people get an email link to set up their sign-in (BE). Suspend instead of deleting – the audit log keeps their name. Everyone except an Owner belongs to a masjid through the ZIP code they live in.">
      {doc.issues.admins && <p className="sf-err" role="alert">{doc.issues.admins}</p>}
      <form className="acc-invite" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return; const id = slug(name, d.admins.map((a) => a.id)); doc.setDraft((x) => ({ ...x, admins: [...x.admins, { id, homeZip: /^\d{5}$/.test(newZip) ? newZip : '', name: name.trim(), email: email.trim().toLowerCase(), roleId, zones: [], centers: [], zips: [], more: [], memberId: '', givenBy: '', holderId: '', reviewedOn: '', status: 'invited', twoStep: false }] })); setName(''); setEmail(''); setOpen(id); }}>
        <label className="sf-field"><span className="sf-label">Name</span><input className="in" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="sf-field"><span className="sf-label">Email</span><input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="sf-field"><span className="sf-label">Role</span><select className="in" value={roleId} onChange={(e) => setRoleId(e.target.value)}><RoleOptions roles={d.roles.filter((r) => r.id !== 'owner')} /></select></label>
        <label className="sf-field acc-zip"><span className="sf-label">Home ZIP</span><input className="in" inputMode="numeric" maxLength={5} placeholder="77036" value={newZip} onChange={(e) => setNewZip(e.target.value.replace(/\D/g, ''))} />
          <small className="block muted">{/^\d{5}$/.test(newZip) ? (centerForZip(org, newZip)?.name ?? 'No masjid serves this ZIP yet') : 'places them in a masjid'}</small></label>
        <button type="submit" className="btn primary">Invite admin</button>
        <button type="button" className="btn" onClick={() => setGive('new')}>Give a role…</button>
      </form>
      <div className="bn-bar acc-filter"><MasjidPicker /><span className="muted">{shown.length} of {d.admins.length} admins</span></div>
      <div className="table-wrap"><table className="t-plain acc-table">
        <thead><tr><th>Admin</th><th>Role</th><th>Masjid</th><th>Status</th><th>Two-step</th><th>Last active</th><th /></tr></thead>
        <tbody>{shown.map(({ a, i }) => {
          const bad = Object.keys(doc.issues).some((k) => k.startsWith(`admins.${i}.`));
          return [
            <tr key={a.id} data-admin={a.id} className={bad ? 'has-err' : undefined}>
              <td><b>{a.name}</b><small className="block">{a.email}</small></td>
              <td className="acc-roles-cell">{assignmentsOf(a).map((x, k) => <span key={k} className="acc-assign block" data-assign={x.roleId}><b>{roleName(x.roleId)}</b>{(x.zones.length || x.centers.length) ? <small> · {whereOf(d, x, (z) => ZONES[z as ZoneId] ?? z)}</small> : null}{x.expiresOn ? <small> · until {fmtDate(x.expiresOn)}</small> : null}</span>)}</td>
              <td className="acc-home">{a.roleId === 'owner' ? <span className="muted">Organization</span> : homeOf(a) ? <>{homeOf(a)!.name}<small className="block">ZIP {homeZipOf(a)}</small></> : homeZipOf(a) ? <>No masjid for ZIP {homeZipOf(a)}</> : <span className="sf-err">No home ZIP</span>}</td>
              <td><span className={`pill ${a.status === 'active' ? 'good' : a.status === 'suspended' ? 'bad' : 'warn'}`}>{a.status === 'active' ? 'Active' : a.status === 'suspended' ? 'Suspended' : 'Invited'}</span></td>
              <td>{a.twoStep ? 'On' : <span className={bad ? 'sf-err' : 'muted'}>Off</span>}</td>
              <td>{a.lastActive ? fmtDate(a.lastActive) : '—'}</td>
              <td><button type="button" className="btn sm" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? 'Close' : 'Edit'}<span className="sr-only"> {a.name}</span></button></td>
            </tr>,
            open === a.id && <tr key={`${a.id}-edit`} className="acc-edit-row"><td colSpan={7}>
              <div className="acc-edit">
                <label className="sf-field"><span className="sf-label">Role</span>
                  <select className="in" value={a.roleId} onChange={(e) => { const nr = d.roles.find((r) => r.id === e.target.value); set(i, { roleId: e.target.value, zones: nr?.zoneScoped ? a.zones : [], centers: nr?.centerScoped ? (nr.areaScoped ? a.centers.slice(0, 1) : a.centers) : [], zips: nr?.areaScoped ? a.zips : [] }); }}><RoleOptions roles={d.roles} /></select>
                  {err(i, 'roleId') && <small className="sf-err">{err(i, 'roleId')}</small>}</label>
                {d.roles.find((r) => r.id === a.roleId)?.zoneScoped && (
                  <fieldset className="sf-field acc-zones"><legend className="sf-label">Zones this person may see</legend>
                    {ZONE_IDS.map((z) => <label key={z} className="check"><input type="checkbox" checked={a.zones.includes(z)} onChange={() => set(i, { zones: a.zones.includes(z) ? a.zones.filter((x) => x !== z) : [...a.zones, z] })} /> <span>{ZONES[z]}</span></label>)}
                    {err(i, 'zones') && <small className="sf-err">{err(i, 'zones')}</small>}</fieldset>
                )}
                {d.roles.find((r) => r.id === a.roleId)?.centerScoped && (
                  <fieldset className="sf-field acc-zones acc-centers"><legend className="sf-label">Islamic Centers this person may see</legend>
                    {centers.length ? centers.map((c) => <label key={c} className="check"><input type="checkbox" checked={a.centers.includes(c)} onChange={() => set(i, { centers: a.centers.includes(c) ? a.centers.filter((x) => x !== c) : [...a.centers, c] })} /> <span>{c}</span></label>) : <p className="muted">Add centers in Zones and centers first.</p>}
                    {err(i, 'centers') && <small className="sf-err">{err(i, 'centers')}</small>}</fieldset>
                )}
                {a.more.length > 0 && <div className="sf-field acc-more"><span className="sf-label">Other roles</span>
                  <ul>{a.more.map((x, k) => <li key={k} data-more={x.roleId}><b>{roleName(x.roleId)}</b> <small>{whereOf(d, x, (z) => ZONES[z as ZoneId] ?? z)}{x.givenBy ? ` · given by ${x.givenBy}` : ''}</small> <button type="button" className="icon-btn sm" aria-label={`Take ${roleName(x.roleId)} away from ${a.name}`} onClick={() => doc.setDraft((cur) => withoutAssignment(cur, a.id, k + 1))}>×</button>{err(i, `more.${k}.roleId`) || err(i, `more.${k}.zips`) || err(i, `more.${k}.centers`) ? <small className="sf-err block">{err(i, `more.${k}.roleId`) || err(i, `more.${k}.zips`) || err(i, `more.${k}.centers`)}</small> : null}</li>)}</ul></div>}
                {d.roles.find((r) => r.id === a.roleId)?.areaScoped && <p className="muted">ZIP codes: {a.zips.join(', ') || 'none'} {err(i, 'zips') && <small className="sf-err">{err(i, 'zips')}</small>}</p>}
                {a.roleId !== 'owner' && <label className="sf-field acc-zip"><span className="sf-label">Home ZIP code</span><input className="in" inputMode="numeric" maxLength={5} value={a.homeZip} aria-label={`Home ZIP of ${a.name}`} onChange={(e) => set(i, { homeZip: e.target.value.replace(/\D/g, '') })} />
                  <small className="block muted">{/^\d{5}$/.test(a.homeZip) ? (centerForZip(org, a.homeZip)?.name ?? 'No masjid serves this ZIP yet – add it under Masjids and zones › ZIP codes') : 'The ZIP code they live in puts them in a masjid.'}</small>{err(i, 'homeZip') && <small className="sf-err">{err(i, 'homeZip')}</small>}</label>}
                <button type="button" className="btn sm" onClick={() => setGive(a.id)}>Give another role<span className="sr-only"> to {a.name}</span></button>
                <label className="sf-field"><span className="sf-label">Access ends on (optional)</span><input className="in" type="date" value={a.expiresOn ?? ''} onChange={(e) => set(i, { expiresOn: e.target.value || undefined })} /></label>
                <label className="check"><input type="checkbox" checked={a.twoStep} onChange={(e) => set(i, { twoStep: e.target.checked })} /> <span>Two-step sign-in is set up</span></label>
                {err(i, 'twoStep') && <p className="sf-err">{err(i, 'twoStep')}</p>}
                <div className="row-actions">
                  {a.status !== 'suspended' ? <button type="button" className="btn sm" onClick={() => set(i, { status: 'suspended' })}>Suspend</button> : <button type="button" className="btn sm" onClick={() => set(i, { status: 'active' })}>Bring back</button>}
                  {a.status === 'invited' && <button type="button" className="btn sm" onClick={() => set(i, { status: 'active' })}>Mark invitation accepted (demo)</button>}
                </div>
              </div>
            </td></tr>,
          ];
        })}</tbody>
      </table></div>
      {give && access.me && <AssignDialog doc={doc} org={org} giver={access.me} personId={give === 'new' ? undefined : give} onClose={() => setGive(null)} />}
    </Panel>
  );
}

/** Roles listed by area; the open role shows what it may do, module by module (modules still being built are marked). */
function Roles({ doc }: { doc: ADoc }) {
  const d = doc.draft;
  const [sel, setSel] = useState('owner');
  const r = d.roles.find((x) => x.id === sel) ?? d.roles[0];
  const ri = d.roles.findIndex((x) => x.id === r.id);
  const setRole = (id: string, patch: Partial<Role>) => doc.setDraft((x) => ({ ...x, roles: x.roles.map((y) => (y.id === id ? { ...y, ...patch } : y)) }));
  const flip = (p: Permission) => setRole(r.id, { permissions: r.permissions.includes(p) ? r.permissions.filter((x) => x !== p) : [...r.permissions, p] });
  const holders = (id: string) => d.admins.filter((a) => assignmentsOf(a).some((x) => x.roleId === id));
  const used = (id: string) => holders(id).length;
  const scope = (x: Role) => (x.areaScoped ? 'Own ZIP codes' : x.centerScoped ? 'Own centers' : x.zoneScoped ? 'Own zones' : 'All');
  const blank = () => { const id = slug('new role', d.roles.map((x) => x.id)); doc.setDraft((x) => ({ ...x, roles: [...x.roles, { id, name: 'New role', description: '', permissions: ['members.view'], area: 'general', zoneScoped: false, centerScoped: false, areaScoped: false, zakatLevel: 0, builtIn: false }] })); setSel(id); };
  const copy = () => { const id = slug(`${r.name} custom`, d.roles.map((x) => x.id)); doc.setDraft((x) => ({ ...x, roles: [...x.roles, { ...r, id, name: `${r.name} (custom)`, builtIn: false }] })); setSel(id); };
  const err = (k: string) => doc.issues[`roles.${ri}.${k}`];
  return (
    <div className="acc-roles">
      <nav className="acc-role-list glass-pane" aria-label="Roles">
        {(Object.keys(ROLE_AREAS) as RoleArea[]).map((area) => {
          const list = d.roles.filter((x) => x.area === area);
          if (!list.length) return null;
          return (
            <section key={area} className="acc-area" data-area={area}>
              <h3>{ROLE_AREAS[area]}</h3>
              <ul>{list.map((x) => (
                <li key={x.id}><button type="button" className={`acc-role-btn${x.id === r.id ? ' on' : ''}`} aria-current={x.id === r.id ? 'true' : undefined} data-role={x.id} onClick={() => setSel(x.id)}>
                  <span>{x.name}{!x.builtIn && <em> custom</em>}</span><small>{used(x.id)} admin{used(x.id) === 1 ? '' : 's'}{scope(x) !== 'All' ? ` · ${scope(x).toLowerCase()}` : ''}</small>
                </button></li>
              ))}</ul>
            </section>
          );
        })}
      </nav>

      <section className="acc-role glass-pane" aria-label={`Role: ${r.name}`} data-open-role={r.id}>
        <header className="acc-role-head">
          {r.builtIn ? <h2>{r.name}</h2> : <label className="sf-field acc-role-name"><span className="sf-label">Role name</span><input className="in" value={r.name} onChange={(e) => setRole(r.id, { name: e.target.value })} /></label>}
          <div className="row-actions">
            <button type="button" className="btn sm" onClick={blank}>New role</button>
            <button type="button" className="btn sm" onClick={copy}>Copy as a new role</button>
            {!r.builtIn && <button type="button" className="btn sm danger-ghost" disabled={used(r.id) > 0} title={used(r.id) ? 'In use – move its admins to another role first' : undefined} onClick={() => { doc.setDraft((x) => ({ ...x, roles: x.roles.filter((y) => y.id !== r.id) })); setSel('owner'); }}>Delete role</button>}
          </div>
        </header>
        {r.builtIn ? <p className="acc-role-desc">{r.description} <span className="pill">Built in</span></p>
          : <label className="sf-field"><span className="sf-label">What this role is for</span><input className="in" value={r.description} maxLength={200} onChange={(e) => setRole(r.id, { description: e.target.value })} /></label>}
        <dl className="acc-role-facts">
          <div><dt>Area</dt><dd>{r.builtIn ? ROLE_AREAS[r.area] : <select className="in" aria-label="Area" value={r.area} onChange={(e) => setRole(r.id, { area: e.target.value as RoleArea })}>{(Object.keys(ROLE_AREAS) as RoleArea[]).map((k) => <option key={k} value={k}>{ROLE_AREAS[k]}</option>)}</select>}</dd></div>
          <div><dt>Who they see</dt><dd>{r.builtIn ? (r.areaScoped ? 'Only some ZIP codes of their masjid' : r.centerScoped ? 'Only their own masjid(s)' : r.zoneScoped ? 'Only their own zones' : 'Everyone') : (
            <select className="in" aria-label="Who they see" value={r.areaScoped ? 'area' : r.centerScoped ? 'center' : r.zoneScoped ? 'zone' : 'all'} onChange={(e) => setRole(r.id, { zoneScoped: e.target.value === 'zone', centerScoped: e.target.value === 'center' || e.target.value === 'area', areaScoped: e.target.value === 'area' })}>
              <option value="all">Everyone (whole organization)</option><option value="zone">Only their own zones</option><option value="center">Only their own masjid(s)</option><option value="area">Only some ZIP codes of their masjid</option></select>)}</dd></div>
          {(r.permissions.includes('zakat.approve') || r.zakatLevel > 0) && <div><dt>Zakat approval</dt><dd>{r.builtIn ? ZAKAT_LEVELS[r.zakatLevel as 1 | 2 | 3] : (
            <select className="in" aria-label="Zakat approval level" value={r.zakatLevel} onChange={(e) => setRole(r.id, { zakatLevel: Number(e.target.value) })}><option value={0}>Choose a level…</option>{([1, 2, 3] as const).map((l) => <option key={l} value={l}>{ZAKAT_LEVELS[l]}</option>)}</select>)}
            {err('zakatLevel') && <small className="sf-err">{err('zakatLevel')}</small>}</dd></div>}
          <div><dt>Admins with this role</dt><dd>{used(r.id) ? holders(r.id).map((a) => a.name).join(', ') : 'Nobody yet'}</dd></div>
        </dl>
        <p className="acc-modules">Opens: {modulesOf(r).map((m) => <span key={m} className="chip">{m}</span>)}</p>
        {(err('permissions') || err('centerScoped') || err('areaScoped')) && <p className="sf-err" role="alert">{err('permissions') || err('centerScoped') || err('areaScoped')}</p>}

        <div className="acc-perms">
          {[...MODULES].sort((x, y) => Number(modulesOf(r).includes(y)) - Number(modulesOf(r).includes(x))).map((m) => {
            const ps = PERMISSION_KEYS.filter((p) => PERMISSIONS[p].group === m);
            const soon = ps.every((p) => permDef(p).soon) ? permDef(ps[0]).soon : undefined;
            const on = ps.filter((p) => r.permissions.includes(p)).length;
            return (
              <fieldset key={m} className={`acc-mod${on ? ' has' : ''}`} data-module={m}>
                <legend><span>{m}</span><small>{on ? `${on} of ${ps.length}` : 'No access'}</small>{soon && <span className="pill soon">Screens arrive with {soon}</span>}</legend>
                <ul>{ps.map((p) => (
                  <li key={p} data-perm={p} className={r.permissions.includes(p) ? 'on' : ''}>
                    <label className="check">
                      <input type="checkbox" checked={r.permissions.includes(p)} disabled={r.builtIn} onChange={() => flip(p)} aria-label={`${r.name}: ${PERMISSIONS[p].label}`} />
                      <span><b>{PERMISSIONS[p].label}</b>{permDef(p).sensitive && <span className="pill warn sm">sensitive</span>}{permDef(p).soon && !soon && <span className="pill soon sm">{permDef(p).soon}</span>}<small className="block">{PERMISSIONS[p].help}</small></span>
                    </label>
                  </li>
                ))}</ul>
              </fieldset>
            );
          })}
        </div>
        {r.builtIn && <p className="muted acc-fixed">Built-in roles are fixed so everyone knows what they mean. Copy one to make your own.</p>}
      </section>
    </div>
  );
}

function RoleOptions({ roles }: { roles: Role[] }) {
  return <>{(Object.keys(ROLE_AREAS) as RoleArea[]).map((area) => { const l = roles.filter((r) => r.area === area); return l.length ? <optgroup key={area} label={ROLE_AREAS[area]}>{l.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup> : null; })}</>;
}
/** Center names from Zones and centers (for center-limited roles). */
function useCenters() {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => { void fetch('/api/store/org-structure', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j: { data?: OrgStructure } | null) => setList((j?.data?.centers ?? []).filter((c) => c.active).map((c) => c.name))).catch(() => setList([])); }, []);
  return list;
}

/* ---------- audit log ---------- */
type Row = { at: string; by: string; area: string; action: string; detail: string };
export function AuditView() {
  const access = useAccess();
  const [local, setLocal] = useState<AuditEntry[]>([]);
  const [pubs, setPubs] = useState<Row[]>([]);
  const [q, setQ] = useState(''); const [area, setArea] = useState(''); const [who, setWho] = useState('');
  useEffect(() => {
    const read = () => setLocal(readAudit()); read(); window.addEventListener(AUDIT_EVENT, read);
    void Promise.all(DOC_KEYS.map((k) => fetch(`/api/store/${k}?history=1`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((list: { version: number; publishedAt: string; by: string; note?: string }[]) =>
      list.map((v) => ({ at: v.publishedAt, by: v.by, area: k === 'admin-access' ? 'access' : 'content', action: `Published ${REGISTRY[k].label} v${v.version}`, detail: v.note ?? '' }))))).then((all) => setPubs(all.flat()));
    return () => window.removeEventListener(AUDIT_EVENT, read);
  }, []);
  const nameOf = (id: string) => access.doc.admins.find((a) => a.id === id)?.name ?? id;
  const memberRows = useMemo<Row[]>(() => membersWithEdits().flatMap((m) => m.audit.filter((x) => !['Website', 'Board'].includes(x.by)).map((x) => ({ at: x.at, by: x.by, area: 'members', action: `${x.action} – ${fullName(m)} (${m.id})`, detail: x.detail }))), [local]);
  const rows: Row[] = [...local.map((e) => ({ ...e, by: nameOf(e.by) })), ...pubs, ...memberRows].sort((a, b) => b.at.localeCompare(a.at));
  const people = Array.from(new Set(rows.map((r) => r.by))).sort();
  const shown = rows.filter((r) => (!area || r.area === area) && (!who || r.by === who) && (!q || `${r.action} ${r.detail}`.toLowerCase().includes(q.toLowerCase())));
  const when = (s: string) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? s : `${fmtDate(d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }))} ${d.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })}`; };
  const csv = () => {
    const text = [['When', 'Who', 'Area', 'Action', 'Detail'], ...shown.map((r) => [r.at, r.by, r.area, r.action, r.detail])].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = `audit-log-${today()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="page">
      <header className="page-head"><div><h1>Audit log</h1><p className="page-intro">Who changed what and when: publishes, member changes, exports, voter-list snapshots and messages. Entries cannot be edited or deleted (BE: append-only).</p></div>
        <div className="page-actions"><button type="button" className="btn" onClick={csv} disabled={!shown.length}>Download CSV</button></div></header>
      <div className="filters glass-pane">
        <label className="sr-only" htmlFor="au-q">Search</label><input id="au-q" className="in" type="search" placeholder="Search actions" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="au-a">Area</label><select id="au-a" className="in pill-select" value={area} onChange={(e) => setArea(e.target.value)}><option value="">All areas</option>{['members', 'content', 'export', 'voters', 'messages', 'access', 'events', 'payments', 'zakat', 'donations', 'benefits', 'officials', 'minutes', 'finance', 'fundraising'].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select>
        <label className="sr-only" htmlFor="au-w">Who</label><select id="au-w" className="in pill-select" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Everyone</option>{people.map((p) => <option key={p}>{p}</option>)}</select>
        <span className="f-count" role="status">{shown.length.toLocaleString('en-US')} entries</span>
      </div>
      <div className="glass-pane table-wrap"><table className="t-plain audit-table">
        <thead><tr><th>When</th><th>Who</th><th>Area</th><th>What</th></tr></thead>
        <tbody>{shown.slice(0, 300).map((r, i) => <tr key={i} data-area={r.area}><td>{when(r.at)}</td><td>{r.by}</td><td><span className="pill">{r.area}</span></td><td><b>{r.action}</b>{r.detail && <small className="block">{r.detail}</small>}</td></tr>)}
          {!shown.length && <tr><td colSpan={4} className="empty">Nothing yet.</td></tr>}</tbody>
      </table></div>
    </div>
  );
}
