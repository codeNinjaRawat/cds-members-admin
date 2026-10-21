/**
 * F6 Prayer times – adhan times calculated for Houston, iqamah rules per Islamic Center, Jumu'ah (from Zones and
 * centers), Eid and other special prayers, and checks that catch impossible schedules.
 * Calculation: standard solar formulas (as used by PrayTimes.org); ISNA angles (Fajr 15°, Isha 15°) and the standard
 * (Shafi'i, Maliki, Hanbali) Asr – the method printed on ISGH's monthly sheets. With the default minute adjustments it
 * matches ISGH's September 2025 sheet on 161 of 180 times and is never more than one minute off (tested).
 * DEMO (no API). Live: GET/PUT /admin/prayer-times, GET /public/prayer-times. Synced to the admin by sync-contracts.mjs.
 */
import { z } from 'zod';

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type Prayer = (typeof PRAYERS)[number];
export const IQAMAH_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type IqPrayer = (typeof IQAMAH_PRAYERS)[number];
export const PRAYER_NAME: Record<Prayer, string> = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
export const METHODS = {
  isna: { name: 'ISNA (North America) – Fajr 15°, Isha 15°', fajr: 15, isha: 15 },
  mwl: { name: 'Muslim World League – Fajr 18°, Isha 17°', fajr: 18, isha: 17 },
  egypt: { name: 'Egyptian Authority – Fajr 19.5°, Isha 17.5°', fajr: 19.5, isha: 17.5 },
  makkah: { name: 'Umm al-Qura, Makkah – Fajr 18.5°, Isha 90 minutes after Maghrib', fajr: 18.5, isha: 90 },
  karachi: { name: 'University of Islamic Sciences, Karachi – Fajr 18°, Isha 18°', fajr: 18, isha: 18 },
} as const;
export type Method = keyof typeof METHODS;

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 13:45.');
const MMDD = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Use month-day like 03-09.');
export const RuleSchema = z.object({
  from: MMDD, to: MMDD,                                     // inclusive; may wrap the new year (11-02 → 03-08)
  kind: z.enum(['after', 'fixed']),
  minutes: z.number().int().min(0).max(120),               // after the adhan
  time: z.union([HHMM, z.literal('')]),                     // fixed clock time
  roundTo: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(15)]),
});
const RULES = z.array(RuleSchema).min(1, 'Add at least one rule.').max(12);
export const CenterTimesSchema = z.object({
  center: z.string().min(2).max(80),
  iqamah: z.object({ fajr: RULES, dhuhr: RULES, asr: RULES, maghrib: RULES, isha: RULES }),
  note: z.string().max(200),
});
export const SpecialSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2).max(60),
  center: z.string().max(80),                               // '' = every center
  times: z.array(HHMM).min(1, 'Add at least one prayer time.').max(5),
  place: z.string().max(120),
});
/** O6 – Friday khutbah schedule (what the committee keeps in a sheet today): one row per Friday per center. */
export const KhutbahRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-24'),
  center: z.string().max(80),                               // center name (as in Zones and centers)
  khateeb: z.string().max(80).default(''),
  topic: z.string().max(160).default(''),
  language: z.string().max(30).default(''),
  time: z.union([HHMM, z.literal('')]).default(''),         // '' = the center's usual khutbah time
  note: z.string().max(200).default(''),
});
export type KhutbahRow = z.infer<typeof KhutbahRowSchema>;
export const KhutbahSchema = z.object({
  enabled: z.boolean().default(false),                      // show the Friday schedule on the website
  rows: z.array(KhutbahRowSchema).max(3000).default([]),
  feedbackUrl: z.string().max(300).default(''),             // e.g. /feedback?topic=khutbah
  note: z.string().max(300).default(''),                    // shown above the schedule
}).default({ enabled: false, rows: [], feedbackUrl: '', note: '' });

