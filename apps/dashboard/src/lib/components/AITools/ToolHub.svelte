<script lang="ts">
  import { tick } from 'svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import CopyButton from './CopyButton.svelte';

  type ToolId =
    | 'socratic'
    | 'vocabulary-practice'
    | 'english-writing-coach'
    | 'math-error-card'
    | 'reading-question-generator'
    | 'science-concept-map';

  type Mode = 'guided' | 'direct';

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
  }

  interface ToolConfig {
    id: ToolId;
    label: string;
    description: string;
    endpoint: string;
    fields: { key: string; label: string; rows: number; placeholder: string; required?: boolean }[];
  }

  interface VocabularyPracticeResult {
    items: Array<{
      word: string;
      meaning: string;
      example: string;
      synonyms: string[];
      blankQuestion: string;
      answer: string;
    }>;
  }

  const TOOLS: ToolConfig[] = [
    {
      id: 'socratic',
      label: '苏格拉底式学习',
      description: '一步一步引导你思考，不直接给答案。',
      endpoint: '/api/ai-tools/socratic',
      fields: [
        { key: 'message', label: '你的问题', rows: 3, placeholder: '输入你想学习的题目或问题...', required: true }
      ]
    },
    {
      id: 'vocabulary-practice',
      label: '生字句子练习器',
      description: '输入生字列表，获取解释、例句、近义词和填空题。',
      endpoint: '/api/ai-tools/vocabulary-practice',
      fields: [
        { key: 'words', label: '生字（每行一个）', rows: 4, placeholder: '例如：\n毅力\n谦虚\n勤奋', required: true },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小四 / 中一' }
      ]
    },
    {
      id: 'english-writing-coach',
      label: '英文作文改进助手',
      description: '不上传整篇改写，只给语法修正、词汇升级和修改建议。',
      endpoint: '/api/ai-tools/english-writing-coach',
      fields: [
        { key: 'essay', label: '作文内容', rows: 6, placeholder: '贴上你的英文作文...', required: true },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小五 / 中二' },
        { key: 'focus', label: '重点（可选）', rows: 1, placeholder: 'grammar / vocabulary / sentence variety' }
      ]
    },
    {
      id: 'math-error-card',
      label: '数学错题讲解卡',
      description: '输入题目和你的错误答案，AI分析错在哪里并出一道类似题。',
      endpoint: '/api/ai-tools/math-error-card',
      fields: [
        { key: 'question', label: '题目', rows: 3, placeholder: '输入数学题...', required: true },
        { key: 'studentAnswer', label: '你的答案', rows: 2, placeholder: '你当时写下的答案', required: true },
        { key: 'workingSteps', label: '你的步骤（可选）', rows: 3, placeholder: '写下你的解题步骤，帮助AI更准确定位错误' },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小四 / 中一' }
      ]
    },
    {
      id: 'reading-question-generator',
      label: '阅读理解出题器',
      description: '贴上文章，自动生成选择题和开放式问题。',
      endpoint: '/api/ai-tools/reading-question-generator',
      fields: [
        { key: 'passage', label: '文章', rows: 8, placeholder: '贴上阅读文章...', required: true },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小四 / 中二' },
        { key: 'questionCount', label: '题目数量（可选，默认5）', rows: 1, placeholder: '5' }
      ]
    },
    {
      id: 'science-concept-map',
      label: '科学概念图',
      description: '输入科学主题，生成概念节点、关系和测验。',
      endpoint: '/api/ai-tools/science-concept-map',
      fields: [
        { key: 'topic', label: '主题', rows: 2, placeholder: '例如：光合作用 / 水循环 / 电路', required: true },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小五 / 中一' },
        { key: 'keywords', label: '关键词（可选）', rows: 1, placeholder: '用逗号分隔' }
      ]
    }
  ];

  let activeTool: ToolId = 'socratic';
  let mode: Mode = 'guided';
  let isLoading = false;
  let errorMessage = '';
  let resultData: unknown = null;
  let resultText = '';

  // Socratic chat state
  let messages: ChatMessage[] = [];
  let messagesContainer: HTMLDivElement;
  let inputValues: Record<string, string> = {};

  $: activeConfig = TOOLS.find((t) => t.id === activeTool)!;

  function getErrorMessage(status: number, code?: string) {
    if (status === 401) return '请先登录。';
    if (status === 503 && code === 'missing_api_key') return 'AI 服务尚未配置，请联系管理员。';
    if (status === 502) return 'AI 服务暂时不可用，请稍后再试。';
    if (status === 400) return '请求格式不正确，请检查输入内容。';
    return '发生错误，请稍后再试。';
  }

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function getRequestHistory(currentMessages: ChatMessage[]) {
    return currentMessages
      .slice(1)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  }

  async function sendSocratic() {
    const text = (inputValues['message'] || '').trim();
    if (!text || isLoading) return;

    const previousMessages = messages;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    messages = nextMessages;
    inputValues['message'] = '';
    errorMessage = '';
    isLoading = true;
    await scrollToBottom();

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/ai-tools/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, mode, history: getRequestHistory(previousMessages) })
      });

      let data: { reply?: string; error?: string; code?: string } = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || !data.reply) {
        const friendly = getErrorMessage(response.status, data.code);
        errorMessage = friendly;
        messages = [...nextMessages, { role: 'assistant', content: friendly }];
        return;
      }

      messages = [...nextMessages, { role: 'assistant', content: data.reply }];
    } catch {
      const friendly = 'AI 服务暂时不可用，请稍后再试。';
      errorMessage = friendly;
      messages = [...nextMessages, { role: 'assistant', content: friendly }];
    } finally {
      isLoading = false;
      await scrollToBottom();
    }
  }

  async function submitTool() {
    if (isLoading) return;

    const config = activeConfig;
    const body: Record<string, unknown> = {};
    for (const field of config.fields) {
      const value = (inputValues[field.key] || '').trim();
      if (field.required && !value) {
        errorMessage = `请填写「${field.label}」`;
        return;
      }
      if (field.key === 'questionCount') {
        const n = Number(value);
        body[field.key] = Number.isFinite(n) && n > 0 ? n : 5;
      } else {
        body[field.key] = value;
      }
    }

    errorMessage = '';
    resultData = null;
    resultText = '';
    isLoading = true;

    try {
      const token = await getAccessToken();
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      let data: unknown = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const err = data as { error?: string; code?: string };
        errorMessage = getErrorMessage(response.status, err.code);
        return;
      }

      resultData = data;
      resultText = formatResultForCopy(activeTool, data);
    } catch {
      errorMessage = 'AI 服务暂时不可用，请稍后再试。';
    } finally {
      isLoading = false;
    }
  }

  function clearSocratic() {
    messages = [];
    inputValues = {};
    errorMessage = '';
  }

  function clearTool() {
    inputValues = {};
    errorMessage = '';
    resultData = null;
    resultText = '';
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (activeTool === 'socratic') sendSocratic();
    }
  }

  function stripMarkdown(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/^#{1,6}\s+/gm, '');
  }

  function isVocabularyResult(data: unknown): data is VocabularyPracticeResult {
    return !!data && typeof data === 'object' && 'items' in data && Array.isArray((data as Record<string, unknown>).items);
  }

  function isWritingCoachResult(data: unknown): data is {
    overallFeedback: string;
    corrections: Array<{ originalSentence: string; issue: string; suggestion: string }>;
    vocabularyUpgrades: Array<{ original: string; upgrade: string; reason: string }>;
    sentenceSuggestions: Array<{ originalPattern: string; suggestedPattern: string; benefit: string }>;
    priorities: string[];
    nextRevisionTask: string;
  } {
    return !!data && typeof data === 'object' && 'overallFeedback' in data;
  }

  function isMathErrorCardResult(data: unknown): data is {
    mistakeSummary: string;
    wrongStep: string;
    correctStep: string;
    concept: string;
    similarQuestion: string;
    similarAnswer: string;
  } {
    return !!data && typeof data === 'object' && 'mistakeSummary' in data;
  }

  function isReadingQuestionsResult(data: unknown): data is {
    multipleChoice: Array<{ question: string; options: string[]; answer: string }>;
    openQuestions: Array<{ question: string; suggestedAnswer: string }>;
    keywords: string[];
    answerKey: string[];
  } {
    return !!data && typeof data === 'object' && 'multipleChoice' in data && Array.isArray((data as Record<string, unknown>).multipleChoice);
  }

  function isScienceConceptMapResult(data: unknown): data is {
    nodes: Array<{ id: string; label: string; definition: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
    keywords: string[];
    misconceptions: string[];
    quiz: Array<{ question: string; answer: string }>;
  } {
    return !!data && typeof data === 'object' && 'nodes' in data && Array.isArray((data as Record<string, unknown>).nodes);
  }

  function formatResultForCopy(tool: ToolId, data: unknown): string {
    if (tool === 'vocabulary-practice' && isVocabularyResult(data)) {
      return data.items
        .map((item, index) =>
          [
            `${index + 1}. ${item.word}`,
            `释义：${stripMarkdown(item.meaning || '')}`,
            `例句：${stripMarkdown(item.example || '')}`,
            item.synonyms?.length ? `近义词：${item.synonyms.join('、')}` : '',
            `填空题：${stripMarkdown(item.blankQuestion || '')}`,
            `答案：${stripMarkdown(item.answer || '')}`
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n');
    }

    if (tool === 'english-writing-coach' && isWritingCoachResult(data)) {
      const corrections = data.corrections
        .map((item, index) =>
          [
            `${index + 1}. 原句：${stripMarkdown(item.originalSentence || '')}`,
            `问题：${stripMarkdown(item.issue || '')}`,
            `建议：${stripMarkdown(item.suggestion || '')}`
          ].join('\n')
        )
        .join('\n\n');
      const upgrades = data.vocabularyUpgrades
        .map((item) => `${item.original} -> ${item.upgrade}：${stripMarkdown(item.reason || '')}`)
        .join('\n');
      const patterns = data.sentenceSuggestions
        .map((item) => `${item.originalPattern} -> ${item.suggestedPattern}：${stripMarkdown(item.benefit || '')}`)
        .join('\n');

      return [
        `整体评价：${stripMarkdown(data.overallFeedback || '')}`,
        corrections ? `语法修正：\n${corrections}` : '',
        upgrades ? `词汇升级：\n${upgrades}` : '',
        patterns ? `句式建议：\n${patterns}` : '',
        data.priorities?.length ? `优先改进：\n${data.priorities.map((item, index) => `${index + 1}. ${stripMarkdown(item)}`).join('\n')}` : '',
        `下一步修改任务：${stripMarkdown(data.nextRevisionTask || '')}`
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    if (tool === 'math-error-card' && isMathErrorCardResult(data)) {
      return [
        `错误总结：${stripMarkdown(data.mistakeSummary || '')}`,
        `错在哪里：${stripMarkdown(data.wrongStep || '')}`,
        `正确做法：${stripMarkdown(data.correctStep || '')}`,
        `相关概念：${stripMarkdown(data.concept || '')}`,
        `类似练习题：${stripMarkdown(data.similarQuestion || '')}`,
        `答案：${stripMarkdown(data.similarAnswer || '')}`
      ].join('\n\n');
    }

    if (tool === 'reading-question-generator' && isReadingQuestionsResult(data)) {
      const mc = data.multipleChoice
        .map((item, index) =>
          [
            `${index + 1}. ${stripMarkdown(item.question || '')}`,
            ...(item.options || []).map(stripMarkdown),
            `答案：${stripMarkdown(item.answer || '')}`
          ].join('\n')
        )
        .join('\n\n');
      const open = data.openQuestions
        .map((item, index) => `${index + 1}. ${stripMarkdown(item.question || '')}\n建议答案：${stripMarkdown(item.suggestedAnswer || '')}`)
        .join('\n\n');

      return [
        mc ? `选择题：\n${mc}` : '',
        open ? `开放式问题：\n${open}` : '',
        data.keywords?.length ? `关键词：${data.keywords.join('、')}` : '',
        data.answerKey?.length ? `答案速查：\n${data.answerKey.map(stripMarkdown).join('\n')}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    if (tool === 'science-concept-map' && isScienceConceptMapResult(data)) {
      const nodes = data.nodes
        .map((node) => `${node.label}：${stripMarkdown(node.definition || '')}`)
        .join('\n');
      const edges = data.edges
        .map((edge) => `${edge.from} -> ${edge.to}：${stripMarkdown(edge.label || '')}`)
        .join('\n');
      const quiz = data.quiz
        .map((item, index) => `${index + 1}. ${stripMarkdown(item.question || '')}\n答案：${stripMarkdown(item.answer || '')}`)
        .join('\n\n');

      return [
        nodes ? `概念节点：\n${nodes}` : '',
        edges ? `关系：\n${edges}` : '',
        data.keywords?.length ? `关键词：${data.keywords.join('、')}` : '',
        data.misconceptions?.length ? `常见误解：\n${data.misconceptions.map(stripMarkdown).join('\n')}` : '',
        quiz ? `小测验：\n${quiz}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    return JSON.stringify(data, null, 2);
  }
</script>

<section class="mx-auto w-full max-w-6xl px-4 py-5 md:px-5">
  <div class="mb-6 flex flex-col gap-2">
    <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">AI 工具</h1>
    <p class="text-sm text-gray-600 dark:text-gray-300">选择适合你的学习工具，让 AI 帮助你更有效率地学习。</p>
  </div>

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
    <!-- Tool selector -->
    <div class="lg:col-span-3">
      <div class="space-y-2">
        {#each TOOLS as tool (tool.id)}
          <button
            type="button"
            class="w-full rounded-md border px-3 py-2.5 text-left text-sm transition {activeTool === tool.id
              ? 'border-primary-700 bg-primary-50 text-primary-800 dark:border-primary-500 dark:bg-primary-900/30 dark:text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-800'}"
            on:click={() => { activeTool = tool.id; clearTool(); }}
          >
            <div class="font-medium">{tool.label}</div>
            <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{tool.description}</div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Tool workspace -->
    <div class="lg:col-span-9">
      <div class="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <!-- Header -->
        <div class="flex flex-col gap-4 border-b border-gray-200 p-4 dark:border-neutral-700 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-[#040F2D] dark:text-white">{activeConfig.label}</h2>
            <p class="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">{activeConfig.description}</p>
          </div>
          {#if activeTool === 'socratic'}
            <div class="grid w-full grid-cols-2 rounded-md border border-gray-200 bg-gray-100 p-1 dark:border-neutral-700 dark:bg-neutral-800 md:w-auto">
              <button
                type="button"
                class="min-h-[38px] rounded px-3 text-sm font-medium transition {mode === 'guided'
                  ? 'bg-white text-primary-800 shadow-sm dark:bg-neutral-950 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
                on:click={() => (mode = 'guided')}
              >
                引导模式
              </button>
              <button
                type="button"
                class="min-h-[38px] rounded px-3 text-sm font-medium transition {mode === 'direct'
                  ? 'bg-white text-primary-800 shadow-sm dark:bg-neutral-950 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
                on:click={() => (mode = 'direct')}
              >
                直接模式
              </button>
            </div>
          {/if}
        </div>

        <!-- Socratic chat -->
        {#if activeTool === 'socratic'}
          <div class="grid min-h-[560px] grid-rows-[1fr_auto]">
            <div
              bind:this={messagesContainer}
              class="max-h-[calc(100vh-330px)] min-h-[360px] space-y-4 overflow-y-auto bg-gray-50 p-4 dark:bg-black md:p-5"
            >
              {#if messages.length === 0}
                <div class="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300">
                  你好！我是你的 AI 学习助手。你可以问我数学、中文、英文或科学的问题。我会一步一步引导你思考。
                </div>
              {/if}
              {#each messages as message (message.content + message.role)}
                <div class="flex items-start gap-3 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
                  {#if message.role === 'assistant'}
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white">
                      <span class="text-xs font-bold">AI</span>
                    </div>
                  {/if}
                  <div
                    class="max-w-[85%] whitespace-pre-wrap break-words rounded-md px-4 py-3 text-sm leading-6 md:max-w-[760px] {message.role === 'user'
                      ? 'bg-primary-800 text-white'
                      : 'border border-gray-200 bg-white text-gray-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200'}"
                  >
                    {message.content}
                  </div>
                  {#if message.role === 'user'}
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-300 text-white dark:bg-neutral-700">
                      <span class="text-xs font-bold">我</span>
                    </div>
                  {/if}
                </div>
              {/each}
              {#if isLoading}
                <div class="flex items-center gap-3">
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white">
                    <span class="text-xs font-bold">AI</span>
                  </div>
                  <div class="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300">
                    正在思考...
                  </div>
                </div>
              {/if}
            </div>
            <div class="border-t border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
              {#if errorMessage}
                <p class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorMessage}</p>
              {/if}
              <div class="flex flex-col gap-3 md:flex-row md:items-end">
                <label class="flex-1">
                  <span class="sr-only">输入问题</span>
                  <textarea
                    bind:value={inputValues['message']}
                    rows="3"
                    placeholder="输入你想学习的题目或问题..."
                    disabled={isLoading}
                    on:keydown={handleKeydown}
                    class="min-h-[92px] w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-500 focus:border-primary-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200 dark:placeholder:text-gray-400"
                  ></textarea>
                </label>
                <div class="flex gap-2 md:pb-0.5">
                  <button
                    type="button"
                    class="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                    disabled={isLoading}
                    on:click={clearSocratic}
                  >
                    清除
                  </button>
                  <button
                    type="button"
                    class="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-primary-800 px-4 text-sm font-medium text-white transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!inputValues['message']?.trim() || isLoading}
                    on:click={sendSocratic}
                  >
                    发送
                  </button>
                </div>
              </div>
            </div>
          </div>
        {:else}
          <!-- Structured tool form -->
          <div class="p-4 md:p-5">
            {#if errorMessage}
              <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorMessage}</p>
            {/if}
            <div class="space-y-4">
              {#each activeConfig.fields as field (field.key)}
                <label class="block">
                  <span class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{field.label}</span>
                  <textarea
                    bind:value={inputValues[field.key]}
                    rows={field.rows}
                    placeholder={field.placeholder}
                    disabled={isLoading}
                    class="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-500 focus:border-primary-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200 dark:placeholder:text-gray-400"
                  ></textarea>
                </label>
              {/each}
              <div class="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  class="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-primary-800 px-4 text-sm font-medium text-white transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                  on:click={submitTool}
                >
                  {#if isLoading}
                    生成中...
                  {:else}
                    生成
                  {/if}
                </button>
                <button
                  type="button"
                  class="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                  disabled={isLoading}
                  on:click={clearTool}
                >
                  清除
                </button>
              </div>
            </div>
          </div>

          <!-- Structured results -->
          {#if resultData}
            <div class="border-t border-gray-200 bg-gray-50 p-4 dark:border-neutral-700 dark:bg-neutral-950 md:p-5">
              <div class="mb-3 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-white">结果</h3>
                <CopyButton text={resultText} />
              </div>

              <!-- Vocabulary -->
              {#if isVocabularyResult(resultData)}
                <div class="space-y-3">
                  {#each resultData.items as item, i (i)}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-primary-800 dark:text-primary-300">{item.word}</div>
                      <div class="mt-1 text-sm text-gray-700 dark:text-gray-200"><span class="text-gray-500">释义：</span>{item.meaning}</div>
                      <div class="mt-1 text-sm text-gray-700 dark:text-gray-200"><span class="text-gray-500">例句：</span>{item.example}</div>
                      {#if item.synonyms && item.synonyms.length}
                        <div class="mt-1 text-sm text-gray-700 dark:text-gray-200"><span class="text-gray-500">近义词：</span>{item.synonyms.join('、')}</div>
                      {/if}
                      <div class="mt-2 rounded-md bg-gray-50 p-2 text-sm text-gray-700 dark:bg-neutral-800 dark:text-gray-200">
                        <span class="text-gray-500">填空题：</span>{item.blankQuestion}
                      </div>
                      <div class="mt-1 text-sm text-gray-500">答案：{item.answer}</div>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Writing coach -->
              {#if isWritingCoachResult(resultData)}
                <div class="space-y-4">
                  <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                    <div class="text-sm font-semibold text-gray-800 dark:text-white">整体评价</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.overallFeedback)}</div>
                  </div>
                  {#if resultData.corrections.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">语法修正</div>
                      <div class="mt-2 space-y-2">
                        {#each resultData.corrections as c, i (i)}
                          <div class="text-sm">
                            <div class="text-gray-500">原句：{c.originalSentence}</div>
                            <div class="text-red-600 dark:text-red-400">问题：{c.issue}</div>
                            <div class="text-green-700 dark:text-green-400">建议：{c.suggestion}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.vocabularyUpgrades.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">词汇升级</div>
                      <div class="mt-2 space-y-2">
                        {#each resultData.vocabularyUpgrades as v, i (i)}
                          <div class="text-sm">
                            <span class="text-gray-600">{v.original}</span>
                            <span class="mx-1 text-gray-400">→</span>
                            <span class="font-medium text-primary-800 dark:text-primary-300">{v.upgrade}</span>
                            <span class="text-gray-500">（{v.reason}）</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.sentenceSuggestions.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">句式建议</div>
                      <div class="mt-2 space-y-2">
                        {#each resultData.sentenceSuggestions as s, i (i)}
                          <div class="text-sm">
                            <div class="text-gray-500">原 pattern：{s.originalPattern}</div>
                            <div class="text-primary-800 dark:text-primary-300">建议：{s.suggestedPattern}</div>
                            <div class="text-gray-500">{s.benefit}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.priorities.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">优先改进</div>
                      <ol class="mt-1 list-decimal pl-5 text-sm text-gray-700 dark:text-gray-200">
                        {#each resultData.priorities as p, i (i)}
                          <li>{stripMarkdown(p)}</li>
                        {/each}
                      </ol>
                    </div>
                  {/if}
                  <div class="rounded-md border border-primary-200 bg-primary-50 p-3 dark:border-primary-900 dark:bg-primary-900/20">
                    <div class="text-sm font-semibold text-primary-800 dark:text-primary-300">下一步修改任务</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.nextRevisionTask)}</div>
                  </div>
                </div>
              {/if}

              <!-- Math error card -->
              {#if isMathErrorCardResult(resultData)}
                <div class="space-y-4">
                  <div class="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                    <div class="text-sm font-semibold text-red-800 dark:text-red-300">错误总结</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.mistakeSummary)}</div>
                  </div>
                  <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                    <div class="text-sm font-semibold text-gray-800 dark:text-white">错在哪里</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.wrongStep)}</div>
                  </div>
                  <div class="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
                    <div class="text-sm font-semibold text-green-800 dark:text-green-300">正确做法</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.correctStep)}</div>
                  </div>
                  <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                    <div class="text-sm font-semibold text-gray-800 dark:text-white">相关概念</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.concept)}</div>
                  </div>
                  <div class="rounded-md border border-primary-200 bg-primary-50 p-3 dark:border-primary-900 dark:bg-primary-900/20">
                    <div class="text-sm font-semibold text-primary-800 dark:text-primary-300">类似练习题</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.similarQuestion)}</div>
                    <details class="mt-2">
                      <summary class="cursor-pointer text-sm font-medium text-primary-700 dark:text-primary-400">查看答案</summary>
                      <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.similarAnswer)}</div>
                    </details>
                  </div>
                </div>
              {/if}

              <!-- Reading questions -->
              {#if isReadingQuestionsResult(resultData)}
                <div class="space-y-4">
                  {#if resultData.multipleChoice.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">选择题</div>
                      <div class="mt-2 space-y-3">
                        {#each resultData.multipleChoice as q, i (i)}
                          <div class="text-sm">
                            <div class="font-medium text-gray-800 dark:text-white">{i + 1}. {q.question}</div>
                            <div class="mt-1 space-y-0.5 pl-3">
                              {#each q.options as opt, j (j)}
                                <div class="text-gray-700 dark:text-gray-200">{opt}</div>
                              {/each}
                            </div>
                            <div class="mt-1 text-xs text-gray-500">答案：{q.answer}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.openQuestions.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">开放式问题</div>
                      <div class="mt-2 space-y-3">
                        {#each resultData.openQuestions as q, i (i)}
                          <div class="text-sm">
                            <div class="font-medium text-gray-800 dark:text-white">{i + 1}. {q.question}</div>
                            <div class="mt-1 text-gray-500">建议答案：{q.suggestedAnswer}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.keywords.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">关键词</div>
                      <div class="mt-1 flex flex-wrap gap-2">
                        {#each resultData.keywords as kw, i (i)}
                          <span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-neutral-800 dark:text-gray-200">{kw}</span>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.answerKey.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">答案速查</div>
                      <div class="mt-1 space-y-1">
                        {#each resultData.answerKey as ak, i (i)}
                          <div class="text-sm text-gray-700 dark:text-gray-200">{ak}</div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Science concept map -->
              {#if isScienceConceptMapResult(resultData)}
                <div class="space-y-4">
                  {#if resultData.nodes.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">概念节点</div>
                      <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {#each resultData.nodes as node, i (node.id)}
                          <div class="rounded-md border border-gray-100 bg-gray-50 p-2 dark:border-neutral-800 dark:bg-neutral-800">
                            <div class="text-sm font-medium text-primary-800 dark:text-primary-300">{node.label}</div>
                            <div class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{node.definition}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.edges.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">关系</div>
                      <div class="mt-2 space-y-1">
                        {#each resultData.edges as edge, i (i)}
                          <div class="text-sm text-gray-700 dark:text-gray-200">
                            <span class="font-medium">{edge.from}</span>
                            <span class="mx-1 text-gray-400">→</span>
                            <span class="font-medium">{edge.to}</span>
                            <span class="text-gray-500">（{edge.label}）</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.keywords.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">关键词</div>
                      <div class="mt-1 flex flex-wrap gap-2">
                        {#each resultData.keywords as kw, i (i)}
                          <span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-neutral-800 dark:text-gray-200">{kw}</span>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.misconceptions.length}
                    <div class="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                      <div class="text-sm font-semibold text-amber-800 dark:text-amber-300">常见误解</div>
                      <ul class="mt-1 list-disc pl-5 text-sm text-gray-700 dark:text-gray-200">
                        {#each resultData.misconceptions as m, i (i)}
                          <li>{stripMarkdown(m)}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  {#if resultData.quiz.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">小测验</div>
                      <div class="mt-2 space-y-2">
                        {#each resultData.quiz as q, i (i)}
                          <div class="text-sm">
                            <div class="font-medium text-gray-800 dark:text-white">{i + 1}. {q.question}</div>
                            <details class="mt-1">
                              <summary class="cursor-pointer text-xs font-medium text-primary-700 dark:text-primary-400">查看答案</summary>
                              <div class="mt-0.5 text-xs text-gray-700 dark:text-gray-200">{q.answer}</div>
                            </details>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
</section>
