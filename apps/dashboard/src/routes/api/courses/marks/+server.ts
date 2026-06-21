import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';

export const POST: RequestHandler = async ({ request }) => {
  const userId = request.headers.get('user_id');
  const { courseId } = await request.json();

  if (!courseId) {
    return json({ success: false, message: 'Course ID is required' }, { status: 400 });
  }

  if (!userId) {
    return json({ success: false, message: 'User ID is required' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();

    // Get course group_id for permission check
    const { data: course } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (!course) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    const { hasAccess, isStudent, userMembership } = await checkUserCoursePermissions(
      supabase,
      userId,
      course.group_id
    );

    if (!hasAccess) {
      return json(
        {
          success: false,
          message: 'Access denied'
        },
        { status: 403 }
      );
    }

    if (isStudent && !userMembership?.id) {
      return json({ success: false, message: 'Student membership not found' }, { status: 403 });
    }

    let marksQuery = supabase.rpc('get_marks').eq('course_id', courseId);
    if (isStudent) {
      marksQuery = marksQuery.eq('groupmember_id', userMembership.id);
    }

    const { data: marks, error } = await marksQuery;

    if (error) {
      console.log('error', error);
      throw new Error('Error fetching marks');
    }

    return json({
      success: true,
      data: marks
    });
  } catch (error) {
    console.log('error', error);
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
