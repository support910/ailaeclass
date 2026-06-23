import type { SupabaseClient } from '@supabase/supabase-js';
import { ROLE } from '$lib/utils/constants/roles';
import { isSuperAdminUser } from '$lib/utils/functions/authz.server';

export interface UserPermissionResult {
  hasAccess: boolean;
  isOrgAdmin: boolean;
  userMembership: any;
  isStudent: boolean;
}

/**
 * Check if a user has access to a course and determine their role.
 * Unverified TUTOR/ADMIN org members are treated as having no teacher permissions.
 */
export async function checkUserCoursePermissions(
  supabase: SupabaseClient,
  userId: string,
  courseGroupId: string
): Promise<UserPermissionResult> {
  // Check if user is a member of the course group
  // Note: profile(*) removed because PostgREST schema cache sometimes misses the groupmember->profile FK
  const { data: userMembership } = await supabase
    .from('groupmember')
    .select('role_id, id, profile_id, email, created_at, assigned_student_id')
    .eq('group_id', courseGroupId)
    .eq('profile_id', userId)
    .single();

  // Check if user is org admin (requires verified membership)
  const { data: orgData } = await supabase
    .from('group')
    .select('organization_id')
    .eq('id', courseGroupId)
    .single();

  const isSuperAdmin = await isSuperAdminUser(supabase, userId);
  let isOrgAdmin = false;
  let isVerifiedTeacher = false;
  if (orgData?.organization_id) {
    let orgMembership: any = null;
    if (isSuperAdmin) {
      const { data } = await supabase
        .from('organizationmember')
        .select('role_id, verified')
        .eq('organization_id', orgData.organization_id)
        .eq('profile_id', userId)
        .eq('role_id', ROLE.ADMIN)
        .eq('verified', true)
        .single();
      orgMembership = data;
    }

    isOrgAdmin = !!orgMembership;

    // Check if user has a verified TUTOR or ADMIN org membership
    const teacherRoles = isSuperAdmin ? [ROLE.ADMIN, ROLE.TUTOR] : [ROLE.TUTOR];
    const { data: teacherMember } = await supabase
      .from('organizationmember')
      .select('role_id, verified')
      .eq('organization_id', orgData.organization_id)
      .eq('profile_id', userId)
      .in('role_id', teacherRoles)
      .eq('verified', true)
      .single();

    isVerifiedTeacher = !!teacherMember;
  }

  // Null out teacher group memberships if user lacks a verified teacher/admin org membership
  let effectiveMembership = userMembership;
  if (userMembership && (userMembership.role_id === ROLE.TUTOR || userMembership.role_id === ROLE.ADMIN)) {
    if (!isVerifiedTeacher) {
      effectiveMembership = null;
    }
  }

  // Highest admin can manage every course in the org. Teachers and students need
  // direct membership in the course group.
  const hasAccess = !!effectiveMembership || isOrgAdmin;
  // Course-level role takes precedence inside a course. If a user is a student
  // member of this course group, the course UI/API must keep student boundaries
  // even if another org-level membership exists.
  const isStudent = effectiveMembership?.role_id === ROLE.STUDENT;

  return {
    hasAccess,
    isOrgAdmin,
    userMembership: effectiveMembership,
    isStudent
  };
}
