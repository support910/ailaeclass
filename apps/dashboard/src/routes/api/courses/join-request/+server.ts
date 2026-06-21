import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * POST /api/courses/join-request
 * Body: { courseId: string }
 *
 * Student joins a course by course code lookup.
 */
export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let body: { courseId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { courseId } = body;
  if (!courseId) {
    return json({ success: false, message: 'courseId is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Verify course exists and is active
    const { data: course, error: courseError } = await supabase
      .from('course')
      .select('id, group_id')
      .eq('id', courseId)
      .eq('status', 'ACTIVE')
      .single();

    if (courseError || !course) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    // 2. Check if user is already a member of this course group
    const { data: existingMember } = await supabase
      .from('groupmember')
      .select('id')
      .eq('group_id', course.group_id)
      .eq('profile_id', userId)
      .maybeSingle();

    if (existingMember) {
      return json({
        success: true,
        member: existingMember,
        message: 'Already joined this course'
      });
    }

    // 3. Keep any legacy join request in sync, but do not require teacher approval for code joins.
    const { data: existingRequest } = await supabase
      .from('course_join_request')
      .select('id, status')
      .eq('course_id', courseId)
      .eq('profile_id', userId)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    // 4. Add student directly to the course group.
    const { data: member, error: memberError } = await supabase
      .from('groupmember')
      .insert({
        profile_id: userId,
        group_id: course.group_id,
        role_id: ROLE.STUDENT
      })
      .select()
      .single();

    if (memberError) {
      console.error('Create groupmember from course code error:', memberError);
      return json({ success: false, message: 'Failed to join course' }, { status: 500 });
    }

    if (existingRequest?.id) {
      await supabase
        .from('course_join_request')
        .update({ status: 'approved' })
        .eq('id', existingRequest.id);
    }

    return json({
      success: true,
      member,
      message: 'Joined course successfully'
    });
  } catch (err) {
    console.error('POST /api/courses/join-request error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
