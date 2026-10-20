/** JSON answers from the admin's own API routes, gzip-compressed when the browser accepts it. The member list of a
 *  large organization is over 10 MB as plain JSON and a tenth of that compressed – without this every admin page that
 *  needs members waited several seconds for the download alone. */
import { gzipSync } from 'node:zlib';

const MIN = 2048;   // below this the compression costs more than it saves

export function jsonResponse(req: Request, body: unknown, init: { status?: number; headers?: HeadersInit } = {}): Response {
  const text = JSON.stringify(body ?? {});
  const h = new Headers(init.headers);
  h.set('content-type', 'application/json; charset=utf-8');
  if (!h.has('cache-control')) h.set('cache-control', 'no-store');
  if (text.length >= MIN && /\bgzip\b/i.test(req.headers.get('accept-encoding') ?? '')) {
    h.set('content-encoding', 'gzip'); h.set('vary', 'accept-encoding');
    return new Response(new Uint8Array(gzipSync(text)), { status: init.status ?? 200, headers: h });
  }
  return new Response(text, { status: init.status ?? 200, headers: h });
}
