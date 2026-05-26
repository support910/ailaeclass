<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import AuthUI from '$lib/components/AuthUI/index.svelte';
  import TextField from '$lib/components/Form/TextField.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { SIGNUP_FIELDS } from '$lib/utils/constants/authentication';
  import { ROLE } from '$lib/utils/constants/roles';
  import { getSupabase } from '$lib/utils/functions/supabase';
  import { t } from '$lib/utils/functions/translations';
  import {
    authValidation,
    getConfirmPasswordError,
    getDisableSubmit
  } from '$lib/utils/functions/validator';
  import { capturePosthogEvent } from '$lib/utils/services/posthog';
  import { globalStore } from '$lib/utils/store/app';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { BRAND } from '$lib/utils/config/brand';
  import { isSingleOrgMode, getSingleOrgSiteName } from '$lib/utils/config/singleOrg';
  import { getCurrentOrg } from '$lib/utils/services/org';

  let supabase = getSupabase();
  let fields = Object.assign({}, SIGNUP_FIELDS);
  let loading = false;
  let success = false;
  let errors: {
    email?: string;
    password?: string;
    confirmPassword?: string;
  } = {};
  let submitError: string;
  let disableSubmit = false;
  let formRef: HTMLFormElement;

  let query = new URLSearchParams($page.url.search);
  let redirect = query.get('redirect');

  // Student invite flow: force student role, skip selection
  let isStudentInvite = redirect?.includes('/invite/s/') ?? false;

  // Role selection state
  let selectedRole: 'student' | 'teacher' | '' = isStudentInvite ? 'student' : '';

  function selectRole(role: 'student' | 'teacher') {
    if (isStudentInvite) return;
    selectedRole = role;
  }

  async function handleSubmit() {
    if (!selectedRole) {
      submitError = $t('signup.role_required');
      return;
    }

    try {
      loading = true;
      submitError = '';

      let authUser;

      // Check if user is already logged in (e.g. after email verification)
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession?.user) {
        authUser = existingSession.user;
      } else {
        const validationRes = authValidation(fields);
        console.log('validationRes', validationRes);

        if (Object.keys(validationRes).length) {
          errors = Object.assign(errors, validationRes);
          loading = false;
          return;
        }

        const {
          data: signUpData,
          error
        } = await supabase.auth.signUp({
          email: fields.email,
          password: fields.password,
          options: {
            data: { role: selectedRole },
            emailRedirectTo: `${window.location.origin}/login`
          }
        });
        console.log('signUpData', signUpData);

        if (error) throw error;

        const newUser = signUpData.user;
        if (!newUser) {
          throw new Error('Registration failed. Please try again.');
        }
        authUser = newUser;

        // If email confirmation is required, show success and wait for verification.
        // Profile & membership will be created automatically after verification
        // in getProfile() using the role stored in user_metadata.
        if (!signUpData.session) {
          success = true;
          loading = false;
          return;
        }
      }

      const [regexUsernameMatch] = [...(authUser.email?.matchAll(/(.*)@/g) || [])];

      // If already logged in, profile may exist (created by getProfile). Try upsert.
      const profileRes = await supabase
        .from('profile')
        .upsert({
          id: authUser.id,
          username: regexUsernameMatch[1] + `${new Date().getTime()}`,
          fullname: regexUsernameMatch[1],
          email: authUser.email
        }, { onConflict: 'id' })
        .select();
      console.log('profileRes', profileRes);

      if (profileRes.error) {
        throw profileRes.error;
      }

      // Setting profile
      console.log('setting profile', profileRes.data[0]);
      profile.set(profileRes.data[0]);

      // Resolve org for single-org mode
      let orgIdToJoin = $currentOrg.id;
      if (isSingleOrgMode() && !orgIdToJoin) {
        const siteName = getSingleOrgSiteName();
        if (siteName) {
          const orgData = await getCurrentOrg(siteName, true);
          orgIdToJoin = orgData?.id || '';
          if (orgData?.id) {
            currentOrg.update((o) => ({ ...o, id: orgData.id, siteName: orgData.siteName, name: orgData.name }));
          }
        }
      }

      // Fallback: query first available org from DB
      if (!orgIdToJoin) {
        const { data: firstOrg, error: orgQueryError } = await supabase
          .from('organization')
          .select('id, siteName, name')
          .limit(1)
          .single();

        if (orgQueryError || !firstOrg) {
          throw new Error('Organization is not configured. Please contact administrator.');
        }

        orgIdToJoin = firstOrg.id;
        currentOrg.update((o) => ({
          ...o,
          id: firstOrg.id,
          siteName: firstOrg.siteName,
          name: firstOrg.name
        }));
      }

      // Determine role and redirect based on selection
      const roleId = selectedRole === 'teacher' ? ROLE.TUTOR : ROLE.STUDENT;
      const targetRoute = selectedRole === 'teacher' ? '/teacher-pending' : '/lms';
      const isVerified = selectedRole === 'teacher' ? false : true;

      // Auto-join the org with selected role (upsert in case user already has a membership)
      const { error: memberError } = await supabase
        .from('organizationmember')
        .upsert({
          organization_id: orgIdToJoin,
          profile_id: authUser.id,
          role_id: roleId,
          verified: isVerified
        }, { onConflict: 'organization_id,profile_id' })
        .select();
      if (memberError) {
        console.error('Error auto-joining org on signup:', memberError);
      }

      capturePosthogEvent('user_signed_up', {
        distinct_id: $profile.id || '',
        email: authUser.email,
        username: regexUsernameMatch[1],
        role: selectedRole
      });

      if ($globalStore.isOrgSite && selectedRole === 'student') {
        capturePosthogEvent('student_signed_up', {
          distinct_id: $profile.id || '',
          email: authUser.email,
          username: regexUsernameMatch[1]
        });
      }

      if (redirect) {
        goto(redirect);
      } else {
        goto(targetRoute);
      }

      formRef?.reset();
      success = true;
      fields = Object.assign({}, SIGNUP_FIELDS);
    } catch (error: any) {
      submitError = error?.error_description || error?.message;
      loading = false;
    }
  }

  $: errors.confirmPassword = getConfirmPasswordError(fields);
  $: disableSubmit = getDisableSubmit(fields);
