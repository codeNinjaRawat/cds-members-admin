import type { Metadata } from 'next';
import { DonationsView } from '@/components/views/DonationsView';

export const metadata: Metadata = { title: 'Donations' };

export default function Page() {
  return <DonationsView />;
}
