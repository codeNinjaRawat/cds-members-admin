'use client';
/** F6 meetings and minutes. Demo: this browser only. Live: GET /admin/meetings, PUT /admin/meetings/:id. */
import { useEffect, useState } from 'react';
import { MeetingSchema, mockMeetings, meetingTitle, type Meeting } from '@/lib/community/minutes';
import { logAudit } from '@/lib/access/audit';
import { LIVE, be } from '@/lib/live/live';
import { notice } from '@/lib/members/members';

/* ---------- live mode: meetings on the server (it numbers new ones and checks the same rules) ---------- */
let live: Meeting[] | null = null; let liveLoading: Promise<void> | null = null;
export function loadLiveMeetings(force = false): Promise<void> {
  if (!force && live) return Promise.resolve();
  if (!force && liveLoading) return liveLoading;
  liveLoading = be<{ meetings: Meeting[] }>('GET', 'admin/meetings').then((r) => {
    liveLoading = null; if (r.ok) live = r.data.meetings; else if (r.status !== 401) notice(`Meetings could not be loaded: ${r.message}`);
    window.dispatchEvent(new Event(MEETINGS_EVENT));
  });
  return liveLoading;
}

const KEY = 'isgh-admin-meetings';
export const MEETINGS_EVENT = 'isgh:meetings';
export function readMeetings(): Meeting[] {
  if (LIVE) { if (typeof window !== 'undefined' && !live) void loadLiveMeetings(); return live ?? []; }
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Meeting[]) : structuredClone(mockMeetings); } catch { return structuredClone(mockMeetings); }
}
/** Saves when valid; returns the problems otherwise. */
export function saveMeeting(m: Meeting, action: string): string[] {
  const r = MeetingSchema.safeParse(m);
  if (!r.success) return r.error.issues.map((i) => i.message);
  if (LIVE) { void be('PUT', `admin/meetings/${encodeURIComponent(m.id)}`, { meeting: m }).then((r) => { if (!r.ok) notice(`${action}: ${r.message}`); return loadLiveMeetings(true); }); return []; }
  const list = readMeetings(); const i = list.findIndex((x) => x.id === m.id);
  if (i >= 0) list[i] = m; else list.unshift(m);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ }
  logAudit({ area: 'minutes', action: `${action} – ${m.id}`, detail: `${meetingTitle(m)} ${m.date}` });
  window.dispatchEvent(new Event(MEETINGS_EVENT));
  return [];
}
export function useMeetings() {
  const [list, setList] = useState<Meeting[]>(() => (LIVE ? [] : structuredClone(mockMeetings)));
  useEffect(() => { const load = () => setList(readMeetings()); load(); window.addEventListener(MEETINGS_EVENT, load); return () => window.removeEventListener(MEETINGS_EVENT, load); }, []);
  return list;
}
