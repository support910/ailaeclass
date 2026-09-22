import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { identity, readJson, failure, databaseError } from '$lib/server/simulator/repository.server';
import { SimulatorError } from '$lib/server/simulator/drive.js';
import { sharingScope, shareInput, sharingDbError, enrichSubmissions } from '$lib/server/simulator/sharing.server';

const headers = { 'Cache-Control': 'no-store' };
export const GET: RequestHandler = async ({ request, url }) => {
  try {
    const { db,userId } = await identity(request);
    const staff = url.searchParams.get('view') === 'staff';
    const scope = await sharingScope(db,userId,url.searchParams.get('orgId') || '',staff);
    if (url.searchParams.get('options') === '1') return json(scope,{headers});
    const courseId = url.searchParams.get('courseId');
    const ids = scope.courses.map((c: any) => c.id);
    if (courseId && !ids.includes(courseId)) throw new SimulatorError('forbidden',403);
    if (!ids.length) return json({ submissions: [], more: false },{headers});
    const offset = Math.floor(Math.max(0,Math.min(10_000,Number(url.searchParams.get('offset')) || 0)));
    let query = db.from('flight_link_submissions').select('*').in('course_id',courseId ? [courseId] : ids);
    query = staff ? query.eq('status','submitted') : query.eq('user_id',userId);
    const result = await query.order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+20);
    if (result.error) throw databaseError(result.error);
    const rows = result.data || [];
    return json({ submissions: await enrichSubmissions(db,rows.slice(0,20)), more: rows.length > 20 },{headers});
  } catch (error) { return failure(error); }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { db,userId } = await identity(request);
    const input = shareInput(await readJson(request));
    const result = await db.rpc('submit_flight_link',{
      p_user_id:userId,p_course_id:input.courseId,p_request_id:input.requestId,p_title:input.title,
      p_flight_type:input.flightType,p_scenario:input.scenario,p_occurred_at:input.occurredAt,
      p_result_url:input.resultUrl || null,p_video_url:input.videoUrl || null,p_note:input.note
    });
    if (result.error) throw sharingDbError(result.error);
    return json({ id:result.data },{status:201,headers});
  } catch (error) { return failure(error); }
};
