import type { Metadata } from 'next';
import { PrayerTimesView } from '@/components/views/PrayerTimesView';

export const metadata: Metadata = { title: 'Prayer times' };

export default function Page() {
  return <PrayerTimesView />;
}
