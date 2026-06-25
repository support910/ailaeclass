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

interface VocabularyItem {
  word: string;
  meaning: string;
  example: string;
  synonyms: string[];
  blankQuestion: string;
  answer: string;
}

interface VocabularyResponse {
  items: VocabularyItem[];
}

const SYSTEM_PROMPT = `You are a helpful Chinese language tutor for Hong Kong primary and junior secondary students.

The user will provide a list of Chinese vocabulary words. For each word, generate:
- meaning: a short, age-appropriate explanation in Chinese
- example: a simple example sentence in Chinese using the word
- synonyms: up to 2 near-synonyms in Chinese
- blankQuestion: a fill-in-the-blank question using the word
- answer: the correct word for the blank

Rules:
- Use the requested output language. If no output language is provided, use Traditional Chinese suitable for Hong Kong students.
- Keep sentences short and natural.
- Do not use Markdown formatting.
- Respond ONLY with valid JSON in this exact shape:
{
  "items": [
    {
      "word": "...",
      "meaning": "...",
      "example": "...",
      "synonyms": ["..."],
      "blankQuestion": "...",
      "answer": "..."
    }
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
    const words = typeof payload.words === 'string' ? payload.words.trim() : '';
    const grade = typeof payload.grade === 'string' ? payload.grade.trim() : '';
    const outputLanguage =
      typeof payload.outputLanguage === 'string' ? payload.outputLanguage.trim() : 'Traditional Chinese';

    if (!words) {
      return jsonError('Words are required', 'invalid_request', 400);
    }

    if (words.length > MAX_INPUT_LENGTH) {
      return jsonError('Input is too long', 'message_too_long', 400);
    }

    const userPrompt = grade
      ? `Output language: ${outputLanguage}\nGrade level: ${grade}\nWords:\n${words}`
      : `Output language: ${outputLanguage}\nWords:\n${words}`;

    const reply = await createAiChatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens: 1200, temperature: 0.5, responseFormat: { type: 'json_object' } }
    );

    const parsed = parseAiJson<VocabularyResponse>(reply);

    if (!Array.isArray(parsed.items)) {
      return jsonError('Unexpected AI response format', 'unexpected_response', 502);
    }

    return json({ items: parsed.items });
  } catch (err) {
    if (err instanceof AiServiceError) {
      const includeDetails = request.headers.get('x-ai-debug') === '1';
      return jsonError(err.message, err.code, err.status, includeDetails ? err.details : undefined);
    }
    console.error('Vocabulary practice endpoint failed:', err instanceof Error ? err.message : 'unknown');
    return jsonError('Internal error', 'internal_error', 500);
  }
};
