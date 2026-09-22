import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { AiServiceError } from '$lib/utils/services/ai/provider.server';
import { identity, readJson, ownedReview, updateReview, databaseError, failure } from '$lib/server/simulator/repository.server';
import { SimulatorError } from '$lib/server/simulator/drive.js';
import { analyzeReview, frameInput } from '$lib/server/simulator/analysis.server';

export const POST: RequestHandler = async ({ request, params }) => {
  let current: Awaited<ReturnType<typeof identity>> | undefined;
  let claimed = false;
  try {
    current = await identity(request);
    const { db, userId } = current;
    const review = await ownedReview(db, userId, params.id);
    if (review.status === 'completed') return json({ review }, { headers: { 'Cache-Control': 'no-store' } });
    const parsed = frameInput.safeParse(await readJson(request, 9 * 1024 * 1024));
    if (!parsed.success) throw new SimulatorError('invalid_frames');
    const result = await db.rpc('claim_simulator_analysis', { p_user_id: userId, p_review_id: params.id });
    if (result.error) throw databaseError(result.error);
    if (!result.data) throw new SimulatorError('analysis_busy', 409);
    claimed = true;
    const report = await analyzeReview(review, parsed.data);
    await updateReview(db, userId, params.id, { status: 'completed', report, error_code: null });
    return json({ review: { ...review, report, status: 'completed' } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const error = err instanceof AiServiceError ? new SimulatorError(err.code === 'missing_api_key' ? 'ai_unavailable' : 'analysis_failed', err.status) : err;
    if (claimed && current) await updateReview(current.db, current.userId, params.id, {
      status: 'failed', error_code: error instanceof SimulatorError ? error.code : 'analysis_failed'
    }).catch(() => {});
    return failure(error);
  }
};
