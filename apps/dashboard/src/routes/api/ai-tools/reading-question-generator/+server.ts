import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import {
  createAiChatCompletion,
  AiServiceError,
  parseAiJson,
  jsonError
} from '$lib/utils/services/ai/provider.server';

const MAX_INPUT_LENGTH = 6000;

interface MultipleChoiceQuestion {
  question: string;
  options: string[];
  answer: string;
}

interface OpenQuestion {
  question: string;
  suggestedAnswer: string;
}

interface ReadingQuestionGeneratorResponse {
  multipleChoice: MultipleChoiceQuestion[];
  openQuestions: OpenQuestion[];
  keywords: string[];
  answerKey: string[];
}

const SYSTEM_PROMPT = `You are a helpful reading comprehension question generator for Hong Kong primary and junior secondary students.

The user will provide a reading passage. Generate:
- multipleChoice: 3-5 multiple choice questions with 4 options each and the correct answer letter
- openQuestions: 2-3 open-ended questions with a suggested answer
- keywords: 5-8 important vocabulary or keywords from the passage
- answerKey: a concise answer key for all questions

Rules:
- Questions should be age-appropriate for the given grade level.
- Use the same language as the passage (Chinese or English).
- Do not use Markdown formatting.
- Respond ONLY with valid JSON in this exact shape:
{
  "multipleChoice": [
    { "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A" }
  ],
  "openQuestions": [
    { "question": "...", "suggestedAnswer": "..." }
  ],
  "keywords": ["..."],
  "answerKey": ["..."]
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
    const passage = typeof payload.passage === 'string' ? payload.passage.trim() : '';
    const grade = typeof payload.grade === 'string' ? payload.grade.trim() : '';
    const questionCount = typeof payload.questionCount === 'number' ? payload.questionCount : 5;

    if (!passage) {
      return jsonError('Passage is required', 'invalid_request', 400);
    }

    if (passage.length > MAX_INPUT_LENGTH) {
      return jsonError('Passage is too long', 'message_too_long', 400);
    }

    const userPrompt = [
      grade ? `Grade level: ${grade}` : '',
      `Number of questions: approximately ${questionCount}`,
      'Passage:\n' + passage
    ]
      .filter(Boolean)
      .join('\n\n');

    const reply = await createAiChatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens: 1600, temperature: 0.5, responseFormat: { type: 'json_object' } }
    );

    const parsed = parseAiJson<ReadingQuestionGeneratorResponse>(reply);

    if (!Array.isArray(parsed.multipleChoice) || !Array.isArray(parsed.openQuestions)) {
      return jsonError('Unexpected AI response format', 'unexpected_response', 502);
    }

    return json(parsed);
  } catch (err) {
    if (err instanceof AiServiceError) {
      return jsonError(err.message, err.code, err.status);
    }
    console.error('Reading question generator endpoint failed:', err instanceof Error ? err.message : 'unknown');
    return jsonError('Internal error', 'internal_error', 500);
  }
};
