import type { Metadata } from 'next';
import { BenefitsView } from '@/components/views/BenefitsView';

export const metadata: Metadata = { title: 'Member benefits' };

export default function Page() {
  return <BenefitsView />;
}
