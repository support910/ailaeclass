import type { RequestHandler } from './$types';
import type { CourseAnalytics, StudentOverview } from '$lib/utils/types/analytics';
import type { UserExercisesStats } from '$lib/utils/types/analytics';
import { calcPercentageWithRounding } from '$lib/utils/functions/number.js';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';
import { json } from '@sveltejs/kit';

const CACHE_DURATION = 60 * 5; // 5 minutes

export const GET: RequestHandler = async ({ setHeaders, request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const courseId = url.searchParams.get('courseId');
  if (!courseId) {
    return json({ success: false, message: 'Course ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // Fetch course to get group_id for permission check
    const { data: courseData, error: courseError } = await supabase
      .from('course')
      .select('id, title, group_id')
      .eq('id', courseId)
      .single();

    if (courseError || !courseData) {
      return json(
        { success: false, message: 'Course not found.' },
        { status: 404 }
      );
    }

    const { hasAccess, isStudent } = await checkUserCoursePermissions(
      supabase,
      userId,
      courseData.group_id
    );

    if (!hasAccess) {
      return json(
        {
          success: false,
          message: 'Access denied. User is not a member of this course or organization.'
        },
        { status: 403 }
      );
    }

    if (isStudent) {
      return json(
        {
          success: false,
          message: 'Access denied. Analytics is only available to teachers and admins.'
        },
        { status: 403 }
      );
    }

    setHeaders({
      'cache-control': `max-age=${CACHE_DURATION}`,
      'content-type': 'application/json'
    });

    const analytics = await getCourseAnalytics(supabase, courseId, courseData);
    return json({ success: true, data: analytics });
  } catch (error) {
    console.error('Course analytics error:', error);
    return json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
};

async function getCourseAnalytics(
  supabase: any,
  courseId: string,
  courseData: any
): Promise<CourseAnalytics> {
  // 1. group_id already available from courseData, skip re-fetching course

  // 2. Fetch group members (no nested profile to avoid PGRST200)
  const { data: members, error: membersError } = await supabase
    .from('groupmember')
    .select('id, role_id, profile_id')
    .eq('group_id', courseData.group_id);

  if (membersError) {
    throw new Error('Failed to fetch group members');
  }

  // 3. Fetch profiles separately
  const profileIds = (members || []).map((m: any) => m.profile_id).filter(Boolean);
  let profileMap: Record<string, any> = {};
  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profile')
      .select('id, fullname, email, avatar_url')
      .in('id', profileIds);

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    } else {
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });
    }
  }

  const membersWithProfile = (members || []).map((m: any) => ({
    ...m,
    profile: profileMap[m.profile_id] || null
  }));

  // 4. Fetch lessons and exercises for counting
  const { data: lessons, error: lessonsError } = await supabase
    .from('lesson')
    .select('id, exercise(id)')
    .eq('course_id', courseId);

  if (lessonsError) {
    console.error('Lessons fetch error:', lessonsError);
  }

  const totalLessons = lessons?.length || 0;
  const totalExercises =
    lessons?.reduce((sum: number, l: any) => sum + (l.exercise?.length || 0), 0) || 0;

  // 5. Count tutors and students
  const students = membersWithProfile.filter((m: any) => m.role_id === 3);
  const tutors = membersWithProfile.filter((m: any) => m.role_id === 1 || m.role_id === 2);

  // 6. Get student analytics
  const studentAnalytics = await Promise.all(
    students.map((member: any) => getStudentOverview(supabase, courseId, member))
  );

  const validStudents = studentAnalytics.filter(
    (student): student is StudentOverview => student !== null
  );

  // 7. Calculate aggregated metrics
  let lessonCompletionRate = 0;
  let exerciseCompletionRate = 0;
  let averageGrade = 0;

  if (validStudents.length > 0) {
    lessonCompletionRate = Math.round(
      validStudents.reduce((sum, student) => sum + student.progressPercentage, 0) /
        validStudents.length
    );

    exerciseCompletionRate = Math.round(
      validStudents.reduce((sum, student) => {
        const completionRate =
          student.totalExercises > 0
            ? (student.exercisesSubmitted / student.totalExercises) * 100
            : 0;
        return sum + completionRate;
      }, 0) / validStudents.length
    );

    averageGrade = Math.round(
      validStudents.reduce((sum, student) => sum + student.averageGrade, 0) /
        validStudents.length
    );
  }

  return {
    totalTutors: tutors.length,
    totalStudents: students.length,
    totalLessons,
    totalExercises,
    lessonCompletionRate,
    exerciseCompletionRate,
    averageGrade,
    students: validStudents
  };
}

