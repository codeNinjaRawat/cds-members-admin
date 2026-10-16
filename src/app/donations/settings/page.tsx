import type { Metadata } from 'next';
import { DonationSettingsView } from '@/components/views/DonationSettingsView';

export const metadata: Metadata = { title: 'Funds and donation rules' };

export default function Page() {
  return <DonationSettingsView />;
}
