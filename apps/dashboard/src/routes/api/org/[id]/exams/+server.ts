import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';
import { getOrgAccess } from '$lib/utils/functions/authz.server';
import { purgeExpiredDeletedExams } from '$lib/utils/functions/examRecycleBin.server';

/**
 * GET /api/org/{id}/exams
 *
 * Returns all exam exercises for an organization.
 * Requires authentication (user_id header).
 * Uses service-role client to bypass RLS.
 */
export const GET: RequestHandler = async ({ request, params }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const orgId = params.id;
  if (!orgId) {
    return json({ success: false, message: 'Organization ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    const orgAccess = await getOrgAccess(supabase, orgId, userId);

    if (!orgAccess.canManageCourses) {
      return json({ success: false, message: 'You do not belong to this organization or your membership is pending approval' }, { status: 403 });
    }

    // 1. Get group IDs for this org. Admin sees all; teachers see only groups
    // where they are course tutors.
    const { data: groups, error: groupError } = await supabase
      .from('group')
      .select('id')
      .eq('organization_id', orgId);

    if (groupError) {
      console.error('fetchOrgExams group error:', groupError);
      return json({ success: false, message: groupError.message }, { status: 500 });
    }

    if (!groups || groups.length === 0) {
      return json({ success: true, exams: [] });
    }

    let groupIds = groups.map((g) => g.id);

    if (!orgAccess.isAdmin) {
      const { data: teacherMemberships, error: membershipError } = await supabase
        .from('groupmember')
        .select('group_id')
        .eq('profile_id', userId)
        .in('role_id', [ROLE.ADMIN, ROLE.TUTOR])
        .in('group_id', groupIds);

      if (membershipError) {
        console.error('fetchOrgExams teacher membership error:', membershipError);
        return json({ success: false, message: membershipError.message }, { status: 500 });
      }

      groupIds = (teacherMemberships || []).map((membership: any) => membership.group_id);
      if (groupIds.length === 0) {
        return json({ success: true, exams: [] });
      }
    }

    // 2. Get course IDs for these groups
    const { data: courses, error: courseError } = await supabase
      .from('course')
      .select('id, title')
      .in('group_id', groupIds);

    if (courseError) {
      console.error('fetchOrgExams course error:', courseError);
      return json({ success: false, message: courseError.message }, { status: 500 });
    }

    if (!courses || courses.length === 0) {
      return json({ success: true, exams: [] });
    }

    const courseById = new Map((courses || []).map((course: any) => [course.id, course]));
    const courseIds = courses.map((c) => c.id);

    // 3. Get lesson IDs for these courses
    const { data: lessons, error: lessonError } = await supabase
      .from('lesson')
      .select('id, title, course_id')
      .in('course_id', courseIds);

    if (lessonError) {
      console.error('fetchOrgExams lesson error:', lessonError);
      return json({ success: false, message: lessonError.message }, { status: 500 });
    }

    if (!lessons || lessons.length === 0) {
      return json({ success: true, exams: [] });
    }

    const lessonById = new Map((lessons || []).map((lesson: any) => [lesson.id, lesson]));
    const lessonIds = lessons.map((l) => l.id);

    const purgeError = await purgeExpiredDeletedExams(supabase, lessonIds);
    if (purgeError) {
      console.error('fetchOrgExams purge recycle bin error:', purgeError);
    }

    // 4. Get exam exercises, including non-expired items in the recycle bin.
    const { data, error } = await supabase
      .from('exercise')
      .select('*')
      .in('lesson_id', lessonIds)
      .eq('assessment_type', 'exam')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchOrgExams exercise error:', error);
      return json({ success: false, message: error.message }, { status: 500 });
    }

    const exams = (data || []).map((exam: any) => {
      const lesson = lessonById.get(exam.lesson_id);
      const course = lesson?.course_id ? courseById.get(lesson.course_id) : null;

      return {
        ...exam,
        lesson: lesson
          ? {
              id: lesson.id,
              title: lesson.title,
              course_id: lesson.course_id,
              course: course ? { id: course.id, title: course.title } : null
            }
          : null
      };
    });

    return json({ success: true, exams });
  } catch (err) {
    console.error('GET /api/org/{id}/exams error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
