/**
 * Join form definition – the admin's form builder controls this (admin › Membership › Join form builder).
 * Contract: GET /public/membership/join-form (demo: published into the demo store as "join-form").
 *
 * The form = Bylaws core (always there, locked: email, legal name, date of birth, phone, home address → center,
 * plan, commitment, pledge + signature, who pays) + admin sections. A section is either added to a core step
 * ("about", "plan", "pledge") or is its own step placed after one of them. Every admin field has: type, label,
 * help, required, options, "show only if" rule, which plans see it, who may see the answer, and a prefill source.
 * Validation below runs in the browser (each step) AND on the server (application endpoint) – same rules.
 */
import { z } from 'zod';

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'email', 'phone', 'select', 'radio', 'checkboxes', 'yesno', 'consent', 'info'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: 'Short answer', textarea: 'Long answer', number: 'Number', date: 'Date', email: 'Email', phone: 'Phone',
  select: 'Drop-down', radio: 'Pick one', checkboxes: 'Pick any', yesno: 'Yes / No', consent: 'Agree checkbox', info: 'Text only (no answer)',
};
export const PLACEMENTS = ['about', 'plan', 'pledge', 'step-after-about', 'step-after-plan', 'step-after-pledge'] as const;
export type Placement = (typeof PLACEMENTS)[number];
export const PLACEMENT_LABEL: Record<Placement, string> = {
  about: 'Inside “About you”', plan: 'Inside “Plan”', pledge: 'Inside “Pledge”',
  'step-after-about': 'Own step after “About you”', 'step-after-plan': 'Own step after “Plan”', 'step-after-pledge': 'Own step after “Pledge”',
};
export const VISIBILITY = ['member', 'staff', 'board'] as const;
export const VISIBILITY_LABEL: Record<(typeof VISIBILITY)[number], string> = {
  member: 'Member and all staff', staff: 'Staff only (member cannot see it later)', board: 'Board and election commission only',
};

const slug = z.string().regex(/^[a-z][a-z0-9-]{1,40}$/, 'Use lowercase letters, numbers and dashes, like how-heard');
export const ShowIfSchema = z.object({
  // another admin field id, or one of: plan.category ("individual"/"household"), plan.planId, plan.memberClass, about.age
  field: z.string().min(1),
  op: z.enum(['equals', 'notEquals', 'includes', 'answered', 'atLeast', 'atMost']),
  value: z.string().optional(),
});
export const FieldSchema = z.object({
  id: slug,
  type: z.enum(FIELD_TYPES),
  label: z.string().min(1, 'Every field needs a label.').max(160),
  help: z.string().max(400).optional(),
  placeholder: z.string().max(80).optional(),
  required: z.boolean().default(false),
  options: z.array(z.object({ value: z.string().min(1).max(60), label: z.string().min(1).max(120) })).max(40).optional(),
  min: z.number().optional(), max: z.number().optional(), maxLength: z.number().int().positive().max(4000).optional(),
  showIf: ShowIfSchema.optional(),
  plans: z.array(z.string()).default([]),                    // empty = every plan
  visibility: z.enum(VISIBILITY).default('staff'),
  prefill: z.enum(['none', 'lastYear']).default('none'),     // renewals start with last year's answer
  hidden: z.boolean().default(false),                        // switched off without deleting (answers kept)
});
export const SectionSchema = z.object({
  id: slug,
  title: z.string().min(1).max(80),
  intro: z.string().max(400).optional(),
  placement: z.enum(PLACEMENTS),
  hidden: z.boolean().default(false),
  fields: z.array(FieldSchema).max(40),
});
/** Core (Bylaws) fields: admin may rename them, change help text, and switch the optional ones off – never remove the required ones. */
export const CORE_FIELDS = {
  firstName: { step: 'about', label: 'First name', required: true, why: 'Legal name for the member record and the voter list.' },
  lastName: { step: 'about', label: 'Last name', required: true, why: 'Legal name for the member record and the voter list.' },
  middleName: { step: 'about', label: 'Middle name', required: false, why: '' },
  preferredName: { step: 'about', label: 'Name you go by', required: false, why: '' },
  dob: { step: 'about', label: 'Date of birth', required: true, why: 'Bylaws Art. I Sec. 2: 18 or older on the June 30 record date.' },
  phone: { step: 'about', label: 'Mobile phone', required: true, why: 'Account notices and the sign-in code by text.' },
  address: { step: 'about', label: 'Home address', required: true, why: 'Bylaws Art. II: members belong to the zone and Islamic Center where they live.' },
  unit: { step: 'about', label: 'Apt or unit', required: false, why: '' },
  plan: { step: 'plan', label: 'Plan', required: true, why: 'Dues schedule set by the Board.' },
  idNumber: { step: 'about', label: 'Driver license or ID card number', required: false, off: true, why: 'Identity check – switch on to ask for the number on the card (kept on the application only).' },
  commitments: { step: 'pledge', label: 'Commitment', required: false, why: 'Bylaws Art. I Sec. 2: at least one commitment to vote (the first one is recorded when this is off).' },
  pledge: { step: 'pledge', label: 'Pledge', required: true, why: 'Bylaws: application on the prescribed form. The label is the step heading; the help text is the checkbox.' },
  signature: { step: 'pledge', label: 'Signature', required: false, why: 'Typed full name under the pledge.' },
  consents: { step: 'pledge', label: 'Message consents', required: false, why: 'Email and text consent boxes (receipts and membership notices are always sent).' },
  payer: { step: 'review', label: 'Who is paying', required: false, why: 'Bylaws: own dues, or a relative by blood or marriage. Off = the member pays their own dues.' },
} as const;
export type CoreKey = keyof typeof CORE_FIELDS;
export const CoreOverrideSchema = z.object({ label: z.string().max(80).optional(), help: z.string().max(300).optional(), show: z.boolean().optional() });

