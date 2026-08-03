import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CAAC_FUNNEL } from '$lib/funnel/caac';
import { createFunnelOrder, recordFunnelEvent, setFunnelOrderSession, upsertFunnelLead } from '$lib/server/funnels/store.server';
import { getStripeClient, getStripePublicConfig } from '$lib/server/payments/stripe.server';

function clean(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

export const POST: RequestHandler = async ({ request, params, url }) => {
  if (params.slug !== CAAC_FUNNEL.slug) return json({ success: false }, { status: 404 });
  const body = await request.json().catch(() => null);
  const email = clean(body?.email, 200).toLowerCase();
  const name = clean(body?.name, 100);
  const method = clean(body?.paymentMethod, 20);
  const locale = clean(body?.locale, 20) || 'zh-Hant';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || !['stripe', 'fps'].includes(method)) {
    return json({ success: false, message: 'Invalid checkout details.' }, { status: 400 });
  }

  try {
    const lead = await upsertFunnelLead({
      funnelSlug: params.slug,
      name,
      email,
      phone: clean(body?.phone, 60),
      role: '',
      locale,
      source: 'checkout',
      consentAt: new Date().toISOString()
    });
    const order = await createFunnelOrder({
      funnelSlug: params.slug,
      leadId: lead.id,
      email,
      paymentMethod: method as 'stripe' | 'fps',
      amountMinor: CAAC_FUNNEL.salePrice * 100
    });
    await recordFunnelEvent({
      funnelSlug: params.slug,
      leadId: lead.id,
      eventType: 'checkout_started',
      step: 'payment',
      locale,
      metadata: { paymentMethod: method, orderId: order.id }
    });

    if (method === 'fps') {
      return json({
        success: true,
        paymentMethod: 'fps',
        orderId: order.id,
        reference: order.reference,
        amount: CAAC_FUNNEL.salePrice,
        fpsId: env.FUNNEL_FPS_ID || '',
        accountName: env.FUNNEL_FPS_ACCOUNT_NAME || 'AiLAE',
        demo: !env.FUNNEL_FPS_ID
      });
    }

    const stripeConfig = getStripePublicConfig();
    if (!stripeConfig.configured) {
      return json({
        success: true,
        paymentMethod: 'stripe',
        orderId: order.id,
        demo: true,
        redirectUrl: `${url.origin}/f/${params.slug}/thanks?order=${order.id}&demo=stripe`
      });
    }

    const session = await getStripeClient().checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      locale: locale === 'en' ? 'en' : 'zh',
      success_url: `${url.origin}/f/${params.slug}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${url.origin}/f/${params.slug}/checkout?cancelled=1`,
      metadata: { funnel_order_id: order.id, funnel_slug: params.slug, lead_id: lead.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'hkd',
            unit_amount: CAAC_FUNNEL.salePrice * 100,
            product_data: {
              name: 'CAAC-M 150Kg 無人機牌照課程和考試',
              description: '包括課程、考試安排及考試禁區考察團贈品'
            }
          }
        }
      ]
    });
    await setFunnelOrderSession(order.id, session.id);
    return json({ success: true, paymentMethod: 'stripe', orderId: order.id, redirectUrl: session.url });
  } catch (error) {
    console.error('Funnel checkout failed:', error);
    return json({ success: false, message: 'Unable to start checkout.' }, { status: 500 });
  }
};
