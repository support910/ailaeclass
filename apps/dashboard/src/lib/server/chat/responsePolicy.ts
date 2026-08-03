export const CHATBOT_LIMITS = { chineseChars: 180, words: 100, maxTokens: 256 } as const;
export const AGENT_LIMITS = { chineseChars: 1400, words: 700, maxTokens: 1400 } as const;

const COMPLEX_TERMS = [
  '详细分析', '深入分析', '逐步', '完整方案', '架构', '排查', '法规', '法律', '风险评估',
  '比较', '对比', '为什么', '飞行计划', '空域', '故障', '合规', '安全程序',
  'step by step', 'in depth', 'detailed analysis', 'architecture', 'troubleshoot',
  'regulation', 'compliance', 'risk assessment', 'compare'
];

export function isChineseText(text: string) {
  return /[\u3400-\u9fff]/u.test(text);
}

export function isComplexChatQuestion(text: string) {
  const normalized = text.trim().toLowerCase();
  const questionMarks = (normalized.match(/[?？]/g) || []).length;
  const conjunctions = (normalized.match(/以及|并且|同时|另外|and |also |then /g) || []).length;

  return (
    normalized.length > 180 ||
    questionMarks >= 2 ||
    conjunctions >= 3 ||
    COMPLEX_TERMS.some((term) => normalized.includes(term))
  );
}

function truncateByWords(text: string, limit: number) {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(' ')}...`;
}

function truncateByChars(text: string, limit: number) {
  const chars = Array.from(text.trim());
  if (chars.length <= limit) return text.trim();
  const suffix = '...';
  return `${chars.slice(0, Math.max(0, limit - suffix.length)).join('')}${suffix}`;
}

export function limitReply(text: string, limits: { chineseChars: number; words: number }) {
  return isChineseText(text)
    ? truncateByChars(text, limits.chineseChars)
    : truncateByWords(text, limits.words);
}

export const limitChatbotReply = (text: string) => limitReply(text, CHATBOT_LIMITS);
export const limitAgentReply = (text: string) => limitReply(text, AGENT_LIMITS);
