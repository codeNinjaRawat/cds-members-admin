'use client';
/**
 * D1 – Dashboards per role. Every card on the Overview and the Members overview has an id here; a role hides the
 * ones its people do not need (Settings › Admins and roles › a role › Dashboard). The Owner and anyone who manages
 * admins always sees everything. From the 10/17 review call: the board wants the headline numbers and members by
 * zone, the membership office wants its queue and not the money, nobody wants "50,000 questions" from extra tiles.
 */
import { useAccess } from '@/lib/access/use-access';

export type WidgetDef = { id: string; page: 'overview' | 'members'; label: string; help: string };
export const WIDGETS: WidgetDef[] = [
  // the home page (command layout – what the client reviewed)
  { id: 'cc.ribbon', page: 'overview', label: 'Year at a glance', help: 'Days to renewals, Election Day, oath of office, the record date.' },
  { id: 'cc.kpi.members', page: 'overview', label: 'Active members', help: 'Headline number with its trend.' },
  { id: 'cc.kpi.apps', page: 'overview', label: 'Waiting for the Board', help: 'Applications waiting for approval.' },
  { id: 'cc.kpi.renew', page: 'overview', label: 'Renewals this month', help: 'Renewals and when the season opens.' },
  { id: 'cc.kpi.fees', page: 'overview', label: 'Membership fees this month', help: 'Dues only – the membership department’s number.' },
  { id: 'cc.kpi.giving', page: 'overview', label: 'Giving this month', help: 'All gifts – the finance number.' },
  { id: 'cc.trend', page: 'overview', label: 'Renewals and new members', help: 'Twelve-month trend.' },
  { id: 'cc.zones', page: 'overview', label: 'Members by zone', help: 'Active members in each zone.' },
  { id: 'cc.pipeline', page: 'overview', label: 'Application pipeline', help: 'Applied → verified → ID checked → Board → active. Membership office only.' },
  { id: 'cc.money', page: 'overview', label: 'Dues and gifts by month', help: 'Twelve months of money in.' },
  { id: 'cc.newest', page: 'overview', label: 'Newest members', help: 'The latest sign-ups.' },
  { id: 'cc.mywork', page: 'overview', label: 'My work', help: 'Cases, tasks and tickets on this person’s desk.' },
  { id: 'cc.activity', page: 'overview', label: 'Recent activity', help: 'What just happened across the organization.' },
  { id: 'cc.suggest', page: 'overview', label: 'Suggestions', help: 'What the system thinks is worth doing next.' },
  // the home page (focus layout)
  { id: 'ov.queue', page: 'overview', label: 'Applications waiting', help: 'The newest applications and their state – the membership office’s view.' },
  { id: 'ov.mywork', page: 'overview', label: 'My work', help: 'Cases, tasks and tickets on this person’s desk.' },
  { id: 'ov.curve', page: 'overview', label: 'Renewal curve', help: 'Dues paid per month over the year.' },
  { id: 'ov.zones', page: 'overview', label: 'Members by zone', help: 'Active members in each zone, busiest center, border requests.' },
  { id: 'ov.kpis', page: 'overview', label: 'Headline numbers', help: 'Approval time, renewals this week, share eligible to vote.' },
  { id: 'ov.funds', page: 'overview', label: 'Giving by fund', help: 'Zakat, Sadaqah, dues and other funds this year.' },
  { id: 'ov.gmonth', page: 'overview', label: 'Giving by month', help: 'Gifts received per month.' },
  { id: 'ov.dates', page: 'overview', label: 'Key dates', help: 'Days to the record date, renewal season, year end.' },
  { id: 'ov.site', page: 'overview', label: 'Website content', help: 'Which parts of the website are published from the admin.' },
  { id: 'mo.kpis', page: 'members', label: 'Membership numbers', help: 'Members, voters, renewed, membership fee collected.' },
  { id: 'mo.status', page: 'members', label: 'Where members stand', help: 'Active, pending, lapsed… and who has not renewed.' },
  { id: 'mo.payments', page: 'members', label: 'Dues payments each month', help: 'This year against last year.' },
  { id: 'mo.plans', page: 'members', label: 'Membership plans', help: 'Members by plan.' },
  { id: 'mo.zones', page: 'members', label: 'Members and voters by zone', help: 'Can vote / cannot vote yet, per zone.' },
  { id: 'mo.ages', page: 'members', label: 'Age groups', help: 'Members by age band.' },
  { id: 'mo.joins', page: 'members', label: 'New members by year joined', help: 'Growth over the years.' },
  { id: 'mo.methods', page: 'members', label: 'How dues were paid', help: 'Card, bank, check, cash.' },
];
export const PAGE_LABEL = { overview: 'Overview (home page)', members: 'Members › Overview' } as const;
export const WIDGET_SECTION = (id: string) => (id.startsWith('cc.') ? 'Command layout' : id.startsWith('ov.') ? 'Focus layout' : '');

/** show(id) for the role the person is working in. */
export function useWidgets(prefix: 'cc' | 'ov' | 'mo' = 'cc') {
  const access = useAccess();
  const all = !access.ready || !access.role || access.role.id === 'owner' || access.role.permissions.includes('admins.manage');
  const hidden = new Set(all ? [] : (access.role?.dashboard?.hide ?? []));
  const here = WIDGETS.filter((w) => w.id.startsWith(`${prefix}.`) && hidden.has(w.id)).length;
  return { show: (id: string) => !hidden.has(id), hiddenCount: here, roleName: access.role?.name ?? '' };
}
