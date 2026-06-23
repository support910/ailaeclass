import { ROLE } from '$lib/utils/constants/roles';
import { SUPER_ADMIN_EMAIL } from '$lib/utils/constants/admin';

export async function getAuthUserEmail(supabase: any, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (!error && data?.user?.email) {
      return data.user.email.toLowerCase();
    }
  } catch {
    // Fall through to profile lookup. Some local test clients may not expose auth.admin.
  }

  const { data: profile } = await supabase
    .from('profile')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  return (profile?.email || '').toLowerCase();
}

export async function isSuperAdminUser(supabase: any, userId: string): Promise<boolean> {
  const email = await getAuthUserEmail(supabase, userId);
  return email === SUPER_ADMIN_EMAIL;
}

export async function getOrgMembership(supabase: any, orgId: string, userId: string) {
  const { data } = await supabase
    .from('organizationmember')
    .select('id, role_id, verified, profile_id, email, organization_id')
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .maybeSingle();

  return data || null;
}

export async function getOrgAccess(supabase: any, orgId: string, userId: string) {
  const [membership, isSuperAdmin] = await Promise.all([
    getOrgMembership(supabase, orgId, userId),
    isSuperAdminUser(supabase, userId)
  ]);

  const roleId = membership?.role_id;
  const verified = membership?.verified === true;
  const isAdmin = isSuperAdmin && verified && roleId === ROLE.ADMIN;
  const isTeacher = verified && (roleId === ROLE.TUTOR || isAdmin);

  return {
    membership,
    isSuperAdmin,
    isAdmin,
    isTeacher,
    canManageOrg: isAdmin,
    canManageCourses: isAdmin || isTeacher
  };
}

export async function getCourseAccess(supabase: any, courseId: string, userId: string) {
  const { data: course, error } = await supabase
    .from('course')
    .select('id, title, group_id')
    .eq('id', courseId)
    .maybeSingle();

  if (error || !course?.group_id) {
    return {
      course: null,
      groupId: null,
      orgId: null,
      membership: null,
      isAdmin: false,
      isTeacher: false,
      isStudent: false,
      canManageCourse: false,
      hasAccess: false
    };
  }

  const groupId = course.group_id;
  const { data: group } = await supabase
    .from('group')
    .select('organization_id')
    .eq('id', groupId)
    .maybeSingle();

  const orgId = group?.organization_id;
  const { data: membership } = await supabase
    .from('groupmember')
    .select('id, role_id, profile_id, email, created_at, assigned_student_id')
    .eq('group_id', groupId)
    .eq('profile_id', userId)
    .maybeSingle();

  const orgAccess = orgId ? await getOrgAccess(supabase, orgId, userId) : null;
  const courseRoleId = membership?.role_id;
  const isCourseTeacher = courseRoleId === ROLE.TUTOR || courseRoleId === ROLE.ADMIN;
  const isStudent = courseRoleId === ROLE.STUDENT;
  const isAdmin = orgAccess?.isAdmin === true;
  const isTeacher = orgAccess?.isTeacher === true && (isAdmin || isCourseTeacher);
  const canManageCourse = isAdmin || isTeacher;
  const hasAccess = canManageCourse || !!membership;

  return {
    course,
    groupId,
    orgId,
    membership: membership || null,
    isAdmin,
    isTeacher,
    isStudent,
    canManageCourse,
    hasAccess
  };
}
