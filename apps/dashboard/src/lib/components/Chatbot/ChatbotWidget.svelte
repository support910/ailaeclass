<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import SendIcon from 'carbon-icons-svelte/lib/Send.svelte';
  import ChatIcon from 'carbon-icons-svelte/lib/Chat.svelte';
  import CloseIcon from 'carbon-icons-svelte/lib/Close.svelte';
  import MaximizeIcon from 'carbon-icons-svelte/lib/Maximize.svelte';
  import MinimizeIcon from 'carbon-icons-svelte/lib/Minimize.svelte';
  import UserAvatar from 'carbon-icons-svelte/lib/UserAvatar.svelte';
  import { page } from '$app/stores';
  import { onMount, tick } from 'svelte';
  import { locale } from '$lib/utils/functions/translations';

  type UiLanguage = 'zh-Hant' | 'zh-Hans' | 'en';

  const COPY: Record<UiLanguage, Record<string, string>> = {
    'zh-Hant': {
      welcome:
        '你好，我是 ailaeclass AI 助手。你可以問我平台使用、課程學習、無人機與低空經濟，也可以問簡單英文詞義、語法、數學或科學概念。',
      subtitle: 'AI 助手',
      openChat: '開啟聊天',
      closeChat: '關閉聊天',
      maximize: '放大',
      minimize: '縮小',
      send: '發送',
      placeholder: '問平台使用、課程學習、英文詞義或無人機知識...',
      disclaimer: 'AI 生成內容僅供學習參考，重要資訊請以教師或官方資料為準',
      serviceUnavailable: '抱歉，AI 服務暫時不可用，請稍後再試。',
      notConfigured: 'AI 助手尚未配置，請聯絡管理員設定 API Key。',
      upstreamUnavailable: 'AI 服務暫時不可用。',
      invalidRequest: '請求格式不正確，請重新輸入。',
      unexpectedResponse: '抱歉，AI 服務回傳異常，請稍後再試。'
    },
    'zh-Hans': {
      welcome:
        '你好，我是 ailaeclass AI 助手。你可以问我平台使用、课程学习、无人机与低空经济，也可以问简单英文词义、语法、数学或科学概念。',
      subtitle: 'AI 助手',
      openChat: '开启聊天',
      closeChat: '关闭聊天',
      maximize: '放大',
      minimize: '缩小',
      send: '发送',
      placeholder: '问平台使用、课程学习、英文词义或无人机知识...',
      disclaimer: 'AI 生成内容仅供学习参考，重要信息请以教师或官方资料为准',
      serviceUnavailable: '抱歉，AI 服务暂时不可用，请稍后再试。',
      notConfigured: 'AI 助手尚未配置，请联系管理员设置 API Key。',
      upstreamUnavailable: 'AI 服务暂时不可用。',
      invalidRequest: '请求格式不正确，请重新输入。',
      unexpectedResponse: '抱歉，AI 服务返回异常，请稍后再试。'
    },
    en: {
      welcome:
        'Hi, I am the ailaeclass AI assistant. You can ask about the platform, course learning, drones and low-altitude economy, or simple English, math, and science concepts.',
      subtitle: 'AI Assistant',
      openChat: 'Open chat',
      closeChat: 'Close chat',
      maximize: 'Maximize',
      minimize: 'Minimize',
      send: 'Send',
      placeholder: 'Ask about learning, English words, drones, or this platform...',
      disclaimer: 'AI content is for learning reference only. Check important information with teachers or official sources.',
      serviceUnavailable: 'Sorry, the AI service is temporarily unavailable. Please try again later.',
      notConfigured: 'AI assistant is not configured. Please contact an administrator to set the API key.',
      upstreamUnavailable: 'AI service is temporarily unavailable.',
      invalidRequest: 'Invalid request. Please try again.',
      unexpectedResponse: 'Sorry, the AI service returned an unexpected response. Please try again later.'
    }
  };

  let isOpen = false;
  let isExpanded = false;
  let inputValue = '';
  let messages: { role: 'user' | 'bot'; text: string }[] = [];
  let isLoading = false;
  let chatContainer: HTMLDivElement;
  let inputRef: HTMLInputElement;
  let uiLanguage: UiLanguage = 'zh-Hant';
  $: isLandingPage = $page.url.pathname === '/';
  $: uiLanguage = mapLocaleToUiLanguage($locale);

  function mapLocaleToUiLanguage(currentLocale: string): UiLanguage {
    if (currentLocale === 'en') return 'en';
    if (currentLocale === 'zh') return 'zh-Hans';
    return 'zh-Hant';
  }

  function ui(key: string) {
    return (COPY[uiLanguage] ?? COPY['zh-Hant'])[key] ?? COPY['zh-Hant'][key] ?? key;
  }

  $: welcomeMessage = {
    role: 'bot' as const,
    text: ui('welcome')
  };

  $: if (messages.length === 1 && messages[0]?.role === 'bot') {
    messages = [welcomeMessage];
  }

  onMount(() => {
    messages = [welcomeMessage];
  });

  async function scrollToBottom() {
    await tick();
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  async function sendMessage() {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    messages = [...messages, { role: 'user', text }];
    inputValue = '';
    isLoading = true;
    await scrollToBottom();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        data = { error: 'Invalid response from server' };
      }

      console.log('Chat API response:', { status: response.status, data });

      if (!response.ok || data.error) {
        const status = response.status;
        const code = data.code;
        let friendly = ui('serviceUnavailable');

        if (status === 503 && code === 'missing_deepseek_key') {
          friendly = ui('notConfigured');
        } else if (status === 502 && code === 'upstream_error') {
          friendly = ui('upstreamUnavailable');
        } else if (status === 400) {
          friendly = data.error || ui('invalidRequest');
        } else if (data.error) {
          friendly = data.error;
        }

        messages = [...messages, { role: 'bot', text: cleanBotText(friendly) }];
      } else if (data.reply) {
        messages = [...messages, { role: 'bot', text: cleanBotText(data.reply) }];
      } else {
        messages = [
          ...messages,
          {
            role: 'bot',
            text: ui('unexpectedResponse')
          }
        ];
      }
    } catch (err) {
      console.error('Chat request failed:', err);
      messages = [...messages, { role: 'bot', text: ui('serviceUnavailable') }];
    } finally {
      isLoading = false;
      await scrollToBottom();
      inputRef?.focus();
    }
  }

  function cleanBotText(text: string) {
    return String(text || '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim())
      .trim();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function toggleOpen() {
    isOpen = !isOpen;
    if (isOpen) {
      setTimeout(() => inputRef?.focus(), 300);
    }
  }

  function toggleExpand() {
    isExpanded = !isExpanded;
  }
</script>

<!-- Floating Toggle Button -->
{#if !isOpen}
  <button
    on:click={toggleOpen}
    class="chat-toggle fixed right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
    class:landing-chat-position={isLandingPage}
    style="background: linear-gradient(135deg, #0E7372 0%, #00D4FF 100%);"
    aria-label={ui('openChat')}
    in:fade={{ duration: 200 }}
  >
    <ChatIcon size={24} class="text-white" />
  </button>
{/if}

<!-- Chat Widget -->
{#if isOpen}
  <div
    class="chat-panel fixed right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
    class:landing-chat-position={isLandingPage}
    class:w-96={!isExpanded}
    class:h-[28rem]={!isExpanded}
    class:w-[32rem]={isExpanded}
    class:h-[40rem]={isExpanded}
    transition:fly={{ y: 20, duration: 300, easing: quintOut }}
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-3"
      style="background: linear-gradient(135deg, #0E7372 0%, #00D4FF 100%);"
    >
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          <ChatIcon size={18} class="text-white" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-white">ailaeclass AI</h3>
          <p class="text-xs text-white/80">{ui('subtitle')}</p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          on:click={toggleExpand}
          class="rounded p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
          aria-label={isExpanded ? ui('minimize') : ui('maximize')}
        >
          {#if isExpanded}
            <MinimizeIcon size={18} />
          {:else}
            <MaximizeIcon size={18} />
          {/if}
        </button>
        <button
          on:click={toggleOpen}
          class="rounded p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
          aria-label={ui('closeChat')}
        >
          <CloseIcon size={18} />
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div
      bind:this={chatContainer}
      class="flex-1 overflow-y-auto px-4 py-3 space-y-3"
    >
      {#each messages as msg, i (i)}
        <div
          class="flex w-full"
          class:justify-end={msg.role === 'user'}
          class:justify-start={msg.role === 'bot'}
          in:fly={{ y: 10, duration: 200 }}
        >
          {#if msg.role === 'bot'}
            <div class="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style="background: linear-gradient(135deg, #0E7372, #00D4FF);">
              <ChatIcon size={14} class="text-white" />
            </div>
          {/if}

          <div
            class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
            class:rounded-bl-none={msg.role === 'bot'}
            class:rounded-br-none={msg.role === 'user'}
            class:bg-gray-100={msg.role === 'bot'}
            class:text-gray-800={msg.role === 'bot'}
            class:dark:bg-neutral-800={msg.role === 'bot'}
            class:dark:text-gray-100={msg.role === 'bot'}
            class:text-white={msg.role === 'user'}
            style={msg.role === 'user' ? 'background: linear-gradient(135deg, #0E7372, #00D4FF);' : ''}
          >
            {msg.text}
          </div>

          {#if msg.role === 'user'}
            <div class="ml-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-300 dark:bg-neutral-600">
              <UserAvatar size={14} class="text-white" />
            </div>
          {/if}
        </div>
      {/each}

      {#if isLoading}
        <div class="flex items-center gap-2" in:fade>
          <div class="flex h-7 w-7 items-center justify-center rounded-full" style="background: linear-gradient(135deg, #0E7372, #00D4FF);">
            <ChatIcon size={14} class="text-white" />
          </div>
          <div class="flex gap-1 rounded-2xl rounded-bl-none bg-gray-100 px-4 py-3 dark:bg-neutral-800">
            <span class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay: 0ms;" />
            <span class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay: 150ms;" />
            <span class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay: 300ms;" />
          </div>
        </div>
      {/if}
    </div>

    <!-- Input -->
    <div class="border-t border-gray-200 px-4 py-3 dark:border-neutral-700">
      <div class="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800">
        <input
          bind:this={inputRef}
          bind:value={inputValue}
          on:keydown={handleKeydown}
          type="text"
          placeholder={ui('placeholder')}
          class="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
        />
        <button
          on:click={sendMessage}
          disabled={!inputValue.trim() || isLoading}
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
          style="background: linear-gradient(135deg, #0E7372, #00D4FF);"
          aria-label={ui('send')}
        >
          <SendIcon size={16} />
        </button>
      </div>
      <p class="mt-1.5 text-center text-[10px] text-gray-400">
        {ui('disclaimer')}
      </p>
    </div>
  </div>
{/if}

<style>
  .chat-toggle,
  .chat-panel {
    bottom: 1.5rem;
  }

  .landing-chat-position {
    top: 1.5rem;
    bottom: auto;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  .animate-bounce {
    animation: bounce 1s infinite;
  }

  @media (min-width: 769px) {
    .chat-toggle.landing-chat-position,
    .chat-panel.landing-chat-position {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .chat-toggle.landing-chat-position {
      top: auto;
      right: 1rem;
      bottom: 5.25rem;
    }

    .chat-panel,
    .chat-panel.landing-chat-position {
      top: auto;
      right: 1rem;
      bottom: 5.25rem;
      left: 1rem;
      width: auto;
      height: min(28rem, calc(100svh - 7rem));
    }
  }
</style>
