import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import { SimulatorError, readLimited } from './drive.js';

export async function identity(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) throw new SimulatorError('unauthenticated', 401);
  return { userId, db: getServerSupabase() };
}

export async function readJson(request: Request, limit = 12_000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new SimulatorError('invalid_request');
  const bytes = await readLimited(request.body, limit);
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw new SimulatorError('invalid_request'); }
}

export function databaseError(error: { code?: string; message?: string }) {
  if (error.message?.includes('SIMULATOR_RATE_LIMIT')) return new SimulatorError('rate_limit', 429);
  if (['42P01', 'PGRST205', 'PGRST202'].includes(error.code || '')) return new SimulatorError('setup_required', 503);
  return new SimulatorError('storage_failed', 503);
}

export async function ownedReview(db: ReturnType<typeof getServerSupabase>, userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new SimulatorError('not_found', 404);
  const { data, error } = await db.from('simulator_drive_reviews').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new SimulatorError('not_found', 404);
  return data;
}

export async function updateReview(db: ReturnType<typeof getServerSupabase>, userId: string, id: string, values: Record<string, unknown>) {
  const { data, error } = await db.from('simulator_drive_reviews').update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', userId).select('id').maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new SimulatorError('not_found', 404);
}

export function failure(error: unknown) {
  const known = error instanceof SimulatorError;
  return new Response(JSON.stringify({ code: known ? error.code : 'analysis_failed' }), {
    status: known ? error.status : 502,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
