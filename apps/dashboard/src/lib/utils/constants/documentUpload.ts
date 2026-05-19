export const DOCUMENT_UPLOAD_BUCKET = 'documents';

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint'
] as const;

export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB

