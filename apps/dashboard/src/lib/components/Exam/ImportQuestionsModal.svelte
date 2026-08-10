<script lang="ts">
  import Modal from '$lib/components/Modal/index.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import { t, locale } from '$lib/utils/functions/translations';
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
  let parseNotice: string | null = null;
  let detectedEncoding = '';
  /** which automatic repairs sanitizeCsvText had to apply, surfaced to the user */
  let repairNotes: string[] = [];

  const REPAIR_LABEL: Record<string, { zh: string; hant: string; en: string }> = {
    markdown: {
      zh: '已移除 Markdown 代码围栏',
      hant: '已移除 Markdown 程式碼圍欄',
      en: 'Removed a markdown code fence'
    },
    preamble: {
      zh: '已跳过表头之前的说明文字',
      hant: '已略過表頭之前的說明文字',
      en: 'Skipped text before the header row'
    },
    fullwidth: {
      zh: '已把全角逗号「，」转换为半角「,」',
      hant: '已把全形逗號「，」轉換為半形「,」',
      en: 'Converted full-width commas to ASCII commas'
    }
  };
  $: repairMessages = repairNotes
    .map((n) => REPAIR_LABEL[n])
    .filter(Boolean)
    .map((l) =>
      $locale === 'zh' ? l.zh : String($locale).toLowerCase().includes('zh') ? l.hant : l.en
    );
  let aiPromptCopied = false;
  let aiPromptCopyTimer: ReturnType<typeof setTimeout> | null = null;

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  const MAX_IMPORT_QUESTIONS = 20;

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
    prompt: 'title',
    stem: 'title',
    題目: 'title',
    题目: 'title',
    問題: 'title',
    问题: 'title',
    題幹: 'title',
    题干: 'title',
    image: 'image_url',
    imageurl: 'image_url',
    questionimage: 'image_url',
    questionimageurl: 'image_url',
    promptimage: 'image_url',
    stemimage: 'image_url',
    圖片: 'image_url',
    图片: 'image_url',
    題目圖片: 'image_url',
    题目图片: 'image_url',
    題目圖片連結: 'image_url',
    题目图片链接: 'image_url',
    圖片連結: 'image_url',
    图片链接: 'image_url',
    correct: 'correct_answer',
    answer: 'correct_answer',
    correctanswer: 'correct_answer',
    correctoption: 'correct_answer',
    correctchoice: 'correct_answer',
    standardanswer: 'correct_answer',
    rightanswer: 'correct_answer',
    key: 'correct_answer',
    答案: 'correct_answer',
    正確答案: 'correct_answer',
    正确答案: 'correct_answer',
    正確選項: 'correct_answer',
    正确选项: 'correct_answer',
    標準答案: 'correct_answer',
    标准答案: 'correct_answer',
    參考答案: 'correct_answer',
    参考答案: 'correct_answer',
    points: 'points',
    point: 'points',
    score: 'points',
    marks: 'points',
    weight: 'points',
    分數: 'points',
    分数: 'points',
    分值: 'points',
    得分: 'points',
    explanation: 'explanation',
    analysis: 'explanation',
    rationale: 'explanation',
    solution: 'explanation',
    reason: 'explanation',
    feedback: 'explanation',
    options: 'option_text',
    optionlist: 'option_text',
    choices: 'option_text',
    choicelist: 'option_text',
    選項: 'option_text',
    选项: 'option_text',
    選項列表: 'option_text',
    选项列表: 'option_text',
    解析: 'explanation',
    詳解: 'explanation',
    详解: 'explanation',
    解釋: 'explanation',
    解释: 'explanation',
    答案解析: 'explanation',
    參考解析: 'explanation',
    参考解析: 'explanation',
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

  function translateOr(key: string, fallback: string) {
    const translated = $t(key);
    return translated === key ? fallback : translated;
  }

  function formatImportLimitNotice(remaining: number) {
    return translateOr(
      'components.exam.import.limit_notice',
      'Up to {max} questions can be imported at once. The first {max} questions were read and {remaining} were skipped.'
    )
      .replaceAll('{max}', String(MAX_IMPORT_QUESTIONS))
      .replace('{remaining}', String(remaining));
  }

  function getAiPromptText() {
    return translateOr(
      'components.exam.import.ai_prompt_text',
      // Rewritten after testing the old prompt against a real model. It asked for
      // 18 columns including 选项E/F that most questions do not use, and the model
      // produced rows with 17 fields, shifting every value and failing all rows.
      // It also emitted full-width commas, a leading sentence of narration and
      // broken quote escaping. This version drops to A-D and states each of those
      // constraints explicitly, because "follow CSV rules" was not enough.
      `请把我提供的题目整理成 ailaeclass 可以导入的 CSV。

【最重要的三条】
1. 只输出 CSV 本身。不要写任何说明文字，不要用 \`\`\` 代码围栏包起来。
2. 只使用半角逗号 , 作为分隔符。绝对不要使用全角逗号 ，
3. 每一行的逗号数量必须和表头完全一致。用不到的列留空，但逗号要保留。

【表头，原样复制这一行】
题型,题目,题目图片,选项A,选项A图片,选项B,选项B图片,选项C,选项C图片,选项D,选项D图片,答案,分数,答案解析

【填写规则】
- 题型只能是：单选题、多选题、判断题、问答题
- 单选题：答案写一个字母，例如 A
- 多选题：答案用半角分号分隔，例如 A;C;D
- 判断题：选项A填「对」、选项B填「错」，选项C和选项D留空，答案填「对」或「错」
- 问答题：所有选项列和答案列留空，把评分要点写在答案解析里
- 分数必须是数字，没有特别要求就填 1
- 图片列填可公开访问的 https 图片地址；没有图片就留空。CSV 无法嵌入本地图片文件
- 如果某个格子里含有逗号或引号，用英文双引号把整个格子包起来，格子内部的双引号写成两个

【一行正确示例】
单选题,起飞前应先检查什么？,,螺旋桨与电量,,直接起飞,,只看电量,,人群上方试飞,,A,1,起飞前必须完整检查机身与电量。

现在请把下面的内容整理成上述 CSV 格式：`
    );
  }

  async function copyAiPrompt() {
    const text = getAiPromptText();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      aiPromptCopied = true;
      if (aiPromptCopyTimer) clearTimeout(aiPromptCopyTimer);
      aiPromptCopyTimer = setTimeout(() => (aiPromptCopied = false), 1800);
    } catch (err) {
      console.error('Copy AI import prompt failed:', err);
    }
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
      .replace(/[（(【\[].*?[）)】\]]/g, '')
      .replace(/[()\[\]{}（）【】]/g, '')
      .replace(/[\s_\-./\\:：,，;；|]+/g, '');

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

    const optionNumberMatch = compact.match(/^(option|choice|選項|选项)?([1-9]|1[0-9]|2[0-6])$/i);
    if (optionNumberMatch) {
      const letter = OPTION_LETTERS[Number(optionNumberMatch[2]) - 1];
      return `option_${letter.toLowerCase()}`;
    }

    const optionImageLetter = getOptionImageHeaderLetter(compact);
    if (optionImageLetter) return `option_${optionImageLetter.toLowerCase()}_image_url`;

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

  function getOptionImageHeaderLetter(compact: string) {
    const patterns = [
      /^(?:option|choice)([a-z])(?:image|img|imageurl)$/i,
      /^(?:選項|选项)([a-z])(?:圖片|图片|圖片連結|图片链接)$/i,
      /^([a-z])(?:image|img|imageurl|圖片|图片|圖片連結|图片链接)$/i,
      /^(?:image|img|imageurl|圖片|图片|圖片連結|图片链接)([a-z])$/i
    ];

    for (const pattern of patterns) {
      const match = compact.match(pattern);
      const letter = match?.[1]?.toUpperCase();
      if (letter && OPTION_LETTERS.includes(letter)) return letter;
    }

    return '';
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
      if ((hasTrueFalseAnswer || looksTrueFalseOptions) && (optionCount === 0 || looksTrueFalseOptions)) {
        return QUESTION_TYPE.TRUE_FALSE;
      }
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
      .replace(/^[A-Z0-9]+\s*[.、．):：-]\s*/i, '')
      .replace(/^[（(]\s*[A-Z0-9]+\s*[）)]\s*/i, '')
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

    let tokens = raw
      .replace(/[，、]/g, ';')
      .split(/[;；|/\\]+/)
      .map(normalizeText)
      .filter(Boolean);
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

        if (/^([1-9]|1[0-9]|2[0-6])$/.test(rawLetter)) {
          const letter = OPTION_LETTERS[Number(rawLetter) - 1];
          if (optionRows.some((option) => option.letter === letter)) return letter;
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
    const explicitOptions = OPTION_LETTERS.map((letter) => {
      const key = `option_${letter.toLowerCase()}`;
      return {
        letter,
        label: normalizeText(row[key])
      };
    }).filter((option) => option.label);

    if (explicitOptions.length > 0) return explicitOptions;
    return parseCombinedOptions(row.option_text || '');
  }

  function parseCombinedOptions(value: string) {
    const raw = normalizeText(value);
    if (!raw) return [];

    const markerPattern = /(?:^|[\s;；|\n])([A-Z]|[1-9]|1[0-9]|2[0-6])\s*[.、．):：-]\s*/gi;
    const matches = Array.from(raw.matchAll(markerPattern));

    if (matches.length > 0) {
      return matches
        .map((match, index) => {
          const start = (match.index || 0) + match[0].length;
          const end = index + 1 < matches.length ? matches[index + 1].index || raw.length : raw.length;
          const marker = match[1].toUpperCase();
          const numeric = Number(marker);
          const letter = Number.isFinite(numeric) && numeric > 0 ? OPTION_LETTERS[numeric - 1] : marker;
          return {
            letter,
            label: stripOptionPrefix(raw.slice(start, end).replace(/^[;；|\s]+|[;；|\s]+$/g, ''))
          };
        })
        .filter((option) => OPTION_LETTERS.includes(option.letter) && option.label);
    }

    return raw
      .split(/[;；|\n]+/)
      .map(normalizeText)
      .filter(Boolean)
      .slice(0, OPTION_LETTERS.length)
      .map((label, index) => ({
        letter: OPTION_LETTERS[index],
        label: stripOptionPrefix(label)
      }))
      .filter((option) => option.label);
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

  function makeImage(value: string, alt: string) {
    const url = normalizeText(value);
    if (!url) return null;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:image/')) return null;

    return {
      url,
      key: url,
      alt: alt || 'Imported image'
    };
  }

  function getQuestionTypeLabel(typeId?: number) {
    if (typeId === QUESTION_TYPE.RADIO) return $t('course.navItem.lessons.exercises.all_exercises.edit_mode.question_types.single');
    if (typeId === QUESTION_TYPE.CHECKBOX) return $t('course.navItem.lessons.exercises.all_exercises.edit_mode.question_types.multiple');
    if (typeId === QUESTION_TYPE.TEXTAREA) return $t('course.navItem.lessons.exercises.all_exercises.edit_mode.question_types.paragraph');
    if (typeId === QUESTION_TYPE.TRUE_FALSE) return $t('components.exam.question_type.true_false');
    return '-';
  }

  function countImages(result: ParseResult) {
    const questionImages = result.question?.metadata?.image?.url ? 1 : 0;
    const optionImages = (result.question?.options || []).filter((option) => option.metadata?.image?.url).length;
    return questionImages + optionImages;
  }

  function getOptionImage(row: Record<string, string>, letter: string, optionLabel: string) {
    return makeImage(row[`option_${letter.toLowerCase()}_image_url`], optionLabel || `Option ${letter}`);
  }

  function validateRow(row: Record<string, string>, rowIndex: number): ParseResult {
    const errors: string[] = [];
    let typeId = normalizeType(row.question_type || '', row);

    const title = normalizeText(row.title);
    const questionImage = makeImage(row.image_url, title || `Question ${rowIndex + 1}`);
    if (!title && !questionImage) {
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
        options = optionRows.map((option) => {
          const label = stripOptionPrefix(option.label);
          const created = makeOption(label, option.letter === correct);
          const image = getOptionImage(row, option.letter, label);
          if (image) created.metadata = { ...created.metadata, image };
          return created;
        });
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
        options = optionRows.map((option) => {
          const label = stripOptionPrefix(option.label);
          const created = makeOption(label, correctSet.has(option.letter));
          const image = getOptionImage(row, option.letter, label);
          if (image) created.metadata = { ...created.metadata, image };
          return created;
        });
      }
    } else if (typeId === QUESTION_TYPE.TRUE_FALSE) {
      let correct = correctTokens[0];
      const matchedOption = optionRows.find((option) => option.letter === correct);
      if (matchedOption) {
        correct = normalizeCorrectToken(matchedOption.label);
      }
      if (!correct) {
        errors.push($t('components.exam.import.error_no_correct'));
      } else if (correct !== 'TRUE' && correct !== 'FALSE') {
        errors.push($t('components.exam.import.error_invalid_correct'));
      }
      options = [
        makeOption(stripOptionPrefix(optionRows[0]?.label || 'True'), correct === 'TRUE'),
        makeOption(stripOptionPrefix(optionRows[1]?.label || 'False'), correct === 'FALSE')
      ].map((option, index) => {
        const letter = OPTION_LETTERS[index];
        const image = getOptionImage(row, letter, option.label);
        if (image) option.metadata = { ...option.metadata, image };
        return option;
      });
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
        explanation: normalizeText(row.explanation),
        ...(questionImage ? { image: questionImage } : {})
      },
      is_dirty: true
    };

    return { row: rowIndex + 1, valid: true, errors: [], question, raw: row };
  }

  function hasMeaningfulRow(row: Record<string, string>) {
    return Object.entries(row).some(([key, value]) => key !== '__parsed_extra' && normalizeText(value));
  }

  function countReplacementChars(value: string) {
    return (value.match(/\uFFFD/g) || []).length;
  }

  function scoreDecodedText(value: string) {
    const firstLine = normalizeText(value.split(/\r?\n/).find((line) => normalizeText(line)) || '');
    const headers = firstLine.split(/[,\t;，]/).map(normalizeHeader);
    const recognizedHeaders = headers.filter((header) =>
      ['question_type', 'title', 'correct_answer', 'points', 'explanation', 'option_text'].includes(header) ||
      /^option_[a-z]$/.test(header)
    ).length;
    return recognizedHeaders * 20 - countReplacementChars(value) * 5 - (value.includes('锟') ? 10 : 0);
  }

  async function decodeFile(fileToDecode: File) {
    const buffer = await fileToDecode.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const candidates: { label: string; text: string; score: number }[] = [];
    const encodings =
      bytes[0] === 0xff && bytes[1] === 0xfe
        ? ['utf-16le']
        : bytes[0] === 0xfe && bytes[1] === 0xff
          ? ['utf-16be']
          : ['utf-8', 'gb18030', 'big5'];

    for (const label of encodings) {
      try {
        const text = new TextDecoder(label).decode(buffer).replace(/^\uFEFF/, '');
        candidates.push({ label, text, score: scoreDecodedText(text) });
      } catch {
        // Some browsers may not support every legacy encoding label.
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] || { label: 'utf-8', text: await fileToDecode.text(), score: 0 };
    detectedEncoding = best.label.toUpperCase();
    return best.text;
  }

  // What an AI actually hands back is rarely a clean CSV. Tested against real
  // Kimi output and the shapes it produces run to run: full-width commas (Chinese
  // input methods emit them by default), a ```csv fence, and a sentence of
  // narration before the data. Each of those made every row fail. Repair them
  // here rather than telling the user to go fix their file by hand.
  function sanitizeCsvText(raw: string) {
    const notes: string[] = [];
    let text = raw.replace(/\r\n?/g, '\n');

    // 1. strip a markdown code fence
    const fenced = text.match(/^\s*```[a-zA-Z]*\s*\n([\s\S]*?)\n?\s*```\s*$/);
    if (fenced) {
      text = fenced[1];
      notes.push('markdown');
    }

    let lines = text.split('\n');

    // 2. drop anything before the header row. Look for a line that mentions a
    //    known header word AND is split into several fields by some delimiter.
    const HEADER_HINT = /(题型|題型|question_?type|题目|題目|title)/i;
    const headerIndex = lines.findIndex(
      (l) => HEADER_HINT.test(l) && l.split(/[,\t;，；]/).length >= 3
    );
    if (headerIndex > 0) {
      lines = lines.slice(headerIndex);
      notes.push('preamble');
    }

    // 3. Full-width delimiters. Chinese models emit these no matter how firmly the
    //    prompt forbids them -- verified against a real model, which produced a
    //    header of 13 full-width commas and zero ASCII ones even when told not to.
    //    The catch is that a question legitimately contains Chinese commas of its
    //    own, so a blanket replace would split fields apart.
    //
    //    Use the header as the anchor: normalise it first to learn the expected
    //    column count, then for each data row only accept the conversion if it
    //    brings that row closer to the expected number of columns.
    let fullWidthLines = 0;
    const countFields = (line: string, delim: string) => line.split(delim).length;

    if (lines.length) {
      const head = lines[0];
      const headFull = (head.match(/，/g) || []).length;
      const headAscii = (head.match(/,/g) || []).length;
      if (headFull >= 2 && headFull > headAscii) {
        lines[0] = head.replace(/，/g, ',');
        fullWidthLines += 1;
      }
    }

    const expected = lines.length ? countFields(lines[0], ',') : 0;
    if (expected >= 3) {
      lines = lines.map((line, i) => {
        if (i === 0 || !line.includes('，')) return line;
        const asIs = countFields(line, ',');
        if (asIs === expected) return line; // already lines up, leave the text alone
        const converted = line.replace(/，/g, ',');
        if (Math.abs(countFields(converted, ',') - expected) < Math.abs(asIs - expected)) {
          fullWidthLines += 1;
          return converted;
        }
        return line;
      });
    }
    if (fullWidthLines) notes.push('fullwidth');

    // 4. Pad short rows. A row missing trailing empties would otherwise shift
    //    nothing but still trip Papa's "too few fields" warning.
    if (expected >= 3) {
      lines = lines.map((line, i) => {
        if (i === 0 || !line.trim()) return line;
        const missing = expected - countFields(line, ',');
        return missing > 0 && missing <= 4 ? line + ','.repeat(missing) : line;
      });
    }

    return { text: lines.join('\n'), notes, expectedColumns: expected };
  }

  function parseTextRows(text: string) {
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizeHeader,
      transform: normalizeText
    });

    const rows = (parsed.data || []).filter(hasMeaningfulRow);
    const fields = parsed.meta.fields || [];
    const hasRecognizedHeader = fields.some((field) =>
      ['question_type', 'title', 'correct_answer', 'points', 'explanation', 'option_text'].includes(field) ||
      /^option_[a-z]$/.test(field)
    );

    if (hasRecognizedHeader) {
      return { rows, errors: parsed.errors };
    }

    const fallback = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: 'greedy',
      transform: normalizeText
    });
    const fallbackRows = (fallback.data || [])
      .filter((row) => row.some((cell) => normalizeText(cell)))
      .map((row) => ({
        question_type: row[0] || '',
        title: row[1] || '',
        option_a: row[2] || '',
        option_b: row[3] || '',
        option_c: row[4] || '',
        option_d: row[5] || '',
        option_e: row[6] || '',
        option_f: row[7] || '',
        correct_answer: row[8] || '',
        points: row[9] || '',
        explanation: row[10] || ''
      }))
      .filter(hasMeaningfulRow);

    return { rows: fallbackRows, errors: fallback.errors };
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
      parseNotice = null;
      file = selected;
      parseFile();
    }
  }

  async function parseFile() {
    if (!file) return;
    isParsing = true;
    parseResults = [];
    parseError = null;
    parseNotice = null;
    repairNotes = [];

    try {
      const decoded = await decodeFile(file);
      const { text, notes: repairs } = sanitizeCsvText(decoded);
      const { rows, errors } = parseTextRows(text);
      repairNotes = repairs;
      const importRows = rows.slice(0, MAX_IMPORT_QUESTIONS);
      parseResults = importRows.map((row, i) => validateRow(row, i));

      if (rows.length > MAX_IMPORT_QUESTIONS) {
        parseNotice = formatImportLimitNotice(rows.length - MAX_IMPORT_QUESTIONS);
      } else if (rows.length === 0) {
        parseError = $t('components.exam.import.error_parse_failed');
      } else if (errors.length > 0) {
        // Papa's own wording ("Too few fields: expected 18 fields but parsed 17")
        // tells the user nothing they can act on. Say what to do about it.
        const fieldIssue = errors.find((e: any) => /TooFewFields|TooManyFields/i.test(e?.code || ''));
        parseNotice = fieldIssue
          ? $locale === 'zh'
            ? '有些行的列数和表头对不上，通常是 AI 少写或多写了逗号。请回到 AI 那里说明「每行逗号数量必须和表头一致，用不到的列留空但逗号要保留」，或直接在下方预览表里改正标红的行。'
            : String($locale).toLowerCase().includes('zh')
              ? '有些列的欄數和表頭對不上，通常是 AI 少寫或多寫了逗號。請回到 AI 那裡說明「每行逗號數量必須和表頭一致，用不到的欄留空但逗號要保留」，或直接在下方預覽表修正標紅的列。'
              : 'Some rows have a different number of columns than the header, usually because the AI wrote too few or too many commas. Ask it to keep the comma count identical to the header and leave unused columns empty, or fix the highlighted rows in the preview below.'
          : errors[0]?.message || $t('components.exam.import.error_parse_failed');
      }
    } catch (err) {
      console.error('CSV parse error', err);
      parseError = $t('components.exam.import.error_parse_failed');
    } finally {
      isParsing = false;
    }
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
        题目图片: '',
        选项A: '5',
        选项A图片: '',
        选项B: '6',
        选项B图片: '',
        选项C: '7',
        选项C图片: '',
        选项D: '8',
        选项D图片: '',
        选项E: '',
        选项E图片: '',
        选项F: '',
        选项F图片: '',
        答案: 'C',
        分数: '1',
        答案解析: '5 + 2 = 7，所以正确答案是 C。'
      },
      {
        题型: '多选题',
        题目: '以下哪些是质数？',
        题目图片: '',
        选项A: '2',
        选项A图片: '',
        选项B: '3',
        选项B图片: '',
        选项C: '4',
        选项C图片: '',
        选项D: '5',
        选项D图片: '',
        选项E: '6',
        选项E图片: '',
        选项F: '7',
        选项F图片: '',
        答案: 'A;B;D;F',
        分数: '2',
        答案解析: '2、3、5、7 只能被 1 和它本身整除，所以是质数。'
      },
      {
        题型: '判断题',
        题目: '香港位于中国南部。',
        题目图片: '',
        选项A: '对',
        选项A图片: '',
        选项B: '错',
        选项B图片: '',
        选项C: '',
        选项C图片: '',
        选项D: '',
        选项D图片: '',
        选项E: '',
        选项E图片: '',
        选项F: '',
        选项F图片: '',
        答案: '对',
        分数: '1',
        答案解析: '香港位于中国南部、珠江口以东。'
      },
      {
        题型: '问答题',
        题目: '请简单解释光合作用。',
        题目图片: '',
        选项A: '',
        选项A图片: '',
        选项B: '',
        选项B图片: '',
        选项C: '',
        选项C图片: '',
        选项D: '',
        选项D图片: '',
        选项E: '',
        选项E图片: '',
        选项F: '',
        选项F图片: '',
        答案: '',
        分数: '5',
        答案解析: '参考要点：植物利用阳光、水和二氧化碳制造养分，并释放氧气。'
      },
      {
        题型: '',
        题目: '没有填写题型时，若有多个答案，系统会自动识别为多选。',
        题目图片: '',
        选项A: '红色',
        选项A图片: '',
        选项B: '蓝色',
        选项B图片: '',
        选项C: '绿色',
        选项C图片: '',
        选项D: '声音',
        选项D图片: '',
        选项E: '',
        选项E图片: '',
        选项F: '',
        选项F图片: '',
        答案: '红色;蓝色;绿色',
        分数: '2',
        答案解析: '答案也可以直接写完整选项文字，不一定要写 A、B、C。'
      },
      {
        题型: '单选题',
        题目: '如果需要图片题，请在题目图片列填写可访问的 https 图片 URL。',
        题目图片: '',
        选项A: '无人机',
        选项A图片: '',
        选项B: '显微镜',
        选项B图片: '',
        选项C: '天文望远镜',
        选项C图片: '',
        选项D: '示波器',
        选项D图片: '',
        选项E: '',
        选项E图片: '',
        选项F: '',
        选项F图片: '',
        答案: 'A',
        分数: '1',
        答案解析: '图片题可以在题目图片列填写可访问的 https 图片 URL。'
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
    parseNotice = null;
    detectedEncoding = '';
    repairNotes = [];
    aiPromptCopied = false;
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
  containerClass="flex h-[85vh] flex-col !max-h-[85vh] overflow-hidden"
>
  <div class="flex min-h-0 h-full flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
      <!-- AI prompt copy helper -->
      <div
        class="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
      >
        <div class="mb-2 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="font-semibold">{$t('components.exam.import.ai_prompt_title')}</p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {$t('components.exam.import.ai_prompt_desc')}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md border border-primary-200 px-3 py-1.5 text-xs font-medium text-primary-800 hover:bg-primary-50 dark:border-neutral-600 dark:text-white dark:hover:bg-neutral-800"
            on:click={copyAiPrompt}
          >
            {aiPromptCopied
              ? $t('components.exam.import.ai_prompt_copied')
              : $t('components.exam.import.ai_prompt_copy')}
          </button>
        </div>
        <textarea
          readonly
          rows="5"
          class="w-full resize-y rounded-md border border-gray-200 bg-white p-2 text-xs leading-5 text-gray-700 dark:border-neutral-700 dark:bg-black dark:text-gray-200"
          value={getAiPromptText()}
        />
        <p class="mt-2 text-xs text-amber-700 dark:text-amber-200">
          {$t('components.exam.import.csv_image_note')}
        </p>
      </div>

      <!-- File upload -->
      <div class="mb-4">
        <label
          class="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 transition"
        >
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" class="hidden" on:change={handleFileSelect} />
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

    {#if parseNotice}
      <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
        <WarningIcon size={18} />
        <span>{parseNotice}</span>
      </div>
    {/if}

    <!-- Template download -->
    <div
      class="mb-4 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-100"
    >
      {$t('components.exam.import.how_it_works')}
      <div class="mt-1">
        {translateOr(
      'components.exam.import.limit_hint',
          'Up to 20 questions can be imported at once. CSV and TSV files are supported; save Excel files as CSV before uploading. For images, enter accessible image URLs.'
        )}
      </div>
    </div>

    {#if detectedEncoding}
      <div class="mb-4 text-xs text-gray-500 dark:text-gray-400">
        {translateOr('components.exam.import.detected_encoding', 'Detected encoding')}: {detectedEncoding}
      </div>
    {/if}

    {#if repairMessages.length}
      <!-- Say what was auto-corrected. Silently fixing the file would leave the
           user guessing why their AI output behaved differently next time. -->
      <div
        class="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
      >
        <p class="mb-1 font-semibold">
          {$locale === 'zh'
            ? '已自动修正 AI 输出的常见格式问题：'
            : String($locale).toLowerCase().includes('zh')
              ? '已自動修正 AI 輸出的常見格式問題：'
              : 'Automatically corrected common AI formatting issues:'}
        </p>
        <ul class="list-disc pl-4">
          {#each repairMessages as msg}
            <li>{msg}</li>
          {/each}
        </ul>
      </div>
    {/if}

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
        <div class="min-h-[14rem] max-h-[42vh] overflow-auto rounded-md border border-gray-200 dark:border-neutral-600">
        <table class="min-w-[900px] w-full text-sm">
          <thead class="bg-gray-50 dark:bg-neutral-800 sticky top-0">
            <tr>
              <th class="px-3 py-2 text-left w-12">#</th>
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_status')}</th>
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_type')}</th>
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_title')}</th>
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_options')}</th>
              <th class="px-3 py-2 text-left">{$t('components.exam.import.row_images')}</th>
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
                <td class="px-3 py-2 dark:text-white">
                  {getQuestionTypeLabel(result.question?.question_type?.id)}
                </td>
                <td class="px-3 py-2 dark:text-white truncate max-w-xs">{result.raw.title || '-'}</td>
                <td class="px-3 py-2 dark:text-white">{result.question?.options?.length || 0}</td>
                <td class="px-3 py-2 dark:text-white">{countImages(result)}</td>
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
    </div>

    <!-- Footer -->
    <div class="shrink-0 mt-4 pt-4 border-t border-gray-200 dark:border-neutral-600 flex justify-end gap-3">
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
