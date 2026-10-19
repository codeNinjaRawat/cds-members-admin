import type { Metadata } from 'next';
import { TasksView } from '@/components/views/TasksView';

export const metadata: Metadata = { title: 'Team tasks' };

export default function Page() { return <TasksView />; }
