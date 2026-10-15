import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
