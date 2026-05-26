import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';

export const GET: RequestHandler = async ({ request, url }) => {
  const exerciseId = url.searchParams.get('exerciseId');
  const courseId = url.searchParams.get('courseId');
  const submittedBy = url.searchParams.get('submittedBy');
  const userId = request.headers.get('user_id');

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!exerciseId) {
    return json({ success: false, message: 'Exercise ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // If courseId is provided, check permissions
    if (courseId) {
      const hasPermission = await checkUserCoursePermissions(supabase, userId, courseId);

      if (!hasPermission) {
        return json(
          {
            success: false,
            message: 'Access denied. User is not a member of this course or organization.'
          },
          { status: 403 }
        );
      }
    }

    // Build query object
    const query: {
      exercise_id: string;
      course_id?: string;
      submitted_by?: string;
    } = {
      exercise_id: exerciseId
    };

    if (courseId) {
      query.course_id = courseId;
    }
    if (submittedBy) {
      query.submitted_by = submittedBy;
    }

    // Fetch submissions without nested groupmember->profile
    const { data: submissions, error } = await supabase
      .from('submission')
      .select(
        `
        id,
        answers:question_answer(*),
        status_id,
        feedback,
        submitted_by
      `
      )
      .match(query);

    if (error) {
      console.error('fetch submission error:', error);
      throw new Error('Error fetching submission');
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
          .select('id, fullname, avatar_url')
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
      submitted_by: {
        profile: profileMap[s.submitted_by] || null
      }
    }));

    return json({
      success: true,
      data: enriched || []
    });
  } catch (error) {
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
