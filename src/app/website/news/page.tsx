import type { Metadata } from 'next';
import { NewsView } from '@/components/views/ContentViews';

export const metadata: Metadata = { title: 'News' };

export default function Page() {
  return <NewsView />;
}
