import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { identity, ownedReview, databaseError, failure } from '$lib/server/simulator/repository.server';

export const GET: RequestHandler = async ({ request, params }) => {
  try {
    const { db, userId } = await identity(request);
    return json({ review: await ownedReview(db, userId, params.id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  try {
    const { db, userId } = await identity(request);
    await ownedReview(db, userId, params.id);
    const { error } = await db.from('simulator_drive_reviews').delete().eq('id', params.id).eq('user_id', userId);
    if (error) throw databaseError(error);
    return json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
};
