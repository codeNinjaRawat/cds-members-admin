import type { Metadata } from 'next';
import { CommunicationView } from '@/components/views/CommunityViews';
export const metadata: Metadata = { title: 'Communication' };
export default function Page() { return <CommunicationView />; }
