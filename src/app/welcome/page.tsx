import type { Metadata } from 'next';
import { WelcomeView } from '@/components/views/WelcomeView';
export const metadata: Metadata = { title: 'Welcome' };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; return <WelcomeView token={typeof sp.token === 'string' ? sp.token : ''} />;
}
