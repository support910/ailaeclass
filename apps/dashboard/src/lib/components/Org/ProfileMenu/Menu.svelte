<script>
  import { globalStore } from '$lib/utils/store/app';
  import { profile } from '$lib/utils/store/user';
  import { currentOrg, currentOrgDomain, currentOrgPath } from '$lib/utils/store/org';
  import { ChevronDown, Settings } from 'carbon-icons-svelte';
  import Avatar from '$lib/components/Avatar/index.svelte';
  import TextChip from '$lib/components/Chip/Text.svelte';
  import Logout from 'carbon-icons-svelte/lib/Logout.svelte';
  import Rocket from 'carbon-icons-svelte/lib/Rocket.svelte';
  import NewTab from 'carbon-icons-svelte/lib/NewTab.svelte';
  import { profileMenu } from '../store';
  import { t } from '$lib/utils/functions/translations';
  import { logout } from '$lib/utils/functions/logout';
  import { isSingleOrgMode } from '$lib/utils/config/singleOrg';
  import { ROLE } from '$lib/utils/constants/roles';

  async function handleLogout() {
    await logout();
    closeMenu();
  }

  function closeMenu() {
    $profileMenu.open = false;
  }
</script>

<div class="cursor-pointer rounded-md px-2 py-2 md:px-4 md:py-4">
  <div class="space-y-4 border-b py-3">
    <p class="text-xs font-semibold text-gray-500">{$t('profileMenu.profile')}</p>
    <a
      href={$currentOrg.role_id === ROLE.STUDENT ? '/lms/settings' : `${$currentOrgPath}/settings`}
      class="flex items-center justify-between hover:no-underline"
      on:click={closeMenu}
    >
      <span class="flex max-w-[70%] items-center gap-2">
        <img src={$profile.avatar_url} alt="profile" class="h-8 w-8 rounded-full" />
        <div>
          <p class="w-[80%] truncate text-sm font-semibold">{$profile.fullname}</p>
          <p class="w-[80%] truncate text-xs">{$profile.email}</p>
        </div>
      </span>
      <div>
        <Settings size={20} />
      </div>
    </a>
  </div>
  {#if ($currentOrg.role_id !== ROLE.STUDENT) && (!$globalStore.isOrgSite || isSingleOrgMode())}
    <div class="space-y-4 border-b py-3">
      <p class="text-xs font-semibold text-gray-500">{$t('profileMenu.current_org')}</p>
      <a
        href={`${$currentOrgPath}/settings?tab=org`}
        class="flex items-center justify-between hover:no-underline"
        on:click={closeMenu}
      >
        <span class="flex max-w-[70%] items-center gap-2">
          <img src="/logo-512.png" alt={$currentOrg.name} class="w-7 h-7 rounded-md object-contain" />
          <div>
            <p class="w-[80%] truncate text-sm font-semibold">{$currentOrg.name}</p>
            <p class="w-[80%] truncate text-xs">
              {$currentOrgDomain}
            </p>
          </div>
        </span>
        <div>
          <Settings size={20} />
        </div>
      </a>
    </div>
  {/if}

  <button on:click={handleLogout} class="w-full space-y-4 pt-3">
    <span class="flex items-center gap-2">
      <Logout />
      <p class="text-sm font-semibold">{$t('settings.profile.logout')}</p>
    </span>
  </button>
</div>
