import type { Metadata } from 'next';
import { QueuesView } from '@/components/views/QueuesView';

export const metadata: Metadata = { title: 'Work queues' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <QueuesView search={typeof sp.tab === 'string' ? `tab=${encodeURIComponent(sp.tab)}` : ''} />;
}
