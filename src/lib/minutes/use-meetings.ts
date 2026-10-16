'use client';
/** F6 demo store for meetings and minutes (this browser only). Live: GET/POST/PATCH /admin/meetings. */
import { useEffect, useState } from 'react';
import { MeetingSchema, mockMeetings, meetingTitle, type Meeting } from '@/lib/community/minutes';
import { logAudit } from '@/lib/access/audit';

const KEY = 'isgh-admin-meetings';
export const MEETINGS_EVENT = 'isgh:meetings';
export function readMeetings(): Meeting[] {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Meeting[]) : structuredClone(mockMeetings); } catch { return structuredClone(mockMeetings); }
}
/** Saves when valid; returns the problems otherwise. */
export function saveMeeting(m: Meeting, action: string): string[] {
  const r = MeetingSchema.safeParse(m);
  if (!r.success) return r.error.issues.map((i) => i.message);
  const list = readMeetings(); const i = list.findIndex((x) => x.id === m.id);
  if (i >= 0) list[i] = m; else list.unshift(m);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full */ }
  logAudit({ area: 'minutes', action: `${action} – ${m.id}`, detail: `${meetingTitle(m)} ${m.date}` });
  window.dispatchEvent(new Event(MEETINGS_EVENT));
  return [];
}
export function useMeetings() {
  const [list, setList] = useState<Meeting[]>(() => structuredClone(mockMeetings));
  useEffect(() => { const load = () => setList(readMeetings()); load(); window.addEventListener(MEETINGS_EVENT, load); return () => window.removeEventListener(MEETINGS_EVENT, load); }, []);
  return list;
}
