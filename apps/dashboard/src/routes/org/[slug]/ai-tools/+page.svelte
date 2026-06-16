<script lang="ts">
  import Chat from 'carbon-icons-svelte/lib/Chat.svelte';
  import Send from 'carbon-icons-svelte/lib/Send.svelte';
  import TrashCan from 'carbon-icons-svelte/lib/TrashCan.svelte';
  import UserAvatar from 'carbon-icons-svelte/lib/UserAvatar.svelte';
  import { tick } from 'svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { t } from '$lib/utils/functions/translations';

  type Mode = 'guided' | 'direct';
  type MessageRole = 'user' | 'assistant';

  interface ChatMessage {
    role: MessageRole;
    content: string;
  }

  let mode: Mode = 'guided';
  let inputValue = '';
  let isLoading = false;
  let errorMessage = '';
  let messages: ChatMessage[] = [];
  let messagesContainer: HTMLDivElement;
  let inputRef: HTMLTextAreaElement;

  $: welcomeMessage = {
    role: 'assistant' as const,
    content: $t('ai_tools.welcome_message')
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
      return $t('ai_tools.login_required_error');
    }

    if (status === 503 && code === 'missing_deepseek_key') {
      return $t('ai_tools.not_configured_error');
    }

    if (status === 502 && (code === 'upstream_error' || code === 'unexpected_response')) {
      return $t('ai_tools.service_unavailable_error');
    }

    if (status === 400) {
      return $t('ai_tools.invalid_message_error');
    }

    return $t('ai_tools.unexpected_error');
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
    const nextMessages = [...messages, { role: 'user' as const, content: text }];

    messages = nextMessages;
    inputValue = '';
    errorMessage = '';
    isLoading = true;
    await scrollToBottom();

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/ai-tools/socratic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          mode,
          history: getRequestHistory(previousMessages)
        })
      });

      let data: { reply?: string; error?: string; code?: string } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || !data.reply) {
        const friendlyError = getErrorMessage(response.status, data.code);
        errorMessage = friendlyError;
        messages = [...nextMessages, { role: 'assistant', content: friendlyError }];
        return;
      }

      messages = [...nextMessages, { role: 'assistant', content: data.reply }];
    } catch {
      errorMessage = $t('ai_tools.service_unavailable_error');
      messages = [
        ...nextMessages,
        { role: 'assistant', content: $t('ai_tools.service_unavailable_error') }
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
    inputRef?.focus();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

<svelte:head>
  <title>{$t('ai_tools.title')}</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl px-4 py-5 md:px-5">
  <div class="mb-6 flex flex-col gap-2">
    <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">
      {$t('ai_tools.title')}
    </h1>
  </div>

  <div
    class="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
  >
    <div
      class="flex flex-col gap-4 border-b border-gray-200 p-4 dark:border-neutral-700 md:flex-row md:items-start md:justify-between"
    >
      <div class="flex gap-3">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-white"
        >
          <Chat size={22} />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-[#040F2D] dark:text-white">
            {$t('ai_tools.socratic_title')}
          </h2>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            {$t('ai_tools.socratic_description')}
          </p>
        </div>
      </div>

      <div
        class="grid w-full grid-cols-2 rounded-md border border-gray-200 bg-gray-100 p-1 dark:border-neutral-700 dark:bg-neutral-800 md:w-auto"
        aria-label={$t('ai_tools.title')}
      >
        <button
          type="button"
          class="min-h-[38px] rounded px-3 text-sm font-medium transition {mode === 'guided'
            ? 'bg-white text-primary-800 shadow-sm dark:bg-neutral-950 dark:text-white'
            : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
          on:click={() => (mode = 'guided')}
        >
          {$t('ai_tools.guided_mode')}
        </button>
        <button
          type="button"
          class="min-h-[38px] rounded px-3 text-sm font-medium transition {mode === 'direct'
            ? 'bg-white text-primary-800 shadow-sm dark:bg-neutral-950 dark:text-white'
            : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
          on:click={() => (mode = 'direct')}
        >
          {$t('ai_tools.direct_mode')}
        </button>
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

            <div
              class="max-w-[85%] whitespace-pre-wrap break-words rounded-md px-4 py-3 text-sm leading-6 md:max-w-[760px] {message.role ===
              'user'
                ? 'bg-primary-800 text-white'
                : 'border border-gray-200 bg-white text-gray-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200'}"
            >
              {message.content}
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
              {$t('ai_tools.loading')}
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
            <span class="sr-only">{$t('ai_tools.input_placeholder')}</span>
            <textarea
              bind:this={inputRef}
              bind:value={inputValue}
              rows="3"
              placeholder={$t('ai_tools.input_placeholder')}
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
              {$t('ai_tools.clear')}
            </button>
            <button
              type="button"
              class="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-primary-800 px-4 text-sm font-medium text-white transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!inputValue.trim() || isLoading}
              on:click={sendMessage}
            >
              <Send size={16} />
              {$t('ai_tools.send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
