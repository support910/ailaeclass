import { currentOrg, currentOrgDomain } from '$lib/utils/store/org';
import { identifyPosthogUser, initPosthog } from '$lib/utils/services/posthog';
import { initSentry, setSentryUser } from '$lib/utils/services/sentry';
import { profile, user } from '$lib/utils/store/user';

import { ROLE } from '$lib/utils/constants/roles';
import { dev } from '$app/environment';
import { get } from 'svelte/store';
import { getOrganizations, getCurrentOrg } from '$lib/utils/services/org';
import { goto } from '$app/navigation';
import { handleLocaleChange } from '$lib/utils/functions/translations';
import isPublicRoute from '$lib/utils/functions/routes/isPublicRoute';
import { page } from '$app/stores';
import { setTheme } from '$lib/utils/functions/theme';
import shouldRedirectOnAuth from '$lib/utils/functions/routes/shouldRedirectOnAuth';
import { supabase } from '$lib/utils/functions/supabase';
import { isSingleOrgMode, getSingleOrgSiteName } from '$lib/utils/config/singleOrg';

export function setupAnalytics() {
  // Set up sentry
  initSentry();

  // Set up posthog
  initPosthog();

  // Disable umami on localhost
  if (dev) {
    localStorage.setItem('umami.disabled', '1');
  }
}

function setAnalyticsUser() {
  const profileStore = get(profile);

  if (!profileStore.id) return;

  setSentryUser({
    id: profileStore.id,
    username: profileStore.username,
    email: profileStore.email,
    fullname: profileStore.fullname
  });

  identifyPosthogUser(profileStore.id, {
    email: profileStore.email,
    name: profileStore.fullname
  });
}

/**
 * Auto-join an org using the role stored in auth user_metadata during signup.
 * Returns the target route or null if no role metadata was found.
 */
async function autoJoinOrgFromMetadata(
  authUser: any,
  profileId: string
): Promise<string | null> {
  const signUpRole = authUser.user_metadata?.role;
  if (!signUpRole || (signUpRole !== 'student' && signUpRole !== 'teacher')) {
    return null;
  }

  const roleId = signUpRole === 'teacher' ? ROLE.TUTOR : ROLE.STUDENT;
  const isVerified = signUpRole === 'teacher' ? false : true;

  // Resolve org to join
  let orgIdToJoin = get(currentOrg).id;
  if (!orgIdToJoin && isSingleOrgMode()) {
    const siteName = getSingleOrgSiteName();
    if (siteName) {
      const orgData = await getCurrentOrg(siteName, true);
      orgIdToJoin = orgData?.id || '';
    }
  }

  if (!orgIdToJoin) {
    const { data: firstOrg, error: orgQueryError } = await supabase
      .from('organization')
      .select('id, siteName, name')
      .limit(1)
      .single();

    if (orgQueryError || !firstOrg) {
      console.error('Organization not configured');
      return null;
    }
    orgIdToJoin = firstOrg.id;
  }

  const { data: memberData, error: memberError } = await supabase
    .from('organizationmember')
    .upsert(
      {
        organization_id: orgIdToJoin,
        profile_id: profileId,
        role_id: roleId,
        verified: isVerified
      },
      { onConflict: 'organization_id,profile_id' }
    )
    .select();

  if (memberError) {
    console.error('autoJoinOrgFromMetadata error:', memberError);
    return null;
  }

  // Update currentOrg with role info so sidebar/settings work immediately
  const memberId = memberData?.[0]?.id || '';
  const orgRes = await getOrganizations(profileId);
  const joinedOrg = orgRes.orgs.find((o) => o.id === orgIdToJoin);

  if (joinedOrg) {
    currentOrg.set({
      ...joinedOrg,
      memberId,
      role_id: roleId,
      verified: isVerified
    });
  }

  return signUpRole === 'student' ? '/lms' : '/teacher-pending';
}

