/**
 * Helpers for deciding whether a student has actually answered a question.
 *
 * Why this exists: the question components (Radio / Checkbox / Textarea) submit
 * their answer wrapped in an array for objective types. Pressing "Next" submits
 * the form even when nothing is selected, so an untouched radio group arrives as
 * `[undefined]` (and JSON-serialises to `[null]`). The old inline check
 * (`v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)`) treated
 * any non-empty array — including `[undefined]` and `[null]` — as an answer, so
 * blank questions were shown as 已作答 and the "unanswered" counter never matched.
 */

function isEmptyScalar(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  );
}

/** True only when the value carries a real answer. */
export function isAnsweredValue(value: unknown): boolean {
  if (isEmptyScalar(value)) return false;

  if (Array.isArray(value)) return value.some((item) => !isEmptyScalar(item));

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.values(record).some((item) => isAnsweredValue(item));
  }

  return true;
}

/** Drop unanswered entries so counters, review lists and the submit payload stay clean. */
export function pruneUnanswered<T>(answers: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => isAnsweredValue(value)));
}
