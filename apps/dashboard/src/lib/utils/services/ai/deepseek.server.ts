import {
  createAiChatCompletion,
  AiServiceError,
  type AiMessage
} from './provider.server';

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

export async function createDeepSeekChatCompletion(
  messages: DeepSeekMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  try {
    const reply = await createAiChatCompletion(messages as AiMessage[], {
      provider: 'deepseek',
      maxTokens: options.maxTokens ?? 800,
      temperature: options.temperature ?? 0.5
    });
    return reply;
  } catch (err) {
    if (err instanceof AiServiceError) {
      const codeMap: Record<string, DeepSeekErrorCode> = {
        missing_api_key: 'missing_deepseek_key',
        upstream_error: 'upstream_error',
        unexpected_response: 'unexpected_response'
      };
      const mappedCode = codeMap[err.code] ?? 'upstream_error';
      throw new DeepSeekError(mappedCode, err.message, err.status);
    }
    throw new DeepSeekError('upstream_error', 'AI service temporarily unavailable', 502);
  }
}
