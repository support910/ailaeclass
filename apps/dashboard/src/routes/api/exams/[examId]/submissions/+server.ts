import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { ROLE } from '$lib/utils/constants/roles';

const SUBMISSION_STATUS = {
  SUBMITTED: 1,
  IN_PROGRESS: 2,
  GRADED: 3
};

/**
 * GET /api/exams/[examId]/submissions?courseId=xxx
 *
 * Returns all submissions for an exam.
 * Only teachers/admins (non-students) can access.
 */
export const GET: RequestHandler = async ({ params, url, request }) => {
  const examId = params.examId;
  const courseId = url.searchParams.get('courseId');
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!courseId) {
    return json({ success: false, message: 'courseId is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Verify exam exists and belongs to course
    const { data: examRow, error: examError } = await supabase
      .from('exercise')
      .select('id, title, lesson_id, assessment_type')
      .eq('id', examId)
      .eq('assessment_type', 'exam')
      .single();

    if (examError || !examRow) {
      return json({ success: false, message: 'Exam not found' }, { status: 404 });
    }

    const { data: lessonRow, error: lessonError } = await supabase
      .from('lesson')
      .select('course_id')
      .eq('id', examRow.lesson_id)
      .single();

    if (lessonError || !lessonRow || lessonRow.course_id !== courseId) {
      return json({ success: false, message: 'Exam does not belong to this course' }, { status: 403 });
    }

    // 2. Resolve membership and verify teacher/admin
    const { data: courseRow, error: courseError } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (courseError || !courseRow?.group_id) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    const { hasAccess, userMembership, isOrgAdmin } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseRow.group_id
    );

    if (!hasAccess) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const isStudent = userMembership?.role_id === ROLE.STUDENT && !isOrgAdmin;
    if (isStudent) {
      return json({ success: false, message: 'Students cannot access grading data' }, { status: 403 });
    }

    // 3. Fetch all submissions for this exam (without nested groupmember->profile)
    const { data: submissions, error: subError } = await supabase
      .from('submission')
      .select(
        `
        id, status_id, started_at, submitted_at, expires_at, total, feedback, created_at,
        submitted_by, course_id, exercise_id
      `
      )
      .eq('exercise_id', examId)
      .eq('course_id', courseId)
      .order('created_at', { ascending: true });

    if (subError) {
      console.error('fetchExamSubmissions error:', subError);
      return json({ success: false, message: 'Failed to load submissions' }, { status: 500 });
    }

    // 4. Enrich with groupmember and profile data separately
    const groupMemberIds = (submissions || [])
      .map((s: any) => s.submitted_by)
      .filter(Boolean);
    const uniqueGroupMemberIds = Array.from(new Set(groupMemberIds));

    let groupMemberMap: Record<string, any> = {};
    let profileMap: Record<string, any> = {};

    if (uniqueGroupMemberIds.length > 0) {
      const { data: groupMembers } = await supabase
        .from('groupmember')
        .select('id, profile_id, assigned_student_id')
        .in('id', uniqueGroupMemberIds);

      (groupMembers || []).forEach((gm: any) => {
        groupMemberMap[gm.id] = gm;
      });

      const profileIds = (groupMembers || [])
        .map((gm: any) => gm.profile_id)
        .filter(Boolean);
      const uniqueProfileIds = Array.from(new Set(profileIds));

      if (uniqueProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profile')
          .select('id, fullname, email, avatar_url')
          .in('id', uniqueProfileIds);

        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });
      }
    }

    // 5. Map response with proper attempt_no per student (ascending order = attempt 1,2,3...)
    const now = Date.now();
    const studentCounters: Record<string, number> = {};
    const mapped = (submissions || []).map((s: any) => {
      const gm = groupMemberMap[s.submitted_by];
      const profile = gm?.profile_id ? profileMap[gm.profile_id] : {};
      const key = s.submitted_by;
      if (studentCounters[key] === undefined) {
        studentCounters[key] = 1;
      } else {
        studentCounters[key] += 1;
      }
      const attempt_no = studentCounters[key];

      const isLate = s.expires_at
        ? new Date(s.expires_at).getTime() < new Date(s.submitted_at || s.created_at).getTime()
        : false;
      const isExpired = s.expires_at ? new Date(s.expires_at).getTime() <= now : false;

      return {
        id: s.id,
        status_id: s.status_id,
        started_at: s.started_at,
        submitted_at: s.submitted_at,
        total: s.total,
        feedback: s.feedback,
        attempt_no,
        student: {
          id: s.submitted_by,
          fullname: profile?.fullname || '-',
          email: profile?.email || '-',
          avatar_url: profile?.avatar_url || '',
          assigned_student_id: gm?.assigned_student_id || null
        },
        is_late: isLate,
        is_expired: isExpired
      };
    });

    // Sort newest first for display
    mapped.sort((a, b) => new Date(b.submitted_at || b.started_at || 0).getTime() - new Date(a.submitted_at || a.started_at || 0).getTime());

    return json({
      success: true,
      exam_title: examRow.title || '',
      submissions: mapped
    });
  } catch (err) {
    console.error('GET /api/exams/[examId]/submissions error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
