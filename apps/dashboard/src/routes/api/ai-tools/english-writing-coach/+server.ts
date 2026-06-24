import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import {
  createAiChatCompletion,
  AiServiceError,
  parseAiJson,
  jsonError
} from '$lib/utils/services/ai/provider.server';

const MAX_INPUT_LENGTH = 4000;

interface GrammarCorrection {
  originalSentence: string;
  issue: string;
  suggestion: string;
}

interface VocabularyUpgrade {
  original: string;
  upgrade: string;
  reason: string;
}

interface SentenceSuggestion {
  originalPattern: string;
  suggestedPattern: string;
  benefit: string;
}

interface WritingCoachResponse {
  overallFeedback: string;
  corrections: GrammarCorrection[];
  vocabularyUpgrades: VocabularyUpgrade[];
  sentenceSuggestions: SentenceSuggestion[];
  priorities: string[];
  nextRevisionTask: string;
}

const SYSTEM_PROMPT = `You are a patient English writing coach for Hong Kong primary and junior secondary students.

IMPORTANT RULES:
- Do NOT rewrite the whole essay for the student.
- Give corrections, suggestions, and a next revision task only.
- Keep the tone encouraging and specific.
- Write explanations and feedback in the requested output language.
- Do not use Markdown formatting such as **bold** or headings.
- Respond ONLY with valid JSON in this exact shape:
{
  "overallFeedback": "short encouraging summary",
  "corrections": [
    { "originalSentence": "...", "issue": "...", "suggestion": "..." }
  ],
  "vocabularyUpgrades": [
    { "original": "...", "upgrade": "...", "reason": "..." }
  ],
  "sentenceSuggestions": [
    { "originalPattern": "...", "suggestedPattern": "...", "benefit": "..." }
  ],
  "priorities": ["first priority", "second priority", "third priority"],
  "nextRevisionTask": "specific task the student should do next"
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
    const essay = typeof payload.essay === 'string' ? payload.essay.trim() : '';
    const grade = typeof payload.grade === 'string' ? payload.grade.trim() : '';
    const focus = typeof payload.focus === 'string' ? payload.focus.trim() : '';
    const outputLanguage =
      typeof payload.outputLanguage === 'string' ? payload.outputLanguage.trim() : 'Traditional Chinese';

    if (!essay) {
      return jsonError('Essay is required', 'invalid_request', 400);
    }

    if (essay.length > MAX_INPUT_LENGTH) {
      return jsonError('Essay is too long', 'message_too_long', 400);
    }

    const userPrompt = [
      `Output language: ${outputLanguage}`,
      grade ? `Grade level: ${grade}` : '',
      focus ? `Focus area: ${focus}` : '',
      'Essay:',
      essay
    ]
      .filter(Boolean)
      .join('\n');

    const reply = await createAiChatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      { maxTokens: 1400, temperature: 0.5, responseFormat: { type: 'json_object' } }
    );

    const parsed = parseAiJson<WritingCoachResponse>(reply);

    if (!Array.isArray(parsed.corrections)) {
      return jsonError('Unexpected AI response format', 'unexpected_response', 502);
    }

    return json(parsed);
  } catch (err) {
    if (err instanceof AiServiceError) {
      return jsonError(err.message, err.code, err.status);
    }
    console.error('English writing coach endpoint failed:', err instanceof Error ? err.message : 'unknown');
    return jsonError('Internal error', 'internal_error', 500);
  }
};
