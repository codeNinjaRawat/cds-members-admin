import type { Metadata } from 'next';
import { ElectionsDashboard } from '@/components/views/ModuleDashboards';

export const metadata: Metadata = { title: 'Elections dashboard' };

export default function Page() {
  return <ElectionsDashboard />;
}
