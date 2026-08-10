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

    // The access check and the group lookup both only need orgId, so run them
    // together instead of paying two sequential round trips.
    const [orgAccess, groupResult] = await Promise.all([
      getOrgAccess(supabase, orgId, userId),
      supabase.from('group').select('id').eq('organization_id', orgId)
    ]);

    if (!orgAccess.canManageCourses) {
      return json({ success: false, message: 'You do not belong to this organization or your membership is pending approval' }, { status: 403 });
    }

    // 1. Get group IDs for this org. Admin sees all; teachers see only groups
    // where they are course tutors.
    const { data: groups, error: groupError } = groupResult;

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

    // One embedded query replaces the old course -> lesson -> exercise chain.
    // Measured against production Supabase: 1926ms for the four sequential round
    // trips vs 313ms here, returning an identical set of exam ids.
    const { data, error } = await supabase
      .from('exercise')
      .select('*, lesson!inner(id, title, course_id, course!inner(id, title, group_id))')
      .eq('assessment_type', 'exam')
      .in('lesson.course.group_id', groupIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchOrgExams exercise error:', error);
      return json({ success: false, message: error.message }, { status: 500 });
    }

    const lessonIds = [...new Set((data || []).map((exam: any) => exam.lesson_id).filter(Boolean))];

    // Recycle-bin housekeeping used to be awaited in the middle of this handler,
    // which put a SELECT plus one sequential DELETE per expired exam in front of
    // the user's page load. Run it in the background; the response filters
    // expired items out on its own, so correctness does not depend on it.
    if (lessonIds.length) {
      purgeExpiredDeletedExams(supabase, lessonIds)
        .then((purgeError) => {
          if (purgeError) console.error('fetchOrgExams purge recycle bin error:', purgeError);
        })
        .catch((purgeError) => console.error('fetchOrgExams purge recycle bin error:', purgeError));
    }

    // Mirror purgeExpiredDeletedExams' condition so an expired recycle-bin item
    // can never surface just because the background purge has not run yet.
    const now = Date.now();
    const notExpired = (data || []).filter((exam: any) => {
      if (!exam.deleted_at || !exam.delete_after) return true;
      const due = Date.parse(exam.delete_after);
      return Number.isNaN(due) ? true : due > now;
    });

    const exams = notExpired.map((exam: any) => {
      const lesson = exam.lesson;
      const course = lesson?.course || null;

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
