<script lang="ts">
  import {
    StructuredListRow,
    StructuredListCell,
    Tag,
    OverflowMenuItem,
    OverflowMenu
  } from 'carbon-components-svelte';
  import { isMobile } from '$lib/utils/store/useMobile';
  import { goto } from '$app/navigation';
  import { t } from '$lib/utils/functions/translations';

  export let id = '';
  export let slug = '';
  export let title = '';
  export let type = '';
  export let description = '';
  export let isPublished = false;
  export let totalLessons = 0;
  export let totalStudents = 0;
  export let isLMS = false;
  export let isExplore = false;
  export let canManageActions = true;

  $: courseUrl = isExplore ? `/course/${slug}` : `/courses/${id}${isLMS ? '/lessons?next=true' : ''}`;

  function handleCloneCourse(e) {
    e.stopPropagation();
    if (!canManageActions) return;
    // TODO: Clone course functionality
    alert('WIP: Clone course');
  }

  function handleShareCourse(e) {
    e.stopPropagation();
    if (!canManageActions) return;
    // TODO: Share course functionality
    alert('WIP: Share course');
  }

  function handleInvite(e) {
    e.stopPropagation();
    if (!canManageActions) return;
    // TODO: Invite functionality
    alert('WIP: Invite people to course');
  }

  function handleDeleteCourse(e) {
    e.stopPropagation();
    if (!canManageActions) return;
    // TODO: Delete course functionality
    alert('WIP: Delete course');
  }
</script>

<StructuredListRow label for="row-{id}" on:click={() => goto(courseUrl)}>
  <StructuredListCell><p class="font-semibold">{title}</p></StructuredListCell>
  <StructuredListCell>
    <p class="line-clamp-2">{description}</p>
  </StructuredListCell>
  {#if !$isMobile}
    <StructuredListCell>{type}</StructuredListCell>
    <StructuredListCell>{totalLessons}</StructuredListCell>
    <StructuredListCell>{totalStudents}</StructuredListCell>
    <StructuredListCell>
      <Tag class="break-normal" type={isPublished ? 'green' : 'cool-gray'}>
        {#if isPublished}
          {$t('courses.course_card.published')}
        {:else}
          {$t('courses.course_card.unpublished')}
        {/if}
      </Tag>
    </StructuredListCell>
  {/if}
  {#if canManageActions}
    <StructuredListCell>
      <OverflowMenu
        id="course-list"
        flipped
        on:click={(e) => {
          e.stopPropagation();
        }}
      >
        <OverflowMenuItem
          text={$t('courses.course_card.context_menu.clone')}
          on:click={handleCloneCourse}
        />
        <OverflowMenuItem
          text={$t('courses.course_card.context_menu.share')}
          on:click={handleShareCourse}
        />
        <OverflowMenuItem
          text={$t('courses.course_card.context_menu.invite')}
          on:click={handleInvite}
        />
        <OverflowMenuItem
          danger
          text={$t('courses.course_card.context_menu.delete')}
          on:click={handleDeleteCourse}
        />
      </OverflowMenu>
    </StructuredListCell>
  {/if}
</StructuredListRow>
