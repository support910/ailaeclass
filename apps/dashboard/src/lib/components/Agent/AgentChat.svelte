<script lang="ts">
  import Chat from 'carbon-icons-svelte/lib/Chat.svelte';
  import Send from 'carbon-icons-svelte/lib/Send.svelte';
  import TrashCan from 'carbon-icons-svelte/lib/TrashCan.svelte';
  import UserAvatar from 'carbon-icons-svelte/lib/UserAvatar.svelte';
  import ChevronDown from 'carbon-icons-svelte/lib/ChevronDown.svelte';
  import ChevronUp from 'carbon-icons-svelte/lib/ChevronUp.svelte';
  import { tick } from 'svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { t, locale } from '$lib/utils/functions/translations';
  import { escapeHtml, sanitizeHtml } from '$lib/utils/functions/sanitize';
  import { currentOrg } from '$lib/utils/store/org';

  type MessageRole = 'user' | 'assistant';

  interface SourceItem {
    source: string;
    page: number | null;
    score: number;
  }

  interface WebResultItem {
    title: string;
    url: string;
    snippet: string;
  }

  interface ChatMessage {
    role: MessageRole;
    content: string;
    sources?: SourceItem[];
    webResults?: WebResultItem[];
    fromKnowledgeBase?: boolean;
  }

  let inputValue = '';
  let isLoading = false;
  let errorMessage = '';
  let messages: ChatMessage[] = [];
  let messagesContainer: HTMLDivElement;
  let inputRef: HTMLTextAreaElement;
  let expandedSourcesIndex: number | null = null;

  $: welcomeMessage = {
    role: 'assistant' as const,
    content: $t('agent.welcome_message')
  };

  $: if (!messages.length) {
    messages = [welcomeMessage];
  }

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function getErrorMessage(status: number, code?: string) {
    if (status === 401) {
      return $t('agent.login_required_error');
    }

    if (status === 503 && code === 'missing_deepseek_key') {
      return $t('agent.not_configured_error');
    }

    if (status === 502 && (code === 'upstream_error' || code === 'unexpected_response')) {
      return $t('agent.service_unavailable_error');
    }

    if (status === 400) {
      return $t('agent.invalid_message_error');
    }

    return $t('agent.unexpected_error');
  }

  function getRequestHistory(currentMessages: ChatMessage[]) {
    return currentMessages
      .slice(1)
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 1500)
      }));
  }

  async function sendMessage() {
    const text = inputValue.trim();

    if (!text || isLoading) {
      return;
    }

    const previousMessages = messages;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user' as const, content: text }];

    messages = nextMessages;
    inputValue = '';
    errorMessage = '';
    isLoading = true;
    await scrollToBottom();

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          history: getRequestHistory(previousMessages),
          orgId: $currentOrg?.id || null,
          // interface language decides the answer language
          locale: $locale
        })
      });

      let data: {
        reply?: string;
        error?: string;
        code?: string;
        sources?: SourceItem[];
        webResults?: WebResultItem[];
        fromKnowledgeBase?: boolean;
      } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || !data.reply) {
        const friendlyError = getErrorMessage(response.status, data.code);
        errorMessage = friendlyError;
        messages = [
          ...nextMessages,
          { role: 'assistant', content: friendlyError }
        ];
        return;
      }

      messages = [
        ...nextMessages,
        {
          role: 'assistant',
          content: data.reply,
          sources: data.sources,
          webResults: data.webResults,
          fromKnowledgeBase: data.fromKnowledgeBase
        }
      ];
    } catch {
      errorMessage = $t('agent.service_unavailable_error');
      messages = [
        ...nextMessages,
        { role: 'assistant', content: $t('agent.service_unavailable_error') }
      ];
    } finally {
      isLoading = false;
      await scrollToBottom();
      inputRef?.focus();
    }
  }

  function clearConversation() {
    messages = [welcomeMessage];
    inputValue = '';
    errorMessage = '';
    expandedSourcesIndex = null;
    inputRef?.focus();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function toggleSources(index: number) {
    expandedSourcesIndex = expandedSourcesIndex === index ? null : index;
  }

  function parseTableCells(line: string) {
    return line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  }

  function isMarkdownTableSeparator(line: string) {
    const cells = parseTableCells(line);
    return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  }

  function renderInlineMarkdown(text: string) {
    let html = escapeHtml(text);

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    return html;
  }

  function renderMarkdownTable(lines: string[], startIndex: number) {
    const headers = parseTableCells(lines[startIndex]);
    const rows: string[][] = [];
    let index = startIndex + 2;

    while (index < lines.length && lines[index].includes('|')) {
      const cells = parseTableCells(lines[index]);
      if (!cells.length || cells.every((cell) => !cell)) {
        break;
      }

      rows.push(cells);
      index += 1;
    }

    const headerHtml = headers
      .map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`)
      .join('');
    const bodyHtml = rows
      .map((row) => {
        const paddedRow = headers.map((_, cellIndex) => row[cellIndex] ?? '');
        return `<tr>${paddedRow.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('')}</tr>`;
      })
      .join('');

    return {
      html: `<div class="agent-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
      nextIndex: index
    };
  }

  function renderMarkdown(content: string) {
    const lines = stripSourceFooter(content).replace(/\r\n/g, '\n').split('\n');
    const blocks: string[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (
        line.includes('|') &&
        index + 1 < lines.length &&
        isMarkdownTableSeparator(lines[index + 1])
      ) {
        const table = renderMarkdownTable(lines, index);
        blocks.push(table.html);
        index = table.nextIndex;
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
          index += 1;
        }
        blocks.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ol>`);
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\s*[-*]\s+/, ''));
          index += 1;
        }
        blocks.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
        continue;
      }

      const paragraph: string[] = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !(
          lines[index].includes('|') &&
          index + 1 < lines.length &&
          isMarkdownTableSeparator(lines[index + 1])
        ) &&
        !/^\s*\d+\.\s+/.test(lines[index]) &&
        !/^\s*[-*]\s+/.test(lines[index])
      ) {
        paragraph.push(lines[index].trim());
        index += 1;
      }

      blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br>')}</p>`);
    }

    return sanitizeHtml(blocks.join(''));
  }

  function stripSourceFooter(content: string) {
    return content
      .replace(/\n?\s*[（(]\s*来源\s*[:：][\s\S]*?[）)]\s*$/u, '')
      .replace(/\n?\s*来源\s*[:：][\s\S]*$/u, '')
      .trim();
  }
