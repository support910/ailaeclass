import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { identity, failure, databaseError } from '$lib/server/simulator/repository.server';
import { visibleSubmission, enrichSubmissions } from '$lib/server/simulator/sharing.server';
import { SimulatorError } from '$lib/server/simulator/drive.js';
const headers = { 'Cache-Control': 'no-store' };

export const GET: RequestHandler = async ({request,params}) => {
  try {
    const {db,userId} = await identity(request);
    const row = await visibleSubmission(db,userId,params.id);
    return json({submission:(await enrichSubmissions(db,[row]))[0]},{headers});
  } catch(error) { return failure(error); }
};

export const DELETE: RequestHandler = async ({request,params}) => {
  try {
    const {db,userId} = await identity(request);
    const row = await visibleSubmission(db,userId,params.id);
    if(row.user_id !== userId) throw new SimulatorError('forbidden',403);
    const result = await db.from('flight_link_submissions').update({status:'withdrawn',withdrawn_at:new Date().toISOString()})
      .eq('id',row.id).eq('user_id',userId).eq('status','submitted');
    if(result.error) throw databaseError(result.error);
    return json({success:true},{headers});
  } catch(error) { return failure(error); }
};
