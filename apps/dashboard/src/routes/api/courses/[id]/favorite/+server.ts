import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';

async function authorize(request: Request, courseId: string) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return { status: 401, message: 'Unauthorized' };
  const supabase = getServerSupabase();
  const { data: course } = await supabase
    .from('course')
    .select('id, group_id')
    .eq('id', courseId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  const { data: group } = course?.group_id
    ? await supabase.from('group').select('organization_id').eq('id', course.group_id).maybeSingle()
    : { data: null };
  const orgId = group?.organization_id;
  if (!orgId) return { status: 404, message: 'Course not found' };
  const { data: membership } = await supabase
    .from('organizationmember')
    .select('id')
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .eq('verified', true)
    .maybeSingle();
  if (!membership) return { status: 403, message: 'Access denied' };
  return { supabase, userId };
}

async function getLegacyFavorites(supabase: any, userId: string): Promise<string[]> {
  const { data: profile } = await supabase
    .from('profile')
    .select('metadata')
    .eq('id', userId)
    .maybeSingle();
  return Array.isArray(profile?.metadata?.course_favorites)
    ? profile.metadata.course_favorites
    : [];
}

async function setLegacyFavorites(supabase: any, userId: string, courseIds: string[]) {
  const { data: profile } = await supabase
    .from('profile')
    .select('metadata')
    .eq('id', userId)
    .maybeSingle();
  const metadata = profile?.metadata && typeof profile.metadata === 'object' ? profile.metadata : {};
  const { error } = await supabase
    .from('profile')
    .update({ metadata: { ...metadata, course_favorites: [...new Set(courseIds)] } })
    .eq('id', userId);
  if (error) throw error;
}

export const GET: RequestHandler = async ({ request, params }) => {
  const auth = await authorize(request, params.id);
  if (!auth.supabase || !auth.userId)
    return json({ success: false, message: auth.message }, { status: auth.status });
  const { data, error } = await auth.supabase
    .from('course_favorite')
    .select('id')
    .eq('course_id', params.id)
    .eq('profile_id', auth.userId)
    .maybeSingle();
  const legacyFavorites = await getLegacyFavorites(auth.supabase, auth.userId);
  if (error) return json({ success: true, isFavorite: legacyFavorites.includes(params.id) });
  return json({ success: true, isFavorite: !!data || legacyFavorites.includes(params.id) });
};

export const POST: RequestHandler = async ({ request, params }) => {
  const auth = await authorize(request, params.id);
  if (!auth.supabase || !auth.userId)
    return json({ success: false, message: auth.message }, { status: auth.status });
  const { error } = await auth.supabase
    .from('course_favorite')
    .upsert(
      { course_id: params.id, profile_id: auth.userId },
      { onConflict: 'course_id,profile_id' }
    );
  if (error) {
    const favorites = await getLegacyFavorites(auth.supabase, auth.userId);
    await setLegacyFavorites(auth.supabase, auth.userId, [...favorites, params.id]);
  }
  return json({ success: true, isFavorite: true });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const auth = await authorize(request, params.id);
  if (!auth.supabase || !auth.userId)
    return json({ success: false, message: auth.message }, { status: auth.status });
  const { error } = await auth.supabase
    .from('course_favorite')
    .delete()
    .eq('course_id', params.id)
    .eq('profile_id', auth.userId);
  const favorites = await getLegacyFavorites(auth.supabase, auth.userId);
  if (error || favorites.includes(params.id)) {
    await setLegacyFavorites(
      auth.supabase,
      auth.userId,
      favorites.filter((courseId) => courseId !== params.id)
    );
  }
  return json({ success: true, isFavorite: false });
};
