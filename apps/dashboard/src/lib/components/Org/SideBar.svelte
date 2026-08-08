<script lang="ts">
  import { page } from '$app/stores';
  import Avatar from '$lib/components/Avatar/index.svelte';
  import AudienceIcon from '$lib/components/Icons/AudienceIcon.svelte';
  import CourseIcon from '$lib/components/Icons/CourseIcon.svelte';
  import HomeIcon from '$lib/components/Icons/HomeIcon.svelte';
  import QuizIcon from '$lib/components/Icons/QuizIcon.svelte';
  import SiteSettingsIcon from '$lib/components/Icons/SiteSettingsIcon.svelte';
  import OrgSelector from '$lib/components/OrgSelector/OrgSelector.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import Modal from '$lib/components/Modal/index.svelte';
  import { currentOrgPath, currentOrg } from '$lib/utils/store/org';
  import { ROLE } from '$lib/utils/constants/roles';
  import { ChevronDown, ChevronRight, ChevronUp, SettingsAdjust } from 'carbon-icons-svelte';
  import ForumIcon from 'carbon-icons-svelte/lib/Forum.svelte';
  import HelpIcon from 'carbon-icons-svelte/lib/Help.svelte';
  import Chat from 'carbon-icons-svelte/lib/Chat.svelte';

  import ProfileMenu from '$lib/components/Org/ProfileMenu/index.svelte';
  import { NavClasses } from '$lib/utils/constants/reusableClass';
  import { t } from '$lib/utils/functions/translations';
  import { isOrgAdmin } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { profileMenu, sideBar } from './store';
  import { isSingleOrgMode } from '$lib/utils/config/singleOrg';
  import TextChip from '$lib/components/Chip/Text.svelte';
  import TaskIcon from 'carbon-icons-svelte/lib/Task.svelte';
  import JoinIcon from 'carbon-icons-svelte/lib/Education.svelte';
  import LicenseDraft from 'carbon-icons-svelte/lib/LicenseDraft.svelte';
  import Explore from 'carbon-icons-svelte/lib/Explore.svelte';
  import Wallet from 'carbon-icons-svelte/lib/Wallet.svelte';
  import ChartPie from 'carbon-icons-svelte/lib/ChartPie.svelte';
  import { SUPER_ADMIN_EMAIL } from '$lib/utils/constants/admin';
  import { locale } from '$lib/utils/functions/translations';

  interface menuItems {
    label: string;
    path: string;
    show: boolean;
    isActive: boolean;
    /** which collapsible section this belongs to; undefined = pinned at the top */
    group?: string;
  }

  // Grouping only changes how the 13 entries are PRESENTED. Every path stays
  // exactly as it was, so no route, guard or deep link changes behaviour.
  const GROUP_ORDER = ['teaching', 'intelligence', 'operations', 'support'] as const;
  const GROUP_LABEL: Record<string, { zh: string; hant: string; en: string }> = {
    teaching: { zh: '教学', hant: '教學', en: 'Teaching' },
    intelligence: { zh: '智能中心', hant: '智能中心', en: 'Intelligence' },
    operations: { zh: '运营', hant: '營運', en: 'Operations' },
    support: { zh: '帮助与设置', hant: '幫助與設定', en: 'Help & settings' }
  };
  $: groupLabel = (id: string) => {
    const l = GROUP_LABEL[id];
    if (!l) return id;
    if ($locale === 'zh') return l.zh;
    if (String($locale).toLowerCase().includes('zh')) return l.hant;
    return l.en;
  };

  // Sections remember their own open/closed state; the one containing the current
  // page is forced open so the active item is never hidden.
  let groupOpen: Record<string, boolean> = { teaching: true, intelligence: false, operations: false, support: false };
  let groupTouched: Record<string, boolean> = {};
  function toggleGroup(id: string) {
    groupTouched[id] = true;
    groupOpen[id] = !groupOpen[id];
    groupOpen = { ...groupOpen };
  }

  interface FutureMenuItem {
    label: string;
    path: string;
    icon: any;
  }

  let menuItems: menuItems[] = [];
  let showHelpModal = false;
  let futureExpanded = false;
  $: futureOrgItems =
    $currentOrg.role_id === ROLE.ADMIN || $currentOrg.role_id === ROLE.TUTOR
      ? futureManagementItems
      : [];
  $: futureOrgTitle =
    $currentOrg.role_id === ROLE.ADMIN
      ? $t('org_navigation.future.admin_title')
      : $t('org_navigation.future.teacher_title');
  $: dataCockpitLabel = $locale === 'zh'
    ? '数据驾驶舱'
    : String($locale).toLowerCase().includes('zh')
      ? '數據駕駛艙'
      : 'Data cockpit';

  const futureManagementItems: FutureMenuItem[] = [
    { label: 'org_navigation.future.principal_dashboard', path: '/coming-soon/principal-dashboard', icon: Explore },
    { label: 'org_navigation.future.class_management', path: '/coming-soon/class-management', icon: JoinIcon },
    { label: 'org_navigation.future.grade_analysis', path: '/coming-soon/grade-analysis', icon: TaskIcon },
    { label: 'org_navigation.future.attendance_discipline', path: '/coming-soon/attendance-discipline', icon: TaskIcon },
    { label: 'org_navigation.future.ai_comments_recommendation', path: '/coming-soon/ai-comments-recommendation', icon: Chat },
    { label: 'org_navigation.future.academic_notice', path: '/coming-soon/academic-notice', icon: LicenseDraft },
    { label: 'org_navigation.future.ai_academic_report', path: '/coming-soon/ai-academic-report', icon: LicenseDraft },
    { label: 'org_navigation.future.exam_plan', path: '/coming-soon/exam-plan', icon: TaskIcon },
    { label: 'org_navigation.future.course_resource_center', path: '/coming-soon/course-resource-center', icon: LicenseDraft }
  ];

  function isActive(pagePath: string, itemPath: string) {
    const pageLinkItems = pagePath.split('/');
    const itemLinkItems = itemPath.split('/');

    if (itemLinkItems.length !== pageLinkItems.length) {
      return false;
    }

    return pagePath.includes(itemPath);
  }
  const toggleSidebar = () => {
    $sideBar.hidden = !$sideBar.hidden;
  };

  $: visibleItems = menuItems.filter((m) => m.show);
  $: itemsInGroup = (g) => visibleItems.filter((m) => m.group === g);
  // never hide the section the user is currently inside
  $: activeGroup = visibleItems.find((m) => m.isActive && m.group)?.group || '';
  $: isGroupOpen = (g) => (activeGroup === g && !groupTouched[g]) || groupOpen[g];

  $: menuItems = [
    {
      path: '',
      label: $t('org_navigation.dashboard'),
      isActive: isActive($page.url.pathname, `${$currentOrgPath}`),
      show: true
    },
    {
      path: '/courses',
      group: 'teaching',
      label: $t('org_navigation.courses'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/courses`),
      show: true
    },
    {
      path: '/join-course',
      group: 'teaching',
      label: $t('org_navigation.join_course'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/join-course`),
      show: $currentOrg.role_id === ROLE.STUDENT
    },
    {
      path: '/exams',
      group: 'teaching',
      label: $t('org_navigation.exams'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/exams`),
      show: true
    },
    {
      path: '/community',
      group: 'teaching',
      label: $t('org_navigation.community'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/community`),
      show: true
    },
    {
      path: '/ai-tools',
      group: 'intelligence',
      label: $t('org_navigation.ai_tools'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/ai-tools`),
      show: true
    },
    {
      path: '/agent',
      group: 'intelligence',
      label: $t('org_navigation.agent'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/agent`),
      show: true
    },
    {
      path: '/simulator',
      group: 'intelligence',
      label: $t('org_navigation.simulator'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/simulator`),
      show: true
    },
    {
      path: '/payment',
      group: 'operations',
      label: $t('payment.navigation'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/payment`),
      show: true
    },
    {
      path: '/guide',
      group: 'support',
      label: $t('org_navigation.guide'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/guide`),
      show: true
    },
    {
      path: '/audience',
      group: 'operations',
      label: $t('org_navigation.audience'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/audience`),
      show: $isOrgAdmin
    },
    {
      path: '/data-cockpit',
      group: 'operations',
      label: dataCockpitLabel,
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/data-cockpit`),
      show: $isOrgAdmin === true && ($profile.email || '').toLowerCase() === SUPER_ADMIN_EMAIL
    },
    {
      path: '/setup',
      group: 'support',
      label: $t('org_navigation.setup'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/setup`),
      show: $isOrgAdmin
    },
    {
      path: '/feedback',
      group: 'support',
      label: $t('feedback.navigation'),
      isActive: $page.url.pathname.includes(`${$currentOrgPath}/feedback`),
      show: true
    }
  ];
