import type { Metadata } from 'next';
import { ReportsView } from '@/components/views/ReportsView';

export const metadata: Metadata = { title: 'Reports' };

/** A9 Reports + voter list snapshot (module "reports" – the SaaS plan decides if it is on). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const search = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))).toString();
  return <ReportsView search={search} />;
}
