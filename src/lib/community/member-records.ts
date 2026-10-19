/**
 * CONTRACT – member records (WildApricot: Membership fields with access levels, member privacy, duplicate check,
 * archive, import/export). Pure functions shared by the website, the admin and the BE – never trust the browser:
 * the server runs the same checks before saving.
 *
 *   fieldsFor / canEdit     – who sees and who changes each extra profile field
 *   checkValues             – type, choice and required checks for field values (+ refuses fields the editor may not change)
 *   directoryCard           – what one directory entry shows to a visitor vs. a signed-in member
 *   findDuplicates          – same email / phone / name + date of birth, scored
 *   csvCell / toCsv / parseCsv – safe CSV out (no spreadsheet formulas) and a strict CSV reader
 *   planImport              – check every row of an import before anything is saved
 */
import { z } from 'zod';
import type { OrgConfig, ProfileField } from './org-config';

/* ---------- who sees / who edits ---------- */
export type Viewer = 'public' | 'member' | 'self' | 'admin';
export type FieldValue = string | number | boolean;
export type FieldValues = Record<string, FieldValue>;

/** Fields a viewer may SEE. Admin: all. The member themself: public + members. Other members: public + members. Visitors: public only. */
export function fieldsFor(fields: ProfileField[], viewer: Viewer): ProfileField[] {
  if (viewer === 'admin') return fields;
  if (viewer === 'public') return fields.filter((f) => f.access === 'public');
  return fields.filter((f) => f.access !== 'admins');
}
/** Admins change every field; members only their own, and only fields marked "members can edit". Files are never set here. */
export function canEdit(f: ProfileField, who: 'self' | 'admin'): boolean {
  if (f.type === 'file') return false; // files go through the private upload flow
  return who === 'admin' || (f.access !== 'admins' && f.memberEditable);
}

/* ---------- value checks ---------- */
const PHONE = /^\+?1?\s*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}$/;
export function valueSchema(f: ProfileField): z.ZodTypeAny {
  switch (f.type) {
    case 'number': return z.coerce.number({ invalid_type_error: 'Enter a number.' }).refine(Number.isFinite, 'Enter a number.');
    case 'date': return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 07/04/2026.').refine((s) => !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s), 'That date does not exist.');
    case 'email': return z.string().trim().toLowerCase().email('Enter an email like name@example.com.');
    case 'phone': return z.string().trim().regex(PHONE, 'Enter a 10-digit US phone number.').transform(formatPhone);
    case 'choice': return z.string().refine((v) => f.options.includes(v), 'Pick one of the choices.');
    case 'yesno': return z.union([z.boolean(), z.enum(['yes', 'no', 'true', 'false'])]).transform((v) => v === true || v === 'yes' || v === 'true');
    case 'file': return z.string().max(200);
    default: return z.string().trim().max(500, 'Keep it under 500 characters.');
  }
}
export const formatPhone = (s: string) => { const d = s.replace(/\D/g, '').slice(-10); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s; };
const blank = (v: unknown) => v === undefined || v === null || v === '';

/**
 * Check a set of values. `before` = what is saved now (fields the editor may not change are kept from it).
 * Unknown field IDs and changes to locked fields are errors, not silently dropped – the server must refuse them.
 */
