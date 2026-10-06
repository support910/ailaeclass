<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { group, course } from '$lib/components/Course/store';
  import { questionnaire, isQuestionnaireFetching } from '../store/exercise';
  import { questionnaireMetaData } from '../store/answers';
  import Preview from './Preview.svelte';
  import RadioQuestion from '$lib/components/Question/RadioQuestion/index.svelte';
  import CheckboxQuestion from '$lib/components/Question/CheckboxQuestion/index.svelte';
  import TextareaQuestion from '$lib/components/Question/TextareaQuestion/index.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import Box from '$lib/components/Box/index.svelte';
  import RoleBasedSecurity from '$lib/components/RoleBasedSecurity/index.svelte';
  import Progress from '$lib/components/Progress/index.svelte';
  import { removeDuplicate } from '$lib/utils/functions/removeDuplicate';
  import { QUESTION_TYPE } from '$lib/components/Question/constants';
  import { STATUS } from './constants';
  import { getPropsForQuestion, filterOutDeleted, wasCorrectAnswerSelected } from './functions';
  import { formatAnswers, getGroupMemberId } from '$lib/components/Course/function';
  import { submitExercise } from '$lib/utils/services/courses';
  import { fetchSubmission } from '$lib/utils/services/submissions';
  import { profile } from '$lib/utils/store/user';
  import { currentOrg } from '$lib/utils/store/org';
  import {
    NOTIFICATION_NAME,
    triggerSendEmail
  } from '$lib/utils/services/notification/notification';
  import { lesson } from '../store/lessons';
  import { browser } from '$app/environment';
  import { COURSE_TYPE } from '$lib/utils/types';
  import { sanitizeHtml } from '$lib/utils/functions/sanitize';
  import { t, locale } from '$lib/utils/functions/translations';

  export let preview: boolean = false;
  export let exerciseId = '';
  export let isFetchingExercise = false;

  let currentQuestion = {};
  let renderProps = {};
  let submission;
  let hasSubmission = false;
  let isLoadingAutoSavedData = false;
  let alreadyCheckedAutoSavedData = false;
  let submissionResponse;
  let isAdvancing = false;
  let advanceTimer: ReturnType<typeof setTimeout>;
  let showRetryHint = false;
  const retryHints = {
    en: 'Not correct yet. Please select another answer, then click Next to try again.',
    zh: '答案还不正确，请重新选择答案，再点击下一题重试。',
    'zh-TW': '答案尚未正確，請重新選擇答案，再點擊下一題重試。',
    ms: 'Jawapan belum betul. Pilih jawapan lain, kemudian klik Seterusnya untuk mencuba lagi.',
    id: 'Jawaban belum benar. Pilih jawaban lain, lalu klik Berikutnya untuk mencoba lagi.',
    th: 'คำตอบยังไม่ถูกต้อง โปรดเลือกคำตอบใหม่ แล้วคลิกถัดไปเพื่อลองอีกครั้ง',
    hi: 'उत्तर अभी सही नहीं है। दूसरा उत्तर चुनें, फिर दोबारा प्रयास करने के लिए अगला दबाएँ।',
    fr: 'Réponse incorrecte. Choisissez une autre réponse, puis cliquez sur Suivant.',
    pl: 'Odpowiedź jest niepoprawna. Wybierz inną odpowiedź i kliknij Dalej.',
    pt: 'Resposta incorreta. Selecione outra resposta e clique em Seguinte.',
    de: 'Die Antwort ist noch nicht richtig. Wählen Sie eine andere Antwort und klicken Sie auf Weiter.',
    vi: 'Câu trả lời chưa đúng. Hãy chọn câu trả lời khác, rồi nhấn Tiếp theo.',
    ru: 'Ответ неверный. Выберите другой ответ и нажмите «Далее».',
    es: 'La respuesta aún no es correcta. Elige otra respuesta y pulsa Siguiente.',
    da: 'Svaret er ikke korrekt endnu. Vælg et andet svar, og klik på Næste.'
  };
  onDestroy(() => clearTimeout(advanceTimer));

  function handleStart() {
    $questionnaireMetaData.currentQuestionIndex += 1;
  }

  const getStudent = (people, profileId) => {
    return people.find((person) => person.profile_id === profileId);
  };

  const notifyEducator = () => {
    const student = getStudent($group.students, $profile.id);
    const teacherFullname = $group.tutors[0]?.fullname;
    const teacherEmail = $group.tutors[0]?.email;
    console.log({
      student,
      teacherFullname,
      teacherEmail
    });
    if (!student || !teacherFullname || !teacherEmail) return;

    const baseUrl = `${window.location.origin}/courses/${$course.id}`;
    const exerciseLink = `${baseUrl}/lessons/${$lesson.id}/exercises/${exerciseId}`;
    const submissionLink = `${baseUrl}/submissions`;
    const content = `
      <p>Hello ${teacherFullname},</p>
      <p>A student ${student.profile.fullname} just submitted an exercise <a href=${exerciseLink}>${$questionnaire.title}</a> 
        <p>You can get started grading by clicking "Open Submissions"</p>
      <div>
        <a class="button" href=${submissionLink}>Open Submissions</a>
      </div>
      `;

    triggerSendEmail(NOTIFICATION_NAME.EXERCISE_SUBMISSION_UPDATE, {
      to: teacherEmail,
      content,
      orgName: $currentOrg?.name,
      exerciseTitle: $questionnaire.title
    });
  };

  async function onSubmit(id, value) {
    if (isAdvancing) return;
    const { answers } = $questionnaireMetaData;
    const { questions } = $questionnaire;
    const prevAnswer = answers[id] || [];

    const formattedAnswer =
      typeof value === 'string' ? value : removeDuplicate([...prevAnswer, ...(value || [])]);

    $questionnaireMetaData.answers = {
      ...answers,
      [id]: formattedAnswer
    };

    const isCorrect = wasCorrectAnswerSelected(currentQuestion, $questionnaireMetaData.answers);
    showRetryHint = !isCorrect;
    console.log({ isCorrect });

    const isFinished = !questions[$questionnaireMetaData.currentQuestionIndex];
    console.log(`isFinished`, isFinished);
    console.log(
      `$questionnaireMetaData.currentQuestionIndex`,
      $questionnaireMetaData.currentQuestionIndex
    );

    if (isCorrect) {
      isAdvancing = true;
      advanceTimer = setTimeout(async () => {
        isAdvancing = false;
        $questionnaireMetaData.currentQuestionIndex += 1;
        localStorage.setItem(
          `autosave-exercise-${exerciseId}`,
          JSON.stringify($questionnaireMetaData)
        );

        // If last question send to server
        if (isFinished) {
          localStorage.removeItem(`autosave-exercise-${exerciseId}`);
          $questionnaireMetaData.status = 1;
          $questionnaireMetaData.totalPossibleGrade = getTotalPossibleGrade(
            $questionnaire.questions
          );
          $questionnaireMetaData.grades = {};

          $questionnaireMetaData.comment = '';
          let response = await submitExercise(
            $questionnaireMetaData.answers,
            questions,
            exerciseId,
            $course.id,
            getGroupMemberId($group.people, $profile.id)
          );

          if (response) {
            submissionResponse = response;
          }

          notifyEducator();
        }
      }, 1000);
    }

    // if (moveToNextQuestion) {
    //   $questionnaireMetaData.currentQuestionIndex += 1;
    //   localStorage.setItem(
    //     `autosave-exercise-${exerciseId}`,
    //     JSON.stringify($questionnaireMetaData)
    //   );
    // }
  }

  function onPrevious() {
    if (isAdvancing) return;
    showRetryHint = false;
    $questionnaireMetaData.currentQuestionIndex -= 1;
  }

  function getProgressValue(currentQuestionIndex) {
    if ($questionnaireMetaData.isFinished) {
      return 100;
    }

    return Math.round(((currentQuestionIndex - 1) / $questionnaire.questions.length) * 100) || 0;
  }

  function getTotalPossibleGrade(questions) {
    return questions.reduce((acc, question) => {
      acc += parseFloat(question.points, 10);
      return acc;
    }, 0);
  }

  async function checkForSubmission(people, profileId?: string, courseId?: string) {
    if (!Array.isArray(people) || !profileId || !courseId || !!submission) {
      return;
    }

    if (hasSubmission) return;

    const args = {
      exerciseId,
      courseId,
      submittedBy: getGroupMemberId(people, profileId)
    };
    const { data } = await fetchSubmission(args);
    hasSubmission = true;

    if (Array.isArray(data) && data.length) {
      submission = data[0];

      $questionnaireMetaData.answers = formatAnswers({
        questions: $questionnaire.questions,
        answers: submission.answers
      });

      $questionnaireMetaData.totalPossibleGrade = getTotalPossibleGrade($questionnaire.questions);

      $questionnaireMetaData.currentQuestionIndex = $questionnaire.questions.length;
      $questionnaireMetaData.isFinished = true;
      $questionnaireMetaData.status = submission.status_id;
      $questionnaireMetaData.finalTotalGrade = 0;
      $questionnaireMetaData.comment = submission.feedback;
      $questionnaireMetaData.grades = submission.answers.reduce((acc, answer) => {
        acc[answer.question_id] = answer.point;
        $questionnaireMetaData.finalTotalGrade += answer.point;

        return acc;
      }, {});
    }
  }

  function getAutoSavedData() {
    isLoadingAutoSavedData = true;

    const stringifiedQuestionnaireMetaData = localStorage.getItem(
      `autosave-exercise-${exerciseId}`
    );

    if (stringifiedQuestionnaireMetaData) {
      const autoSavedData = JSON.parse(stringifiedQuestionnaireMetaData);
      if (autoSavedData) {
        $questionnaireMetaData = autoSavedData;
      }
    }
    isLoadingAutoSavedData = false;
    alreadyCheckedAutoSavedData = true;
  }

  $: browser && !alreadyCheckedAutoSavedData && getAutoSavedData();

  // Reactive code
  $: if (alreadyCheckedAutoSavedData && !$isQuestionnaireFetching &&
    $questionnaire.id === exerciseId && $questionnaire.questions.length > 0) {
    currentQuestion = $questionnaire.questions[$questionnaireMetaData.currentQuestionIndex - 1];
    if ($questionnaireMetaData.currentQuestionIndex > 0 && !currentQuestion) {
      $questionnaireMetaData.isFinished = true;
    }

    if (currentQuestion) {
      renderProps = getPropsForQuestion(
        $questionnaire.questions,
        currentQuestion,
        $questionnaireMetaData,
        $questionnaireMetaData.currentQuestionIndex,
        onSubmit,
        onPrevious,
        preview
      );
    }
    $questionnaireMetaData.progressValue = getProgressValue(
      $questionnaireMetaData.currentQuestionIndex
    );
  }

  $: !isFetchingExercise && checkForSubmission($group.people, $profile.id, $course.id);
  // Stored correct answers must not lock navigation when revisiting a question.
  $: navigationProps = {
    ...renderProps,
    disablePreviousButton: isAdvancing || $questionnaireMetaData.currentQuestionIndex === 1,
    nextButtonProps: { ...renderProps.nextButtonProps, isDisabled: isAdvancing }
  };
