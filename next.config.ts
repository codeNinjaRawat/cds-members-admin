import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // development on this PC: the organization is picked by the address (isgh.localhost, isgh-admin.localhost)
  allowedDevOrigins: ['*.localhost'],
  // live mode for the browser code: the same switch as the server (ISGH_USE_MOCK_API=false → sign-in and data through /api/be/*)
  env: { NEXT_PUBLIC_LIVE_API: process.env.ISGH_USE_MOCK_API === 'false' ? '1' : '' },
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.pexels.com', pathname: '/photos/**' }] },
  async headers() {
    const site = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'http://localhost:3000';
    // SaaS: each organization's admin previews its own website (name.<base domain>; on a PC name.localhost:3000)
    const base = process.env.PLATFORM_BASE_DOMAIN ?? 'nextgrow.pro';
    const frames = [site, `https://*.${base}`, process.env.NODE_ENV === 'production' ? '' : 'http://*.localhost:3000'].filter(Boolean).join(' ');
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'same-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },              // the admin itself is never framed
        { key: 'Content-Security-Policy', value: `frame-src 'self' ${frames}; frame-ancestors 'none'` },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    }];
  },
};

export default nextConfig;
