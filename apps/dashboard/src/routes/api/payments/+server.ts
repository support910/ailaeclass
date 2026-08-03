import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import {
  authenticatePaymentRequest,
  createPaymentReference,
  isPaymentAdmin,
  ORDER_VALIDITY_HOURS,
  parseAmountToMinor,
  verifyPaymentOrgMembership
} from '$lib/server/payments/security';
import {
  createDevPaymentOrder,
  listDevPaymentOrders,
  reviewDevPaymentOrder
} from '$lib/server/payments/devStore.server';

const ORDER_FIELDS =
  'id, reference, payer_email, organization_id, amount_minor, currency, payment_method, provider, provider_payment_intent_id, provider_status, status, receipt_original_name, submitted_at, paid_at, reviewed_at, review_note, expires_at, created_at, updated_at';

export const POST: RequestHandler = async ({ request }) => {
  const { supabase, user } = await authenticatePaymentRequest(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const amountMinor = parseAmountToMinor(body?.amount);
  const organizationId = String(body?.organizationId || '').trim();
  if (amountMinor === null) {
    return json(
      { success: false, message: 'Enter an amount from HK$0.01 to HK$1,000,000.00.' },
      { status: 400 }
    );
  }
  if (!(await verifyPaymentOrgMembership(supabase, user.id, organizationId))) {
    return json({ success: false, message: 'Organization access denied.' }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + ORDER_VALIDITY_HOURS * 60 * 60 * 1000).toISOString();
  if (dev) {
    try {
      const order = createDevPaymentOrder({
        id: randomUUID(),
        reference: createPaymentReference(),
        payerProfileId: user.id,
        payerEmail: user.email.toLowerCase(),
        organizationId: organizationId || null,
        amountMinor,
        expiresAt
      });
      return json({ success: true, order, localDemo: true }, { status: 201 });
    } catch (error) {
      const rateLimited = error instanceof Error && error.message === 'PAYMENT_RATE_LIMIT';
      return json(
        { success: false, message: rateLimited ? 'Too many payment orders. Please wait before trying again.' : 'Unable to create a local payment order.' },
        { status: rateLimited ? 429 : 500 }
      );
    }
  }

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .rpc('create_payment_order_secure', {
        p_reference: createPaymentReference(),
        p_payer_profile_id: user.id,
        p_payer_email: user.email.toLowerCase(),
        p_organization_id: organizationId || null,
        p_amount_minor: amountMinor,
        p_expires_at: expiresAt
      })
      .single();
    if (!error && data) return json({ success: true, order: data }, { status: 201 });
    lastError = error?.message || 'Unable to create payment order.';
    if (!lastError.toLowerCase().includes('duplicate')) break;
  }

  const isRateLimited = lastError.includes('PAYMENT_RATE_LIMIT');
  console.error('Payment order creation failed:', lastError);
  return json(
    {
      success: false,
      message: isRateLimited
        ? 'Too many payment orders. Please wait before trying again.'
        : 'Unable to create a secure payment order.'
    },
    { status: isRateLimited ? 429 : 500 }
  );
};

export const GET: RequestHandler = async ({ request, url }) => {
  const { supabase, user } = await authenticatePaymentRequest(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const reviewScope = url.searchParams.get('scope') === 'review';
  if (reviewScope && !isPaymentAdmin(user.email)) {
    return json({ success: false, message: 'Access denied' }, { status: 403 });
  }

  if (dev) {
    return json({
      success: true,
      orders: listDevPaymentOrders(user.id, reviewScope),
      localDemo: true
    });
  }

  await supabase.rpc('expire_stale_payment_orders_secure', {
    p_payer_profile_id: user.id,
    p_include_all: reviewScope
  });

  let query = supabase
    .from('payment_orders')
    .select(ORDER_FIELDS)
    .order('created_at', { ascending: false })
    .limit(reviewScope ? 100 : 25);
  if (!reviewScope) query = query.eq('payer_profile_id', user.id);

  const { data, error } = await query;
  if (error) {
    console.error('Payment order list failed:', error);
    return json({ success: false, message: 'Unable to load payment orders.' }, { status: 500 });
  }
  return json({ success: true, orders: data || [] });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const { supabase, user } = await authenticatePaymentRequest(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!isPaymentAdmin(user.email))
    return json({ success: false, message: 'Access denied' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const orderId = String(body?.id || '').trim();
  const decision = String(body?.decision || '').trim();
  const reviewNote = String(body?.reviewNote || '').trim();
  if (!orderId || !['verified', 'rejected'].includes(decision)) {
    return json({ success: false, message: 'Invalid payment review.' }, { status: 400 });
  }
  if (decision === 'verified' && body?.bankConfirmed !== true) {
    return json(
      { success: false, message: 'Bank statement verification is required.' },
      { status: 400 }
    );
  }
  if (decision === 'rejected' && reviewNote.length < 3) {
    return json({ success: false, message: 'Please enter a rejection reason.' }, { status: 400 });
  }
  if (reviewNote.length > 1000) {
    return json({ success: false, message: 'Review note is too long.' }, { status: 400 });
  }

  if (dev) {
    try {
      const order = reviewDevPaymentOrder({
        orderId,
        reviewerProfileId: user.id,
        decision: decision as 'verified' | 'rejected',
        reviewNote
      });
      return json({ success: true, order, localDemo: true });
    } catch {
      return json({ success: false, message: 'This payment cannot be reviewed in its current state.' }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .rpc('review_payment_order_secure', {
      p_order_id: orderId,
      p_reviewer_profile_id: user.id,
      p_decision: decision,
      p_review_note: reviewNote,
      p_bank_confirmed: body?.bankConfirmed === true
    })
    .single();
  if (error || !data) {
    console.error('Payment review failed:', error);
    return json(
      { success: false, message: 'This payment cannot be reviewed in its current state.' },
      { status: 409 }
    );
  }
  return json({ success: true, order: data });
};