export const JoinFormSchema = z.object({
  version: z.string().min(1),
  intro: z.string().max(400).optional(),
  core: z.record(z.string(), CoreOverrideSchema).default({}),
  sections: z.array(SectionSchema).max(20),
  helpers: z.object({
    idScan: z.boolean().default(true),          // "Scan your ID" fills name, date of birth, address
    saveForLater: z.boolean().default(true),    // link to continue on any device
    renewPrefill: z.boolean().default(true),    // existing members start from last year's answers
    google: z.boolean().default(true),
  }).default({}),
}).superRefine((f, ctx) => {
  const ids = new Set<string>();
  f.sections.forEach((s, si) => s.fields.forEach((fl, fi) => {
    if (ids.has(fl.id)) ctx.addIssue({ code: 'custom', path: ['sections', si, 'fields', fi, 'id'], message: `Two fields use the id “${fl.id}”. Ids must be unique.` });
    ids.add(fl.id);
    if (['select', 'radio', 'checkboxes'].includes(fl.type) && !(fl.options?.length)) ctx.addIssue({ code: 'custom', path: ['sections', si, 'fields', fi, 'options'], message: `“${fl.label}” needs at least one choice.` });
  }));
  const sids = f.sections.map((s) => s.id); sids.forEach((s, i) => { if (sids.indexOf(s) !== i) ctx.addIssue({ code: 'custom', path: ['sections', i, 'id'], message: 'Section ids must be unique.' }); });
  f.sections.forEach((s, si) => s.fields.forEach((fl, fi) => {
    const r = fl.showIf; if (!r) return;
    if (!r.field.startsWith('plan.') && !r.field.startsWith('about.') && !ids.has(r.field)) ctx.addIssue({ code: 'custom', path: ['sections', si, 'fields', fi, 'showIf', 'field'], message: `“${fl.label}” depends on a field that does not exist.` });
    if (r.field === fl.id) ctx.addIssue({ code: 'custom', path: ['sections', si, 'fields', fi, 'showIf', 'field'], message: 'A field cannot depend on itself.' });
  }));
});
export type JoinForm = z.infer<typeof JoinFormSchema>;
export type JoinField = z.infer<typeof FieldSchema>;
export type JoinSection = z.infer<typeof SectionSchema>;
export type Answers = Record<string, string | string[] | boolean | undefined>;
export type FormCtx = { planId: string; planCategory: string; memberClass: string; age: number | null };

