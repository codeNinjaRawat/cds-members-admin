import type { Metadata } from 'next';
import { WebsiteDashboard } from '@/components/views/ModuleDashboards';

export const metadata: Metadata = { title: 'Website dashboard' };

export default function Page() {
  return <WebsiteDashboard />;
}