</script>

<svelte:head>
  <title>Join {BRAND.name}</title>
</svelte:head>

<AuthUI {supabase} isLogin={false} {handleSubmit} isLoading={loading} bind:formRef>
  <div class="mt-4 w-full">
    {#if success}
      <div class="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
        <p class="text-lg font-semibold text-green-700 dark:text-green-300">
          {$t('signup.confirm_email_sent')}
        </p>
        <p class="mt-2 text-sm text-green-600 dark:text-green-400">
          {$t('signup.check_email_to_verify')}
        </p>
        <a
          href="/login"
          class="mt-4 inline-block rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
        >
          {$t('login.login')}
        </a>
      </div>
    {:else if !selectedRole}
      <!-- Step 1: Role Selection -->
      <p class="mb-6 text-lg font-semibold dark:text-white text-center">
        {$t('signup.choose_role')}
      </p>
      <div class="flex flex-col gap-4">
        <button
          type="button"
          on:click={() => selectRole('student')}
          class="flex items-center gap-4 rounded-lg border-2 border-gray-200 p-5 text-left transition hover:border-primary-700 hover:bg-primary-50 dark:border-neutral-600 dark:hover:border-primary-500 dark:hover:bg-neutral-800"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <div>
            <p class="text-lg font-bold dark:text-white">{$t('signup.student')}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {$t('signup.student_desc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          on:click={() => selectRole('teacher')}
          class="flex items-center gap-4 rounded-lg border-2 border-gray-200 p-5 text-left transition hover:border-primary-700 hover:bg-primary-50 dark:border-neutral-600 dark:hover:border-primary-500 dark:hover:bg-neutral-800"
        >
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <p class="text-lg font-bold dark:text-white">{$t('signup.teacher')}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {$t('signup.teacher_desc')}
            </p>
          </div>
        </button>
      </div>
    {:else}
      <!-- Step 2: Registration Form -->
      <div class="mb-4 flex items-center gap-2">
        {#if !isStudentInvite}
          <button
            type="button"
            on:click={() => { selectedRole = ''; errors = {}; submitError = ''; }}
            class="text-sm text-primary-700 hover:underline dark:text-primary-400"
          >
            &larr; {$t('signup.back_to_role')}
          </button>
          <span class="text-sm text-gray-400">|</span>
        {/if}
        <span class="text-sm font-medium text-primary-700 dark:text-primary-400 capitalize">
          {selectedRole === 'student' ? $t('signup.student') : $t('signup.teacher')}
        </span>
      </div>

      <p class="mb-6 text-lg font-semibold dark:text-white">{$t('login.create_to_join')}</p>
      <TextField
        label={$t('login.fields.email')}
        bind:value={fields.email}
        type="email"
        placeholder="you@domain.com"
        className="mb-6"
        inputClassName="w-full"
        isDisabled={loading}
        errorMessage={$t(errors.email ?? '')}
        isRequired
      />
      <TextField
        label={$t('login.fields.password')}
        bind:value={fields.password}
        type="password"
        placeholder="************"
        className="mb-6"
        inputClassName="w-full"
        isDisabled={loading}
        errorMessage={$t(errors.password ?? '')}
        helperMessage={$t('login.fields.password_helper_message')}
        isRequired
      />
      <TextField
        label={$t('login.fields.confirm_password')}
        bind:value={fields.confirmPassword}
        type="password"
        placeholder="************"
        className="mb-6"
        inputClassName="w-full"
        isDisabled={loading}
        errorMessage={errors.confirmPassword}
        isRequired
      />
      {#if submitError}
        <p class="text-sm text-red-500">{submitError}</p>
      {/if}

      <div class="my-4 flex w-full items-center justify-end">
        <PrimaryButton
          label={$t('login.create_account')}
          type="submit"
          className="sm:w-full w-full"
          isDisabled={disableSubmit || loading}
          isLoading={loading}
        />
      </div>
    {/if}
  </div>
</AuthUI>
