'use client';
/** F7 ledger records. Demo: this browser only. Live: /admin/finance/transactions (enter, approve, reject, paid, void), /statements. */
import { useEffect, useState } from 'react';
import { TxSchema, mockStatements, mockTransactions, usd, type Statement, type Tx } from '@/lib/community/finance';
import { logAudit } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

/* ---------- live mode: the ledger from the API (its approvals, limits and Art. XII checks decide) ---------- */
let live: { txs: Tx[]; statements: Statement[] } | null = null; let liveLoading: Promise<void> | null = null;
export function loadLiveLedger(force = false): Promise<void> {
  if (!force && live) return Promise.resolve();
  if (!force && liveLoading) return liveLoading;
  liveLoading = Promise.all([be<{ transactions: Tx[] }>('GET', 'admin/finance/transactions'), be<{ statements: Statement[] }>('GET', 'admin/finance/summary')]).then(([t, s]) => {
    liveLoading = null;
    if (!t.ok && t.status !== 401) notice(`The ledger could not be loaded: ${t.message}`);
    live = { txs: t.ok ? t.data.transactions : live?.txs ?? [], statements: s.ok ? s.data.statements ?? [] : live?.statements ?? [] };
    window.dispatchEvent(new Event(FINANCE_EVENT));
  });
  return liveLoading;
}
/** One ledger change → the API call (a new line; or approve / reject / paid / void). */
export function liveTxSteps(before: Tx | undefined, t: Tx, action: string): [string, string, unknown][] {
  if (!before) return [['POST', 'admin/finance/transactions', { date: t.date, kind: t.kind, amountCents: t.amountCents, fund: t.fund, toFund: t.toFund, center: t.center, category: t.category, party: t.party, method: t.method, ref: t.ref, account: t.account, memo: t.memo, boardDecision: t.boardDecision, relief: t.relief }]];
  const id = encodeURIComponent(t.id);
  if (t.approvals.length > before.approvals.length || (t.status === 'approved' && before.status === 'pending')) return [['POST', `admin/finance/transactions/${id}/approve`, {}]];
  if (t.status !== before.status) {
    if (t.status === 'rejected') return [['POST', `admin/finance/transactions/${id}/reject`, { note: action }]];
    if (t.status === 'paid') return [['POST', `admin/finance/transactions/${id}/paid`, { ref: t.ref, method: t.method }]];
    if (t.status === 'void') return [['POST', `admin/finance/transactions/${id}/void`, { note: action }]];
  }
  return [];
}
async function saveLive(t: Tx, action: string) {
  const before = live?.txs.find((x) => x.id === t.id);
  const steps = liveTxSteps(before, t, action);
  if (!steps.length && before) notice('That change is made by approving, paying or voiding the line.');
  for (const [m, p, b] of steps) { const r = await be(m, p, b); if (!r.ok) { notice(`${action}: ${r.message}`); break; } else if (!before) notice(`${action}.`, 'ok'); }
  await loadLiveLedger(true);
}

const TX = 'isgh-admin-ledger'; const ST = 'isgh-admin-statements';
export const FINANCE_EVENT = 'isgh:finance';
const read = <T,>(k: string, fb: T): T => { try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T) : structuredClone(fb); } catch { return structuredClone(fb); } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } window.dispatchEvent(new Event(FINANCE_EVENT)); };
export const readTxs = (): Tx[] => { if (LIVE) { if (typeof window !== 'undefined' && !live) void loadLiveLedger(); return live?.txs ?? []; } return read<Tx[]>(TX, mockTransactions); };
export const readStatements = (): Statement[] => { if (LIVE) return live?.statements ?? []; return read<Statement[]>(ST, mockStatements); };
/** Saves when valid; returns the problems otherwise. */
export function saveTx(t: Tx, action: string): string[] {
  const r = TxSchema.safeParse(t); if (!r.success) return r.error.issues.map((i) => i.message);
  if (LIVE) { void saveLive(t, action); return []; }   // the server checks again and says why it refuses (a message)
  const list = readTxs(); const i = list.findIndex((x) => x.id === t.id); if (i >= 0) list[i] = t; else list.unshift(t);
  write(TX, list); logAudit({ area: 'finance', action: `${action} – ${t.id}`, detail: `${usd(t.amountCents)} ${t.party}` }); return [];
}
export function saveStatement(s: Statement) {
  if (LIVE) { void be('POST', 'admin/finance/statements', { center: s.center, year: s.year, quarter: s.quarter }).then((r) => { if (!r.ok) notice(`Statement: ${r.message}`); return loadLiveLedger(true); }); return; } write(ST, [...readStatements().filter((x) => !(x.center === s.center && x.year === s.year && x.quarter === s.quarter)), s]); logAudit({ area: 'finance', action: 'Quarterly statement received', detail: `${s.center} Q${s.quarter} ${s.year}` }); }
export const nextTxId = (list: Tx[], year: number) => `TX-${year}-${String(list.filter((t) => t.id.startsWith(`TX-${year}-`)).reduce((a, t) => Math.max(a, Number(t.id.split('-')[2])), 0) + 1).padStart(5, '0')}`;
export function useLedger() {
  const [txs, setTxs] = useState<Tx[]>(() => (LIVE ? [] : structuredClone(mockTransactions)));
  const [statements, setSt] = useState<Statement[]>(() => (LIVE ? [] : structuredClone(mockStatements)));
  useEffect(() => { const load = () => { setTxs(readTxs()); setSt(readStatements()); }; load(); window.addEventListener(FINANCE_EVENT, load); return () => window.removeEventListener(FINANCE_EVENT, load); }, []);
  return { txs, statements };
}
