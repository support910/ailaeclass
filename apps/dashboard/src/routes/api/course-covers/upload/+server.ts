import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { getOrgAccess } from '$lib/utils/functions/authz.server';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';

const BUCKET = 'course-covers';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

async function ensureCourseCoverBucket(supabase: ReturnType<typeof getServerSupabase>) {
  const bucketOptions = {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
    allowedMimeTypes: Object.keys(EXTENSIONS)
  };
  const { data: bucket, error: getBucketError } = await supabase.storage.getBucket(BUCKET);

  if (bucket) {
    const { error } = await supabase.storage.updateBucket(BUCKET, bucketOptions);
    if (error) throw error;
    return;
  }

  if (getBucketError && !getBucketError.message.toLowerCase().includes('not found')) {
    throw getBucketError;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, bucketOptions);
  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw error;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const orgId = String(formData.get('orgId') || '');
    if (!(file instanceof File) || !orgId) {
      return json(
        { success: false, message: 'Organization and image file are required' },
        { status: 400 }
      );
    }

    const extension = EXTENSIONS[file.type];
    if (!extension) {
      return json(
        { success: false, message: 'Only JPG, PNG and WEBP images are supported' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return json({ success: false, message: 'Image exceeds 5MB limit' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const access = await getOrgAccess(supabase, orgId, userId);
    if (!access.canManageCourses) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    await ensureCourseCoverBucket(supabase);

    const fileKey = `course-covers/${orgId}/${userId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileKey, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false
      });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileKey);
    if (!data.publicUrl) throw new Error('Unable to create course cover URL');

    return json({ success: true, url: data.publicUrl, path: fileKey });
  } catch (error) {
    console.error('Course cover upload error:', error);
    return json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to upload course cover'
      },
      { status: 500 }
    );
  }
};
