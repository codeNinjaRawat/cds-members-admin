/**
 * POST /api/upload?area=comms&name=flyer.png – the admin uploads a file for the API's file store without talking to the
 * storage address itself (no cross-site upload): ask the API for an upload address, put the bytes there from this server,
 * tell the API it is done. Answer: {id, name, mime, bytes}. Pictures only (10 MB), signed-in admins with the area's permission.
 */
import { apiCall, apiConfig } from '@/lib/api/client';
import { jsonResponse } from '@/lib/api/json-response';

const MAX = 10 * 1024 * 1024;
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export async function POST(req: Request) {
  if (apiConfig.useMock) return jsonResponse(req, { error: 'Demo mode – uploads need the API.' }, { status: 404 });
  const u = new URL(req.url); const area = u.searchParams.get('area') ?? ''; const name = (u.searchParams.get('name') ?? '').replace(/[\\/]+/g, ' ').trim().slice(0, 160);
  const ext = (name.split('.').pop() ?? '').toLowerCase(); const mime = MIME[ext];
  if (!/^[a-z-]{2,20}$/.test(area) || !name) return jsonResponse(req, { error: 'Which file?' }, { status: 400 });
  if (!mime) return jsonResponse(req, { error: 'Pictures only – PNG, JPG, WebP or GIF.' }, { status: 415 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX) return jsonResponse(req, { error: 'The picture must be between 1 byte and 10 MB.' }, { status: 413 });
  try {
    const ask = await apiCall('POST', '/admin/files', { area, name, mime, bytes: bytes.length, visibility: 'private' });
    if (ask.status !== 201) return jsonResponse(req, ask.body ?? { error: 'The server refused the upload.' }, { status: ask.status });
    const { id, upload } = ask.body as { id: string; upload: { url: string; method: string; headers: Record<string, string> } };
    const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: bytes, signal: AbortSignal.timeout(60_000) });
    if (!put.ok) return jsonResponse(req, { error: 'The file store did not take the picture. Try again.' }, { status: 502 });
    const done = await apiCall('POST', `/admin/files/${id}/complete`, {});
    if (done.status !== 200) return jsonResponse(req, done.body ?? { error: 'Upload not confirmed.' }, { status: done.status });
    return jsonResponse(req, { id, name, mime, bytes: bytes.length }, { status: 201 });
  } catch { return jsonResponse(req, { error: 'We could not reach the server. Please try again in a minute.' }, { status: 503 }); }
}
