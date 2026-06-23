import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
  createDeepSeekChatCompletion,
  DeepSeekError,
  type DeepSeekMessage
} from '$lib/utils/services/ai/deepseek.server';

const SYSTEM_PROMPT = `You are an official AI assistant for ailaeclass, a learning platform developed by 5G nuMultiMedia Limited (5GNU).

Your knowledge is STRICTLY LIMITED to the following topics:
1. 5G nuMultiMedia Limited (5GNU) company information
2. ailaeclass platform features and usage
3. Low-altitude economy (drone technology, 5G-A live streaming, STEM/STEAM education)
4. Hong Kong Cyberport and Hong Kong Science Park
5. AOPA drone certification and training programs

Company facts:
- Full name: 5代新多媒体有限公司 / 5G nuMultiMedia Limited
- Founded: 2020, Reg No: 2977513 (Hong Kong)
- HQ: 608-613, Core C, Cyberport 3, 100 Cyberport Road, Hong Kong
- CEO: Alan (veteran IT innovator, former Hong Kong Governor's Industrial Award winner)
- Strategic investor: Piece Future Pte Ltd (Singapore)
- Selected for Hong Kong's first "Low-Altitude Economy Regulatory Sandbox" pilot (March 2025)
- AOPA China-certified exclusive examination center in Hong Kong & Macau
- World's first 5G-A drone live broadcast technology
- Core business: 5G drone solutions, STEM/STEAM education, low-altitude economy
- Vision: Build Hong Kong as "International Drone XR MultiMedia Edu City"

If the user asks about anything outside these topics, politely refuse and say:
"Sorry, I can only answer questions related to 5G nuMultiMedia, ailaeclass, and our low-altitude economy services."

Keep responses concise (under 150 words) and professional.`;

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return json({ error: 'Message is required', code: 'invalid_request' }, { status: 400 });
    }

    const messages: DeepSeekMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message }
    ];
    const reply = await createDeepSeekChatCompletion(messages, {
      maxTokens: 512,
      temperature: 0.7
    });

    return json({ reply });
  } catch (err) {
    if (err instanceof DeepSeekError) {
      return json({ error: err.message, code: err.code }, { status: err.status });
    }

    console.error('Chat endpoint error:', err);
    return json(
      { error: 'Internal error', code: 'internal_error' },
      { status: 500 }
    );
  }
};
