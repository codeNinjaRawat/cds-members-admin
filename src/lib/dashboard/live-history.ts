'use client';
/**
 * What the dashboards look back on: past events (registered, checked in, money) and the messages that went out
 * (delivered, opened). Live: GET /admin/events?when=past and GET /admin/messages/stats. Demo: sample history.
 */
import { useEffect, useState } from 'react';
import { LIVE, be } from '@/lib/live/live';
import { mockEventHistory, type PastEvent } from '@/lib/community/event-ops';
import type { EventItem } from '@/lib/community/events';

export type Send = { on: string; what: string; kind: string; to: number; delivered: number; opened: number };
const DEMO_SENDS: Send[] = [
  { on: '2026-10-14', what: 'Renewal reminder 1', kind: 'Automatic', to: 1840, delivered: 1812, opened: 1105 },
  { on: '2026-10-12', what: 'Monthly newsletter (October)', kind: 'Sent by staff', to: 4102, delivered: 4066, opened: 1952 },
  { on: '2026-10-12', what: 'Event reminder – Weekend school open house', kind: 'Automatic', to: 96, delivered: 96, opened: 71 },
  { on: '2026-09-28', what: 'Zakat appeal', kind: 'Sent by staff', to: 3980, delivered: 3921, opened: 1490 },
  { on: '2026-09-12', what: 'Monthly newsletter (September)', kind: 'Sent by staff', to: 4060, delivered: 4019, opened: 1888 },
  { on: '2026-08-15', what: 'Annual General Meeting notice', kind: 'Sent by staff', to: 4012, delivered: 3990, opened: 2394 },
  { on: '2026-06-20', what: 'Last call: pay by June 30 to vote', kind: 'Sent by staff', to: 1310, delivered: 1301, opened: 949 },
  { on: '2026-05-01', what: 'Renewal reminder 2', kind: 'Automatic', to: 1652, delivered: 1630, opened: 912 },
];

let pastCache: PastEvent[] | null = null; let sendsCache: Send[] | null = null;
export function usePastEvents(): PastEvent[] {
  const [list, setList] = useState<PastEvent[]>(LIVE ? pastCache ?? [] : mockEventHistory);
  useEffect(() => {
    if (!LIVE || pastCache) return;
    void be<{ events: (EventItem & { attended?: number; revenueCents?: number })[] }>('GET', 'admin/events?when=past').then((r) => {
      if (!r.ok) return;
      pastCache = r.data.events.filter((e) => e.status === 'published').map((e) => ({ id: e.id, title: e.title, category: e.category, center: e.location.center ?? '', date: e.start.slice(0, 10),
        capacity: e.registration.capacity, registered: e.registered, attended: e.attended ?? 0, revenueCents: e.revenueCents ?? 0 }));
      setList(pastCache);
    });
  }, []);
  return list;
}
export function useSends(): Send[] {
  const [list, setList] = useState<Send[]>(LIVE ? sendsCache ?? [] : DEMO_SENDS);
  useEffect(() => {
    if (!LIVE || sendsCache) return;
    void be<{ sends: Send[] }>('GET', 'admin/messages/stats').then((r) => { if (r.ok) { sendsCache = r.data.sends; setList(sendsCache); } });
  }, []);
  return list;
}
