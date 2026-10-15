import type { Metadata } from 'next';
import { MembershipView } from '@/components/views/ContentViews';

export const metadata: Metadata = { title: 'Plans and rules' };

export default function Page() {
  return <MembershipView />;
}
