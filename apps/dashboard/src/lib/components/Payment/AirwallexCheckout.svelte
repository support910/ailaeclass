<script lang="ts" context="module">
  let sdkPromise: Promise<any> | null = null;

  function loadAirwallexSdk() {
    if (typeof window === 'undefined') return Promise.reject(new Error('Browser required'));
    const existing = (window as any).AirwallexComponentsSDK;
    if (existing) return Promise.resolve(existing);
    if (sdkPromise) return sdkPromise;

    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://static.airwallex.com/components/sdk/v1/index.js';
      script.async = true;
      script.onload = () => {
        const sdk = (window as any).AirwallexComponentsSDK;
        if (sdk) resolve(sdk);
        else reject(new Error('Airwallex SDK unavailable'));
      };
      script.onerror = () => reject(new Error('Airwallex SDK failed to load'));
      document.head.appendChild(script);
    });
    return sdkPromise;
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import Checkmark from 'carbon-icons-svelte/lib/Checkmark.svelte';
  import CurrencyDollar from 'carbon-icons-svelte/lib/CurrencyDollar.svelte';
  import Locked from 'carbon-icons-svelte/lib/Locked.svelte';
  import Security from 'carbon-icons-svelte/lib/Security.svelte';
  import Wallet from 'carbon-icons-svelte/lib/Wallet.svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { selectedLocale, t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';

  type CheckoutResponse = {
    env: 'demo' | 'prod';
    currency: 'HKD';
    intentId: string;
    clientSecret: string;
    successUrl: string;
    cancelUrl: string;
  };

  const dispatch = createEventDispatcher<{ refresh: void }>();
  let configured = false;
  let mode: 'demo' | 'prod' = 'demo';
  let checking = true;
  let redirecting = false;
  let amount: string | number = '';
  let amountError = '';
  let message = '';
  let messageType: 'info' | 'error' = 'info';
  let refreshTimers: ReturnType<typeof setTimeout>[] = [];

  const AIRWALLEX_LOCALES: Record<string, string> = {
    en: 'en',
    zh: 'zh',
    'zh-TW': 'zh-HK',
    fr: 'fr',
    es: 'es',
    de: 'de',
    pl: 'pl',
    pt: 'pt',
    ru: 'ru',
    da: 'da',
    id: 'id',
    ms: 'ms',
    vi: 'vi'
  };

  async function api(path: string, init: RequestInit = {}) {
    const token = await getAccessToken();
    if (!token) throw new Error($t('payment.login_required'));
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(path, { ...init, headers });
    const result = await response.json().catch(() => ({ success: false }));
    if (!response.ok || !result.success) {
      throw new Error(result.message || $t('payment.request_failed'));
    }
    return result;
  }

  async function loadConfiguration() {
    checking = true;
    try {
      const result = await api('/api/payments/airwallex/checkout');
      configured = result.airwallex?.configured === true;
      mode = result.airwallex?.mode === 'prod' ? 'prod' : 'demo';
    } catch (error) {
      configured = false;
      message = error instanceof Error ? error.message : $t('payment.request_failed');
      messageType = 'error';
    } finally {
      checking = false;
    }
  }

  onMount(() => {
    loadConfiguration();
    if ($page.url.searchParams.get('payment') === 'airwallex-return') {
      message = $t('payment.airwallex_return_pending');
      messageType = 'info';
      dispatch('refresh');
      refreshTimers = [1500, 3500, 7000].map((delay) =>
        setTimeout(() => dispatch('refresh'), delay)
      );
    }
  });

  onDestroy(() => refreshTimers.forEach(clearTimeout));

  async function beginCheckout() {
    const amountText = String(amount).trim();
    if (!amountText) {
      amountError = $t('payment.amount_required');
      return;
    }
    const numericAmount = Number(amountText);
    if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1_000_000) {
      amountError = $t('payment.amount_invalid');
      return;
    }
    if (!configured) {
      message = $t('payment.airwallex_waiting_setup');
      messageType = 'error';
      return;
    }

    amountError = '';
    message = '';
    redirecting = true;
    try {
      const result = await api('/api/payments/airwallex/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountText,
          organizationId: $currentOrg.id || '',
          returnPath: $page.url.pathname
        })
      });
      const checkout = result.checkout as CheckoutResponse;
      const sdk = await loadAirwallexSdk();
      const { payments } = await sdk.init({
        env: checkout.env,
        locale: AIRWALLEX_LOCALES[$selectedLocale] || 'en',
        enabledElements: ['payments']
      });
      dispatch('refresh');
      payments.redirectToCheckout({
        env: checkout.env,
        mode: 'payment',
        currency: checkout.currency,
        intent_id: checkout.intentId,
        client_secret: checkout.clientSecret,
        successUrl: checkout.successUrl,
        cancelUrl: checkout.cancelUrl,
        methods: ['fps', 'alipayhk', 'alipaycn', 'wechatpay', 'card'],
        appearance: {
          mode: 'light',
          variables: { colorBrand: '#1f4d78', borderRadius: '6px' }
        }
      });
    } catch (error) {
      message = error instanceof Error ? error.message : $t('payment.airwallex_open_failed');
      messageType = 'error';
      redirecting = false;
    }
  }
