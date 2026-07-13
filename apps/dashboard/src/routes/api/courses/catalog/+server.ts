import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getCatalogCourses } from '$lib/utils/functions/courseCatalog.server';
import { getOrgAccess } from '$lib/utils/functions/authz.server';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';

export const GET: RequestHandler = async ({ request, url }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  const orgId = url.searchParams.get('orgId') || '';
  if (!orgId) return json({ success: false, message: 'orgId is required' }, { status: 400 });

  try {
    const supabase = getServerSupabase();
    const access = await getOrgAccess(supabase, orgId, userId);
    if (!access.membership || access.membership.verified !== true) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }
    const courses = await getCatalogCourses(supabase, orgId, userId);
    return json({ success: true, courses: courses.filter((course: any) => !course.is_member) });
  } catch (error) {
    return json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load courses'
      },
      { status: 500 }
    );
  }
};
