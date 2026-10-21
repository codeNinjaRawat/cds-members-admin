import type { Metadata } from 'next';
import { RedirectsView } from '@/components/views/RedirectsView';

export const metadata: Metadata = { title: 'Redirects and short links' };

export default function Page() {
  return <RedirectsView />;
}
