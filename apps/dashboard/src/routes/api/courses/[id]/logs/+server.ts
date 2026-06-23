import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ROLE } from '$lib/utils/constants/roles';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { getCourseAccess } from '$lib/utils/functions/authz.server';

const STATUS_LABELS: Record<number, string> = {
  1: '已提交',
  2: '进行中',
  3: '已评分'
};

export const GET: RequestHandler = async ({ params, request }) => {
  const userId = await getUserIdFromRequest(request);
  const courseId = params.id;

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServerSupabase();
    const access = await getCourseAccess(supabase, courseId, userId);

    if (!access.canManageCourse || !access.groupId) {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }

    const { data: members, error: memberError } = await supabase
      .from('groupmember')
      .select('id, role_id, profile_id, email, created_at, assigned_student_id')
      .eq('group_id', access.groupId)
      .eq('role_id', ROLE.STUDENT)
      .order('created_at', { ascending: false });

    if (memberError) {
      console.error('GET /api/courses/[id]/logs members error:', memberError);
      return json({ success: false, message: memberError.message }, { status: 500 });
    }

    const profileIds = [...new Set((members || []).map((member: any) => member.profile_id).filter(Boolean))];
    const { data: profiles } =
      profileIds.length > 0
        ? await supabase
            .from('profile')
            .select('id, fullname, email, avatar_url')
            .in('id', profileIds)
        : { data: [] };

    const profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    const memberById = new Map((members || []).map((member: any) => [member.id, member]));
    const memberIds = (members || []).map((member: any) => member.id);

    const joins = (members || []).map((member: any) => {
      const profile = member.profile_id ? profileById.get(member.profile_id) : null;
      return {
        memberId: member.id,
        profileId: member.profile_id,
        name: profile?.fullname || '',
        email: profile?.email || member.email || '',
        joinedAt: member.created_at,
        assignedStudentId: member.assigned_student_id || ''
      };
    });

    let submissions: any[] = [];
    if (memberIds.length > 0) {
      const { data: submissionRows, error: submissionError } = await supabase
        .from('submission')
        .select(
          'id, status_id, total, created_at, updated_at, started_at, submitted_at, attempt_no, exercise_id, submitted_by, course_id, metadata'
        )
        .eq('course_id', courseId)
        .in('submitted_by', memberIds)
        .order('created_at', { ascending: false });

      if (submissionError) {
        console.error('GET /api/courses/[id]/logs submissions error:', submissionError);
        return json({ success: false, message: submissionError.message }, { status: 500 });
      }

      const exerciseIds = [...new Set((submissionRows || []).map((submission: any) => submission.exercise_id).filter(Boolean))];
      const { data: exercises } =
        exerciseIds.length > 0
          ? await supabase
              .from('exercise')
              .select('id, title, assessment_type')
              .in('id', exerciseIds)
          : { data: [] };

      const exerciseById = new Map((exercises || []).map((exercise: any) => [exercise.id, exercise]));

      submissions = (submissionRows || []).map((submission: any) => {
        const member = memberById.get(submission.submitted_by);
        const profile = member?.profile_id ? profileById.get(member.profile_id) : null;
        const exercise = exerciseById.get(submission.exercise_id);

        return {
          id: submission.id,
          memberId: submission.submitted_by,
          studentName: profile?.fullname || '',
          studentEmail: profile?.email || member?.email || '',
          exerciseId: submission.exercise_id,
          exerciseTitle: exercise?.title || '',
          assessmentType: exercise?.assessment_type || '',
          statusId: submission.status_id,
          statusLabel: STATUS_LABELS[Number(submission.status_id)] || String(submission.status_id || ''),
          total: submission.total,
          attemptNo: submission.attempt_no,
          startedAt: submission.started_at || submission.created_at,
          submittedAt: submission.submitted_at,
          updatedAt: submission.updated_at,
          metadata: submission.metadata || {}
        };
      });
    }

    return json({
      success: true,
      course: {
        id: access.course?.id,
        title: access.course?.title
      },
      summary: {
        studentCount: joins.length,
        submissionCount: submissions.length,
        completedCount: submissions.filter((submission) => submission.statusId === 1 || submission.statusId === 3).length,
        inProgressCount: submissions.filter((submission) => submission.statusId === 2).length
      },
      joins,
      submissions
    });
  } catch (error) {
    console.error('GET /api/courses/[id]/logs error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json({ success: false, message }, { status: 500 });
  }
};
