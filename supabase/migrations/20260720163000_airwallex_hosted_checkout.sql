-- Adds Airwallex Hosted Payment Page support without removing the manual FPS fallback.

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_reference_check,
  DROP CONSTRAINT IF EXISTS payment_orders_payment_method_check,
  DROP CONSTRAINT IF EXISTS payment_orders_status_check;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_reference_check
    CHECK (reference ~ '^(FPS|AWX)-[0-9]{6}-[A-F0-9]{10}$'),
  ADD CONSTRAINT payment_orders_payment_method_check
    CHECK (payment_method IN ('fps', 'airwallex')),
  ADD CONSTRAINT payment_orders_status_check
    CHECK (status IN (
      'awaiting_payment', 'processing', 'receipt_submitted', 'verified',
      'failed', 'rejected', 'cancelled', 'expired'
    ));

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_request_id uuid,
  ADD COLUMN IF NOT EXISTS provider_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

UPDATE public.payment_orders
SET provider = CASE WHEN payment_method = 'airwallex' THEN 'airwallex' ELSE 'manual_fps' END
WHERE provider IS NULL;

ALTER TABLE public.payment_orders
  ALTER COLUMN provider SET DEFAULT 'manual_fps',
  ALTER COLUMN provider SET NOT NULL;

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_provider_check;
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_provider_check CHECK (provider IN ('manual_fps', 'airwallex'));

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_provider_request_uidx
  ON public.payment_orders (provider_request_id)
  WHERE provider_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_provider_intent_uidx
  ON public.payment_orders (provider_payment_intent_id)
  WHERE provider_payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_provider_events (
  event_id text PRIMARY KEY,
  provider text NOT NULL CHECK (provider = 'airwallex'),
  event_name text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
  provider_payment_intent_id text NOT NULL,
  provider_status text,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  provider_created_at timestamptz,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_provider_events_order_processed_idx
  ON public.payment_provider_events (order_id, processed_at DESC);

ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_provider_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_provider_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payment_provider_events FROM service_role;

CREATE OR REPLACE FUNCTION public.create_airwallex_payment_order_secure(
  p_reference text,
  p_payer_profile_id uuid,
  p_payer_email text,
  p_organization_id uuid,
  p_amount_minor bigint,
  p_expires_at timestamptz,
  p_provider_request_id uuid
) RETURNS SETOF public.payment_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_order public.payment_orders;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_payer_profile_id::text, 0));
  IF p_organization_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organizationmember
    WHERE organization_id = p_organization_id
      AND profile_id = p_payer_profile_id
      AND verified = true
  ) THEN
    RAISE EXCEPTION 'PAYMENT_ORGANIZATION_ACCESS_DENIED';
  END IF;
  IF (SELECT count(*) FROM public.payment_orders
      WHERE payer_profile_id = p_payer_profile_id AND created_at > now() - interval '1 minute') >= 5
     OR (SELECT count(*) FROM public.payment_orders
         WHERE payer_profile_id = p_payer_profile_id AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'PAYMENT_RATE_LIMIT';
  END IF;

  INSERT INTO public.payment_orders (
    reference, payer_profile_id, payer_email, organization_id, amount_minor,
    payment_method, provider, provider_request_id, expires_at
  ) VALUES (
    p_reference, p_payer_profile_id, lower(p_payer_email), p_organization_id, p_amount_minor,
    'airwallex', 'airwallex', p_provider_request_id, p_expires_at
  ) RETURNING * INTO created_order;

  INSERT INTO public.payment_audit_logs (
    order_id, actor_profile_id, action, to_status, metadata
  ) VALUES (
    created_order.id,
    p_payer_profile_id,
    'airwallex_order_created',
    created_order.status,
    jsonb_build_object('provider_request_id', p_provider_request_id)
  );
  RETURN NEXT created_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_airwallex_payment_intent_secure(
  p_order_id uuid,
  p_payer_profile_id uuid,
  p_provider_payment_intent_id text,
  p_provider_status text
) RETURNS SETOF public.payment_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order public.payment_orders;
BEGIN
  SELECT * INTO current_order
  FROM public.payment_orders
  WHERE id = p_order_id
    AND payer_profile_id = p_payer_profile_id
    AND provider = 'airwallex'
  FOR UPDATE;
  IF current_order.id IS NULL
     OR (current_order.provider_payment_intent_id IS NOT NULL
         AND current_order.provider_payment_intent_id <> p_provider_payment_intent_id) THEN
    RAISE EXCEPTION 'PAYMENT_ORDER_NOT_FOUND';
  END IF;

  UPDATE public.payment_orders
  SET provider_payment_intent_id = p_provider_payment_intent_id,
      provider_status = left(coalesce(p_provider_status, ''), 100),
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO current_order;

  INSERT INTO public.payment_audit_logs (
    order_id, actor_profile_id, action, from_status, to_status, metadata
  ) VALUES (
    current_order.id,
    p_payer_profile_id,
    'airwallex_intent_attached',
    current_order.status,
    current_order.status,
    jsonb_build_object('payment_intent_id', p_provider_payment_intent_id)
  );
  RETURN NEXT current_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_airwallex_payment_order_secure(
  p_order_id uuid,
  p_payer_profile_id uuid,
  p_provider_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_status text;
BEGIN
  SELECT status INTO previous_status
  FROM public.payment_orders
  WHERE id = p_order_id
    AND payer_profile_id = p_payer_profile_id
    AND provider = 'airwallex'
  FOR UPDATE;
  IF previous_status = 'awaiting_payment' THEN
    UPDATE public.payment_orders
    SET status = 'failed',
        provider_status = left(coalesce(p_provider_status, 'CREATE_FAILED'), 100),
        updated_at = now()
    WHERE id = p_order_id;
    INSERT INTO public.payment_audit_logs (
      order_id, actor_profile_id, action, from_status, to_status
    ) VALUES (
      p_order_id, p_payer_profile_id, 'airwallex_intent_create_failed', previous_status, 'failed'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_airwallex_payment_event_secure(
  p_event_id text,
  p_event_name text,
  p_provider_payment_intent_id text,
  p_merchant_order_id text,
  p_amount_minor bigint,
  p_currency text,
  p_provider_status text,
  p_event_created_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order public.payment_orders;
  previous_status text;
  next_status text;
  inserted_count integer;
BEGIN
  SELECT * INTO current_order
  FROM public.payment_orders
  WHERE provider = 'airwallex'
    AND (
      provider_payment_intent_id = p_provider_payment_intent_id
      OR reference = p_merchant_order_id
    )
  FOR UPDATE;

  IF current_order.id IS NULL THEN RAISE EXCEPTION 'AIRWALLEX_ORDER_NOT_FOUND'; END IF;
  IF current_order.reference <> p_merchant_order_id THEN RAISE EXCEPTION 'AIRWALLEX_ORDER_MISMATCH'; END IF;
  IF current_order.provider_payment_intent_id IS NOT NULL
     AND current_order.provider_payment_intent_id <> p_provider_payment_intent_id THEN
    RAISE EXCEPTION 'AIRWALLEX_INTENT_MISMATCH';
  END IF;
  IF current_order.amount_minor <> p_amount_minor OR current_order.currency <> upper(p_currency) THEN
    RAISE EXCEPTION 'AIRWALLEX_AMOUNT_MISMATCH';
  END IF;

  INSERT INTO public.payment_provider_events (
    event_id, provider, event_name, order_id, provider_payment_intent_id,
    provider_status, amount_minor, currency, provider_created_at
  ) VALUES (
    p_event_id, 'airwallex', p_event_name, current_order.id, p_provider_payment_intent_id,
    left(coalesce(p_provider_status, ''), 100), p_amount_minor, upper(p_currency), p_event_created_at
  ) ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN
    RETURN jsonb_build_object('processed', false, 'duplicate', true, 'order_id', current_order.id);
  END IF;

  previous_status := current_order.status;
  next_status := previous_status;
  IF p_event_name = 'payment_intent.succeeded' THEN
    next_status := 'verified';
  ELSIF previous_status <> 'verified' AND p_event_name IN (
    'payment_intent.pending', 'payment_intent.pending_review'
  ) THEN
    next_status := 'processing';
  ELSIF previous_status <> 'verified' AND p_event_name = 'payment_intent.cancelled' THEN
    next_status := 'cancelled';
  ELSIF previous_status NOT IN ('verified', 'cancelled') AND p_event_name IN (
    'payment_intent.created',
    'payment_intent.requires_payment_method',
    'payment_intent.requires_customer_action'
  ) THEN
    next_status := 'awaiting_payment';
  END IF;

  UPDATE public.payment_orders
  SET provider_payment_intent_id = coalesce(provider_payment_intent_id, p_provider_payment_intent_id),
      provider_status = left(coalesce(p_provider_status, ''), 100),
      status = next_status,
      paid_at = CASE
        WHEN p_event_name = 'payment_intent.succeeded' THEN coalesce(paid_at, now())
        ELSE paid_at
      END,
      updated_at = now()
  WHERE id = current_order.id;

  INSERT INTO public.payment_audit_logs (
    order_id, actor_profile_id, action, from_status, to_status, metadata
  ) VALUES (
    current_order.id,
    NULL,
    'airwallex_webhook',
    previous_status,
    next_status,
    jsonb_build_object(
      'event_id', p_event_id,
      'event_name', p_event_name,
      'payment_intent_id', p_provider_payment_intent_id,
      'provider_status', p_provider_status
    )
  );

  RETURN jsonb_build_object(
    'processed', true,
    'duplicate', false,
    'order_id', current_order.id,
    'status', next_status
  );
END;
$$;

-- Receipts are valid only for the manual FPS fallback, never for Airwallex orders.
CREATE OR REPLACE FUNCTION public.submit_payment_receipt_secure(
  p_order_id uuid,
  p_payer_profile_id uuid,
  p_receipt_path text,
  p_receipt_content_type text,
  p_receipt_original_name text
) RETURNS SETOF public.payment_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order public.payment_orders;
  previous_status text;
BEGIN
  SELECT * INTO current_order FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
  IF current_order.id IS NULL OR current_order.payer_profile_id <> p_payer_profile_id THEN
    RAISE EXCEPTION 'PAYMENT_ORDER_NOT_FOUND';
  END IF;
  IF current_order.payment_method <> 'fps'
     OR current_order.expires_at <= now()
     OR current_order.status NOT IN ('awaiting_payment', 'rejected') THEN
    RAISE EXCEPTION 'PAYMENT_RECEIPT_NOT_ALLOWED';
  END IF;
  previous_status := current_order.status;

  UPDATE public.payment_orders SET
    receipt_path = p_receipt_path,
    receipt_content_type = p_receipt_content_type,
    receipt_original_name = p_receipt_original_name,
    status = 'receipt_submitted',
    submitted_at = now(),
    reviewed_at = NULL,
    reviewed_by = NULL,
    review_note = '',
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO current_order;

  INSERT INTO public.payment_audit_logs (order_id, actor_profile_id, action, from_status, to_status)
  VALUES (current_order.id, p_payer_profile_id, 'receipt_submitted', previous_status, 'receipt_submitted');
  RETURN NEXT current_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_airwallex_payment_order_secure(text, uuid, text, uuid, bigint, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_airwallex_payment_intent_secure(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_airwallex_payment_order_secure(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_airwallex_payment_event_secure(text, text, text, text, bigint, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_airwallex_payment_order_secure(text, uuid, text, uuid, bigint, timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_airwallex_payment_intent_secure(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_airwallex_payment_order_secure(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_airwallex_payment_event_secure(text, text, text, text, bigint, text, text, timestamptz) TO service_role;

COMMENT ON TABLE public.payment_provider_events IS
  'Minimal, append-only Airwallex webhook event ledger used for idempotency and reconciliation.';
