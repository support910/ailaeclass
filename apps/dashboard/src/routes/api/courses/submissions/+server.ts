import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';

export const GET: RequestHandler = async ({ request, url }) => {
  const courseId = url.searchParams.get('courseId');
  const userId = request.headers.get('user_id');

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!courseId) {
    return json({ success: false, message: 'Course ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    const { data: courseRow } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (!courseRow?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    const { hasAccess } = await checkUserCoursePermissions(supabase, userId, courseRow.group_id);

    if (!hasAccess) {
      return json(
        {
          success: false,
          message: 'Access denied. User is not a member of this course or organization.'
        },
        { status: 403 }
      );
    }

    // Fetch submissions without nested groupmember->profile
    const { data: submissions, error } = await supabase
      .from('submission')
      .select(
        `
        id,
        created_at,
        answers:question_answer(*),
        exercise:exercise_id(
          id, title, due_by,
          lesson:lesson_id(id, title),
          questions:question(
            *,
            options:option(*),
            question_type:question_type_id(id, label)
          )
        ),
        status_id,
        feedback,
        course:course_id(*),
        submitted_by
      `
      )
      .match({
        course_id: courseId
      });

    if (error) {
      console.error('fetchSubmissions error:', error);
      throw new Error('Error fetching submissions');
    }

    // Enrich with profile data separately
    const submittedByIds = (submissions || [])
      .map((s: any) => s.submitted_by)
      .filter(Boolean);
    const uniqueGroupMemberIds = Array.from(new Set(submittedByIds));

    let profileMap: Record<string, any> = {};
    if (uniqueGroupMemberIds.length > 0) {
      const { data: groupMembers } = await supabase
        .from('groupmember')
        .select('id, profile_id')
        .in('id', uniqueGroupMemberIds);

      const profileIds = (groupMembers || [])
        .map((gm: any) => gm.profile_id)
        .filter(Boolean);
      const uniqueProfileIds = Array.from(new Set(profileIds));

      if (uniqueProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profile')
          .select('id, fullname, avatar_url, email')
          .in('id', uniqueProfileIds);

        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });
      }

      (groupMembers || []).forEach((gm: any) => {
        profileMap[gm.id] = profileMap[gm.profile_id] || null;
      });
    }

    const enriched = (submissions || []).map((s: any) => ({
      ...s,
      groupmember: {
        profile: profileMap[s.submitted_by] || null
      }
    }));

    return json({
      success: true,
      data: enriched
    });
  } catch (error) {
    console.error('GET /api/courses/submissions exception:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json(
      {
        success: false,
        message
      },
      { status: 500 }
    );
  }
};
