import type { Metadata } from 'next';
import { OrganizationView } from '@/components/views/ContentViews';

export const metadata: Metadata = { title: 'Organization' };

export default function Page() {
  return <OrganizationView />;
}
