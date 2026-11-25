import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { ROLE } from '$lib/utils/constants/roles';
import { requestKimiCompletion } from '$lib/utils/services/ai/provider.server';

/**
 * FAQ + AI Tutor review.
 *
 * 任何人（org 成員）可以提交問題 → Kimi 判斷是否適合公開 →
 *   publish=true : 立即公開（答案可用 AI 整理版），並按 10/8/6/3 發積分給提供者
 *   publish=false: 留在 pending，等老師／admin 人手決定
 * 老師／admin 可以改為公開或拒絕（AI 判斷只作建議）。
 *
 * 資料表：public.faq（migration 03/04_*_faq.sql）、積分：public.points_ledger（kind=ai_tutor）
 */

const FAQ_SCORE_VALUES = [10, 8, 6, 3];

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
      message: 'faq 表未建立：請先在 Supabase SQL Editor 執行 04_apply_faq.sql'
    },
    { status: 503 }
  );
}

async function askKimi(question: string, answer: string, orgName: string) {
  const messages = [
    {
      role: 'system' as const,
      content:
        '你是 AiLAE Class 的 AI Tutor，負責審核學生／老師提交的常見問題（FAQ）。' +
        '只回傳 JSON，不要任何其他文字。格式：' +
        '{"publish": true|false, "score": 10|8|6|3|0, "reason": "簡短理由（中文）", "answer": "整理後的答案（中文，可直接公開）"}\n' +
        '規則：\n' +
        '1) 與課程、無人機、低空經濟、AI 學習、平台操作相關，內容正確、可幫助其他學生 → publish=true。\n' +
        '2) 含有個人資料、聯絡方式、廣告、攻擊性內容、與學習無關、或答案明顯錯誤 → publish=false，score=0。\n' +
        '3) publish=true 時按質素給分：完整且有解釋 10；清楚但簡短 8；基本可用 6；一句話但有用 3。\n' +
        '4) answer 欄位要用乾淨、可直接展示的中文重寫（保留原意，不要杜撰事實；不知道就說「需老師補充」）。'
    },
    {
      role: 'user' as const,
      content: `機構：${orgName}\n問題：${question}\n提交者提供的答案：${answer || '（未提供）'}`
    }
  ];

  const raw = await requestKimiCompletion(messages, {
    maxTokens: 500,
    temperature: 0.3,
    responseFormat: { type: 'json_object' }
  });

  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = null;
      }
    }
  }

  const publish = parsed?.publish === true;
  const scoreRaw = Number(parsed?.score);
  const score = publish && FAQ_SCORE_VALUES.includes(scoreRaw) ? scoreRaw : publish ? 6 : 0;

  return {
    publish,
    score,
    reason: typeof parsed?.reason === 'string' ? parsed.reason.slice(0, 300) : 'AI 未提供理由',
    answer: typeof parsed?.answer === 'string' ? parsed.answer.trim().slice(0, 2000) : ''
  };
}

export const GET: RequestHandler = async ({ request, url }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const orgId = url.searchParams.get('orgId');
  const status = url.searchParams.get('status');
  if (!orgId) return json({ success: false, message: 'orgId is required' }, { status: 400 });

  const supabase = getServerSupabase();
  const roleId = await getOrgRole(supabase, orgId, userId);
  if (roleId === null) {
    return json({ success: false, message: 'Organization access denied.' }, { status: 403 });
  }

  const isStaff = roleId !== ROLE.STUDENT;

  try {
    let query = supabase
      .from('faq')
      .select('id, question, answer, status, ai_verdict, submitted_by, reviewed_by, points_awarded, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!isStaff) {
      query = query.eq('status', 'published');
    } else if (status && ['pending', 'published', 'rejected'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') return migrationMissing();
      throw error;
    }

    const profileIds = [
      ...new Set((data || []).flatMap((row: any) => [row.submitted_by, row.reviewed_by]).filter(Boolean))
    ];
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
      isStaff,
      rows: (data || []).map((row: any) => ({
        ...row,
        submitted_by_profile: profileById[row.submitted_by] || null,
        reviewed_by_profile: profileById[row.reviewed_by] || null
      }))
    });
  } catch (err) {
    console.error('GET /api/faq error:', err);
    return json({ success: false, message: 'Failed to load FAQ' }, { status: 500 });
  }
};

