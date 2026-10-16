import type { Metadata } from 'next';
import { MembersOverview } from '@/components/views/MembersOverview';

export const metadata: Metadata = { title: 'Members dashboard' };

export default function Page() {
  return <MembersOverview />;
}
