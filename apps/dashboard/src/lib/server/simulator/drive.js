export class SimulatorError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const ID = /^[A-Za-z0-9_-]{10,200}$/;
const RESOURCE_KEY = /^[A-Za-z0-9_-]{1,200}$/;
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_DATA_BYTES = 2 * 1024 * 1024;

export function parseDriveLink(input) {
  let url;
  try { url = new URL(input); } catch { throw new SimulatorError('invalid_link'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || input.length > 2048) {
    throw new SimulatorError('invalid_link');
  }
  const sheet = url.hostname === 'docs.google.com' && url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  const file = url.hostname === 'drive.google.com' && url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  const queryId = url.hostname === 'drive.google.com' && ['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : '';
  const id = sheet?.[1] || file?.[1] || queryId;
  if (!id || !ID.test(id)) throw new SimulatorError('invalid_link');
  const key = url.searchParams.get('resourcekey');
  if (key && !RESOURCE_KEY.test(key)) throw new SimulatorError('invalid_link');
  const gid = url.searchParams.get('gid') || new URLSearchParams(url.hash.slice(1)).get('gid') || '0';
  if (sheet && !/^\d{1,20}$/.test(gid)) throw new SimulatorError('invalid_link');
  const download = sheet
    ? new URL(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`)
    : new URL(`https://drive.google.com/uc?export=download&id=${id}`);
  const canonical = new URL(sheet ? `https://docs.google.com/spreadsheets/d/${id}/edit?gid=${gid}` : `https://drive.google.com/file/d/${id}/view`);
  if (key) { download.searchParams.set('resourcekey', key); canonical.searchParams.set('resourcekey', key); }
  return { id, sheet: Boolean(sheet), download: download.href, sourceUrl: canonical.href };
}

function allowedDownload(url) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && (
    ['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com'].includes(url.hostname) ||
    /^[a-z0-9-]+-docs\.googleusercontent\.com$/.test(url.hostname)
  );
}

// Redirects are checked before following them; no cookies or user authorization are forwarded.
export async function downloadDrive(link, fetcher = fetch) {
  let url = new URL(link.download);
  const signal = AbortSignal.timeout(90_000);
  try {
    for (let redirects = 0; redirects <= 4; redirects++) {
      if (!allowedDownload(url)) throw new SimulatorError('share_unavailable', 422);
      const response = await fetcher(url.href, { redirect: 'manual', signal, credentials: 'omit' });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location) throw new SimulatorError('share_unavailable', 422);
        url = new URL(location, url);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new SimulatorError('share_unavailable', 422);
      }
      const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      if (mime === 'text/html') {
        await response.body?.cancel();
        throw new SimulatorError('share_unavailable', 422);
      }
      const disposition = response.headers.get('content-disposition') || '';
      const kind = link.sheet ? 'data' :
        ['video/mp4', 'video/webm'].includes(mime) ? 'video' :
        ['image/png', 'image/jpeg', 'image/webp'].includes(mime) ? 'image' :
        /(?:text\/(?:csv|plain|tab-separated-values)|application\/(?:json|csv))/.test(mime) || /\.(csv|json|tsv)(?:["';]|$)/i.test(disposition) ? 'data' : '';
      if (!kind) { await response.body?.cancel(); throw new SimulatorError('unsupported_file', 422); }
      const limit = kind === 'video' ? MAX_MEDIA_BYTES : kind === 'image' ? 5 * 1024 * 1024 : MAX_DATA_BYTES;
      if (Number(response.headers.get('content-length')) > limit) {
        await response.body?.cancel();
        throw new SimulatorError('file_too_large', 413);
      }
      return { response, kind, mime, limit };
    }
    throw new SimulatorError('share_unavailable', 422);
  } catch (error) {
    if (error instanceof SimulatorError) throw error;
    throw new SimulatorError('download_failed', 504);
  }
}

export async function readLimited(stream, limit) {
  if (!stream) throw new SimulatorError('empty_file', 422);
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new SimulatorError('file_too_large', 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!size) throw new SimulatorError('empty_file', 422);
  return Buffer.concat(chunks);
}
