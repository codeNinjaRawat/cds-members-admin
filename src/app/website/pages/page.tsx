import type { Metadata } from 'next';
import { PagesView } from '@/components/views/ContentViews';

export const metadata: Metadata = { title: 'Pages' };

export default function Page() {
  return <PagesView />;
}
