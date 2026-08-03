import { dev } from '$app/environment';
import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import type { RequestHandler } from './$types';
import {
  createAirwallexReference,
  authenticatePaymentRequest,
  ORDER_VALIDITY_HOURS,
  parseAmountToMinor,
  verifyPaymentOrgMembership
} from '$lib/server/payments/security';
import {
  createAirwallexPaymentIntent,
  getAirwallexPublicConfig
} from '$lib/server/payments/airwallex.server';
import {
  attachDevAirwallexIntent,
  createDevPaymentOrder,
  failDevAirwallexOrder
} from '$lib/server/payments/devStore.server';

export const GET: RequestHandler = async ({ request }) => {
  const { user } = await authenticatePaymentRequest(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  return json({ success: true, airwallex: getAirwallexPublicConfig() });
};

export const POST: RequestHandler = async ({ request }) => {
  const { supabase, user } = await authenticatePaymentRequest(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const config = getAirwallexPublicConfig();
  if (!config.configured) {
    return json(
      { success: false, message: 'Airwallex merchant checkout is waiting for account configuration.' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const amountMinor = parseAmountToMinor(body?.amount);
  const organizationId = String(body?.organizationId || '').trim();
  const returnPath = String(body?.returnPath || '').trim();
  if (amountMinor === null) {
    return json(
      { success: false, message: 'Enter an amount from HK$0.01 to HK$1,000,000.00.' },
      { status: 400 }
    );
  }
  if (!(await verifyPaymentOrgMembership(supabase, user.id, organizationId))) {
    return json({ success: false, message: 'Organization access denied.' }, { status: 403 });
  }

  const reference = createAirwallexReference();
  const providerRequestId = randomUUID();
  const expiresAt = new Date(Date.now() + ORDER_VALIDITY_HOURS * 60 * 60 * 1000).toISOString();
  let order: any;

  try {
    if (dev) {
      order = createDevPaymentOrder({
        id: randomUUID(),
        reference,
        payerProfileId: user.id,
        payerEmail: user.email.toLowerCase(),
        organizationId: organizationId || null,
        amountMinor,
        expiresAt,
        paymentMethod: 'airwallex',
        providerRequestId
      });
    } else {
      const { data, error } = await supabase
        .rpc('create_airwallex_payment_order_secure', {
          p_reference: reference,
          p_payer_profile_id: user.id,
          p_payer_email: user.email.toLowerCase(),
          p_organization_id: organizationId || null,
          p_amount_minor: amountMinor,
          p_expires_at: expiresAt,
          p_provider_request_id: providerRequestId
        })
        .single();
      if (error || !data) throw error || new Error('PAYMENT_ORDER_CREATE_FAILED');
      order = data;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const rateLimited = message.includes('PAYMENT_RATE_LIMIT');
    console.error('Airwallex internal order creation failed', { rateLimited });
    return json(
      {
        success: false,
        message: rateLimited
          ? 'Too many payment orders. Please wait before trying again.'
          : 'Unable to create a secure payment order.'
      },
      { status: rateLimited ? 429 : 500 }
    );
  }

  try {
    const intent = await createAirwallexPaymentIntent({
      providerRequestId,
      reference,
      amountMinor,
      payerEmail: user.email.toLowerCase(),
      returnPath
    });

    if (dev) {
      order = attachDevAirwallexIntent({
        orderId: order.id,
        payerProfileId: user.id,
        intentId: intent.intentId,
        providerStatus: intent.providerStatus
      });
    } else {
      const { data, error } = await supabase
        .rpc('attach_airwallex_payment_intent_secure', {
          p_order_id: order.id,
          p_payer_profile_id: user.id,
          p_provider_payment_intent_id: intent.intentId,
          p_provider_status: intent.providerStatus
        })
        .single();
      if (error || !data) throw error || new Error('PAYMENT_INTENT_ATTACH_FAILED');
      order = data;
    }

    return json({
      success: true,
      order,
      checkout: {
        env: intent.mode,
        currency: 'HKD',
        intentId: intent.intentId,
        clientSecret: intent.clientSecret,
        successUrl: intent.returnUrl,
        cancelUrl: intent.returnUrl
      },
      localDemo: dev
    });
  } catch (error) {
    if (dev) failDevAirwallexOrder(order.id, user.id);
    else {
      await supabase.rpc('fail_airwallex_payment_order_secure', {
        p_order_id: order.id,
        p_payer_profile_id: user.id,
        p_provider_status: 'CREATE_FAILED'
      });
    }
    console.error('Airwallex checkout initialization failed', {
      orderId: order.id,
      reason: error instanceof Error ? error.message : 'unknown'
    });
    return json(
      { success: false, message: 'Unable to open Airwallex checkout. No payment was taken.' },
      { status: 502 }
    );
  }
};
