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

  let isOpen = false;
  let isExpanded = false;
  let inputValue = '';
  let messages: { role: 'user' | 'bot'; text: string }[] = [];
  let isLoading = false;
  let chatContainer: HTMLDivElement;
  let inputRef: HTMLInputElement;
  $: isLandingPage = $page.url.pathname === '/';

  const welcomeMessage = {
    role: 'bot' as const,
    text: "Hello! I'm the ailaeclass AI assistant. I can tell you all about 5G nuMultiMedia, our low-altitude economy services, drone training, and how to use this platform. What would you like to know?"
  };

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
        let friendly = 'Sorry, the AI service is temporarily unavailable. Please try again later.';

        if (status === 503 && code === 'missing_deepseek_key') {
          friendly = 'AI assistant is not configured. Please set PRIVATE_DEEPSEEK_API_KEY and restart the server.';
        } else if (status === 502 && code === 'upstream_error') {
          friendly = 'AI service is temporarily unavailable.';
        } else if (status === 400) {
          friendly = data.error || 'Invalid request. Please try again.';
        } else if (data.error) {
          friendly = data.error;
        }

        messages = [...messages, { role: 'bot', text: friendly }];
      } else if (data.reply) {
        messages = [...messages, { role: 'bot', text: data.reply }];
      } else {
        messages = [
          ...messages,
          {
            role: 'bot',
            text: 'Sorry, the AI service returned an unexpected response. Please try again later.'
          }
        ];
      }
    } catch (err) {
      console.error('Chat request failed:', err);
      messages = [...messages, { role: 'bot', text: 'Sorry, the AI service is temporarily unavailable. Please try again later.' }];
    } finally {
      isLoading = false;
      await scrollToBottom();
      inputRef?.focus();
    }
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
    aria-label="Open chat"
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
          <p class="text-xs text-white/80">AI Assistant</p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          on:click={toggleExpand}
          class="rounded p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
          aria-label={isExpanded ? 'Minimize' : 'Maximize'}
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
          aria-label="Close chat"
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
          placeholder="Ask about 5GNU, drones, or this platform..."
          class="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
        />
        <button
          on:click={sendMessage}
          disabled={!inputValue.trim() || isLoading}
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
          style="background: linear-gradient(135deg, #0E7372, #00D4FF);"
          aria-label="Send"
        >
          <SendIcon size={16} />
        </button>
      </div>
      <p class="mt-1.5 text-center text-[10px] text-gray-400">
        AI responses are limited to 5G nuMultiMedia & ailaeclass topics only
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
