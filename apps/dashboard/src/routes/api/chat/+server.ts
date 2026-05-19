import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

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
  const deepseekKey = env.PRIVATE_DEEPSEEK_API_KEY || '';

  if (!deepseekKey) {
    return json({ error: 'Chat service not configured' }, { status: 503 });
  }

  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return json({ error: 'Message is required' }, { status: 400 });
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message }
        ],
        max_tokens: 512,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', errorText);
      return json({ error: 'AI service temporarily unavailable' }, { status: 502 });
    }

    const data = await response.json();
    console.log('DeepSeek raw response:', JSON.stringify(data).slice(0, 500));

    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      console.error('Unexpected DeepSeek response structure:', data);
      return json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 502 });
    }

    return json({ reply });
  } catch (err) {
    console.error('Chat endpoint error:', err);
    return json({ error: 'Internal error' }, { status: 500 });
  }
};
