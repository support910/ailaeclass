<script lang="ts">
  import Modal from '$lib/components/Modal/index.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import { t } from '$lib/utils/functions/translations';
  import { QUESTION_TYPE } from '$lib/components/Question/constants';
  import Papa from 'papaparse';
  import UploadIcon from 'carbon-icons-svelte/lib/CloudUpload.svelte';
  import WarningIcon from 'carbon-icons-svelte/lib/Warning.svelte';
  import CheckmarkFilledIcon from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';

  export let open = false;
  export let onClose = () => {};
  export let onImport: (questions: any[]) => void = () => {};
  export let existingCount = 0;

  type ParseResult = {
    row: number;
    valid: boolean;
    errors: string[];
    question?: any;
    raw: Record<string, string>;
  };

  let file: File | null = null;
  let parseResults: ParseResult[] = [];
  let isParsing = false;
  let parseError: string | null = null;

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  const TYPE_MAP: Record<string, number> = {
    RADIO: QUESTION_TYPE.RADIO,
    CHECKBOX: QUESTION_TYPE.CHECKBOX,
    TEXTAREA: QUESTION_TYPE.TEXTAREA,
    TRUE_FALSE: QUESTION_TYPE.TRUE_FALSE
  };

  const OPTION_KEYS = ['option_a', 'option_b', 'option_c', 'option_d'];
  const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function validateRow(row: Record<string, string>, rowIndex: number): ParseResult {
    const errors: string[] = [];
    const typeRaw = (row.question_type || '').trim().toUpperCase();
    const typeId = TYPE_MAP[typeRaw];

    if (!typeId) {
      errors.push($t('components.exam.import.error_invalid_type'));
    }

    const title = (row.title || '').trim();
    if (!title) {
      errors.push($t('components.exam.import.error_empty_title'));
    }

    const pointsRaw = (row.points || '').trim();
    const points = pointsRaw ? parseFloat(pointsRaw) : 1;
    if (pointsRaw && (isNaN(points) || points < 0)) {
      errors.push($t('components.exam.import.error_invalid_points'));
    }

    let options: any[] = [];
    const correctRaw = (row.correct_answer || '').trim().toUpperCase();

    if (typeId === QUESTION_TYPE.RADIO) {
      const opts = OPTION_KEYS.map((k, i) => ({
        letter: OPTION_LETTERS[i],
        label: (row[k] || '').trim()
      })).filter((o) => o.label);

      if (opts.length < 2) {
        errors.push($t('components.exam.import.error_not_enough_options'));
      }

      if (correctRaw && !OPTION_LETTERS.includes(correctRaw)) {
        errors.push($t('components.exam.import.error_invalid_correct'));
      }

      if (opts.length >= 2 && OPTION_LETTERS.includes(correctRaw)) {
        const correctIndex = OPTION_LETTERS.indexOf(correctRaw);
        options = opts.map((o, i) => ({
          id: makeId(),
          label: o.label,
          value: o.label.split(' ').join('-'),
          is_correct: i === correctIndex
        }));
      }
    } else if (typeId === QUESTION_TYPE.CHECKBOX) {
      const opts = OPTION_KEYS.map((k, i) => ({
        letter: OPTION_LETTERS[i],
        label: (row[k] || '').trim()
      })).filter((o) => o.label);

      if (opts.length < 2) {
        errors.push($t('components.exam.import.error_not_enough_options'));
      }

      const correctSet = new Set(correctRaw.split(';').map((s) => s.trim()).filter(Boolean));
      if (correctSet.size === 0) {
        errors.push($t('components.exam.import.error_no_correct'));
      } else {
        const invalid = Array.from(correctSet).filter((c) => !OPTION_LETTERS.includes(c));
        if (invalid.length > 0) {
          errors.push($t('components.exam.import.error_invalid_correct'));
        }
      }

      if (opts.length >= 2) {
        options = opts.map((o, i) => ({
          id: makeId(),
          label: o.label,
          value: o.label.split(' ').join('-'),
          is_correct: correctSet.has(OPTION_LETTERS[i])
        }));
      }
    } else if (typeId === QUESTION_TYPE.TRUE_FALSE) {
      if (correctRaw && correctRaw !== 'TRUE' && correctRaw !== 'FALSE') {
        errors.push($t('components.exam.import.error_invalid_correct'));
      }
      options = [
        { id: makeId(), label: 'True', value: 'true', is_correct: correctRaw === 'TRUE' },
        { id: makeId(), label: 'False', value: 'false', is_correct: correctRaw === 'FALSE' }
      ];
    }

    if (errors.length > 0) {
      return { row: rowIndex + 1, valid: false, errors, raw: row };
    }

    const question = {
      id: makeId(),
      title,
      name: undefined,
      points: isNaN(points) ? 1 : points,
      order: existingCount + rowIndex,
      question_type: { id: typeId },
      options,
      is_dirty: true
    };

    return { row: rowIndex + 1, valid: true, errors: [], question, raw: row };
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const selected = input.files[0];
      if (selected.size > MAX_FILE_SIZE) {
        parseError = $t('components.exam.import.error_file_too_large');
        file = null;
        parseResults = [];
        return;
      }
      parseError = null;
      file = selected;
      parseFile();
    }
  }

  function parseFile() {
    if (!file) return;
    isParsing = true;
    parseResults = [];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase(),
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        parseResults = rows.map((row, i) => validateRow(row, i));
        isParsing = false;
      },
      error: (err) => {
        console.error('CSV parse error', err);
        parseError = $t('components.exam.import.error_parse_failed');
        isParsing = false;
      }
    });
  }

  function handleImport() {
    const validQuestions = parseResults.filter((r) => r.valid && r.question).map((r) => r.question!);
    onImport(validQuestions);
    reset();
    onClose();
  }

  function reset() {
    file = null;
    parseResults = [];
    parseError = null;
  }

  $: totalRows = parseResults.length;
  $: validRows = parseResults.filter((r) => r.valid).length;
  $: errorRows = parseResults.filter((r) => !r.valid).length;
  $: hasValid = validRows > 0;
