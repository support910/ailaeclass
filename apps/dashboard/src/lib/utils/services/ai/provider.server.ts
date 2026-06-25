import { env } from '$env/dynamic/private';
import { createHash } from 'node:crypto';

export type AiRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export type AiProvider = 'deepseek' | 'kimi' | 'moonshot';

export type AiErrorCode =
  | 'missing_api_key'
  | 'upstream_error'
  | 'unexpected_response'
  | 'json_parse_error'
  | 'invalid_request'
  | 'message_too_long'
  | 'unauthenticated'
  | 'internal_error';

export class AiServiceError extends Error {
  code: AiErrorCode;
  status: number;
  details?: string;

  constructor(code: AiErrorCode, message: string, status: number, details?: string) {
    super(message);
    this.name = 'AiServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ProviderConfig {
  baseUrl: string;
  model: string;
  keyEnvVars: string[];
  defaultModel: string;
}

function getNumberEnv(name: string, fallback: number) {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const DEFAULT_MAX_OUTPUT_TOKENS = clamp(
  getNumberEnv('PRIVATE_AI_MAX_TOKENS', getNumberEnv('PRIVATE_DEEPSEEK_MAX_TOKENS', 800)),
  128,
  1200
);

const PROVIDER_CONFIGS: Record<AiProvider, ProviderConfig> = {
  deepseek: {
    baseUrl: env.PRIVATE_DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com',
    model: env.PRIVATE_DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
    keyEnvVars: ['PRIVATE_DEEPSEEK_API_KEY'],
    defaultModel: 'deepseek-chat'
  },
  kimi: {
    baseUrl: env.PRIVATE_KIMI_BASE_URL?.trim() || 'https://api.moonshot.cn/v1',
    model: env.PRIVATE_KIMI_MODEL?.trim() || 'moonshot-v1-8k',
    keyEnvVars: ['PRIVATE_KIMI_API_KEY', 'PRIVATE_MOONSHOT_API_KEY'],
    defaultModel: 'moonshot-v1-8k'
  },
  moonshot: {
    baseUrl: env.PRIVATE_MOONSHOT_BASE_URL?.trim() || 'https://api.moonshot.cn/v1',
    model: env.PRIVATE_KIMI_MODEL?.trim() || 'moonshot-v1-8k',
    keyEnvVars: ['PRIVATE_MOONSHOT_API_KEY', 'PRIVATE_KIMI_API_KEY'],
    defaultModel: 'moonshot-v1-8k'
  }
};

function getProviderKey(provider: AiProvider): string | undefined {
  const config = PROVIDER_CONFIGS[provider];
  for (const envVar of config.keyEnvVars) {
    const value = env[envVar]?.trim();
    if (value) return value;
  }
  return undefined;
}

function getKeyFingerprint(apiKey: string) {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
}

export function pickProvider(preferred?: AiProvider): AiProvider {
  if (preferred) {
    const key = getProviderKey(preferred);
    if (key) return preferred;
  }
  const providers: AiProvider[] = ['deepseek', 'kimi', 'moonshot'];
  for (const p of providers) {
    if (getProviderKey(p)) return p;
  }
  return 'deepseek';
}

export async function createAiChatCompletion(
  messages: AiMessage[],
  options: {
    provider?: AiProvider;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: { type: 'json_object' };
  } = {}
): Promise<string> {
  const provider = pickProvider(options.provider);
  const config = PROVIDER_CONFIGS[provider];
  const apiKey = getProviderKey(provider);

  if (!apiKey) {
    throw new AiServiceError(
      'missing_api_key',
      'AI service is not configured',
      503
    );
  }

  const requestBody = {
    model: config.model,
    messages,
    max_tokens: Math.min(options.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS),
    temperature: options.temperature ?? 0.5
  };

  const requestHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };

  let response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      ...requestBody,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {})
    })
  });

  if (!response.ok) {
    let body = '';
    try {
      body = (await response.text()).slice(0, 800);
    } catch {
      body = 'Unable to read upstream error body';
    }

    console.error(JSON.stringify({
      event: 'ai_upstream_request_failed',
      provider,
      status: response.status,
      statusText: response.statusText,
      model: config.model,
      baseUrl: config.baseUrl,
      keyFingerprint: getKeyFingerprint(apiKey),
      body
    }));

    if (options.responseFormat) {
      response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.warn(JSON.stringify({
          event: 'ai_upstream_response_format_retry_succeeded',
          provider,
          model: config.model
        }));
      }
    }
  }

  if (!response.ok) {
    let body = '';
    try {
      body = (await response.text()).slice(0, 800);
    } catch {
      body = 'Unable to read upstream error body';
    }

    console.error(JSON.stringify({
      event: 'ai_upstream_request_failed_after_retry',
      provider,
      status: response.status,
      statusText: response.statusText,
      model: config.model,
      baseUrl: config.baseUrl,
      keyFingerprint: getKeyFingerprint(apiKey),
      body
    }));

    throw new AiServiceError(
      'upstream_error',
      'AI service temporarily unavailable',
      502,
      `provider=${provider}; status=${response.status}; key=${getKeyFingerprint(apiKey)}; body=${body}`
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AiServiceError(
      'unexpected_response',
      'AI returned an unexpected response',
      502
    );
  }

  const completionData = data as {
    choices?: { message?: { content?: unknown } }[];
  };
  const reply = completionData.choices?.[0]?.message?.content;

  if (!reply || typeof reply !== 'string') {
    throw new AiServiceError(
      'unexpected_response',
      'AI returned an unexpected response',
      502
    );
  }

  return reply;
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
