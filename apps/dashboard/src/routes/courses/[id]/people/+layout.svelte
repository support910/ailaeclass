<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import CourseContainer from '$lib/components/CourseContainer/index.svelte';
  import IconButton from '$lib/components/IconButton/index.svelte';
  import { PageBody, PageNav } from '$lib/components/Page';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import RoleBasedSecurity from '$lib/components/RoleBasedSecurity/index.svelte';
  import { t } from '$lib/utils/functions/translations';
  import ArrowLeft from 'carbon-icons-svelte/lib/ArrowLeft.svelte';

  export let data;

  // Get back URL from query parameters
  $: backUrl = $page.url.searchParams.get('back');

  const handleClick = () => {
    const url = new URL($page.url);
    url.searchParams.set('add', 'true');
    goto(`${url.pathname}${url.search}`);
  };

  const handleBackNavigation = () => {
    if (backUrl) {
      goto(backUrl);
    } else {
      goto(`/courses/${data.courseId}/people`);
    }
  };
</script>

<CourseContainer bind:courseId={data.courseId}>
  <RoleBasedSecurity
    allowedRoles={[1, 2]}
    onDenied={() => {
      goto(`/courses/${data.courseId}/lessons`);
    }}
  >
    <PageNav title={$t('course.navItem.people.title')} disableSticky={true}>
      <slot:fragment slot="image">
        {#if data.personId}
          <IconButton size="large" onClick={handleBackNavigation}>
            <ArrowLeft size={16} class="carbon-icon dark:text-white " />
          </IconButton>
        {/if}
      </slot:fragment>
      <slot:fragment slot="widget">
        {#if !data.personId}
          <PrimaryButton
            className="mr-2"
            label={$t('course.navItem.people.add')}
            onClick={handleClick}
          />
        {/if}
      </slot:fragment>
    </PageNav>
    <PageBody width="w-full max-w-6xl md:w-11/12">
      <slot />
    </PageBody>
  </RoleBasedSecurity>
</CourseContainer>
