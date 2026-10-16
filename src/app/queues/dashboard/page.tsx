import type { Metadata } from 'next';
import { QueuesDashboard } from '@/components/views/ModuleDashboards';

export const metadata: Metadata = { title: 'Work queues dashboard' };

export default function Page() {
  return <QueuesDashboard />;
}
