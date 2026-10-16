/**
 * F7 Finance – the ledger behind donations (F3) and Zakat payouts (F2): funds (restricted or not), bank accounts (last
 * 4 digits only), income, expenses, transfers and financial aid, approvals by amount, budgets per center, fund balances,
 * quarterly statements and the Bylaws money rules:
 * - Fiscal year = calendar year (Art. X). Treasurer: accounting manual with approval process, quarterly statements,
 *   annual budget to the Board, audited annual report, signs checks (Art. IV Sec. 5). Each center's Finance Secretary
 *   prepares the center budget and quarterly statements for the Treasurer (Art. VI Sec. 3).
 * - Art. XII Sec. 4: cash given, lent or assigned to one person or entity over $20,000 in twelve months needs the Joint
 *   Board-Councils after a two-thirds Board vote; over $50,000 the General Body. Not for goods and services contracted
 *   and received, nor for disaster relief collected for a named charity with a two-thirds Board approval.
 * - Two-year financial plan updated and approved every year (Art. III Sec. 3); audited statements presented in March.
 * DEMO (no API). Live: /admin/finance. Synced to the admin by sync-contracts.mjs.
 */
import { z } from 'zod';

const CENTS = z.number().int().min(0).max(10_000_000_000);
const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const INCOME = { donations: 'Donations', dues: 'Membership dues', programs: 'Programs and events', school: 'School fees', rental: 'Hall rental', grants: 'Grants', 'other-income': 'Other income' } as const;
export const EXPENSE = { salaries: 'Salaries and wages', utilities: 'Utilities', maintenance: 'Maintenance and repairs', programs: 'Programs and events', school: 'School costs', 'zakat-aid': 'Zakat payouts', aid: 'Financial aid', construction: 'Construction', admin: 'Office and administration', 'other-expense': 'Other expenses' } as const;
export type Category = keyof typeof INCOME | keyof typeof EXPENSE;
export const CATEGORY_NAME: Record<string, string> = { ...INCOME, ...EXPENSE };
export const KIND = { income: 'Income', expense: 'Expense', transfer: 'Transfer between funds', aid: 'Financial aid / grant' } as const;
export const STATUS = { pending: 'Waiting for approval', approved: 'Approved – to pay', paid: 'Paid', received: 'Received', rejected: 'Not approved', void: 'Void' } as const;

/* ---------------- settings document `finance-settings` ---------------- */
export const FinanceSettingsSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  funds: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(2).max(60), restricted: z.boolean(), purpose: z.string().max(200) })).min(1).max(60),
  openingCents: z.record(z.string(), z.number().int()),                        // balance per fund on January 1
  accounts: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().trim().min(2).max(60), bank: z.string().max(60), last4: z.string().regex(/^\d{4}$/, 'Last 4 digits only.'), fund: z.string(), active: z.boolean() })).max(40),
  approval: z.object({
    levels: z.array(z.object({ roleId: z.string().min(2).max(40), label: z.string().max(60), upToCents: CENTS, ownCentersOnly: z.boolean() })).min(1).max(20),
    dualSignAboveCents: CENTS,                                                  // two approvals (two signatures on a check)
    boardAboveCents: CENTS,                                                     // a Board decision (meeting) must be linked
  }),
  budgets: z.array(z.object({ center: z.string().max(80), lines: z.record(z.string(), CENTS), approvedOn: z.union([ISO, z.literal('')]), approvedBy: z.enum(['Council', 'Board']) })).max(300),
  plan: z.object({ approvedOn: z.union([ISO, z.literal('')]) }),
  audit: z.object({ year: z.number().int(), presentedOn: z.union([ISO, z.literal('')]) }),
}).superRefine((s, ctx) => {
  const ids = new Set(s.funds.map((f) => f.id));
  if (ids.size !== s.funds.length) ctx.addIssue({ code: 'custom', path: ['funds'], message: 'Two funds use the same id.' });
  s.accounts.forEach((a, i) => { if (!ids.has(a.fund)) ctx.addIssue({ code: 'custom', path: ['accounts', i, 'fund'], message: 'Pick a fund that exists.' }); });
  const cs = new Set<string>(); s.budgets.forEach((b, i) => { if (cs.has(b.center)) ctx.addIssue({ code: 'custom', path: ['budgets', i, 'center'], message: 'Two budgets for the same center.' }); cs.add(b.center); });
  s.budgets.forEach((b, i) => Object.keys(b.lines).forEach((k) => { if (!(k in CATEGORY_NAME)) ctx.addIssue({ code: 'custom', path: ['budgets', i, 'lines'], message: `Unknown category “${k}”.` }); }));
  if (s.approval.dualSignAboveCents > s.approval.boardAboveCents) ctx.addIssue({ code: 'custom', path: ['approval', 'dualSignAboveCents'], message: 'Two signatures should start at or below the Board limit.' });
});
export type FinanceSettings = z.infer<typeof FinanceSettingsSchema>;

