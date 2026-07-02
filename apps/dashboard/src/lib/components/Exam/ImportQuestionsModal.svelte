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
    SINGLE: QUESTION_TYPE.RADIO,
    SINGLE_CHOICE: QUESTION_TYPE.RADIO,
    SINGLECHOICE: QUESTION_TYPE.RADIO,
    MCQ: QUESTION_TYPE.RADIO,
    MULTIPLE: QUESTION_TYPE.CHECKBOX,
    MULTIPLE_CHOICE: QUESTION_TYPE.CHECKBOX,
    MULTIPLECHOICE: QUESTION_TYPE.CHECKBOX,
    CHECKBOX: QUESTION_TYPE.CHECKBOX,
    MULTI: QUESTION_TYPE.CHECKBOX,
    MULTI_CHOICE: QUESTION_TYPE.CHECKBOX,
    MULTICHOICE: QUESTION_TYPE.CHECKBOX,
    TEXTAREA: QUESTION_TYPE.TEXTAREA,
    TEXT: QUESTION_TYPE.TEXTAREA,
    SHORT_ANSWER: QUESTION_TYPE.TEXTAREA,
    SHORTANSWER: QUESTION_TYPE.TEXTAREA,
    OPEN_ANSWER: QUESTION_TYPE.TEXTAREA,
    OPENANSWER: QUESTION_TYPE.TEXTAREA,
    ESSAY: QUESTION_TYPE.TEXTAREA,
    TRUE_FALSE: QUESTION_TYPE.TRUE_FALSE,
    TRUEFALSE: QUESTION_TYPE.TRUE_FALSE,
    TF: QUESTION_TYPE.TRUE_FALSE,
    '單選': QUESTION_TYPE.RADIO,
    '單選題': QUESTION_TYPE.RADIO,
    '单选': QUESTION_TYPE.RADIO,
    '单选题': QUESTION_TYPE.RADIO,
    '選擇題': QUESTION_TYPE.RADIO,
    '选择题': QUESTION_TYPE.RADIO,
    '單項選擇': QUESTION_TYPE.RADIO,
    '單項選擇題': QUESTION_TYPE.RADIO,
    '单项选择': QUESTION_TYPE.RADIO,
    '单项选择题': QUESTION_TYPE.RADIO,
    '客觀題': QUESTION_TYPE.RADIO,
    '客观题': QUESTION_TYPE.RADIO,
    '多選': QUESTION_TYPE.CHECKBOX,
    '多選題': QUESTION_TYPE.CHECKBOX,
    '多选': QUESTION_TYPE.CHECKBOX,
    '多选题': QUESTION_TYPE.CHECKBOX,
    '多項選擇': QUESTION_TYPE.CHECKBOX,
    '多項選擇題': QUESTION_TYPE.CHECKBOX,
    '多项选择': QUESTION_TYPE.CHECKBOX,
    '多项选择题': QUESTION_TYPE.CHECKBOX,
    '不定項': QUESTION_TYPE.CHECKBOX,
    '不定项': QUESTION_TYPE.CHECKBOX,
    '不定項選擇': QUESTION_TYPE.CHECKBOX,
    '不定项选择': QUESTION_TYPE.CHECKBOX,
    '問答': QUESTION_TYPE.TEXTAREA,
    '问答': QUESTION_TYPE.TEXTAREA,
    '問答題': QUESTION_TYPE.TEXTAREA,
    '问答题': QUESTION_TYPE.TEXTAREA,
    '簡答': QUESTION_TYPE.TEXTAREA,
    '简答': QUESTION_TYPE.TEXTAREA,
    '簡答題': QUESTION_TYPE.TEXTAREA,
    '简答题': QUESTION_TYPE.TEXTAREA,
    '填空': QUESTION_TYPE.TEXTAREA,
    '填空題': QUESTION_TYPE.TEXTAREA,
    '填空题': QUESTION_TYPE.TEXTAREA,
    '判斷': QUESTION_TYPE.TRUE_FALSE,
    '判斷題': QUESTION_TYPE.TRUE_FALSE,
    '判断': QUESTION_TYPE.TRUE_FALSE,
    '判断题': QUESTION_TYPE.TRUE_FALSE,
    '是非': QUESTION_TYPE.TRUE_FALSE,
    '是非題': QUESTION_TYPE.TRUE_FALSE,
    '是非题': QUESTION_TYPE.TRUE_FALSE,
    '對錯': QUESTION_TYPE.TRUE_FALSE,
    '对错': QUESTION_TYPE.TRUE_FALSE,
    '對錯題': QUESTION_TYPE.TRUE_FALSE,
    '对错题': QUESTION_TYPE.TRUE_FALSE
  };

  const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const HEADER_ALIASES: Record<string, string> = {
    questiontype: 'question_type',
    type: 'question_type',
    題型: 'question_type',
    题型: 'question_type',
    題目類型: 'question_type',
    题目类型: 'question_type',
    question: 'title',
    questiontitle: 'title',
    title: 'title',
    題目: 'title',
    题目: 'title',
    問題: 'title',
    问题: 'title',
    題幹: 'title',
    题干: 'title',
    correct: 'correct_answer',
    answer: 'correct_answer',
    correctanswer: 'correct_answer',
    standardanswer: 'correct_answer',
    rightanswer: 'correct_answer',
    key: 'correct_answer',
    答案: 'correct_answer',
    正確答案: 'correct_answer',
    正确答案: 'correct_answer',
    標準答案: 'correct_answer',
    标准答案: 'correct_answer',
    參考答案: 'correct_answer',
    参考答案: 'correct_answer',
    points: 'points',
    point: 'points',
    score: 'points',
    marks: 'points',
    分數: 'points',
    分数: 'points',
    得分: 'points',
    explanation: 'explanation',
    analysis: 'explanation',
    rationale: 'explanation',
    solution: 'explanation',
    reason: 'explanation',
    feedback: 'explanation',
    解析: 'explanation',
    詳解: 'explanation',
    详解: 'explanation',
    解釋: 'explanation',
    解释: 'explanation',
    答案解析: 'explanation',
    答案詳解: 'explanation',
    答案详解: 'explanation',
    解題思路: 'explanation',
    解题思路: 'explanation',
    题解: 'explanation',
    題解: 'explanation'
  };

  const OPTION_HEADER_ALIASES: Record<string, string> = {
    option: 'option',
    choice: 'option',
    選項: 'option',
    选项: 'option'
  };

  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeText(value: unknown) {
    return String(value ?? '')
      .replace(/^\uFEFF/, '')
      .replace(/\u00A0/g, ' ')
      .trim();
  }

  function normalizeHeader(header: string) {
    const raw = normalizeText(header);
    const compact = raw
      .toLowerCase()
      .replace(/[()\[\]{}（）【】]/g, '')
      .replace(/[\s_\-./\\:：]+/g, '');

    if (/^(option|choice|選項|选项)?[a-z]$/i.test(compact)) {
      const letter = compact.slice(-1).toUpperCase();
      return `option_${letter.toLowerCase()}`;
    }

    if (/^[a-z](option|choice|選項|选项)$/i.test(compact)) {
      const letter = compact[0].toUpperCase();
      return `option_${letter.toLowerCase()}`;
    }

    const optionMatch = compact.match(/^(option|choice|選項|选项)([a-z])$/i);
    if (optionMatch) {
      return `option_${optionMatch[2].toLowerCase()}`;
    }

    const alias = HEADER_ALIASES[compact];
    if (alias) return alias;

    for (const [prefix, canonical] of Object.entries(OPTION_HEADER_ALIASES)) {
      if (compact.startsWith(prefix) && compact.length === prefix.length + 1) {
        const letter = compact.slice(-1).toUpperCase();
        if (OPTION_LETTERS.includes(letter)) return `${canonical}_${letter.toLowerCase()}`;
      }
    }

    return raw.toLowerCase().replace(/\s+/g, '_');
  }

  function normalizeType(typeRaw: string, row: Record<string, string>) {
    const normalized = normalizeText(typeRaw)
      .replace(/[（）()]/g, '')
      .trim();
    const compact = normalized.toUpperCase().replace(/[\s_\-]+/g, '_');
    const compactNoSeparator = compact.replace(/_/g, '');
    if (TYPE_MAP[compact]) return TYPE_MAP[compact];
    if (TYPE_MAP[compactNoSeparator]) return TYPE_MAP[compactNoSeparator];
    if (TYPE_MAP[normalized]) return TYPE_MAP[normalized];

    const optionCount = getOptionRows(row).length;
    const correctTokens = parseCorrectAnswers(row.correct_answer || '', getOptionRows(row));
    const hasTrueFalseAnswer = correctTokens.some((token) => token === 'TRUE' || token === 'FALSE');
    const looksTrueFalseOptions =
      optionCount === 2 &&
      getOptionRows(row).every((option) => {
        const token = normalizeCorrectToken(option.label);
        return token === 'TRUE' || token === 'FALSE';
      });

    if (!normalized) {
      if (hasTrueFalseAnswer && (optionCount === 0 || looksTrueFalseOptions)) return QUESTION_TYPE.TRUE_FALSE;
      if (correctTokens.length > 1 && optionCount >= 2) return QUESTION_TYPE.CHECKBOX;
      if (optionCount >= 2) return QUESTION_TYPE.RADIO;
      return QUESTION_TYPE.TEXTAREA;
    }

    return undefined;
  }

  function normalizeCorrectToken(token: string) {
    const value = normalizeText(token).toUpperCase();
    const trueTokens = new Set(['TRUE', 'T', 'YES', 'Y', 'RIGHT', 'CORRECT', '對', '对', '正確', '正确', '是', '啱']);
    const falseTokens = new Set(['FALSE', 'F', 'NO', 'N', 'WRONG', 'INCORRECT', '錯', '错', '錯誤', '错误', '否', '唔啱']);
    if (trueTokens.has(value)) return 'TRUE';
    if (falseTokens.has(value)) return 'FALSE';
    const letterMatch = value.match(/^[A-Z]$/);
    return letterMatch ? letterMatch[0] : value;
  }

  function stripOptionPrefix(value: string) {
    return normalizeText(value)
      .replace(/^[A-Z]\s*[.、．):：-]\s*/i, '')
      .replace(/^[（(]\s*[A-Z]\s*[）)]\s*/i, '')
      .trim();
  }

  function tokenMatchesOption(token: string, option: { letter: string; label: string }) {
    const normalizedToken = normalizeText(token).toUpperCase();
    const normalizedLabel = normalizeText(option.label).toUpperCase();
    const strippedLabel = stripOptionPrefix(option.label).toUpperCase();
    const strippedToken = stripOptionPrefix(token).toUpperCase();

    return (
      normalizedToken === option.letter ||
      normalizedToken === normalizedLabel ||
      normalizedToken === strippedLabel ||
      strippedToken === normalizedLabel ||
      strippedToken === strippedLabel
    );
  }

  function parseCorrectAnswers(correctRaw: string, optionRows: { letter: string; label: string }[] = []) {
    const raw = normalizeText(correctRaw);
    if (!raw) return [];

    let tokens = raw.split(/[;,，；、|/\\]+/).map(normalizeText).filter(Boolean);
    if (tokens.length === 1 && /^[A-Za-z]{2,}$/.test(tokens[0])) {
      tokens = tokens[0].split('');
    }
    if (tokens.length === 1 && /\s+/.test(tokens[0])) {
      const wholeValueMatchesOption = optionRows.some((option) => tokenMatchesOption(tokens[0], option));
      const spaceSeparatedLetters = tokens[0].split(/\s+/).every((part) => /^[A-Za-z]$/.test(part));
      if (!wholeValueMatchesOption && spaceSeparatedLetters) {
        tokens = tokens[0].split(/\s+/).map(normalizeText).filter(Boolean);
      }
    }

    return tokens
      .map((token) => {
        const rawLetter = normalizeText(token).toUpperCase();
        if (/^[A-Z]$/.test(rawLetter) && optionRows.some((option) => option.letter === rawLetter)) {
          return rawLetter;
        }

        const normalized = normalizeCorrectToken(token);
        if (OPTION_LETTERS.includes(normalized) || normalized === 'TRUE' || normalized === 'FALSE') {
          return normalized;
        }

        const matchedOption = optionRows.find((option) => tokenMatchesOption(token, option));
        return matchedOption?.letter || normalized;
      })
      .filter(Boolean);
  }

  function getOptionRows(row: Record<string, string>) {
    return OPTION_LETTERS.map((letter) => {
      const key = `option_${letter.toLowerCase()}`;
      return {
        letter,
        label: normalizeText(row[key])
      };
    }).filter((option) => option.label);
  }

  function makeOption(label: string, isCorrect: boolean) {
    return {
      id: makeId(),
      label,
      value: label.split(' ').join('-'),
      is_correct: isCorrect,
      metadata: {},
      is_dirty: true
    };
  }

  function validateRow(row: Record<string, string>, rowIndex: number): ParseResult {
    const errors: string[] = [];
    let typeId = normalizeType(row.question_type || '', row);

    const title = normalizeText(row.title);
    if (!title) {
      errors.push($t('components.exam.import.error_empty_title'));
    }

    const pointsRaw = normalizeText(row.points);
    const points = pointsRaw ? parseFloat(pointsRaw) : 1;
    if (pointsRaw && (isNaN(points) || points < 0)) {
      errors.push($t('components.exam.import.error_invalid_points'));
    }

    let options: any[] = [];
    const correctRaw = normalizeText(row.correct_answer);
    const optionRows = getOptionRows(row);
    const correctTokens = parseCorrectAnswers(correctRaw, optionRows);

    if (typeId === QUESTION_TYPE.RADIO && correctTokens.length > 1) {
      typeId = QUESTION_TYPE.CHECKBOX;
    }

    if (!typeId) {
      errors.push($t('components.exam.import.error_invalid_type'));
    }

    if (typeId === QUESTION_TYPE.RADIO) {
      if (optionRows.length < 2) {
        errors.push($t('components.exam.import.error_not_enough_options'));
      }

      const correct = correctTokens[0];
      if (!correct || !OPTION_LETTERS.includes(correct)) {
        errors.push($t('components.exam.import.error_invalid_correct'));
      }

      if (optionRows.length >= 2 && OPTION_LETTERS.includes(correct)) {
        options = optionRows.map((option) => makeOption(stripOptionPrefix(option.label), option.letter === correct));
      }
    } else if (typeId === QUESTION_TYPE.CHECKBOX) {
      if (optionRows.length < 2) {
        errors.push($t('components.exam.import.error_not_enough_options'));
      }

      const correctSet = new Set(correctTokens);
      if (correctSet.size === 0) {
        errors.push($t('components.exam.import.error_no_correct'));
      } else {
        const invalid = Array.from(correctSet).filter((c) => !OPTION_LETTERS.includes(c));
        if (invalid.length > 0) {
          errors.push($t('components.exam.import.error_invalid_correct'));
        }
      }

      if (optionRows.length >= 2) {
        options = optionRows.map((option) => makeOption(stripOptionPrefix(option.label), correctSet.has(option.letter)));
      }
    } else if (typeId === QUESTION_TYPE.TRUE_FALSE) {
      const correct = correctTokens[0];
      if (!correct) {
        errors.push($t('components.exam.import.error_no_correct'));
      } else if (correct !== 'TRUE' && correct !== 'FALSE') {
        errors.push($t('components.exam.import.error_invalid_correct'));
      }
      options = [
        makeOption('True', correct === 'TRUE'),
        makeOption('False', correct === 'FALSE')
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
      metadata: {
        explanation: normalizeText(row.explanation)
      },
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
      transformHeader: normalizeHeader,
      transform: normalizeText,
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

  function downloadTemplate() {
    const templateRows = [
      {
        题型: '单选题',
        题目: '5 + 2 等于多少？',
        选项A: '5',
        选项B: '6',
        选项C: '7',
        选项D: '8',
        选项E: '',
        选项F: '',
        选项G: '',
        选项H: '',
        答案: 'C',
        分数: '1',
        答案解析: '5 + 2 = 7，所以正确答案是 C。'
      },
      {
        题型: '多选题',
        题目: '以下哪些是质数？',
        选项A: '2',
        选项B: '3',
        选项C: '4',
        选项D: '5',
        选项E: '6',
        选项F: '7',
        选项G: '',
        选项H: '',
        答案: 'A;B;D;F',
        分数: '2',
        答案解析: '2、3、5、7 只能被 1 和它本身整除，所以是质数。'
      },
      {
        题型: '判断题',
        题目: '香港位于中国南部。',
        选项A: '对',
        选项B: '错',
        选项C: '',
        选项D: '',
        选项E: '',
        选项F: '',
        选项G: '',
        选项H: '',
        答案: '对',
        分数: '1',
        答案解析: '香港位于中国南部、珠江口以东。'
      },
      {
        题型: '问答题',
        题目: '请简单解释光合作用。',
        选项A: '',
        选项B: '',
        选项C: '',
        选项D: '',
        选项E: '',
        选项F: '',
        选项G: '',
        选项H: '',
        答案: '',
        分数: '5',
        答案解析: '参考要点：植物利用阳光、水和二氧化碳制造养分，并释放氧气。'
      },
      {
        题型: '',
        题目: '没有填写题型时，若有多个答案，系统会自动识别为多选。',
        选项A: '红色',
        选项B: '蓝色',
        选项C: '绿色',
        选项D: '声音',
        选项E: '',
        选项F: '',
        选项G: '',
        选项H: '',
        答案: '红色;蓝色;绿色',
        分数: '2',
        答案解析: '答案也可以直接写完整选项文字，不一定要写 A、B、C。'
      }
    ];
    const template = `\uFEFF${Papa.unparse(templateRows)}`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ailaeclass-exam-import-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
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
    <div
      class="mb-4 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100"
    >
      {$t('components.exam.import.how_it_works')}
    </div>

    <div class="mb-4 text-right">
      <button
        class="text-sm text-primary-700 hover:underline"
        on:click={downloadTemplate}
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
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_explanation')}</th>
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
                <td class="px-3 py-2 dark:text-white truncate max-w-xs">
                  {result.raw.explanation || '-'}
                </td>
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
