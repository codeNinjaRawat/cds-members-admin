/**
 * ISGH Admin root layout – "working on glass" (A0/A1). Fonts match the website; the admin's own appearance
 * is applied before first paint (no flash). Robots are blocked (also by header).
 */
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Fraunces, Public_Sans } from 'next/font/google';
import './globals.css';
import { NO_FLASH_SCRIPT } from '@/lib/appearance/presets';
import { AdminShell } from '@/components/shell/AdminShell';
import { NavProgress } from '@/components/ui/NavProgress';

const display = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz', 'wdth'], variable: '--font-bricolage', display: 'swap' });
const body = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', display: 'swap' });
/** Luxe theme display face (headings and big numbers only) */
const luxe = Fraunces({ subsets: ['latin'], axes: ['opsz', 'SOFT'], variable: '--font-luxe', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ISGH Admin', template: '%s – ISGH Admin' },
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: '/brand/favicon.ico', sizes: '48x48' }, { url: '/brand/favicon.svg', type: 'image/svg+xml' }, { url: '/brand/favicon-32x32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: { images: ['/brand/og-default.png'] },
};
export const viewport: Viewport = { themeColor: '#0B0B0E' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US" className={`${display.variable} ${body.variable} ${luxe.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} /></head>
      <body><NavProgress /><AdminShell>{children}</AdminShell></body>
    </html>
  );
}
