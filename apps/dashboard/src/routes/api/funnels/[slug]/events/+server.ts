import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recordFunnelEvent } from '$lib/server/funnels/store.server';

const allowedEvents = new Set(['page_view', 'ebook_click', 'booking_click', 'checkout_view', 'payment_click']);

export const POST: RequestHandler = async ({ request, params }) => {
  const body = await request.json().catch(() => null);
  const eventType = String(body?.eventType || '');
  if (!allowedEvents.has(eventType)) return json({ success: false }, { status: 400 });
  try {
    await recordFunnelEvent({
      funnelSlug: params.slug,
      leadId: body?.leadId ? String(body.leadId).slice(0, 100) : null,
      eventType,
      step: String(body?.step || 'landing').slice(0, 60),
      locale: String(body?.locale || 'zh-Hant').slice(0, 20)
    });
    return json({ success: true });
  } catch {
    return json({ success: false }, { status: 500 });
  }
};
