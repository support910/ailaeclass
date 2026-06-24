import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getUserIdFromRequest } from '$lib/utils/functions/supabase.server';
import {
  createDeepSeekChatCompletion,
  DeepSeekError,
  type DeepSeekMessage
} from '$lib/utils/services/ai/deepseek.server';

type LearningAssistantMode = 'guided' | 'direct';

interface LearningAssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface ArithmeticExpression {
  expression: string;
  numbers: number[];
  operators: Array<'+' | '-'>;
}

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_ITEMS = 8;
const MAX_HISTORY_CONTENT_LENGTH = 1500;

const BASE_SYSTEM_PROMPT = `You are the AI Learning Assistant inside ailaeclass.

You help students and teachers with multiple subjects, including math, Chinese language, English, science, humanities, and other school or study topics.

Always infer and use the student's likely language from their message and recent conversation when possible.
If the user appears to be a teacher, keep the answer suitable for classroom explanation, lesson preparation, or student guidance.
If the user appears to be a student, sound like a patient teacher or tutor, not like a rigid quiz bot.

Safety and privacy:
- Do not help with unsafe, harmful, cheating, harassment, or privacy-invasive requests.
- If the student includes excessive personal data or asks for personal-data-heavy processing, briefly refuse and redirect them to a safe learning-focused question.
- Do not ask for unnecessary personal information.

Output style:
- Use plain text only. Do not use Markdown formatting such as **bold**, headings, tables, or code fences, because the chat displays plain text.
- Prefer short paragraphs or simple numbered steps written without Markdown symbols.
- Keep the tone warm, specific, and natural for a student.

Mode rules:
- Guided mode: guide the learner step by step. Identify what is known, what is being asked, and the next thinking step. Give one clear question at a time. You may provide small hints, examples, or checks, but do not reveal the final answer unless the student explicitly asks for a direct answer or direct mode is selected.
- Direct mode: provide the final answer, concise reasoning, and one common mistake warning. When useful, add a short teacher-facing note about how to explain the key idea.

Guided teaching behavior:
- Read the recent conversation carefully. Distinguish between the student's final answer and the intermediate step you asked about.
- If the student answers incorrectly, do not only say "try again" or "think again". First acknowledge their effort, then explain the exact mistake in one or two sentences, give the correct result for the current small step when needed, teach the related key idea, and ask a smaller next question.
- If the student's answer is correct for the whole problem but not for the specific step you asked, say that clearly. Example: for "100 + 400 - 200", if you asked "100 + 400 equals what?" and the student replies "300", explain: "300 is the final result after subtracting 200, but the first step 100 + 400 is 500."
- If the student's message is an equation or statement with "=", treat it as something to check or correct. Teach that the equal sign means the left side and right side must have the same value.
- For a false simple equation, do not only ask the learner to calculate one side. Compute the two sides, say why they are not equal, teach the key idea, and ask the learner how to change one number or one side to make the equation true.
- Example for "1=5-3": explain that the right side is 2 while the left side is 1, so the equation is not true. Then ask: "If the right side is 2, what should the left side be?"
- For arithmetic, show place-value or number-line reasoning when helpful. Do not skip basic explanations for young learners.
- For language, English, science, and humanities, correct misconceptions gently, give a short relevant knowledge point, then ask the next targeted question.
- Keep each guided reply practical: 2-5 short sentences plus one clear next question. Avoid long lectures unless the student asks for explanation.
- When the learner is stuck twice on the same step, give a stronger hint or a tiny worked example before asking again.

Keep responses focused, age-appropriate, and useful for learning.`;

function buildSystemPrompt(mode: LearningAssistantMode, outputLanguage = 'Traditional Chinese') {
  const modeInstruction =
    mode === 'guided'
      ? 'Current mode: guided. Act as a warm step-by-step tutor. If the student made a mistake, explain why, give the correct result for that current step when helpful, and teach the relevant idea before asking one smaller next question. Do not provide the final answer immediately unless the student explicitly asks for it.'
      : 'Current mode: direct. Give the final answer first, then concise reasoning and a common mistake warning.';

  return `${BASE_SYSTEM_PROMPT}\n\n${modeInstruction}\n\nOutput language: ${outputLanguage}. Use this language unless the learner's question clearly requires another language for the learning task.`;
}

