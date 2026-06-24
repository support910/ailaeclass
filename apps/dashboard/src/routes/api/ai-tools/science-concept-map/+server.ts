import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import {
  createAiChatCompletion,
  AiServiceError,
  parseAiJson,
  jsonError
} from '$lib/utils/services/ai/provider.server';

const MAX_INPUT_LENGTH = 2000;

interface ConceptNode {
  id: string;
  label: string;
  definition: string;
}

interface ConceptEdge {
  from: string;
  to: string;
  label: string;
}

interface QuizItem {
  question: string;
  answer: string;
}

interface ScienceConceptMapResponse {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  keywords: string[];
  misconceptions: string[];
  quiz: QuizItem[];
}

const SYSTEM_PROMPT = `You are a helpful science tutor for Hong Kong primary and junior secondary students.

The user will provide a science topic. Generate a concept map with:
- nodes: key concepts with short definitions
- edges: relationships between concepts
- keywords: important vocabulary
- misconceptions: common student misunderstandings
- quiz: 3-5 short quiz questions with answers

Rules:
- Use age-appropriate language for the given grade level.
- Use the requested output language. If no output language is provided, use the same language as the user's input.
- Do not use Markdown formatting.
- Respond ONLY with valid JSON in this exact shape:
{
  "nodes": [
    { "id": "1", "label": "...", "definition": "..." }
  ],
  "edges": [
    { "from": "1", "to": "2", "label": "..." }
  ],
  "keywords": ["..."],
  "misconceptions": ["..."],
  "quiz": [
    { "question": "...", "answer": "..." }
  ]
}`;

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return jsonError('Missing or invalid authentication token', 'unauthenticated', 401);
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 'invalid_request', 400);
    }

    if (!body || typeof body !== 'object') {
      return jsonError('Request body is required', 'invalid_request', 400);
    }

    const payload = body as Record<string, unknown>;
    const topic = typeof payload.topic === 'string' ? payload.topic.trim() : '';
    const grade = typeof payload.grade === 'string' ? payload.grade.trim() : '';
    const keywords = typeof payload.keywords === 'string' ? payload.keywords.trim() : '';
    const outputLanguage =
      typeof payload.outputLanguage === 'string' ? payload.outputLanguage.trim() : 'Traditional Chinese';

    if (!topic) {
      return jsonError('Topic is required', 'invalid_request', 400);
    }

    if (topic.length > MAX_INPUT_LENGTH) {
      return jsonError('Topic is too long', 'message_too_long', 400);
    }

    const userPrompt = [
      `Output language: ${outputLanguage}`,
      grade ? `Grade level: ${grade}` : '',
      `Topic: ${topic}`,
      keywords ? `Keywords to include: ${keywords}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    const reply = await createAiChatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens: 1400, temperature: 0.5, responseFormat: { type: 'json_object' } }
    );

    const parsed = parseAiJson<ScienceConceptMapResponse>(reply);

    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return jsonError('Unexpected AI response format', 'unexpected_response', 502);
    }

    return json(parsed);
  } catch (err) {
    if (err instanceof AiServiceError) {
      return jsonError(err.message, err.code, err.status);
    }
    console.error('Science concept map endpoint failed:', err instanceof Error ? err.message : 'unknown');
    return jsonError('Internal error', 'internal_error', 500);
  }
};
