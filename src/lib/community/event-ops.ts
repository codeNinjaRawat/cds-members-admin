/**
 * F9 Events extras – the calendar, clash checks (same center at the same time, Jumu'ah, congregational prayers, Eid),
 * approval of events entered by center offices, promotion plans, and event analytics (fill rate, attendance, no-shows,
 * revenue). Works on the existing `events` document (lib/community/events.ts) – no second copy of events.
 * DEMO (no API). Synced to the admin by sync-contracts.mjs – edit here (web), never in the admin copy.
 */
import type { EventItem, EventsDoc } from './events';
import { dayTimes, PRAYER_NAME, clock, type PrayerSettings } from './prayer';

const D = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00Z`);
export const addDays = (s: string, n: number) => { const t = D(s ?? '').getTime(); return Number.isNaN(t) ? String(s ?? '') : new Date(t + n * 86_400_000).toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 86_400_000);
const mins = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
export const fmt = (s: string) => (s ? `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}` : '');

/** Weeks of a month (Sunday first), each day as YYYY-MM-DD or '' outside the month. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)); const n = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [...Array(first.getUTCDay()).fill(''), ...Array.from({ length: n }, (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push('');
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
/** Events on a day (multi-day events show on every day). */
export const eventsOn = (events: EventItem[], day: string) => events.filter((e) => e.start.slice(0, 10) <= day && e.end.slice(0, 10) >= day).sort((a, b) => a.start.localeCompare(b.start));
const placeOf = (e: EventItem) => e.location.center || e.location.name;

export type Clash = { level: 'stop' | 'look' | 'tip'; text: string };
/** Problems with the time and place of one event. `jumuah`: khutbah times (HH:MM) of the event's center. */
export function clashes(e: EventItem, all: EventItem[], prayer?: PrayerSettings, jumuah: string[] = []): Clash[] {
  const out: Clash[] = [];
  if (e.status === 'cancelled') return out;
  const s = mins(e.start), en = e.start.slice(0, 10) === e.end.slice(0, 10) ? mins(e.end) : 24 * 60;
  for (const o of all) {
    if (o.id === e.id || o.status === 'cancelled' || placeOf(o) !== placeOf(e)) continue;
    if (o.start < e.end && e.start < o.end) out.push({ level: 'stop', text: `Same place and time as “${o.title}” (${o.start.slice(11)}–${o.end.slice(11)}).` });
  }
  const day = e.start.slice(0, 10);
  if (D(day).getUTCDay() === 5) for (const j of jumuah) { const k = mins(`0000-00-00T${j}`); if (s < k + 75 && en > k - 30) out.push({ level: 'stop', text: `Overlaps Jumu’ah (khutbah ${clock(k)}). Move it after the prayer.` }); }
  if (prayer) {
    const t = dayTimes(prayer, e.location.center ?? '', day);
    for (const sp of t.special) out.push({ level: 'stop', text: `${sp.name} is on this day – most families will be at the Eid prayer and celebrations.` });
    if (t.iqamah) for (const p of ['dhuhr', 'asr', 'maghrib', 'isha'] as const) { const at = t.iqamah[p]; if (at > s + 5 && at < en - 5) out.push({ level: 'tip', text: `Plan a break for ${PRAYER_NAME[p]} (iqamah ${clock(at)}).` }); }
  }
  return out;
}

export type Check = { ok: boolean; text: string };
/** What an approver checks before an event goes on the website. */
export function approvalChecks(e: EventItem, d: EventsDoc, today: string, cl: Clash[] = []): Check[] {
  const lead = daysBetween(today, e.start.slice(0, 10));
  const paid = e.registration.enabled && e.registration.types.some((t) => t.priceCents > 0);
  return [
    { ok: lead >= d.approval.leadDays, text: lead >= d.approval.leadDays ? `Planned ${lead} days ahead.` : `Only ${lead} days ahead – at least ${d.approval.leadDays} days are asked.` },
    { ok: e.summary.trim().length >= 20, text: e.summary.trim().length >= 20 ? 'Has a short description.' : 'Add a short description (what, for whom).' },
    { ok: !!(e.location.address || e.location.onlineUrl), text: e.location.address || e.location.onlineUrl ? 'Address or online link is set.' : 'Add the address or the online link.' },
    { ok: !paid || e.registration.capacity > 0, text: !paid ? 'No paid tickets – no capacity needed.' : e.registration.capacity > 0 ? 'Capacity is set for a paid event.' : 'A paid event needs a capacity.' },
    { ok: !cl.some((c) => c.level === 'stop'), text: cl.some((c) => c.level === 'stop') ? `Clash: ${cl.filter((c) => c.level === 'stop').map((c) => c.text).join(' ')}` : 'No clash with other events or Jumu’ah.' },
    { ok: e.promotion.email.audience !== 'none' || e.promotion.featured, text: e.promotion.email.audience !== 'none' || e.promotion.featured ? 'Has a promotion plan.' : 'No promotion yet – feature it or plan an email.' },
  ];
}

/** Promotion steps in date order (announcement, text message, reminders from the registration settings). */
export function promotionSteps(e: EventItem, today: string) {
  const day = e.start.slice(0, 10);
  const steps: { on: string; what: string; done: boolean }[] = [];
  if (e.promotion.featured) steps.push({ on: today < day ? today : day, what: 'Featured on the website’s Events page', done: true });
  if (e.promotion.email.audience !== 'none' && e.promotion.email.sendOn) steps.push({ on: e.promotion.email.sendOn, what: `Announcement email to ${AUDIENCE[e.promotion.email.audience]}`, done: e.promotion.email.sent || e.promotion.email.sendOn < today });
  if (e.promotion.sms.enabled && e.promotion.sms.sendOn) steps.push({ on: e.promotion.sms.sendOn, what: 'Text message to members who allow texts', done: e.promotion.sms.sendOn < today });
  if (e.registration.enabled) for (const r of e.reminders) steps.push({ on: addDays(day, -r), what: `Reminder to people registered (${r} day${r === 1 ? '' : 's'} before)`, done: addDays(day, -r) < today });
  return steps.sort((a, b) => a.on.localeCompare(b.on));
}
export const AUDIENCE = { none: 'nobody', everyone: 'everyone on the list', members: 'all members', center: 'members of the center', groups: 'the event’s groups' } as const;
/** A ready-to-post social text (no personal data). */
export function socialText(e: EventItem, site = 'isgh.org') {
  const when = new Date(`${e.start}:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const time = clock(mins(e.start));
  return `${e.title} – ${when}, ${time} at ${e.location.name}. ${e.summary ? `${e.summary} ` : ''}${e.registration.enabled ? 'Register' : 'Details'}: ${site}/events/${e.id}`.slice(0, 500);
}

