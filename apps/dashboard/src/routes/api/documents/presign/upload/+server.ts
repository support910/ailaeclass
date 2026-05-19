import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_UPLOAD_BUCKET,
  MAX_DOCUMENT_SIZE
} from '$lib/utils/constants/documentUpload';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function sanitizeFileName(fileName: string) {
  // Supabase Storage keys must be ASCII-only; preserve only alphanumerics, _, ., -
  const ext = fileName.split('.').pop() || '';
  const base = fileName
    .replace(/\.[^/.]+$/, '')
    .trim()
    .normalize('NFC')
    .replace(/[^a-zA-Z0-9_.-]/gu, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
  return ext ? `${base}.${ext}` : base;
}

async function ensureDocumentsBucket(supabase: ReturnType<typeof getServerSupabase>) {
  const bucketOptions = {
    public: false,
    fileSizeLimit: MAX_DOCUMENT_SIZE,
    allowedMimeTypes: [...ALLOWED_DOCUMENT_TYPES]
  };

  const { data: bucket } = await supabase.storage.getBucket(DOCUMENT_UPLOAD_BUCKET);

  if (bucket) {
    const { error } = await supabase.storage.updateBucket(DOCUMENT_UPLOAD_BUCKET, bucketOptions);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.storage.createBucket(DOCUMENT_UPLOAD_BUCKET, bucketOptions);
  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw error;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const supabase = getServerSupabase();
  const token = getBearerToken(request);

  if (!token) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { fileName, fileType, fileSize } = await request.json();

  if (!fileName || !fileType || typeof fileSize !== 'number') {
    return json({ success: false, message: 'Missing file metadata' }, { status: 400 });
  }

  if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(fileType)) {
    return json({ success: false, message: 'Unsupported document type' }, { status: 400 });
  }

  if (fileSize > MAX_DOCUMENT_SIZE) {
    return json({ success: false, message: 'Document exceeds 50MB limit' }, { status: 400 });
  }

  try {
    await ensureDocumentsBucket(supabase);

    const safeFileName = sanitizeFileName(fileName);
    const fileKey = `${user.id}/${randomUUID()}-${safeFileName}`;
    const { data, error } = await supabase.storage
      .from(DOCUMENT_UPLOAD_BUCKET)
      .createSignedUploadUrl(fileKey);

    if (error || !data) {
      throw error || new Error('Unable to create signed upload URL');
    }

    return json({
      success: true,
      url: data.signedUrl,
      token: data.token,
      path: data.path,
      fileKey,
      message: 'Document signed upload URL generated successfully'
    });
  } catch (error) {
    console.error('Document signed upload URL error:', error);
    return json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to prepare document upload'
      },
      { status: 500 }
    );
  }
};
