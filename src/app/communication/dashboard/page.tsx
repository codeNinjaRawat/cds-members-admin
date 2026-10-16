import type { Metadata } from 'next';
import { CommsDashboard } from '@/components/views/ModuleDashboards';

export const metadata: Metadata = { title: 'Communication dashboard' };

export default function Page() {
  return <CommsDashboard />;
}