export async function getProfile({
  path,
  queryParam,
  isOrgSite,
  orgSiteName
}: {
  path: string;
  queryParam: string;
  isOrgSite: boolean;
  orgSiteName: string;
}) {
  const pageStore = get(page);
  const profileStore = get(profile);
  const currentOrgStore = get(currentOrg);
  const currentOrgDomainStore = get(currentOrgDomain);

  const params = new URLSearchParams(window.location.search);
  // Get user profile
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const { user: authUser } = session || {};
  console.log('Get user', authUser);

  if (!authUser && !isPublicRoute(pageStore.url?.pathname)) {
    return goto('/login?redirect=/' + path + queryParam);
  }

  if (authUser?.email?.endsWith('@test.com') && !dev) {
    // This is a test email, auto logout
    window.location.href = '/logout';
    return;
  }

  // Skip refetching profile and org, if both already in store
  if (profileStore.id && currentOrgStore.id) {
    await handleLocaleChange(profileStore.locale);
    return;
  }

  // Check if user has profile
  let {
    data: profileData,
    error,
    status
  } = await supabase.from('profile').select(`*`).eq('id', authUser?.id).single();
  console.log('Get profile', profileData);

  if (error && !profileData && status === 406 && authUser) {
    // User wasn't found, create profile
    console.log(`User wasn't found, create profile`);

    const [regexUsernameMatch] = [...(authUser.email?.matchAll(/(.*)@/g) || [])];

    const { data: newProfileData, error } = await supabase
      .from('profile')
      .insert({
        id: authUser.id,
        username: regexUsernameMatch[1] + `${new Date().getTime()}`,
        fullname: regexUsernameMatch[1],
        email: authUser.email,
        is_email_verified: true,
        verified_at: new Date().toDateString()
      })
      .select();

    // Profile created, go to onboarding or lms
    if (!error && newProfileData) {
      user.update((_user) => ({
        ..._user,
        fetchingUser: false,
        isLoggedIn: true,
        currentSession: authUser
      }));

      profile.set(newProfileData[0]);

      setAnalyticsUser();

      // Fetch language
      await handleLocaleChange(newProfileData[0].locale);

      const isFromStudentInvite = path.includes('invite/s') || params.get('redirect')?.includes('/invite/s/');

      if (isFromStudentInvite && (isOrgSite || isSingleOrgMode())) {
        // Student invite flow: auto-join as verified student
        let orgIdToJoin = currentOrgStore.id;
        if (isSingleOrgMode() && !orgIdToJoin) {
          const siteName = getSingleOrgSiteName()!;
          const orgData = await getCurrentOrg(siteName, true);
          orgIdToJoin = orgData?.id || '';
        }

        if (orgIdToJoin) {
          const { data, error } = await supabase
            .from('organizationmember')
            .insert({
              organization_id: orgIdToJoin,
              profile_id: newProfileData[0].id,
              role_id: ROLE.STUDENT,
              verified: true
            })
            .select();
          if (error) {
            console.error('Error adding user to organisation', error);
          } else {
            console.log('Success adding user to organisation', data);
            const memberId = data?.[0]?.id || '';

            currentOrg.update((_currentOrg) => ({
              ..._currentOrg,
              id: orgIdToJoin,
              memberId,
              role_id: ROLE.STUDENT
            }));
          }
        }

        if (params.get('redirect')) {
          goto(params.get('redirect') || '');
        } else if (shouldRedirectOnAuth(path)) {
          goto('/lms');
        }
        return;
      }

      // Not a student invite: check if role was selected during signup
      const targetRoute = await autoJoinOrgFromMetadata(authUser, newProfileData[0].id);
      if (targetRoute) {
        if (shouldRedirectOnAuth(path)) {
          goto(targetRoute);
        }
        return;
      }

      // No role metadata: force explicit signup for role selection
      if (!path.includes('invite')) {
        goto('/signup');
      }
    }

    user.update((_user) => ({
      ..._user,
      fetchingUser: false
    }));
  } else if (profileData) {
    // Profile exists, go to profile page
    user.update((_user) => ({
      ..._user,
      fetchingUser: false,
      isLoggedIn: true,
      currentSession: authUser
    }));

    profile.set(profileData);

    // Set user in sentry
    setAnalyticsUser();

    await handleLocaleChange(profileData.locale);

    const orgRes = await getOrganizations(profileData.id, isOrgSite, orgSiteName);

    const hasMembership = !!orgRes.currentOrg?.id;
    const roleInOrg = orgRes.currentOrg?.role_id;
    const isVerified = orgRes.currentOrg?.verified !== false;
    const isStudentAccount = roleInOrg === ROLE.STUDENT;
    const isTeacherPending = roleInOrg === ROLE.TUTOR && !isVerified;

    if (hasMembership && (isOrgSite || isSingleOrgMode())) {
      if (params.has('redirect')) {
        goto(params.get('redirect') || '');
      } else if (shouldRedirectOnAuth(path)) {
        if (isStudentAccount) {
          goto('/lms');
        } else if (isTeacherPending) {
          goto('/teacher-pending');
        } else {
          goto(`/org/${orgRes.currentOrg.siteName}`);
        }
      }
    } else if (hasMembership) {
      if (isStudentAccount) {
        console.log('Student logged into dashboard');
        if (dev || !currentOrgDomainStore || currentOrgDomainStore.includes('localhost')) {
          goto('/lms');
        } else {
          window.location.replace(`${currentOrgDomainStore}/lms`);
        }
      } else if (isTeacherPending) {
        goto('/teacher-pending');
      } else if (params.has('redirect')) {
        goto(params.get('redirect') || '');
      } else if (shouldRedirectOnAuth(path)) {
        goto(`/org/${orgRes.currentOrg.siteName}`);
      }
    } else {
      // No membership found: try auto-join from signup metadata
      const targetRoute = await autoJoinOrgFromMetadata(authUser, profileData.id);
      if (targetRoute) {
        if (shouldRedirectOnAuth(path)) {
          goto(targetRoute);
        }
        return;
      }

      console.warn('User has no organization membership. Redirecting to signup.');
      if (!path.includes('invite')) {
        goto('/signup');
      }
    }

    setTheme(orgRes?.currentOrg?.theme);
  }

  if (!profileData && !isPublicRoute(pageStore.url?.pathname)) {
    goto('/login?redirect=/' + path);
  }
}
