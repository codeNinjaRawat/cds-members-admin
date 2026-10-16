import type { Metadata } from 'next';
import { OfficialsView } from '@/components/views/OfficialsView';

export const metadata: Metadata = { title: 'Elected officials' };

export default function Page() {
  return <OfficialsView />;
}
