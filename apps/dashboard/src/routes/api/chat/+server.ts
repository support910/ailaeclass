import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
  createDeepSeekChatCompletion,
  DeepSeekError,
  type DeepSeekMessage
} from '$lib/utils/services/ai/deepseek.server';
import { normalizeAiText } from '$lib/utils/services/ai/provider.server';
import { PLATFORM_OPERATION_MANUAL } from '$lib/server/chat/manual';
import {
  hasAgentKnowledgeIntent,
  searchChunksScored
} from '$lib/server/agent/knowledgeLoader.server';
import { recordAnalyticsEvent } from '$lib/server/analytics/audit.server';
import { getUserIdFromRequest, getServerSupabase } from '$lib/utils/functions/supabase.server';
import { getOrgMembership } from '$lib/utils/functions/authz.server';
import {
  CHATBOT_LIMITS,
  isComplexChatQuestion,
  limitChatbotReply
} from '$lib/server/chat/responsePolicy';

const KNOWLEDGE_THRESHOLD = 3;
const MAX_KNOWLEDGE_CHARS = 4500;

const SYSTEM_PROMPT = `You are the built-in ailaeclass chat assistant.

You serve 管理端, 教师端, and 学生端 users. Answer in the same language the user uses, defaulting to clear Chinese for Chinese questions.

You can help with:
1. ailaeclass platform features and usage
2. 5G nuMultiMedia Limited (5GNU) company information, when it is covered by the facts below
3. Low-altitude economy, drone technology, 5G-A live streaming, STEM/STEAM education, and AOPA drone training
4. Simple learning support for students, including English word meanings, short grammar explanations, basic math/science concepts, and study guidance

Known 5GNU facts:
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

Platform operation manual:
${PLATFORM_OPERATION_MANUAL}

Important style rules:
- Use plain text only. Do not use Markdown formatting, bold markers, headings, code fences, or tables.
- Never output asterisks for emphasis.
- Be warm, concise, and useful. For student learning questions, explain simply and give 1 short example when helpful.
- The platform has only three sides: 管理端, 教师端, 学生端. Do not introduce other sides or role names.
- Do not over-refuse. If the user asks a normal learning question, answer it.
- If the user asks for private data, legal/medical/financial decisions, or unrelated harmful content, politely decline or give a safe general suggestion.
- If a user asks about 5GNU facts that are not listed above, say you are not sure and suggest checking official 5GNU/ailaeclass materials.

You are the quick-help assistant. Keep responses under 180 Chinese characters or 100 English words. For complex analysis, multi-step troubleshooting, regulations, or detailed aviation questions, give only a short orientation because the dedicated ailaeclass Agent provides the detailed answer.`;

function buildKnowledgeContext(message: string) {
  if (!hasAgentKnowledgeIntent(message)) return '';

  const results = searchChunksScored(message, 6);
  if (!results.length || results[0].score < KNOWLEDGE_THRESHOLD) return '';

  let context = '';
  for (const result of results) {
    const snippet = `【${result.chunk.source}${result.chunk.page !== null ? `，PDF第${result.chunk.page}页` : ''}】\n${result.chunk.text}\n\n`;
    if (context.length + snippet.length > MAX_KNOWLEDGE_CHARS) break;
    context += snippet;
  }

  return context.trim();
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { message, orgId } = await request.json();

    if (!message || typeof message !== 'string') {
      return json({ error: 'Message is required', code: 'invalid_request' }, { status: 400 });
    }

    const normalizedMessage = message.trim().slice(0, 2000);
    const escalate = isComplexChatQuestion(normalizedMessage);
    const knowledgeContext = buildKnowledgeContext(normalizedMessage);
    const systemPrompt = knowledgeContext
      ? `${SYSTEM_PROMPT}\n\nRelevant drone knowledge base excerpts, including newly added manuals. Answer from these excerpts when they address the question. Do not invent missing facts:\n\n${knowledgeContext}`
      : SYSTEM_PROMPT;

    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: normalizedMessage }
    ];
    const reply = await createDeepSeekChatCompletion(messages, {
      maxTokens: CHATBOT_LIMITS.maxTokens,
      temperature: 0.4
    });

    const limitedReply = limitChatbotReply(normalizeAiText(reply).replace(/\*/g, ''));
    const userId = await getUserIdFromRequest(request);
    let verifiedOrgId: string | null = null;
    if (userId && typeof orgId === 'string' && orgId) {
      const membership = await getOrgMembership(getServerSupabase(), orgId, userId);
      verifiedOrgId = membership ? orgId : null;
    }
    await recordAnalyticsEvent({
      organizationId: verifiedOrgId,
      actorProfileId: userId,
      category: 'ai',
      eventName: 'chatbot_query',
      entityType: 'assistant',
      entityId: 'chatbot',
      metadata: {
        escalated: escalate,
        replyLength: Array.from(limitedReply).length,
        responseLimit: CHATBOT_LIMITS.chineseChars
      }
    });

    return json({
      reply: limitedReply,
      escalate,
      responseLimit: CHATBOT_LIMITS
    });
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