/* ---------- rules ---------- */
const asText = (v: Answers[string]) => (Array.isArray(v) ? v.join(',') : v === undefined ? '' : String(v));
export function ruleHolds(rule: JoinField['showIf'], answers: Answers, ctx: FormCtx): boolean {
  if (!rule) return true;
  const v: Answers[string] = rule.field === 'plan.category' ? ctx.planCategory : rule.field === 'plan.planId' ? ctx.planId
    : rule.field === 'plan.memberClass' ? ctx.memberClass : rule.field === 'about.age' ? (ctx.age ?? '') + '' : answers[rule.field];
  const val = rule.value ?? '';
  switch (rule.op) {
    case 'equals': return asText(v) === val;
    case 'notEquals': return asText(v) !== val;
    case 'includes': return Array.isArray(v) ? v.includes(val) : asText(v) === val;
    case 'answered': return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '' && v !== false;
    case 'atLeast': return asText(v) !== '' && Number(asText(v)) >= Number(val);
    case 'atMost': return asText(v) !== '' && Number(asText(v)) <= Number(val);
  }
}
export const fieldShown = (f: JoinField, answers: Answers, ctx: FormCtx) => !f.hidden && (f.plans.length === 0 || f.plans.includes(ctx.planId)) && ruleHolds(f.showIf, answers, ctx);
export const sectionsAt = (form: JoinForm, placement: Placement) => form.sections.filter((s) => !s.hidden && s.placement === placement);
/** Sections that have at least one field to show right now. */
export const liveSections = (form: JoinForm, placement: Placement, answers: Answers, ctx: FormCtx) =>
  sectionsAt(form, placement).filter((s) => s.fields.some((f) => fieldShown(f, answers, ctx)));

/** Errors for the given sections (keys: "custom.<fieldId>"). Hidden/irrelevant fields are never required. */
export function validateSections(sections: JoinSection[], answers: Answers, ctx: FormCtx): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of sections) for (const f of s.fields) {
    if (!fieldShown(f, answers, ctx) || f.type === 'info') continue;
    const v = answers[f.id]; const k = `custom.${f.id}`;
    const empty = v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0);
    if (empty) { if (f.required) out[k] = f.type === 'consent' ? `Check the box: ${f.label}` : ['select', 'radio', 'checkboxes', 'yesno'].includes(f.type) ? `Choose an answer for “${f.label}”.` : `Answer “${f.label}”.`; continue; }
    const t = asText(v);
    if (f.maxLength && t.length > f.maxLength) out[k] = `“${f.label}” is too long (${f.maxLength} characters max).`;
    if (f.type === 'number') { const n = Number(t); if (!Number.isFinite(n)) out[k] = `Enter a number for “${f.label}”.`; else if (f.min !== undefined && n < f.min) out[k] = `“${f.label}” must be ${f.min} or more.`; else if (f.max !== undefined && n > f.max) out[k] = `“${f.label}” must be ${f.max} or less.`; }
    if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) out[k] = `Enter a valid email for “${f.label}”, like name@example.com.`;
    if (f.type === 'phone' && t.replace(/\D/g, '').replace(/^1/, '').length !== 10) out[k] = `Enter a 10-digit US phone number for “${f.label}”.`;
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(t)) out[k] = `Enter a date for “${f.label}”.`;
    if (['select', 'radio'].includes(f.type) && !(f.options ?? []).some((o) => o.value === t)) out[k] = `Choose one of the listed answers for “${f.label}”.`;
    if (f.type === 'checkboxes' && Array.isArray(v) && v.some((x) => !(f.options ?? []).some((o) => o.value === x))) out[k] = `Choose from the listed answers for “${f.label}”.`;
  }
  return out;
}
/** Server side: validate every section, and drop answers to fields that are not shown (never store what was not asked). */
export function cleanAnswers(form: JoinForm, answers: Answers, ctx: FormCtx) {
  const errors = validateSections(form.sections.filter((s) => !s.hidden), answers, ctx);
  const kept: Answers = {};
  for (const s of form.sections) if (!s.hidden) for (const f of s.fields) if (f.type !== 'info' && fieldShown(f, answers, ctx) && answers[f.id] !== undefined) kept[f.id] = answers[f.id];
  return { errors, answers: kept };
}
export const coreLabel = (form: JoinForm, key: CoreKey) => form.core[key]?.label || CORE_FIELDS[key].label;
export const coreHelp = (form: JoinForm, key: CoreKey, fallback?: string) => form.core[key]?.help || fallback;
export const coreShown = (form: JoinForm, key: CoreKey) => { const def = CORE_FIELDS[key] as { required: boolean; off?: boolean }; return def.required || (form.core[key]?.show ?? !def.off); };

