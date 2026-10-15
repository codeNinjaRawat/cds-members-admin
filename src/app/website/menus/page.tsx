import type { Metadata } from 'next';
import { MenusView } from '@/components/views/ContentViews';

export const metadata: Metadata = { title: 'Menus and footer' };

export default function Page() {
  return <MenusView />;
}
