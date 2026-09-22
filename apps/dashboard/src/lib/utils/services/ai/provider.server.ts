import { env } from '$env/dynamic/private';

export type AiRole = 'system' | 'user' | 'assistant';
export interface AiMessage { role: AiRole; content: string; }
export type AiProvider = 'kimi' | 'moonshot';
export type AiErrorCode =
  | 'missing_api_key' | 'upstream_error' | 'unexpected_response' | 'json_parse_error'
  | 'invalid_request' | 'message_too_long' | 'unauthenticated' | 'internal_error';

export class AiServiceError extends Error {
  constructor(public code: AiErrorCode, message: string, public status: number, public details?: string) {
    super(message);
    this.name = 'AiServiceError';
  }
}

function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/** Moonshot is Kimi's API name, not a fallback to a different vendor. */
export function kimiConfig(vision = false) {
  return {
    baseUrl: (env.PRIVATE_KIMI_BASE_URL?.trim() || env.PRIVATE_MOONSHOT_BASE_URL?.trim() || 'https://api.moonshot.cn/v1').replace(/\/+$/, ''),
    model: (vision ? env.PRIVATE_KIMI_VISION_MODEL?.trim() : '') || env.PRIVATE_KIMI_MODEL?.trim() || 'kimi-k2.5',
    apiKey: env.PRIVATE_KIMI_API_KEY?.trim() || env.PRIVATE_MOONSHOT_API_KEY?.trim()
  };
}

export function pickProvider(_preferred?: AiProvider): AiProvider { return 'kimi'; }

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
type KimiMessage = { role: AiRole; content: string | ContentPart[] };

export async function requestKimiCompletion(
  messages: KimiMessage[],
  options: {
    maxTokens?: number; temperature?: number; responseFormat?: { type: 'json_object' };
    signal?: AbortSignal; timeoutMs?: number; vision?: boolean;
  } = {}
): Promise<string> {
  const config = kimiConfig(options.vision);
  if (!config.apiKey) throw new AiServiceError('missing_api_key', 'Kimi service is not configured', 503);
  // Keep per-feature budgets (chatbot 256, Agent 1400) instead of clipping all to 700.
  const maxTokens = Math.floor(Math.min(4096, Math.max(1,
    positiveNumber(options.maxTokens, positiveNumber(env.PRIVATE_AI_MAX_TOKENS, 700)))));
  const instant = /^(?:kimi-k(?:2\.[5-9]|[3-9])|kimi-for-coding|k[3-9])/i.test(config.model);
  const body = {
    model: config.model, messages, max_tokens: maxTokens,
    temperature: instant ? 0.6 : (options.temperature ?? 0.5),
    ...(instant ? { thinking: { type: 'disabled' } } : {})
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), positiveNumber(options.timeoutMs, 90_000));
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const send = (jsonMode: boolean) => fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST', signal, redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, 'User-Agent': 'AiLAEClass/1.0' },
    body: JSON.stringify({ ...body, ...(jsonMode && options.responseFormat ? { response_format: options.responseFormat } : {}) })
  });
  try {
    let response = await send(Boolean(options.responseFormat));
    // Retry only a specifically unsupported JSON-format parameter, never auth/quota failures.
    if (!response.ok && options.responseFormat && [400, 422].includes(response.status)) {
      const error = await response.clone().json().catch(() => ({}));
      if (/response_format/i.test(String(error?.error?.message || '')) &&
          /unsupported|not supported|unknown|unrecognized/i.test(String(error?.error?.message || ''))) {
        await response.body?.cancel();
        response = await send(false);
      }
    }
    if (!response.ok) {
      console.error(JSON.stringify({ event: 'kimi_request_failed', status: response.status, model: config.model }));
      await response.body?.cancel();
      throw new AiServiceError('upstream_error', 'Kimi service temporarily unavailable', response.status === 429 ? 429 : 502);
    }
    const data = await response.json().catch(() => { throw new AiServiceError('unexpected_response', 'Kimi returned invalid JSON', 502); });
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) throw new AiServiceError('unexpected_response', 'Kimi returned an empty response', 502);
    return reply;
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    throw new AiServiceError('upstream_error', signal.aborted ? 'Kimi request timed out or was cancelled' : 'Kimi request failed', signal.aborted ? 504 : 502);
  } finally { clearTimeout(timer); }
}

export async function createAiChatCompletion(
  messages: AiMessage[],
  options: { provider?: AiProvider; maxTokens?: number; temperature?: number; responseFormat?: { type: 'json_object' }; signal?: AbortSignal } = {}
): Promise<string> {
  return requestKimiCompletion(messages, options);
}

export function extractJsonFromReply(reply: string): string {
  const trimmed = reply.trim();

  // If the reply is already a clean JSON object/array, return it
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  // Try to extract JSON from markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith('{') || inner.startsWith('[')) {
      return inner;
    }
  }

  // Try to find the first { or [ and last } or ]
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  const start = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);

  if (start === -1) {
    throw new AiServiceError('json_parse_error', 'AI response did not contain valid JSON', 502);
  }

  const lastBrace = trimmed.lastIndexOf('}');
  const lastBracket = trimmed.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);

  if (end === -1 || end <= start) {
    throw new AiServiceError('json_parse_error', 'AI response did not contain valid JSON', 502);
  }

  return trimmed.slice(start, end + 1);
}

export function parseAiJson<T>(reply: string): T {
  const jsonString = extractJsonFromReply(reply);
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    throw new AiServiceError('json_parse_error', 'AI response contained invalid JSON', 502);
  }
}

export function jsonError(error: string, code: AiErrorCode, status: number, details?: string) {
  return new Response(JSON.stringify({ error, code, ...(details ? { details } : {}) }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function normalizeAiText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim())
    .trim();
}

export function normalizeAiStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string').map(normalizeAiText);
}
