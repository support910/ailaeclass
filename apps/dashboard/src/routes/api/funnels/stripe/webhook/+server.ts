import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripeClient } from '$lib/server/payments/stripe.server';
import { markFunnelOrderPaid, recordFunnelEvent } from '$lib/server/funnels/store.server';

export const POST: RequestHandler = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) return json({ received: false }, { status: 400 });
  try {
    const payload = await request.text();
    const event = getStripeClient().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.funnel_order_id;
      if (orderId) {
        await markFunnelOrderPaid(orderId, session.id);
        await recordFunnelEvent({
          funnelSlug: session.metadata?.funnel_slug || 'caac-m-150kg',
          leadId: session.metadata?.lead_id || null,
          eventType: 'payment_completed',
          step: 'payment',
          metadata: { orderId, provider: 'stripe' }
        });
      }
    }
    return json({ received: true });
  } catch (error) {
    console.error('Stripe funnel webhook failed:', error);
    return json({ received: false }, { status: 400 });
  }
};
