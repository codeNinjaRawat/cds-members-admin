'use client';
/**
 * M2/M3 Masjid working body and role assignment.
 *   AssignDialog  – give a role to a person (new or existing): role → where (organization, zones, a masjid, ZIP codes of
 *                   that masjid) → optional end date. Only roles the giver may give are offered (cannotAssign: never
 *                   more than you have, only your own masjid).
 *   WorkingBody   – one masjid as an org chart: Associate Director, Membership / Finance / Education Secretaries, other
 *                   masjid roles, and its Area Representatives by ZIP code (uncovered ZIPs are marked).
 *   TeamView      – /team: the same chart for a masjid leader (team.manage) – only their own masjid(s).
 * Everything is saved in the admin-access document; the server re-checks a masjid leader's change (teamProblem).
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel } from '@/components/editor/bits';
import { ROLE_AREAS, assignmentsOf, cannotAssign, modulesOf, whereOf, type AccessDoc, type AdminUser, type Assignment, type Role, type RoleArea } from '@/lib/access/access';
import { mockOrgStructure, OrgStructureSchema, type Center, type OrgStructure } from '@/lib/community/org-structure';
import { ZONES, centerOf, fmtDate, type ZoneId, ORG_TZ } from '@/lib/members/members';
import { useAccess } from '@/lib/access/use-access';
import { logAudit } from '@/lib/access/audit';
import { useMembers } from './MembersView';
import { OfficialsSchema, mockOfficials, seatLabel, type Officials } from '@/lib/community/officials';
import { reconcile, reconcileCounts, type Action, type Seat } from '@/lib/community/officials-access';

export type ADoc = { draft: AccessDoc; setDraft: (f: AccessDoc | ((d: AccessDoc) => AccessDoc)) => void; issues: Record<string, string> };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: ORG_TZ });
const zoneName = (id: string) => (ZONES[id as ZoneId] ? `${ZONES[id as ZoneId]} Zone` : id);
const slug = (s: string, taken: string[]) => { const b = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'admin'; let id = b, n = 2; while (taken.includes(id)) id = `${b}-${n++}`; return id; };
/** The masjid seats on the org chart, in order. */
export const SEATS = ['associate-director', 'membership-secretary', 'finance-secretary', 'education-secretary'] as const;

/** Zones and masjids (with their service-area ZIP codes) from the published map. */
export function useOrg(): OrgStructure {
  const [org, setOrg] = useState<OrgStructure>(mockOrgStructure);
  useEffect(() => { void fetch('/api/store/org-structure', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = OrgStructureSchema.safeParse(j?.data); if (p.success) setOrg(p.data); }).catch(() => undefined); }, []);
  return org;
}
/** Everyone holding a role at a masjid (main role or another one), with which assignment it is. */
export function holdersAt(doc: AccessDoc, masjid: string) {
  return doc.admins.flatMap((a) => assignmentsOf(a).map((x, index) => ({ a, x, index })).filter(({ x }) => x.centers.includes(masjid)));
}
/** Take one assignment away. The main role is replaced by the next one; with nothing left an invited person is removed, an active one suspended. */
export function withoutAssignment(doc: AccessDoc, adminId: string, index: number): AccessDoc {
  return { ...doc, admins: doc.admins.flatMap((a) => {
    if (a.id !== adminId) return [a];
    if (index > 0) return [{ ...a, more: a.more.filter((_, k) => k !== index - 1) }];
    const [next, ...rest] = a.more;
    if (next) return [{ ...a, roleId: next.roleId, zones: next.zones, centers: next.centers, zips: next.zips, expiresOn: next.expiresOn, givenBy: next.givenBy, holderId: next.holderId, reviewedOn: next.reviewedOn, more: rest }];
    return a.status === 'invited' ? [] : [{ ...a, status: 'suspended' as const }];
  }) };
}

