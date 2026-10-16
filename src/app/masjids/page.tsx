import type { Metadata } from 'next';
import { MasjidsView } from '@/components/views/AccessViews';

export const metadata: Metadata = { title: 'Masjid working bodies' };

export default function Page() {
  return <MasjidsView />;
}
