import type { Metadata } from 'next';
import { HelpDeskView } from '@/components/views/HelpDeskView';

export const metadata: Metadata = { title: 'Help desk' };

export default function Page() { return <HelpDeskView />; }
