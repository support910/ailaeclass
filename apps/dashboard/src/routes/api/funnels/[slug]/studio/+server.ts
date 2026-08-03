import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserIdFromRequest, getServerSupabase } from '$lib/utils/functions/supabase.server';
import { funnelDemoMetrics, getFunnelPage, listFunnelLeads, saveFunnelPage } from '$lib/server/funnels/store.server';

async function authorize(request: Request, organizationId: string) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return false;
  if (!organizationId) return true;
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('organizationmember')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('profile_id', userId)
    .eq('verified', true)
    .maybeSingle();
  return Boolean(data);
}

export const GET: RequestHandler = async ({ request, params, url }) => {
  const organizationId = String(url.searchParams.get('organizationId') || '').slice(0, 100);
  if (!(await authorize(request, organizationId))) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [page, leads] = await Promise.all([getFunnelPage(params.slug), listFunnelLeads(params.slug)]);
    return json({
      success: true,
      page,
      leads,
      metrics: funnelDemoMetrics(params.slug),
      automations: [
        { id: 'lead-magnet', name: '電子書下載後跟進', trigger: 'lead_captured', status: 'active', contacts: 186 },
        { id: 'booking-reminder', name: 'Calendly 預約提醒', trigger: 'booking_created', status: 'active', contacts: 42 },
        { id: 'checkout-recovery', name: '未完成付款提醒', trigger: 'checkout_abandoned', status: 'draft', contacts: 11 }
      ]
    });
  } catch (error) {
    console.error('Funnel studio load failed:', error);
    return json({ success: false, message: 'Unable to load funnel studio.' }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ request, params }) => {
  const body = await request.json().catch(() => null);
  const organizationId = String(body?.organizationId || '').slice(0, 100);
  if (!(await authorize(request, organizationId))) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const html = String(body?.html || '');
  const css = String(body?.css || '');
  if (!html || html.length > 500_000 || css.length > 300_000) {
    return json({ success: false, message: 'Page content is invalid or too large.' }, { status: 400 });
  }
  try {
    const page = await saveFunnelPage(params.slug, html, css);
    return json({ success: true, page });
  } catch (error) {
    console.error('Funnel studio save failed:', error);
    return json({ success: false, message: 'Unable to save the page.' }, { status: 500 });
  }
};
