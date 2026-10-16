import type { Metadata } from 'next';
import { AuditView } from '@/components/views/AccessViews';
export const metadata: Metadata = { title: 'Audit log' };
export default function Page() { return <AuditView />; }