</script>

<Modal
  bind:open
  onClose={() => {
    reset();
    onClose();
  }}
  modalHeading={$t('components.exam.import.title')}
  width="w-11/12 max-w-4xl"
  containerClass="flex flex-col !max-h-[85vh] overflow-hidden"
>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- File upload -->
    <div class="mb-4">
      <label
        class="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
      >
        <input type="file" accept=".csv" class="hidden" on:change={handleFileSelect} />
        <UploadIcon size={24} class="text-gray-500 dark:text-gray-400" />
        <span class="text-sm text-gray-600 dark:text-gray-300">
          {#if file}
            {file.name}
          {:else}
            {$t('components.exam.import.upload_hint')}
          {/if}
        </span>
      </label>
    </div>

    <!-- Parse error -->
    {#if parseError}
      <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
        <WarningIcon size={18} />
        <span>{parseError}</span>
      </div>
    {/if}

    <!-- Template download -->
    <div class="mb-4 text-right">
      <button
        class="text-sm text-primary-700 hover:underline"
        on:click={() => {
          const template =
            '\uFEFFquestion_type,title,option_a,option_b,option_c,option_d,correct_answer,points\n' +
            'RADIO,What is 2+2?,1,2,3,4,B,1\n' +
            'CHECKBOX,Which are prime?,2,3,4,5,A;B;D,2\n' +
            'TRUE_FALSE,The earth is flat.,,,,,FALSE,1\n' +
            'TEXTAREA,Explain photosynthesis.,,,,,,5\n';
          const blob = new Blob([template], { type: 'text/csv' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'import-template.csv';
          link.click();
        }}
      >
        {$t('components.exam.import.download_template')}
      </button>
    </div>

    <!-- Stats -->
    {#if parseResults.length > 0}
      <div class="flex items-center gap-4 mb-4 text-sm">
        <span class="text-gray-600 dark:text-gray-300">
          {$t('components.exam.import.total_rows')}: <strong>{totalRows}</strong>
        </span>
        <span class="text-green-600 dark:text-green-400">
          {$t('components.exam.import.valid_rows')}: <strong>{validRows}</strong>
        </span>
        <span class="text-red-600 dark:text-red-400">
          {$t('components.exam.import.error_rows')}: <strong>{errorRows}</strong>
        </span>
      </div>
    {/if}

    <!-- Preview -->
    {#if parseResults.length > 0}
      <div class="flex-1 overflow-y-auto border border-gray-200 dark:border-neutral-600 rounded-md">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-neutral-800 sticky top-0">
            <tr>
              <th class="px-3 py-2 text-left w-12">#</th>
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_status')}</th>
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_type')}</th>
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_title')}</th>
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_errors')}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-neutral-700">
            {#each parseResults as result}
              <tr class={result.valid ? '' : 'bg-red-50 dark:bg-red-900/10'}>
                <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{result.row}</td>
                <td class="px-3 py-2">
                  {#if result.valid}
                    <span class="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                      <CheckmarkFilledIcon size={14} />
                      {$t('components.exam.import.valid')}
                    </span>
                  {:else}
                    <span class="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs">
                      <WarningIcon size={14} />
                      {$t('components.exam.import.invalid')}
                    </span>
                  {/if}
                </td>
                <td class="px-3 py-2 dark:text-white">{result.raw.question_type || '-'}</td>
                <td class="px-3 py-2 dark:text-white truncate max-w-xs">{result.raw.title || '-'}</td>
                <td class="px-3 py-2 text-xs text-red-600 dark:text-red-400 max-w-xs">
                  {result.errors.join('; ')}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else if isParsing}
      <div class="flex items-center justify-center py-10">
        <p class="dark:text-white">{$t('components.exam.import.parsing')}</p>
      </div>
    {/if}

    <!-- Footer -->
    <div class="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-600 flex justify-end gap-3">
      <PrimaryButton
        variant={VARIANTS.OUTLINED}
        onClick={() => {
          reset();
          onClose();
        }}
        label={$t('components.exam.result.back')}
      />
      <PrimaryButton
        variant={VARIANTS.CONTAINED}
        onClick={handleImport}
        isDisabled={!hasValid}
        label={$t('components.exam.import.import_button')}
      />
    </div>
  </div>
</Modal>