async function getLastLogin(supabase: any, userId: string): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from('analytics_login_events')
      .select('logged_in_at')
      .eq('user_id', userId)
      .order('logged_in_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    return data?.[0]?.logged_in_at;
  } catch (error) {
    console.error('Error fetching last login:', error);
    return undefined;
  }
}

async function getStudentOverview(
  supabase: any,
  courseId: string,
  member: any
): Promise<StudentOverview | null> {
  try {
    const { data: courseProgressData, error: progressError } = await supabase
      .rpc('get_course_progress', {
        course_id_arg: courseId,
        profile_id_arg: member.profile_id
      });

    if (progressError) {
      console.error('Error fetching course progress:', progressError);
      return null;
    }

    const courseProgress = Array.isArray(courseProgressData) ? courseProgressData[0] : courseProgressData;
    if (!courseProgress) {
      console.error('No course progress data found');
      return null;
    }

    const userExercisesStats = await fetchUserExercisesStats(supabase, courseId, member.id);

    const completedExercises =
      userExercisesStats?.filter((exercise) => exercise.isCompleted)?.length || 0;
    const totalExercises = userExercisesStats?.length || 0;

    const lastLoginDate = await getLastLogin(supabase, member.profile_id);

    let lastSeen = 'Never';
    if (lastLoginDate) {
      const lastLogin = new Date(lastLoginDate);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60));

      if (diffInHours < 1) {
        lastSeen = 'Just now';
      } else if (diffInHours < 24) {
        lastSeen = `${diffInHours} hours ago`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        lastSeen = `${diffInDays} days ago`;
      }
    }

    const lessonsCompleted = courseProgress.lessons_completed || 0;
    const totalLessons = courseProgress.lessons_count || 0;
    const progressPercentage = calcPercentageWithRounding(lessonsCompleted, totalLessons);

    const totalEarnedPoints =
      userExercisesStats?.reduce((sum, exercise) => sum + exercise.score, 0) || 0;
    const totalPoints =
      userExercisesStats?.reduce((sum, exercise) => sum + exercise.totalPoints, 0) || 0;
    const averageGrade = calcPercentageWithRounding(totalEarnedPoints, totalPoints);

    return {
      id: member.profile_id,
      profile: {
        fullname: member.profile?.fullname || 'Unknown',
        email: member.profile?.email || '',
        avatar_url: member.profile?.avatar_url || ''
      },
      lessonsCompleted,
      totalLessons,
      exercisesSubmitted: completedExercises,
      totalExercises: totalExercises,
      averageGrade,
      lastSeen,
      progressPercentage
    };
  } catch (error) {
    console.error('Error getting student overview:', error);
    return null;
  }
}

async function fetchUserExercisesStats(
  supabase: any,
  courseId: string,
  groupmemberId: string
): Promise<UserExercisesStats[] | undefined> {
  try {
    // Step 1: Fetch exercises for this course (no nested submission to avoid PGRST200)
    const { data: lessons, error: lessonError } = await supabase
      .from('lesson')
      .select('id, title, exercise(id, title, lesson_id, created_at, question(points))')
      .eq('course_id', courseId);

    if (lessonError) {
      console.error('fetchUserExercisesStats lesson error:', lessonError);
      return undefined;
    }

    // Step 2: Fetch submissions for this groupmember
    const { data: submissions, error: subError } = await supabase
      .from('submission')
      .select('id, total, status_id, exercise_id')
      .eq('submitted_by', groupmemberId);

    if (subError) {
      console.error('fetchUserExercisesStats submission error:', subError);
      return undefined;
    }

    const submissionMap: Record<string, any> = {};
    (submissions || []).forEach((s: any) => {
      submissionMap[s.exercise_id] = s;
    });

    // Step 3: Build stats in JS
    const stats: UserExercisesStats[] = [];
    (lessons || []).forEach((lesson: any) => {
      (lesson.exercise || []).forEach((exercise: any) => {
        const totalPoints =
          exercise.question?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || 0;
        const sub = submissionMap[exercise.id];

        stats.push({
          id: exercise.id,
          lessonId: exercise.lesson_id,
          lessonTitle: lesson.title,
          title: exercise.title,
          status: sub?.status_id,
          score: sub?.total || 0,
          totalPoints,
          isCompleted: !!sub
        });
      });
    });

    return stats;
  } catch (error) {
    console.error('Unexpected error in fetchUserExercisesStats:', error);
    return undefined;
  }
}