export const PrayerSettingsSchema = z.object({
  khutbah: KhutbahSchema,
  method: z.enum(Object.keys(METHODS) as [Method, ...Method[]]),
  asr: z.enum(['standard', 'hanafi']),
  location: z.object({ label: z.string().max(80), lat: z.number().min(-60).max(60), lng: z.number().min(-180).max(180) }),
  adjust: z.object({ fajr: z.number().int().min(-15).max(15), sunrise: z.number().int().min(-15).max(15), dhuhr: z.number().int().min(-15).max(15), asr: z.number().int().min(-15).max(15), maghrib: z.number().int().min(-15).max(15), isha: z.number().int().min(-15).max(15) }),
  hijriAdjust: z.number().int().min(-2).max(2),             // local moon sighting
  centers: z.array(CenterTimesSchema).max(200),
  special: z.array(SpecialSchema).max(100),
  website: z.object({ enabled: z.boolean(), showIqamah: z.boolean(), showHijri: z.boolean() }),
}).superRefine((d, ctx) => {
  const seen = new Set<string>();
  d.centers.forEach((c, i) => {
    if (seen.has(c.center)) ctx.addIssue({ code: 'custom', path: ['centers', i, 'center'], message: `${c.center} is listed twice.` });
    seen.add(c.center);
    IQAMAH_PRAYERS.forEach((p) => c.iqamah[p].forEach((r, j) => {
      if (r.kind === 'fixed' && !r.time) ctx.addIssue({ code: 'custom', path: ['centers', i, 'iqamah', p, j, 'time'], message: 'Enter the iqamah time.' });
    }));
    IQAMAH_PRAYERS.forEach((p) => { const gap = ruleGap(c.iqamah[p]); if (gap) ctx.addIssue({ code: 'custom', path: ['centers', i, 'iqamah', p], message: `${PRAYER_NAME[p]}: no rule covers ${gap}.` }); });
  });
  const ids = new Set<string>();
  d.special.forEach((s, i) => { if (ids.has(s.id)) ctx.addIssue({ code: 'custom', path: ['special', i, 'id'], message: 'Two special prayers use the same id.' }); ids.add(s.id); });
});
export type Rule = z.infer<typeof RuleSchema>;
/** Next Friday on or after a date (the date itself when it is a Friday). */
export function nextFriday(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`); const add = (5 - d.getUTCDay() + 7) % 7;
  return new Date(d.getTime() + add * 86_400_000).toISOString().slice(0, 10);
}
/** Khutbah rows for one Friday (all centers) or one center (coming Fridays), sorted. */
export function khutbahFor(k: PrayerSettings['khutbah'], opts: { date?: string; center?: string; from?: string; weeks?: number }): KhutbahRow[] {
  let rows = k.rows.slice();
  if (opts.date) rows = rows.filter((r) => r.date === opts.date);
  if (opts.center) rows = rows.filter((r) => r.center === opts.center);
  if (opts.from) { const to = new Date(Date.parse(`${opts.from}T12:00:00Z`) + (opts.weeks ?? 8) * 7 * 86_400_000).toISOString().slice(0, 10); rows = rows.filter((r) => r.date >= opts.from! && r.date <= to); }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.center.localeCompare(b.center) || a.time.localeCompare(b.time));
}
/** Parses pasted CSV/TSV (header row: date, center, khateeb, topic, language, time, note – any order, case-insensitive). Dates accept YYYY-MM-DD or MM/DD/YYYY. */
export function parseKhutbahSheet(text: string, centers: string[]): { rows: KhutbahRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ['Paste a header row and at least one schedule row.'] };
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const split = (l: string) => (sep === ',' ? l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()).filter((_, i, a) => i < a.length - 1 || _ !== '') ?? [] : l.split('\t').map((c) => c.trim()));
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const col = (names: string[]) => head.findIndex((h) => names.includes(h));
  const ix = { date: col(['date', 'friday']), center: col(['center', 'masjid', 'islamic center']), khateeb: col(['khateeb', 'khatib', 'speaker', 'imam']), topic: col(['topic', 'title', 'subject']), language: col(['language', 'lang']), time: col(['time', 'khutbah time', 'khutbah']), note: col(['note', 'notes', 'remarks']) };
  const errors: string[] = []; const rows: KhutbahRow[] = [];
  if (ix.date < 0 || ix.center < 0) return { rows, errors: ['The header must have a “date” and a “center” column.'] };
  const lower = new Map(centers.map((c) => [c.toLowerCase(), c]));
  lines.slice(1).forEach((l, i) => {
    const c = split(l); const get = (k: keyof typeof ix) => (ix[k] >= 0 ? (c[ix[k]] ?? '') : '');
    let date = get('date'); const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) date = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    const center = lower.get(get('center').toLowerCase()) ?? get('center');
    const row = KhutbahRowSchema.safeParse({ date, center, khateeb: get('khateeb'), topic: get('topic'), language: get('language'), time: get('time').replace(/^(\d):/, '0$1:'), note: get('note') });
    if (!row.success) { errors.push(`Row ${i + 2}: ${row.error.issues[0]?.message ?? 'invalid'}`); return; }
    if (!centers.includes(center)) errors.push(`Row ${i + 2}: “${center}” is not a center in Zones and centers (kept as typed).`);
    rows.push(row.data);
  });
  return { rows, errors };
}
export type CenterTimes = z.infer<typeof CenterTimesSchema>;
export type Special = z.infer<typeof SpecialSchema>;
export type PrayerSettings = z.infer<typeof PrayerSettingsSchema>;

/* ---------------- astronomy ---------------- */
const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => { const v = a - b * Math.floor(a / b); return v < 0 ? v + b : v; };
function julian(y: number, m: number, d: number) { if (m <= 2) { y--; m += 12; } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; }
function sun(jd: number) {
  const D = jd - 2451545; const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360); const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - RA };
}
/** Minutes after local midnight (unrounded). `utcOffset` in hours, e.g. -5 for Houston in summer. */
export function solarTimes(dateISO: string, lat: number, lng: number, utcOffset: number, method: Method = 'isna', asr: 'standard' | 'hanafi' = 'standard'): Record<Prayer, number> {
  const [y, m, d] = dateISO.split('-').map(Number);
  const jd = julian(y, m, d) - lng / (15 * 24);
  const M = METHODS[method];
  const noon = (t: number) => fix(12 - sun(jd + t).eqt, 24);
  const angleTime = (a: number, t: number, ccw: boolean) => { const s = sun(jd + t); const T = deg(Math.acos((-Math.sin(rad(a)) - Math.sin(rad(s.decl)) * Math.sin(rad(lat))) / (Math.cos(rad(s.decl)) * Math.cos(rad(lat))))) / 15; return noon(t) + (ccw ? -T : T); };
  const asrTime = (f: number, t: number) => { const s = sun(jd + t); return angleTime(-deg(Math.atan(1 / (f + Math.tan(rad(Math.abs(lat - s.decl)))))), t, false); };
  let t: Record<Prayer, number> = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let k = 0; k < 2; k++) {
    const p = (h: number) => h / 24;
    t = { fajr: angleTime(M.fajr, p(t.fajr), true), sunrise: angleTime(0.833, p(t.sunrise), true), dhuhr: noon(p(t.dhuhr)), asr: asrTime(asr === 'hanafi' ? 2 : 1, p(t.asr)), maghrib: angleTime(0.833, p(t.maghrib), false), isha: method === 'makkah' ? 0 : angleTime(M.isha, p(t.isha), false) };
  }
  if (method === 'makkah') t.isha = t.maghrib + 1.5;
  return Object.fromEntries(PRAYERS.map((k) => [k, (t[k] + utcOffset - lng / 15) * 60])) as Record<Prayer, number>;
}

/** Hours from UTC for a date in a time zone (Houston: −5 in daylight time, −6 in standard time). */
export function utcOffsetOn(dateISO: string, tz = 'America/Chicago'): number {
  const at = new Date(`${dateISO}T12:00:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at).map((p) => [p.type, p.value]));
  const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return Math.round((local - at.getTime()) / 3_600_000);
}