/* ---------------- give a role ---------------- */
export function AssignDialog({ doc, org, giver, preset, personId, presetPerson, holderId = '', note, onClose }: {
  doc: ADoc; org: OrgStructure; giver: AdminUser; preset?: Partial<Assignment>; personId?: string; onClose: () => void;
  /** Officials ↔ access: the official's name and office email, and the seat the access comes from. */
  presetPerson?: { name: string; email: string }; holderId?: string; note?: string;
}) {
  const d = doc.draft;
  const sameName = presetPerson ? d.admins.find((a) => a.status !== 'suspended' && a.name.replace(/\s*\(demo\)$/, '').toLowerCase() === presetPerson.name.toLowerCase()) : undefined;
  const [who, setWho] = useState<string>(personId ?? sameName?.id ?? (preset ? 'new' : ''));
  const [name, setName] = useState(presetPerson?.name ?? ''); const [email, setEmail] = useState(presetPerson?.email ?? '');
  const [roleId, setRoleId] = useState(preset?.roleId ?? '');
  const [zones, setZones] = useState<string[]>(preset?.zones ?? []);
  const [centers, setCenters] = useState<string[]>(preset?.centers ?? []);
  const [zips, setZips] = useState<string[]>(preset?.zips ?? []);
  const [ends, setEnds] = useState('');
  const [err, setErr] = useState('');
  const role = d.roles.find((r) => r.id === roleId);
  const masjids = org.centers.filter((c) => c.active);
  const mine = (c: Center) => !giverIsLocal || giver.centers.includes(c.name);
  const giverIsLocal = !!cannotAssign(d, giver, { roleId: 'viewer', centers: [], zones: [], zips: [] }, today());
  const offered = d.roles.filter((r) => r.id !== 'owner' && (!giverIsLocal || !cannotAssign(d, giver, { roleId: r.id, centers: giver.centers.slice(0, 1), zones: [], zips: [] }, today())) && (!preset?.centers?.length || r.centerScoped));
  const masjid = masjids.find((c) => c.name === centers[0]);
  const x: Assignment = { roleId, zones: role?.zoneScoped ? zones as Assignment['zones'] : [], centers: role?.centerScoped ? centers : [], zips: role?.areaScoped ? zips : [], expiresOn: ends || undefined, givenBy: giver.name, holderId, reviewedOn: '' };
  const person = d.admins.find((a) => a.id === who);
  const pick = (r?: Role) => { setRoleId(r?.id ?? ''); if (!r?.areaScoped) setZips([]); if (r?.areaScoped && centers.length > 1) setCenters(centers.slice(0, 1)); setErr(''); };
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!role) return setErr('Pick a role.');
    if (who === 'new' && (name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))) return setErr('Enter the person’s name and email.');
    if (!who) return setErr('Pick the person.');
    if (role.zoneScoped && !x.zones.length) return setErr(`Pick the zone${role.name ? ` for the ${role.name}` : ''}.`);
    if (role.centerScoped && !x.centers.length) return setErr('Pick the masjid.');
    if (role.areaScoped && !x.zips.length) return setErr('Pick the ZIP codes this person represents.');
    const why = cannotAssign(d, giver, x, today()); if (why) return setErr(why);
    if (who === 'new' && d.admins.some((a) => a.email === email.trim().toLowerCase())) return setErr('This email already has access – pick the person from the list instead.');
    if (person && assignmentsOf(person).some((y) => y.roleId === x.roleId && y.centers.join() === x.centers.join() && y.zones.join() === x.zones.join())) return setErr(`${person.name} already has this role there.`);
    doc.setDraft((cur) => who === 'new'
      ? { ...cur, admins: [...cur.admins, { id: slug(name, cur.admins.map((a) => a.id)), name: name.trim(), email: email.trim().toLowerCase(), roleId: x.roleId, zones: x.zones, centers: x.centers, zips: x.zips, more: [], memberId: '', givenBy: giver.name, holderId, reviewedOn: '', homeZip: x.zips[0] ?? '', status: 'invited', twoStep: false, expiresOn: x.expiresOn }] }
      : { ...cur, admins: cur.admins.map((a) => (a.id === who ? { ...a, more: [...a.more, x] } : a)) });
    logAudit({ area: 'access', action: 'Role given', detail: `${role.name} – ${whereOf(d, x, zoneName)} – ${who === 'new' ? name.trim() : person?.name}` });
    onClose();
  };
  const open = (el: HTMLDialogElement | null) => { if (el && !el.open) el.showModal(); };
  return (
    <dialog ref={open} className="modal glass-float tm-dialog" aria-label="Give a role" onClose={onClose} onCancel={onClose}>
      <form className="m-form" onSubmit={save} noValidate>
        <h2>Give a role</h2>
        {note && <p className="notice tm-note">{note}</p>}
        <ol className="tm-steps">
          <li><span className="tm-step-n">1</span>
            <label className="sf-field"><span className="sf-label">Person</span>
              <select className="in" value={who} disabled={!!personId} onChange={(e) => { setWho(e.target.value); setErr(''); }}>
                <option value="">Choose…</option><option value="new">Someone new (send an invitation)</option>
                <optgroup label="Already has access">{d.admins.filter((a) => a.status !== 'suspended').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
              </select></label>
            {who === 'new' && <div className="field-row">
              <label className="sf-field"><span className="sf-label">Name</span><input className="in" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="sf-field"><span className="sf-label">Email</span><input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            </div>}
            {person && <p className="muted tm-has">Has now: {assignmentsOf(person).map((y) => `${d.roles.find((r) => r.id === y.roleId)?.name ?? y.roleId} (${whereOf(d, y, zoneName)})`).join(' · ')}</p>}
          </li>
          <li><span className="tm-step-n">2</span>
            <label className="sf-field"><span className="sf-label">Role</span>
              <select className="in" value={roleId} onChange={(e) => pick(d.roles.find((r) => r.id === e.target.value))}>
                <option value="">Choose…</option>
                {(Object.keys(ROLE_AREAS) as RoleArea[]).map((area) => { const l = offered.filter((r) => r.area === area); return l.length ? <optgroup key={area} label={ROLE_AREAS[area]}>{l.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup> : null; })}
              </select></label>
            {role && <p className="tm-role-sum"><span>{role.description}</span> {modulesOf(role).map((m) => <span key={m} className="chip">{m}</span>)}</p>}
          </li>
          {role && <li><span className="tm-step-n">3</span>
            <div className="sf-field"><span className="sf-label">Where</span>
              {!role.zoneScoped && !role.centerScoped && <p className="tm-where">Whole organization – every zone and masjid.</p>}
              {role.zoneScoped && <fieldset className="acc-zones"><legend className="sr-only">Zones</legend>{org.zones.filter((zz) => zz.active !== false).map((zz) => zz.id).map((z) => <label key={z} className="check"><input type="checkbox" checked={zones.includes(z)} onChange={() => setZones(zones.includes(z) ? zones.filter((y) => y !== z) : [...zones, z])} /> <span>{org.zones.find((zz) => zz.id === z)?.name ?? zoneName(z)}</span></label>)}</fieldset>}
              {role.centerScoped && (
                <select className="in" aria-label="Masjid" value={centers[0] ?? ''} disabled={!!preset?.centers?.length} onChange={(e) => { setCenters(e.target.value ? [e.target.value] : []); setZips([]); }}>
                  <option value="">Choose the masjid…</option>
                  {org.zones.map((z) => { const l = masjids.filter((c) => c.zone === z.id && mine(c)); return l.length ? <optgroup key={z.id} label={z.name}>{l.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup> : null; })}
                </select>
              )}
              {role.areaScoped && masjid && (
                <fieldset className="tm-zips"><legend className="sf-label">ZIP codes they represent <small className="muted">({masjid.name}’s service area)</small></legend>
                  {masjid.zips.length ? masjid.zips.map((z) => <label key={z} className="check"><input type="checkbox" checked={zips.includes(z)} onChange={() => setZips(zips.includes(z) ? zips.filter((y) => y !== z) : [...zips, z].sort())} /> <span>{z}</span></label>) : <p className="muted">This masjid has no service-area ZIP codes yet (Zones and centers › ZIP codes).</p>}
                </fieldset>
              )}
            </div>
            <label className="sf-field"><span className="sf-label">Ends on <span className="sf-opt">optional</span></span><input className="in" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></label>
          </li>}
        </ol>
        {role && (role.zoneScoped ? x.zones.length : role.centerScoped ? x.centers.length && (!role.areaScoped || x.zips.length) : true) ? <p className="tm-preview" role="status"><b>{who === 'new' ? name || 'They' : person?.name ?? 'They'}</b> will work as <b>{role.name}</b> for <b>{whereOf(d, x, zoneName)}</b>{x.expiresOn ? ` until ${fmtDate(x.expiresOn)}` : ''}.</p> : null}
        {err && <p className="sf-err" role="alert">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">Give role</button></div>
        <p className="muted zn-pub">Goes live when you publish. New people get an invitation email (BE).</p>
      </form>
    </dialog>
  );
}

/* ---------------- one masjid as an org chart ---------------- */
export function WorkingBody({ doc, org, giver, masjids, editable }: { doc: ADoc; org: OrgStructure; giver: AdminUser; masjids: Center[]; editable: boolean }) {
  const d = doc.draft;
  const [sel, setSel] = useState(masjids[0]?.name ?? '');
  const [assign, setAssign] = useState<Partial<Assignment> | null>(null);
  const members = useMembers() ?? [];
  const m = masjids.find((c) => c.name === sel) ?? masjids[0];
  const here = useMemo(() => (m ? holdersAt(d, m.name) : []), [d, m]);
  const people = useMemo(() => members.filter((x) => !x.archived && m && centerOf(x) === m.name), [members, m]);
  if (!m) return <p className="cv-empty">No masjid to show. Add masjids in Zones and centers.</p>;
  const zone = org.zones.find((z) => z.id === m.zone);
  const roleName = (id: string) => d.roles.find((r) => r.id === id)?.name ?? id;
  const reps = here.filter(({ x }) => d.roles.find((r) => r.id === x.roleId)?.areaScoped);
  const others = here.filter(({ x }) => !SEATS.includes(x.roleId as (typeof SEATS)[number]) && !d.roles.find((r) => r.id === x.roleId)?.areaScoped);
  const may = (x: Pick<Assignment, 'roleId' | 'centers' | 'zips' | 'zones'>) => editable && !cannotAssign(d, giver, x, today());
  const remove = (a: AdminUser, index: number, label: string) => { doc.setDraft((cur) => withoutAssignment(cur, a.id, index)); logAudit({ area: 'access', action: 'Role taken away', detail: `${label} – ${a.name}` }); };
  const Person = ({ a, x, index }: { a: AdminUser; x: Assignment; index: number }) => (
    <li className="tm-person" data-admin={a.id}>
      <span className="tm-avatar" aria-hidden="true">{a.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
      <span className="tm-who"><b>{a.name}</b><small>{a.email}{a.status !== 'active' ? ` · ${a.status === 'invited' ? 'invited' : 'suspended'}` : ''}{x.expiresOn ? ` · until ${fmtDate(x.expiresOn)}` : ''}</small></span>
      {may(x) && a.id !== giver.id && <button type="button" className="icon-btn sm" aria-label={`Take ${roleName(x.roleId)} away from ${a.name}`} onClick={() => remove(a, index, `${roleName(x.roleId)} at ${m.name}`)}>×</button>}
    </li>
  );
  const covered = (zip: string) => reps.filter(({ x }) => x.zips.includes(zip));
  return (
    <div className="tm" data-masjid={m.id}>
      {masjids.length > 1 && (
        <label className="sf-field tm-pick"><span className="sf-label">Masjid</span>
          <select className="in pill-select" value={m.name} onChange={(e) => setSel(e.target.value)}>
            {org.zones.map((z) => { const l = masjids.filter((c) => c.zone === z.id); return l.length ? <optgroup key={z.id} label={z.name}>{l.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup> : null; })}
          </select></label>
      )}
      <header className="tm-head glass-pane">
        <span className="tm-dome" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 3c-3 2.5-6 4.6-6 8h12c0-3.4-3-5.5-6-8Z" fill="currentColor" opacity=".85" /><path d="M5 12h14v8H5z" fill="currentColor" opacity=".55" /><path d="M10.5 20v-4a1.5 1.5 0 0 1 3 0v4" fill="var(--panel, #fff)" /></svg></span>
        <div><h2>{m.name}</h2><p className="muted">{zone?.name ?? m.zone}{m.address.city ? ` · ${m.address.city}` : ''} · {people.length.toLocaleString('en-US')} members · service area {m.zips.length ? m.zips.join(', ') : 'not set'}</p></div>
      </header>

      <section className="tm-chart" aria-label={`${m.name} working body`}>
        {SEATS.map((id, i) => {
          const holders = here.filter(({ x }) => x.roleId === id);
          const preset = { roleId: id, centers: [m.name], zones: [], zips: [] };
          return (
            <article key={id} className={`tm-seat${i === 0 ? ' lead' : ''}${holders.length ? '' : ' vacant'}`} data-seat={id}>
              <h3>{roleName(id)}{i === 0 && <small> runs the masjid</small>}</h3>
              {holders.length ? <ul>{holders.map((h) => <Person key={`${h.a.id}-${h.index}`} {...h} />)}</ul> : <p className="tm-vacant">Vacant</p>}
              {may(preset) && <button type="button" className="btn sm ghost" onClick={() => setAssign(preset)}>{holders.length ? 'Add another' : 'Assign'}<span className="sr-only"> {roleName(id)}</span></button>}
            </article>
          );
        })}
        <article className="tm-seat other" data-seat="other">
          <h3>Other roles</h3>
          {others.length ? <ul>{others.map((h) => <li key={`${h.a.id}-${h.index}`} className="tm-other"><small className="pill">{roleName(h.x.roleId)}</small><ul><Person {...h} /></ul></li>)}</ul> : <p className="tm-vacant">None</p>}
          {editable && <button type="button" className="btn sm ghost" onClick={() => setAssign({ centers: [m.name], zones: [], zips: [] })}>Give another role</button>}
        </article>
      </section>

      <Panel title="Officials and access" intro="Who serves this masjid (Elected officials) compared with who can sign in for it.">
        <OfficialsAccess doc={doc} org={org} giver={giver} center={m.name} editable={editable} />
      </Panel>
      <Panel title="Area Representatives" intro="Each ZIP code of the service area should have someone who knows its families.">
        <div className="table-wrap"><table className="t-plain tm-areas">
          <thead><tr><th>ZIP</th><th className="num">Members</th><th>Area Representative</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{m.zips.map((zip) => { const c = covered(zip); const preset = { roleId: 'area-representative', centers: [m.name], zips: [zip], zones: [] }; return (
            <tr key={zip} data-zip={zip} className={c.length ? '' : 'tm-gap'}>
              <td><b>{zip}</b></td>
              <td className="num">{people.filter((p) => p.zip.startsWith(zip)).length}</td>
              <td>{c.length ? <ul className="tm-inline">{c.map((h) => <Person key={`${h.a.id}-${h.index}`} {...h} />)}</ul> : <span className="zn-missing">Nobody yet</span>}</td>
              <td className="row-actions">{may(preset) && <button type="button" className="btn sm" onClick={() => setAssign(preset)}>{c.length ? 'Add' : 'Assign'}<span className="sr-only"> Area Representative for {zip}</span></button>}</td>
            </tr>
          ); })}
          {!m.zips.length && <tr><td colSpan={4} className="empty">No service-area ZIP codes yet – set them in Zones and centers › ZIP codes.</td></tr>}</tbody>
        </table></div>
      </Panel>
      {assign && <AssignDialog doc={doc} org={org} giver={giver} preset={assign} onClose={() => setAssign(null)} />}
    </div>
  );
}

/** The organization's working bodies at a glance: for each zone, how many seats are filled per masjid. */
export function MasjidsOverview({ doc, org, onOpen }: { doc: ADoc; org: OrgStructure; onOpen: (masjid: string) => void }) {
  const d = doc.draft;
  return (
    <div className="tm-zones">
      {org.zones.filter((z) => z.active).map((z) => (
        <section key={z.id} className="tm-zone glass-pane" data-zone={z.id} aria-labelledby={`tmz-${z.id}`}>
          <h3 id={`tmz-${z.id}`}>{z.name}<small>{z.director.name || 'No director'}</small></h3>
          <ul>{org.centers.filter((c) => c.zone === z.id && c.active).map((c) => {
            const h = holdersAt(d, c.name);
            const filled = SEATS.filter((s) => h.some(({ x }) => x.roleId === s)).length;
            const repZips = new Set(h.filter(({ x }) => x.roleId === 'area-representative').flatMap(({ x }) => x.zips));
            const gaps = c.zips.filter((zp) => !repZips.has(zp)).length;
            return (
              <li key={c.id}><button type="button" className="tm-mq" data-masjid={c.id} onClick={() => onOpen(c.name)}>
                <b>{c.name}</b>
                <span className="tm-meter" aria-label={`${filled} of ${SEATS.length} seats filled`}>{SEATS.map((s, i) => <i key={s} className={i < filled ? 'on' : ''} />)}</span>
                <small>{filled}/{SEATS.length} seats{h.some(({ x }) => x.roleId === 'associate-director') ? '' : ' · no AD'}{gaps ? ` · ${gaps} ZIP${gaps === 1 ? '' : 's'} without a rep` : ''}</small>
              </button></li>
            );
          })}</ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------- /team – a masjid leader builds their own working body ---------------- */
export function TeamView() {
  const access = useAccess();
  const org = useOrg();
  return (
    <DocEditor<AccessDoc> storeKey="admin-access" title="Working body" preview={false} publishPermission="team.manage"
      intro="Who serves your masjid in the system: the Associate Director, the secretaries and the Area Representatives for each ZIP code. You can give masjid roles inside your own masjid – never more than you can do yourself.">
      {(doc) => access.me ? <WorkingBody doc={doc} org={org} giver={access.me} masjids={org.centers.filter((c) => c.active && access.me!.centers.includes(c.name))} editable={access.can('team.manage')} /> : null}
    </DocEditor>
  );
}

/* ---------------- Officials ↔ access (joiner – mover – leaver) ---------------- */
/** The published officials list (Elected officials). */
export function useOfficials(): Officials {
  const [o, setO] = useState<Officials>(mockOfficials);
  useEffect(() => { void fetch('/api/store/officials', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = OfficialsSchema.safeParse(j?.data); if (p.success) setO(p.data); }).catch(() => undefined); }, []);
  return o;
}
const KIND_TEXT = { give: 'Give access', change: 'Update access', remove: 'Take access away', review: 'Review' } as const;
/**
 * The officials list is the source of truth for who serves. This list shows where access does not match it yet:
 * someone started serving (give), their seat changed (update), they stopped (take away), or access no seat explains
 * (review – keep it for a year, or take it away). Changes go live when Admins and roles is published.
 */
export function OfficialsAccess({ doc, org, giver, center = '', editable }: { doc: ADoc; org: OrgStructure; giver: AdminUser; center?: string; editable: boolean }) {
  const off = useOfficials();
  const [give, setGive] = useState<Extract<Action, { kind: 'give' }> | null>(null);
  const [filter, setFilter] = useState<'all' | Action['kind']>('all');
  const zipsOf = (c: string) => org.centers.find((x) => x.name === c)?.zips ?? [];
  const list = reconcile(off, doc.draft, today(), zipsOf, center, zoneName);
  const n = reconcileCounts(list);
  const shown = list.filter((x) => filter === 'all' || x.kind === filter);
  const roleName = (id: string) => doc.draft.roles.find((r) => r.id === id)?.name ?? id;
  const may = (x: Seat) => editable && !cannotAssign(doc.draft, giver, x, today());
  const setAssign = (adminId: string, index: number, fn: (x: Assignment) => Assignment) => doc.setDraft((cur) => ({ ...cur, admins: cur.admins.map((a) => {
    if (a.id !== adminId) return a;
    if (index > 0) return { ...a, more: a.more.map((y, k) => (k === index - 1 ? fn(y) : y)) };
    const m = fn(assignmentsOf(a)[0]);
    return { ...a, roleId: m.roleId, zones: m.zones, centers: m.centers, zips: m.zips, holderId: m.holderId, reviewedOn: m.reviewedOn };
  }) }));
  return (
    <section className="oa" aria-label="Officials and access">
      <div className="oa-tiles">
        {(['remove', 'change', 'give', 'review'] as const).map((k) => (
          <button key={k} type="button" className={`oa-tile k-${k}${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(filter === k ? 'all' : k)}>
            <b>{n[k]}</b><span>{k === 'remove' ? 'stopped serving – still have access' : k === 'change' ? 'seat changed' : k === 'give' ? 'serving – no access yet' : 'access without a seat'}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="cv-empty">{list.length ? 'Nothing of this kind.' : 'Access matches the officials list. Alhamdulillah.'}</p> : (
        <ul className="oa-list">{shown.map((x, i) => {
          const seat = 'seat' in x ? x.seat : null;
          return (
            <li key={i} className={`oa-item k-${x.kind}`} data-kind={x.kind} data-holder={'holder' in x && x.holder ? x.holder.id : undefined} data-admin={'admin' in x ? x.admin.id : undefined}>
              <span className="oa-tag">{KIND_TEXT[x.kind]}</span>
              <p>{x.why}{seat && <small className="block muted">{roleName(seat.roleId)} · {whereOf(doc.draft, seat, zoneName)}</small>}</p>
              <div className="row-actions">
                {x.kind === 'give' && may(x.seat) && <button type="button" className="btn sm primary" onClick={() => setGive(x)}>Give access<span className="sr-only"> to {x.holder.name}</span></button>}
                {x.kind === 'change' && may(x.seat) && <button type="button" className="btn sm primary" onClick={() => { setAssign(x.admin.id, x.index, (y) => ({ ...y, ...x.seat })); logAudit({ area: 'access', action: 'Access updated from officials', detail: `${x.admin.name} – ${roleName(x.seat.roleId)}` }); }}>Update access<span className="sr-only"> of {x.admin.name}</span></button>}
                {(x.kind === 'remove' || x.kind === 'review') && editable && <button type="button" className="btn sm" onClick={() => { doc.setDraft((cur) => withoutAssignment(cur, x.admin.id, x.index)); logAudit({ area: 'access', action: 'Access taken away', detail: x.why }); }}>Take access away<span className="sr-only"> from {x.admin.name}</span></button>}
                {x.kind === 'review' && editable && <button type="button" className="btn sm ghost" onClick={() => { setAssign(x.admin.id, x.index, (y) => ({ ...y, reviewedOn: today() })); logAudit({ area: 'access', action: 'Access reviewed – kept', detail: x.why }); }}>Keep for a year<span className="sr-only"> ({x.admin.name})</span></button>}
              </div>
            </li>
          );
        })}</ul>
      )}
      <p className="muted oa-foot">The seats come from Elected officials. Administrative and Youth Affairs Secretaries need no system role; give one by hand if they need it.</p>
      {give && <AssignDialog doc={doc} org={org} giver={giver} preset={give.seat} presetPerson={{ name: give.holder.name, email: give.holder.publicEmail }} holderId={give.holder.id}
        note={`${give.holder.name} serves as ${seatLabel(give.holder, zoneName)}. The access stays linked to this seat: when the term ends or the seat changes, it shows up here.`} onClose={() => setGive(null)} />}
    </section>
  );
}
