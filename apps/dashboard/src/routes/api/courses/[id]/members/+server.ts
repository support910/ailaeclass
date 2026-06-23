import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ROLE } from '$lib/utils/constants/roles';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { getCourseAccess } from '$lib/utils/functions/authz.server';

export const POST: RequestHandler = async ({ params, request }) => {
  const userId = await getUserIdFromRequest(request);
  const courseId = params.id;

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return json({ success: false, message: 'A valid student email is required.' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();
    const access = await getCourseAccess(supabase, courseId, userId);

    if (!access.canManageCourse || !access.groupId) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from('profile')
      .select('id, fullname, email, avatar_url')
      .eq('email', email)
      .maybeSingle();

    let duplicateQuery = supabase
      .from('groupmember')
      .select('id')
      .eq('group_id', access.groupId)
      .eq('role_id', ROLE.STUDENT);

    if (profile?.id) {
      duplicateQuery = duplicateQuery.eq('profile_id', profile.id);
    } else {
      duplicateQuery = duplicateQuery.eq('email', email);
    }

    const { data: duplicate } = await duplicateQuery.maybeSingle();
    if (duplicate) {
      return json({ success: false, message: 'This student is already in the course.' }, { status: 409 });
    }

    const { data: member, error } = await supabase
      .from('groupmember')
      .insert({
        group_id: access.groupId,
        role_id: ROLE.STUDENT,
        profile_id: profile?.id || null,
        email
      })
      .select('id, group_id, role_id, profile_id, email, created_at, assigned_student_id')
      .single();

    if (error || !member) {
      console.error('POST /api/courses/[id]/members error:', error);
      return json({ success: false, message: error?.message || 'Failed to add student.' }, { status: 500 });
    }

    return json({
      success: true,
      member: {
        ...member,
        profile: profile || null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
