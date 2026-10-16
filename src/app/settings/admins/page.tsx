import type { Metadata } from 'next';
import { AdminsView } from '@/components/views/AccessViews';
export const metadata: Metadata = { title: 'Admins and roles' };
export default function Page() { return <AdminsView />; }