/* ---------- default form (research: WildApricot + church/masjid membership forms + ISGH needs) ---------- */
const opt = (...xs: string[]) => xs.map((l) => ({ value: l.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), label: l }));
export const defaultJoinForm: JoinForm = {
  version: '2026-10-14',
  intro: 'About 4 minutes. You can save and finish later.',
  core: {},
  helpers: { idScan: true, saveForLater: true, renewPrefill: true, google: true },
  sections: [
    {
      id: 'contact-more', title: 'A little more about you', placement: 'about', hidden: false, fields: [
        { id: 'gender', type: 'radio', label: 'Gender', help: 'Used for sisters’ and brothers’ programs only.', required: false, options: opt('Female', 'Male'), plans: [], visibility: 'staff', prefill: 'lastYear', hidden: false },
      ],
    },
    {
      id: 'household', title: 'Your household', intro: 'Helps us plan weekend school, youth and family programs. Children are not members until they turn 18.', placement: 'plan', hidden: false, fields: [
        { id: 'children-count', type: 'number', label: 'Children under 18 living with you', required: false, min: 0, max: 15, plans: [], visibility: 'staff', prefill: 'lastYear', hidden: false },
        { id: 'weekend-school', type: 'yesno', label: 'Interested in weekend Islamic school for your children?', required: false, showIf: { field: 'children-count', op: 'atLeast', value: '1' }, plans: [], visibility: 'staff', prefill: 'none', hidden: false },
        { id: 'spouse-same-address', type: 'yesno', label: 'Does your spouse live at the same address?', help: 'Family members belong to the Islamic Center where they live.', required: true, showIf: { field: 'plan.category', op: 'equals', value: 'household' }, plans: [], visibility: 'staff', prefill: 'lastYear', hidden: false },
      ],
    },
    {
      id: 'involved', title: 'Getting involved', intro: 'Optional – tell us how you would like to help. You can change this later in your member home.', placement: 'step-after-plan', hidden: false, fields: [
        { id: 'how-heard', type: 'select', label: 'How did you hear about ISGH membership?', required: false, options: opt('Friend or family', 'Announcement at my masjid', 'Social media', 'ISGH website', 'An ISGH event', 'Other'), plans: [], visibility: 'staff', prefill: 'none', hidden: false },
        { id: 'how-heard-other', type: 'text', label: 'Please tell us where', required: false, maxLength: 120, showIf: { field: 'how-heard', op: 'equals', value: 'other' }, plans: [], visibility: 'staff', prefill: 'none', hidden: false },
        { id: 'volunteer', type: 'checkboxes', label: 'Ways you would like to help', required: false, options: opt('Weekend school teaching', 'Youth programs', 'Funeral services', 'Events and iftar', 'Fundraising', 'Medical clinic', 'IT and media', 'Translation'), plans: [], visibility: 'member', prefill: 'lastYear', hidden: false },
        { id: 'skills', type: 'text', label: 'Your profession or skills', placeholder: 'Teacher, nurse, accountant, electrician…', required: false, maxLength: 120, plans: [], visibility: 'member', prefill: 'lastYear', hidden: false },
        { id: 'languages', type: 'checkboxes', label: 'Languages you speak', required: false, options: opt('English', 'Arabic', 'Urdu', 'Bengali', 'Somali', 'Spanish', 'French', 'Turkish', 'Other'), plans: [], visibility: 'member', prefill: 'lastYear', hidden: false },
      ],
    },
  ],
};
