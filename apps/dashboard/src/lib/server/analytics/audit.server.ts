import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';

const BLOCKED_KEYS = /prompt|message|content|answer|email|name|token|password|secret/i;

function fingerprint(value: string | null) {
  if (!value) return null;
  const salt = env.PRIVATE_AUDIT_SALT || 'ailaeclass-local-audit-salt';
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

export function sanitizeAuditMetadata(input: Record<string, unknown> = {}) {
  const output: Record<string, string | number | boolean | null | string[]> = {};

  for (const [key, value] of Object.entries(input)) {
    if (BLOCKED_KEYS.test(key)) continue;
    if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      output[key] = value;
    } else if (typeof value === 'string') {
      output[key] = value.slice(0, 160);
    } else if (Array.isArray(value)) {
      output[key] = value.slice(0, 10).map((item) => String(item).slice(0, 80));
    }
  }

  return output;
}

export async function recordAnalyticsEvent(input: {
  organizationId?: string | null;
  actorProfileId?: string | null;
  category: string;
  eventName: string;
  entityType?: string | null;
  entityId?: string | null;
  pagePath?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await getServerSupabase().from('platform_analytics_events').insert({
      organization_id: input.organizationId || null,
      actor_profile_id: input.actorProfileId || null,
      category: input.category.slice(0, 64),
      event_name: input.eventName.slice(0, 96),
      entity_type: input.entityType?.slice(0, 64) || null,
      entity_id: input.entityId?.slice(0, 128) || null,
      page_path: input.pagePath?.slice(0, 256) || null,
      metadata: sanitizeAuditMetadata(input.metadata)
    });
  } catch (error) {
    console.warn('Analytics event was not recorded:', error instanceof Error ? error.message : 'unknown');
  }
}

export async function recordAuditEvent(request: Request, input: {
  organizationId?: string | null;
  actorProfileId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: 'success' | 'failure';
  riskLevel?: 'low' | 'medium' | 'high';
  metadata?: Record<string, unknown>;
}) {
  try {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    await getServerSupabase().from('privacy_audit_log').insert({
      organization_id: input.organizationId || null,
      actor_profile_id: input.actorProfileId || null,
      action: input.action.slice(0, 96),
      resource_type: input.resourceType.slice(0, 64),
      resource_id: input.resourceId?.slice(0, 128) || null,
      outcome: input.outcome || 'success',
      risk_level: input.riskLevel || 'low',
      metadata: sanitizeAuditMetadata(input.metadata),
      ip_hash: fingerprint(forwarded),
      user_agent_hash: fingerprint(request.headers.get('user-agent'))
    });
  } catch (error) {
    console.warn('Audit event was not recorded:', error instanceof Error ? error.message : 'unknown');
  }
}
