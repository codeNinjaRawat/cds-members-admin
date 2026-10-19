import type { Metadata } from 'next';
import { CheckomaticMembersView } from '@/components/views/CheckomaticMembersView';

export const metadata: Metadata = { title: 'Check-o-matic – members' };

export default function Page() {
  return <CheckomaticMembersView />;
}
