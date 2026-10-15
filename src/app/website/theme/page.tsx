import type { Metadata } from 'next';
import { ThemePage } from '@/components/views/ThemeViews';

export const metadata: Metadata = { title: 'Theme and branding' };

export default function Page() {
  return <ThemePage />;
}
