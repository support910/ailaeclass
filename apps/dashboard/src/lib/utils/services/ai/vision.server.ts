import { kimiConfig, requestKimiCompletion } from './provider.server';

export type AiVisionProvider = 'kimi' | 'moonshot';
export interface VisionImage { dataUrl: string; }
export function pickVisionProvider(_preferred?: AiVisionProvider): AiVisionProvider { return 'kimi'; }

export function describeVisionProvider() {
  const config = kimiConfig(true);
  return { provider: 'kimi', model: config.model, configured: Boolean(config.apiKey) };
}

/** Screenshots and sampled video frames use the same Kimi account as text analysis. */
export async function createAiVisionCompletion(
  systemPrompt: string, userPrompt: string, images: VisionImage[],
  options: { provider?: AiVisionProvider; maxTokens?: number; temperature?: number; timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<string> {
  return requestKimiCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: [
      { type: 'text', text: userPrompt },
      ...images.map(image => ({ type: 'image_url' as const, image_url: { url: image.dataUrl } }))
    ] }
  ], { ...options, vision: true, maxTokens: options.maxTokens ?? 1800, responseFormat: { type: 'json_object' } });
}
