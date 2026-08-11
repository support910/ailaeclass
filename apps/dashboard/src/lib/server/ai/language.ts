/**
 * Turns the interface locale into an explicit instruction for the assistants.
 *
 * The platform offers seven languages. Telling the model only "reply in the same
 * language the user uses" is not enough: a student on an English interface who
 * types a Chinese place name would get a whole Chinese answer back. The switcher
 * at the top right decides, and only an unmistakable switch by the user overrides it.
 */

export const SUPPORTED_LOCALES = ['zh', 'zh-TW', 'en', 'hi', 'ms', 'id', 'th'] as const;

const LANGUAGE_NAME: Record<string, string> = {
  zh: '简体中文',
  'zh-TW': '繁體中文（香港/台灣用語）',
  en: 'English',
  hi: 'हिन्दी (Hindi)',
  ms: 'Bahasa Melayu',
  id: 'Bahasa Indonesia',
  th: 'ไทย (Thai)'
};

export function normalizeLocale(raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) return 'zh-TW';
  if (SUPPORTED_LOCALES.includes(value as any)) return value;
  const lower = value.toLowerCase();
  if (lower === 'zh-hans' || lower.startsWith('zh-cn')) return 'zh';
  if (lower.startsWith('zh')) return 'zh-TW';
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('hi')) return 'hi';
  if (lower.startsWith('ms')) return 'ms';
  if (lower.startsWith('id')) return 'id';
  if (lower.startsWith('th')) return 'th';
  return 'zh-TW';
}

/**
 * Written in the target language, not about it. DeepSeek is a Chinese-first model
 * and a Chinese instruction sitting at the end of a Chinese prompt was not enough
 * to stop it answering English, Hindi, Malay and Indonesian questions in Chinese.
 * The caller puts this FIRST, before the company block, for the same reason.
 */
const DIRECTIVE: Record<string, string> = {
  zh: `【最优先规则 · 回答语言】
必须全程使用简体中文回答。使用简体字，不要输出繁体字。`,
  'zh-TW': `【最優先規則 · 回答語言】
必須全程使用繁體中文回答，採用香港／台灣用語。
必須使用繁體字，絕對不要輸出簡體字。例如寫「課程」不是「课程」，寫「學習」不是「学习」，寫「設定」不是「设置」。`,
  en: `[TOP PRIORITY RULE - RESPONSE LANGUAGE]
You MUST write your entire answer in English. Every sentence, every explanation, every term.
Do NOT answer in Chinese. Do NOT mix Chinese sentences into an English answer.
If a Chinese product term appears, give the English name and put the Chinese in brackets once.`,
  hi: `[सर्वोच्च प्राथमिकता नियम - उत्तर की भाषा]
आपको पूरा उत्तर हिन्दी में लिखना है। हर वाक्य, हर व्याख्या।
चीनी भाषा में उत्तर न दें। हिन्दी उत्तर में चीनी वाक्य न मिलाएँ।`,
  ms: `[PERATURAN KEUTAMAAN TERTINGGI - BAHASA JAWAPAN]
Anda MESTI menulis keseluruhan jawapan dalam Bahasa Melayu. Setiap ayat, setiap penjelasan.
JANGAN menjawab dalam bahasa Cina. JANGAN campurkan ayat Cina ke dalam jawapan Bahasa Melayu.`,
  id: `[ATURAN PRIORITAS TERTINGGI - BAHASA JAWABAN]
Anda HARUS menulis seluruh jawaban dalam Bahasa Indonesia. Setiap kalimat, setiap penjelasan.
JANGAN menjawab dalam bahasa Mandarin. JANGAN mencampur kalimat Mandarin ke dalam jawaban Bahasa Indonesia.`,
  th: `[กฎสำคัญที่สุด - ภาษาที่ใช้ตอบ]
คุณต้องเขียนคำตอบทั้งหมดเป็นภาษาไทย ทุกประโยค ทุกคำอธิบาย
ห้ามตอบเป็นภาษาจีน ห้ามผสมประโยคภาษาจีนลงในคำตอบภาษาไทย`
};

export function languageInstruction(rawLocale: unknown) {
  const locale = normalizeLocale(rawLocale);
  const name = LANGUAGE_NAME[locale] || LANGUAGE_NAME['zh-TW'];
  const directive = DIRECTIVE[locale] || DIRECTIVE['zh-TW'];

  return `${directive}

(Interface language: ${name}. Answer in this language even when the user's question
is written in another script — the language switcher decides, not the question.
Only switch if the user explicitly asks you to reply in a different language.)`;
}

/**
 * A short reminder pinned next to the user's turn.
 *
 * System-prompt directives alone were not enough for the locales DeepSeek is
 * weakest in: with a Thai interface and an English question it answered in Chinese
 * on every attempt, even though it answers Thai fine when the question itself is
 * Thai. A line adjacent to the user turn is the strongest available signal.
 * Chinese and English do not need it, so they do not pay for the extra tokens.
 */
const NUDGE: Record<string, string> = {
  hi: '(उत्तर केवल हिन्दी में दें।)',
  ms: '(Jawab dalam Bahasa Melayu sahaja.)',
  id: '(Jawab hanya dalam Bahasa Indonesia.)',
  th: '(ตอบเป็นภาษาไทยเท่านั้น ห้ามตอบเป็นภาษาจีน)'
};

export function languageNudge(rawLocale: unknown) {
  return NUDGE[normalizeLocale(rawLocale)] || '';
}

/**
 * Plain-text hygiene. The chat UI renders raw text, so anything the model adds
 * for "formatting" shows up literally as stray characters.
 */
export const PLAIN_TEXT_RULES = `【输出格式】
只输出纯文本。不要使用任何 Markdown 语法：不要 **粗体**、不要 ## 标题、不要 \`\`\` 代码围栏、
不要用 * 或 - 开头做列表符号、不要表格竖线。
需要分点时，直接用「1. 2. 3.」或「第一，第二」这样的自然写法。
不要输出 emoji，不要输出连续的符号分隔线（例如 --- 或 ===）。
不要在答案里出现 LaTeX、HTML 标签或占位符。`;

/**
 * Strip the formatting characters a model adds despite being told not to.
 * Belt and braces: the prompt asks, this guarantees.
 */
export function sanitizeAssistantText(input: string) {
  if (!input) return '';
  let text = String(input);

  // fenced code blocks -> keep the inner text
  text = text.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, '$1');
  text = text.replace(/`([^`\n]+)`/g, '$1');
  // bold / italic markers
  text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1');
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2');
  text = text.replace(/__([^_\n]+)__/g, '$1');
  // headings and quote markers at line start
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  text = text.replace(/^\s{0,3}>\s?/gm, '');
  // bullet markers at line start -> keep the content
  text = text.replace(/^\s{0,3}[*+-]\s+/gm, '');
  // horizontal rules on their own line
  text = text.replace(/^\s*([-*_=]\s*){3,}$/gm, '');
  // leftover markdown links -> "text (url)"
  text = text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1（$2）');
  // stray replacement characters and zero-width junk
  text = text.replace(/[�​-‍﻿]/g, '');
  // collapse the blank lines those removals leave behind
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
