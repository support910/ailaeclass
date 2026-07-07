<script lang="ts">
  import { page } from '$app/stores';
  import HelpIcon from 'carbon-icons-svelte/lib/Help.svelte';
  import LicenseDraft from 'carbon-icons-svelte/lib/LicenseDraft.svelte';
  import Explore from 'carbon-icons-svelte/lib/Explore.svelte';
  import Chat from 'carbon-icons-svelte/lib/Chat.svelte';
  import HomeIcon from '$lib/components/Icons/HomeIcon.svelte';
  import CourseIcon from '$lib/components/Icons/CourseIcon.svelte';
  import CommunityIcon from '$lib/components/Icons/CommunityIcon.svelte';
  import Avatar from '$lib/components/Avatar/index.svelte';
  import { profile } from '$lib/utils/store/user';
  import { NavClasses } from '$lib/utils/constants/reusableClass';
  import { profileMenu, sideBar } from '$lib/components/Org/store';
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { ChevronRight } from 'carbon-icons-svelte';
  import ProfileMenu from '$lib/components/Org/ProfileMenu/index.svelte';
  import Modal from '$lib/components/Modal/index.svelte';

  interface SideLinks {
    name: string;
    icon: any;
    link: string;
    show?: () => boolean;
  }

  interface FutureSideLink {
    name: string;
    link: string;
    icon: any;
  }

  function isActive(pagePath: string, itemPath: string) {
    const pageLinkItems = pagePath.split('/');
    const itemLinkItems = itemPath.split('/');

    if (itemLinkItems.length !== pageLinkItems.length) {
      return false;
    }

    return pagePath.includes(itemPath);
  }

  let sideLinks: SideLinks[] = [];
  let showHelpModal = false;

  const futureStudentLinks: FutureSideLink[] = [
    { name: '智能错题本', link: '/lms/coming-soon/smart-wrongbook', icon: LicenseDraft },
    { name: 'AI今日推荐练习', link: '/lms/coming-soon/ai-daily-practice', icon: Chat },
    { name: '学习数据摘要', link: '/lms/coming-soon/learning-summary', icon: Explore },
    { name: '成长雷达', link: '/lms/coming-soon/growth-radar', icon: Explore },
    { name: '强弱科目提示', link: '/lms/coming-soon/subject-strength', icon: LicenseDraft },
    { name: '学习通知', link: '/lms/coming-soon/learning-notice', icon: LicenseDraft },
    { name: '证书成长档案', link: '/lms/coming-soon/certificate-portfolio', icon: LicenseDraft },
    { name: '低空学习路径', link: '/lms/coming-soon/low-altitude-path', icon: Explore }
  ];

  $: sideLinks = [
    {
      name: $t('lms_navigation.home'),
      icon: HomeIcon,
      link: '/lms'
    },
    {
      name: $t('lms_navigation.my_learning'),
      icon: CourseIcon,
      link: '/lms/mylearning'
    },
    {
      name: $t('lms_navigation.exercise'),
      icon: LicenseDraft,
      link: '/lms/exercises',
      show() {
        return $currentOrg?.customization?.dashboard?.exercise;
      }
    },
    {
      name: $t('lms_navigation.community'),
      icon: CommunityIcon,
      link: '/lms/community',
      show() {
        return $currentOrg?.customization?.dashboard?.community;
      }
    },
    {
      name: $t('lms_navigation.ai_tools'),
      icon: Chat,
      link: '/lms/ai-tools'
    },
    {
      name: $t('lms_navigation.agent'),
      icon: Chat,
      link: '/lms/agent'
    },
    {
      name: '使用引导',
      icon: HelpIcon,
      link: '/lms/guide'
    },
    {
      name: $t('lms_navigation.explore'),
      icon: Explore,
      link: '/lms/explore'
    }
  ].filter((link) => (link.show ? link.show() : true));

  const toggleSidebar = () => {
    $sideBar.hidden = !$sideBar.hidden;
  };
</script>

<div bind:this={$profileMenu.ref} class="static md:relative">
  <aside
    class={`${
      $sideBar.hidden
        ? '-translate-x-[100%] absolute md:translate-x-0 md:relative z-40 top-[48px] md:top-0'
        : 'translate-x-0 absolute md:relative z-40 top-[48px] md:top-0'
    }  overflow-y-auto transition w-[250px] min-w-[250px] bg-gray-100 dark:bg-neutral-900 h-[calc(100vh-48px)]`}
  >
    <div class="h-full flex flex-col">
      <div class="border-b border-gray-200 dark:border-neutral-600 pt-5 px-4">
        <div class="w-full flex flex-col items-center">
          <Avatar
            src={$profile.avatar_url}
            name={$profile.fullname}
            shape="rounded-full"
            width="w-20"
            height="h-20"
          />

          <div class="mt-5 flex justify-center w-full">
            <p
              class="dark:text-white text-lg font-bold whitespace-nowrap truncate max-w-[80%] text-center"
            >
              {$profile.fullname}
            </p>
          </div>
        </div>

        <ul class="my-5">
          {#each sideLinks as item}
            <a href={item.link} class="text-black" on:click={toggleSidebar}>
              <li
                class="flex items-center py-3 px-4 mb-2 {NavClasses.item} {isActive(
                  $page.url.pathname,
                  `${item.link}`
                )
                  ? NavClasses.active
                  : 'dark:text-white'}"
              >
                <svelte:component this={item.icon} size={24} class="carbon-icon dark:fill-[#fff]" />
                <p class="dark:text-white ml-2">{item.name}</p>
              </li>
            </a>
          {/each}
        </ul>

        <div class="mt-3 border-t border-gray-200 pt-3 dark:border-neutral-700">
          <div class="mb-2 flex items-center justify-between px-4">
            <p class="text-xs font-semibold text-gray-500 dark:text-neutral-300">学生端待开放</p>
            <span
              class="rounded-md bg-gray-200 px-2 py-1 text-xs text-gray-600 dark:bg-neutral-800 dark:text-neutral-300"
            >
              未开放
            </span>
          </div>
          <ul>
            {#each futureStudentLinks as item}
              <a href={item.link} class="text-black" on:click={toggleSidebar}>
                <li
                  class="mb-1 flex cursor-pointer items-center rounded px-4 py-3 {isActive(
                    $page.url.pathname,
                    item.link
                  )
                    ? NavClasses.active
                    : 'text-gray-500 dark:text-neutral-300'}"
                >
                  <svelte:component this={item.icon} size={22} class="carbon-icon dark:fill-[#fff]" />
                  <p class="ml-2 truncate">{item.name}</p>
                </li>
              </a>
            {/each}
          </ul>
        </div>
      </div>
      <span class="flex-grow" />
      <ul class="my-5 pb-5 px-4">
        <button class="w-full text-left" on:click={() => (showHelpModal = true)}>
          <li class="flex items-center py-3 px-4 mb-2 rounded cursor-pointer">
            <HelpIcon size={20} class="carbon-icon dark:text-white" />
            <p class="dark:text-white ml-2">{$t('lms_navigation.help')}</p>
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
            class="text-black no-underline cursor-pointer flex items-center justify-between mb-2 px-2.5 py-1.5 w-full {NavClasses.item}"
          >
            <div class="flex text-start items-center justify-start space-x-1">
              <Avatar
                src={$profile.avatar_url}
                name={$profile.username}
                width="w-[1.2rem]"
                height="h-[1.2rem]"
              />
              <p class="text-sm dark:text-white font-medium truncate max-w-full">
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
