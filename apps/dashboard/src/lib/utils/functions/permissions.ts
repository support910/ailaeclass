import type { SupabaseClient } from '@supabase/supabase-js';
import { ROLE } from '$lib/utils/constants/roles';

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

  let isOrgAdmin = false;
  let isVerifiedTeacher = false;
  if (orgData?.organization_id) {
    const { data: orgMembership } = await supabase
      .from('organizationmember')
      .select('role_id, verified')
      .eq('organization_id', orgData.organization_id)
      .eq('profile_id', userId)
      .eq('role_id', ROLE.ADMIN)
      .eq('verified', true)
      .single();

    isOrgAdmin = !!orgMembership;

    // Check if user has a verified TUTOR or ADMIN org membership
    const { data: teacherMember } = await supabase
      .from('organizationmember')
      .select('role_id, verified')
      .eq('organization_id', orgData.organization_id)
      .eq('profile_id', userId)
      .in('role_id', [ROLE.ADMIN, ROLE.TUTOR])
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

  // Check if user has access (either is course member or verified org admin)
  const hasAccess = !!effectiveMembership || isOrgAdmin;
  const isStudent = effectiveMembership?.role_id === ROLE.STUDENT && !isOrgAdmin;

  return {
    hasAccess,
    isOrgAdmin,
    userMembership: effectiveMembership,
    isStudent
  };
}
