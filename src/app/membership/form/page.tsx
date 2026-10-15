import type { Metadata } from 'next';
import { JoinFormBuilderView } from '@/components/views/JoinFormBuilder';

export const metadata: Metadata = { title: 'Join form builder' };

export default function Page() {
  return <JoinFormBuilderView />;
}
