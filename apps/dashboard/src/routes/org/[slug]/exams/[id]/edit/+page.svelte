<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ExamEditor from '$lib/components/Exam/ExamEditor.svelte';
  import { currentOrg, currentOrgPath } from '$lib/utils/store/org';
  import { ROLE } from '$lib/utils/constants/roles';
  import { t } from '$lib/utils/functions/translations';

  $: examId = $page.params.id;

  // Redirect students away from teacher-side exam editor
  $: if ($currentOrg.role_id === ROLE.STUDENT && $currentOrg.id) {
    goto($currentOrgPath);
  }
</script>

<svelte:head>
  <title>{$t('components.exam.edit_title')}</title>
</svelte:head>

{#if !examId}
  <div class="flex items-center justify-center py-20">
    <p class="dark:text-white">{$t('components.exam.invalid_exam_id')}</p>
  </div>
{:else}
  <ExamEditor {examId} />
{/if}
