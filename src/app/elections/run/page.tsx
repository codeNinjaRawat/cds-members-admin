import type { Metadata } from 'next';
import { ElectionsRunView } from '@/components/views/ElectionsRunView';

export const metadata: Metadata = { title: 'Nominations, ballot and results' };

export default function Page() {
  return <ElectionsRunView />;
}
