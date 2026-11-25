import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * PATCH /api/district/requests
 * Body: { id, action: 'approve' | 'reject' | 'revoke', days? }
 *
 * 只有該校 school admin（organizationmember role_id = ADMIN, verified）可以批准／拒絕；
 * 批准必須有到期日（預設 30 日、上限 365 日）。
 */

function isMissingTable(error: any) {
  const code = String(error?.code || '');
  return code === '42P01' || code === 'PGRST205' || /schema cache/i.test(String(error?.message || ''));
}

export const PATCH: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { id, action, days } = body || {};
  if (!id || !['approve', 'reject', 'revoke'].includes(action)) {
    return json({ success: false, message: 'id and action(approve|reject|revoke) are required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: row, error: readError } = await supabase
      .from('data_access_request')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (readError) {
      if (isMissingTable(readError)) {
        return json(
          { success: false, message: '地區權限表未建立：請先執行 06_apply_district_access.sql' },
          { status: 503 }
        );
      }
      throw readError;
    }
    if (!row) return json({ success: false, message: 'Request not found' }, { status: 404 });

    // 只有該校 verified ADMIN 可審批
    const { data: membership } = await supabase
      .from('organizationmember')
      .select('role_id, verified')
      .eq('organization_id', row.organization_id)
      .eq('profile_id', userId)
      .maybeSingle();

    const isSchoolAdmin = !!membership && membership.verified === true && Number(membership.role_id) === ROLE.ADMIN;
    if (!isSchoolAdmin) {
      return json(
        { success: false, message: '只有該校 school admin 可以審批此申請' },
        { status: 403 }
      );
    }

    const now = new Date();

    if (action === 'approve') {
      const parsedDays = Number(days);
      const validDays = Number.isFinite(parsedDays) && parsedDays > 0 ? Math.min(Math.floor(parsedDays), 365) : 30;
      const expiresAt = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('data_access_request')
        .update({
          status: 'approved',
          decided_by: userId,
          decided_at: now.toISOString(),
          expires_at: expiresAt
        })
        .eq('id', id)
        .select()
        .single();

      return json({ success: true, request: data, message: `已批准 ${validDays} 日，至 ${expiresAt.slice(0, 10)}` });
    }

    const { data } = await supabase
      .from('data_access_request')
      .update({
        status: action === 'reject' ? 'rejected' : 'revoked',
        decided_by: userId,
        decided_at: now.toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    return json({
      success: true,
      request: data,
      message: action === 'reject' ? '已拒絕申請' : '已撤銷授權'
    });
  } catch (err) {
    console.error('PATCH /api/district/requests error:', err);
    return json({ success: false, message: 'Failed to review request' }, { status: 500 });
  }
};
