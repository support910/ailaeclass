type DevPaymentStatus =
  | 'awaiting_payment'
  | 'processing'
  | 'receipt_submitted'
  | 'verified'
  | 'failed'
  | 'rejected'
  | 'cancelled'
  | 'expired';

type DevPaymentOrder = {
  id: string;
  reference: string;
  payer_profile_id: string;
  payer_email: string;
  organization_id: string | null;
  amount_minor: number;
  currency: 'HKD';
  payment_method: 'fps' | 'airwallex';
  provider: 'manual_fps' | 'airwallex';
  provider_request_id: string | null;
  provider_payment_intent_id: string | null;
  provider_status: string | null;
  paid_at: string | null;
  status: DevPaymentStatus;
  receipt_original_name: string | null;
  receipt_content_type: string | null;
  receipt_bytes: Uint8Array | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

const globalStore = globalThis as typeof globalThis & {
  __ailaeDevPaymentOrders?: Map<string, DevPaymentOrder>;
};

const orders = (globalStore.__ailaeDevPaymentOrders ||= new Map<string, DevPaymentOrder>());

function publicOrder(order: DevPaymentOrder) {
  const { receipt_bytes, receipt_content_type, payer_profile_id, reviewed_by, provider_request_id, ...safeOrder } = order;
  return safeOrder;
}

export function createDevPaymentOrder(input: {
  id: string;
  reference: string;
  payerProfileId: string;
  payerEmail: string;
  organizationId: string | null;
  amountMinor: number;
  expiresAt: string;
  paymentMethod?: 'fps' | 'airwallex';
  providerRequestId?: string | null;
}) {
  const now = new Date().toISOString();
  const recent = [...orders.values()].filter(
    (item) => item.payer_profile_id === input.payerProfileId && Date.parse(item.created_at) > Date.now() - 60_000
  );
  if (recent.length >= 5) throw new Error('PAYMENT_RATE_LIMIT');
  const order: DevPaymentOrder = {
    id: input.id,
    reference: input.reference,
    payer_profile_id: input.payerProfileId,
    payer_email: input.payerEmail,
    organization_id: input.organizationId,
    amount_minor: input.amountMinor,
    currency: 'HKD',
    payment_method: input.paymentMethod || 'fps',
    provider: input.paymentMethod === 'airwallex' ? 'airwallex' : 'manual_fps',
    provider_request_id: input.providerRequestId || null,
    provider_payment_intent_id: null,
    provider_status: null,
    paid_at: null,
    status: 'awaiting_payment',
    receipt_original_name: null,
    receipt_content_type: null,
    receipt_bytes: null,
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    review_note: '',
    expires_at: input.expiresAt,
    created_at: now,
    updated_at: now
  };
  orders.set(order.id, order);
  return publicOrder(order);
}

export function attachDevAirwallexIntent(input: {
  orderId: string;
  payerProfileId: string;
  intentId: string;
  providerStatus: string;
}) {
  const order = orders.get(input.orderId);
  if (
    !order ||
    order.payer_profile_id !== input.payerProfileId ||
    order.payment_method !== 'airwallex' ||
    (order.provider_payment_intent_id && order.provider_payment_intent_id !== input.intentId)
  ) {
    throw new Error('PAYMENT_ORDER_NOT_FOUND');
  }
  order.provider_payment_intent_id = input.intentId;
  order.provider_status = input.providerStatus;
  order.updated_at = new Date().toISOString();
  return publicOrder(order);
}

export function failDevAirwallexOrder(orderId: string, payerProfileId: string) {
  const order = orders.get(orderId);
  if (!order || order.payer_profile_id !== payerProfileId || order.payment_method !== 'airwallex') return;
  order.status = 'failed';
  order.provider_status = 'CREATE_FAILED';
  order.updated_at = new Date().toISOString();
}

export function listDevPaymentOrders(userId: string, reviewScope: boolean) {
  const now = new Date().toISOString();
  for (const order of orders.values()) {
    if (
      Date.parse(order.expires_at) <= Date.now() &&
      ['awaiting_payment', 'rejected'].includes(order.status)
    ) {
      order.status = 'expired';
      order.updated_at = now;
    }
  }
  return [...orders.values()]
    .filter((order) => reviewScope || order.payer_profile_id === userId)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, reviewScope ? 100 : 25)
    .map(publicOrder);
}

export function getDevPaymentOrder(orderId: string) {
  return orders.get(orderId) || null;
}

export function submitDevPaymentReceipt(input: {
  orderId: string;
  payerProfileId: string;
  originalName: string;
  contentType: string;
  bytes: Uint8Array;
}) {
  const order = orders.get(input.orderId);
  if (!order || order.payer_profile_id !== input.payerProfileId) throw new Error('PAYMENT_ORDER_NOT_FOUND');
  if (
    order.payment_method !== 'fps' ||
    !['awaiting_payment', 'rejected'].includes(order.status) ||
    Date.parse(order.expires_at) <= Date.now()
  ) {
    throw new Error('PAYMENT_RECEIPT_NOT_ALLOWED');
  }
  const now = new Date().toISOString();
  Object.assign(order, {
    status: 'receipt_submitted',
    receipt_original_name: input.originalName,
    receipt_content_type: input.contentType,
    receipt_bytes: input.bytes,
    submitted_at: now,
    reviewed_at: null,
    reviewed_by: null,
    review_note: '',
    updated_at: now
  });
  return publicOrder(order);
}

export function reviewDevPaymentOrder(input: {
  orderId: string;
  reviewerProfileId: string;
  decision: 'verified' | 'rejected';
  reviewNote: string;
}) {
  const order = orders.get(input.orderId);
  if (!order || order.status !== 'receipt_submitted') {
    throw new Error('PAYMENT_REVIEW_NOT_ALLOWED');
  }
  const now = new Date().toISOString();
  Object.assign(order, {
    status: input.decision,
    reviewed_at: now,
    reviewed_by: input.reviewerProfileId,
    review_note: input.reviewNote,
    updated_at: now
  });
  return publicOrder(order);
}

export function devReceipt(orderId: string, userId: string, isAdmin: boolean) {
  const order = orders.get(orderId);
  if (!order) return null;
  if (order.payer_profile_id !== userId && !isAdmin) throw new Error('PAYMENT_ACCESS_DENIED');
  if (!order.receipt_bytes) return null;
  return { bytes: order.receipt_bytes, contentType: order.receipt_content_type || 'application/octet-stream' };
}
