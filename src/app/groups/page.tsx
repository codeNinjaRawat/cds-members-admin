import type { Metadata } from 'next';
import { GroupsView } from '@/components/views/CommunityViews';
export const metadata: Metadata = { title: 'Groups' };
export default function Page() { return <GroupsView />; }
