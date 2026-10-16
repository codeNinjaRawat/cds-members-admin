import type { Metadata } from 'next';
import { ConfigurationView } from '@/components/views/CommunityViews';
export const metadata: Metadata = { title: 'Configuration' };
export default function Page() { return <ConfigurationView />; }
