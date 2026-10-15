import type { Metadata } from 'next';
import { FlagsView } from '@/components/views/ContentViews';

export const metadata: Metadata = { title: 'Feature switches' };

export default function Page() {
  return <FlagsView />;
}
