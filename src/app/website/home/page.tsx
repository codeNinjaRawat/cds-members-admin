import type { Metadata } from 'next';
import { HomeView } from '@/components/views/HomeView';

export const metadata: Metadata = { title: 'Home page' };

export default function Page() {
  return <HomeView />;
}
