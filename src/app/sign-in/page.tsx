import type { Metadata } from 'next';
import { AdminSignIn } from './AdminSignIn';

export const metadata: Metadata = { title: 'Sign in' };
export default function Page() { return <AdminSignIn />; }
