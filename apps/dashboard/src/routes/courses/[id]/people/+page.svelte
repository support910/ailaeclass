<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Avatar from '$lib/components/Avatar/index.svelte';
  import TextChip from '$lib/components/Chip/Text.svelte';
  import ComingSoon from '$lib/components/ComingSoon/index.svelte';
  import DeleteConfirmation from '$lib/components/Course/components/People/DeleteConfirmation.svelte';
  import InvitationModal from '$lib/components/Course/components/People/InvitationModal.svelte';
  import { deleteMemberModal } from '$lib/components/Course/components/People/store';
  import type { ProfileRole } from '$lib/components/Course/components/People/types';
  import { course, group } from '$lib/components/Course/store';
  import Select from '$lib/components/Form/Select.svelte';
  import IconButton from '$lib/components/IconButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import RoleBasedSecurity from '$lib/components/RoleBasedSecurity/index.svelte';
  import { ROLE, ROLE_LABEL, ROLES } from '$lib/utils/constants/roles';
  import { t } from '$lib/utils/functions/translations';
  import {
    addCourseMember,
    addCourseStudent,
    deleteGroupMember,
    fetchCourseMemberOptions,
    fetchJoinRequests
  } from '$lib/utils/services/courses';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { profile } from '$lib/utils/store/user';
  import { isOrgAdmin } from '$lib/utils/store/org';
  import type { GroupPerson } from '$lib/utils/types';
  import {
    CopyButton,
    Search,
    StructuredList,
    StructuredListBody,
    StructuredListCell,
    StructuredListHead,
    StructuredListRow
  } from 'carbon-components-svelte';
  import TrashCanIcon from 'carbon-icons-svelte/lib/TrashCan.svelte';
  import { onMount } from 'svelte';

  let people: Array<GroupPerson> = [];
  let member: { id?: string; email?: string; profile?: { email: string } } = {};
  let filterBy: ProfileRole = ROLES[0];
  let searchValue = '';
  let joinRequests: any[] = [];
  let isLoadingRequests = false;
  let studentEmail = '';
  let isAddingStudent = false;
  let memberOptions: Array<{ id: string; fullname: string; email: string; role_id: number }> = [];
  let selectedTeacherId = '';
  let selectedStudentId = '';
  let isAddingMember = false;

  async function loadJoinRequests() {
    if (!$course?.id) return;
    isLoadingRequests = true;
    const { data } = await fetchJoinRequests($course.id, 'pending');
    joinRequests = data || [];
    isLoadingRequests = false;
  }

  onMount(async () => {
    loadJoinRequests();
    if ($course?.id) {
      const { data } = await fetchCourseMemberOptions($course.id);
      memberOptions = data || [];
    }
  });

  async function handleAddSelectedMember(roleId: number, profileId: string) {
    if (!profileId || !$course?.id) return;
    isAddingMember = true;
    const { data, error } = await addCourseMember($course.id, { profileId, roleId });
    isAddingMember = false;
    if (error) {
      snackbar.error(error.message || 'Failed to add course member');
      return;
    }
    $group.people = [data, ...($group.people || [])];
    memberOptions = memberOptions.filter((option) => option.id !== profileId);
    if (roleId === ROLE.TUTOR) selectedTeacherId = '';
    else selectedStudentId = '';
    snackbar.success(roleId === ROLE.TUTOR ? 'Teacher assigned to this course.' : 'Student added to this course.');
  }

  function filterPeople(_query, people) {
    const query = _query.toLowerCase();
    return people.filter((person) => {
      const { profile, email } = person;
      return profile?.fullname?.toLowerCase()?.includes(query) || email?.includes(query);
    });
  }

  async function deletePerson() {
    if (!member.id) return;
    const { error } = await deleteGroupMember(member.id, $course.id);
    if (error) {
      snackbar.error(error.message || 'Failed to remove student');
      return;
    }

    $group.people = $group.people.filter((person: { id: string }) => person.id !== member.id);
    $group.tutors = $group.tutors.filter((person: GroupPerson) => person.memberId !== member.id);
  }

  async function handleAddStudent() {
    const email = studentEmail.trim();
    if (!email || !email.includes('@') || !$course?.id) {
      snackbar.error('Please enter a valid student email.');
      return;
    }

    isAddingStudent = true;
    const { data, error } = await addCourseStudent($course.id, email);
    isAddingStudent = false;

    if (error) {
      snackbar.error(error.message || 'Failed to add student');
      return;
    }

    $group.people = [data, ...($group.people || [])];
    studentEmail = '';
    snackbar.success('Student added to this course.');
  }

  function sortAndFilterPeople(_people: Array<GroupPerson>, filterBy: ProfileRole) {
    people = (_people || [])
      .filter((person) => {
        if (filterBy.value === 'all') return true;

        return person.role_id === filterBy.value;
      })
      .sort(
        (a: GroupPerson, b: GroupPerson) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .sort((a: GroupPerson, b: GroupPerson) => a.role_id - b.role_id);
  }

  function getEmail(person) {
    const { profile, email } = person;

    return profile ? profile.email : email;
  }

  function formatRequestDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  function obscureEmail(email) {
    const [username, domain] = email.split('@');
    const obscuredUsername =
      username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);

    return `${obscuredUsername}@${domain}`;
  }

  function gotoPerson(person) {
    goto(`${$page.url.href}/${person.profile_id}`);
  }

  $: sortAndFilterPeople($group.people, filterBy);