function jsonError(error: string, code: string, status: number) {
  return json({ error, code }, { status });
}

function normalizeTutorReply(reply: string) {
  return reply
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim())
    .trim();
}

function sanitizeHistory(history: unknown): LearningAssistantHistoryItem[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item): item is LearningAssistantHistoryItem => {
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

function parseArithmeticExpression(value: string): ArithmeticExpression | null {
  const expression = value.replace(/\s+/g, '');

  if (!/^\d+(?:[+-]\d+)+$/.test(expression)) {
    return null;
  }

  const numbers = expression.match(/\d+/g)?.map(Number) ?? [];
  const operators = (expression.match(/[+-]/g) ?? []) as Array<'+' | '-'>;

  if (numbers.length < 2 || operators.length !== numbers.length - 1) {
    return null;
  }

  return { expression, numbers, operators };
}

function parseSimpleEquation(value: string) {
  const expression = value.replace(/\s+/g, '');
  const parts = expression.split('=');

  if (parts.length !== 2) {
    return null;
  }

  const left = parseArithmeticExpression(parts[0]) ?? (/^\d+$/.test(parts[0]) ? {
    expression: parts[0],
    numbers: [Number(parts[0])],
    operators: []
  } : null);
  const right = parseArithmeticExpression(parts[1]) ?? (/^\d+$/.test(parts[1]) ? {
    expression: parts[1],
    numbers: [Number(parts[1])],
    operators: []
  } : null);

  if (!left || !right) {
    return null;
  }

  return { left, right };
}

function evaluateArithmetic(expression: ArithmeticExpression) {
  let value = expression.numbers[0];

  for (let index = 0; index < expression.operators.length; index += 1) {
    const operator = expression.operators[index];
    const nextNumber = expression.numbers[index + 1];
    value = operator === '+' ? value + nextNumber : value - nextNumber;
  }

  return value;
}

function getArithmeticStep(expression: ArithmeticExpression, stepIndex: number) {
  if (stepIndex < 0 || stepIndex >= expression.operators.length) {
    return null;
  }

  let left = expression.numbers[0];
  for (let index = 0; index < stepIndex; index += 1) {
    const operator = expression.operators[index];
    const nextNumber = expression.numbers[index + 1];
    left = operator === '+' ? left + nextNumber : left - nextNumber;
  }

  const operator = expression.operators[stepIndex];
  const right = expression.numbers[stepIndex + 1];
  const result = operator === '+' ? left + right : left - right;

  return { left, operator, right, result };
}

function formatOperation(left: number, operator: '+' | '-', right: number) {
  return `${left} ${operator} ${right}`;
}

function parseStudentNumber(value: string) {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  return Number(normalized);
}

function findLatestArithmeticExpression(history: LearningAssistantHistoryItem[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role !== 'user') continue;
    const parsed = parseArithmeticExpression(history[index].content);
    if (parsed) return parsed;
  }

  return null;
}

function findCurrentStepIndex(history: LearningAssistantHistoryItem[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role !== 'assistant') continue;
    const match = history[index].content.match(/第\s*(\d+)\s*步/);
    if (match) return Number(match[1]) - 1;
  }

  return 0;
}

function buildArithmeticStartReply(expression: ArithmeticExpression) {
  const step = getArithmeticStep(expression, 0);
  if (!step) return null;

  return [
    `我们一步一步来算：${expression.expression}。`,
    `第 1 步，先算 ${formatOperation(step.left, step.operator, step.right)}。`,
    `${formatOperation(step.left, step.operator, step.right)} 等于多少？`
  ].join('\n');
}