/* ---------------- transactions (records, not settings) ---------------- */
export const TxSchema = z.object({
  id: z.string().regex(/^TX-\d{4}-\d{4,6}$/),
  date: ISO,
  kind: z.enum(['income', 'expense', 'transfer', 'aid']),
  amountCents: z.number().int().min(1).max(10_000_000_000),
  fund: z.string(), toFund: z.string(),                                         // transfer: from fund → to fund
  center: z.string().max(80),                                                   // '' = headquarters / main
  category: z.string(),
  party: z.string().max(120),                                                   // payee or payer
  method: z.enum(['check', 'ach', 'card', 'cash', 'internal']),
  ref: z.string().max(40), account: z.string().max(40), memo: z.string().max(500),
  source: z.enum(['manual', 'donations', 'zakat', 'dues']),
  status: z.enum(['pending', 'approved', 'paid', 'received', 'rejected', 'void']),
  enteredBy: z.string().max(80),
  approvals: z.array(z.object({ by: z.string(), name: z.string(), roleId: z.string(), at: z.string() })).max(5),
  boardDecision: z.string().max(40),                                            // meeting id (Meetings and minutes)
  relief: z.boolean(),                                                          // Art. XII 4 D disaster relief
}).superRefine((t, ctx) => {
  if (t.kind === 'transfer' && (!t.toFund || t.toFund === t.fund)) ctx.addIssue({ code: 'custom', path: ['toFund'], message: 'Pick the fund the money moves to.' });
  if (t.kind === 'income' && !(t.category in INCOME)) ctx.addIssue({ code: 'custom', path: ['category'], message: 'Pick an income category.' });
  if ((t.kind === 'expense' || t.kind === 'aid') && !(t.category in EXPENSE)) ctx.addIssue({ code: 'custom', path: ['category'], message: 'Pick an expense category.' });
  if ((t.kind === 'expense' || t.kind === 'aid') && t.party.trim().length < 2) ctx.addIssue({ code: 'custom', path: ['party'], message: 'Who is paid?' });
  if (t.method === 'check' && (t.kind === 'expense' || t.kind === 'aid') && t.status === 'paid' && !t.ref) ctx.addIssue({ code: 'custom', path: ['ref'], message: 'Enter the check number.' });
});
export type Tx = z.infer<typeof TxSchema>;
export const StatementSchema = z.object({ center: z.string(), year: z.number().int(), quarter: z.number().int().min(1).max(4), submittedOn: ISO, by: z.string() });
export type Statement = z.infer<typeof StatementSchema>;

