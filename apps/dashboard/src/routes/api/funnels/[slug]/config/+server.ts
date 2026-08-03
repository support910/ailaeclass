import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripePublicConfig } from '$lib/server/payments/stripe.server';

export const GET: RequestHandler = async ({ params }) => {
  if (params.slug !== 'caac-m-150kg') return json({ success: false }, { status: 404 });
  return json({
    success: true,
    calendlyUrl: env.FUNNEL_CALENDLY_URL || '',
    ebookUrl: env.FUNNEL_EBOOK_URL || '',
    supportWhatsApp: env.FUNNEL_SUPPORT_WHATSAPP || '',
    fps: {
      configured: Boolean(env.FUNNEL_FPS_ID),
      id: env.FUNNEL_FPS_ID || '',
      accountName: env.FUNNEL_FPS_ACCOUNT_NAME || 'AiLAE'
    },
    stripe: getStripePublicConfig()
  });
};
