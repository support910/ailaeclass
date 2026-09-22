import { z } from 'zod';
import { ROLE } from '$lib/utils/constants/roles';
import { getOrgAccess, getCourseAccess } from '$lib/utils/functions/authz.server';
import { parseDriveLink, SimulatorError } from './drive.js';
import { databaseError } from './repository.server';

export const uuid = z.string().uuid();
const form = z.object({
  courseId: uuid, requestId: uuid, title: z.string().trim().min(1).max(120),
  flightType: z.enum(['simulator', 'real']), scenario: z.enum(['figure_eight', 'hover', 'route', 'landing']),
  occurredAt: z.string().datetime({ offset: true }), resultUrl: z.string().trim().max(2048).default(''),
  videoUrl: z.string().trim().max(2048).default(''), note: z.string().trim().max(2000).default(''), consent: z.literal(true)
}).strict();

export function shareInput(value: unknown) {
  const parsed = form.safeParse(value);
  if (!parsed.success) throw new SimulatorError('invalid_request');
  const input = parsed.data;
  if (!input.resultUrl && !input.videoUrl) throw new SimulatorError('links_required');
  if (input.flightType === 'simulator' && (!input.resultUrl || input.videoUrl)) throw new SimulatorError('invalid_request');
  for (const field of ['resultUrl','videoUrl'] as const) {
    if (!input[field]) continue;
    const link = parseDriveLink(input[field]);
    if (link.sheet) throw new SimulatorError('invalid_link');
    input[field] = link.sourceUrl;
  }
  if (input.resultUrl && input.resultUrl === input.videoUrl) throw new SimulatorError('duplicate_link');
  if (Date.parse(input.occurredAt) > Date.now() + 300_000) throw new SimulatorError('invalid_time');
  return input;
}

export function sharingDbError(error: { code?: string; message?: string }) {
  const codes: Record<string, [string, number]> = {
    FLIGHT_ACCESS_DENIED: ['forbidden',403], FLIGHT_RATE_LIMIT: ['rate_limit',429],
    FLIGHT_REQUEST_CONFLICT: ['request_conflict',409], FLIGHT_INVALID_TIME: ['invalid_time',400]
  };
  for (const [marker, [code,status]] of Object.entries(codes)) if (error.message?.includes(marker)) return new SimulatorError(code,status);
  return databaseError(error);
}

export async function sharingScope(db: any, userId: string, orgId: string, staff: boolean) {
  if (!uuid.safeParse(orgId).success) throw new SimulatorError('invalid_request');
  const access = await getOrgAccess(db, orgId, userId);
  if (!access.membership?.verified || (staff && !access.canManageCourses)) throw new SimulatorError('forbidden',403);
  const groups = await db.from('group').select('id').eq('organization_id',orgId);
  if (groups.error) throw databaseError(groups.error);
  let ids = (groups.data || []).map((g: any) => g.id);
  if (ids.length && !(staff && access.isAdmin)) {
    const members = await db.from('groupmember').select('group_id').eq('profile_id',userId).in('group_id',ids)
      .in('role_id',staff ? [ROLE.ADMIN,ROLE.TUTOR] : [ROLE.STUDENT]);
    if (members.error) throw databaseError(members.error);
    ids = (members.data || []).map((m: any) => m.group_id);
  }
  if (!ids.length) return { courses: [], isAdmin: access.isAdmin };
  const courses = await db.from('course').select('id,title').in('group_id',ids).eq('status','ACTIVE').order('title');
  if (courses.error) throw databaseError(courses.error);
  return { courses: courses.data || [], isAdmin: access.isAdmin };
}

export async function visibleSubmission(db: any, userId: string, id: string) {
  if (!uuid.safeParse(id).success) throw new SimulatorError('not_found',404);
  const row = await db.from('flight_link_submissions').select('*').eq('id',id).maybeSingle();
  if (row.error) throw databaseError(row.error);
  if (!row.data) throw new SimulatorError('not_found',404);
  if (row.data.user_id !== userId) {
    if (row.data.status !== 'submitted') throw new SimulatorError('not_found',404);
    const access = await getCourseAccess(db,row.data.course_id,userId);
    // Match the active-course rule used by list and RLS.
    const active = await db.from('course').select('id').eq('id',row.data.course_id).eq('status','ACTIVE').maybeSingle();
    if (active.error) throw databaseError(active.error);
    if (!access.canManageCourse || !active.data) throw new SimulatorError('not_found',404);
  }
  return row.data;
}

export async function enrichSubmissions(db: any, rows: any[]) {
  if (!rows.length) return [];
  const profiles = await db.from('profile').select('id,fullname').in('id',[...new Set(rows.map(row => row.user_id))]);
  const courses = await db.from('course').select('id,title').in('id',[...new Set(rows.map(row => row.course_id))]);
  if (profiles.error || courses.error) throw databaseError(profiles.error || courses.error);
  return rows.map(row => ({ ...row,
    student_name: profiles.data?.find((p: any) => p.id === row.user_id)?.fullname || row.user_id,
    course_title: courses.data?.find((c: any) => c.id === row.course_id)?.title || row.course_id
  }));
}
