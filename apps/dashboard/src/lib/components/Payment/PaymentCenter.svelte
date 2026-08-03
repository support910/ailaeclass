<script lang="ts">
  import { onMount } from 'svelte';
  import Checkmark from 'carbon-icons-svelte/lib/Checkmark.svelte';
  import Copy from 'carbon-icons-svelte/lib/Copy.svelte';
  import CurrencyDollar from 'carbon-icons-svelte/lib/CurrencyDollar.svelte';
  import Security from 'carbon-icons-svelte/lib/Security.svelte';
  import Upload from 'carbon-icons-svelte/lib/Upload.svelte';
  import View from 'carbon-icons-svelte/lib/View.svelte';
  import Wallet from 'carbon-icons-svelte/lib/Wallet.svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import AirwallexCheckout from './AirwallexCheckout.svelte';

  type PaymentStatus =
    | 'awaiting_payment'
    | 'processing'
    | 'receipt_submitted'
    | 'verified'
    | 'failed'
    | 'rejected'
    | 'cancelled'
    | 'expired';

  type PaymentOrder = {
    id: string;
    reference: string;
    payer_email: string;
    organization_id: string | null;
    amount_minor: number;
    currency: 'HKD';
    payment_method: 'fps' | 'airwallex';
    provider: 'manual_fps' | 'airwallex';
    provider_payment_intent_id: string | null;
    provider_status: string | null;
    status: PaymentStatus;
    receipt_original_name: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
    review_note: string;
    expires_at: string;
    created_at: string;
    updated_at: string;
  };

  const FPS_IDENTIFIER = '96847368';
  const FPS_RECIPIENT = '5G numultimedia ltd';
  const ADMIN_EMAIL = 'admin@5gnu.com';
  const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

  let amount: string | number = '';
  let amountError = '';
  let copiedField = '';
  let creating = false;
  let loadingOrders = false;
  let loadingReview = false;
  let uploadingOrderId = '';
  let reviewingOrderId = '';
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let currentOrder: PaymentOrder | null = null;
  let orders: PaymentOrder[] = [];
  let reviewOrders: PaymentOrder[] = [];
  let receiptFiles: Record<string, File | null> = {};
  let reviewNotes: Record<string, string> = {};
  let bankChecks: Record<string, boolean> = {};
  let localDemo = false;

  $: isAdmin = $profile.email?.trim().toLowerCase() === ADMIN_EMAIL;
  $: numericAmount = Number(amount);

  function formatAmount(minor: number) {
    return new Intl.NumberFormat('en-HK', {
      style: 'currency',
      currency: 'HKD',
      minimumFractionDigits: 2
    }).format(minor / 100);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
  }

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

  async function loadOrders() {
    loadingOrders = true;
    try {
      const result = await api('/api/payments');
      localDemo = result.localDemo === true;
      orders = result.orders || [];
      if (currentOrder) currentOrder = orders.find((item) => item.id === currentOrder?.id) || currentOrder;
    } catch (error) {
      showMessage(error instanceof Error ? error.message : $t('payment.request_failed'), 'error');
    } finally {
      loadingOrders = false;
    }
  }

  async function loadReviewOrders() {
    if (!isAdmin) return;
    loadingReview = true;
    try {
      const result = await api('/api/payments?scope=review');
      localDemo = result.localDemo === true;
      reviewOrders = result.orders || [];
    } catch (error) {
      showMessage(error instanceof Error ? error.message : $t('payment.request_failed'), 'error');
    } finally {
      loadingReview = false;
    }
  }

  onMount(async () => {
    await loadOrders();
    if (isAdmin) await loadReviewOrders();
  });

  async function createOrder() {
    const amountText = String(amount).trim();
    if (!amountText) {
      amountError = $t('payment.amount_required');
      return;
    }
    if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1_000_000) {
      amountError = $t('payment.amount_invalid');
      return;
    }

    amountError = '';
    message = '';
    creating = true;
    try {
      const result = await api('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountText, organizationId: $currentOrg.id || '' })
      });
      currentOrder = result.order;
      localDemo = result.localDemo === true;
      orders = [result.order, ...orders.filter((item) => item.id !== result.order.id)];
      showMessage($t('payment.order_created'), 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : $t('payment.request_failed'), 'error');
    } finally {
      creating = false;
    }
  }

  function resetPayment() {
    amount = '';
    amountError = '';
    currentOrder = null;
    copiedField = '';
    message = '';
  }

  async function copyValue(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      copiedField = field;
      window.setTimeout(() => {
        if (copiedField === field) copiedField = '';
      }, 1800);
    } catch {
      showMessage($t('payment.copy_failed'), 'error');
    }
  }

  function chooseReceipt(orderId: string, event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0] || null;
    if (file && file.size > MAX_RECEIPT_SIZE) {
      receiptFiles = { ...receiptFiles, [orderId]: null };
      showMessage($t('payment.receipt_too_large'), 'error');
      return;
    }
    receiptFiles = { ...receiptFiles, [orderId]: file };
    message = '';
  }

  function setReviewNote(orderId: string, event: Event) {
    reviewNotes = {
      ...reviewNotes,
      [orderId]: (event.currentTarget as HTMLTextAreaElement).value
    };
  }

  function setBankCheck(orderId: string, event: Event) {
    bankChecks = {
      ...bankChecks,
      [orderId]: (event.currentTarget as HTMLInputElement).checked
    };
  }

  async function uploadReceipt(order: PaymentOrder) {
    const file = receiptFiles[order.id];
    if (!file) {
      showMessage($t('payment.receipt_required'), 'error');
      return;
    }
    uploadingOrderId = order.id;
    message = '';
    try {
      const form = new FormData();
      form.set('receipt', file);
      const result = await api(`/api/payments/${order.id}/receipt`, { method: 'POST', body: form });
      orders = orders.map((item) => (item.id === order.id ? result.order : item));
      if (currentOrder?.id === order.id) currentOrder = result.order;
      receiptFiles = { ...receiptFiles, [order.id]: null };
      showMessage($t('payment.receipt_submitted_success'), 'success');
      if (isAdmin) await loadReviewOrders();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : $t('payment.request_failed'), 'error');
    } finally {
      uploadingOrderId = '';
    }
  }

  async function viewReceipt(orderId: string) {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error($t('payment.login_required'));
      const response = await fetch(`/api/payments/${orderId}/receipt`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error($t('payment.receipt_load_failed'));
      const url = URL.createObjectURL(await response.blob());
      if (popup) popup.location.href = url;
      else {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      popup?.close();
      showMessage(error instanceof Error ? error.message : $t('payment.receipt_load_failed'), 'error');
    }
  }

  async function reviewPayment(order: PaymentOrder, decision: 'verified' | 'rejected') {
    const note = reviewNotes[order.id]?.trim() || '';
    if (decision === 'verified' && !bankChecks[order.id]) {
      showMessage($t('payment.bank_check_required'), 'error');
      return;
    }
    if (decision === 'rejected' && note.length < 3) {
      showMessage($t('payment.rejection_reason_required'), 'error');
      return;
    }
    reviewingOrderId = order.id;
    message = '';
    try {
      const result = await api('/api/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          decision,
          reviewNote: note,
          bankConfirmed: bankChecks[order.id] === true
        })
      });
      reviewOrders = reviewOrders.map((item) => (item.id === order.id ? result.order : item));
      orders = orders.map((item) => (item.id === order.id ? result.order : item));
      showMessage(decision === 'verified' ? $t('payment.verified_success') : $t('payment.rejected_success'), 'success');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : $t('payment.request_failed'), 'error');
    } finally {
      reviewingOrderId = '';
    }
  }

  function statusClass(status: PaymentStatus) {
    if (status === 'verified') return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200';
    if (status === 'processing') return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
    if (status === 'receipt_submitted') return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
    if (status === 'rejected' || status === 'failed') return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
    return 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-200';
  }