</script>

<section class="mb-8 border-b border-gray-200 pb-8 dark:border-neutral-700">
  <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
    <div class="max-w-2xl">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{$t('payment.airwallex_title')}</h2>
        {#if checking}
          <span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-neutral-800 dark:text-gray-300">{$t('payment.loading')}</span>
        {:else if configured}
          <span class="rounded px-2 py-1 text-xs font-semibold {mode === 'prod' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}">
            {mode === 'prod' ? $t('payment.airwallex_live') : $t('payment.airwallex_sandbox')}
          </span>
        {:else}
          <span class="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-neutral-800 dark:text-gray-300">{$t('payment.airwallex_not_configured')}</span>
        {/if}
      </div>
      <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{$t('payment.airwallex_description')}</p>
      <div class="mt-4 flex flex-wrap gap-2" aria-label={$t('payment.airwallex_methods')}>
        {#each [$t('payment.fps'), $t('payment.alipay'), $t('payment.wechat'), $t('payment.airwallex_cards')] as method}
          <span class="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-gray-200">
            <Checkmark size={14} class="text-green-700 dark:text-green-300" />{method}
          </span>
        {/each}
      </div>
    </div>

    <div class="flex min-w-[210px] items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
      <Security size={20} class="mt-0.5 shrink-0 text-primary-800 dark:text-primary-200" />
      <p>{$t('payment.airwallex_hosted_notice')}</p>
    </div>
  </div>

  {#if message}
    <div aria-live="polite" class="mt-5 border-l-4 px-4 py-3 text-sm {messageType === 'error' ? 'border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' : 'border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100'}">
      {message}
    </div>
  {/if}

  <form class="mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end" novalidate on:submit|preventDefault={beginCheckout}>
    <div class="min-w-0 flex-1">
      <label for="airwallex-amount" class="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-100">{$t('payment.amount_label')}</label>
      <div class="flex h-12 overflow-hidden rounded-md border {amountError ? 'border-red-500' : 'border-gray-300 focus-within:border-primary-700'} bg-white dark:border-neutral-600 dark:bg-neutral-800">
        <span class="flex w-16 shrink-0 items-center justify-center border-r border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-gray-200">HK$</span>
        <input
          id="airwallex-amount"
          bind:value={amount}
          type="number"
          inputmode="decimal"
          min="0.01"
          max="1000000"
          step="0.01"
          placeholder={$t('payment.amount_placeholder')}
          class="min-w-0 flex-1 border-0 bg-transparent px-4 text-base text-gray-900 outline-none dark:text-white"
          on:input={() => (amountError = '')}
        />
      </div>
      {#if amountError}<p class="mt-2 text-sm text-red-600 dark:text-red-300">{amountError}</p>{/if}
    </div>
    <button
      type="submit"
      disabled={checking || redirecting || !configured}
      class="inline-flex h-12 min-w-[190px] items-center justify-center gap-2 rounded-md bg-primary-800 px-5 text-sm font-semibold text-white transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:bg-gray-400"
    >
      {#if configured}<Wallet size={18} />{:else}<Locked size={18} />{/if}
      {redirecting ? $t('payment.airwallex_redirecting') : $t('payment.airwallex_pay')}
    </button>
  </form>
</section>
