import type { Metadata } from 'next';
import { FamiliesView } from '@/components/views/FamilyView';

export const metadata: Metadata = { title: 'Family trees' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <FamiliesView search={typeof sp.member === 'string' ? `member=${encodeURIComponent(sp.member)}` : ''} />;
}
