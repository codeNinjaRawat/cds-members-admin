import type { Metadata } from 'next';
import { MasjidsDashboard } from '@/components/views/ModuleDashboards';

export const metadata: Metadata = { title: 'Masjids dashboard' };

export default function Page() {
  return <MasjidsDashboard />;
}