/* ---------------- approvals ---------------- */
export type Actor = { id: string; name: string; roleId: string; centers: string[] };
export const counts = (t: Pick<Tx, 'status'>) => ['approved', 'paid', 'received'].includes(t.status);
export function approvalsNeeded(t: Pick<Tx, 'amountCents' | 'kind' | 'source'>, s: FinanceSettings): number {
  if (t.kind === 'income' || t.source !== 'manual') return 0;                    // income and records from Donations/Zakat are approved there
  return t.amountCents > s.approval.dualSignAboveCents ? 2 : 1;
}
export function levelOf(roleId: string, s: FinanceSettings) { return s.approval.levels.find((l) => l.roleId === roleId) ?? null; }
/** Why this person may not approve this transaction ('' = may approve). */
export function cannotApprove(t: Tx, a: Actor, s: FinanceSettings): string {
  if (t.status !== 'pending') return 'Only transactions waiting for approval can be approved.';
  if (t.enteredBy === a.id) return 'You entered this one – someone else must approve it.';
  if (t.approvals.some((x) => x.by === a.id)) return 'You already approved it – a second person must approve.';
  if (t.party && a.name && t.party.toLowerCase().includes(a.name.toLowerCase())) return 'You cannot approve a payment to yourself.';
  const l = levelOf(a.roleId, s);
  if (!l) return 'Your role cannot approve payments.';
  if (t.amountCents > l.upToCents) return `Your limit is ${usd(l.upToCents)}.`;
  if (l.ownCentersOnly && !a.centers.includes(t.center)) return 'Only for payments of your own centers.';
  if (t.amountCents > s.approval.boardAboveCents && !t.boardDecision) return `Over ${usd(s.approval.boardAboveCents)} – link the Board decision first.`;
  return '';
}
/** Apply one approval; the transaction becomes approved when enough people approved. */
export function approveTx(t: Tx, a: Actor, s: FinanceSettings, at: string): Tx {
  const why = cannotApprove(t, a, s); if (why) throw new Error(why);
  const approvals = [...t.approvals, { by: a.id, name: a.name, roleId: a.roleId, at }];
  return { ...t, approvals, status: approvals.length >= approvalsNeeded(t, s) ? 'approved' : 'pending' };
}
export function nextStep(t: Tx, s: FinanceSettings): string {
  if (t.status === 'pending') { const need = approvalsNeeded(t, s); return `${t.approvals.length} of ${need} approval${need === 1 ? '' : 's'}${t.amountCents > s.approval.boardAboveCents && !t.boardDecision ? ' · Board decision needed' : ''}`; }
  if (t.status === 'approved') return t.kind === 'transfer' ? 'Approved – record the transfer' : 'Approved – pay it';
  return STATUS[t.status];
}

