/**
 * Admin audit log (A10) – who did what, when. Demo: actions that happen only in this browser (exports, voter-list
 * snapshots, messages sent, acting-as switches) are kept here; publishes come from each document's history and member
 * changes from each member's own log. Live: the BE writes one append-only audit table for all of them.
 */
export type AuditArea = 'members' | 'export' | 'voters' | 'messages' | 'access' | 'content' | 'events' | 'payments' | 'zakat' | 'donations' | 'benefits' | 'officials' | 'minutes' | 'finance' | 'fundraising';
export type AuditEntry = { at: string; by: string; area: AuditArea; action: string; detail: string; target?: string };
const KEY = 'isgh-admin-audit';
export const AUDIT_EVENT = 'isgh:audit';
export const readAudit = (): AuditEntry[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
/** The acting admin's name (set by useAccess once the roles are loaded). */
export const currentAdminName = (): string => (typeof window !== 'undefined' && (window as unknown as { __isghAdminName?: string }).__isghAdminName) || 'Akhter Alam';
const actingName = currentAdminName;
export function logAudit(e: Omit<AuditEntry, 'at' | 'by'> & { by?: string }) {
  try {
    const list = [{ at: new Date().toISOString(), by: e.by ?? actingName(), ...e }, ...readAudit()].slice(0, 2000);
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(AUDIT_EVENT));
  } catch { /* storage full or blocked */ }
}
