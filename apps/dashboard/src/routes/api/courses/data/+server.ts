import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { STATUS } from '$lib/utils/constants/course';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';

const COURSE_SELECT_QUERY = `
  id, title, type, description, overview, logo, is_published, version, group_id,
  slug, cost, currency, metadata, is_certificate_downloadable, certificate_theme,
  lesson_section(id, title, order, created_at),
  lessons:lesson(
    id, title, public, lesson_at, is_unlocked, order, created_at, section_id,
    note, videos, slide_url, call_url, totalExercises:exercise(count), 
    totalComments:lesson_comment(count), profile:teacher_id(id, avatar_url, fullname),
    lesson_completion(id, profile_id, is_complete)
  ),
  attendance:group_attendance(*),
  polls:apps_poll(status)
`;

const GROUP_MEMBERS_SELECT = `
  id,
  members:groupmember(
    id, role_id, profile_id, email, created_at, assigned_student_id
  )
`;

async function getCourse(supabase: any, courseId: string) {
  const { data: course, error } = await supabase
    .from('course')
    .select(COURSE_SELECT_QUERY)
    .eq('id', courseId)
    .eq('status', STATUS[STATUS.ACTIVE])
    .single();

  if (error || !course) {
    throw new Error('Course not found');
  }

  // Fetch join_code separately to avoid PostgREST schema cache issues
  const { data: joinCodeData, error: joinCodeError } = await supabase
    .from('course')
    .select('join_code')
    .eq('id', courseId)
    .single();

  if (!joinCodeError && joinCodeData) {
    course.join_code = joinCodeData.join_code;
  }

  return course;
}

async function getGroupMembers(
  supabase: any,
  groupId: string,
  isStudent: boolean,
  userMembership: any
) {
  if (isStudent) {
    return {
      id: groupId,
      members: userMembership ? [userMembership] : []
    };
  }

  const { data: group, error } = await supabase
    .from('group')
    .select(GROUP_MEMBERS_SELECT)
    .eq('id', groupId)
    .single();

  if (error) {
    console.error('getGroupMembers Supabase error:', error);
    throw new Error(`Error fetching group members: ${error.message || error.details || JSON.stringify(error)}`);
  }

  // Fetch profiles separately because PostgREST schema cache may miss the groupmember->profile FK
  const members = group.members || [];
  const profileIds = members.map((m: any) => m.profile_id).filter(Boolean);

  let profileMap: Record<string, any> = {};
  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profile')
      .select('id, fullname, avatar_url, email')
      .in('id', profileIds);

    if (profileError) {
      console.error('getGroupMembers profile query error:', profileError);
    } else {
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });
    }
  }

  const membersWithProfile = members.map((m: any) => ({
    ...m,
    profile: profileMap[m.profile_id] || null
  }));

  return {
    id: group.id,
    members: membersWithProfile
  };
}

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { courseId } = await request.json();
  if (!courseId) {
    return json({ success: false, message: 'Course ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();
    const course = await getCourse(supabase, courseId);

    const { hasAccess, isStudent, userMembership, isOrgAdmin } =
      await checkUserCoursePermissions(supabase, userId, course.group_id);

    if (!hasAccess) {
      return json(
        {
          success: false,
          message: 'Access denied. User is not a member of this course.',
          data: null
        },
        { status: 403 }
      );
    }

    const group = await getGroupMembers(supabase, course.group_id, isStudent, userMembership);

    return json({
      success: true,
      data: { ...course, group },
      viewer: {
        hasAccess,
        isStudent,
        isOrgAdmin,
        role_id: userMembership?.role_id ?? null,
        group_member_id: userMembership?.id ?? null
      }
    });
  } catch (error) {
    console.error('POST /api/courses/data exception:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message === 'Course not found' ? 404 : 500;

    return json(
      {
        success: false,
        message,
        data: null
      },
      { status }
    );
  }
};
