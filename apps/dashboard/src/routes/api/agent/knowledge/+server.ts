import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getKnowledgeStats, searchChunks } from '$lib/server/agent/knowledgeLoader.server';

export const GET: RequestHandler = async () => {
  return json(getKnowledgeStats());
};

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body', code: 'invalid_request' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const query = typeof payload.query === 'string' ? payload.query.trim() : '';

  if (!query) {
    return json({ results: [], query });
  }

  return json({
    query,
    results: searchChunks(query, 10)
  });
};