</script>

<div bind:this={$profileMenu.ref} class="static md:relative">
  <aside
    class={`${
      $sideBar.hidden
        ? 'absolute top-[48px] z-40 -translate-x-[100%] md:relative md:top-0 md:translate-x-0'
        : 'absolute top-[48px] z-40 translate-x-0 md:relative md:top-0'
    } border-r-1 h-[calc(100vh-48px)] w-[250px] min-w-[250px] overflow-y-auto border border-b-0 border-l-0 border-t-0 border-gray-100 bg-gray-100 transition dark:border-neutral-600 dark:bg-neutral-900`}
  >
    <div class="flex h-full flex-col">
      <div class="">
        {#if isSingleOrgMode()}
          <!-- Single-org: show org name statically (no dropdown) -->
          <div class="px-4 py-3 border border-l-0 border-r-0 border-t-0 border-gray-200 dark:border-neutral-600">
            <div class="flex items-center gap-2">
              <img src="/logo-512.png" alt={$currentOrg.name || 'Organization'} class="w-7 h-7 rounded-md object-contain" />
              <p class="dark:text-white text-sm font-medium whitespace-nowrap truncate">
                {$currentOrg.name || 'Organization'}
              </p>
            </div>
          </div>
        {:else}
          <OrgSelector />
        {/if}

        <ul class="my-2 mt-4 px-4">
          {#each visibleItems.filter((m) => !m.group) as menuItem}
            {#if menuItem.show}
              <a
                href="{$currentOrgPath}{menuItem.path}"
                class="text-black no-underline"
                on:click={toggleSidebar}
              >
                <li
                  class="mb-1 flex items-center gap-2.5 px-2.5 py-2 {NavClasses.item} {menuItem.isActive
                    ? NavClasses.active
                    : 'dark:text-white'}"
                >
                  {#if menuItem.path === ''}
                    <HomeIcon />
                  {:else if menuItem.path === '/courses'}
                    <CourseIcon />
                  {:else if menuItem.path === '/site'}
                    <SiteSettingsIcon />
                  {:else if menuItem.path === '/community'}
                    <ForumIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {:else if menuItem.path === '/ai-tools'}
                    <Chat size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {:else if menuItem.path === '/agent'}
                    <Chat size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {:else if menuItem.path === '/simulator'}
                    <TaskIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {:else if menuItem.path === '/payment'}
                    <Wallet size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {:else if menuItem.path === '/guide'}
                    <HelpIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {:else if menuItem.path === '/quiz'}
                    <QuizIcon />
                  {:else if menuItem.path === '/exams'}
                    <TaskIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {:else if menuItem.path === '/audience'}
                    <AudienceIcon />
                  {:else if menuItem.path === '/data-cockpit'}
                    <ChartPie size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {:else if menuItem.path === '/join-course'}
                    <JoinIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {:else if menuItem.path === '/setup'}
                    <SettingsAdjust />
                  {:else if menuItem.path === '/feedback'}
                    <ForumIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                  {/if}
                  <p class="text-sm font-medium">{menuItem.label}</p>
                </li>
              </a>
            {/if}
          {/each}
        </ul>

        {#each GROUP_ORDER as gid}
          {#if itemsInGroup(gid).length}
            <div class="mt-1 px-4">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left hover:bg-gray-200 dark:hover:bg-neutral-800"
                aria-expanded={isGroupOpen(gid)}
                on:click={() => toggleGroup(gid)}
              >
                <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  {groupLabel(gid)}
                </span>
                <span class="flex items-center gap-1">
                  {#if activeGroup === gid && !isGroupOpen(gid)}
                    <span class="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  {/if}
                  {#if isGroupOpen(gid)}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
                </span>
              </button>
              {#if isGroupOpen(gid)}
                <ul class="mb-1 mt-1">
                  {#each itemsInGroup(gid) as menuItem}
                    <a
                      href="{$currentOrgPath}{menuItem.path}"
                      class="text-black no-underline"
                      on:click={toggleSidebar}
                    >
                      <li
                        class="mb-1 flex items-center gap-2.5 py-2 pl-4 pr-2.5 {NavClasses.item} {menuItem.isActive
                          ? NavClasses.active
                          : 'dark:text-white'}"
                      >
                        {#if menuItem.path === '/courses'}<CourseIcon />
                        {:else if menuItem.path === '/community'}<ForumIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {:else if menuItem.path === '/ai-tools'}<Chat size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {:else if menuItem.path === '/agent'}<Chat size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {:else if menuItem.path === '/simulator'}<TaskIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {:else if menuItem.path === '/payment'}<Wallet size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {:else if menuItem.path === '/guide'}<HelpIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {:else if menuItem.path === '/exams'}<TaskIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {:else if menuItem.path === '/audience'}<AudienceIcon />
                        {:else if menuItem.path === '/data-cockpit'}<ChartPie size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {:else if menuItem.path === '/join-course'}<JoinIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {:else if menuItem.path === '/setup'}<SettingsAdjust />
                        {:else if menuItem.path === '/feedback'}<ForumIcon size={20} class="carbon-icon fill-[#000] dark:fill-[#fff]" />
                        {/if}
                        <p class="text-sm font-medium">{menuItem.label}</p>
                      </li>
                    </a>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        {/each}

        {#if futureOrgItems.length}
          <div class="mt-3 border-t border-gray-200 px-4 pt-3 dark:border-neutral-700">
            <button
              type="button"
              class="mb-2 flex w-full items-center justify-between rounded px-2.5 py-2 text-left hover:bg-gray-200 dark:hover:bg-neutral-800"
              aria-expanded={futureExpanded}
              on:click={() => (futureExpanded = !futureExpanded)}
            >
              <span class="min-w-0">
                <span class="block truncate text-xs font-semibold text-gray-500 dark:text-neutral-300">{futureOrgTitle}</span>
                <TextChip value={$t('org_navigation.future.unavailable')} size="sm" className="mt-1 text-xs text-gray-600" />
              </span>
              {#if futureExpanded}<ChevronUp size={18} />{:else}<ChevronDown size={18} />{/if}
            </button>
            {#if futureExpanded}
              <ul>
                {#each futureOrgItems as item}
                <a
                  href="{$currentOrgPath}{item.path}"
                  class="text-black no-underline"
                  on:click={toggleSidebar}
                >
                  <li
                    class="mb-1 flex cursor-pointer items-center gap-2.5 px-2.5 py-2 {NavClasses.item} {$page.url.pathname.includes(
                      `${$currentOrgPath}${item.path}`
                    )
                      ? NavClasses.active
                      : 'text-gray-500 dark:text-neutral-300'}"
                  >
                    <svelte:component this={item.icon} size={20} class="carbon-icon dark:fill-[#fff]" />
                    <p class="truncate text-sm font-medium">{$t(item.label)}</p>
                  </li>
                </a>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </div>
      <span class="flex-grow" />

      <ul class="my-5 px-4 pb-5">
        <button class="w-full text-left" on:click={() => (showHelpModal = true)}>
          <li class="mb-2 flex items-center rounded px-2.5 py-1.5 cursor-pointer">
            <HelpIcon size={20} class="carbon-icon dark:text-white" />
            <p class="ml-2.5 text-sm font-medium dark:text-white">{$t('org_navigation.help')}</p>
          </li>
        </button>

        <button
          class="w-full"
          on:click={() => {
            $profileMenu.open = !$profileMenu.open;
            $sideBar.hidden = true;
          }}
        >
          <div
            class="mb-2 flex cursor-pointer items-center justify-between gap-2.5 px-2.5 py-2 text-black no-underline {NavClasses.item} {$page.url.pathname.includes(
              'settings'
            )
              ? NavClasses.active
              : 'dark:text-white'}"
          >
            <div class="flex w-full items-center justify-start space-x-1 text-start">
              <Avatar
                src={$profile.avatar_url}
                name={$profile.username}
                width="w-[1.2rem]"
                height="h-[1.2rem]"
              />
              <p class="max-w-full truncate text-sm font-medium dark:text-white">
                {$profile.fullname}
              </p>
            </div>
            <div>
              <ChevronRight />
            </div>
          </div>
        </button>
      </ul>
    </div>
  </aside>

  <ProfileMenu />

  <Modal open={showHelpModal} width="w-96" modalHeading={$t('support.help_title')} onClose={() => (showHelpModal = false)}>
    <div class="text-center py-2">
      <p class="dark:text-white mb-4">{$t('support.help_text')}</p>
      <a
        href="mailto:support@5gnumultimedia.com"
        class="text-primary-700 hover:underline font-medium"
      >
        support@5gnumultimedia.com
      </a>
    </div>
  </Modal>

</div>
