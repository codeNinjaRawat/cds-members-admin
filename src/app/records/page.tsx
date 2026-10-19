import type { Metadata } from 'next';
import { RecordsView } from '@/components/views/RecordsView';

export const metadata: Metadata = { title: 'Records library' };

export default function Page() {
  return <RecordsView />;
}
