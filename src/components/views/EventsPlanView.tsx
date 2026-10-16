'use client';
/**
 * F9 Events extras – /events/plan, on the same `events` document as Events (no second copy):
 *   Calendar   – month grid; each day's events; clash markers (same place and time, Jumu'ah, Eid), prayer-break tips
 *   Approvals  – events a masjid office sent for approval: checks (lead time, description, address, capacity, clash,
 *                promotion), approve and publish, or ask for changes with a note. Only organization-wide event managers
 *                approve; the rule itself (on/off, days ahead) is set here.
 *   Promotion  – per event: feature on the website, announcement email (audience + date), text message, social post
 *                (written for you, copy), and the timeline of everything that goes out incl. registration reminders
 *   Analytics  – past events: attendance, no-shows, fill rate, revenue, by month and kind; best and low show-up events
 * DEMO (no API). Live: GET/PUT /admin/events; POST /admin/events/{id}/approve | /changes; GET /admin/events/stats.
 */
import { DashBar, exportPage, useScope as useDashScope } from '@/components/charts/DashKit';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DocEditor } from '@/components/editor/DocEditor';
import { Panel, SwitchRow, Tabs } from '@/components/editor/bits';
import { ChartCard, Columns, ShareBar, StatTile } from '@/components/charts/Charts';
import { CATEGORY_LABEL, type EventItem, type EventsDoc } from '@/lib/community/events';
import { AUDIENCE, approvalChecks, clashes, eventStats, eventWarnings, eventsOn, fmt, mockEventHistory, monthGrid, promotionSteps, socialText } from '@/lib/community/event-ops';
import { PrayerSettingsSchema, mockPrayerSettings, clock, type PrayerSettings } from '@/lib/community/prayer';
import { useAccess } from '@/lib/access/use-access';
import { logAudit } from '@/lib/access/audit';
import { useOrg } from './TeamViews';

type Doc = { draft: EventsDoc; setDraft: (f: (d: EventsDoc) => EventsDoc) => void; issues: Record<string, string> };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const n = (v: number) => v.toLocaleString('en-US');
const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const placeOf = (e: EventItem) => e.location.center || e.location.name;
const timeOf = (iso: string) => clock(Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)));

export function EventsPlanView() {
  return (
    <DocEditor<EventsDoc> storeKey="events" title="Event planning" preview={false}
      intro="See every event on one calendar, catch clashes with other events, Jumu'ah and Eid, approve what masjid offices send in, plan the promotion, and learn from past turnout.">
      {(doc) => <Body doc={doc} />}
    </DocEditor>
  );
}

/** Prayer settings and each masjid's khutbah times (for clash checks). */
function usePrayer() {
  const org = useOrg();
  const [s, setS] = useState<PrayerSettings>(mockPrayerSettings);
  useEffect(() => { void fetch('/api/store/prayer-times', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { const p = PrayerSettingsSchema.safeParse(j?.data); if (p.success) setS(p.data); }).catch(() => undefined); }, []);
  const jumuahOf = (center: string) => (org.centers.find((c) => c.name === center)?.jumuah ?? []).map((j) => j.khutbah);
  return { s, jumuahOf };
}

function Body({ doc }: { doc: Doc }) {
  const access = useAccess();
  const { s, jumuahOf } = usePrayer();
  const d = doc.draft;
  // masjid offices see the whole calendar (to avoid clashes) but plan only their own events
  const mine = (e: EventItem) => !access.role?.centerScoped || (!!e.location.center && !!access.me?.centers.includes(e.location.center));
  const pending = d.events.filter((e) => e.approval.state === 'pending');
  const warns = eventWarnings(d, today(), s, jumuahOf).filter((w) => !w.event || mine(d.events.find((e) => e.id === w.event)!));
  return (
    <div className="ep">
      {warns.length > 0 && (
        <details className="notice warn-note ep-warns" open={warns.length <= 4}>
          <summary><b>{warns.length} thing{warns.length === 1 ? '' : 's'} to look at</b></summary>
          <ul>{warns.map((w, i) => <li key={i} data-event={w.event}>{w.text}</li>)}</ul>
        </details>
      )}
      <Tabs label="Event planning" tabs={[
        { id: 'calendar', label: 'Calendar', render: () => <Calendar doc={doc} s={s} jumuahOf={jumuahOf} /> },
        { id: 'approvals', label: 'Approvals', badge: pending.length || undefined, render: () => <Approvals doc={doc} s={s} jumuahOf={jumuahOf} /> },
        { id: 'promotion', label: 'Promotion', render: () => <Promotion doc={doc} mine={mine} /> },
        { id: 'analytics', label: 'Analytics', render: () => <Analytics /> },
      ]} />
    </div>
  );
}

