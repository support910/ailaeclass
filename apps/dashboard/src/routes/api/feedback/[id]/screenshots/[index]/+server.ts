import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { IMAGE_UPLOAD_BUCKET } from '$lib/utils/constants/imageUpload';

const FEEDBACK_ADMIN_EMAIL = 'admin@5gnu.com';

function bearerToken(request: Request) {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = getServerSupabase();
  const token = bearerToken(request);
  if (!token) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (
    authError ||
    !auth.user?.email ||
    auth.user.email.trim().toLowerCase() !== FEEDBACK_ADMIN_EMAIL
  ) {
    return json({ success: false, message: 'Access denied' }, { status: 403 });
  }

  const screenshotIndex = Number(params.index);
  if (!Number.isInteger(screenshotIndex) || screenshotIndex < 0) {
    return json({ success: false, message: 'Invalid screenshot index' }, { status: 400 });
  }

  const { data: feedback, error } = await supabase
    .from('user_feedback')
    .select('screenshot_paths')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return json({ success: false, message: error.message }, { status: 500 });

  const path = feedback?.screenshot_paths?.[screenshotIndex];
  if (!path) return json({ success: false, message: 'Screenshot not found' }, { status: 404 });

  const { data: image, error: downloadError } = await supabase.storage
    .from(IMAGE_UPLOAD_BUCKET)
    .download(path);
  if (downloadError || !image) {
    return json(
      { success: false, message: downloadError?.message || 'Unable to load screenshot' },
      { status: 500 }
    );
  }

  return new Response(image, {
    headers: {
      'Content-Type': image.type || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300'
    }
  });
};