</script>

{#if !preview && $questionnaire.questions.length && !$questionnaireMetaData.isFinished}
  <Progress value={$questionnaireMetaData.progressValue} />
{/if}

{#if preview}
  <RoleBasedSecurity allowedRoles={[1, 2]}>
    <Preview
      questions={filterOutDeleted($questionnaire.questions)}
      questionnaireMetaData={$questionnaireMetaData}
    />
  </RoleBasedSecurity>
{:else if !$questionnaire.questions.length}
  <Box>
    <img src="/images/empty-exercise-icon.svg" alt="Exercise svg" class="my-2.5" />
    <h2 class="my-1.5 text-xl">No question added for this exercise</h2>
    <p class="px-44 text-center text-sm">
      <RoleBasedSecurity allowedRoles={[1, 2]}>
        Click the <span class="text-primary-700">Edit</span> button to add.
      </RoleBasedSecurity>
    </p>
  </Box>
{:else if $questionnaireMetaData.currentQuestionIndex === 0}
  <RoleBasedSecurity allowedRoles={[3]}>
    <div>
      <h2 class="my-1">{$questionnaire.title}</h2>

      <div class="flex items-center">
        <p class="mx-2 dark:text-white">
          <strong>{$questionnaire.questions.length}</strong> questions
        </p>
        |
        <p class="mx-2 dark:text-white">
          <strong>{getTotalPossibleGrade($questionnaire.questions)}</strong> points.
        </p>
        |
        <p class="mx-2 dark:text-white">All required</p>
        {#if $questionnaire.due_by}
          |
          <p class="mx-2 dark:text-white">
            <strong>Due by:</strong>
            {new Date($questionnaire.due_by).toLocaleString()}
          </p>
        {/if}
      </div>

      <article class="preview prose prose-sm sm:prose mt-3 p-2">
        {@html sanitizeHtml($questionnaire.description || 'No desription')}
      </article>

      <PrimaryButton
        onClick={handleStart}
        label="Start"
        className="my-5 float-right"
        type="button"
      />
    </div>
  </RoleBasedSecurity>
{:else if $questionnaireMetaData.isFinished}
  {#if !isLoadingAutoSavedData}
    <div class="flex items-center justify-between">
      <div class="flex w-full flex-col items-start lg:flex-row lg:items-center lg:space-x-4">
        <h2 class="text-xl font-normal">{$questionnaire.title}</h2>

        {#if STATUS.GRADED === $questionnaireMetaData.status}
          <span
            class="status-text bg-green-700 px-2 py-1 text-center text-white"
            title={$t('course.navItem.lessons.exercises.all_exercises.view_mode.status_graded')}
          >
            {$t('course.navItem.lessons.exercises.all_exercises.view_mode.graded')}
          </span>
        {:else if $course.type === COURSE_TYPE.SELF_PACED}
          <span
            class="status-text bg-green-700 px-2 py-1 text-center text-white"
            title={$t('course.navItem.lessons.exercises.all_exercises.view_mode.status_submitted')}
          >
            {$t('course.navItem.lessons.exercises.all_exercises.view_mode.submitted')}
          </span>
        {:else}
          <span
            class="status-text bg-yellow-600 px-2 py-1 text-center text-white"
            title={$t('course.navItem.lessons.exercises.all_exercises.view_mode.status_pending')}
          >
            {$t('course.navItem.lessons.exercises.all_exercises.view_mode.pending')}
          </span>
        {/if}
      </div>
      {#if STATUS.GRADED === $questionnaireMetaData.status && $course.type !== COURSE_TYPE.SELF_PACED}
        <span
          class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-300 bg-[#F5F8FE] p-6 text-sm font-semibold text-[#2751DA]"
          title={$t('course.navItem.lessons.exercises.all_exercises.view_mode.status_graded')}
        >
          {$questionnaireMetaData.finalTotalGrade}/{$questionnaireMetaData.totalPossibleGrade}
        </span>
      {/if}
    </div>

    {#if $questionnaireMetaData.status === STATUS.GRADED && $questionnaireMetaData.comment && $course.type !== COURSE_TYPE.SELF_PACED}
      <div class="bg-primary-700 mt-3 flex items-center justify-between rounded-sm p-4 text-white">
        <span> {$questionnaireMetaData.comment}</span>
      </div>
    {/if}
    <Preview
      questions={$questionnaire.questions.sort((a, b) => a.order - b.order)}
      questionnaireMetaData={$questionnaireMetaData}
      grades={$questionnaireMetaData.grades}
      disableGrading={true}
    />
  {/if}
{:else if currentQuestion && currentQuestion?.id}
  {#key currentQuestion.id}
    <!-- <div transition:fade id="question"> -->
    <div in:fly={{ x: 500, duration: 1000 }} id="question">
      {#if QUESTION_TYPE.RADIO === currentQuestion.question_type.id}
        <RadioQuestion {...navigationProps} key={currentQuestion.id} hideGrading={true} />
      {:else if QUESTION_TYPE.CHECKBOX === currentQuestion.question_type.id}
        <CheckboxQuestion {...navigationProps} key={currentQuestion.id} hideGrading={true} />
      {:else if QUESTION_TYPE.TEXTAREA === currentQuestion.question_type.id}
        <TextareaQuestion {...navigationProps} key={currentQuestion.id} hideGrading={true} />
      {/if}
      {#if showRetryHint}
        <p role="status" class="mt-3 text-sm text-red-700 dark:text-red-300">
          {retryHints[$locale] || retryHints.en}
        </p>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .status-text {
    width: fit-content;
  }
</style>
