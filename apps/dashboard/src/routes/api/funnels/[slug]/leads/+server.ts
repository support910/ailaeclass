import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserIdFromRequest, getServerSupabase } from '$lib/utils/functions/supabase.server';
import { listFunnelLeads, upsertFunnelLead, recordFunnelEvent } from '$lib/server/funnels/store.server';

const attempts = new Map<string, number[]>();

function clientKey(request: Request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => time > now - 60_000);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > 8;
}

function clean(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const POST: RequestHandler = async ({ request, params }) => {
  if (isRateLimited(`${params.slug}:${clientKey(request)}`)) {
    return json({ success: false, message: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (clean(body?.website, 200)) return json({ success: true, ignored: true });

  const name = clean(body?.name, 100);
  const email = clean(body?.email, 200).toLowerCase();
  const phone = clean(body?.phone, 60);
  const role = clean(body?.role, 160);
  const locale = clean(body?.locale, 20) || 'zh-Hant';
  if (name.length < 2 || !validEmail(email) || body?.consent !== true) {
    return json({ success: false, message: 'Please complete the required fields and consent.' }, { status: 400 });
  }

  try {
    const lead = await upsertFunnelLead({
      funnelSlug: params.slug,
      name,
      email,
      phone,
      role,
      locale,
      source: clean(body?.source, 80) || 'course-landing-page',
      consentAt: new Date().toISOString()
    });
    await recordFunnelEvent({
      funnelSlug: params.slug,
      leadId: lead.id,
      eventType: 'lead_captured',
      step: 'ebook',
      locale
    });
    return json({ success: true, leadId: lead.id }, { status: 201 });
  } catch (error) {
    console.error('Funnel lead submission failed:', error);
    return json({ success: false, message: 'Unable to save your details.' }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ request, params, url }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  const orgId = clean(url.searchParams.get('organizationId'), 100);
  if (orgId) {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('organizationmember')
      .select('id')
      .eq('organization_id', orgId)
      .eq('profile_id', userId)
      .eq('verified', true)
      .maybeSingle();
    if (!data) return json({ success: false, message: 'Organization access denied.' }, { status: 403 });
  }
  try {
    return json({ success: true, leads: await listFunnelLeads(params.slug) });
  } catch (error) {
    console.error('Funnel lead list failed:', error);
    return json({ success: false, message: 'Unable to load leads.' }, { status: 500 });
  }
};
