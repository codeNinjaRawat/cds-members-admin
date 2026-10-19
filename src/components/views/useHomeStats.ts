'use client';
import { useMemo } from 'react';
import { homeStats, type HomeStats } from '@/lib/dashboard/home-stats';
import { centerOf, demoMembers, orgToday, YEAR } from '@/lib/members/members';
import { useDonations, useDonationContext } from '@/lib/donations/use-donations';
import { useMembershipSettings } from '@/lib/members/use-settings';
import { useMasjidFilter } from '@/lib/access/masjid-filter';
import { LIVE } from '@/lib/live/live';
import { useMembers } from './MembersView';
import { allCases, useQueueState } from './QueuesView';

/** The home dashboards' numbers for the signed-in admin's scope (zones / masjids they may see). */
export function useHomeStats(): HomeStats {
  const members = useMembers();
  const qs = useQueueState();
  const gifts = useDonations();
  const { settings: giving } = useDonationContext();
  const settings = useMembershipSettings();
  const mf = useMasjidFilter();
  const today = orgToday();
  return useMemo(() => {
    const mine = (members ?? (LIVE ? [] : demoMembers())).filter((m) => mf.keep(m.zone, centerOf(m), m.zip));
    const ids = new Set(mine.map((m) => m.id));
    return homeStats({ members: mine, cases: allCases().filter((c) => ids.has(c.memberId)), queue: qs, gifts: gifts.filter((g) => !mf.masjid || g.center === mf.masjid), giving, settings, today, year: YEAR });
  }, [members, qs, gifts, giving, settings, today, mf.zone, mf.masjid, mf.access.ready, mf.access.me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
