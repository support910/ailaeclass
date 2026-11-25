import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

function isMissingTable(error: any) {
  const code = String(error?.code || '');
  return code === '42P01' || code === 'PGRST205' || /schema cache/i.test(String(error?.message || ''));
}


/**
 * Course points ledger API — table public.points_ledger
 * (migration: E:\Data\Admin\AI\Projects\newailaeclass\migration\02_apply_points_ledger.sql)
 *
 * Visibility (2026-11 spec):
 *   student        -> only their own rows
 *   teacher/tutor  -> every member of the org (read-only)
 *   school admin   -> every member of the org, plus manual registration
 *   district / HK scopes are not modelled yet (needs the district tables).
 *
 * NOTE: public.tour_ledger is NOT this ledger — its user_id points at tour_profile
 * (experience-tour roster), so course points live in their own table.
 *
 * GET  /api/points?orgId=…[&userId=…][&limit=200]
 * POST /api/points { orgId, userId, kind, delta, note }
 */

const ALLOWED_KINDS = [
  'register',
  'checkin',
  'exercise',
  'exam',
  'attendance',
  'news',
  'referral',
  'redeem',
  'manual',
  'ai_tutor'
];

const MAX_ROWS = 1000;

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

function migrationMissing() {
  return json(
    {
      success: false,
      message: 'points_ledger 未建立：請先在 Supabase SQL Editor 執行 02_apply_points_ledger.sql'
    },
    { status: 503 }
  );
}

export const GET: RequestHandler = async ({ request, url }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const orgId = url.searchParams.get('orgId');
  const filterProfileId = url.searchParams.get('userId') || url.searchParams.get('profileId');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, MAX_ROWS);

  if (!orgId) return json({ success: false, message: 'orgId is required' }, { status: 400 });

  const supabase = getServerSupabase();
  const roleId = await getOrgRole(supabase, orgId, userId);
  if (roleId === null) {
    return json({ success: false, message: 'Organization access denied.' }, { status: 403 });
  }

  const scopeProfileId = roleId === ROLE.STUDENT ? userId : filterProfileId || null;

  try {
    let rowsQuery = supabase
      .from('points_ledger')
      .select('id, profile_id, kind, delta, note, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (scopeProfileId) rowsQuery = rowsQuery.eq('profile_id', scopeProfileId);

    const { data: rows, error } = await rowsQuery;

    if (error) {
      if (isMissingTable(error)) return migrationMissing();
      throw error;
    }

    // Balances need every row in scope, not just the page being displayed
    let balanceQuery = supabase
      .from('points_ledger')
      .select('profile_id, delta')
      .eq('organization_id', orgId)
      .limit(5000);

    if (scopeProfileId) balanceQuery = balanceQuery.eq('profile_id', scopeProfileId);

    const { data: allRows } = await balanceQuery;

    const balances: Record<string, number> = {};
    for (const row of allRows || []) {
      balances[row.profile_id] = (balances[row.profile_id] || 0) + Number(row.delta || 0);
    }

    const profileIds = [...new Set((rows || []).map((row: any) => row.profile_id))];
    let profileById: Record<string, any> = {};

    if (profileIds.length) {
      const { data: profiles } = await supabase
        .from('profile')
        .select('id, fullname, email')
        .in('id', profileIds);

      profileById = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
    }

    return json({
      success: true,
      roleId,
      rows: (rows || []).map((row: any) => ({
        ...row,
        profile: profileById[row.profile_id] || null
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

  const { orgId, userId: targetUserId, kind = 'manual', delta, note = '' } = body || {};

  if (!orgId || !targetUserId) {
    return json({ success: false, message: 'orgId and userId are required' }, { status: 400 });
  }

  const parsedDelta = Number(delta);
  if (!Number.isFinite(parsedDelta) || parsedDelta === 0 || Math.abs(parsedDelta) > 100000) {
    return json({ success: false, message: 'delta must be a non-zero number' }, { status: 400 });
  }

  const resolvedKind = String(kind || 'manual');
  if (!ALLOWED_KINDS.includes(resolvedKind)) {
    return json(
      { success: false, message: `kind 必須是以下之一：${ALLOWED_KINDS.join(', ')}` },
      { status: 400 }
    );
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
      .from('points_ledger')
      .insert({
        organization_id: orgId,
        profile_id: targetUserId,
        kind: resolvedKind,
        delta: Math.trunc(parsedDelta),
        note: String(note || '').slice(0, 200),
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) return migrationMissing();
      throw error;
    }

    return json({ success: true, row: data });
  } catch (err) {
    console.error('POST /api/points error:', err);
    return json({ success: false, message: 'Failed to register points' }, { status: 500 });
  }
};
