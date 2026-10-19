import type { Metadata } from 'next';
import { WorkSettingsView } from '@/components/views/WorkSettingsView';

export const metadata: Metadata = { title: 'Help desk and tasks' };

export default function Page() { return <WorkSettingsView />; }
