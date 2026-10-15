/**
 * Preview protection for the admin (there is no staff sign-in until BE module B1).
 * On any public address the admin asks for a user name and password (HTTP Basic auth):
 *   ISGH_ADMIN_PREVIEW_USER (default "isgh") and ISGH_ADMIN_PREVIEW_PASSWORD – set them on the server, never in git.
 * Open without a password only in development (`npm run dev`) or when ISGH_ADMIN_OPEN=true (set by start-fast.cmd on
 * your own PC). Host headers are NOT trusted for this (a proxy or a visitor can fake them).
 * If no password is set on a server, the admin stays closed.
 */
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production' || process.env.ISGH_ADMIN_OPEN === 'true') return NextResponse.next();
  const pass = process.env.ISGH_ADMIN_PREVIEW_PASSWORD;
  if (!pass) {
    return new NextResponse('ISGH admin preview is closed: set ISGH_ADMIN_PREVIEW_PASSWORD on the server, then restart.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
  }
  const user = process.env.ISGH_ADMIN_PREVIEW_USER || 'isgh';
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    try {
      const [u, ...rest] = atob(auth.slice(6)).split(':');
      if (u === user && rest.join(':') === pass) return NextResponse.next();
    } catch { /* bad header */ }
  }
  return new NextResponse('Sign in to the ISGH admin preview.', { status: 401, headers: { 'www-authenticate': 'Basic realm="ISGH Admin preview", charset="UTF-8"', 'x-robots-tag': 'noindex' } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)'] };
