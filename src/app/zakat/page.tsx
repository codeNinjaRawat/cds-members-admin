import type { Metadata } from 'next';
import { ZakatView } from '@/components/views/ZakatView';

export const metadata: Metadata = { title: 'Zakat and Sadaqah' };

export default function Page() {
  return <ZakatView />;
}
