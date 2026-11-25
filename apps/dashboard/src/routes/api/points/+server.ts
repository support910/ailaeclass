import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * Points ledger API (tour_ledger).
 *
 * Visibility (2026-11 spec):
 *   student        -> only their own rows
 *   teacher/tutor  -> every student in the org
 *   school admin   -> every member of the org
 *   district / HK admins are not modelled yet (needs the district tables).
 *
 * GET  /api/points?orgId=…[&userId=…][&limit=200]
 * POST /api/points { orgId, userId, kind, delta, note }
 */

const MAX_LIMIT = 1000;

async function getOrgRole(supabase: any, orgId: string, userId: string) {
  const { data } = await supabase
    .from('organizationmember')
    .select('role_id, verified')
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (!data || data.verified !== true) return null;

  return Number(data.role_id);
}

export const GET: RequestHandler = async ({ request, url }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const orgId = url.searchParams.get('orgId');
  const onlyUserId = url.searchParams.get('userId');
  const scopeUserId = url.searchParams.get('scopeUserId');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, MAX_LIMIT);

  if (!orgId) return json({ success: false, message: 'orgId is required' }, { status: 400 });

  const supabase = getServerSupabase();
  const roleId = await getOrgRole(supabase, orgId, userId);
  if (roleId === null) {
    return json({ success: false, message: 'Organization access denied.' }, { status: 403 });
  }

  try {
    let userIds: string[] = [];

    if (roleId === ROLE.STUDENT) {
      userIds = [userId];
    } else {
      const { data: members, error } = await supabase
        .from('organizationmember')
        .select('profile_id')
        .eq('organization_id', orgId);

      if (error) throw error;
      userIds = (members || []).map((m: any) => m.profile_id).filter(Boolean);
    }

    const wanted = onlyUserId || scopeUserId;
    if (wanted && userIds.includes(wanted)) userIds = [wanted];

    if (!userIds.length) {
      return json({ success: true, rows: [], summary: [], balances: {} });
    }

    const rows: any[] = [];
    for (let i = 0; i < userIds.length; i += 100) {
      const chunk = userIds.slice(i, i + 100);
      const { data, error } = await supabase
        .from('tour_ledger')
        .select('id, user_id, kind, delta, note, created_at')
        .in('user_id', chunk)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      rows.push(...(data || []));
    }

    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const trimmed = rows.slice(0, limit);

    const { data: profiles } = await supabase
      .from('profile')
      .select('id, fullname, email')
      .in('id', userIds.slice(0, 500));

    const profileById = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

    const balances: Record<string, number> = {};
    for (const row of trimmed) {
      balances[row.user_id] = (balances[row.user_id] || 0) + Number(row.delta || 0);
    }

    return json({
      success: true,
      roleId,
      rows: trimmed.map((row) => ({
        ...row,
        profile: profileById[row.user_id] || null
      })),
      balances
    });
  } catch (err) {
    console.error('GET /api/points error:', err);
    return json({ success: false, message: 'Failed to load points' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { orgId, userId: targetUserId, kind, delta, note = '' } = body || {};

  if (!orgId || !targetUserId) {
    return json({ success: false, message: 'orgId and userId are required' }, { status: 400 });
  }

  const parsedDelta = Number(delta);
  if (!Number.isFinite(parsedDelta) || parsedDelta === 0 || Math.abs(parsedDelta) > 100000) {
    return json({ success: false, message: 'delta must be a non-zero number' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const roleId = await getOrgRole(supabase, orgId, userId);
  if (roleId === null || roleId === ROLE.STUDENT) {
    return json({ success: false, message: 'Only teachers or admins can register points' }, { status: 403 });
  }

  // The target must belong to the same organization
  const { data: targetMember } = await supabase
    .from('organizationmember')
    .select('profile_id')
    .eq('organization_id', orgId)
    .eq('profile_id', targetUserId)
    .maybeSingle();

  if (!targetMember) {
    return json({ success: false, message: 'Target user is not in this organization' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('tour_ledger')
      .insert({
        user_id: targetUserId,
        kind: String(kind || 'manual').slice(0, 40),
        delta: Math.trunc(parsedDelta),
        note: String(note || '').slice(0, 200),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return json({ success: true, row: data });
  } catch (err) {
    console.error('POST /api/points error:', err);
    return json({ success: false, message: 'Failed to register points' }, { status: 500 });
  }
};