</script>

<svelte:head>
  <title>ailaeclass Agent</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl px-4 py-5 md:px-5">
  <div class="mb-6 flex flex-col gap-2">
    <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">
      ailaeclass Agent
    </h1>
    <p class="text-sm text-gray-600 dark:text-gray-300">
      {$t('agent.subtitle')}
    </p>
  </div>

  <div
    class="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
  >
    <div
      class="flex items-start gap-3 border-b border-gray-200 p-4 dark:border-neutral-700"
    >
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-white"
      >
        <Chat size={22} />
      </div>
      <div>
        <h2 class="text-lg font-semibold text-[#040F2D] dark:text-white">
          {$t('agent.chat_title')}
        </h2>
        <p class="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          {$t('agent.chat_description')}
        </p>
      </div>
    </div>

    <div class="grid min-h-[560px] grid-rows-[1fr_auto]">
      <div
        bind:this={messagesContainer}
        class="max-h-[calc(100vh-330px)] min-h-[360px] space-y-4 overflow-y-auto bg-gray-50 p-4 dark:bg-black md:p-5"
      >
        {#each messages as message, index (index)}
          <div
            class="flex items-start gap-3 {message.role === 'user' ? 'justify-end' : 'justify-start'}"
          >
            {#if message.role === 'assistant'}
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white"
              >
                <Chat size={16} />
              </div>
            {/if}

            <div class="max-w-[85%] md:max-w-[760px]">
              <div
                class="agent-message break-words rounded-md px-4 py-3 text-sm leading-6 {message.role ===
                'user'
                  ? 'bg-primary-800 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200'}"
              >
                {#if message.role === 'assistant'}
                  {@html renderMarkdown(message.content)}
                {:else}
                  {message.content}
                {/if}
              </div>

              {#if message.role === 'assistant' && (message.sources?.length || message.webResults?.length)}
                <div class="mt-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700"
                    on:click={() => toggleSources(index)}
                  >
                    {#if expandedSourcesIndex === index}
                      <ChevronUp size={14} />
                      {$t('agent.hide_sources')}
                    {:else}
                      <ChevronDown size={14} />
                      {$t('agent.show_sources')}
                      {#if message.sources?.length}
                        <span class="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-800 dark:bg-primary-900 dark:text-white">
                          {message.sources.length}
                        </span>
                      {/if}
                      {#if message.webResults?.length}
                        <span class="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900 dark:text-white">
                          {$t('agent.web_label')}
                        </span>
                      {/if}
                    {/if}
                  </button>

                  {#if expandedSourcesIndex === index}
                    <div class="mt-2 space-y-2 rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      {#if message.sources?.length}
                        <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {$t('agent.knowledge_sources')}
                        </p>
                        {#each message.sources as source}
                          <div class="text-xs text-gray-700 dark:text-gray-300">
                            <span class="font-medium">{source.source}</span>
                            {#if source.page !== null}
                              <span class="text-gray-500 dark:text-gray-400"> — {$t('agent.page')} {source.page}</span>
                            {/if}
                          </div>
                        {/each}
                      {/if}

                      {#if message.webResults?.length}
                        <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {$t('agent.web_sources')}
                        </p>
                        {#each message.webResults as web}
                          <div class="text-xs text-gray-700 dark:text-gray-300">
                            <a
                              href={web.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="font-medium text-primary-700 hover:underline dark:text-primary-300"
                            >
                              {web.title}
                            </a>
                            <p class="mt-0.5 text-gray-500 dark:text-gray-400">{web.snippet}</p>
                          </div>
                        {/each}
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            {#if message.role === 'user'}
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-300 text-white dark:bg-neutral-700"
              >
                <UserAvatar size={16} />
              </div>
            {/if}
          </div>
        {/each}

        {#if isLoading}
          <div class="flex items-center gap-3">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white"
            >
              <Chat size={16} />
            </div>
            <div
              class="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300"
            >
              {$t('agent.loading')}
            </div>
          </div>
        {/if}
      </div>

      <div class="border-t border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        {#if errorMessage}
          <p class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {errorMessage}
          </p>
        {/if}

        <div class="flex flex-col gap-3 md:flex-row md:items-end">
          <label class="flex-1">
            <span class="sr-only">{$t('agent.input_placeholder')}</span>
            <textarea
              bind:this={inputRef}
              bind:value={inputValue}
              rows="3"
              placeholder={$t('agent.input_placeholder')}
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
              on:click={clearConversation}
            >
              <TrashCan size={16} />
              {$t('agent.clear')}
            </button>
            <button
              type="button"
              class="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-primary-800 px-4 text-sm font-medium text-white transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!inputValue.trim() || isLoading}
              on:click={sendMessage}
            >
              <Send size={16} />
              {$t('agent.send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  :global(.agent-message p) {
    margin: 0;
  }

  :global(.agent-message p + p),
  :global(.agent-message p + ol),
  :global(.agent-message p + ul),
  :global(.agent-message p + .agent-table-wrap),
  :global(.agent-message ol + p),
  :global(.agent-message ul + p),
  :global(.agent-message .agent-table-wrap + p) {
    margin-top: 0.75rem;
  }

  :global(.agent-message ol),
  :global(.agent-message ul) {
    margin: 0;
    padding-left: 1.25rem;
  }

  :global(.agent-message li + li) {
    margin-top: 0.35rem;
  }

  :global(.agent-message strong) {
    font-weight: 700;
    color: inherit;
  }

  :global(.agent-message code) {
    border-radius: 0.25rem;
    background: rgba(15, 23, 42, 0.08);
    padding: 0.1rem 0.25rem;
    font-size: 0.92em;
  }

  :global(.agent-table-wrap) {
    margin-top: 0.75rem;
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
  }

  :global(.agent-table-wrap table) {
    width: 100%;
    min-width: 520px;
    border-collapse: collapse;
    background: #ffffff;
  }

  :global(.agent-table-wrap th),
  :global(.agent-table-wrap td) {
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    padding: 0.625rem 0.75rem;
    text-align: left;
    vertical-align: top;
  }

  :global(.agent-table-wrap th:last-child),
  :global(.agent-table-wrap td:last-child) {
    border-right: 0;
  }

  :global(.agent-table-wrap tr:last-child td) {
    border-bottom: 0;
  }

  :global(.agent-table-wrap th) {
    background: #f3f4f6;
    font-weight: 700;
    color: #111827;
  }

  :global(.dark .agent-table-wrap) {
    border-color: #404040;
  }

  :global(.dark .agent-table-wrap table) {
    background: #171717;
  }

  :global(.dark .agent-table-wrap th),
  :global(.dark .agent-table-wrap td) {
    border-color: #404040;
  }

  :global(.dark .agent-table-wrap th) {
    background: #262626;
    color: #f5f5f5;
  }
</style>
