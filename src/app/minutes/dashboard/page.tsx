import type { Metadata } from 'next';
import { MeetingsDashboard } from '@/components/views/ModuleDashboards';

export const metadata: Metadata = { title: 'Meetings dashboard' };

export default function Page() {
  return <MeetingsDashboard />;
}
