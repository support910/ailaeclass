import { isAnsweredValue, pruneUnanswered } from './answers';

describe('answers.ts', () => {
  describe('isAnsweredValue', () => {
    test('treats an untouched radio group as unanswered', () => {
      // RadioQuestion used to submit [undefined] when no option was selected
      expect(isAnsweredValue([undefined])).toBe(false);
      // ...which becomes [null] once JSON-serialised
      expect(isAnsweredValue([null])).toBe(false);
    });

    test('treats an empty checkbox group as unanswered', () => {
      expect(isAnsweredValue([])).toBe(false);
    });

    test('treats blank text as unanswered', () => {
      expect(isAnsweredValue('')).toBe(false);
      expect(isAnsweredValue('   ')).toBe(false);
      expect(isAnsweredValue([''])).toBe(false);
      expect(isAnsweredValue(undefined)).toBe(false);
      expect(isAnsweredValue(null)).toBe(false);
    });

    test('recognises real answers', () => {
      expect(isAnsweredValue(['9882f7c3-e79b-4167-bf43-1d7cf44a3fd2'])).toBe(true);
      expect(isAnsweredValue(['a', 'b'])).toBe(true);
      expect(isAnsweredValue('9882f7c3')).toBe(true);
      expect(isAnsweredValue('my essay')).toBe(true);
      expect(isAnsweredValue(0)).toBe(true);
    });

    test('ignores an empty object answer', () => {
      expect(isAnsweredValue({})).toBe(false);
      expect(isAnsweredValue({ q1: 'a' })).toBe(true);
    });
  });

  describe('pruneUnanswered', () => {
    test('drops blank stubs and keeps real answers', () => {
      const answers = {
        q1: ['a'],
        q2: [undefined],
        q3: [],
        q4: '',
        q5: 'essay'
      };

      expect(pruneUnanswered(answers)).toEqual({ q1: ['a'], q5: 'essay' });
    });

    test('returns an empty object when nothing was answered', () => {
      expect(pruneUnanswered({ q1: [undefined], q2: [] })).toEqual({});
    });
  });
});
