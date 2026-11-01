'use client';
/**
 * Event builder – one long form with a section rail and a live preview, the way Zeffy builds an event
 * (research: memory/research/zeffy-event-builder.md). Sections: Title · Date and time · Location · Description ·
 * Design · Tickets · Questions · Add-ons · Discount codes · Emails · Advanced · Share.
 * Edits the same event in the "events" document (DocEditor publishes it); every rule comes from lib/community/events.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CATEGORY_LABEL, QUESTION_KINDS, TYPE_DEFAULTS, answerKey, fmtRange, optionLeft, orderTotal, questionsFor, registrationState, typeOnSale, usd, youTubeId,
  type AddOn, type EventDiscount, type EventItem, type Question, type RegType,
} from '@/lib/community/events';
import { PLANS } from '@/lib/members/members';
import { useMasjidFilter } from '@/lib/access/masjid-filter';

type Issues = Record<string, string>;
const SECTIONS = [
  ['title', 'Title'], ['when', 'Date and time'], ['where', 'Location'], ['about', 'Description'], ['design', 'Design'],
  ['tickets', 'Tickets'], ['questions', 'Questions'], ['addons', 'Add-ons'], ['codes', 'Discount codes'], ['emails', 'Emails'],
  ['advanced', 'Advanced'], ['share', 'Share'],
] as const;
type SectionId = (typeof SECTIONS)[number][0];
const COLORS = ['#0f766e', '#1d4ed8', '#7c3aed', '#be123c', '#b45309', '#15803d', '#334155', '#0e7490'];
const slug = (base: string, taken: string[]) => { const s = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'item'; let id = s, n = 2; while (taken.includes(id)) id = `${s}-${n++}`; return id; };
const toCents = (v: string) => Math.max(0, Math.round((parseFloat(v.replace(/[^0-9.]/g, '')) || 0) * 100));
const dollars = (c: number) => (c ? (c / 100).toFixed(c % 100 ? 2 : 0) : '');

/* ---------- small fields ---------- */
function F({ label, help, err, children, wide }: { label: string; help?: ReactNode; err?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`eb-f${wide ? ' wide' : ''}${err ? ' bad' : ''}`}>
      <span className="eb-l">{label}</span>
      {children}
      {help && <small className="eb-h">{help}</small>}
      {err && <small className="eb-e" role="alert">{err}</small>}
    </label>
  );
}
function Money({ value, onChange, label, placeholder = '0' }: { value: number; onChange: (c: number) => void; label: string; placeholder?: string }) {
  const [txt, setTxt] = useState(dollars(value));
  useEffect(() => { if (toCents(txt) !== value) setTxt(dollars(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className="eb-money"><i>$</i><input className="in" inputMode="decimal" aria-label={label} placeholder={placeholder} value={txt} onChange={(e) => { setTxt(e.target.value); onChange(toCents(e.target.value)); }} /></span>;
}
function Num({ value, onChange, label, min = 0, max = 100000 }: { value: number; onChange: (n: number) => void; label: string; min?: number; max?: number }) {
  return <input className="in eb-num" type="number" min={min} max={max} aria-label={label} value={value || ''} placeholder={min ? String(min) : 'No limit'} onChange={(e) => onChange(Math.max(min, Math.min(max, Math.floor(Number(e.target.value) || 0))))} />;
}
function Toggle({ id, label, help, on, set }: { id: string; label: string; help?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="eb-toggle">
      <label className="switch" htmlFor={id}><input id={id} type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} /><span className="switch-ui" aria-hidden="true" /></label>
      <label htmlFor={id}><b>{label}</b>{help && <small>{help}</small>}</label>
    </div>
  );
}
function Card({ id, title, intro, children, count }: { id: SectionId; title: string; intro?: string; children: ReactNode; count?: number }) {
  return (
    <section className="eb-card glass-pane" id={`eb-${id}`} data-sec={id} aria-labelledby={`eb-${id}-h`}>
      <header><h2 id={`eb-${id}-h`}>{title}{count ? <small className="pill">{count}</small> : null}</h2>{intro && <p>{intro}</p>}</header>
      {children}
    </section>
  );
}

/* ---------- the builder ---------- */
export function EventBuilder({ e, index, issues, onChange, onClose, actions, groups }: {
  e: EventItem; index: number; issues: Issues; onChange: (next: EventItem) => void; onClose: () => void; actions: ReactNode; groups: { id: string; name: string }[];
}) {
  const set = (fn: (x: EventItem) => void) => { const c = structuredClone(e); fn(c); onChange(c); };
  const err = (p: string) => issues[`events.${index}.${p}`];
  const errCount = (p: string) => Object.keys(issues).filter((k) => k.startsWith(`events.${index}.${p}`)).length;
  const [cur, setCur] = useState<SectionId>('title');
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const formRef = useRef<HTMLDivElement>(null);
  const mf = useMasjidFilter();
  const centers = mf.org.centers.filter((c) => c.active).map((c) => c.name);

  // the rail follows the scroll
  useEffect(() => {
    const root = formRef.current; if (!root) return;
    const io = new IntersectionObserver((ents) => { const v = ents.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setCur((v.target as HTMLElement).dataset.sec as SectionId); }, { root, rootMargin: '0px 0px -70% 0px' });
    root.querySelectorAll('[data-sec]').forEach((n) => io.observe(n)); return () => io.disconnect();
  }, []);
  const go = (id: SectionId) => { setCur(id); formRef.current?.querySelector(`#eb-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const secErr: Partial<Record<SectionId, number>> = {
    title: errCount('title') + errCount('summary'), when: errCount('start') + errCount('end') + errCount('registration.opens') + errCount('registration.closes') + errCount('reminders'),
    where: errCount('location'), design: errCount('design'), tickets: errCount('registration.types') + errCount('registration.capacity') + errCount('registration.guests'),
    questions: errCount('questions'), addons: errCount('addOns'), codes: errCount('discounts'), emails: errCount('emails'), advanced: errCount('groupIds') + errCount('registration.cancellation') + errCount('goal'),
  };
  const r = e.registration;
  const typeIds = r.types.map((t) => t.id);

  /* tickets */
  const addType = () => set((x) => { x.registration.enabled = true; x.registration.types.push({ id: slug('ticket', x.registration.types.map((t) => t.id)), name: 'New ticket', priceCents: 0, guestPriceCents: 0, availability: 'everyone', planIds: [], limit: 0, enabled: true, ...TYPE_DEFAULTS }); });
  const setType = (i: number, fn: (t: RegType) => void) => set((x) => { fn(x.registration.types[i]); });
  /* questions */
  const addQ = (scope: Question['scope']) => set((x) => { x.questions.push({ id: slug(scope === 'buyer' ? 'question' : 'attendee', x.questions.map((q) => q.id)), label: '', help: '', kind: scope === 'attendee' ? 'name' : 'text', scope, required: scope === 'attendee', options: [], typeIds: [] }); });
  const setQ = (i: number, fn: (q: Question) => void) => set((x) => { fn(x.questions[i]); });
  const addPreset = (label: string, kind: Question['kind'], options: string[] = [], scope: Question['scope'] = 'buyer') => set((x) => { x.questions.push({ id: slug(label, x.questions.map((q) => q.id)), label, help: '', kind, scope, required: kind === 'single', options: options.map((o) => ({ label: o, limit: 0 })), typeIds: [] }); });
  /* add-ons, codes */
  const setItem = (i: number, fn: (a: AddOn) => void) => set((x) => { fn(x.addOns.items[i]); });
  const setCode = (i: number, fn: (d: EventDiscount) => void) => set((x) => { fn(x.discounts[i]); });

  /* repeat: copies on later dates (Zeffy "add another date"), each its own event with its own tickets */
  const [rep, setRep] = useState<{ every: 'week' | 'month'; times: number }>({ every: 'week', times: 4 });
  const repeatDates = useMemo(() => Array.from({ length: rep.times }, (_, k) => {
    const d = new Date(`${e.start.slice(0, 10)}T12:00:00Z`); if (rep.every === 'week') d.setUTCDate(d.getUTCDate() + 7 * (k + 1)); else d.setUTCMonth(d.getUTCMonth() + k + 1);
    return d.toISOString().slice(0, 10);
  }), [e.start, rep]);

  const link = `/events/${e.id}`;
  const [copied, setCopied] = useState('');
  const copy = (txt: string, what: string) => { void navigator.clipboard?.writeText(txt).then(() => { setCopied(what); setTimeout(() => setCopied(''), 1500); }); };

  return (
    <div className="eb" data-event={e.id}>
      <div className="eb-top">
        <button type="button" className="btn xs ghost" onClick={onClose} aria-label="Back to all events">← Events</button>
        <b className="eb-name">{e.title || 'Untitled event'}</b>
        <span className={`pill ${e.status === 'published' ? 'good' : e.status === 'cancelled' ? 'bad' : ''}`}>{e.status === 'published' ? 'Published' : e.status === 'cancelled' ? 'Cancelled' : 'Draft'}</span>
        <span className="eb-actions">{actions}</span>
      </div>
      <div className="eb-grid">
        <nav className="eb-rail" aria-label="Event sections">
          {SECTIONS.map(([id, label], k) => (
            <button key={id} type="button" aria-current={cur === id ? 'step' : undefined} onClick={() => go(id)}>
              <i>{k + 1}</i>{label}{secErr[id] ? <em className="sf-badge" aria-label={`${secErr[id]} problems`}>{secErr[id]}</em> : null}
            </button>
          ))}
        </nav>

        <div className="eb-form" ref={formRef}>
          <Card id="title" title="Event title" intro="The name people see everywhere – the website, the e-ticket and the emails.">
            <div className="eb-row">
              <F label="Title" err={err('title')} wide><input className="in eb-big" value={e.title} maxLength={100} onChange={(v) => set((x) => { x.title = v.target.value; })} /></F>
              <F label="Category"><select className="in" value={e.category} onChange={(v) => set((x) => { x.category = v.target.value as EventItem['category']; })}>{Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
            </div>
            <F label="One-line summary" help="Shown on event cards and in search." err={err('summary')}><input className="in" value={e.summary} maxLength={300} onChange={(v) => set((x) => { x.summary = v.target.value; })} /></F>
          </Card>

          <Card id="when" title="Date and time" intro="When the event happens, and when tickets can be bought. Empty sale dates: sales open now and close when the event starts.">
            <div className="eb-row">
              <F label="Starts" err={err('start')}><input className="in" type="datetime-local" value={e.start} onChange={(v) => v.target.value && set((x) => { const len = Date.parse(x.end) - Date.parse(x.start); x.start = v.target.value; if (x.end <= x.start) x.end = new Date(Date.parse(`${x.start}:00Z`) + Math.max(len, 3600_000)).toISOString().slice(0, 16); })} /></F>
              <F label="Ends" err={err('end')}><input className="in" type="datetime-local" value={e.end} onChange={(v) => v.target.value && set((x) => { x.end = v.target.value; })} /></F>
            </div>
            <div className="eb-row">
              <F label="Sales open" err={err('registration.opens')}><input className="in" type="datetime-local" value={r.opens ?? ''} onChange={(v) => set((x) => { x.registration.opens = v.target.value || undefined; })} /></F>
              <F label="Sales close" err={err('registration.closes')}><input className="in" type="datetime-local" value={r.closes ?? ''} onChange={(v) => set((x) => { x.registration.closes = v.target.value || undefined; })} /></F>
            </div>
            <F label="Reminder emails" help="Days before the event. Up to four; 0 = the morning of the event." err={err('reminders')}>
              <span className="eb-chips">
                {e.reminders.map((d, k) => <span key={k} className="chip">{d === 0 ? 'Same day' : `${d} day${d === 1 ? '' : 's'} before`}<button type="button" aria-label="Remove reminder" onClick={() => set((x) => { x.reminders.splice(k, 1); })}>×</button></span>)}
                {e.reminders.length < 4 && <select className="in xs" aria-label="Add a reminder" value="" onChange={(v) => v.target.value !== '' && set((x) => { const n = Number(v.target.value); if (!x.reminders.includes(n)) x.reminders.push(n); x.reminders.sort((a, b) => b - a); })}><option value="">+ Add</option>{[0, 1, 2, 3, 5, 7, 14].filter((n) => !e.reminders.includes(n)).map((n) => <option key={n} value={n}>{n === 0 ? 'Same day' : `${n} days before`}</option>)}</select>}
              </span>
            </F>
            <details className="eb-more">
              <summary>Repeat this event</summary>
              <p className="muted small">Makes a copy for each date – each with its own tickets, capacity and guest list (like Zeffy’s extra dates).</p>
              <div className="eb-row">
                <F label="Every"><select className="in" value={rep.every} onChange={(v) => setRep({ ...rep, every: v.target.value as 'week' | 'month' })}><option value="week">Week</option><option value="month">Month</option></select></F>
                <F label="How many more dates"><Num label="How many more dates" min={1} max={12} value={rep.times} onChange={(n) => setRep({ ...rep, times: n })} /></F>
              </div>
              <p className="small">{repeatDates.map((d) => d.slice(5).replace('-', '/')).join(' · ')}</p>
              <button type="button" className="btn sm" data-repeat onClick={() => window.dispatchEvent(new CustomEvent('isgh:event-repeat', { detail: { id: e.id, dates: repeatDates } }))}>Make {rep.times} draft cop{rep.times === 1 ? 'y' : 'ies'}</button>
            </details>
          </Card>

          <Card id="where" title="Location">
            <div className="eb-row">
              <F label="Place name" err={err('location.name')}><input className="in" value={e.location.name} onChange={(v) => set((x) => { x.location.name = v.target.value; })} /></F>
              <F label="Masjid" help="Decides which masjid’s admins and pages show it."><select className="in" value={e.location.center ?? ''} onChange={(v) => set((x) => { x.location.center = v.target.value || undefined; if (v.target.value && !x.location.name) x.location.name = v.target.value; })}><option value="">The whole organization</option>{centers.map((c) => <option key={c}>{c}</option>)}</select></F>
            </div>
            <F label="Address" err={err('location.address')}><input className="in" value={e.location.address} placeholder="Street, city, ZIP" onChange={(v) => set((x) => { x.location.address = v.target.value; })} /></F>
            <F label="Online link (optional)" help="For a livestream or Zoom – starts with https://" err={err('location.onlineUrl')}><input className="in" value={e.location.onlineUrl ?? ''} placeholder="https://" onChange={(v) => set((x) => { x.location.onlineUrl = v.target.value || undefined; })} /></F>
          </Card>

          <Card id="about" title="Description" intro="What people can expect: program, speakers, who it is for, what to bring. A blank line starts a new paragraph.">
            <textarea className="in eb-desc" rows={8} maxLength={5000} value={e.description} onChange={(v) => set((x) => { x.description = v.target.value; })} placeholder={'Join us for an evening of …\n\nProgram\n6:00 Maghrib · 6:30 Dinner · 7:15 Talk'} />
            <small className="eb-h">{e.description.length} / 5000</small>
          </Card>

          <Card id="design" title="Design" intro="A color, a banner picture or a YouTube video at the top of the page and the e-ticket.">
            <F label="Color" err={err('design.color')}>
              <span className="eb-swatches" role="radiogroup" aria-label="Color">
                {COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={e.design.color === c} aria-label={c} style={{ background: c }} onClick={() => set((x) => { x.design.color = c; })} />)}
                <input type="color" aria-label="Another color" value={e.design.color || '#0f766e'} onChange={(v) => set((x) => { x.design.color = v.target.value; })} />
                {e.design.color && <button type="button" className="linkish small" onClick={() => set((x) => { x.design.color = ''; })}>Website color</button>}
              </span>
            </F>
            <div className="eb-row">
              <F label="Banner picture" help="An image address (https://… or /images/…). Wide pictures work best (1200 × 630)." err={err('design.bannerUrl')}><input className="in" value={e.design.bannerUrl} placeholder="https://" onChange={(v) => set((x) => { x.design.bannerUrl = v.target.value.trim(); })} /></F>
              <F label="…or a YouTube video" help="Shown instead of the banner." err={err('design.videoUrl')}><input className="in" value={e.design.videoUrl} placeholder="https://youtu.be/…" onChange={(v) => set((x) => { x.design.videoUrl = v.target.value.trim(); })} /></F>
            </div>
          </Card>

          <Card id="tickets" title="Tickets" count={r.types.length} intro="One card per ticket type. A free ticket ($0) works as an RSVP.">
            <Toggle id="eb-reg" label="People register for this event" help="Off: no tickets – “just come”." on={r.enabled} set={(v) => set((x) => { x.registration.enabled = v; })} />
            {r.enabled && <>
              <div className="eb-row three">
                <F label="Total capacity" help="All ticket types together. Empty = no limit." err={err('registration.capacity')}><Num label="Total capacity" value={r.capacity} onChange={(n) => set((x) => { x.registration.capacity = n; })} /></F>
                <F label="Tickets per order" help="1 = one person; more lets people buy for family and friends." err={err('registration.guests.max')}><Num label="Tickets per order" min={1} max={21} value={r.guests.allowed ? r.guests.max + 1 : 1} onChange={(n) => set((x) => { x.registration.guests = { allowed: n > 1, max: Math.max(0, n - 1) }; })} /></F>
                <F label="When it is full"><select className="in" value={r.waitlist ? 'wait' : 'stop'} onChange={(v) => set((x) => { x.registration.waitlist = v.target.value === 'wait'; })}><option value="stop">Stop sales</option><option value="wait">Open a waitlist</option></select></F>
              </div>
              {err('registration.types') && <p className="eb-e" role="alert">{err('registration.types')}</p>}
              <ul className="eb-list">
                {r.types.map((t, i) => {
                  const te = (p: string) => err(`registration.types.${i}.${p}`);
                  const sale = typeOnSale(t, new Date().toISOString().slice(0, 16));
                  return (
                    <li key={i} className={`eb-item${t.enabled ? '' : ' off'}`} data-type={t.id}>
                      <div className="eb-row ticket">
                        <F label="Ticket name" err={te('name')}><input className="in" value={t.name} maxLength={60} onChange={(v) => setType(i, (x) => { x.name = v.target.value; })} /></F>
                        <F label={t.payWhatYouCan ? 'Minimum price' : 'Price'} err={te('priceCents')}><Money label={`${t.name} price`} value={t.priceCents} placeholder="Free" onChange={(c) => setType(i, (x) => { x.priceCents = c; })} /></F>
                        <F label="Quantity" help="Empty = no limit" err={te('limit')}><Num label={`${t.name} quantity`} value={t.limit} onChange={(n) => setType(i, (x) => { x.limit = n; })} /></F>
                      </div>
                      <F label="What it includes" err={te('description')}><input className="in" value={t.description} maxLength={300} placeholder="e.g. Dinner and a reserved seat" onChange={(v) => setType(i, (x) => { x.description = v.target.value; })} /></F>
                      <details className="eb-more">
                        <summary>More options{t.payWhatYouCan ? ' · pay what you can' : ''}{t.groupSize > 1 ? ` · ${t.groupSize} seats` : ''}{t.availability !== 'everyone' ? ` · ${t.availability === 'members' ? 'members only' : t.availability === 'code' ? 'with a code' : 'some plans'}` : ''}{!sale.ok ? ` · ${sale.reason}` : ''}</summary>
                        <div className="eb-row three">
                          <F label="Who can buy it" err={te('availability')}><select className="in" value={t.availability} onChange={(v) => setType(i, (x) => { x.availability = v.target.value as RegType['availability']; })}><option value="everyone">Everyone</option><option value="members">Members only (signed in)</option><option value="plans">Some membership plans</option><option value="code">Hidden – needs a code</option></select></F>
                          {t.availability === 'code' && <F label="Code" err={te('code')}><input className="in" value={t.code ?? ''} onChange={(v) => setType(i, (x) => { x.code = v.target.value.toUpperCase(); })} /></F>}
                          {t.availability === 'plans' && <F label="Plans" err={te('planIds')}><select className="in" multiple value={t.planIds} onChange={(v) => setType(i, (x) => { x.planIds = [...v.target.selectedOptions].map((o) => o.value); })}>{Object.entries(PLANS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}</select></F>}
                          <F label="Category" help="Buyers can filter tickets by category."><input className="in" value={t.category} maxLength={40} placeholder="e.g. Sponsors" onChange={(v) => setType(i, (x) => { x.category = v.target.value; })} /></F>
                        </div>
                        <div className="eb-row">
                          <F label="On sale from" help="Early-bird or last-minute rate." err={te('salesStart')}><input className="in" type="datetime-local" value={t.salesStart} onChange={(v) => setType(i, (x) => { x.salesStart = v.target.value; })} /></F>
                          <F label="On sale until" err={te('salesEnd')}><input className="in" type="datetime-local" value={t.salesEnd} onChange={(v) => setType(i, (x) => { x.salesEnd = v.target.value; })} /></F>
                        </div>
                        <div className="eb-row three">
                          <F label="Seats per ticket" help="Table of 8, family pack, sponsor package." err={te('groupSize')}><Num label="Seats per ticket" min={1} max={20} value={t.groupSize} onChange={(n) => setType(i, (x) => { x.groupSize = n; })} /></F>
                          <F label="Tax-deductible part" help="Shown on the receipt (e.g. price minus dinner)." err={te('receiptCents')}><Money label="Tax-deductible part" value={t.receiptCents} onChange={(c) => setType(i, (x) => { x.receiptCents = c; })} /></F>
                          {r.guests.allowed && !t.payWhatYouCan && <F label="Price for extra tickets" help="Empty = same price" err={te('guestPriceCents')}><Money label="Price for extra tickets" value={t.guestPriceCents} placeholder={dollars(t.priceCents) || 'Free'} onChange={(c) => setType(i, (x) => { x.guestPriceCents = c; })} /></F>}
                        </div>
                        <Toggle id={`eb-pwyc-${i}`} label="Pay what you can" help="The buyer chooses the amount – at least the minimum price." on={t.payWhatYouCan} set={(v) => setType(i, (x) => { x.payWhatYouCan = v; })} />
                        <Toggle id={`eb-on-${i}`} label="On sale" help="Off hides this ticket without deleting it." on={t.enabled} set={(v) => setType(i, (x) => { x.enabled = v; })} />
                        <div className="eb-item-act">
                          <button type="button" className="btn xs" onClick={() => set((x) => { const c = structuredClone(x.registration.types[i]); c.id = slug(`${c.id}-copy`, x.registration.types.map((y) => y.id)); c.name += ' (copy)'; x.registration.types.splice(i + 1, 0, c); })}>Duplicate</button>
                          {r.types.length > 1 && <button type="button" className="btn xs danger-ghost" onClick={() => set((x) => { x.registration.types.splice(i, 1); x.questions.forEach((q) => { q.typeIds = q.typeIds.filter((id) => id !== t.id); }); x.discounts.forEach((d) => { d.typeIds = d.typeIds.filter((id) => id !== t.id); }); })}>Remove</button>}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
              <div className="eb-adds">
                <button type="button" className="btn sm" onClick={addType}>+ Add a ticket type</button>
                <button type="button" className="btn sm ghost" onClick={() => set((x) => { const ids = x.registration.types.map((t) => t.id); x.registration.types.push(...([['Gold sponsor', 250000, 10], ['Silver sponsor', 100000, 6], ['Bronze sponsor', 50000, 4]] as const).map(([n, p, g]) => ({ id: slug(n, ids), name: n, priceCents: p, guestPriceCents: 0, availability: 'everyone' as const, planIds: [], limit: 0, enabled: true, ...TYPE_DEFAULTS, groupSize: g, category: 'Sponsors', description: `Includes ${g} seats and recognition at the event.` }))); })}>+ Sponsorship tiers</button>
                <button type="button" className="btn sm ghost" onClick={() => set((x) => { x.registration.types.push({ id: slug('table', x.registration.types.map((t) => t.id)), name: 'Table of 8', priceCents: x.registration.types[0]?.priceCents ? x.registration.types[0].priceCents * 8 : 0, guestPriceCents: 0, availability: 'everyone', planIds: [], limit: 0, enabled: true, ...TYPE_DEFAULTS, groupSize: 8 }); })}>+ Table / family ticket</button>
              </div>
            </>}
          </Card>

          <Card id="questions" title="Questions" count={e.questions.length} intro="Asked on the form. “For each attendee” is asked once per ticket (names on tickets, meal choice); “Buyer only” once per order.">
            {(['attendee', 'buyer'] as const).map((scope) => (
              <div key={scope} className="eb-qgroup">
                <h3>{scope === 'attendee' ? 'For each attendee' : 'Buyer only'}</h3>
                <ul className="eb-list">
                  {e.questions.map((q, i) => ({ q, i })).filter(({ q }) => q.scope === scope).map(({ q, i }) => {
                    const qe = (p: string) => err(`questions.${i}.${p}`);
                    return (
                      <li key={i} className="eb-item" data-question={q.id}>
                        <div className="eb-row ticket">
                          <F label="Question" err={qe('label')}><input className="in" value={q.label} maxLength={140} placeholder="e.g. Meal choice" onChange={(v) => setQ(i, (x) => { x.label = v.target.value; })} /></F>
                          <F label="Answer type"><select className="in" value={q.kind} onChange={(v) => setQ(i, (x) => { x.kind = v.target.value as Question['kind']; if ((x.kind === 'single' || x.kind === 'multi') && x.options.length < 2) x.options = [{ label: 'Option 1', limit: 0 }, { label: 'Option 2', limit: 0 }]; })}>{Object.entries(QUESTION_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
                          <F label="Required"><select className="in" value={q.required || q.kind === 'single' ? 'yes' : 'no'} disabled={q.kind === 'single'} onChange={(v) => setQ(i, (x) => { x.required = v.target.value === 'yes'; })}><option value="yes">Required</option><option value="no">Optional</option></select></F>
                        </div>
                        {(q.kind === 'single' || q.kind === 'multi') && (
                          <div className="eb-opts">
                            {qe('options') && <p className="eb-e" role="alert">{qe('options')}</p>}
                            {q.options.map((o, k) => (
                              <div key={k} className="eb-opt">
                                <input className="in" aria-label={`Choice ${k + 1}`} value={o.label} maxLength={60} onChange={(v) => setQ(i, (x) => { x.options[k].label = v.target.value; })} />
                                <Num label={`Limit for choice ${k + 1}`} value={o.limit} onChange={(n) => setQ(i, (x) => { x.options[k].limit = n; })} />
                                <button type="button" className="icon-btn sm" aria-label={`Remove choice ${k + 1}`} onClick={() => setQ(i, (x) => { x.options.splice(k, 1); })}>×</button>
                              </div>
                            ))}
                            <button type="button" className="linkish small" onClick={() => setQ(i, (x) => { x.options.push({ label: `Option ${x.options.length + 1}`, limit: 0 }); })}>+ Add a choice</button>
                            <small className="eb-h">A limit greys the choice out when it is full (e.g. 40 vegetarian meals).</small>
                          </div>
                        )}
                        <details className="eb-more">
                          <summary>More options{q.typeIds.length ? ` · ${q.typeIds.length} ticket type${q.typeIds.length === 1 ? '' : 's'}` : ''}</summary>
                          <F label="Help text"><input className="in" value={q.help} maxLength={200} onChange={(v) => setQ(i, (x) => { x.help = v.target.value; })} /></F>
                          {scope === 'attendee' && r.types.length > 1 && (
                            <fieldset className="eb-checks"><legend>Ask for</legend>
                              <label><input type="checkbox" checked={!q.typeIds.length} onChange={(v) => setQ(i, (x) => { x.typeIds = v.target.checked ? [] : [typeIds[0]]; })} /> Every ticket type</label>
                              {q.typeIds.length > 0 && r.types.map((t) => <label key={t.id}><input type="checkbox" checked={q.typeIds.includes(t.id)} onChange={(v) => setQ(i, (x) => { x.typeIds = v.target.checked ? [...x.typeIds, t.id] : x.typeIds.filter((y) => y !== t.id); })} /> {t.name}</label>)}
                            </fieldset>
                          )}
                          <div className="eb-item-act">
                            <button type="button" className="btn xs" onClick={() => setQ(i, (x) => { x.scope = x.scope === 'buyer' ? 'attendee' : 'buyer'; x.typeIds = []; })}>Move to {scope === 'buyer' ? '“For each attendee”' : '“Buyer only”'}</button>
                            <button type="button" className="btn xs danger-ghost" onClick={() => set((x) => { x.questions.splice(i, 1); })}>Remove</button>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
                <div className="eb-adds">
                  <button type="button" className="btn sm" onClick={() => addQ(scope)}>+ Add a question</button>
                  {scope === 'attendee'
                    ? <><button type="button" className="btn sm ghost" onClick={() => addPreset('Name on the ticket', 'name', [], 'attendee')}>+ Name</button><button type="button" className="btn sm ghost" onClick={() => addPreset('Meal choice', 'single', ['Chicken', 'Vegetarian'], 'attendee')}>+ Meal choice</button><button type="button" className="btn sm ghost" onClick={() => addPreset('Age group', 'single', ['Adult', 'Youth (12–17)', 'Child (under 12)'], 'attendee')}>+ Age group</button></>
                    : <><button type="button" className="btn sm ghost" onClick={() => addPreset('Phone number', 'phone')}>+ Phone</button><button type="button" className="btn sm ghost" onClick={() => addPreset('How did you hear about this event?', 'single', ['Masjid announcement', 'Email', 'WhatsApp', 'Friend or family', 'Social media'])}>+ How did you hear</button><button type="button" className="btn sm ghost" onClick={() => addPreset('Allergies or special needs', 'text')}>+ Allergies / needs</button></>}
                </div>
              </div>
            ))}
          </Card>

          <Card id="addons" title="Add-ons" intro="A donation at checkout, and extras sold with the ticket (meals, parking, t-shirts).">
            <Toggle id="eb-don" label="Ask for a donation at checkout" help="Buyers can add a gift to their order; it is on their tax receipt." on={e.addOns.donation.enabled} set={(v) => set((x) => { x.addOns.donation.enabled = v; })} />
            {e.addOns.donation.enabled && <div className="eb-row three">
              <F label="Message" ><input className="in" value={e.addOns.donation.prompt} maxLength={140} placeholder="Add a gift for the masjid?" onChange={(v) => set((x) => { x.addOns.donation.prompt = v.target.value; })} /></F>
              <F label="Fund" help="Where the gift is booked."><input className="in" value={e.addOns.donation.fund} maxLength={60} placeholder="General fund" onChange={(v) => set((x) => { x.addOns.donation.fund = v.target.value; })} /></F>
              <F label="Suggested amounts" err={err('addOns.donation.suggested')}><input className="in" value={e.addOns.donation.suggested.map((c) => c / 100).join(', ')} onChange={(v) => set((x) => { x.addOns.donation.suggested = v.target.value.split(/[ ,]+/).map(toCents).filter((c) => c >= 100).slice(0, 4); })} /></F>
            </div>}
            <ul className="eb-list">
              {e.addOns.items.map((a, i) => (
                <li key={i} className="eb-item" data-addon={a.id}>
                  <div className="eb-row ticket">
                    <F label="Extra" err={err(`addOns.items.${i}.name`)}><input className="in" value={a.name} maxLength={60} onChange={(v) => setItem(i, (x) => { x.name = v.target.value; })} /></F>
                    <F label="Price"><Money label={`${a.name} price`} value={a.priceCents} onChange={(c) => setItem(i, (x) => { x.priceCents = c; })} /></F>
                    <F label="Quantity" help="Empty = no limit"><Num label={`${a.name} quantity`} value={a.limit} onChange={(n) => setItem(i, (x) => { x.limit = n; })} /></F>
                  </div>
                  <div className="eb-row">
                    <F label="Description"><input className="in" value={a.description} maxLength={200} onChange={(v) => setItem(i, (x) => { x.description = v.target.value; })} /></F>
                    <F label="Most per order"><Num label="Most per order" min={1} max={20} value={a.maxPerOrder} onChange={(n) => setItem(i, (x) => { x.maxPerOrder = n; })} /></F>
                  </div>
                  <div className="eb-item-act"><button type="button" className="btn xs danger-ghost" onClick={() => set((x) => { x.addOns.items.splice(i, 1); })}>Remove</button></div>
                </li>
              ))}
            </ul>
            <div className="eb-adds"><button type="button" className="btn sm" onClick={() => set((x) => { x.addOns.items.push({ id: slug('extra', x.addOns.items.map((y) => y.id)), name: 'Parking pass', description: '', priceCents: 500, limit: 0, maxPerOrder: 4 }); })}>+ Add an extra</button></div>
          </Card>

          <Card id="codes" title="Discount codes" count={e.discounts.length} intro="Codes take money off tickets (not add-ons or gifts). The organization’s own codes in Settings also work.">
            <ul className="eb-list">
              {e.discounts.map((d, i) => {
                const de = (p: string) => err(`discounts.${i}.${p}`);
                return (
                  <li key={i} className="eb-item" data-code={d.code}>
                    <div className="eb-row four">
                      <F label="Code" err={de('code')}><input className="in eb-code" value={d.code} maxLength={20} onChange={(v) => setCode(i, (x) => { x.code = v.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''); })} /></F>
                      <F label="Takes off" err={de('value')}><span className="eb-pair"><select className="in" aria-label="Kind" value={d.kind} onChange={(v) => setCode(i, (x) => { x.kind = v.target.value as EventDiscount['kind']; })}><option value="percent">%</option><option value="amount">$</option></select>
                        {d.kind === 'percent' ? <Num label="Percent off" min={1} max={100} value={d.value} onChange={(n) => setCode(i, (x) => { x.value = n; })} /> : <Money label="Amount off" value={d.value} onChange={(c) => setCode(i, (x) => { x.value = Math.max(1, c); })} />}</span></F>
                      <F label="Uses" help={`${d.used} used`}><Num label="Uses" value={d.uses} onChange={(n) => setCode(i, (x) => { x.uses = n; })} /></F>
                      <F label="Ends"><input className="in" type="datetime-local" value={d.ends} onChange={(v) => setCode(i, (x) => { x.ends = v.target.value; })} /></F>
                    </div>
                    {r.types.length > 1 && <fieldset className="eb-checks"><legend>For</legend>
                      <label><input type="checkbox" checked={!d.typeIds.length} onChange={(v) => setCode(i, (x) => { x.typeIds = v.target.checked ? [] : [typeIds[0]]; })} /> Every ticket</label>
                      {d.typeIds.length > 0 && r.types.map((t) => <label key={t.id}><input type="checkbox" checked={d.typeIds.includes(t.id)} onChange={(v) => setCode(i, (x) => { x.typeIds = v.target.checked ? [...x.typeIds, t.id] : x.typeIds.filter((y) => y !== t.id); })} /> {t.name}</label>)}
                    </fieldset>}
                    <div className="eb-item-act"><button type="button" className="btn xs danger-ghost" onClick={() => set((x) => { x.discounts.splice(i, 1); })}>Remove</button></div>
                  </li>
                );
              })}
            </ul>
            <div className="eb-adds"><button type="button" className="btn sm" onClick={() => set((x) => { const taken = x.discounts.map((d) => d.code); let c = 'EARLYBIRD', n = 2; while (taken.includes(c)) c = `EARLYBIRD${n++}`; x.discounts.push({ code: c, kind: 'percent', value: 10, uses: 0, used: 0, typeIds: [], ends: '' }); })}>+ Add a code</button></div>
          </Card>

          <Card id="emails" title="Emails" intro="The thank-you email goes out with every order and carries the e-ticket (QR code) and the receipt – it cannot be turned off.">
            <F label="Subject" help="Empty = “Your tickets: <event>”"><input className="in" value={e.emails.thankYouSubject} maxLength={140} placeholder={`Your tickets: ${e.title}`} onChange={(v) => set((x) => { x.emails.thankYouSubject = v.target.value; })} /></F>
            <F label="Message" help="Merge fields: {first_name}, {event}, {when}, {place}, {ref}.">
              <textarea className="in" rows={5} maxLength={3000} value={e.emails.thankYouBody} placeholder={'Assalamu alaikum {first_name},\n\nJazakAllahu khairan for registering for {event} on {when}. Your tickets are attached – show the QR code at the door.'} onChange={(v) => set((x) => { x.emails.thankYouBody = v.target.value; })} />
            </F>
            <F label="Tell these people about each order" help="Up to five staff emails, comma separated." err={err('emails.notify')}>
              <input className="in" value={e.emails.notify.join(', ')} onChange={(v) => set((x) => { x.emails.notify = v.target.value.split(/[ ,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 5); })} />
            </F>
            <p className="muted small">Reminder emails are set under Date and time ({e.reminders.length ? e.reminders.map((d) => (d === 0 ? 'same day' : `${d}d`)).join(', ') : 'none'}).</p>
          </Card>

          <Card id="advanced" title="Advanced">
            <div className="eb-row">
              <F label="Who can see the event" err={err('groupIds')}><select className="in" value={e.visibility} onChange={(v) => set((x) => { x.visibility = v.target.value as EventItem['visibility']; })}><option value="public">Everyone</option><option value="members">Members only (signed in)</option><option value="groups">Some groups only</option></select></F>
              {e.visibility === 'groups' && <F label="Groups"><select className="in" multiple value={e.groupIds} onChange={(v) => set((x) => { x.groupIds = [...v.target.selectedOptions].map((o) => o.value); })}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></F>}
            </div>
            <div className="eb-row three">
              <F label="Cancelling" err={err('registration.cancellation')}><select className="in" value={r.cancellation.policy} onChange={(v) => set((x) => { x.registration.cancellation.policy = v.target.value as EventItem['registration']['cancellation']['policy']; })}><option value="until">Allowed until some days before</option><option value="anytime">Allowed until it starts</option><option value="none">Not allowed online</option></select></F>
              {r.cancellation.policy === 'until' && <F label="Days before"><Num label="Days before" value={r.cancellation.daysBefore} max={60} onChange={(n) => set((x) => { x.registration.cancellation.daysBefore = n; })} /></F>}
              {r.cancellation.policy !== 'none' && <F label="Refund"><select className="in" value={r.cancellation.refund} onChange={(v) => set((x) => { x.registration.cancellation.refund = v.target.value as 'full' | 'minus-fee' | 'none'; })}><option value="full">Full refund</option><option value="minus-fee">Keep a fee</option><option value="none">No refund</option></select></F>}
              {r.cancellation.policy !== 'none' && r.cancellation.refund === 'minus-fee' && <F label="Fee kept" err={err('registration.cancellation.feeCents')}><Money label="Fee kept" value={r.cancellation.feeCents} onChange={(c) => set((x) => { x.registration.cancellation.feeCents = c; })} /></F>}
            </div>
            <Toggle id="eb-goal" label="Show a goal thermometer" help="Tickets, extras and gifts count toward it – good for galas and fundraising dinners." on={e.goal.show} set={(v) => set((x) => { x.goal.show = v; })} />
            {e.goal.show && <F label="Goal" err={err('goal.cents')}><Money label="Goal" value={e.goal.cents} onChange={(c) => set((x) => { x.goal.cents = c; })} /></F>}
            <Toggle id="eb-feat" label="Feature on the website home page" on={e.promotion.featured} set={(v) => set((x) => { x.promotion.featured = v; })} />
          </Card>

          <Card id="share" title="Share" intro={e.status === 'published' ? 'The event page is live – share the link or put the form on another website.' : 'Publish the event first; the link works after that.'}>
            <div className="eb-share">
              <code>{link}</code>
              <button type="button" className="btn xs" onClick={() => copy(`${location.origin.replace('admin', 'web')}${link}`, 'link')}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
              <button type="button" className="btn xs ghost" onClick={() => copy(`<iframe src="${link}?embed=1" style="width:100%;min-height:900px;border:0" title="${e.title.replace(/"/g, '')}"></iframe>`, 'embed')}>{copied === 'embed' ? 'Copied' : 'Copy embed code'}</button>
            </div>
            <p className="muted small">Page: <code>{link}</code> · calendar file: <code>{link}/ics</code>. Masjids can print the page QR from the website’s Share button.</p>
          </Card>
          <p className="eb-end muted small">All changes are kept as a draft until you press <b>Publish</b> at the top of the page.</p>
        </div>

        <aside className="eb-preview" aria-label="Preview">
          <div className="eb-pv-bar">
            <span>Preview</span>
            <span className="seg sm" role="radiogroup" aria-label="Preview size">
              {(['phone', 'desktop'] as const).map((d) => <button key={d} type="button" role="radio" aria-checked={device === d} onClick={() => setDevice(d)}>{d === 'phone' ? 'Phone' : 'Desktop'}</button>)}
            </span>
          </div>
          <div className={`eb-pv ${device}`}><EventPreview e={e} /></div>
        </aside>
      </div>
    </div>
  );
}

/* ---------- live preview: the public form, interactive, priced by the shared rules ---------- */
export function EventPreview({ e }: { e: EventItem }) {
  const now = new Date().toISOString().slice(0, 16);
  const shown = e.registration.types.filter((t) => t.enabled);
  const cats = [...new Set(shown.map((t) => t.category).filter(Boolean))];
  const [cat, setCat] = useState('');
  const [typeId, setTypeId] = useState(shown[0]?.id ?? '');
  const t = shown.find((x) => x.id === typeId) ?? shown[0];
  const [qty, setQty] = useState(1);
  const [amount, setAmount] = useState(0);
  const [gift, setGift] = useState(0);
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [code, setCode] = useState('');
  const maxQty = e.registration.guests.allowed ? e.registration.guests.max + 1 : 1;
  const total = t ? orderTotal(e, { typeId: t.id, guests: Math.min(qty, maxQty) - 1, amountCents: amount || t.priceCents, addOns: extras, donationCents: gift, code }, now) : null;
  const qs = t ? questionsFor(e, t.id) : { buyer: [], attendee: [] };
  const vid = youTubeId(e.design.videoUrl);
  const st = registrationState(e, now);
  const accent = e.design.color || 'var(--accent-ink)';
  const field = (q: Question, key: string) => (
    <label key={key} className="pv-q"><span>{q.label || 'Question'}{q.required || q.kind === 'single' ? ' *' : ''}</span>
      {q.kind === 'single' || q.kind === 'multi'
        ? <span className="pv-opts">{q.options.map((o) => { const left = optionLeft(e, q, o.label); return <span key={o.label} className={`pv-opt${left === 0 ? ' full' : ''}`}>{o.label}{left !== Infinity && <small> · {left} left</small>}</span>; })}</span>
        : q.kind === 'checkbox' ? <span className="pv-opts"><span className="pv-opt">Yes</span><span className="pv-opt">No</span></span>
        : <span className="pv-in">{q.kind === 'long' ? ' ' : ''}{QUESTION_KINDS[q.kind]}</span>}
      {q.help && <small>{q.help}</small>}
    </label>
  );
  return (
    <div className="pv" style={{ ['--pv' as string]: accent }}>
      {vid ? <div className="pv-media"><iframe src={`https://www.youtube-nocookie.com/embed/${vid}`} title="Event video" allow="encrypted-media" loading="lazy" /></div>
        : e.design.bannerUrl ? <div className="pv-media"><img src={e.design.bannerUrl} alt="" /></div>
        : <div className="pv-media pv-plain"><span>{e.title.slice(0, 1) || 'E'}</span></div>}
      <div className="pv-body">
        <small className="pv-cat">{CATEGORY_LABEL[e.category]}</small>
        <h3>{e.title || 'Untitled event'}</h3>
        <p className="pv-when">{fmtRange(e)}<br />{e.location.name}{e.location.address ? ` · ${e.location.address}` : ''}{e.location.onlineUrl ? ' · also online' : ''}</p>
        {e.goal.show && e.goal.cents > 0 && <div className="pv-goal"><i style={{ width: `${Math.min(100, (e.raisedCents / e.goal.cents) * 100)}%` }} /><small>{usd(e.raisedCents)} of {usd(e.goal.cents)}</small></div>}
        {e.description ? e.description.split(/\n{2,}/).slice(0, 4).map((p, k) => <p key={k} className="pv-desc">{p}</p>) : e.summary && <p className="pv-desc">{e.summary}</p>}
        {!e.registration.enabled ? <p className="pv-note">No registration – just come.</p> : <>
          <h4>Tickets</h4>
          {!st.open && <p className="pv-note">{st.reason}</p>}
          {cats.length > 1 && <div className="pv-cats">{['', ...cats].map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>{c || 'All'}</button>)}</div>}
          <div className="pv-tickets">
            {shown.filter((x) => !cat || x.category === cat).map((x) => {
              const sale = typeOnSale(x, now);
              return (
                <button key={x.id} type="button" className={`pv-ticket${t?.id === x.id ? ' on' : ''}`} disabled={!sale.ok} onClick={() => { setTypeId(x.id); setAmount(0); }}>
                  <span><b>{x.name}</b>{x.description && <small>{x.description}</small>}{x.availability !== 'everyone' && <small className="pv-tag">{x.availability === 'members' ? 'Members' : x.availability === 'code' ? 'Code needed' : 'Some plans'}</small>}{!sale.ok && <small className="pv-tag">{sale.reason}</small>}</span>
                  <em>{x.payWhatYouCan ? `From ${usd(x.priceCents)}` : x.priceCents ? usd(x.priceCents) : 'Free'}{x.groupSize > 1 && <small>{x.groupSize} seats</small>}</em>
                </button>
              );
            })}
          </div>
          {t && <div className="pv-row">
            {maxQty > 1 && <label>Tickets <select value={qty} onChange={(v) => setQty(Number(v.target.value))}>{Array.from({ length: maxQty }, (_, k) => <option key={k} value={k + 1}>{k + 1}</option>)}</select></label>}
            {t.payWhatYouCan && <label>Amount each <input inputMode="decimal" placeholder={dollars(t.priceCents)} onChange={(v) => setAmount(toCents(v.target.value))} /></label>}
          </div>}
          {e.addOns.items.length > 0 && <><h4>Extras</h4>{e.addOns.items.map((a) => <label key={a.id} className="pv-extra"><span>{a.name} <small>{usd(a.priceCents)}</small></span><select value={extras[a.id] ?? 0} onChange={(v) => setExtras({ ...extras, [a.id]: Number(v.target.value) })}>{Array.from({ length: a.maxPerOrder + 1 }, (_, k) => <option key={k} value={k}>{k}</option>)}</select></label>)}</>}
          {(qs.attendee.length > 0 || qs.buyer.length > 0) && <h4>Your details</h4>}
          {Array.from({ length: Math.min(qty, maxQty) }, (_, h) => qs.attendee.length > 0 && <fieldset key={h} className="pv-holder"><legend>Ticket {h + 1}</legend>{qs.attendee.map((q) => field(q, answerKey(q, h + 1)))}</fieldset>)}
          {qs.buyer.map((q) => field(q, answerKey(q)))}
          {e.addOns.donation.enabled && <div className="pv-gift"><b>{e.addOns.donation.prompt || 'Add a gift for the masjid?'}</b><span>{[0, ...e.addOns.donation.suggested].map((c) => <button key={c} type="button" aria-pressed={gift === c} onClick={() => setGift(c)}>{c ? usd(c) : 'No thanks'}</button>)}</span></div>}
          <label className="pv-code">Discount code <input value={code} onChange={(v) => setCode(v.target.value)} placeholder="Optional" /></label>
          {total && <div className="pv-total">
            {!total.ok ? <p className="pv-err">{total.message}</p> : <>
              <span>Tickets <b>{usd(total.ticketCents)}</b></span>
              {total.discountCents > 0 && <span>{total.discount?.message} <b>−{usd(total.discountCents)}</b></span>}
              {total.unknownCode && <span className="pv-err">Code checked at payment (organization codes)</span>}
              {total.addOnCents > 0 && <span>Extras <b>{usd(total.addOnCents)}</b></span>}
              {total.donationCents > 0 && <span>Gift <b>{usd(total.donationCents)}</b></span>}
              <span className="pv-sum">Total <b>{total.totalCents ? usd(total.totalCents) : 'Free'}</b></span>
              {total.receiptCents > 0 && <small>Tax receipt: {usd(total.receiptCents)}</small>}
            </>}
            <button type="button" className="pv-pay" disabled>{total.totalCents ? 'Continue to payment' : 'Register'}</button>
          </div>}
        </>}
      </div>
    </div>
  );
}