async function awardPoints(supabase: any, orgId: string, profileId: string, score: number, note: string) {
  if (!score || score <= 0) return null;
  const { error } = await supabase.from('points_ledger').insert({
    organization_id: orgId,
    profile_id: profileId,
    kind: 'ai_tutor',
    delta: score,
    note,
    created_by: null
  });
  if (error) {
    console.error('FAQ points award failed:', error);
    return null;
  }
  return score;
}

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { orgId, question, answer = '' } = body || {};
  const cleanQuestion = String(question || '').trim();
  const cleanAnswer = String(answer || '').trim();

  if (!orgId || cleanQuestion.length < 5 || cleanQuestion.length > 500) {
    return json({ success: false, message: '問題長度需 5–500 字' }, { status: 400 });
  }
  if (cleanAnswer.length > 2000) {
    return json({ success: false, message: '答案不可超過 2000 字' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const roleId = await getOrgRole(supabase, orgId, userId);
  if (roleId === null) {
    return json({ success: false, message: 'Organization access denied.' }, { status: 403 });
  }

  const { data: orgRow } = await supabase.from('organization').select('name').eq('id', orgId).maybeSingle();
  const orgName = orgRow?.name || 'AiLAE Class';

  try {
    const { data: inserted, error: insertError } = await supabase
      .from('faq')
      .insert({
        organization_id: orgId,
        question: cleanQuestion,
        answer: cleanAnswer,
        status: 'pending',
        submitted_by: userId
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '42P01') return migrationMissing();
      throw insertError;
    }

    let verdict: any = null;
    let aiError: string | null = null;
    try {
      verdict = await askKimi(cleanQuestion, cleanAnswer, orgName);
    } catch (err: any) {
      aiError = err?.message || 'AI 審核暫時不可用';
      console.error('FAQ Kimi review failed:', aiError);
    }

    if (!verdict) {
      return json({
        success: true,
        row: inserted,
        ai: { error: aiError, publish: false, score: 0 },
        message: '已提交，AI 暫時未能審核，已排入老師待審清單。'
      });
    }

    const finalAnswer = cleanAnswer || verdict.answer || '';
    const awarded = verdict.publish
      ? await awardPoints(
          supabase,
          orgId,
          userId,
          verdict.score,
          `FAQ 公開：${cleanQuestion.slice(0, 60)}`
        )
      : null;

    const { data: updated } = await supabase
      .from('faq')
      .update({
        status: verdict.publish ? 'published' : 'pending',
        answer: finalAnswer,
        ai_verdict: verdict,
        points_awarded: awarded || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', inserted.id)
      .select()
      .single();

    return json({
      success: true,
      row: updated || inserted,
      ai: verdict,
      awarded: awarded || 0,
      message: verdict.publish
        ? `已公開，並獲得 ${awarded || 0} 分。`
        : `已提交，AI 建議不公開（${verdict.reason}），已排入老師待審清單。`
    });
  } catch (err) {
    console.error('POST /api/faq error:', err);
    return json({ success: false, message: 'Failed to submit FAQ' }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { orgId, id, action, answer, score } = body || {};
  if (!orgId || !id || !['publish', 'reject'].includes(action)) {
    return json({ success: false, message: 'orgId, id and action(publish|reject) are required' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const roleId = await getOrgRole(supabase, orgId, userId);
  if (roleId === null || roleId === ROLE.STUDENT) {
    return json({ success: false, message: 'Only teachers or admins can review FAQ' }, { status: 403 });
  }

  try {
    const { data: row, error: readError } = await supabase
      .from('faq')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (readError) {
      if (readError.code === '42P01') return migrationMissing();
      throw readError;
    }
    if (!row) return json({ success: false, message: 'FAQ not found' }, { status: 404 });

    if (action === 'reject') {
      const { data } = await supabase
        .from('faq')
        .update({ status: 'rejected', reviewed_by: userId, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      return json({ success: true, row: data });
    }

    // publish
    const wantedScore = FAQ_SCORE_VALUES.includes(Number(score)) ? Number(score) : 6;
    const finalAnswer = String(answer || row.answer || '').trim();
    const alreadyAwarded = Number(row.points_awarded || 0) > 0;
    const awarded = !alreadyAwarded && row.submitted_by
      ? await awardPoints(
          supabase,
          orgId,
          row.submitted_by,
          wantedScore,
          `FAQ 公開（老師核准）：${String(row.question).slice(0, 60)}`
        )
      : row.points_awarded;

    const { data } = await supabase
      .from('faq')
      .update({
        status: 'published',
        answer: finalAnswer,
        points_awarded: awarded || 0,
        reviewed_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    return json({ success: true, row: data, awarded: awarded || 0 });
  } catch (err) {
    console.error('PATCH /api/faq error:', err);
    return json({ success: false, message: 'Failed to review FAQ' }, { status: 500 });
  }
};
