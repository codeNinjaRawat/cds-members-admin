import type { Metadata } from 'next';
import { TeamMessagesView } from '@/components/views/TeamMessagesView';

export const metadata: Metadata = { title: 'Team messages' };

export default function Page() {
  return <TeamMessagesView />;
}
