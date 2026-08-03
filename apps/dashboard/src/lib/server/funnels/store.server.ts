import { dev } from '$app/environment';
import { randomUUID } from 'crypto';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';

export type FunnelLeadInput = {
  funnelSlug: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  locale: string;
  source?: string;
  consentAt: string;
};

type FunnelLead = FunnelLeadInput & {
  id: string;
  status: string;
  score: number;
  createdAt: string;
  updatedAt: string;
};

type FunnelOrder = {
  id: string;
  funnelSlug: string;
  leadId: string;
  email: string;
  paymentMethod: 'stripe' | 'fps';
  amountMinor: number;
  currency: 'HKD';
  status: string;
  reference: string;
  providerSessionId: string | null;
  createdAt: string;
};

const globalStore = globalThis as typeof globalThis & {
  __ailaeFunnelLeads?: Map<string, FunnelLead>;
  __ailaeFunnelEvents?: Array<Record<string, unknown>>;
  __ailaeFunnelOrders?: Map<string, FunnelOrder>;
  __ailaeFunnelPages?: Map<string, { html: string; css: string; updatedAt: string }>;
};

const leads = (globalStore.__ailaeFunnelLeads ||= new Map());
const events = (globalStore.__ailaeFunnelEvents ||= []);
const orders = (globalStore.__ailaeFunnelOrders ||= new Map());
const pages = (globalStore.__ailaeFunnelPages ||= new Map());

function leadKey(funnelSlug: string, email: string) {
  return `${funnelSlug}:${email.trim().toLowerCase()}`;
}

function paymentReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `AF-${date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function upsertFunnelLead(input: FunnelLeadInput) {
  if (dev) {
    const key = leadKey(input.funnelSlug, input.email);
    const existing = leads.get(key);
    const now = new Date().toISOString();
    const lead: FunnelLead = existing
      ? { ...existing, ...input, score: existing.score + 5, updatedAt: now }
      : { ...input, id: randomUUID(), status: 'new', score: 10, createdAt: now, updatedAt: now };
    leads.set(key, lead);
    return lead;
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('funnel_leads')
    .upsert(
      {
        funnel_slug: input.funnelSlug,
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone || '',
        role_context: input.role || '',
        locale: input.locale,
        source: input.source || 'website',
        consent_at: input.consentAt,
        last_activity_at: new Date().toISOString()
      },
      { onConflict: 'funnel_slug,email' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function recordFunnelEvent(input: {
  funnelSlug: string;
  leadId?: string | null;
  eventType: string;
  step: string;
  locale?: string;
  metadata?: Record<string, unknown>;
}) {
  const event = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
  if (dev) {
    events.unshift(event);
    events.splice(500);
    return event;
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('funnel_events')
    .insert({
      funnel_slug: input.funnelSlug,
      lead_id: input.leadId || null,
      event_type: input.eventType,
      step: input.step,
      locale: input.locale || 'zh-Hant',
      metadata: input.metadata || {}
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listFunnelLeads(funnelSlug: string) {
  if (dev) {
    return [...leads.values()]
      .filter((lead) => lead.funnelSlug === funnelSlug)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('funnel_leads')
    .select('*')
    .eq('funnel_slug', funnelSlug)
    .order('last_activity_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function createFunnelOrder(input: {
  funnelSlug: string;
  leadId: string;
  email: string;
  paymentMethod: 'stripe' | 'fps';
  amountMinor: number;
}) {
  const createdAt = new Date().toISOString();
  const order: FunnelOrder = {
    id: randomUUID(),
    funnelSlug: input.funnelSlug,
    leadId: input.leadId,
    email: input.email.toLowerCase(),
    paymentMethod: input.paymentMethod,
    amountMinor: input.amountMinor,
    currency: 'HKD',
    status: input.paymentMethod === 'fps' ? 'awaiting_receipt' : 'pending',
    reference: paymentReference(),
    providerSessionId: null,
    createdAt
  };
  if (dev) {
    orders.set(order.id, order);
    return order;
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('funnel_orders')
    .insert({
      id: order.id,
      funnel_slug: order.funnelSlug,
      lead_id: order.leadId,
      payer_email: order.email,
      payment_method: order.paymentMethod,
      amount_minor: order.amountMinor,
      currency: order.currency,
      status: order.status,
      reference: order.reference
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function setFunnelOrderSession(orderId: string, sessionId: string) {
  if (dev) {
    const order = orders.get(orderId);
    if (order) {
      order.providerSessionId = sessionId;
      order.status = 'checkout_created';
    }
    return order || null;
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('funnel_orders')
    .update({ provider_session_id: sessionId, status: 'checkout_created' })
    .eq('id', orderId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function markFunnelOrderPaid(orderId: string, sessionId: string) {
  if (dev) {
    const order = orders.get(orderId);
    if (order && order.providerSessionId === sessionId) order.status = 'paid';
    return order || null;
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('funnel_orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('provider_session_id', sessionId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getFunnelPage(funnelSlug: string) {
  if (dev) return pages.get(funnelSlug) || null;
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('content_html, content_css, updated_at')
    .eq('slug', funnelSlug)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { html: data.content_html || '', css: data.content_css || '', updatedAt: data.updated_at }
    : null;
}

export async function saveFunnelPage(funnelSlug: string, html: string, css: string) {
  const updatedAt = new Date().toISOString();
  if (dev) {
    const page = { html, css, updatedAt };
    pages.set(funnelSlug, page);
    return page;
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from('funnel_pages')
    .update({ content_html: html, content_css: css, updated_at: updatedAt })
    .eq('slug', funnelSlug)
    .select('content_html, content_css, updated_at')
    .single();
  if (error) throw error;
  return { html: data.content_html || '', css: data.content_css || '', updatedAt: data.updated_at };
}

export function funnelDemoMetrics(funnelSlug: string) {
  const funnelLeads = [...leads.values()].filter((lead) => lead.funnelSlug === funnelSlug);
  const funnelEvents = events.filter((event) => event.funnelSlug === funnelSlug);
  const funnelOrders = [...orders.values()].filter((order) => order.funnelSlug === funnelSlug);
  return {
    visitors: Math.max(1284, funnelEvents.filter((event) => event.eventType === 'page_view').length),
    leads: Math.max(186, funnelLeads.length),
    bookings: Math.max(42, funnelEvents.filter((event) => event.eventType === 'booking_click').length),
    paid: Math.max(18, funnelOrders.filter((order) => order.status === 'paid').length)
  };
}
