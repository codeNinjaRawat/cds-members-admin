import type { Metadata } from 'next';
import { ContactsView } from '@/components/views/ContactsView';

export const metadata: Metadata = { title: 'Contacts – visitors' };

export default function Page() {
  return <ContactsView />;
}
