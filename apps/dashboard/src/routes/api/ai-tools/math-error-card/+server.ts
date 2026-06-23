import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import {
  createAiChatCompletion,
  AiServiceError,
  parseAiJson,
  jsonError
} from '$lib/utils/services/ai/provider.server';

const MAX_INPUT_LENGTH = 3000;

interface MathErrorCardResponse {
  mistakeSummary: string;
  wrongStep: string;
  correctStep: string;
  concept: string;
  similarQuestion: string;
  similarAnswer: string;
}

const SYSTEM_PROMPT = `You are a patient math tutor for Hong Kong primary and junior secondary students.

The user will provide a math question and the student's wrong answer or working steps. Your job is to:
1. Summarize where the thinking went wrong.
2. Identify the exact wrong step.
3. Explain the correct next step.
4. Teach the short concept involved.
5. Generate one similar practice question.
6. Provide the answer to the similar question (hidden from the student until they try).

Rules:
- Be encouraging. Do not shame the student.
- Use simple language suitable for the grade level.
- Do not use Markdown formatting.
- Respond ONLY with valid JSON in this exact shape:
{
  "mistakeSummary": "...",
  "wrongStep": "...",
  "correctStep": "...",
  "concept": "...",
  "similarQuestion": "...",
  "similarAnswer": "..."
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
    const question = typeof payload.question === 'string' ? payload.question.trim() : '';
    const studentAnswer = typeof payload.studentAnswer === 'string' ? payload.studentAnswer.trim() : '';
    const workingSteps = typeof payload.workingSteps === 'string' ? payload.workingSteps.trim() : '';
    const grade = typeof payload.grade === 'string' ? payload.grade.trim() : '';

    if (!question || !studentAnswer) {
      return jsonError('Question and student answer are required', 'invalid_request', 400);
    }

    const combinedInput = [question, studentAnswer, workingSteps].filter(Boolean).join('\n');
    if (combinedInput.length > MAX_INPUT_LENGTH) {
      return jsonError('Input is too long', 'message_too_long', 400);
    }

    const userPrompt = [
      grade ? `Grade level: ${grade}` : '',
      `Question:\n${question}`,
      `Student's answer:\n${studentAnswer}`,
      workingSteps ? `Student's working steps:\n${workingSteps}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    const reply = await createAiChatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens: 1200, temperature: 0.5, responseFormat: { type: 'json_object' } }
    );

    const parsed = parseAiJson<MathErrorCardResponse>(reply);

    if (!parsed.mistakeSummary || !parsed.similarQuestion) {
      return jsonError('Unexpected AI response format', 'unexpected_response', 502);
    }

    return json(parsed);
  } catch (err) {
    if (err instanceof AiServiceError) {
      return jsonError(err.message, err.code, err.status);
    }
    console.error('Math error card endpoint failed:', err instanceof Error ? err.message : 'unknown');
    return jsonError('Internal error', 'internal_error', 500);
  }
};