/* ---------------- Bylaws Art. XII Sec. 4 ---------------- */
/** Cash given, lent or assigned to one party in the 12 months up to this one (goods and services excluded). */
export function art12(t: Pick<Tx, 'kind' | 'party' | 'date' | 'amountCents' | 'relief' | 'id'>, all: Tx[]): { level: 'none' | 'joint' | 'general-body'; totalCents: number; text: string } {
  if (t.kind !== 'aid' || t.relief) return { level: 'none', totalCents: 0, text: '' };
  const from = new Date(Date.parse(`${t.date}T12:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
  const before = all.filter((x) => x.id !== t.id && x.kind === 'aid' && !x.relief && x.party.trim().toLowerCase() === t.party.trim().toLowerCase() && x.date > from && x.date <= t.date && x.status !== 'rejected' && x.status !== 'void');
  const total = before.reduce((a, x) => a + x.amountCents, 0) + t.amountCents;
  if (total > 5_000_000) return { level: 'general-body', totalCents: total, text: `${usd(total)} to ${t.party} in 12 months – over $50,000 needs the General Body after a two-thirds Board vote (Bylaws Art. XII Sec. 4 B).` };
  if (total > 2_000_000) return { level: 'joint', totalCents: total, text: `${usd(total)} to ${t.party} in 12 months – over $20,000 needs the Joint Board-Councils after a two-thirds Board vote (Art. XII Sec. 4 A).` };
  return { level: 'none', totalCents: total, text: '' };
}
/** Restricted money may only be spent on its purpose: moving it to another fund needs a Board decision. */
export function transferProblem(t: Pick<Tx, 'kind' | 'fund' | 'toFund' | 'boardDecision'>, s: FinanceSettings): string {
  if (t.kind !== 'transfer') return '';
  const f = s.funds.find((x) => x.id === t.fund);
  if (f?.restricted && !t.boardDecision) return `${f.name} is restricted (${f.purpose || 'for its purpose only'}) – moving it to another fund needs a Board decision.`;
  return '';
}

/* ---------------- reports ---------------- */
export function fundBalances(s: FinanceSettings, txs: Tx[], upTo = '9999-12-31') {
  const bal: Record<string, number> = Object.fromEntries(s.funds.map((f) => [f.id, s.openingCents[f.id] ?? 0]));
  const inc: Record<string, number> = {}; const out: Record<string, number> = {};
  for (const t of txs) {
    if (!counts(t) || !t.date.startsWith(String(s.year)) || t.date > upTo) continue;
    if (t.kind === 'income') { bal[t.fund] = (bal[t.fund] ?? 0) + t.amountCents; inc[t.fund] = (inc[t.fund] ?? 0) + t.amountCents; }
    else if (t.kind === 'transfer') { bal[t.fund] = (bal[t.fund] ?? 0) - t.amountCents; bal[t.toFund] = (bal[t.toFund] ?? 0) + t.amountCents; }
    else if (t.status === 'paid') { bal[t.fund] = (bal[t.fund] ?? 0) - t.amountCents; out[t.fund] = (out[t.fund] ?? 0) + t.amountCents; }
  }
  return s.funds.map((f) => ({ ...f, openingCents: s.openingCents[f.id] ?? 0, incomeCents: inc[f.id] ?? 0, spentCents: out[f.id] ?? 0, balanceCents: bal[f.id] ?? 0 }));
}
export function budgetVsActual(s: FinanceSettings, txs: Tx[], center: string) {
  const b = s.budgets.find((x) => x.center === center);
  const actual = (cat: string) => txs.filter((t) => t.center === center && t.category === cat && t.date.startsWith(String(s.year)) && (t.kind === 'income' ? counts(t) : t.status === 'paid')).reduce((a, t) => a + t.amountCents, 0);
  const cats = Array.from(new Set([...Object.keys(b?.lines ?? {}), ...txs.filter((t) => t.center === center && t.kind !== 'transfer').map((t) => t.category)])).filter((c) => c in CATEGORY_NAME);
  return cats.map((c) => { const bud = b?.lines[c] ?? 0; const act = actual(c); return { category: c, name: CATEGORY_NAME[c], income: c in INCOME, budgetCents: bud, actualCents: act, pct: bud ? Math.round((act / bud) * 100) : null }; })
    .sort((a, z) => Number(z.income) - Number(a.income) || z.budgetCents - a.budgetCents);
}
export function monthly(txs: Tx[], year: number, center?: string) {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`; const inMonth = txs.filter((t) => t.date.startsWith(key) && (center === undefined || t.center === center));
    return { month: key, incomeCents: inMonth.filter((t) => t.kind === 'income' && counts(t)).reduce((a, t) => a + t.amountCents, 0), expenseCents: inMonth.filter((t) => (t.kind === 'expense' || t.kind === 'aid') && t.status === 'paid').reduce((a, t) => a + t.amountCents, 0) };
  });
}
/** Quarterly statements due from each center's Finance Secretary (30 days after the quarter ends). */
export function statementsDue(centers: string[], list: Statement[], year: number, today: string) {
  const out: { center: string; quarter: number; dueOn: string; late: boolean }[] = [];
  for (const q of [1, 2, 3, 4]) {
    const end = new Date(Date.UTC(year, q * 3, 0)).toISOString().slice(0, 10);
    if (end >= today) continue;
    const due = new Date(Date.parse(`${end}T12:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10);
    for (const c of centers) if (!list.some((x) => x.center === c && x.year === year && x.quarter === q)) out.push({ center: c, quarter: q, dueOn: due, late: today > due });
  }
  return out;
}
export function financeWarnings(s: FinanceSettings, txs: Tx[], statements: Statement[], centers: string[], today: string): { level: 'stop' | 'look'; text: string; tx?: string }[] {
  const w: { level: 'stop' | 'look'; text: string; tx?: string }[] = [];
  const days = (a: string) => Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
  const waiting = txs.filter((t) => t.status === 'pending' && days(t.date) > 7);
  if (waiting.length) w.push({ level: 'look', text: `${waiting.length} payment${waiting.length === 1 ? '' : 's'} waiting for approval more than a week.` });
  const group = new Map<string, string[]>();
  const add = (k: string, id: string) => group.set(k, [...(group.get(k) ?? []), id]);
  for (const t of txs.filter((x) => x.status !== 'rejected' && x.status !== 'void')) {
    const a = art12(t, txs); if (a.level !== 'none') w.push({ level: 'stop', tx: t.id, text: `${t.id}: ${a.text}` });
    const tp = transferProblem(t, s); if (tp) w.push({ level: 'stop', tx: t.id, text: `${t.id}: ${tp}` });
    if (t.status === 'paid' && t.source === 'manual' && t.kind !== 'income' && t.approvals.length < approvalsNeeded(t, s)) add('paid without enough approvals', t.id);
    if (t.amountCents > s.approval.boardAboveCents && t.kind !== 'income' && t.source === 'manual' && !t.boardDecision) add(`over ${usd(s.approval.boardAboveCents)} without a Board decision`, t.id);
  }
  group.forEach((ids, k) => w.push({ level: 'stop', tx: ids[0], text: ids.length === 1 ? `${ids[0]}: ${k}.` : `${ids.length} payments ${k}: ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ' …' : ''}.` }));
  for (const f of fundBalances(s, txs)) if (f.balanceCents < 0) w.push({ level: 'stop', text: `${f.name}: balance is below zero (${usd(f.balanceCents)}).` });
  for (const c of ['', ...centers]) for (const r of budgetVsActual(s, txs, c)) if (!r.income && r.budgetCents && r.actualCents > r.budgetCents) w.push({ level: 'look', text: `${c || 'Headquarters'}: ${r.name} is over budget (${usd(r.actualCents)} of ${usd(r.budgetCents)}).` });
  const noBudget = centers.filter((c) => !s.budgets.some((b) => b.center === c && b.approvedOn));
  if (noBudget.length) w.push({ level: 'look', text: noBudget.length === 1 ? `${noBudget[0]}: no approved ${s.year} budget (the Council approves it).` : `${noBudget.length} centers have no approved ${s.year} budget (each Council approves its own): ${noBudget.slice(0, 4).join(', ')}${noBudget.length > 4 ? ' …' : ''}.` });
  const late = statementsDue(centers, statements, s.year, today).filter((x) => x.late);
  if (late.length) w.push({ level: 'look', text: `${late.length} quarterly statement${late.length === 1 ? '' : 's'} from centers overdue (Finance Secretaries send them to the Treasurer).` });
  if (!s.plan.approvedOn || days(s.plan.approvedOn) > 365) w.push({ level: 'look', text: 'The two-year financial plan was not approved by the Board in the last 12 months (Bylaws Art. III Sec. 3).' });
  if (today.slice(5) > '03-31' && (s.audit.year < s.year - 1 || !s.audit.presentedOn)) w.push({ level: 'look', text: `The audited statements for ${s.year - 1} were not presented at the March Joint meeting.` });
  return w;
}

export const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: c % 100 ? 2 : 0 });

/* ---------------- demo data ---------------- */
export const mockFinanceSettings: FinanceSettings = {
  year: 2026,
  funds: [
    { id: 'general', name: 'General operating', restricted: false, purpose: '' },
    { id: 'zakat', name: 'Zakat', restricted: true, purpose: 'Zakat-eligible people only' },
    { id: 'sadaqah', name: 'Sadaqah', restricted: true, purpose: 'Help for people in need' },
    { id: 'building', name: 'Building and expansion', restricted: true, purpose: 'Construction and major repairs' },
    { id: 'education', name: 'Education', restricted: true, purpose: 'Weekend and full-time schools' },
    { id: 'endowment', name: 'Endowment', restricted: true, purpose: 'Principal kept; income may be spent' },
  ],
  openingCents: { general: 41_250_000, zakat: 18_900_000, sadaqah: 6_420_000, building: 92_000_000, education: 7_800_000, endowment: 150_000_000 },
  accounts: [
    { id: 'operating', name: 'Operating checking', bank: 'Demo Bank', last4: '4471', fund: 'general', active: true },
    { id: 'zakat-acct', name: 'Zakat account', bank: 'Demo Bank', last4: '9032', fund: 'zakat', active: true },
    { id: 'building-acct', name: 'Building fund savings', bank: 'Demo Credit Union', last4: '1158', fund: 'building', active: true },
  ],
  approval: {
    levels: [
      { roleId: 'center-admin', label: 'Center office (own center)', upToCents: 100_000, ownCentersOnly: true },
      { roleId: 'finance-team', label: 'Finance team', upToCents: 500_000, ownCentersOnly: false },
      { roleId: 'treasurer', label: 'Treasurer', upToCents: 2_000_000, ownCentersOnly: false },
      { roleId: 'admin', label: 'Admin', upToCents: 2_000_000, ownCentersOnly: false },
      { roleId: 'owner', label: 'Owner', upToCents: 2_000_000, ownCentersOnly: false },
    ],
    dualSignAboveCents: 500_000, boardAboveCents: 2_000_000,
  },
  budgets: [
    { center: '', approvedOn: '2025-12-07', approvedBy: 'Board', lines: { donations: 120_000_000, dues: 18_000_000, salaries: 54_000_000, utilities: 9_600_000, maintenance: 8_000_000, admin: 6_000_000, 'zakat-aid': 30_000_000, aid: 4_000_000, construction: 40_000_000 } },
    { center: 'Southwest Islamic Center 1', approvedOn: '2026-01-11', approvedBy: 'Council', lines: { donations: 22_000_000, school: 6_500_000, rental: 1_200_000, salaries: 9_000_000, utilities: 2_400_000, maintenance: 1_800_000, school_costs: 0, programs: 1_500_000 } },
    { center: 'North Islamic Center 1', approvedOn: '2026-01-08', approvedBy: 'Council', lines: { donations: 15_000_000, salaries: 6_000_000, utilities: 1_800_000, maintenance: 1_200_000, programs: 900_000 } },
  ].map((b) => ({ ...b, lines: Object.fromEntries(Object.entries(b.lines).filter(([k]) => k in CATEGORY_NAME)) })) as FinanceSettings['budgets'],
  plan: { approvedOn: '2025-11-02' },
  audit: { year: 2025, presentedOn: '2026-03-22' },
};

let n = 0;
const T = (p: Partial<Tx> & Pick<Tx, 'date' | 'kind' | 'amountCents' | 'category'>): Tx => ({
  id: `TX-2026-${String(++n).padStart(5, '0')}`, fund: 'general', toFund: '', center: '', party: '', method: 'ach', ref: '', account: 'operating', memo: '', source: 'manual',
  status: p.kind === 'income' ? 'received' : 'paid', enteredBy: 'finance-team-demo', approvals: p.kind === 'income' ? [] : [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: `${p.date}T15:00:00Z` }], boardDecision: '', relief: false, ...p,
});
const M = Array.from({ length: 10 }, (_, i) => i + 1); // Jan–Oct
const d = (m: number, day: number) => `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
export const mockTransactions: Tx[] = [
  ...M.flatMap((m) => [
    T({ date: d(m, 3), kind: 'income', amountCents: 9_800_000 + m * 210_000, category: 'donations', party: 'Online and kiosk gifts (Donations)', source: 'donations', memo: 'Monthly payout batch' }),
    T({ date: d(m, 3), kind: 'income', amountCents: 1_600_000 + m * 40_000, fund: 'zakat', account: 'zakat-acct', category: 'donations', party: 'Zakat gifts (Donations)', source: 'donations' }),
    T({ date: d(m, 5), kind: 'income', amountCents: m <= 6 ? 2_200_000 : 300_000, category: 'dues', party: 'Membership dues', source: 'dues' }),
    T({ date: d(m, 25), kind: 'expense', amountCents: 4_480_000, category: 'salaries', party: 'Payroll (staff)', memo: 'Monthly payroll (in the Board-approved budget)', boardDecision: 'MTG-2026-021', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: d(m, 24) }, { by: 'admin-demo', name: 'Admin', roleId: 'admin', at: d(m, 24) }] }),
    T({ date: d(m, 12), kind: 'expense', amountCents: 780_000 + (m >= 6 && m <= 9 ? 260_000 : 0), category: 'utilities', party: 'City Power (demo)', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: d(m, 11) }, { by: 'finance-team', name: 'Finance team', roleId: 'finance-team', at: d(m, 11) }] }),
    T({ date: d(m, 15), kind: 'expense', amountCents: 2_100_000 + m * 30_000, fund: 'zakat', account: 'zakat-acct', category: 'zakat-aid', party: 'Zakat payouts (Zakat and Sadaqah)', source: 'zakat', approvals: [] }),
    T({ date: d(m, 8), kind: 'income', amountCents: 1_700_000 + m * 30_000, center: 'Southwest Islamic Center 1', category: 'donations', party: 'Jumu’ah collections', method: 'cash' }),
    T({ date: d(m, 20), kind: 'expense', amountCents: 760_000, center: 'Southwest Islamic Center 1', category: 'salaries', party: 'Center payroll', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: d(m, 19) }, { by: 'finance-team', name: 'Finance team', roleId: 'finance-team', at: d(m, 19) }] }),
    T({ date: d(m, 14), kind: 'expense', amountCents: 210_000 + (m >= 6 && m <= 9 ? 90_000 : 0), center: 'Southwest Islamic Center 1', category: 'utilities', party: 'City Power (demo)', approvals: [{ by: 'center-admin-sw1', name: 'Southwest 1 office', roleId: 'center-admin', at: d(m, 13) }] }),
    T({ date: d(m, 9), kind: 'income', amountCents: 1_150_000, center: 'North Islamic Center 1', category: 'donations', party: 'Jumu’ah collections', method: 'cash' }),
    T({ date: d(m, 21), kind: 'expense', amountCents: 520_000, center: 'North Islamic Center 1', category: 'salaries', party: 'Center payroll', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: d(m, 20) }, { by: 'finance-team', name: 'Finance team', roleId: 'finance-team', at: d(m, 20) }] }),
  ]),
  T({ date: '2026-02-10', kind: 'income', amountCents: 6_400_000, center: 'Southwest Islamic Center 1', fund: 'education', category: 'school', party: 'Weekend school fees (spring)' }),
  T({ date: '2026-08-18', kind: 'income', amountCents: 6_900_000, center: 'Southwest Islamic Center 1', fund: 'education', category: 'school', party: 'Weekend school fees (fall)' }),
  T({ date: '2026-04-14', kind: 'expense', amountCents: 3_800_000, fund: 'building', account: 'building-acct', category: 'construction', party: 'Demo Builders LLC', method: 'check', ref: '10233', boardDecision: 'MTG-2026-030', memo: 'Parking lot – phase 1', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: '2026-04-12' }, { by: 'owner-demo', name: 'Owner', roleId: 'owner', at: '2026-04-12' }] }),
  T({ date: '2026-07-07', kind: 'expense', amountCents: 1_480_000, center: 'North Islamic Center 1', category: 'maintenance', party: 'Roof Repair Co (demo)', method: 'check', ref: '10301', memo: 'Storm damage', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: '2026-07-06' }] }), // paid with 1 of 2 approvals
  T({ date: '2026-03-02', kind: 'aid', amountCents: 1_500_000, category: 'aid', party: 'Houston Islamic Academy (demo)', method: 'check', ref: '10210', memo: 'Scholarship grant – spring', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: '2026-03-01' }, { by: 'admin-demo', name: 'Admin', roleId: 'admin', at: '2026-03-01' }] }),
  T({ date: '2026-09-04', kind: 'aid', amountCents: 900_000, category: 'aid', party: 'Houston Islamic Academy (demo)', method: 'check', ref: '10322', memo: 'Scholarship grant – fall', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: '2026-09-03' }, { by: 'admin-demo', name: 'Admin', roleId: 'admin', at: '2026-09-03' }] }), // 12-month total $24,000 → Joint
  T({ date: '2026-09-15', kind: 'aid', amountCents: 2_500_000, category: 'aid', party: 'Gulf Coast Flood Relief (demo)', relief: true, boardDecision: 'MTG-2026-031', memo: 'Hurricane relief collection', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: '2026-09-14' }, { by: 'owner-demo', name: 'Owner', roleId: 'owner', at: '2026-09-14' }] }),
  T({ date: '2026-10-01', kind: 'transfer', amountCents: 2_000_000, fund: 'general', toFund: 'building', category: 'construction', party: '', method: 'internal', memo: 'Year-end set-aside for phase 2', status: 'approved', approvals: [{ by: 'treasurer', name: 'ISGH Treasurer', roleId: 'treasurer', at: '2026-10-01' }] }),
  T({ date: '2026-10-02', kind: 'expense', amountCents: 340_000, center: 'Southwest Islamic Center 1', category: 'maintenance', party: 'Cool Air HVAC (demo)', status: 'pending', approvals: [], enteredBy: 'center-admin-sw1' }),
  T({ date: '2026-10-06', kind: 'expense', amountCents: 86_000, center: 'North Islamic Center 1', category: 'programs', party: 'Youth night supplies', status: 'pending', approvals: [], enteredBy: 'center-admin-n1' }),
  T({ date: '2026-10-09', kind: 'expense', amountCents: 1_250_000, category: 'maintenance', party: 'Demo Roofing (HQ)', method: 'check', status: 'pending', approvals: [{ by: 'admin-demo', name: 'Admin', roleId: 'admin', at: '2026-10-09' }], enteredBy: 'front-office' }),
  T({ date: '2026-10-12', kind: 'transfer', amountCents: 500_000, fund: 'sadaqah', toFund: 'general', category: 'admin', method: 'internal', memo: 'Cover office costs', status: 'pending', approvals: [], enteredBy: 'finance-team' }),
];
export const mockStatements: Statement[] = [
  { center: 'Southwest Islamic Center 1', year: 2026, quarter: 1, submittedOn: '2026-04-20', by: 'Finance Secretary' },
  { center: 'Southwest Islamic Center 1', year: 2026, quarter: 2, submittedOn: '2026-07-18', by: 'Finance Secretary' },
  { center: 'North Islamic Center 1', year: 2026, quarter: 1, submittedOn: '2026-05-06', by: 'Finance Secretary' },
];