/* ---------------- iqamah ---------------- */
const mmdd = (iso: string) => iso.slice(5, 10);
const inRange = (d: string, r: Pick<Rule, 'from' | 'to'>) => (r.from <= r.to ? d >= r.from && d <= r.to : d >= r.from || d <= r.to);
const ALL_DAYS = Array.from({ length: 366 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(5, 10)); // leap year: every MM-DD
/** First day of the year (MM-DD, as "Mar 5") that no rule covers, or ''. */
export function ruleGap(rules: Pick<Rule, 'from' | 'to'>[]): string {
  const miss = ALL_DAYS.find((d) => !rules.some((r) => inRange(d, r)));
  return miss ? new Date(`2024-${miss}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}
const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
/** Iqamah in minutes after midnight for one prayer on one date. */
export function iqamahFor(rules: Rule[], dateISO: string, adhan: number): number {
  const r = rules.find((x) => inRange(mmdd(dateISO), x)) ?? rules[0];
  if (!r) return adhan;
  if (r.kind === 'fixed' && r.time) return hm(r.time);
  const raw = adhan + r.minutes;
  return Math.ceil(raw / r.roundTo) * r.roundTo;
}

/* ---------------- one day, one month ---------------- */
export type Day = { date: string; hijri: string; adhan: Record<Prayer, number>; iqamah: Record<IqPrayer, number> | null; jumuah: string[]; special: Special[] };
export function dayTimes(s: PrayerSettings, center: string, dateISO: string, jumuah: string[] = []): Day {
  const raw = solarTimes(dateISO, s.location.lat, s.location.lng, utcOffsetOn(dateISO), s.method, s.asr);
  const adhan = Object.fromEntries(PRAYERS.map((p) => [p, Math.round(raw[p]) + s.adjust[p]])) as Record<Prayer, number>;
  const c = s.centers.find((x) => x.center === center);
  const iqamah = c ? Object.fromEntries(IQAMAH_PRAYERS.map((p) => [p, iqamahFor(c.iqamah[p], dateISO, adhan[p])])) as Record<IqPrayer, number> : null;
  const friday = new Date(`${dateISO}T12:00:00Z`).getUTCDay() === 5;
  return { date: dateISO, hijri: hijriOf(dateISO, s.hijriAdjust), adhan, iqamah, jumuah: friday ? jumuah : [], special: s.special.filter((x) => x.date === dateISO && (!x.center || x.center === center)) };
}
export function monthDays(year: number, month: number) {
  const n = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
}
export function hijriOf(dateISO: string, adjust = 0): string {
  const d = new Date(`${dateISO}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + adjust);
  try { return new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d).replace(/ AH$/, ' AH'); } catch { return ''; }
}
export const clock = (min: number) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export const clock24 = (min: number) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
/** The next prayer (adhan or iqamah) after `nowMin` on that day, or null after Isha. */
export function nextPrayer(day: Day, nowMin: number): { prayer: IqPrayer; at: number; kind: 'adhan' | 'iqamah' } | null {
  for (const p of IQAMAH_PRAYERS) {
    if (day.adhan[p] > nowMin) return { prayer: p, at: day.adhan[p], kind: 'adhan' };
    if (day.iqamah && day.iqamah[p] > nowMin) return { prayer: p, at: day.iqamah[p], kind: 'iqamah' };
  }
  return null;
}

