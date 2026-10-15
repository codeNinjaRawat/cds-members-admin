import type { Metadata } from 'next';
import { GivingView } from '@/components/views/ContentViews';

export const metadata: Metadata = { title: 'Giving' };

export default function Page() {
  return <GivingView />;
}