</script>

<InvitationModal />

<DeleteConfirmation
  email={member.email || (member.profile && member.profile.email)}
  {deletePerson}
/>

<section class="mx-2 my-5 md:mx-9">
  <!-- Join Code Display -->
  <RoleBasedSecurity allowedRoles={[1, 2]}>
    {#if $course?.join_code}
      <div class="mb-6 rounded-lg bg-primary-50 p-4 dark:bg-neutral-800">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-primary-700 dark:text-primary-300">
              {$t('course.people.course_code')}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {$t('course.people.course_code_desc')}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="rounded-md bg-white px-3 py-1.5 text-lg font-bold tracking-widest text-primary-700 shadow-sm dark:bg-neutral-700 dark:text-primary-300"
            >
              {$course.join_code}
            </span>
            <CopyButton text={$course.join_code} feedback="Copied!" />
          </div>
        </div>
      </div>
    {/if}
  </RoleBasedSecurity>

  <RoleBasedSecurity allowedRoles={[1, 2]}>
    {#if $isOrgAdmin}
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <p class="mb-3 text-sm font-semibold text-gray-700 dark:text-white">{$t('courses.management.teacher_management')}</p>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400" for="course-teacher">{$t('courses.management.assign_teachers')}</label>
            <div class="flex gap-2">
              <select id="course-teacher" bind:value={selectedTeacherId} class="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                <option value="">{$t('courses.management.select_teacher')}</option>
                {#each memberOptions.filter((option) => option.role_id === ROLE.TUTOR) as option}
                  <option value={option.id}>{option.fullname} ({option.email})</option>
                {/each}
              </select>
              <PrimaryButton label={$t('courses.management.assign')} onClick={() => handleAddSelectedMember(ROLE.TUTOR, selectedTeacherId)} isDisabled={!selectedTeacherId || isAddingMember} isLoading={isAddingMember} />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400" for="course-student">{$t('courses.management.add_org_student')}</label>
            <div class="flex gap-2">
              <select id="course-student" bind:value={selectedStudentId} class="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white">
                <option value="">{$t('courses.management.select_student')}</option>
                {#each memberOptions.filter((option) => option.role_id === ROLE.STUDENT) as option}
                  <option value={option.id}>{option.fullname} ({option.email})</option>
                {/each}
              </select>
              <PrimaryButton label={$t('courses.management.add')} onClick={() => handleAddSelectedMember(ROLE.STUDENT, selectedStudentId)} isDisabled={!selectedStudentId || isAddingMember} isLoading={isAddingMember} />
            </div>
          </div>
        </div>
      </div>
    {/if}
    <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <p class="mb-3 text-sm font-semibold text-gray-700 dark:text-white">
        添加学生
      </p>
      <div class="flex flex-col gap-3 md:flex-row md:items-end">
        <div class="flex-1">
          <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400" for="student-email">
            学生邮箱
          </label>
          <input
            id="student-email"
            class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            placeholder="student@example.com"
            bind:value={studentEmail}
          />
        </div>
        <PrimaryButton
          label="添加到课程"
          onClick={handleAddStudent}
          isLoading={isAddingStudent}
          isDisabled={isAddingStudent}
        />
      </div>
    </div>
  </RoleBasedSecurity>

  <!-- Course applications are informational only. Membership remains teacher/admin managed. -->
  <RoleBasedSecurity allowedRoles={[1, 2]}>
    {#if joinRequests.length > 0}
      <div class="mb-6 border-l-4 border-amber-400 bg-amber-50 px-4 py-4 dark:bg-amber-950/20">
        <div class="mb-3 flex items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold dark:text-white">{$t('course.people.course_applications')}</h3>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{$t('course.people.application_notice')}</p>
          </div>
          <span class="rounded bg-amber-200 px-2.5 py-1 text-sm font-semibold text-amber-900">{joinRequests.length}</span>
        </div>
        <div class="divide-y divide-amber-200 border-y border-amber-200 dark:divide-amber-900 dark:border-amber-900">
          {#each joinRequests as request}
            <div class="flex items-center justify-between gap-4 py-4">
              <div class="flex items-center gap-3">
                <Avatar
                  src={request.profile?.avatar_url}
                  name={request.profile?.fullname}
                  width="w-8"
                  height="h-8"
                />
                <div>
                  <p class="font-medium dark:text-white">{request.profile?.fullname || '-'}</p>
                  <p class="text-xs text-gray-500">{request.profile?.email || ''}</p>
                </div>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-xs font-medium text-amber-800 dark:text-amber-300">{$t('course.people.application_received')}</p>
                <p class="mt-1 text-xs text-gray-500">{formatRequestDate(request.created_at)}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else if !isLoadingRequests}
      <div class="mb-6 rounded-lg border border-dashed border-gray-200 p-4 dark:border-neutral-700">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {$t('course.people.no_applications')}
        </p>
      </div>
    {/if}
  </RoleBasedSecurity>

  <div
    class="flex-end mb-7 flex flex-col items-start justify-end gap-2 md:flex-row md:items-center"
  >
    <div class="max-w-[320px]">
      <Search
        class="w-full border-0 bg-zinc-100 dark:text-slate-950"
        placeholder={$t('course.navItem.people.search')}
        bind:value={searchValue}
      />
    </div>
    <div class="mb-3">
      <Select
        bind:value={filterBy}
        options={ROLES.map((role) => ({ label: $t(role.label), value: role.value }))}
        className="dark:text-black mt-3 max-w-[80px]"
      />
      <!-- <select bind:value={filterBy} class="mt-3">
        {#each ROLES as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select> -->
    </div>
    <RoleBasedSecurity allowedRoles={[1, 2]}>
      <p class="hidden w-20 text-lg lg:block dark:text-white" />
    </RoleBasedSecurity>
  </div>

  <StructuredList class="m-0">
    <StructuredListHead
      class="bg-slate-100 dark:border-2 dark:border-neutral-800 dark:bg-neutral-800"
    >
      <StructuredListRow head class="mx-7">
        <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
          >{$t('course.navItem.people.name')}</StructuredListCell
        >
        <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
          >{$t('course.navItem.people.role')}</StructuredListCell
        >
        <StructuredListCell head class="text-primary-700 py-3 dark:text-white"
          >{$t('course.navItem.people.action')}</StructuredListCell
        >
        <RoleBasedSecurity allowedRoles={[1, 2]}>
          <p class="hidden w-20 text-lg lg:block dark:text-white" />
        </RoleBasedSecurity>
      </StructuredListRow>
    </StructuredListHead>

    {#each filterPeople(searchValue, people) as person}
      <StructuredListBody>
        <StructuredListRow class="relative">
          <!-- first column -->
          <StructuredListCell class="w-4/6 md:w-3/6">
            {#if person.profile}
              <div class="flex items-start lg:items-center">
                <Avatar
                  src={person.profile.avatar_url}
                  name={person.profile.fullname}
                  width="w-8"
                  height="h-8"
                  className="mr-3"
                />
                <div class="flex flex-col items-start lg:flex-row lg:items-center">
                  <div class="mr-2">
                    <p class="text-base font-normal dark:text-white">
                      {person.profile.fullname}
                    </p>
                    <p class="text-primary-600 line-clamp-1 text-xs">
                      {obscureEmail(getEmail(person))}
                    </p>
                  </div>
                  <div class="flex items-center">
                    <RoleBasedSecurity allowedRoles={[1, 2]}>
                      <CopyButton text={getEmail(person)} feedback="Copied Email to clipboard" />
                    </RoleBasedSecurity>
                    {#if person.profile_id == $profile.id}
                      <ComingSoon label={$t('course.navItem.people.you')} />
                    {/if}
                  </div>
                </div>
              </div>
            {:else}
              <div class="flex w-2/4 items-start lg:items-center">
                <TextChip
                  value={person.email.substring(0, 2).toUpperCase()}
                  className="bg-primary-200 text-black font-semibold text-xs mr-3"
                  shape="rounded-full"
                />
                <a
                  href="mailto:{person.email}"
                  class="text-md text-primary-600 mr-2 dark:text-white"
                >
                  {person.email}
                </a>
                <div class="flex items-center justify-between">
                  <RoleBasedSecurity allowedRoles={[1, 2]}>
                    <CopyButton
                      text={getEmail(person)}
                      feedback={$t('course.navItem.people.feedback')}
                    />
                  </RoleBasedSecurity>

                  <TextChip
                    value={$t('course.navItem.people.pending')}
                    className="text-xs bg-yellow-200 text-yellow-700 h-fit"
                    size="sm"
                  />
                </div>
              </div>
            {/if}
          </StructuredListCell>

          <!-- second column -->
          <StructuredListCell class="w-1/4">
            <p class=" w-1/4 text-center text-base font-normal dark:text-white">
              {$t(ROLE_LABEL[person.role_id])}
            </p>
          </StructuredListCell>

          <!-- third column -->
          <StructuredListCell class="w-1/4 p-0">
            <RoleBasedSecurity allowedRoles={[1, 2]}>
              <div class="hidden space-x-2 sm:flex sm:items-center">
                {#if person.profile_id !== $profile.id && (person.role_id === ROLE.STUDENT || ($isOrgAdmin && person.role_id === ROLE.TUTOR))}
                  <IconButton
                    onClick={() => {
                      member = person;
                      $deleteMemberModal.open = true;
                    }}
                  >
                    <TrashCanIcon size={16} class="carbon-icon dark:text-white" />
                  </IconButton>
                  <!-- <IconButton
                    onClick={() => gotoPerson(person)}
                  >
                    <TrashCanIcon size={16} class="carbon-icon dark:text-white" />
                  </IconButton> -->

                  <PrimaryButton
                    variant={VARIANTS.OUTLINED}
                    label={$t('course.navItem.people.view')}
                    onClick={() => gotoPerson(person)}
                  />
                {:else if person.profile_id !== $profile.id}
                  <PrimaryButton
                    variant={VARIANTS.OUTLINED}
                    label={$t('course.navItem.people.view')}
                    onClick={() => gotoPerson(person)}
                  />
                {/if}
              </div>
            </RoleBasedSecurity>
          </StructuredListCell>
        </StructuredListRow>
      </StructuredListBody>
    {/each}
  </StructuredList>
  <!-- <Pagination totalItems={10} pageSizes={[10, 15, 20]} /> -->
</section>
