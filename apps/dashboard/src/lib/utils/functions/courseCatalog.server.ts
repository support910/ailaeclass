import { ROLE } from '$lib/utils/constants/roles';

const PUBLIC_COURSE_FIELDS =
  'id, title, description, overview, logo, slug, metadata, cost, currency, is_published, status, type, version, group_id, created_at, is_certificate_downloadable, certificate_theme';

export async function getCatalogCourses(supabase: any, orgId: string, userId: string) {
  const { data: groups, error: groupError } = await supabase
    .from('group')
    .select('id')
    .eq('organization_id', orgId);

  if (groupError) throw groupError;
  const groupIds = (groups || []).map((group: any) => group.id);
  if (!groupIds.length) return [];

  const { data: courseRows, error: courseError } = await supabase
    .from('course')
    .select(PUBLIC_COURSE_FIELDS)
    .in('group_id', groupIds)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });

  if (courseError) throw courseError;
  const courses = courseRows || [];
  const courseIds = courses.map((course: any) => course.id);
  if (!courseIds.length) return [];

  const [{ data: lessons }, { data: members }, favoriteResult] = await Promise.all([
    supabase.from('lesson').select('course_id').in('course_id', courseIds),
    supabase
      .from('groupmember')
      .select('id, group_id, profile_id, role_id')
      .in('group_id', groupIds),
    supabase
      .from('course_favorite')
      .select('course_id')
      .eq('profile_id', userId)
      .in('course_id', courseIds)
  ]);

  const tutorIds = [
    ...new Set(
      (members || [])
        .filter((member: any) => member.role_id === ROLE.TUTOR && member.profile_id)
        .map((member: any) => member.profile_id)
    )
  ];
  const { data: tutorProfiles } = tutorIds.length
    ? await supabase.from('profile').select('id, fullname, avatar_url').in('id', tutorIds)
    : { data: [] };

  const { data: viewerProfile } = favoriteResult.error
    ? await supabase.from('profile').select('metadata').eq('id', userId).maybeSingle()
    : { data: null };
  const legacyFavoriteIds = Array.isArray(viewerProfile?.metadata?.course_favorites)
    ? viewerProfile.metadata.course_favorites
    : [];
  const profileById = new Map((tutorProfiles || []).map((profile: any) => [profile.id, profile]));
  const favoriteIds = new Set([
    ...(favoriteResult.data || []).map((favorite: any) => favorite.course_id),
    ...legacyFavoriteIds
  ]);

  return courses.map((course: any) => {
    const courseMembers = (members || []).filter(
      (member: any) => member.group_id === course.group_id
    );
    return {
      ...course,
      total_lessons: (lessons || []).filter((lesson: any) => lesson.course_id === course.id).length,
      total_students: courseMembers.filter((member: any) => member.role_id === ROLE.STUDENT).length,
      is_member: courseMembers.some((member: any) => member.profile_id === userId),
      is_favorite: favoriteIds.has(course.id),
      teachers: courseMembers
        .filter((member: any) => member.role_id === ROLE.TUTOR && member.profile_id)
        .map((member: any) => profileById.get(member.profile_id))
        .filter(Boolean)
    };
  });
}

export async function getPublicCourseBySlug(supabase: any, slug: string) {
  const { data: course, error } = await supabase
    .from('course')
    .select(PUBLIC_COURSE_FIELDS)
    .eq('slug', slug)
    .eq('status', 'ACTIVE')
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  if (!course) return null;

  const [{ data: sections }, { data: lessons }, { data: members }] = await Promise.all([
    supabase.from('lesson_section').select('id, title, order').eq('course_id', course.id),
    supabase.from('lesson').select('id, title, order, section_id').eq('course_id', course.id),
    supabase
      .from('groupmember')
      .select('profile_id, role_id')
      .eq('group_id', course.group_id)
      .eq('role_id', ROLE.TUTOR)
  ]);

  const tutorIds = (members || []).map((member: any) => member.profile_id).filter(Boolean);
  const { data: teachers } = tutorIds.length
    ? await supabase.from('profile').select('id, fullname, avatar_url').in('id', tutorIds)
    : { data: [] };

  return {
    ...course,
    lesson_section: sections || [],
    lessons: lessons || [],
    teachers: teachers || []
  };
}

export async function getCourseOverviewById(supabase: any, courseId: string) {
  const { data: course, error } = await supabase
    .from('course')
    .select(PUBLIC_COURSE_FIELDS)
    .eq('id', courseId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error) throw error;
  if (!course) return null;

  const [{ data: sections }, { data: lessons }, { data: members }] = await Promise.all([
    supabase.from('lesson_section').select('id, title, order').eq('course_id', course.id),
    supabase.from('lesson').select('id, title, order, section_id').eq('course_id', course.id),
    supabase
      .from('groupmember')
      .select('profile_id, role_id')
      .eq('group_id', course.group_id)
      .eq('role_id', ROLE.TUTOR)
  ]);

  const tutorIds = (members || []).map((member: any) => member.profile_id).filter(Boolean);
  const { data: teachers } = tutorIds.length
    ? await supabase.from('profile').select('id, fullname, avatar_url').in('id', tutorIds)
    : { data: [] };

  return {
    ...course,
    lesson_section: sections || [],
    lessons: lessons || [],
    teachers: teachers || []
  };
}
