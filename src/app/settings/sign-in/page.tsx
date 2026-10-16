import type { Metadata } from 'next';
import { SignInSettingsView } from '@/components/views/SignInSettingsView';

export const metadata: Metadata = { title: 'Sign-in and dashboards' };

export default function Page() {
  return <SignInSettingsView />;
}
