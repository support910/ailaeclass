import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';

/**
 * POST /api/courses/join-request
 * Body: { courseId: string }
 *
 * Student submits a request to join a course.
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
      .single();

    if (existingMember) {
      return json({ success: false, message: 'Already a member of this course' }, { status: 409 });
    }

    // 3. Check if user already has a pending/approved request for this course
    const { data: existingRequest } = await supabase
      .from('course_join_request')
      .select('id, status')
      .eq('course_id', courseId)
      .eq('profile_id', userId)
      .in('status', ['pending', 'approved'])
      .single();

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return json(
          { success: false, message: 'You already have a pending application for this course' },
          { status: 409 }
        );
      }
      if (existingRequest.status === 'approved') {
        return json(
          { success: false, message: 'Your application has already been approved' },
          { status: 409 }
        );
      }
    }

    // 4. Insert join request
    const { data: joinRequest, error: insertError } = await supabase
      .from('course_join_request')
      .insert({
        course_id: courseId,
        profile_id: userId,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert join request error:', insertError);
      return json({ success: false, message: 'Failed to submit application' }, { status: 500 });
    }

    return json({
      success: true,
      request: joinRequest,
      message: 'Application submitted successfully'
    });
  } catch (err) {
    console.error('POST /api/courses/join-request error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
