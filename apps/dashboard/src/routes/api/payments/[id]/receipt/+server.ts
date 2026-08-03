import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import {
  authenticatePaymentRequest,
  ensurePaymentReceiptBucket,
  isPaymentAdmin,
  PAYMENT_RECEIPT_BUCKET,
  safeReceiptOriginalName,
  verifyReceiptFile
} from '$lib/server/payments/security';
import {
  devReceipt,
  getDevPaymentOrder,
  submitDevPaymentReceipt
} from '$lib/server/payments/devStore.server';

export const POST: RequestHandler = async ({ request, params }) => {
  const { supabase, user } = await authenticatePaymentRequest(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('receipt');
  if (!(file instanceof File)) {
    return json({ success: false, message: 'Please choose a payment receipt.' }, { status: 400 });
  }

  let verifiedFile: Awaited<ReturnType<typeof verifyReceiptFile>>;
  try {
    verifiedFile = await verifyReceiptFile(file);
  } catch (error) {
    return json(
      { success: false, message: error instanceof Error ? error.message : 'Invalid receipt.' },
      { status: 400 }
    );
  }

  if (dev) {
    const order = getDevPaymentOrder(params.id);
    if (!order || order.payer_profile_id !== user.id) {
      return json({ success: false, message: 'Payment order not found.' }, { status: 404 });
    }
    if (order.payment_method !== 'fps') {
      return json({ success: false, message: 'Receipts are only accepted for manual FPS orders.' }, { status: 400 });
    }
    try {
      const updatedOrder = submitDevPaymentReceipt({
        orderId: params.id,
        payerProfileId: user.id,
        originalName: safeReceiptOriginalName(file.name),
        contentType: verifiedFile.contentType,
        bytes: new Uint8Array(await file.arrayBuffer())
      });
      return json({ success: true, order: updatedOrder, localDemo: true });
    } catch {
      return json({ success: false, message: 'A receipt cannot be uploaded for this order.' }, { status: 409 });
    }
  }

  const { data: order, error: orderError } = await supabase
    .from('payment_orders')
    .select('id, payer_profile_id, payment_method, status, expires_at, receipt_path')
    .eq('id', params.id)
    .eq('payer_profile_id', user.id)
    .maybeSingle();
  if (orderError)
    return json({ success: false, message: 'Unable to load payment order.' }, { status: 500 });
  if (!order) return json({ success: false, message: 'Payment order not found.' }, { status: 404 });
  if (order.payment_method !== 'fps') {
    return json({ success: false, message: 'Receipts are only accepted for manual FPS orders.' }, { status: 400 });
  }
  if (!['awaiting_payment', 'rejected'].includes(order.status)) {
    return json(
      { success: false, message: 'A receipt cannot be uploaded for this order.' },
      { status: 409 }
    );
  }
  if (Date.parse(order.expires_at) <= Date.now()) {
    await supabase.rpc('expire_payment_order_secure', {
      p_order_id: order.id,
      p_actor_profile_id: user.id
    });
    return json(
      { success: false, message: 'This payment order has expired. Please create a new one.' },
      { status: 410 }
    );
  }

  await ensurePaymentReceiptBucket(supabase);
  const path = `${user.id}/${order.id}/${randomUUID()}.${verifiedFile.extension}`;
  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_RECEIPT_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: verifiedFile.contentType,
      cacheControl: '300',
      upsert: false
    });
  if (uploadError) {
    console.error('Payment receipt upload failed:', uploadError);
    return json(
      { success: false, message: 'Unable to store the payment receipt.' },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .rpc('submit_payment_receipt_secure', {
      p_order_id: order.id,
      p_payer_profile_id: user.id,
      p_receipt_path: path,
      p_receipt_content_type: verifiedFile.contentType,
      p_receipt_original_name: safeReceiptOriginalName(file.name)
    })
    .single();
  if (error || !data) {
    await supabase.storage.from(PAYMENT_RECEIPT_BUCKET).remove([path]);
    console.error('Payment receipt submission failed:', error);
    return json({ success: false, message: 'Unable to submit this receipt.' }, { status: 409 });
  }
  if (order.receipt_path && order.receipt_path !== path) {
    await supabase.storage.from(PAYMENT_RECEIPT_BUCKET).remove([order.receipt_path]);
  }
  return json({ success: true, order: data });
};

export const GET: RequestHandler = async ({ request, params }) => {
  const { supabase, user } = await authenticatePaymentRequest(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  if (dev) {
    try {
      const receipt = devReceipt(params.id, user.id, isPaymentAdmin(user.email));
      if (!receipt) return json({ success: false, message: 'Payment receipt not found.' }, { status: 404 });
      return new Response(receipt.bytes, {
        headers: {
          'Content-Type': receipt.contentType,
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox"
        }
      });
    } catch {
      return json({ success: false, message: 'Access denied' }, { status: 403 });
    }
  }

  let orderQuery = supabase
    .from('payment_orders')
    .select('payer_profile_id, receipt_path, receipt_content_type')
    .eq('id', params.id);
  if (!isPaymentAdmin(user.email)) orderQuery = orderQuery.eq('payer_profile_id', user.id);
  const { data: order, error } = await orderQuery.maybeSingle();
  if (error)
    return json({ success: false, message: 'Unable to load payment receipt.' }, { status: 500 });
  if (!order?.receipt_path)
    return json({ success: false, message: 'Payment receipt not found.' }, { status: 404 });

  const { data: receipt, error: downloadError } = await supabase.storage
    .from(PAYMENT_RECEIPT_BUCKET)
    .download(order.receipt_path);
  if (downloadError || !receipt) {
    return json({ success: false, message: 'Unable to load payment receipt.' }, { status: 500 });
  }
  return new Response(receipt, {
    headers: {
      'Content-Type': order.receipt_content_type || receipt.type || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox"
    }
  });
};
