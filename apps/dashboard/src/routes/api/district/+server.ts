import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * 地區存取：清單、我的授權、提交申請。
 *
 * GET  /api/district            → 地區字典、我的學校、我的申請、待我批的申請
 * POST /api/district            → { organizationId, reason?, scope?, fields? } 建立 pending 申請
 *
 * 規則（2026-11 定案）：
 *   - 冇 1S：只有地區 admin（1P）要逐間學校申請
 *   - 批准必須有到期日（預設 30 日），過期即失效
 *   - HK admin（hk_admin 表）可讀全港，讀取時寫 data_access_log
 *   - 只有該校 school admin（organizationmember role_id=1, verified）可以批准／拒絕
 */

function migrationMissing() {
  return json(
    { success: false, message: '地區權限表未建立：請先執行 06_apply_district_access.sql' },
    { status: 503 }
  );
}

function isMissingTable(error: any) {
  const code = String(error?.code || '');
  return code === '42P01' || code === 'PGRST205' || /schema cache/i.test(String(error?.message || ''));
}

async function getOrgRoles(supabase: any, userId: string) {
  const { data } = await supabase
    .from('organizationmember')
    .select('organization_id, role_id, verified')
    .eq('profile_id', userId)
    .eq('verified', true);

  return (data || []) as { organization_id: string; role_id: number; verified: boolean }[];
}

async function isHkAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('hk_admin')
    .select('profile_id')
    .eq('profile_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return null; // signal migration missing
    return false;
  }
  return !!data;
}

export const GET: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const supabase = getServerSupabase();

  try {
    const hk = await isHkAdmin(supabase, userId);
    if (hk === null) return migrationMissing();

    const roles = await getOrgRoles(supabase, userId);
    const adminOrgIds = roles.filter((r) => Number(r.role_id) === ROLE.ADMIN).map((r) => r.organization_id);

    const { data: districts, error: districtError } = await supabase
      .from('district')
      .select('id, name')
      .order('name', { ascending: true });

    if (districtError) {
      if (isMissingTable(districtError)) return migrationMissing();
      throw districtError;
    }

    const { data: myRequests, error: requestError } = await supabase
      .from('data_access_request')
      .select(
        'id, requester_id, district_id, organization_id, scope, fields, reason, status, decided_by, decided_at, expires_at, created_at'
      )
      .eq('requester_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (requestError) {
      if (isMissingTable(requestError)) return migrationMissing();
      throw requestError;
    }

    let pendingForMe: any[] = [];
    if (adminOrgIds.length) {
      const { data, error } = await supabase
        .from('data_access_request')
        .select('id, requester_id, organization_id, district_id, scope, fields, reason, status, created_at')
        .in('organization_id', adminOrgIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error && !isMissingTable(error)) throw error;
      pendingForMe = data || [];
    }

    // 名稱 lookup
    const orgIds = [
      ...new Set([
        ...(myRequests || []).map((r: any) => r.organization_id),
        ...pendingForMe.map((r: any) => r.organization_id),
        ...roles.map((r) => r.organization_id)
      ])
    ].filter(Boolean);

    const profileIds = [
      ...new Set([
        ...(myRequests || []).map((r: any) => r.requester_id),
        ...pendingForMe.map((r: any) => r.requester_id)
      ])
    ].filter(Boolean);

    const orgName: Record<string, string> = {};
    if (orgIds.length) {
      const { data: orgs } = await supabase.from('organization').select('id, name').in('id', orgIds);
      for (const org of orgs || []) orgName[org.id] = org.name;
    }

    const districtName: Record<string, string> = {};
    for (const d of districts || []) districtName[d.id] = d.name;

    const personName: Record<string, string> = {};
    if (profileIds.length) {
      const { data: profiles } = await supabase
        .from('profile')
        .select('id, fullname, email')
        .in('id', profileIds);
      for (const p of profiles || []) personName[p.id] = p.fullname || p.email || p.id.slice(0, 8);
    }

    // 所有已分配地區的學校（供地區 admin 揀選申請）。只回學校名稱＋地區，不含任何學生資料；
    // 地區 admin 可能唔屬於任何學校機構，所以唔可以用 roles.length 做閘。
    let schools: any[] = [];
    {
      const { data: links, error: linkError } = await supabase
        .from('district_school')
        .select('organization_id, district_id');
      if (linkError && !isMissingTable(linkError)) throw linkError;

      const linkOrgIds = [...new Set((links || []).map((l: any) => l.organization_id))];
      if (linkOrgIds.length) {
        const { data: orgRows } = await supabase
          .from('organization')
          .select('id, name')
          .in('id', linkOrgIds);
        const nameById: Record<string, string> = {};
        for (const org of orgRows || []) nameById[org.id] = org.name;
        schools = (links || []).map((l: any) => ({
          organization_id: l.organization_id,
          name: nameById[l.organization_id] || l.organization_id.slice(0, 8),
          district_id: l.district_id,
          district_name: districtName[l.district_id] || ''
        }));
        schools.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    const decorate = (row: any) => ({
      ...row,
      organization_name: orgName[row.organization_id] || row.organization_id?.slice(0, 8),
      district_name: districtName[row.district_id] || row.district_id?.slice(0, 8),
      requester_name: personName[row.requester_id] || null
    });

    return json({
      success: true,
      isHkAdmin: hk,
      isSchoolAdmin: adminOrgIds.length > 0,
      districts: districts || [],
      schools,
      myOrganizations: adminOrgIds.map((id) => ({ id, name: orgName[id] || id.slice(0, 8) })),
      myRequests: (myRequests || []).map(decorate),
      pendingForMe: pendingForMe.map(decorate)
    });
  } catch (err) {
    console.error('GET /api/district error:', err);
    return json({ success: false, message: 'Failed to load district access' }, { status: 500 });
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

  const { organizationId, reason = '', scope = 'summary', fields = [] } = body || {};
  if (!organizationId) {
    return json({ success: false, message: 'organizationId is required' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  try {
    const { data: link, error: linkError } = await supabase
      .from('district_school')
      .select('district_id, organization_id')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (linkError) {
      if (isMissingTable(linkError)) return migrationMissing();
      throw linkError;
    }
    if (!link) {
      return json(
        { success: false, message: '這間學校未分配地區，請聯絡 HK admin' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from('data_access_request')
      .select('id, status, expires_at')
      .eq('requester_id', userId)
      .eq('organization_id', organizationId)
      .in('status', ['pending', 'approved']);

    const now = Date.now();
    const blocking = (existing || []).find(
      (row: any) =>
        row.status === 'pending' ||
        (row.status === 'approved' && row.expires_at && new Date(row.expires_at).getTime() > now)
    );
    if (blocking) {
      return json(
        { success: false, message: '已有待批或仍然生效的申請，毋須重複提交' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('data_access_request')
      .insert({
        requester_id: userId,
        district_id: link.district_id,
        organization_id: organizationId,
        scope: ['summary', 'partial', 'all_fields'].includes(scope) ? scope : 'summary',
        fields: Array.isArray(fields) ? fields.slice(0, 30) : [],
        reason: String(reason || '').slice(0, 300),
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) return migrationMissing();
      throw error;
    }

    return json({ success: true, request: data, message: '已提交申請，等待該校 school admin 批准' });
  } catch (err) {
    console.error('POST /api/district error:', err);
    return json({ success: false, message: 'Failed to submit request' }, { status: 500 });
  }
};
