import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import {
  createDeepSeekChatCompletion,
  DeepSeekError,
  type DeepSeekMessage
} from '$lib/utils/services/ai/deepseek.server';
import {
  hasAgentKnowledgeIntent,
  searchChunksScored
} from '$lib/server/agent/knowledgeLoader.server';
import { webSearch } from '$lib/server/agent/webSearch.server';

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_ITEMS = 8;
const MAX_HISTORY_CONTENT_LENGTH = 1500;
const KNOWLEDGE_THRESHOLD = 3;
const MAX_KNOWLEDGE_CHARS = 6000;

const AGENT_SYSTEM_PROMPT = `You are the ailaeclass Agent, a Chinese-first classroom assistant focused on drone aviation knowledge.

You help teachers and students with questions about drone regulations, flight operations, airspace rules, safety procedures, and aviation theory.

Rules:
1. Answer in Chinese unless the user writes in another language.
2. Do not write citations, source filenames, page numbers, or source lists in the answer body. The application displays sources separately below the answer.
3. If the provided knowledge context does not contain enough information to answer confidently, say so clearly and do not invent facts.
4. If the user asks something unrelated to drone aviation, drone operations, airspace, aviation weather, or formation flight, politely explain that ailaeclass Agent focuses on drone aviation learning.
5. Keep answers concise, accurate, and classroom-appropriate.
6. Do not ask for unnecessary personal information.
7. Do not help with unsafe or illegal activities.
8. Do not use Markdown formatting such as **bold**, headings, bullet symbols, or code blocks. Write clean plain text that can be displayed directly in the chat UI.`;

function jsonError(error: string, code: string, status: number) {
  return json({ error, code }, { status });
}

function sanitizeHistory(history: unknown): ChatHistoryItem[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item): item is ChatHistoryItem => {
      if (!item || typeof item !== 'object') return false;
      const value = item as Record<string, unknown>;
      return (
        (value.role === 'user' || value.role === 'assistant') &&
        typeof value.content === 'string' &&
        value.content.trim().length > 0
      );
    })
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_HISTORY_CONTENT_LENGTH)
    }));
}

function buildKnowledgeContext(results: { chunk: { source: string; page: number | null; text: string }; score: number }[]): {
  context: string;
  sources: { source: string; page: number | null; score: number }[];
  maxScore: number;
  fromKnowledgeBase: boolean;
} {
  if (results.length === 0) {
    return { context: '', sources: [], maxScore: 0, fromKnowledgeBase: false };
  }

  const maxScore = results[0].score;
  const fromKnowledgeBase = maxScore >= KNOWLEDGE_THRESHOLD;

  const seenSources = new Set<string>();
  const sources = results
    .map((r) => ({
      source: r.chunk.source,
      page: r.chunk.page,
      score: Number(r.score.toFixed(4))
    }))
    .filter((source) => {
      const key = `${source.source}::${source.page ?? ''}`;
      if (seenSources.has(key)) return false;
      seenSources.add(key);
      return true;
    });

  let context = '';
  let usedChars = 0;
  for (const r of results) {
    const snippet = `【来源: ${r.chunk.source}${r.chunk.page !== null ? `, 第${r.chunk.page}页` : ''}】\n${r.chunk.text}\n\n`;
    if (usedChars + snippet.length > MAX_KNOWLEDGE_CHARS) break;
    context += snippet;
    usedChars += snippet.length;
  }

  return { context, sources, maxScore, fromKnowledgeBase };
}

function stripInlineSourceFooter(reply: string) {
  return reply
    .replace(/\n?\s*[（(]\s*来源\s*[:：][\s\S]*?[）)]\s*$/u, '')
    .replace(/\n?\s*来源\s*[:：][\s\S]*$/u, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .trim();
}

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
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';

    if (!message) {
      return jsonError('Message is required', 'invalid_request', 400);
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonError('Message is too long', 'message_too_long', 400);
    }

    const history = sanitizeHistory(payload.history);

    const scoredResults = searchChunksScored(message, 8);
    const knowledge = buildKnowledgeContext(scoredResults);
    const isAgentKnowledgeQuestion = hasAgentKnowledgeIntent(message);
    const fromKnowledgeBase =
      isAgentKnowledgeQuestion && knowledge.maxScore >= KNOWLEDGE_THRESHOLD;
    const sources = fromKnowledgeBase ? knowledge.sources : [];

    let systemContent = AGENT_SYSTEM_PROMPT;
    if (fromKnowledgeBase && knowledge.context) {
      systemContent += `\n\n以下是与用户问题相关的知识库片段，请优先依据这些内容回答：\n\n${knowledge.context}`;
    }

    let webResults: Awaited<ReturnType<typeof webSearch>> = [];

    if (isAgentKnowledgeQuestion && !fromKnowledgeBase) {
      try {
        webResults = await webSearch(message, 3);
        if (webResults.length > 0) {
          const webContext = webResults
            .map((r, i) => `【网络来源 ${i + 1}: ${r.title}】\n${r.snippet}\nURL: ${r.url}\n`)
            .join('\n');
          systemContent += `\n\n知识库未提供足够信息。以下是实时网络搜索结果，仅供参考并注明来源：\n\n${webContext}`;
        }
      } catch {
        // Silently ignore web search failures
      }
    }

    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemContent },
      ...history,
      { role: 'user', content: message }
    ];

    const reply = stripInlineSourceFooter(await createDeepSeekChatCompletion(messages));

    return json({
      reply,
      sources,
      webResults,
      fromKnowledgeBase,
      maxScore: knowledge.maxScore
    });
  } catch (err) {
    if (err instanceof DeepSeekError) {
      return jsonError(err.message, err.code, err.status);
    }

    console.error('Agent chat endpoint failed:', err instanceof Error ? err.message : 'unknown');
    return jsonError('Internal error', 'internal_error', 500);
  }
};
