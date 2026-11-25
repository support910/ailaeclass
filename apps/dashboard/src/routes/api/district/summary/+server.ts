import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';

/**
 * GET /api/district/summary
 *
 * 跨校摘要：我（地區 admin 或 HK admin）可以讀取的學校，逐校給
 *   學生人數、積分合計、最後活動時間、授權來源與到期日。
 * 每次跨機構讀取（唔係自己機構）都寫一行 data_access_log。
 */

function isMissingTable(error: any) {
  const code = String(error?.code || '');
  return code === '42P01' || code === 'PGRST205' || /schema cache/i.test(String(error?.message || ''));
}

function migrationMissing() {
  return json(
    { success: false, message: '地區權限表未建立：請先執行 06_apply_district_access.sql' },
    { status: 503 }
  );
}

export const GET: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const supabase = getServerSupabase();
  const now = Date.now();

  try {
    // HK admin?
    const { data: hkRow, error: hkError } = await supabase
      .from('hk_admin')
      .select('profile_id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (hkError) {
      if (isMissingTable(hkError)) return migrationMissing();
      throw hkError;
    }

    const isHkAdmin = !!hkRow;

    // 我自己的機構（用來判斷邊次讀取要寫審計）
    const { data: myMemberships } = await supabase
      .from('organizationmember')
      .select('organization_id, role_id, verified')
      .eq('profile_id', userId)
      .eq('verified', true);

    const myOrgIds = new Set<string>(
      (myMemberships || []).map((m: any) => String(m.organization_id))
    );

    // 可讀取的學校
    type Access = { organization_id: string; via: 'hk' | 'request'; request_id?: string; expires_at?: string | null };
    const accessByOrg = new Map<string, Access>();

    if (isHkAdmin) {
      const { data: links, error } = await supabase
        .from('district_school')
        .select('organization_id, district_id');
      if (error) {
        if (isMissingTable(error)) return migrationMissing();
        throw error;
      }
      for (const link of links || []) {
        accessByOrg.set(link.organization_id, { organization_id: link.organization_id, via: 'hk' });
      }
    } else {
      const { data: approved, error } = await supabase
        .from('data_access_request')
        .select('id, organization_id, expires_at, status')
        .eq('requester_id', userId)
        .eq('status', 'approved');

      if (error) {
        if (isMissingTable(error)) return migrationMissing();
        throw error;
      }

      for (const row of approved || []) {
        const alive = !row.expires_at || new Date(row.expires_at).getTime() > now;
        if (!alive) continue;
        accessByOrg.set(row.organization_id, {
          organization_id: row.organization_id,
          via: 'request',
          request_id: row.id,
          expires_at: row.expires_at
        });
      }
    }

    // 自己機構一定可以讀
    for (const orgId of myOrgIds) {
      if (!accessByOrg.has(orgId)) {
        accessByOrg.set(orgId, { organization_id: orgId, via: 'request' });
      }
    }

    const orgIds = [...accessByOrg.keys()];
    if (!orgIds.length) return json({ success: true, isHkAdmin, schools: [] });

    const { data: orgs } = await supabase.from('organization').select('id, name').in('id', orgIds);
    const orgName: Record<string, string> = {};
    for (const org of orgs || []) orgName[org.id] = org.name;

    const { data: links } = await supabase
      .from('district_school')
      .select('organization_id, district_id')
      .in('organization_id', orgIds);

    const districtIds = [...new Set((links || []).map((l: any) => l.district_id))];
    const districtName: Record<string, string> = {};
    if (districtIds.length) {
      const { data: districts } = await supabase.from('district').select('id, name').in('id', districtIds);
      for (const d of districts || []) districtName[d.id] = d.name;
    }
    const districtByOrg: Record<string, string> = {};
    for (const l of links || []) districtByOrg[l.organization_id] = districtName[l.district_id] || '';

    // 逐校統計
    const { data: members } = await supabase
      .from('organizationmember')
      .select('organization_id, profile_id, role_id, verified')
      .in('organization_id', orgIds);

    const { data: ledger } = await supabase
      .from('points_ledger')
      .select('organization_id, delta, created_at')
      .in('organization_id', orgIds)
      .limit(5000);

    const students: Record<string, number> = {};
    for (const m of members || []) {
      if (m.verified === true && Number(m.role_id) === ROLE.STUDENT) {
        students[m.organization_id] = (students[m.organization_id] || 0) + 1;
      }
    }

    const points: Record<string, number> = {};
    const lastActivity: Record<string, string> = {};
    for (const row of ledger || []) {
      points[row.organization_id] = (points[row.organization_id] || 0) + Number(row.delta || 0);
      const prev = lastActivity[row.organization_id];
      if (!prev || new Date(row.created_at) > new Date(prev)) lastActivity[row.organization_id] = row.created_at;
    }

    // 審計：跨機構讀取
    const auditRows = [...accessByOrg.values()]
      .filter((access) => !myOrgIds.has(access.organization_id))
      .map((access) => ({
        viewer_id: userId,
        organization_id: access.organization_id,
        request_id: access.request_id || null,
        endpoint: 'district/summary'
      }));

    if (auditRows.length) {
      const { error: auditError } = await supabase.from('data_access_log').insert(auditRows);
      if (auditError && !isMissingTable(auditError)) {
        console.error('data_access_log insert failed:', auditError);
      }
    }

    const schools = [...accessByOrg.values()].map((access) => ({
      organization_id: access.organization_id,
      name: orgName[access.organization_id] || access.organization_id.slice(0, 8),
      district: districtByOrg[access.organization_id] || '',
      via: access.via,
      expires_at: access.expires_at || null,
      students: students[access.organization_id] || 0,
      points_total: points[access.organization_id] || 0,
      last_activity: lastActivity[access.organization_id] || null,
      is_own_org: myOrgIds.has(access.organization_id)
    }));

    schools.sort((a, b) => a.name.localeCompare(b.name));

    return json({ success: true, isHkAdmin, schools, audited: auditRows.length });
  } catch (err) {
    console.error('GET /api/district/summary error:', err);
    return json({ success: false, message: 'Failed to load district summary' }, { status: 500 });
  }
};
