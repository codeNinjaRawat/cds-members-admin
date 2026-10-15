import type { Metadata } from 'next';
import { AppearanceView } from '@/components/views/AppearanceView';

export const metadata: Metadata = { title: 'My appearance' };

export default function Page() {
  return <AppearanceView />;
}
