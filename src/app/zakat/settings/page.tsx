import type { Metadata } from 'next';
import { ZakatSettingsView } from '@/components/views/ZakatSettingsView';

export const metadata: Metadata = { title: 'Zakat and Sadaqah settings' };

export default function Page() {
  return <ZakatSettingsView />;
}
