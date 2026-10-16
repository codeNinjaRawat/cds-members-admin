import type { Metadata } from 'next';
import { EventsDashboard } from '@/components/views/ModuleDashboards';

export const metadata: Metadata = { title: 'Events dashboard' };

export default function Page() {
  return <EventsDashboard />;
}
