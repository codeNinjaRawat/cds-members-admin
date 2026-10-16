import type { Metadata } from 'next';
import { FinanceView } from '@/components/views/FinanceView';

export const metadata: Metadata = { title: 'Finance' };

export default function Page() {
  return <FinanceView />;
}
