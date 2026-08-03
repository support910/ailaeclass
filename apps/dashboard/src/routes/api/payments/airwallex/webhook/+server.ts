import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { getAirwallexWebhookSecret } from '$lib/server/payments/airwallex.server';
import {
  airwallexAmountToMinor,
  verifyAirwallexWebhookSignature
} from '$lib/server/payments/airwallexSecurity';

const MAX_WEBHOOK_BYTES = 256 * 1024;
const PAYMENT_INTENT_EVENTS = new Set([
  'payment_intent.created',
  'payment_intent.requires_payment_method',
  'payment_intent.requires_customer_action',
  'payment_intent.pending',
  'payment_intent.pending_review',
  'payment_intent.succeeded',
  'payment_intent.cancelled'
]);

export const POST: RequestHandler = async ({ request }) => {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_WEBHOOK_BYTES) return json({ received: false }, { status: 413 });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) {
    return json({ received: false }, { status: 413 });
  }

  const secret = getAirwallexWebhookSecret();
  const timestamp = request.headers.get('x-timestamp') || '';
  const signature = request.headers.get('x-signature') || '';
  if (!verifyAirwallexWebhookSignature({ rawBody, timestamp, signature, secret })) {
    return json({ received: false }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody || '{}');
  } catch {
    return json({ received: false }, { status: 400 });
  }
  const eventId = String(event?.id || '').trim();
  const eventName = String(event?.name || '').trim();
  if (!eventId || !eventName) return json({ received: false }, { status: 400 });
  if (!PAYMENT_INTENT_EVENTS.has(eventName)) return json({ received: true, ignored: true });

  const paymentIntent = event?.data?.object || {};
  const intentId = String(paymentIntent?.id || '').trim();
  const merchantOrderId = String(paymentIntent?.merchant_order_id || '').trim();
  const currency = String(paymentIntent?.currency || '').trim().toUpperCase();
  const amountMinor = airwallexAmountToMinor(paymentIntent?.amount);
  const providerStatus = String(paymentIntent?.status || '').trim().toUpperCase();
  if (!intentId || !merchantOrderId || amountMinor === null || !currency) {
    return json({ received: false }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc('process_airwallex_payment_event_secure', {
    p_event_id: eventId,
    p_event_name: eventName,
    p_provider_payment_intent_id: intentId,
    p_merchant_order_id: merchantOrderId,
    p_amount_minor: amountMinor,
    p_currency: currency,
    p_provider_status: providerStatus,
    p_event_created_at: event?.created_at || null
  });
  if (error) {
    console.error('Airwallex webhook processing failed', {
      eventId,
      eventName,
      code: error.code || 'unknown'
    });
    return json({ received: false }, { status: 500 });
  }
  return json({ received: true, result: data || null });
};
