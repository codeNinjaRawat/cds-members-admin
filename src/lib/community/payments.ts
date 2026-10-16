/**
 * CONTRACT – payments, invoices and receipts (review step 7; WildApricot: Invoices, Payments, Donations). Pure functions:
 *   checkoutTotal   – dues → discount → optional fee-cover gift, in that order, on the server; $0 means no payment at all
 *   invoiceNumber   – INV-2026-00042 from the prefix in Configuration › Payments; due date for "pay later"
 *   PAYMENT_MOVES   – which status changes are allowed (a bounced check never makes a membership active)
 *   buildReceipt    – lines, totals and the tax-deductible part: dues are not deductible, gifts (incl. fee cover) are
 */
import { applyDiscount, feeCover, type OrgConfig } from './org-config';

export type PayMethod = 'card' | 'ach' | 'check' | 'cash' | 'payLater';
export type CheckoutLine = { kind: 'dues' | 'event' | 'discount' | 'gift'; label: string; cents: number; deductible: boolean };

/** The one place a total is worked out. Order: price → discount code → fee-cover gift (on what is actually paid). */
export function checkoutTotal(cfg: OrgConfig, input: { label: string; kind: 'dues' | 'event'; priceCents: number; planId?: string; method: PayMethod; coverFees?: boolean; code?: string; usedBefore?: boolean; today: string; deductible?: boolean }) {
  const lines: CheckoutLine[] = [{ kind: input.kind, label: input.label, cents: input.priceCents, deductible: !!input.deductible }];
  let amount = input.priceCents; let codeMessage: string | undefined; let codeOk = true;
  if (input.code?.trim()) {
    const d = applyDiscount(cfg, input.code, amount, { kind: input.kind === 'dues' ? 'plan' : 'event', planId: input.planId, usedBefore: input.usedBefore }, input.today);
    codeOk = d.ok; codeMessage = d.message;
    if (d.ok && d.cents < amount) { lines.push({ kind: 'discount', label: d.message, cents: d.cents - amount, deductible: false }); amount = d.cents; }
  }
  const gift = input.coverFees ? feeCover(cfg, amount, input.method) : 0;
  if (gift) lines.push({ kind: 'gift', label: 'Gift to cover processing fees', cents: gift, deductible: true });
  const total = amount + gift;
  return { lines, totalCents: total, codeOk, codeMessage, needsPayment: total > 0, method: total > 0 ? input.method : null };
}

/** INV-2026-00042. The sequence restarts every year; the prefix comes from Configuration › Payments. */
export const invoiceNumber = (prefix: string, year: number, seq: number) => `${prefix.endsWith('-') ? prefix : `${prefix}-`}${year}-${String(seq).padStart(5, '0')}`;
export function dueDate(cfg: OrgConfig, issued: string): string {
  const t = Date.parse(`${issued}T12:00:00Z`) + cfg.payments.payLaterDays * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/* ---------- payment status ---------- */
export type PaymentStatus = 'pending' | 'check_pending' | 'paid' | 'failed' | 'bounced' | 'refunded' | 'partially_refunded' | 'void';
/** Allowed changes. Only "paid" counts for membership; a bounced check or a failed card never does. */
export const PAYMENT_MOVES: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['paid', 'failed', 'void'],
  check_pending: ['paid', 'bounced', 'void'],
  paid: ['refunded', 'partially_refunded'],
  partially_refunded: ['refunded'],
  failed: ['pending', 'paid'],          // retried
  bounced: ['check_pending', 'paid'],   // a new check, or paid another way
  refunded: [], void: [],
};
export const canMove = (from: PaymentStatus, to: PaymentStatus) => PAYMENT_MOVES[from].includes(to);
export const countsAsPaid = (s: PaymentStatus) => s === 'paid' || s === 'partially_refunded';
export const STATUS_TEXT: Record<PaymentStatus, string> = {
  pending: 'Waiting for payment', check_pending: 'Check – waiting to clear', paid: 'Paid', failed: 'Payment failed', bounced: 'Check bounced',
  refunded: 'Refunded', partially_refunded: 'Partly refunded', void: 'Cancelled',
};
/** Refunds never exceed what was paid minus what was already refunded. */
export function refundCheck(paidCents: number, refundedCents: number, askCents: number): { ok: boolean; message?: string } {
  if (askCents <= 0) return { ok: false, message: 'Enter an amount to refund.' };
  if (askCents > paidCents - refundedCents) return { ok: false, message: `You can refund at most $${((paidCents - refundedCents) / 100).toFixed(2)}.` };
  return { ok: true };
}

/* ---------- receipt ---------- */
export type Receipt = { number: string; date: string; payer: string; method: string; lines: CheckoutLine[]; totalCents: number; deductibleCents: number; notes: string[] };
const usd = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
/**
 * A receipt people can keep for taxes: what was paid, which part is a gift (deductible) and which is dues (not deductible),
 * the organization's note, and the IRS statement that no goods or services were given for the gift.
 */
export function buildReceipt(cfg: OrgConfig, org: { name: string; ein?: string }, p: { number: string; date: string; payer: string; method: PayMethod; lines: CheckoutLine[] }): Receipt {
  const totalCents = p.lines.reduce((n, l) => n + l.cents, 0);
  const deductibleCents = p.lines.filter((l) => l.deductible).reduce((n, l) => n + l.cents, 0);
  const notes = [
    cfg.payments.receiptNote,
    deductibleCents > 0 ? `Tax-deductible gift: ${usd(deductibleCents)}. No goods or services were provided in exchange for the gift.` : '',
    totalCents - deductibleCents > 0 && p.lines.some((l) => l.kind === 'dues') ? `Membership dues (${usd(totalCents - deductibleCents)}) are not a tax-deductible gift.` : '',
    org.ein ? `${org.name} · EIN ${org.ein}` : org.name,
  ].filter(Boolean);
  const method = { card: 'Card', ach: 'Bank transfer', check: 'Check', cash: 'Cash', payLater: 'Invoice' }[p.method];
  return { number: p.number, date: p.date, payer: p.payer, method, lines: p.lines, totalCents, deductibleCents, notes };
}
