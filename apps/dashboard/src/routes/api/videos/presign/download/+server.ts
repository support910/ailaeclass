import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { VIDEO_UPLOAD_BUCKET } from '$lib/utils/constants/videoUpload';

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
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

  const { keys } = await request.json();

  if (!Array.isArray(keys)) {
    return json({ success: false, message: 'Video keys are required' }, { status: 400 });
  }

  try {
    const urls: Record<string, string> = {};

    await Promise.all(
      keys.map(async (key) => {
        const { data, error } = await supabase.storage
          .from(VIDEO_UPLOAD_BUCKET)
          .createSignedUrl(key, 60 * 60 * 24 * 7);

        if (error || !data?.signedUrl) {
          throw error || new Error(`Unable to create signed download URL for ${key}`);
        }

        urls[key] = data.signedUrl;
      })
    );

    return json({
      success: true,
      urls,
      message: 'Video signed download URLs generated successfully'
    });
  } catch (error) {
    console.error('Video signed download URL error:', error);
    return json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to prepare video download'
      },
      { status: 500 }
    );
  }
};
