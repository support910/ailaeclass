<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import Modal from '$lib/components/Modal/index.svelte';
  import TextField from '$lib/components/Form/TextField.svelte';
  import TextArea from '$lib/components/Form/TextArea.svelte';
  import { Dropdown } from 'carbon-components-svelte';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { supabase } from '$lib/utils/functions/supabase';
  import { currentOrg, createExamModal, currentOrgPath, examsStore } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { createExamExercise, fetchCourses } from '$lib/utils/services/courses';
  import { t } from '$lib/utils/functions/translations';
  import type { Course, Lesson } from '$lib/utils/types';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';

  let open = false;
  let coursesList: Course[] = [];
  let lessonsList: Lesson[] = [];
  let isLoading = false;
  let isFetchingLessons = false;
  let errors: Record<string, string> = {};
  let coursesLoaded = false;

  let selectedCourseId = '';
  let selectedLessonId = '';
  let availableFrom = '';
  let availableUntil = '';

  const showResultOptions = [
    { id: 'after_grade', text: $t('components.exam.policy_after_grade') },
    { id: 'immediately', text: $t('components.exam.policy_immediately') },
    { id: 'manual', text: $t('components.exam.policy_manual') }
  ];

  function handleClose() {
    $createExamModal.open = false;
    $createExamModal.title = '';
    $createExamModal.description = '';
    $createExamModal.courseId = '';
    $createExamModal.lessonId = '';
    $createExamModal.durationMinutes = 60;
    $createExamModal.attemptsAllowed = 1;
    $createExamModal.passingScore = 60;
    $createExamModal.showResultPolicy = 'after_grade';
    selectedCourseId = '';
    selectedLessonId = '';
    availableFrom = '';
    availableUntil = '';
    lessonsList = [];
    errors = {};
    coursesLoaded = false;
  }

  async function loadCourses() {
    if (!$currentOrg.id || !$profile.id) return;
    const result = await fetchCourses($profile.id, $currentOrg.id);
    if (result && result.allCourses) {
      coursesList = result.allCourses;
    }
    coursesLoaded = true;
  }

  async function loadLessons(courseId: string) {
    if (!courseId) {
      lessonsList = [];
      return;
    }
    isFetchingLessons = true;
    const { data, error } = await supabase
      .from('lesson')
      .select('id, title, order')
      .eq('course_id', courseId)
      .order('order', { ascending: true });

    if (error) {
      console.error('loadLessons error:', error);
      snackbar.error($t('components.exam.load_lessons_error') || 'Failed to load lessons');
      lessonsList = [];
    } else {
      lessonsList = data || [];
    }
    isFetchingLessons = false;
  }

  function onSelectCourse(event: CustomEvent) {
    const newCourseId = event.detail?.selectedId || '';
    if (newCourseId === selectedCourseId) return;
    selectedCourseId = newCourseId;
    selectedLessonId = '';
    lessonsList = [];
    errors.lesson = '';
    if (newCourseId) {
      loadLessons(newCourseId);
    }
  }

  function onSelectLesson(event: CustomEvent) {
    selectedLessonId = event.detail?.selectedId || '';
    errors.lesson = '';
  }

  function validate() {
    errors = {};
    if (!$createExamModal.title || $createExamModal.title.trim().length < 2) {
      errors.title = $t('components.exam.error_title_required');
    }
    if (!selectedCourseId) {
      errors.course = $t('components.exam.error_course_required');
    }
    if (!selectedLessonId) {
      errors.lesson = $t('components.exam.error_lesson_required');
    }
    const attempts = Number($createExamModal.attemptsAllowed);
    if (isNaN(attempts) || attempts < 1) {
      errors.attempts = $t('components.exam.error_attempts_min');
    }
    const duration = Number($createExamModal.durationMinutes);
    if ($createExamModal.durationMinutes !== '' && $createExamModal.durationMinutes !== null && $createExamModal.durationMinutes !== undefined) {
      if (isNaN(duration) || duration <= 0) {
        errors.duration = $t('components.exam.error_duration_min');
      }
    }
    const passingScore = Number($createExamModal.passingScore);
    if ($createExamModal.passingScore !== '' && $createExamModal.passingScore !== null && $createExamModal.passingScore !== undefined) {
      if (isNaN(passingScore) || passingScore < 0) {
        errors.passing_score = $t('components.exam.error_passing_score_min');
      }
    }
    if (availableFrom && availableUntil) {
      if (new Date(availableUntil) <= new Date(availableFrom)) {
        errors.dates = $t('components.exam.error_dates');
      }
    }
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    isLoading = true;
    try {
      const { data, error } = await createExamExercise({
        title: $createExamModal.title.trim(),
        description: $createExamModal.description || '',
        lesson_id: selectedLessonId,
        course_id: selectedCourseId,
        duration_minutes: $createExamModal.durationMinutes ? Number($createExamModal.durationMinutes) : undefined,
        attempts_allowed: Number($createExamModal.attemptsAllowed) || 1,
        passing_score: $createExamModal.passingScore !== '' && $createExamModal.passingScore !== null && $createExamModal.passingScore !== undefined ? Number($createExamModal.passingScore) : undefined,
        show_result_policy: $createExamModal.showResultPolicy || 'after_grade',
        available_from: availableFrom || undefined,
        available_until: availableUntil || undefined
      });

      if (error || !data || data.length === 0) {
        const msg = error?.message || $t('components.exam.save_error') || 'Failed to create exam';
        console.error('createExamExercise error:', error);
        snackbar.error(msg);
        isLoading = false;
        return;
      }

      const newExam = data[0];
      // Attach lesson info for display
      const lesson = lessonsList.find((l) => l.id === selectedLessonId);
      if (lesson) {
        newExam.lesson = lesson;
      }

      examsStore.update((store) => [newExam, ...store]);
      handleClose();
      snackbar.success($t('components.exam.save_success') || 'Exam created successfully');
    } catch (err) {
      console.error('handleSubmit unexpected error:', err);
      snackbar.error($t('components.exam.save_error') || 'Failed to create exam');
    } finally {
      isLoading = false;
    }
  }

  $: {
    const newOpen = $createExamModal.open;
    if (newOpen && !open) {
      open = true;
      loadCourses();
    } else if (!newOpen && open) {
      open = false;
      selectedCourseId = '';
      selectedLessonId = '';
      lessonsList = [];
      coursesLoaded = false;
    }
  }
