import type { Metadata } from 'next';
import { MembersView } from '@/components/views/MembersView';

export const metadata: Metadata = { title: 'Members' };

/** The view and filters in the address are read on the server too, so the right rows show on first paint. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const search = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))).toString();
  return <MembersView search={search} />;
}
