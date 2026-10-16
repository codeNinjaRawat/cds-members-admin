import type { Metadata } from 'next';
import { ZonesView } from '@/components/views/ZonesView';

export const metadata: Metadata = { title: 'Zones and Islamic Centers' };

export default function Page() {
  return <ZonesView />;
}
