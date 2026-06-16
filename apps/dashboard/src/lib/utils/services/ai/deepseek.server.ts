import { env } from '$env/dynamic/private';

export type DeepSeekRole = 'system' | 'user' | 'assistant';

export interface DeepSeekMessage {
  role: DeepSeekRole;
  content: string;
}

export type DeepSeekErrorCode =
  | 'missing_deepseek_key'
  | 'upstream_error'
  | 'unexpected_response';

export class DeepSeekError extends Error {
  code: DeepSeekErrorCode;
  status: number;

  constructor(code: DeepSeekErrorCode, message: string, status: number) {
    super(message);
    this.name = 'DeepSeekError';
    this.code = code;
    this.status = status;
  }
}

export async function createDeepSeekChatCompletion(messages: DeepSeekMessage[]): Promise<string> {
  const deepseekKey = env.PRIVATE_DEEPSEEK_API_KEY?.trim();

  if (!deepseekKey) {
    throw new DeepSeekError(
      'missing_deepseek_key',
      'AI service is not configured',
      503
    );
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: 800,
      temperature: 0.5
    })
  });

  if (!response.ok) {
    throw new DeepSeekError(
      'upstream_error',
      'AI service temporarily unavailable',
      502
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new DeepSeekError(
      'unexpected_response',
      'AI returned an unexpected response',
      502
    );
  }
  const deepseekData = data as {
    choices?: { message?: { content?: unknown } }[];
  };
  const reply = deepseekData.choices?.[0]?.message?.content;

  if (!reply || typeof reply !== 'string') {
    throw new DeepSeekError(
      'unexpected_response',
      'AI returned an unexpected response',
      502
    );
  }

  return reply;
}
