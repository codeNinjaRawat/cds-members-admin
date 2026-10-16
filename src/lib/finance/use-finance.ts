'use client';
/** F7 demo store for ledger records (this browser only). Live: GET/POST/PATCH /admin/finance/transactions, /statements. */
import { useEffect, useState } from 'react';
import { TxSchema, mockStatements, mockTransactions, usd, type Statement, type Tx } from '@/lib/community/finance';
import { logAudit } from '@/lib/access/audit';

const TX = 'isgh-admin-ledger'; const ST = 'isgh-admin-statements';
export const FINANCE_EVENT = 'isgh:finance';
const read = <T,>(k: string, fb: T): T => { try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T) : structuredClone(fb); } catch { return structuredClone(fb); } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } window.dispatchEvent(new Event(FINANCE_EVENT)); };
export const readTxs = () => read<Tx[]>(TX, mockTransactions);
export const readStatements = () => read<Statement[]>(ST, mockStatements);
/** Saves when valid; returns the problems otherwise. */
export function saveTx(t: Tx, action: string): string[] {
  const r = TxSchema.safeParse(t); if (!r.success) return r.error.issues.map((i) => i.message);
  const list = readTxs(); const i = list.findIndex((x) => x.id === t.id); if (i >= 0) list[i] = t; else list.unshift(t);
  write(TX, list); logAudit({ area: 'finance', action: `${action} – ${t.id}`, detail: `${usd(t.amountCents)} ${t.party}` }); return [];
}
export function saveStatement(s: Statement) { write(ST, [...readStatements().filter((x) => !(x.center === s.center && x.year === s.year && x.quarter === s.quarter)), s]); logAudit({ area: 'finance', action: 'Quarterly statement received', detail: `${s.center} Q${s.quarter} ${s.year}` }); }
export const nextTxId = (list: Tx[], year: number) => `TX-${year}-${String(list.filter((t) => t.id.startsWith(`TX-${year}-`)).reduce((a, t) => Math.max(a, Number(t.id.split('-')[2])), 0) + 1).padStart(5, '0')}`;
export function useLedger() {
  const [txs, setTxs] = useState<Tx[]>(() => structuredClone(mockTransactions));
  const [statements, setSt] = useState<Statement[]>(() => structuredClone(mockStatements));
  useEffect(() => { const load = () => { setTxs(readTxs()); setSt(readStatements()); }; load(); window.addEventListener(FINANCE_EVENT, load); return () => window.removeEventListener(FINANCE_EVENT, load); }, []);
  return { txs, statements };
}