</script>

<svelte:head><title>{$t('payment.title')} - ailaeclass</title></svelte:head>

<main class="h-[calc(100vh-48px)] overflow-y-auto bg-white py-6 pb-24 pl-4 pr-20 dark:bg-black md:px-7">
  <div class="mx-auto w-full max-w-6xl">
    <header class="mb-6 flex items-start gap-3">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-white">
        <Wallet size={23} />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white">{$t('payment.title')}</h1>
        <p class="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">{$t('payment.secure_subtitle')}</p>
      </div>
    </header>

    <div class="mb-6 flex gap-3 border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950 dark:bg-blue-950 dark:text-blue-100">
      <Security size={21} class="mt-0.5 shrink-0" />
      <div>
        <p class="font-semibold">{$t('payment.security_title')}</p>
        <p>{$t('payment.airwallex_hosted_notice')} {$t('payment.manual_fps_description')}</p>
      </div>
    </div>

    {#if message}
      <div aria-live="polite" class="mb-5 rounded-md border px-4 py-3 text-sm {messageType === 'success' ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200' : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'}">
        {message}
      </div>
    {/if}

    {#if localDemo}
      <div class="mb-5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        {$t('payment.local_demo_notice')}
      </div>
    {/if}

    <AirwallexCheckout on:refresh={loadOrders} />

    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
      <section>
        <h2 class="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{$t('payment.manual_fps_title')}</h2>
        <p class="mb-4 text-sm leading-6 text-gray-500 dark:text-gray-400">{$t('payment.manual_fps_description')}</p>
        <form novalidate on:submit|preventDefault={createOrder}>
          <div class="mb-6">
            <label for="payment-amount" class="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-100">{$t('payment.amount_label')}</label>
            <div class="flex h-14 overflow-hidden rounded-md border {amountError ? 'border-red-500' : 'border-gray-300 focus-within:border-primary-700'} bg-white dark:border-neutral-600 dark:bg-neutral-800">
              <span class="flex w-16 shrink-0 items-center justify-center border-r border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-gray-200">HK$</span>
              <input
                id="payment-amount"
                bind:value={amount}
                disabled={!!currentOrder}
                type="number"
                inputmode="decimal"
                min="0.01"
                max="1000000"
                step="0.01"
                placeholder={$t('payment.amount_placeholder')}
                class="min-w-0 flex-1 border-0 bg-transparent px-4 text-lg text-gray-900 outline-none disabled:bg-gray-50 dark:text-white dark:disabled:bg-neutral-900"
                on:input={() => (amountError = '')}
              />
            </div>
            {#if amountError}<p class="mt-2 text-sm text-red-600 dark:text-red-300">{amountError}</p>{/if}
          </div>

          <fieldset disabled={!!currentOrder}>
            <legend class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{$t('payment.select_method')}</legend>
            <div class="grid max-w-sm gap-3">
              <div class="flex min-h-[116px] flex-col items-start justify-between rounded-md border-2 border-primary-700 bg-primary-50 p-4 dark:bg-primary-950">
                <div class="flex w-full items-center justify-between gap-2">
                  <CurrencyDollar size={22} class="text-primary-800 dark:text-primary-200" />
                  <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary-800 text-white"><Checkmark size={15} /></span>
                </div>
                <div><p class="font-semibold text-gray-900 dark:text-white">{$t('payment.fps')}</p><p class="mt-1 text-xs text-gray-600 dark:text-gray-300">{$t('payment.fps_description')}</p></div>
              </div>
            </div>
          </fieldset>

          {#if !currentOrder}
            <button type="submit" disabled={creating} class="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary-800 px-5 text-sm font-semibold text-white transition hover:bg-primary-900 disabled:cursor-wait disabled:opacity-60">
              <Wallet size={18} />{creating ? $t('payment.creating_order') : $t('payment.create_secure_order')}
            </button>
          {/if}
        </form>
      </section>

      <aside class="border-gray-200 lg:border-l lg:pl-8 dark:border-neutral-700">
        <h2 class="text-lg font-semibold text-[#040F2D] dark:text-white">{$t('payment.payment_summary')}</h2>
        {#if currentOrder}
          <div class="mt-4 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-900">
            <div class="p-4"><p class="text-xs font-medium uppercase text-gray-500">{$t('payment.amount')}</p><p class="mt-1 text-2xl font-bold text-primary-800 dark:text-primary-200">{formatAmount(currentOrder.amount_minor)}</p></div>
            <div class="p-4">
              <p class="text-xs font-medium uppercase text-gray-500">{$t('payment.payment_reference')}</p>
              <div class="mt-1 flex items-center justify-between gap-3"><p class="break-all font-semibold text-gray-900 dark:text-white">{currentOrder.reference}</p><button type="button" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-200" title={$t('payment.copy')} on:click={() => copyValue('reference', currentOrder?.reference || '')}>{#if copiedField === 'reference'}<Checkmark size={17} />{:else}<Copy size={17} />{/if}</button></div>
            </div>
            <div class="p-4">
              <p class="text-xs font-medium uppercase text-gray-500">{$t('payment.fps_identifier')}</p>
              <div class="mt-1 flex items-center justify-between gap-3"><p class="font-semibold text-gray-900 dark:text-white">{FPS_IDENTIFIER}</p><button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-700 dark:border-neutral-600 dark:text-gray-200" title={$t('payment.copy')} on:click={() => copyValue('fps', FPS_IDENTIFIER)}>{#if copiedField === 'fps'}<Checkmark size={17} />{:else}<Copy size={17} />{/if}</button></div>
            </div>
            <div class="p-4"><p class="text-xs font-medium uppercase text-gray-500">{$t('payment.recipient')}</p><p class="mt-1 font-semibold text-gray-900 dark:text-white">{FPS_RECIPIENT}</p></div>
          </div>
          <div class="mt-4 border-l-4 border-primary-700 bg-primary-50 px-4 py-3 text-sm leading-6 text-gray-700 dark:bg-primary-950 dark:text-gray-200">
            <p class="font-semibold">{$t('payment.instructions_title')}</p>
            <p>{$t('payment.secure_instructions')}</p>
          </div>
          <p class="mt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">{$t('payment.expires_at')}: {formatDate(currentOrder.expires_at)}</p>
          <button type="button" class="mt-3 text-sm font-medium text-primary-800 hover:underline dark:text-primary-200" on:click={resetPayment}>{$t('payment.create_another')}</button>
        {:else}
          <div class="mt-4 flex min-h-[280px] flex-col items-center justify-center rounded-md border border-dashed border-gray-300 px-6 text-center dark:border-neutral-600">
            <CurrencyDollar size={32} class="text-gray-400" />
            <p class="mt-3 max-w-xs text-sm leading-6 text-gray-500 dark:text-gray-400">{$t('payment.secure_empty_summary')}</p>
          </div>
        {/if}
      </aside>
    </div>

    <section class="mt-10 border-t border-gray-200 pt-7 dark:border-neutral-700">
      <div class="mb-4 flex items-center justify-between gap-4"><div><h2 class="text-lg font-semibold text-gray-900 dark:text-white">{$t('payment.my_orders')}</h2><p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{$t('payment.my_orders_hint')}</p></div><button type="button" class="text-sm font-medium text-primary-800 hover:underline dark:text-primary-200" on:click={loadOrders}>{$t('payment.refresh')}</button></div>
      {#if loadingOrders}<p class="py-8 text-sm text-gray-500">{$t('payment.loading')}</p>
      {:else if !orders.length}<p class="border-t border-gray-200 py-8 text-sm text-gray-500 dark:border-neutral-700">{$t('payment.no_orders')}</p>
      {:else}
        <div class="space-y-3">
          {#each orders as order}
            <article class="rounded-md border border-gray-200 p-4 pr-20 dark:border-neutral-700 dark:bg-neutral-900">
              <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2"><span class="rounded px-2 py-1 text-xs font-medium {statusClass(order.status)}">{$t(`payment.status_${order.status}`)}</span><span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-neutral-800 dark:text-gray-300">{order.payment_method === 'airwallex' ? 'Airwallex' : $t('payment.manual_fps_short')}</span><span class="break-all text-sm font-semibold text-gray-900 dark:text-white">{order.reference}</span></div>
                  <p class="mt-2 text-sm text-gray-700 dark:text-gray-200">{formatAmount(order.amount_minor)} · {formatDate(order.created_at)}</p>
                  {#if order.review_note}<p class="mt-2 text-sm text-red-700 dark:text-red-300">{$t('payment.review_note')}: {order.review_note}</p>{/if}
                </div>
                {#if order.receipt_original_name}<button type="button" class="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-2 rounded-md border border-gray-300 px-3 text-sm dark:border-neutral-600 dark:text-white" on:click={() => viewReceipt(order.id)}><View size={17} />{$t('payment.view_receipt')}</button>{/if}
              </div>
              {#if order.payment_method === 'fps' && (order.status === 'awaiting_payment' || order.status === 'rejected')}
                <div class="mt-4 border-t border-gray-200 pt-4 dark:border-neutral-700">
                  <p class="block text-sm font-medium text-gray-800 dark:text-white">{$t('payment.upload_receipt')}</p>
                  <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="min-w-0 flex-1 text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm dark:text-gray-300 dark:file:border-neutral-600 dark:file:bg-neutral-800 dark:file:text-white" on:change={(event) => chooseReceipt(order.id, event)} /><button type="button" disabled={uploadingOrderId === order.id} class="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-primary-800 px-4 text-sm font-semibold text-white disabled:opacity-60" on:click={() => uploadReceipt(order)}><Upload size={17} />{uploadingOrderId === order.id ? $t('payment.uploading') : $t('payment.submit_receipt')}</button></div>
                  <p class="mt-2 text-xs text-gray-500">{$t('payment.receipt_hint')}</p>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </section>

    {#if isAdmin}
      <section class="mt-10 border-t border-gray-200 pt-7 dark:border-neutral-700">
        <div class="mb-4 flex items-center justify-between gap-4"><div><h2 class="text-lg font-semibold text-gray-900 dark:text-white">{$t('payment.admin_review')}</h2><p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{$t('payment.admin_review_hint')}</p></div><button type="button" class="text-sm font-medium text-primary-800 hover:underline dark:text-primary-200" on:click={loadReviewOrders}>{$t('payment.refresh')}</button></div>
        {#if loadingReview}<p class="py-8 text-sm text-gray-500">{$t('payment.loading')}</p>
        {:else}
          <div class="space-y-3">
            {#each reviewOrders.filter((order) => order.status === 'receipt_submitted') as order}
              <article class="rounded-md border border-amber-300 bg-amber-50 p-4 pr-20 dark:border-amber-800 dark:bg-amber-950/30">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p class="break-all font-semibold text-gray-900 dark:text-white">{order.reference}</p><p class="mt-1 text-sm text-gray-700 dark:text-gray-200">{order.payer_email} · {formatAmount(order.amount_minor)}</p></div><button type="button" class="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white" on:click={() => viewReceipt(order.id)}><View size={17} />{$t('payment.view_receipt')}</button></div>
                <textarea maxlength="1000" rows="2" value={reviewNotes[order.id] || ''} on:input={(event) => setReviewNote(order.id, event)} placeholder={$t('payment.review_note_placeholder')} class="mt-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white" />
                <label class="mt-3 flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200"><input type="checkbox" checked={bankChecks[order.id] || false} on:change={(event) => setBankCheck(order.id, event)} class="mt-0.5 rounded border-gray-400" /><span>{$t('payment.bank_statement_confirmation')}</span></label>
                <div class="mt-4 flex flex-wrap gap-2"><button type="button" disabled={reviewingOrderId === order.id} class="min-h-[40px] rounded-md bg-green-700 px-4 text-sm font-semibold text-white disabled:opacity-60" on:click={() => reviewPayment(order, 'verified')}>{$t('payment.confirm_received')}</button><button type="button" disabled={reviewingOrderId === order.id} class="min-h-[40px] rounded-md border border-red-400 bg-white px-4 text-sm font-semibold text-red-700 disabled:opacity-60 dark:bg-neutral-900 dark:text-red-300" on:click={() => reviewPayment(order, 'rejected')}>{$t('payment.reject_receipt')}</button></div>
              </article>
            {/each}
            {#if !reviewOrders.some((order) => order.status === 'receipt_submitted')}<p class="border-t border-gray-200 py-8 text-sm text-gray-500 dark:border-neutral-700">{$t('payment.no_pending_review')}</p>{/if}
          </div>
        {/if}
      </section>
    {/if}
  </div>
</main>