function buildArithmeticAnswerReply(expression: ArithmeticExpression, stepIndex: number, answer: number) {
  const step = getArithmeticStep(expression, stepIndex);
  if (!step) return null;

  const operation = formatOperation(step.left, step.operator, step.right);
  const isCorrect = answer === step.result;
  const nextStepIndex = stepIndex + 1;
  const nextStep = getArithmeticStep(expression, nextStepIndex);

  if (!isCorrect) {
    const explanation =
      step.operator === '+'
        ? `${operation} 是把 ${step.left} 和 ${step.right} 合起来，所以结果是 ${step.result}，不是 ${answer}。`
        : `${operation} 是从 ${step.left} 里拿走 ${step.right}，所以结果是 ${step.result}，不是 ${answer}。`;

    return [
      `这一步还不对，我们先把当前这一步弄清楚。`,
      explanation,
      `你先不用着急做下一步。请再回答一次当前这一步：${operation} 等于多少？`
    ].join('\n');
  }

  if (!nextStep) {
    return [
      `对，这一步是 ${operation} = ${step.result}。`,
      `已经没有下一步了，所以这道题的答案是 ${step.result}。`,
      `你可以自己检查一遍：每一步是不是都按从左到右的顺序算了？`
    ].join('\n');
  }

  return [
    `对，这一步是 ${operation} = ${step.result}。`,
    `接下来第 ${nextStepIndex + 1} 步，用刚才的结果继续算 ${formatOperation(nextStep.left, nextStep.operator, nextStep.right)}。`,
    `${formatOperation(nextStep.left, nextStep.operator, nextStep.right)} 等于多少？`
  ].join('\n');
}

function buildEquationReply(message: string) {
  const equation = parseSimpleEquation(message);
  if (!equation) return null;

  const leftValue = evaluateArithmetic(equation.left);
  const rightValue = evaluateArithmetic(equation.right);
  const isEqual = leftValue === rightValue;

  if (isEqual) {
    return [
      `我们先检查这个等式：${message.replace(/\s+/g, '')}。`,
      `等号的意思是左右两边的值要一样。左边是 ${leftValue}，右边也是 ${rightValue}。`,
      `所以这个等式是成立的。你能说说为什么等号两边一样大吗？`
    ].join('\n');
  }

  return [
    `我们先检查这个等式：${message.replace(/\s+/g, '')}。`,
    `等号的意思是左右两边的值要一样。左边是 ${leftValue}，右边是 ${rightValue}。`,
    `因为 ${leftValue} 和 ${rightValue} 不相等，所以这个等式不成立。`,
    `如果右边是 ${rightValue}，左边应该改成几，等式才成立？`
  ].join('\n');
}

function buildGuidedArithmeticReply(message: string, history: LearningAssistantHistoryItem[]) {
  const equationReply = buildEquationReply(message);
  if (equationReply) return equationReply;

  const currentExpression = parseArithmeticExpression(message);
  if (currentExpression) {
    return buildArithmeticStartReply(currentExpression);
  }

  const studentAnswer = parseStudentNumber(message);
  if (studentAnswer === null) return null;

  const expression = findLatestArithmeticExpression(history);
  if (!expression) return null;

  const stepIndex = findCurrentStepIndex(history);
  return buildArithmeticAnswerReply(expression, stepIndex, studentAnswer);
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
    const mode = payload.mode;
    const outputLanguage =
      typeof payload.outputLanguage === 'string' ? payload.outputLanguage.trim() : 'Traditional Chinese';

    if (!message) {
      return jsonError('Message is required', 'invalid_request', 400);
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonError('Message is too long', 'message_too_long', 400);
    }

    if (mode !== 'guided' && mode !== 'direct') {
      return jsonError('Mode must be guided or direct', 'invalid_mode', 400);
    }

    const history = sanitizeHistory(payload.history);

    if (mode === 'guided' && outputLanguage === 'Simplified Chinese') {
      const guidedArithmeticReply = buildGuidedArithmeticReply(message, history);
      if (guidedArithmeticReply) {
        return json({ reply: guidedArithmeticReply });
      }
    }

    const messages: DeepSeekMessage[] = [
      { role: 'system', content: buildSystemPrompt(mode, outputLanguage) },
      ...history,
      { role: 'user', content: message }
    ];

    const reply = normalizeTutorReply(await createDeepSeekChatCompletion(messages));

    return json({ reply });
  } catch (err) {
    if (err instanceof DeepSeekError) {
      return jsonError(err.message, err.code, err.status);
    }

    console.error('AI learning assistant endpoint failed:', err instanceof Error ? err.message : 'unknown');
    return jsonError('Internal error', 'internal_error', 500);
  }
};
