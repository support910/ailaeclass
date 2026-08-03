import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ROLE } from '$lib/utils/constants/roles';
import { getOrgAccess } from '$lib/utils/functions/authz.server';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { recordAuditEvent } from '$lib/server/analytics/audit.server';

type Row = Record<string, any>;

function startDate(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days + 1);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function dayKey(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function pseudonym(value: unknown) {
  const normalized = String(value || '').replace(/-/g, '');
  return normalized ? `USR-${normalized.slice(0, 8).toUpperCase()}` : 'SYSTEM';
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function optionalQuery<T>(promise: PromiseLike<{ data: T | null; error: any }>, fallback: T) {
  try {
    const { data, error } = await promise;
    if (error) return fallback;
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

export const GET: RequestHandler = async ({ request, url }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ error: 'Unauthenticated' }, { status: 401 });

  const orgId = url.searchParams.get('orgId') || '';
  const requestedDays = Number(url.searchParams.get('days') || 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const format = url.searchParams.get('format');
  if (!orgId) return json({ error: 'Organization is required' }, { status: 400 });

  const supabase = getServerSupabase();
  const access = await getOrgAccess(supabase, orgId, userId);
  if (!access.isAdmin) {
    await recordAuditEvent(request, {
      organizationId: orgId,
      actorProfileId: userId,
      action: 'data_cockpit_access_denied',
      resourceType: 'organization',
      resourceId: orgId,
      outcome: 'failure',
      riskLevel: 'medium'
    });
    return json({ error: 'Administrator access required' }, { status: 403 });
  }

  const since = startDate(days);
  const sinceIso = since.toISOString();
  const optionalDataPromise = Promise.all([
    optionalQuery<Row[]>(
      supabase
        .from('platform_analytics_events')
        .select('id,actor_profile_id,category,event_name,entity_type,entity_id,metadata,occurred_at')
        .eq('organization_id', orgId)
        .gte('occurred_at', sinceIso)
        .order('occurred_at', { ascending: false })
        .limit(500),
      []
    ),
    optionalQuery<Row[]>(
      supabase
        .from('privacy_audit_log')
        .select('id,actor_profile_id,action,resource_type,resource_id,outcome,risk_level,occurred_at')
        .eq('organization_id', orgId)
        .gte('occurred_at', sinceIso)
        .order('occurred_at', { ascending: false })
        .limit(500),
      []
    ),
    optionalQuery<Row | null>(
      supabase
        .from('platform_privacy_settings')
        .select('retention_days,store_ai_content,pseudonymize_exports,updated_at')
        .eq('organization_id', orgId)
        .maybeSingle(),
      null
    ),
    optionalQuery<Row[]>(
      supabase
        .from('analytics_login_events')
        .select('user_id,logged_in_at')
        .gte('logged_in_at', sinceIso),
      []
    )
  ]);
  const groups = await optionalQuery<Row[]>(
    supabase.from('group').select('id').eq('organization_id', orgId),
    []
  );
  const groupIds = groups.map((item) => item.id).filter(Boolean);

  const [courses, members, organizationMembers] = await Promise.all([
    groupIds.length
      ? optionalQuery<Row[]>(
        supabase
          .from('course')
          .select('id,title,group_id,is_published,status,created_at')
          .in('group_id', groupIds),
        []
      )
      : Promise.resolve([]),
    groupIds.length
      ? optionalQuery<Row[]>(
          supabase
            .from('groupmember')
            .select('id,group_id,role_id,profile_id,created_at')
            .in('group_id', groupIds),
          []
        )
      : Promise.resolve([]),
    optionalQuery<Row[]>(
      supabase
        .from('organizationmember')
        .select('role_id,profile_id,verified,created_at')
        .eq('organization_id', orgId),
      []
    )
  ]);
  const courseIds = courses.map((item) => item.id).filter(Boolean);
  const lessons = courseIds.length
    ? await optionalQuery<Row[]>(
        supabase.from('lesson').select('id,course_id,title,created_at').in('course_id', courseIds),
        []
      )
    : [];
  const lessonIds = lessons.map((item) => item.id).filter(Boolean);
  const [completions, exercises] = await Promise.all([
    lessonIds.length
      ? optionalQuery<Row[]>(
        supabase
          .from('lesson_completion')
          .select('id,lesson_id,profile_id,is_complete,created_at,updated_at')
          .in('lesson_id', lessonIds)
          .gte('updated_at', sinceIso),
        []
      )
      : Promise.resolve([]),
    lessonIds.length
      ? optionalQuery<Row[]>(
        supabase
          .from('exercise')
          .select('id,lesson_id,title,assessment_type,show_result_policy,passing_score,published_at,created_at')
          .in('lesson_id', lessonIds)
          .is('deleted_at', null),
        []
      )
      : Promise.resolve([])
  ]);
  const exerciseIds = exercises.map((item) => item.id).filter(Boolean);
  const submissions = exerciseIds.length
    ? await optionalQuery<Row[]>(
        supabase
          .from('submission')
          .select('id,exercise_id,course_id,submitted_by,total,created_at,submitted_at')
          .in('exercise_id', exerciseIds)
          .gte('created_at', sinceIso),
        []
      )
    : [];

  const [analyticsEvents, auditEvents, privacySettings, loginEvents] = await optionalDataPromise;

  const studentIds = new Set(
    [...members, ...organizationMembers]
      .filter((item) => item.role_id === ROLE.STUDENT && item.profile_id)
      .map((item) => item.profile_id)
  );
  const teacherIds = new Set(
    [...members, ...organizationMembers]
      .filter((item) => item.role_id === ROLE.TUTOR && item.profile_id)
      .map((item) => item.profile_id)
  );
  const administratorIds = new Set(
    organizationMembers
      .filter((item) => item.role_id === ROLE.ADMIN && item.profile_id)
      .map((item) => item.profile_id)
  );
  const orgUserIds = new Set([...studentIds, ...teacherIds, ...administratorIds]);
  const activeUsers = new Set(
    loginEvents.filter((item) => orgUserIds.has(item.user_id)).map((item) => item.user_id)
  );

  const completedCount = completions.filter((item) => item.is_complete).length;
  const completionRate = completions.length ? Math.round((completedCount / completions.length) * 100) : 0;
  const exerciseById = new Map(exercises.map((item) => [item.id, item]));
  const examSubmissions = submissions.filter((item) => exerciseById.get(item.exercise_id)?.assessment_type === 'exam');
  const passedSubmissions = examSubmissions.filter((item) => {
    const passingScore = Number(exerciseById.get(item.exercise_id)?.passing_score ?? 60);
    return Number(item.total || 0) >= passingScore;
  });
  const examPassRate = examSubmissions.length
    ? Math.round((passedSubmissions.length / examSubmissions.length) * 100)
    : 0;

  const courseById = new Map(courses.map((item) => [item.id, item]));
  const lessonById = new Map(lessons.map((item) => [item.id, item]));
  const courseMemberCount = new Map<string, number>();
  for (const course of courses) {
    const count = new Set(
      members
        .filter((member) => member.group_id === course.group_id && member.role_id === ROLE.STUDENT)
        .map((member) => member.profile_id)
        .filter(Boolean)
    ).size;
    courseMemberCount.set(course.id, count);
  }

  const trend = new Map<string, Row>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(since);
    date.setUTCDate(since.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    trend.set(key, { date: key, enrollments: 0, completions: 0, submissions: 0, aiQueries: 0 });
  }
  for (const member of members) {
    const key = dayKey(member.created_at);
    if (trend.has(key)) trend.get(key)!.enrollments += 1;
  }
  for (const item of completions) {
    const key = dayKey(item.updated_at || item.created_at);
    if (item.is_complete && trend.has(key)) trend.get(key)!.completions += 1;
  }
  for (const item of submissions) {
    const key = dayKey(item.submitted_at || item.created_at);
    if (trend.has(key)) trend.get(key)!.submissions += 1;
  }
  for (const item of analyticsEvents) {
    const key = dayKey(item.occurred_at);
    if (item.category === 'ai' && trend.has(key)) trend.get(key)!.aiQueries += 1;
  }

  const recentRecords = [
    ...analyticsEvents.map((item) => ({
      id: item.id,
      occurredAt: item.occurred_at,
      category: item.category,
      action: item.event_name,
      actor: pseudonym(item.actor_profile_id),
      resource: item.entity_type || 'platform',
      outcome: 'success',
      risk: 'low'
    })),
    ...auditEvents.map((item) => ({
      id: item.id,
      occurredAt: item.occurred_at,
      category: 'audit',
      action: item.action,
      actor: pseudonym(item.actor_profile_id),
      resource: item.resource_type,
      outcome: item.outcome,
      risk: item.risk_level
    })),
    ...submissions.map((item) => ({
      id: item.id,
      occurredAt: item.submitted_at || item.created_at,
      category: 'assessment',
      action: 'assessment_submitted',
      actor: pseudonym(item.submitted_by),
      resource: exerciseById.get(item.exercise_id)?.title || 'Assessment',
      outcome: 'success',
      risk: 'low'
    })),
    ...completions.filter((item) => item.is_complete).map((item) => ({
      id: `completion-${item.id}`,
      occurredAt: item.updated_at || item.created_at,
      category: 'learning',
      action: 'lesson_completed',
      actor: pseudonym(item.profile_id),
      resource: lessonById.get(item.lesson_id)?.title || 'Lesson',
      outcome: 'success',
      risk: 'low'
    }))
  ]
    .filter((item) => item.occurredAt)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 200);

  if (format === 'csv') {
    const header = ['Time', 'Category', 'Action', 'Actor', 'Resource', 'Outcome', 'Risk'];
    const rows = recentRecords.map((item) => [
      item.occurredAt,
      item.category,
      item.action,
      item.actor,
      item.resource,
      item.outcome,
      item.risk
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    await recordAuditEvent(request, {
      organizationId: orgId,
      actorProfileId: userId,
      action: 'data_cockpit_exported',
      resourceType: 'analytics_export',
      resourceId: orgId,
      riskLevel: 'medium',
      metadata: { days, recordCount: rows.length, pseudonymized: true }
    });
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="ailaeclass-data-${dayKey(new Date().toISOString())}.csv"`,
        'cache-control': 'no-store'
      }
    });
  }

  await recordAuditEvent(request, {
    organizationId: orgId,
    actorProfileId: userId,
    action: 'data_cockpit_viewed',
    resourceType: 'analytics_dashboard',
    resourceId: orgId,
    metadata: { days }
  });

  return json({
    generatedAt: new Date().toISOString(),
    periodDays: days,
    summary: {
      totalStudents: studentIds.size,
      totalTeachers: teacherIds.size,
      totalCourses: courses.length,
      publishedCourses: courses.filter((item) => item.is_published).length,
      activeUsers: activeUsers.size,
      completionRate,
      examPassRate,
      totalRecords: analyticsEvents.length + auditEvents.length + submissions.length + completions.length
    },
    charts: {
      roleDistribution: [
        { group: 'Students', value: studentIds.size },
        { group: 'Teachers', value: teacherIds.size },
        { group: 'Administrators', value: administratorIds.size }
      ],
      courseStatus: [
        { group: 'Published', value: courses.filter((item) => item.is_published).length },
        { group: 'Draft', value: courses.filter((item) => !item.is_published).length }
      ],
      examModes: [
        { group: 'Traditional', value: exercises.filter((item) => item.show_result_policy !== 'immediately').length },
        { group: 'Instant training', value: exercises.filter((item) => item.show_result_policy === 'immediately').length }
      ],
      activityTrend: Array.from(trend.values()),
      topCourses: courses
        .map((course) => ({
          id: course.id,
          title: course.title,
          students: courseMemberCount.get(course.id) || 0,
          submissions: submissions.filter((item) => item.course_id === course.id).length,
          completions: completions.filter((item) => lessonById.get(item.lesson_id)?.course_id === course.id && item.is_complete).length
        }))
        .sort((a, b) => b.students + b.submissions - (a.students + a.submissions))
        .slice(0, 8)
    },
    recentRecords: recentRecords.slice(0, 50),
    privacy: {
      retentionDays: privacySettings?.retention_days ?? 365,
      storesAiContent: privacySettings?.store_ai_content ?? false,
      pseudonymizedExports: privacySettings?.pseudonymize_exports ?? true,
      administratorOnly: true,
      hashedNetworkIdentifiers: true
    }
  }, {
    headers: { 'cache-control': 'private, no-store' }
  });
};