/* ---------------- calendar ---------------- */
function Calendar({ doc, s, jumuahOf }: { doc: Doc; s: PrayerSettings; jumuahOf: (c: string) => string[] }) {
  const t = today();
  const [ym, setYm] = useState<[number, number]>([Number(t.slice(0, 4)), Number(t.slice(5, 7))]);
  const [place, setPlace] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const all = doc.draft.events.filter((e) => e.status !== 'cancelled');
  const places = Array.from(new Set(all.map(placeOf))).sort();
  const shown = all.filter((e) => !place || placeOf(e) === place);
  const grid = monthGrid(ym[0], ym[1]);
  const move = (k: number) => setYm(([y, m]) => { const x = m + k; return x < 1 ? [y - 1, 12] : x > 12 ? [y + 1, 1] : [y, x]; });
  const stop = (e: EventItem) => clashes(e, all, s, jumuahOf(e.location.center ?? '')).some((c) => c.level === 'stop');
  const special = (dd: string) => s.special.filter((x) => x.date === dd);
  const open = day ? eventsOn(shown, day) : [];
  return (
    <div className="ep-cal">
      <div className="ep-cal-bar">
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => move(-1)}>‹</button>
        <h2 aria-live="polite">{MONTHS[ym[1] - 1]} {ym[0]}</h2>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => move(1)}>›</button>
        <button type="button" className="btn sm ghost" onClick={() => setYm([Number(t.slice(0, 4)), Number(t.slice(5, 7))])}>Today</button>
        <select className="in pill-select" aria-label="Place" value={place} onChange={(e) => setPlace(e.target.value)}><option value="">All places</option>{places.map((p) => <option key={p}>{p}</option>)}</select>
        <span className="ep-legend"><i className="pub" />Published <i className="draft" />Draft <i className="pending" />Waiting for approval <i className="clash" />Clash</span>
      </div>
      <div className="ep-grid" role="grid" aria-label={`${MONTHS[ym[1] - 1]} ${ym[0]}`}>
        <div className="ep-row ep-head" role="row">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => <span key={w} role="columnheader">{w}</span>)}</div>
        {grid.map((week, i) => (
          <div key={i} className="ep-row" role="row">{week.map((dd, k) => {
            const evs = dd ? eventsOn(shown, dd) : [];
            const sp = dd ? special(dd) : [];
            return (
              <div key={k} role="gridcell" className={`ep-day${dd ? '' : ' out'}${dd === t ? ' today' : ''}${dd === day ? ' sel' : ''}${k === 5 ? ' fri' : ''}`} data-day={dd || undefined}>
                {dd && <button type="button" className="ep-dn" aria-label={`${fmt(dd)}: ${evs.length} event${evs.length === 1 ? '' : 's'}`} onClick={() => setDay(dd === day ? null : dd)}>{Number(dd.slice(8))}</button>}
                {sp.map((x) => <span key={x.id} className="ep-special">{x.name}</span>)}
                {evs.slice(0, 3).map((e) => (
                  <button type="button" key={e.id} className={`ep-chip ${e.approval.state === 'pending' ? 'pending' : e.status === 'draft' ? 'draft' : 'pub'}${stop(e) ? ' clash' : ''}`} data-event={e.id} onClick={() => setDay(dd)}>
                    {stop(e) && <span aria-label="Clash">⚠ </span>}<b>{timeOf(e.start)}</b> {e.title}
                  </button>
                ))}
                {evs.length > 3 && <button type="button" className="ep-more" onClick={() => setDay(dd)}>+{evs.length - 3} more</button>}
              </div>
            );
          })}</div>
        ))}
      </div>
      {day && (
        <aside className="ep-day-panel glass-pane" aria-label={`Events on ${fmt(day)}`}>
          <header><h3>{new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}</h3><button type="button" className="icon-btn sm" aria-label="Close" onClick={() => setDay(null)}>×</button></header>
          {special(day).map((x) => <p key={x.id} className="ep-special-note"><b>{x.name}</b> · {x.times.map((tm) => clock(Number(tm.slice(0, 2)) * 60 + Number(tm.slice(3)))).join(', ')} · {x.place}</p>)}
          {open.length ? <ul>{open.map((e) => { const cl = clashes(e, all, s, jumuahOf(e.location.center ?? '')); return (
            <li key={e.id} data-event={e.id}>
              <b>{e.title}</b>
              <small>{timeOf(e.start)}–{timeOf(e.end)} · {placeOf(e)} · {e.approval.state === 'pending' ? 'waiting for approval' : e.status}</small>
              {cl.length > 0 && <ul className="ep-clashes">{cl.map((c, i) => <li key={i} className={c.level}>{c.text}</li>)}</ul>}
            </li>
          ); })}</ul> : <p className="muted">No events this day.</p>}
          <Link className="btn sm" href="/events">Edit events</Link>
        </aside>
      )}
    </div>
  );
}