/* ---------------- checks ---------------- */
const fmtDay = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
/** Problems in the next `days` days, one line per center and problem (first and last day it happens). */
export function prayerWarnings(s: PrayerSettings, today: string, days = 90): { center: string; text: string }[] {
  const out: { center: string; text: string }[] = [];
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.parse(`${today}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  for (const c of s.centers) {
    const hits = new Map<string, string[]>();
    const hit = (k: string, d: string) => { const a = hits.get(k) ?? []; a.push(d); hits.set(k, a); };
    for (const d of dates) {
      const t = dayTimes(s, c.center, d);
      if (!t.iqamah) continue;
      IQAMAH_PRAYERS.forEach((p, i) => {
        if (t.iqamah![p] < t.adhan[p]) hit(`${PRAYER_NAME[p]} iqamah is before the adhan`, d);
        const next: Prayer = p === 'fajr' ? 'sunrise' : (IQAMAH_PRAYERS[i + 1] ?? 'isha');
        if (p !== 'isha' && t.iqamah![p] >= t.adhan[next] - (p === 'fajr' ? 10 : 0)) hit(p === 'fajr' ? 'Fajr iqamah is less than 10 minutes before sunrise' : `${PRAYER_NAME[p]} iqamah is after the ${PRAYER_NAME[next]} adhan`, d);
      });
      if (t.iqamah.maghrib - t.adhan.maghrib > 15) hit('Maghrib iqamah is more than 15 minutes after the adhan', d);
      if (t.iqamah.isha >= 24 * 60 - 30) hit('Isha iqamah is close to midnight', d);
    }
    hits.forEach((ds, k) => out.push({ center: c.center, text: `${c.center}: ${k} ${ds.length === 1 ? `on ${fmtDay(ds[0])}` : `on ${ds.length} days (${fmtDay(ds[0])} – ${fmtDay(ds[ds.length - 1])})`}. Change the rule or use “minutes after the adhan”.` }));
  }
  return out;
}

/* ---------------- demo settings ---------------- */
const R = (kind: Rule['kind'], v: number | string, from = '01-01', to = '12-31', roundTo: Rule['roundTo'] = 5): Rule => ({ from, to, kind, minutes: kind === 'after' ? (v as number) : 0, time: kind === 'fixed' ? (v as string) : '', roundTo });
/** Daylight time roughly March 9 – November 1; fixed Dhuhr and Asr times move with it. */
const standardIqamah = (dhuhrSummer = '13:45', dhuhrWinter = '13:00'): CenterTimes['iqamah'] => ({
  fajr: [R('after', 20)], dhuhr: [R('fixed', dhuhrSummer, '03-09', '11-01'), R('fixed', dhuhrWinter, '11-02', '03-08')],
  asr: [R('after', 15)], maghrib: [R('after', 5, '01-01', '12-31', 1)], isha: [R('after', 15)],
});
export const mockPrayerSettings: PrayerSettings = {
  khutbah: { enabled: true, feedbackUrl: '/feedback?topic=khutbah', note: 'Unless noted, khutbah starts at the center’s listed time and salat 30 minutes later. Subject to change.', rows: (() => { const f = nextFriday(new Date().toISOString().slice(0, 10)); const d = (w: number) => new Date(Date.parse(`${f}T12:00:00Z`) + w * 7 * 86_400_000).toISOString().slice(0, 10); return [
    { date: d(0), center: 'North Islamic Center 1', khateeb: 'Imam Yusuf Ali', topic: 'Gratitude in hard times', language: 'English', time: '', note: '' },
    { date: d(0), center: 'North Islamic Center 1', khateeb: 'Br. Ahmed Siddiqui', topic: 'The rights of neighbors', language: 'English', time: '14:15', note: 'Second jumuah' },
    { date: d(0), center: 'Southwest Islamic Center 1', khateeb: 'Sh. Omar Farooq', topic: 'Raising children with mercy', language: 'English / Arabic', time: '', note: '' },
    { date: d(1), center: 'North Islamic Center 1', khateeb: 'Dr. Hasan Qureshi', topic: 'Tawakkul', language: 'English', time: '', note: '' },
    { date: d(1), center: 'Southwest Islamic Center 1', khateeb: 'Imam Yusuf Ali', topic: 'Honesty in business', language: 'English', time: '', note: '' },
  ]; })() },
  method: 'isna', asr: 'standard',
  location: { label: 'Houston (downtown)', lat: 29.7604, lng: -95.3698 },
  adjust: { fajr: 2, sunrise: 0, dhuhr: 1, asr: 1, maghrib: 1, isha: 1 },
  hijriAdjust: 0,
  centers: ['North', 'Northwest', 'Southwest', 'South', 'Southeast'].flatMap((z) => [1, 2, 3, 4].map((n) => ({
    center: `${z} Islamic Center ${n}`,
    iqamah: n === 2 && z === 'South' ? { ...standardIqamah(), asr: [R('fixed', '17:00', '03-09', '11-01'), R('fixed', '15:45', '11-02', '03-08')] } : standardIqamah(n === 3 ? '13:30' : '13:45'),
    note: n === 1 ? 'Ladies’ prayer area upstairs.' : '',
  }))),
  special: [
    { id: 'eid-al-fitr-2027-main', date: '2027-03-10', name: 'Eid al-Fitr prayer', center: '', times: ['08:00', '09:30'], place: 'Each Islamic Center (check your center)' },
    { id: 'eid-al-adha-2027-main', date: '2027-05-16', name: 'Eid al-Adha prayer', center: 'Southwest Islamic Center 1', times: ['07:30', '09:00'], place: 'Main hall and parking lot' },
  ],
  website: { enabled: true, showIqamah: true, showHijri: true },
};