/* ---------------- analytics ---------------- */
export type PastEvent = { id: string; title: string; category: EventItem['category']; center: string; date: string; capacity: number; registered: number; attended: number; revenueCents: number };
export function eventStats(list: PastEvent[]) {
  const withCap = list.filter((x) => x.capacity > 0);
  const reg = list.reduce((a, x) => a + x.registered, 0), att = list.reduce((a, x) => a + x.attended, 0);
  const byCat = new Map<string, { events: number; attended: number }>();
  list.forEach((x) => { const c = byCat.get(x.category) ?? { events: 0, attended: 0 }; c.events++; c.attended += x.attended; byCat.set(x.category, c); });
  const byMonth = new Map<string, number>(); list.forEach((x) => byMonth.set(x.date.slice(0, 7), (byMonth.get(x.date.slice(0, 7)) ?? 0) + x.attended));
  return {
    events: list.length, registered: reg, attended: att,
    attendancePct: reg ? Math.round((att / reg) * 100) : 0, noShows: Math.max(0, reg - att),
    fillPct: withCap.length ? Math.round((withCap.reduce((a, x) => a + Math.min(x.registered, x.capacity), 0) / withCap.reduce((a, x) => a + x.capacity, 0)) * 100) : 0,
    revenueCents: list.reduce((a, x) => a + x.revenueCents, 0),
    byCategory: Array.from(byCat.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.attended - a.attended),
    byMonth: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, attended]) => ({ month, attended })),
    best: [...list].filter((x) => x.registered >= 10).sort((a, b) => b.attended / b.registered - a.attended / a.registered).slice(0, 3),
    lowShow: [...list].filter((x) => x.registered >= 10 && x.attended / x.registered < 0.6),
  };
}
/** Things the events team should look at now. */
export function eventWarnings(d: EventsDoc, today: string, prayer?: PrayerSettings, jumuahOf: (center: string) => string[] = () => []): { text: string; event?: string }[] {
  const out: { text: string; event?: string }[] = [];
  const pending = d.events.filter((e) => e.approval.state === 'pending');
  if (pending.length) out.push({ event: pending[0].id, text: `${pending.length} event${pending.length === 1 ? '' : 's'} waiting for approval.` });
  for (const e of d.events.filter((x) => x.status === 'published' && x.end.slice(0, 10) >= today)) {
    const days = daysBetween(today, e.start.slice(0, 10));
    const cl = clashes(e, d.events, prayer, jumuahOf(e.location.center ?? '')).filter((c) => c.level === 'stop');
    if (cl.length) out.push({ event: e.id, text: `${e.title}: ${cl[0].text}` });
    if (days <= 7 && e.promotion.email.audience === 'none' && !e.promotion.featured) out.push({ event: e.id, text: `${e.title} is in ${days} days and is not promoted.` });
    if (e.registration.enabled && e.registration.capacity && days <= 10 && e.registered / e.registration.capacity < 0.4) out.push({ event: e.id, text: `${e.title}: only ${e.registered} of ${e.registration.capacity} registered with ${days} days to go.` });
  }
  return out;
}

/* ---------------- demo history for analytics (fictional) ---------------- */
const CATS: EventItem['category'][] = ['community', 'education', 'youth', 'sisters', 'religious', 'fundraiser', 'governance'];
const CENTERS = ['Southwest Islamic Center 1', 'North Islamic Center 1', 'Northwest Islamic Center 2', 'South Islamic Center 1', 'Southeast Islamic Center 3'];
const TITLES = ['Family night', 'Tafsir circle', 'Youth basketball night', 'Sisters’ halaqa', 'Seerah lecture', 'Charity dinner', 'Town hall', 'New Muslim welcome', 'Health fair', 'Quran competition'];
export const mockEventHistory: PastEvent[] = Array.from({ length: 36 }, (_, i) => {
  const cap = [0, 80, 120, 60, 200, 150][i % 6]; const reg = cap ? Math.round(cap * (0.55 + ((i * 37) % 45) / 100)) : 30 + (i * 13) % 90;
  const m = 1 + (i % 9); const cat = CATS[i % CATS.length];
  return { id: `past-${i + 1}`, title: `${TITLES[i % TITLES.length]} (demo)`, category: cat, center: CENTERS[i % CENTERS.length], date: `2026-${String(m).padStart(2, '0')}-${String(3 + (i * 5) % 24).padStart(2, '0')}`,
    capacity: cap, registered: Math.min(reg, cap || reg), attended: Math.round(Math.min(reg, cap || reg) * (0.5 + ((i * 29) % 45) / 100)), revenueCents: cat === 'fundraiser' ? 900_000 + i * 15_000 : cat === 'community' ? reg * 800 : 0 };
});