</script>

<Modal
  onClose={handleClose}
  bind:open
  width="w-11/12 md:w-2/5"
  modalHeading={$t('components.exam.create_exam')}
>
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <TextField
      label={$t('components.exam.exam_title')}
      bind:value={$createExamModal.title}
      autofocus={true}
      placeholder={$t('components.exam.placeholder')}
      isRequired={true}
      errorMessage={errors.title || ''}
      autoComplete={false}
    />

    <TextArea
      label={$t('components.exam.description')}
      bind:value={$createExamModal.description}
      placeholder=""
      className="mb-2"
    />

    <div>
      <label class="block text-sm font-light mb-1 dark:text-white">{$t('components.exam.course')}</label>
      <Dropdown
        class="w-full bg-gray-100 dark:bg-neutral-800"
        selectedId={selectedCourseId}
        on:select={onSelectCourse}
        items={coursesList.map((c) => ({ id: c.id, text: c.title || 'Untitled' }))}
        placeholder={$t('components.exam.select_course')}
      />
      {#if errors.course}<p class="text-red-500 text-xs mt-1">{errors.course}</p>{/if}
    </div>

    <div>
      <label class="block text-sm font-light mb-1 dark:text-white">{$t('components.exam.lesson')}</label>
      <Dropdown
        class="w-full bg-gray-100 dark:bg-neutral-800"
        selectedId={selectedLessonId}
        on:select={onSelectLesson}
        items={lessonsList.map((l) => ({ id: l.id, text: l.title || 'Untitled' }))}
        placeholder={$t('components.exam.select_lesson')}
        disabled={isFetchingLessons || !selectedCourseId || lessonsList.length === 0}
      />
      {#if isFetchingLessons}
        <p class="text-gray-500 text-xs mt-1">{$t('components.exam.loading_lessons')}</p>
      {:else if selectedCourseId && lessonsList.length === 0}
        <p class="text-amber-600 text-xs mt-1">
          {$t('components.exam.no_lessons_hint') || 'This course has no lessons. Please create a lesson first before creating an exam.'}
        </p>
      {:else if errors.lesson}
        <p class="text-red-500 text-xs mt-1">{errors.lesson}</p>
      {/if}
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <TextField
          label={$t('components.exam.duration')}
          type="number"
          bind:value={$createExamModal.durationMinutes}
          min={1}
          errorMessage={errors.duration || ''}
        />
      </div>
      <div>
        <TextField
          label={$t('components.exam.attempts')}
          type="number"
          bind:value={$createExamModal.attemptsAllowed}
          min={1}
          errorMessage={errors.attempts || ''}
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <TextField
          label={$t('components.exam.passing_score')}
          type="number"
          bind:value={$createExamModal.passingScore}
          min={0}
          max={100}
          errorMessage={errors.passing_score || ''}
        />
      </div>
      <div>
        <label class="block text-sm font-light mb-1 dark:text-white">{$t('components.exam.show_result_policy')}</label>
        <Dropdown
          class="w-full bg-gray-100 dark:bg-neutral-800"
          bind:selectedId={$createExamModal.showResultPolicy}
          items={showResultOptions}
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <TextField
          label={$t('components.exam.available_from')}
          type="datetime-local"
          bind:value={availableFrom}
        />
      </div>
      <div>
        <TextField
          label={$t('components.exam.available_until')}
          type="datetime-local"
          bind:value={availableUntil}
        />
      </div>
    </div>
    {#if errors.dates}<p class="text-red-500 text-xs mt-1">{errors.dates}</p>{/if}

    <div class="mt-5 flex items-center justify-end">
      <PrimaryButton
        className="px-6 py-3"
        label={$t('components.exam.continue')}
        type="submit"
        isDisabled={isLoading}
        {isLoading}
      />
    </div>
  </form>
</Modal>
