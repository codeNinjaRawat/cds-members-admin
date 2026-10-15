import type { Metadata } from 'next';
import { AnnouncementView } from '@/components/views/ContentViews';

export const metadata: Metadata = { title: 'Announcement bar' };

export default function Page() {
  return <AnnouncementView />;
}
