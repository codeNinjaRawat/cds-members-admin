import type { Metadata } from 'next';
import { TeamView } from '@/components/views/TeamViews';

export const metadata: Metadata = { title: 'Working body' };

export default function Page() {
  return <TeamView />;
}