export function checkValues(fields: ProfileField[], input: Record<string, unknown>, who: 'self' | 'admin', before: FieldValues = {}): { ok: boolean; values: FieldValues; errors: Record<string, string>; changed: string[] } {
  const errors: Record<string, string> = {}; const values: FieldValues = { ...before }; const changed: string[] = [];
  const byId = new Map(fields.map((f) => [f.id, f]));
  for (const k of Object.keys(input)) if (!byId.has(k)) errors[k] = 'There is no such field.';
  for (const f of fields) {
    const has = Object.prototype.hasOwnProperty.call(input, f.id);
    const raw = input[f.id];
    if (!canEdit(f, who)) { if (has && raw !== before[f.id] && !(blank(raw) && blank(before[f.id]))) errors[f.id] = who === 'self' ? 'Only the office can change this.' : 'Files are added with the upload button.'; continue; }
    if (!has) { if (f.required && blank(before[f.id])) errors[f.id] = `${f.label} is required.`; continue; }
    if (blank(raw)) { if (f.required) errors[f.id] = `${f.label} is required.`; else if (!blank(before[f.id])) { delete values[f.id]; changed.push(f.id); } continue; }
    const r = valueSchema(f).safeParse(raw);
    if (!r.success) { errors[f.id] = r.error.issues[0]?.message ?? 'Check this value.'; continue; }
    if (r.data !== before[f.id]) { values[f.id] = r.data; changed.push(f.id); }
  }
  return { ok: !Object.keys(errors).length, values, errors, changed };
}
/** Show a value the way people read it (Houston formats). */
export function showValue(f: ProfileField, v: FieldValue | undefined): string {
  if (v === undefined || v === '') return '—';
  if (f.type === 'yesno') return v === true ? 'Yes' : 'No';
  if (f.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(5, 7)}/${v.slice(8, 10)}/${v.slice(0, 4)}`;
  if (f.type === 'number' && typeof v === 'number') return v.toLocaleString('en-US');
  return String(v);
}

/* ---------- member directory ---------- */
export type DirectoryPerson = { name: string; center?: string; phone?: string; email?: string; listed: boolean; values?: FieldValues };
/**
 * What one directory entry shows. Only people who chose to be listed (when opt-in is on). Phone and email are never
 * shown to visitors who are not signed in, even when the directory is public. Extra fields: "show in directory" + access.
 */
export function directoryCard(cfg: OrgConfig, p: DirectoryPerson, viewer: 'public' | 'member') {
  const d = cfg.members.directory;
  if (!d.enabled || (d.audience === 'members' && viewer === 'public') || (d.optIn && !p.listed)) return null;
  const extra = fieldsFor(cfg.members.fields, viewer).filter((f) => f.inDirectory && f.type !== 'file' && !blank(p.values?.[f.id]))
    .map((f) => ({ id: f.id, label: f.label, value: showValue(f, p.values![f.id]) }));
  return {
    name: p.name,
    center: d.showCenter ? p.center : undefined,
    phone: d.showPhone && viewer === 'member' ? p.phone : undefined,
    email: d.showEmail && viewer === 'member' ? p.email : undefined,
    extra,
  };
}

/* ---------- duplicates ---------- */
export type Person = { id?: string; first: string; last: string; email?: string; phone?: string; dob?: string; spouseId?: string };
export type DupMatch = { id: string; score: number; level: 'likely' | 'maybe'; reasons: string[] };
const norm = (s = '') => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
/** Gmail ignores dots and +tags; other providers ignore +tags at most, so only gmail.com dots are folded. */
export const emailKey = (e = '') => { const [u = '', h = ''] = e.trim().toLowerCase().split('@'); const user = u.split('+')[0]; return h ? `${h === 'gmail.com' || h === 'googlemail.com' ? user.replace(/\./g, '') : user}@${h === 'googlemail.com' ? 'gmail.com' : h}` : ''; };
export const phoneKey = (p = '') => { const d = p.replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };
/**
 * Score how likely `a` is already on file. Same email 60 · same name + birth date 50 · same phone 30 (households share
 * phones, so a phone alone is only "maybe") · same birth date + first initial + similar last name 25.
 * ≥ 60 likely, ≥ 30 maybe. Spouses linked to each other are never flagged for a shared phone.
 */
export function findDuplicates(a: Person, list: Person[], limit = 5): DupMatch[] {
  const ea = emailKey(a.email), pa = phoneKey(a.phone), fa = norm(a.first), la = norm(a.last);
  const out: DupMatch[] = [];
  for (const b of list) {
    if (a.id && b.id === a.id) continue;
    const reasons: string[] = []; let score = 0;
    if (ea && ea === emailKey(b.email)) { score += 60; reasons.push('Same email'); }
    const sameName = fa && fa === norm(b.first) && la === norm(b.last);
    if (sameName && a.dob && a.dob === b.dob) { score += 50; reasons.push('Same name and date of birth'); }
    else if (a.dob && a.dob === b.dob && fa[0] === norm(b.first)[0] && la && (la === norm(b.last) || la.slice(0, 4) === norm(b.last).slice(0, 4))) { score += 25; reasons.push('Same date of birth, similar name'); }
    const spouses = (a.id && b.spouseId === a.id) || (b.id && a.spouseId === b.id);
    if (pa && pa === phoneKey(b.phone) && !spouses) { score += 30; reasons.push('Same phone'); }
    if (score >= 30 && b.id) out.push({ id: b.id, score: Math.min(score, 100), level: score >= 60 ? 'likely' : 'maybe', reasons });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

/* ---------- CSV ---------- */
/** One CSV cell. Text that a spreadsheet would run as a formula (= + - @, tab, CR) gets a leading apostrophe. */
export function csvCell(v: unknown): string {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (head: string[], rows: unknown[][]) => [head.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
/** RFC 4180 reader: quoted cells, "" escapes, commas and line breaks inside quotes, CRLF or LF, a leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false; let i = 0;
  const s = text.replace(/^﻿/, '');
  while (i < s.length) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; } cell += c; i++; continue; }
    if (c === '"' && cell === '') { q = true; i++; continue; }
    if (c === ',') { row.push(cell); cell = ''; i++; continue; }
    if (c === '\r' || c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += c === '\r' && s[i + 1] === '\n' ? 2 : 1; continue; }
    cell += c; i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/* ---------- import ---------- */
export const IMPORT_COLUMNS = [
  { key: 'first', label: 'First name', required: true, aliases: ['first', 'firstname', 'givenname'] },
  { key: 'middle', label: 'Middle name', required: false, aliases: ['middle', 'middlename', 'middleinitial'] },
  { key: 'last', label: 'Last name', required: true, aliases: ['last', 'lastname', 'surname', 'familyname'] },
  { key: 'email', label: 'Email', required: true, aliases: ['email', 'emailaddress', 'mail', 'primaryemail'] },
  { key: 'phone', label: 'Phone', required: false, aliases: ['phone', 'mobile', 'cell', 'phonenumber', 'mobilephone', 'cellphone'] },
  { key: 'dob', label: 'Date of birth', required: false, aliases: ['dob', 'dateofbirth', 'birthdate', 'birthday'] },
  { key: 'street', label: 'Street', required: false, aliases: ['street', 'address', 'streetaddress', 'address1', 'addressline'] },
  { key: 'city', label: 'City', required: false, aliases: ['city'] },
  { key: 'zip', label: 'ZIP', required: false, aliases: ['zip', 'zipcode', 'postalcode', 'postcode'] },
  { key: 'plan', label: 'Plan', required: false, aliases: ['plan', 'level', 'membershiplevel', 'membershipplan', 'membershiptype'] },
  // M1 – what other systems export (Wild Apricot names in the aliases)
  { key: 'externalId', label: 'ID in the old system', required: false, aliases: ['userid', 'memberid', 'contactid', 'id', 'membernumber', 'externalid'] },
  { key: 'status', label: 'Membership status', required: false, aliases: ['status', 'membershipstatus', 'memberstatus'] },
  { key: 'memberSince', label: 'Member since', required: false, aliases: ['membersince', 'joined', 'joindate', 'createdon', 'datejoined', 'startdate'] },
  { key: 'renewalDue', label: 'Renewal due', required: false, aliases: ['renewaldue', 'renewaldate', 'renewaldudate', 'expires', 'expiry', 'expirationdate', 'paidthrough'] },
  { key: 'recurring', label: 'Recurring payment', required: false, aliases: ['recurring', 'recurringpayment', 'autorenew', 'automaticrenewal', 'checkomatic'] },
  { key: 'smsConsent', label: 'Text/SMS consent', required: false, aliases: ['smsconsent', 'textsmsconsent', 'textconsent', 'sms', 'textmessages'] },
  { key: 'emailOptIn', label: 'Subscribed to emails', required: false, aliases: ['subscribedtoemails', 'emailoptin', 'emailsubscription', 'subscribed', 'optedin', 'memberemailsandnewsletters'] },
  { key: 'archived', label: 'Archived', required: false, aliases: ['archived', 'isarchived'] },
  { key: 'notes', label: 'Notes', required: false, aliases: ['notes', 'note', 'comments', 'remarks', 'followup'] },
] as const;
/** Ready-made column matches for common sources; "generic" relies on the header names alone. */
export const IMPORT_PRESETS: { id: string; name: string; blurb: string; map: Record<string, ImportKey | 'ignore'> }[] = [
  { id: 'generic', name: 'Any spreadsheet (match by heading)', blurb: 'Headings like First name, Last name, Email, Phone, ZIP, Plan are matched by name; anything else can be matched by hand.', map: {} },
  { id: 'wildapricot', name: 'Wild Apricot contact export', blurb: 'Contacts › Export (CSV): User ID, First/Last name, Email, Phone, Membership level, Membership status, Member since, Renewal due, Text/SMS consent, Subscribed to emails, Archived.',
    map: { userid: 'externalId', membershiplevel: 'plan', membershipstatus: 'status', membersince: 'memberSince', renewaldue: 'renewalDue', textsmsconsent: 'smsConsent', subscribedtoemails: 'emailOptIn', archived: 'archived', followup: 'notes', company: 'ignore', enteredby: 'ignore', paymentprocessed: 'ignore', timestamp: 'ignore', subscriptionsource: 'ignore', administrationaccess: 'ignore', eventannouncements: 'ignore', createdon: 'memberSince', memberemailsandnewsletters: 'emailOptIn', balance: 'ignore', membershipenabled: 'ignore', profilelastupdated: 'ignore', lastlogin: 'ignore' } },
  { id: 'breeze', name: 'Breeze / Planning Center people export', blurb: 'First Name, Last Name, Email, Mobile Phone, Street Address, City, Zip, Status.', map: { mobilephone: 'phone', streetaddress: 'street', status: 'status' } },
];
/** What another system's status words mean here. Anything else is kept in the notes. */
export const STATUS_WORDS: Record<string, 'active' | 'pending' | 'lapsed' | 'archived'> = {
  active: 'active', current: 'active', member: 'active', good: 'active', goodstanding: 'active', paid: 'active', life: 'active', lifetime: 'active',
  pendingnew: 'pending', pendingrenewal: 'active', pendingupgrade: 'active', pendinglevelchange: 'active', pending: 'pending', new: 'pending', applied: 'pending', applicant: 'pending',
  lapsed: 'lapsed', expired: 'lapsed', overdue: 'lapsed', suspended: 'lapsed', inactive: 'lapsed', notrenewed: 'lapsed',
  archived: 'archived', deleted: 'archived', former: 'archived', deceased: 'archived',
};
export const readStatusWord = (v: string) => STATUS_WORDS[v.toLowerCase().replace(/[^a-z]/g, '')] ?? null;
export const readYesNo = (v: string) => { const t = v.trim().toLowerCase(); return t === '' ? null : ['yes', 'y', 'true', '1', 'x', 'on', 'checked', 'subscribed', 'opted in', 'optedin'].includes(t) ? true : ['no', 'n', 'false', '0', 'off', 'unsubscribed', 'opted out', 'optedout', 'unchecked'].includes(t) ? false : null; };
export type ImportKey = (typeof IMPORT_COLUMNS)[number]['key'];
export type ImportRecord = Record<ImportKey, string> & { values: FieldValues };
export type ImportRow = { line: number; record: ImportRecord | null; errors: string[]; duplicates: DupMatch[]; status: 'ok' | 'duplicate' | 'error' };
const headKey = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

/** US date (MM/DD/YYYY or M/D/YY) or ISO → YYYY-MM-DD; '' when it is not a real date. */
export function toIsoDate(s: string): string {
  const t = s.trim(); let y: number, m: number, d: number;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t), iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (us) { m = +us[1]; d = +us[2]; y = +us[3]; if (us[3].length === 2) y += y > 30 ? 1900 : 2000; } else if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; } else return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
}

/**
 * Check a whole file before saving anything. Headers are matched by name (First name, E-mail, Mobile…) or by an extra
 * field's label / ID. Rows with errors are never imported; possible duplicates (on file or earlier in the same file)
 * are held back for a person to decide.
 */
/** How each heading will be read: the preset's match, else the heading name, else an extra profile field, else nothing. `mapping` (by heading) wins over all. */
export function matchColumns(head: string[], opts: { fields: ProfileField[]; preset?: string; mapping?: Record<string, string | null> }) {
  const preset = IMPORT_PRESETS.find((p) => p.id === (opts.preset ?? 'generic')) ?? IMPORT_PRESETS[0];
  return head.map((h) => {
    if (opts.mapping && h in opts.mapping) return { header: h, key: opts.mapping[h] };
    const k = headKey(h);
    const pre = preset.map[k]; if (pre) return { header: h, key: pre === 'ignore' ? null : (pre as string) };
    const std = IMPORT_COLUMNS.find((c) => (c.aliases as readonly string[]).includes(k) || headKey(c.label) === k);
    if (std) return { header: h, key: std.key as string };
    const f = opts.fields.find((x) => headKey(x.label) === k || x.id === h.trim().toLowerCase());
    return { header: h, key: f && f.type !== 'file' ? `field:${f.id}` : null };
  });
}
export function planImport(text: string, opts: { fields: ProfileField[]; plans: { id: string; name: string }[]; existing: Person[]; today: string; maxRows?: number; preset?: string; mapping?: Record<string, string | null> }) {
  const table = parseCsv(text);
  const maxRows = opts.maxRows ?? 2000;
  if (!table.length) return { columns: [] as { header: string; key: string | null }[], rows: [] as ImportRow[], missing: IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.label), tooMany: false };
  const [head, ...body] = table;
  const columns = matchColumns(head, opts);
  const missing = IMPORT_COLUMNS.filter((c) => c.required && !columns.some((x) => x.key === c.key)).map((c) => c.label);
  const seen: Person[] = [];
  const rows: ImportRow[] = body.slice(0, maxRows).map((cells, i) => {
    const line = i + 2; const errors: string[] = [];
    const rec = { first: '', middle: '', last: '', email: '', phone: '', dob: '', street: '', city: '', zip: '', plan: '', externalId: '', status: '', memberSince: '', renewalDue: '', recurring: '', smsConsent: '', emailOptIn: '', archived: '', notes: '', values: {} } as ImportRecord;
    const raw: Record<string, unknown> = {};
    columns.forEach((c, j) => { const v = (cells[j] ?? '').trim(); if (!c.key) return; if (c.key.startsWith('field:')) raw[c.key.slice(6)] = v; else (rec as Record<string, unknown>)[c.key] = v; });
    if (cells.length > head.length && cells.slice(head.length).some((x) => x.trim())) errors.push('More cells than column headings – check for a stray comma.');
    if (!rec.first) errors.push('First name is missing.');
    if (!rec.last) errors.push('Last name is missing.');
    if (!rec.email) errors.push('Email is missing.');
    else if (!z.string().email().safeParse(rec.email).success) errors.push(`“${rec.email}” is not an email.`); else rec.email = rec.email.toLowerCase();
    if (rec.phone) { if (!PHONE.test(rec.phone)) errors.push(`“${rec.phone}” is not a 10-digit US phone.`); else rec.phone = formatPhone(rec.phone); }
    if (rec.dob) { const iso = toIsoDate(rec.dob); if (!iso) errors.push(`“${rec.dob}” is not a date (use MM/DD/YYYY).`); else if (iso > opts.today) errors.push('Date of birth is in the future.'); else rec.dob = iso; }
    if (rec.zip && !/^\d{5}(-\d{4})?$/.test(rec.zip)) errors.push(`“${rec.zip}” is not a ZIP code.`);
    if (rec.plan) { const p = opts.plans.find((x) => x.id === rec.plan.toLowerCase() || x.name.toLowerCase() === rec.plan.toLowerCase()); if (!p) errors.push(`There is no plan called “${rec.plan}”.`); else rec.plan = p.id; }
    // M1 – the other system's words become ours; a word we do not know is an error so nobody is silently made active
    if (rec.status) { const st = readStatusWord(rec.status); if (!st) errors.push(`Status “${rec.status}” is not one we know (Active, Pending, Lapsed, Archived…).`); else rec.status = st; }
    if (rec.memberSince) { const iso = toIsoDate(rec.memberSince); if (!iso) errors.push(`“${rec.memberSince}” (member since) is not a date.`); else rec.memberSince = iso; }
    if (rec.renewalDue) { const iso = toIsoDate(rec.renewalDue); if (!iso) errors.push(`“${rec.renewalDue}” (renewal due) is not a date.`); else rec.renewalDue = iso; }
    for (const k of ['recurring', 'smsConsent', 'emailOptIn', 'archived'] as const) { if (rec[k] && readYesNo(rec[k]) === null) errors.push(`“${rec[k]}” (${IMPORT_COLUMNS.find((c) => c.key === k)!.label}) should be Yes or No.`); else if (rec[k]) rec[k] = readYesNo(rec[k]) ? 'yes' : 'no'; }
    const chk = checkValues(opts.fields.filter((f) => f.id in raw), raw, 'admin');
    for (const [id, msg] of Object.entries(chk.errors)) errors.push(`${opts.fields.find((f) => f.id === id)?.label ?? id}: ${msg}`);
    rec.values = chk.values;
    const me: Person = { first: rec.first, last: rec.last, email: rec.email, phone: rec.phone, dob: rec.dob };
    const duplicates = errors.length ? [] : [...findDuplicates(me, opts.existing), ...findDuplicates(me, seen).map((d) => ({ ...d, reasons: d.reasons.map((r) => `${r} (row ${d.id})`) }))];
    if (!errors.length) seen.push({ ...me, id: String(line) });
    return { line, record: errors.length ? null : rec, errors, duplicates, status: errors.length ? 'error' : duplicates.length ? 'duplicate' : 'ok' };
  });
  return { columns, rows, missing, tooMany: body.length > maxRows };
}