/* ---------------- approvals ---------------- */
function Approvals({ doc, s, jumuahOf }: { doc: Doc; s: PrayerSettings; jumuahOf: (c: string) => string[] }) {
  const access = useAccess();
  const d = doc.draft;
  const mayApprove = access.can('events.manage') && !access.role?.centerScoped && !access.role?.zoneScoped;
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (id: string, fn: (e: EventItem) => EventItem) => doc.setDraft((x) => ({ ...x, events: x.events.map((e) => (e.id === id ? fn(e) : e)) }));
  const pending = d.events.filter((e) => e.approval.state === 'pending').sort((a, b) => a.start.localeCompare(b.start));
  const done = d.events.filter((e) => e.approval.state === 'approved' || e.approval.state === 'changes').sort((a, b) => b.approval.on.localeCompare(a.approval.on)).slice(0, 8);
  const who = access.me?.name ?? 'Admin';
  const approve = (e: EventItem) => { set(e.id, (x) => ({ ...x, status: 'published', approval: { ...x.approval, state: 'approved', by: who, on: today(), note: notes[e.id] ?? '' } })); logAudit({ area: 'events', action: 'Event approved', detail: e.title }); };
  const changes = (e: EventItem) => {
    const note = (notes[e.id] ?? '').trim();
    if (note.length < 5) { setErr({ ...err, [e.id]: 'Tell the office what to change.' }); return; }
    set(e.id, (x) => ({ ...x, approval: { ...x.approval, state: 'changes', by: who, on: today(), note } })); setErr({ ...err, [e.id]: '' });
    logAudit({ area: 'events', action: 'Changes asked', detail: `${e.title} – ${note}` });
  };
  return (
    <div className="ep-appr">
      <Panel title="Approval rule" intro="Events entered by a masjid office stay drafts until the organization approves them.">
        <SwitchRow id="ep-req" label="Masjid offices need approval to publish" checked={d.approval.required} onChange={(v) => doc.setDraft((x) => ({ ...x, approval: { ...x.approval, required: v } }))} />
        <label className="sf-field ep-lead"><span className="sf-label">Plan at least this many days ahead</span><input className="in" type="number" min={0} max={90} value={d.approval.leadDays} onChange={(e) => doc.setDraft((x) => ({ ...x, approval: { ...x.approval, leadDays: Math.max(0, Math.min(90, Number(e.target.value) || 0)) } }))} /></label>
      </Panel>
      {!mayApprove && <p className="notice ep-note">Only organization-wide event managers approve. You can see what is waiting.</p>}
      {pending.length === 0 && <p className="cv-empty">Nothing waiting for approval.</p>}
      {pending.map((e) => {
        const cl = clashes(e, d.events, s, jumuahOf(e.location.center ?? ''));
        const checks = approvalChecks(e, d, today(), cl);
        const ok = checks.filter((c) => c.ok).length;
        return (
          <section key={e.id} className="ep-card glass-pane" data-event={e.id} aria-labelledby={`ap-${e.id}`}>
            <header>
              <div><h3 id={`ap-${e.id}`}>{e.title}</h3><p className="muted">{fmt(e.start)} · {timeOf(e.start)}–{timeOf(e.end)} · {placeOf(e)} · {CATEGORY_LABEL[e.category]}</p></div>
              <span className={`pill ${ok === checks.length ? 'good' : 'warn'}`}>{ok} of {checks.length} checks</span>
            </header>
            <p className="ep-from">Sent by {e.approval.requestedBy || 'a masjid office'}{e.approval.on ? ` on ${fmt(e.approval.on)}` : ''}</p>
            <p>{e.summary}</p>
            <ul className="ep-checks">{checks.map((c, i) => <li key={i} className={c.ok ? 'ok' : 'no'}><span aria-hidden="true">{c.ok ? '✓' : '!'}</span> {c.text}</li>)}</ul>
            {mayApprove && (<>
              <label className="sf-field"><span className="sf-label">Note to the office <span className="sf-opt">needed when asking for changes</span></span><input className="in" value={notes[e.id] ?? ''} maxLength={300} onChange={(x) => setNotes({ ...notes, [e.id]: x.target.value })} /></label>
              {err[e.id] && <p className="sf-err" role="alert">{err[e.id]}</p>}
              <div className="row-actions">
                <button type="button" className="btn primary" onClick={() => approve(e)}>Approve and publish<span className="sr-only"> {e.title}</span></button>
                <button type="button" className="btn" onClick={() => changes(e)}>Ask for changes<span className="sr-only"> to {e.title}</span></button>
              </div>
            </>)}
          </section>
        );
      })}
      {done.length > 0 && (
        <Panel title="Recently decided">
          <ul className="ep-done">{done.map((e) => <li key={e.id} data-event={e.id}><b>{e.title}</b> <span className={`pill ${e.approval.state === 'approved' ? 'good' : 'warn'}`}>{e.approval.state === 'approved' ? 'Approved' : 'Changes asked'}</span> <small>{e.approval.by}{e.approval.on ? ` · ${fmt(e.approval.on)}` : ''}{e.approval.note ? ` · “${e.approval.note}”` : ''}</small></li>)}</ul>
        </Panel>
      )}
    </div>
  );
}

