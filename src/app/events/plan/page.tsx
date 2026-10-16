import type { Metadata } from 'next';
import { EventsPlanView } from '@/components/views/EventsPlanView';

export const metadata: Metadata = { title: 'Event planning' };

export default function Page() {
  return <EventsPlanView />;
}
