import type { Metadata } from 'next';
import { EventsView } from '@/components/views/CommunityViews';
export const metadata: Metadata = { title: 'Events' };
export default function Page() { return <EventsView />; }
