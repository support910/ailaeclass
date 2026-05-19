export const ALLOWED_CONTENT_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska'
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint' // .ppt
] as const;

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB

export const BUCKET_NAME = {
  VIDEOS: 'videos',
  DOCUMENTS: 'documents'
} as const;
