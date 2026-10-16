import type { Metadata } from 'next';
import { MinutesView } from '@/components/views/MinutesView';

export const metadata: Metadata = { title: 'Meetings and minutes' };

export default function Page() {
  return <MinutesView />;
}
