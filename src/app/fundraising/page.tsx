import type { Metadata } from 'next';
import { FundraisingView } from '@/components/views/FundraisingView';

export const metadata: Metadata = { title: 'Fundraising' };

export default function Page() {
  return <FundraisingView />;
}