/* ---------------- promotion ---------------- */
function Promotion({ doc, mine }: { doc: Doc; mine: (e: EventItem) => boolean }) {
  const d = doc.draft;
  const t = today();
  const list = d.events.filter((e) => e.status !== 'cancelled' && e.end.slice(0, 10) >= t && mine(e)).sort((a, b) => a.start.localeCompare(b.start));
  const [sel, setSel] = useState(list[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const e = list.find((x) => x.id === sel) ?? list[0];
  if (!e) return <p className="cv-empty">No upcoming events to promote.</p>;
  const p = e.promotion;
  const set = (fn: (x: EventItem['promotion']) => EventItem['promotion']) => doc.setDraft((x) => ({ ...x, events: x.events.map((y) => (y.id === e.id ? { ...y, promotion: fn(y.promotion) } : y)) }));
  const steps = promotionSteps(e, t);
  const text = p.social || socialText(e);
  const emailLate = p.email.audience !== 'none' && p.email.sendOn && p.email.sendOn > e.start.slice(0, 10);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };
  return (
    <div className="ep-promo">
      <label className="sf-field ep-pick"><span className="sf-label">Event</span>
        <select className="in" value={e.id} onChange={(x) => setSel(x.target.value)}>{list.map((x) => <option key={x.id} value={x.id}>{fmt(x.start)} · {x.title}{x.status === 'draft' ? ' (draft)' : ''}</option>)}</select></label>
      <div className="ep-promo-grid">
        <div className="ep-promo-main">
          <Panel title="Where people hear about it">
            <SwitchRow id="ep-feat" label="Feature on the website" help="Shown first on the website’s Events page, with a Featured label." checked={p.featured} onChange={(v) => set((x) => ({ ...x, featured: v }))} />
            <div className="field-row">
              <label className="sf-field"><span className="sf-label">Announcement email to</span>
                <select className="in" value={p.email.audience} onChange={(x) => set((y) => ({ ...y, email: { ...y.email, audience: x.target.value as EventItem['promotion']['email']['audience'] } }))}>
                  {(Object.keys(AUDIENCE) as (keyof typeof AUDIENCE)[]).map((k) => <option key={k} value={k}>{k === 'none' ? 'No email' : AUDIENCE[k][0].toUpperCase() + AUDIENCE[k].slice(1)}</option>)}
                </select></label>
              <label className="sf-field"><span className="sf-label">Send on</span><input className="in" type="date" value={p.email.sendOn} disabled={p.email.audience === 'none'} max={e.start.slice(0, 10)} onChange={(x) => set((y) => ({ ...y, email: { ...y.email, sendOn: x.target.value } }))} /></label>
            </div>
            {emailLate && <p className="sf-err" role="alert">The email would go out after the event starts.</p>}
            {p.email.audience === 'groups' && e.visibility !== 'groups' && <p className="sf-warn">This event is not limited to groups – “the event’s groups” sends to nobody.</p>}
            <SwitchRow id="ep-sms" label="Text message to members who allow texts" help="Short and close to the day works best." checked={p.sms.enabled} onChange={(v) => set((x) => ({ ...x, sms: { ...x.sms, enabled: v } }))} />
            {p.sms.enabled && <label className="sf-field ep-date"><span className="sf-label">Text on</span><input className="in" type="date" value={p.sms.sendOn} max={e.start.slice(0, 10)} onChange={(x) => set((y) => ({ ...y, sms: { ...y.sms, sendOn: x.target.value } }))} /></label>}
          </Panel>
          <Panel title="Social media post" intro="Written from the event – no personal data. Edit it or copy it as it is.">
            <textarea className="in ep-social" rows={4} maxLength={500} aria-label="Social media post" value={text} onChange={(x) => set((y) => ({ ...y, social: x.target.value }))} />
            <div className="row-actions">
              <small className="muted">{text.length}/500</small>
              <button type="button" className="btn sm" onClick={() => set((y) => ({ ...y, social: '' }))}>Write it for me again</button>
              <button type="button" className="btn sm primary" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          </Panel>
        </div>
        <aside className="ep-timeline glass-pane" aria-label="What goes out and when">
          <h3>What goes out</h3>
          {steps.length ? <ol>{steps.map((x, i) => <li key={i} className={x.done ? 'done' : ''}><time>{fmt(x.on)}</time><span>{x.what}</span></li>)}</ol> : <p className="muted">Nothing planned yet – feature it or plan an email.</p>}
          <p className="muted">Event: {fmt(e.start)} at {timeOf(e.start)} · {e.registration.enabled ? `${n(e.registered)} registered${e.registration.capacity ? ` of ${n(e.registration.capacity)}` : ''}` : 'no registration'}</p>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- analytics ---------------- */
function Analytics() {
  const access = useAccess();
  const [cat, setCat] = useState('');
  const own = access.role?.centerScoped ? mockEventHistory.filter((x) => access.me?.centers.includes(x.center)) : mockEventHistory;
  const ds = useDashScope('12m');
  const list = own.filter((x) => (!cat || x.category === cat) && ds.match(x.date, x.center));
  const st = useMemo(() => eventStats(list), [list]);
  const months = st.byMonth.map((m) => ({ label: MONTHS[Number(m.month.slice(5)) - 1].slice(0, 3), value: m.attended }));
  return (
    <div className="ep-an">
      <DashBar s={ds} show={{ period: 'past', zone: true, masjid: true }} report={{ href: '/events/dashboard', label: 'Events dashboard' }} onExport={() => exportPage('event-analytics', [], document.querySelector('.ep-an'))}
        extra={<select className="in pill-select" aria-label="Kind of event" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All kinds</option>{(Object.keys(CATEGORY_LABEL) as EventItem['category'][]).map((k) => <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}</select>} />
      <p className="muted small">{access.role?.centerScoped ? `Your masjid · ` : ''}Demo history of 2026 events (fictional)</p>
      {list.length === 0 ? <p className="cv-empty">No past events here yet.</p> : (<>
        <div className="viz-tiles ep-tiles">
          <StatTile id="ev-count" label="Events" value={n(st.events)} hero />
          <StatTile id="ev-attended" label="People came" value={n(st.attended)} note={`of ${n(st.registered)} registered`} />
          <StatTile id="ev-show" label="Showed up" value={`${st.attendancePct}%`} meter={{ value: st.attended, of: st.registered }} note={`${n(st.noShows)} no-shows`} />
          <StatTile id="ev-fill" label="Seats filled" value={`${st.fillPct}%`} note="events with a capacity" />
          <StatTile id="ev-revenue" label="Raised and sold" value={usd(st.revenueCents)} />
        </div>
        <div className="ep-an-grid">
          <ChartCard title="People who came, by month" table={{ head: ['Month', 'People'], rows: months.map((m) => [m.label, m.value]) }}><Columns items={months} label="People who came by month" ramp={false} /></ChartCard>
          <ChartCard title="By kind of event" table={{ head: ['Kind', 'Events', 'People'], rows: st.byCategory.map((c) => [CATEGORY_LABEL[c.id as EventItem['category']] ?? c.id, c.events, c.attended]) }}>
            <ShareBar items={st.byCategory.map((c) => ({ id: c.id, label: CATEGORY_LABEL[c.id as EventItem['category']] ?? c.id, value: c.attended }))} label="People by kind of event" />
          </ChartCard>
        </div>
        <div className="ep-an-grid">
          <Panel title="Best show-up">
            <ol className="ep-rank">{st.best.map((x) => <li key={x.id} data-event={x.id}><b>{x.title}</b><small>{x.center} · {fmt(x.date)} · {n(x.attended)} of {n(x.registered)} ({Math.round((x.attended / x.registered) * 100)}%)</small></li>)}</ol>
          </Panel>
          <Panel title={`Low show-up (under 60%) · ${st.lowShow.length}`} intro="Try a reminder text the day before, or ask people to cancel so others can come.">
            <ul className="ep-rank">{st.lowShow.slice(0, 6).map((x) => <li key={x.id} data-event={x.id}><b>{x.title}</b><small>{x.center} · {fmt(x.date)} · {n(x.attended)} of {n(x.registered)}</small></li>)}</ul>
          </Panel>
        </div>
      </>)}
    </div>
  );
}
