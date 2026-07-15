# V7 Exam and Hindi Release - 2026-07-15

## Exam workflow

- Stabilized question and option image upload, immediate preview, persistence, and signed URL refresh.
- Kept question and option images visible in the teacher editor and student result review.
- Improved CSV/TSV import for up to 20 questions, including question image URLs, option image URLs, validation preview, and an AI formatting prompt.
- Added clearer save and publish validation so missing or invalid fields are reported to the user.
- Preserved objective answers in `answers[]` while keeping compatibility with older single-choice submissions.
- Enforced immediate answer feedback for quick practice and post-submission review for traditional exams.
- Added result images, selected answers, correct answers, explanations, and per-question scores.
- Added retry handling for transient exam detail and list loading failures.
- Fixed route state refresh when returning from an exam result to the course exam list.

## Language

- Added Hindi to the global language switcher.
- Completed Hindi keys against the English translation set while preserving ICU placeholders.
- Kept Hindi available across the whole dashboard, including course and exam pages.

## Acceptance

- Teacher exam list, traditional editor, quick-practice editor, and both submission lists passed.
- Student exam list, traditional 100-point result, quick-practice 100-point result, image rendering, explanations, and return navigation passed.
- Both retained acceptance exams allow 100 attempts and remain published for follow-up testing.
- Final automated screenshot acceptance: 10 of 10 checks passed.

## Deployment

- Railway target: `attractive-harmony / production / ailaeclass`.
- Supabase target: `kiqzanfkpivkuvlvxqsp`.
- No database migration is included in this release.
