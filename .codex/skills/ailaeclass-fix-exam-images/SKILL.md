---
name: ailaeclass-fix-exam-images
description: Diagnose, repair, and verify ailaeclass v6 exam question or option image upload failures. Use when selecting an exam image does nothing, the preview is blank until refresh, signed images fail to load, upload progress crashes the editor, or saved images disappear between teacher editing and student exam views.
---

# Fix Exam Images

Work only in the active v6 workspace. Preserve backups and unrelated UI.

## Inspect First

1. Reproduce with a real PNG in the exam editor.
2. Inspect browser console errors before changing storage or auth code.
3. Check the upload response contains both `url` and `fileKey`.
4. Check the saved question or option metadata contains `{ url, key, alt }`.
5. Request the image URL and confirm HTTP 200 plus an image content type.

Primary files:

- `apps/dashboard/src/lib/components/Exam/QuestionImageUpload.svelte`
- `apps/dashboard/src/lib/components/Exam/ExamQuestionEditor.svelte`
- `apps/dashboard/src/lib/utils/services/courses/presign.ts`
- `apps/dashboard/src/routes/api/images/upload/+server.ts`
- `apps/dashboard/src/lib/utils/functions/examImages.server.ts`

## Known Failure Pattern

The ICU translation parser must receive interpolation values during `$t` evaluation. This is wrong because parsing fails before `.replace()` runs:

```svelte
$t('components.exam.image_upload.uploading').replace('{progress}', String(uploadProgress))
```

Use:

```svelte
$t('components.exam.image_upload.uploading', { progress: uploadProgress })
```

An ICU `MissingValueError` while `isUploading` becomes true can stop the component render. The upload may still finish, which produces the misleading symptom: blank now, visible after refresh.

## Preview Rules

1. Generate the immediate preview with `FileReader.readAsDataURL(file)`.
2. Do not use `URL.createObjectURL` unless CSP explicitly allows `blob:`. The current dashboard image CSP allows `data:` and `https:`.
3. Do not clear a successful local preview immediately after upload. A new private Supabase object or signed URL may need a moment before it is readable.
4. Keep a local pending image object until the parent prop catches up.
5. Clear the local preview on removal, failed upload, replacement, or component destruction.
6. On remote image error, refresh the signed URL once by storage key. Avoid infinite retry loops.

## Metadata Rules

- Store question images in `question.metadata.image`.
- Store option images in `option.metadata.image`.
- Preserve option metadata when mapping, saving, importing, publishing, and loading student exams.
- Persist the storage key. A signed URL alone expires and cannot be refreshed.
- Refresh signed URLs server-side in a batch when loading exam details.

## Required Verification

Use an actual exam and actual file upload. Do not approve the fix from code inspection alone.

1. Immediately after selection, confirm an `<img>` exists with non-zero natural dimensions. A `data:image/...` source is expected during the editing session.
2. Save the exam and confirm the success notification.
3. Confirm the image remains visible without refreshing.
4. Reload without test query parameters.
5. Confirm the same image loads from an `https://` Supabase signed URL with `complete=true` and non-zero dimensions.
6. Confirm both question and option images render in the student exam view.
7. Run `corepack pnpm --filter @cio/dashboard build`.
8. Run `git diff --check` and verify no temporary QA hooks remain.
9. Save focused screenshots for immediate preview, after save, and after refresh.

Do not deploy until the user explicitly approves production deployment.
