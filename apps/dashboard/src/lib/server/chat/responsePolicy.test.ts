import {
  isComplexChatQuestion,
  limitAgentReply,
  limitChatbotReply
} from './responsePolicy';

describe('AI response policy', () => {
  it('routes detailed or multi-part questions to the Agent', () => {
    expect(isComplexChatQuestion('请详细分析无人机空域法规和风险评估')).toBe(true);
    expect(isComplexChatQuestion('课程在哪里创建？')).toBe(false);
  });

  it('keeps chatbot replies shorter than agent replies', () => {
    const text = '测'.repeat(500);
    expect(Array.from(limitChatbotReply(text)).length).toBeLessThan(Array.from(limitAgentReply(text)).length);
  });
});
