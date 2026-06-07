<script lang="ts">
  import { Select, SelectItem } from 'carbon-components-svelte';
  import TextField from '$lib/components/Form/TextField.svelte';
  import TextArea from '$lib/components/Form/TextArea.svelte';
  import Checkbox from '$lib/components/Form/Checkbox.svelte';
  import RadioItem from '$lib/components/Form/RadioItem.svelte';
  import IconButton from '$lib/components/IconButton/index.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import QuestionContainer from '$lib/components/QuestionContainer/index.svelte';
  import { QUESTION_TYPE, EXAM_QUESTION_TYPES } from '$lib/components/Question/constants';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import { t } from '$lib/utils/functions/translations';
  import TrashCanIcon from 'carbon-icons-svelte/lib/TrashCan.svelte';
  import AddFilledIcon from 'carbon-icons-svelte/lib/AddFilled.svelte';
  import CheckmarkFilledIcon from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import CheckmarkOutlineIcon from 'carbon-icons-svelte/lib/CheckmarkOutline.svelte';
  import { isUUID } from '$lib/utils/functions/isUUID';
  import ImportQuestionsModal from './ImportQuestionsModal.svelte';
  import QuestionImageUpload from './QuestionImageUpload.svelte';

  export let questions: any[] = [];
  export let onQuestionsChange: (questions: any[]) => void = () => {};

  let showImportModal = false;

  function makeId() {
    return `new_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function handleAddQuestion() {
    const newQuestion = {
      id: makeId(),
      title: '',
      name: '',
      points: 1,
      order: questions.length,
      question_type: { id: QUESTION_TYPE.RADIO },
      options: [
        { id: makeId(), label: '', value: null, is_correct: false }
      ],
      is_dirty: true
    };
    onQuestionsChange([...questions, newQuestion]);
  }

  function handleRemoveQuestion(questionId: string) {
    return () => {
      onQuestionsChange(
        questions.map((q) => {
          if (q.id === questionId) {
            return { ...q, deleted_at: new Date().toISOString(), is_dirty: true };
          }
          return q;
        })
      );
    };
  }

  function handleQuestionTypeChange(questionId: string, typeId: number) {
    onQuestionsChange(
      questions.map((q) => {
        if (q.id !== questionId) return q;
        const type = EXAM_QUESTION_TYPES.find((t) => t.id === typeId);
        const updated = { ...q, question_type: type || q.question_type, is_dirty: true };

        if (typeId === QUESTION_TYPE.TRUE_FALSE) {
          updated.options = [
            { id: makeId(), label: 'True', value: 'true', is_correct: false },
            { id: makeId(), label: 'False', value: 'false', is_correct: false }
          ];
        } else if (typeId === QUESTION_TYPE.TEXTAREA) {
          updated.options = [];
        } else if (!updated.options || updated.options.length === 0) {
          updated.options = [
            { id: makeId(), label: '', value: null, is_correct: false }
          ];
        }
        return updated;
      })
    );
  }

  function handleAddOption(questionId: string) {
    return () => {
      onQuestionsChange(
        questions.map((q) => {
          if (q.id !== questionId) return q;
          return {
            ...q,
            options: [
              ...q.options,
              { id: makeId(), label: '', value: null, is_correct: false }
            ],
            is_dirty: true
          };
        })
      );
    };
  }

  function handleRemoveOption(questionId: string, optionId: string) {
    return () => {
      onQuestionsChange(
        questions.map((q) => {
          if (q.id !== questionId) return q;
          return {
            ...q,
            options: q.options.map((o) => {
              if (o.id === optionId) {
                return { ...o, deleted_at: new Date().toISOString(), is_dirty: true };
              }
              return o;
            }),
            is_dirty: true
          };
        })
      );
    };
  }

  function handleAnswerSelect(questionId: string, optionId: string) {
    return () => {
      onQuestionsChange(
        questions.map((q) => {
          if (q.id !== questionId) return q;
          const isRadio =
            q.question_type?.id === QUESTION_TYPE.RADIO ||
            q.question_type?.id === QUESTION_TYPE.TRUE_FALSE;
          return {
            ...q,
            options: q.options.map((o) => {
              if (o.id === optionId) {
                return {
                  ...o,
                  is_correct: isRadio ? true : !o.is_correct,
                  is_dirty: true
                };
              }
              if (isRadio) {
                return { ...o, is_correct: false };
              }
              return o;
            }),
            is_dirty: true
          };
        })
      );
    };
  }

  function handleOptionLabelChange(questionId: string, optionId: string) {
    return (e: Event) => {
      const label = (e.target as HTMLInputElement).value;
      onQuestionsChange(
        questions.map((q) => {
          if (q.id !== questionId) return q;
          return {
            ...q,
            options: q.options.map((o) => {
              if (o.id === optionId) {
                return {
                  ...o,
                  label,
                  value: isUUID(o.value) ? o.value : label.split(' ').join('-'),
                  is_dirty: true
                };
              }
              return o;
            }),
            is_dirty: true
          };
        })
      );
    };
  }

  function handleQuestionFieldChange(questionId: string, field: string, value: any) {
    onQuestionsChange(
      questions.map((q) => {
        if (q.id !== questionId) return q;
        return { ...q, [field]: value, is_dirty: true };
      })
    );
  }

  function handleImport(newQuestions: any[]) {
    onQuestionsChange([...questions, ...newQuestions]);
  }

  $: activeQuestions = questions.filter((q) => !q.deleted_at);
</script>

<ImportQuestionsModal
  bind:open={showImportModal}
  onClose={() => (showImportModal = false)}
  onImport={handleImport}
  existingCount={activeQuestions.length}
/>

<div class="space-y-4">
  {#each activeQuestions as question (question.id)}
    <QuestionContainer
      onClose={handleRemoveQuestion(question.id)}
      bind:points={question.points}
      onPointsChange={() => handleQuestionFieldChange(question.id, 'points', question.points)}
    >
      <div class="flex justify-between items-center gap-4">
        <div class="flex-1">
          <TextField
            placeholder={$t('components.exam.question_placeholder')}
            bind:value={question.title}
            isRequired={true}
            onChange={() => handleQuestionFieldChange(question.id, 'title', question.title)}
          />
          <QuestionImageUpload
            image={question.metadata?.image || null}
            onChange={(img) => handleQuestionFieldChange(question.id, 'metadata', { ...question.metadata, image: img })}
            label="Question image (optional)"
          />
        </div>
        <Select
          size="xl"
          class="w-[140px]"
          selected={question.question_type?.id || QUESTION_TYPE.RADIO}
          on:change={(e) => {
            const id = parseInt(e.target?.value);
            handleQuestionTypeChange(question.id, id);
          }}
        >
          {#each EXAM_QUESTION_TYPES as type}
            <SelectItem value={type.id} text={$t(type.label)} />
          {/each}
        </Select>
      </div>

      {#if question.question_type?.id === QUESTION_TYPE.TEXTAREA}
        <div class="mt-2">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {$t('components.exam.textarea_hint')}
          </p>
        </div>
      {:else}
        <div class="flex flex-col mt-2 gap-2">
          {#each question.options.filter((o) => !o.deleted_at) as option (option.id)}
            {#if question.question_type?.id === QUESTION_TYPE.CHECKBOX}
              <div class="flex items-start gap-2">
                <div class="flex-1">
                  <Checkbox
                    isEditable={true}
                    name={`checkbox-${question.id}`}
                    bind:label={option.label}
                    onChange={handleOptionLabelChange(question.id, option.id)}
                  >
                    <div slot="iconbutton" class="flex items-center gap-1">
                      <IconButton
                        value={option.id}
                        onClick={handleRemoveOption(question.id, option.id)}
                      >
                        <TrashCanIcon size={20} class="carbon-icon dark:text-white" />
                      </IconButton>
                      <IconButton
                        value={option.id}
                        onClick={handleAnswerSelect(question.id, option.id)}
                        buttonClassName={option.is_correct ? 'success' : ''}
                      >
                        {#if option.is_correct}
                          <CheckmarkFilledIcon size={20} class="carbon-icon dark:text-white" />
                        {:else}
                          <CheckmarkOutlineIcon size={20} class="carbon-icon dark:text-white" />
                        {/if}
                      </IconButton>
                    </div>
                  </Checkbox>
                  <QuestionImageUpload
                    image={option.metadata?.image || null}
                    onChange={(img) => {
                      onQuestionsChange(
                        questions.map((q) => {
                          if (q.id !== question.id) return q;
                          return {
                            ...q,
                            options: q.options.map((o) => {
                              if (o.id !== option.id) return o;
                              return { ...o, metadata: { ...o.metadata, image: img }, is_dirty: true };
                            }),
                            is_dirty: true
                          };
                        })
                      );
                    }}
                    label=""
                  />
                </div>
              </div>
            {:else}
              <div class="flex items-start gap-2">
                <div class="flex-1">
                  <RadioItem
                    isEditable={true}
                    name={`radio-${question.id}`}
                    bind:label={option.label}
                    onChange={handleOptionLabelChange(question.id, option.id)}
                  >
                    <div slot="iconbutton" class="flex items-center gap-1">
                      {#if question.question_type?.id !== QUESTION_TYPE.TRUE_FALSE}
                        <IconButton
                          value={option.id}
                          onClick={handleRemoveOption(question.id, option.id)}
                        >
                          <TrashCanIcon size={20} class="carbon-icon dark:text-white" />
                        </IconButton>
                      {/if}
                      <IconButton
                        value={option.id}
                        onClick={handleAnswerSelect(question.id, option.id)}
                        buttonClassName={option.is_correct ? 'success' : ''}
                      >
                        {#if option.is_correct}
                          <CheckmarkFilledIcon size={20} class="carbon-icon dark:text-white" />
                        {:else}
                          <CheckmarkOutlineIcon size={20} class="carbon-icon dark:text-white" />
                        {/if}
                      </IconButton>
                    </div>
                  </RadioItem>
                  <QuestionImageUpload
                    image={option.metadata?.image || null}
                    onChange={(img) => {
                      onQuestionsChange(
                        questions.map((q) => {
                          if (q.id !== question.id) return q;
                          return {
                            ...q,
                            options: q.options.map((o) => {
                              if (o.id !== option.id) return o;
                              return { ...o, metadata: { ...o.metadata, image: img }, is_dirty: true };
                            }),
                            is_dirty: true
                          };
                        })
                      );
                    }}
                    label=""
                  />
                </div>
              </div>
            {/if}
          {/each}
        </div>

        {#if question.question_type?.id !== QUESTION_TYPE.TRUE_FALSE}
          <div class="flex items-center mt-3">
            <PrimaryButton
              disablePadding={true}
              className="p-2"
              variant={VARIANTS.OUTLINED}
              onClick={handleAddOption(question.id)}
            >
              <AddFilledIcon size={20} class="carbon-icon dark:text-white" />
              <p class="dark:text-white ml-2 text-sm">
                {$t('components.exam.add_option')}
              </p>
            </PrimaryButton>
          </div>
        {/if}
      {/if}
    </QuestionContainer>
  {/each}

  <div class="flex items-center mt-4 gap-3">
    <PrimaryButton
      className="px-4 py-2"
      variant={VARIANTS.OUTLINED}
      onClick={handleAddQuestion}
      label={$t('components.exam.add_question')}
    />
    <PrimaryButton
      className="px-4 py-2"
      variant={VARIANTS.OUTLINED}
      onClick={() => (showImportModal = true)}
      label={$t('components.exam.import.title')}
    />
  </div>
</div>
