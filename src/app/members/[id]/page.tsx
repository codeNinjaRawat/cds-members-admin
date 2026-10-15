import type { Metadata } from 'next';
import { MemberProfile } from '@/components/views/MemberProfile';

export const metadata: Metadata = { title: 'Member' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberProfile id={decodeURIComponent(id)} />;
}
