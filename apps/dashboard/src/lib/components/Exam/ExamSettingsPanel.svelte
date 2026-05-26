<script lang="ts">
  import TextField from '$lib/components/Form/TextField.svelte';
  import TextArea from '$lib/components/Form/TextArea.svelte';
  import { Dropdown } from 'carbon-components-svelte';
  import { t } from '$lib/utils/functions/translations';
  import type { Exercise } from '$lib/utils/types';

  export let exam: Partial<Exercise> = {};
  export let onChange: () => void = () => {};

  const showResultOptions = [
    { id: 'after_grade', text: $t('components.exam.policy_after_grade') },
    { id: 'immediately', text: $t('components.exam.policy_immediately') },
    { id: 'manual', text: $t('components.exam.policy_manual') }
  ];
</script>

<div class="bg-white dark:bg-black border border-gray-200 dark:border-neutral-600 rounded-md p-4 mb-6">
  <h3 class="dark:text-white text-lg font-bold mb-4">{$t('components.exam.settings_title')}</h3>

  <div class="space-y-4">
    <TextField
      label={$t('components.exam.exam_title')}
      bind:value={exam.title}
      isRequired={true}
      onChange={onChange}
    />

    <TextArea
      label={$t('components.exam.description')}
      bind:value={exam.description}
      onChange={onChange}
      rows={2}
    />

    <div class="grid grid-cols-2 gap-4">
      <TextField
        label={$t('components.exam.duration')}
        type="number"
        bind:value={exam.duration_minutes}
        min={1}
        onChange={onChange}
      />
      <TextField
        label={$t('components.exam.attempts')}
        type="number"
        bind:value={exam.attempts_allowed}
        min={1}
        onChange={onChange}
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <TextField
        label={$t('components.exam.passing_score')}
        type="number"
        bind:value={exam.passing_score}
        min={0}
        max={100}
        onChange={onChange}
      />
      <div>
        <label class="block text-sm font-light mb-1 dark:text-white">{$t('components.exam.show_result_policy')}</label>
        <Dropdown
          class="w-full bg-gray-100 dark:bg-neutral-800"
          selectedId={exam.show_result_policy || 'after_grade'}
          items={showResultOptions}
          on:select={(e) => {
            exam.show_result_policy = e.detail?.selectedId || e.detail?.id || exam.show_result_policy;
            onChange();
          }}
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <TextField
          label={$t('components.exam.available_from')}
          type="datetime-local"
          bind:value={exam.available_from}
          onChange={onChange}
        />
      </div>
      <div>
        <TextField
          label={$t('components.exam.available_until')}
          type="datetime-local"
          bind:value={exam.available_until}
          onChange={onChange}
        />
      </div>
    </div>

    <div class="flex gap-4">
      <label class="flex items-center gap-2 dark:text-white text-sm">
        <input
          type="checkbox"
          bind:checked={exam.shuffle_questions}
          on:change={onChange}
          class="rounded"
        />
        {$t('components.exam.shuffle_questions')}
      </label>
      <label class="flex items-center gap-2 dark:text-white text-sm">
        <input
          type="checkbox"
          bind:checked={exam.shuffle_options}
          on:change={onChange}
          class="rounded"
        />
        {$t('components.exam.shuffle_options')}
      </label>
    </div>
  </div>
</div>
