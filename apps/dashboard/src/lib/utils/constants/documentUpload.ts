export const DOCUMENT_UPLOAD_BUCKET = 'documents';

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'text/html',
  'text/markdown',
  'text/plain'
] as const;

export const DOCUMENT_EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  html: 'text/html',
  htm: 'text/html',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain'
};

export type LessonDocumentUploadType =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'pptx'
  | 'ppt'
  | 'html'
  | 'md'
  | 'txt';

export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB

export function getDocumentExtension(fileName = '') {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function getDocumentUploadMimeType(fileName = '', fileType = '') {
  const normalizedType = fileType.toLowerCase();
  if ((ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(normalizedType)) {
    return normalizedType;
  }

  const ext = getDocumentExtension(fileName);
  return DOCUMENT_EXTENSION_MIME_TYPES[ext] || '';
}

export function isAllowedDocumentUpload(fileName = '', fileType = '') {
  return Boolean(getDocumentUploadMimeType(fileName, fileType));
}

export function getLessonDocumentType(fileName = '', fileType = ''): LessonDocumentUploadType {
  const ext = getDocumentExtension(fileName);
  if (ext === 'htm') return 'html';
  if (ext === 'markdown') return 'md';
  if (ext in DOCUMENT_EXTENSION_MIME_TYPES) return ext as LessonDocumentUploadType;

  const resolvedType = getDocumentUploadMimeType(fileName, fileType);
  if (resolvedType === 'application/pdf') return 'pdf';
  if (resolvedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (resolvedType === 'application/msword') return 'doc';
  if (resolvedType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (resolvedType === 'application/vnd.ms-powerpoint') return 'ppt';
  if (resolvedType === 'text/html') return 'html';
  if (resolvedType === 'text/markdown') return 'md';
  return 'txt';
}

export function isInlinePreviewDocument(type = '', fileName = '') {
  const normalizedType = type.toLowerCase();
  const ext = getDocumentExtension(fileName);
  return (
    normalizedType === 'pdf' ||
    normalizedType === 'html' ||
    normalizedType === 'md' ||
    normalizedType === 'txt' ||
    ext === 'pdf' ||
    ext === 'html' ||
    ext === 'htm' ||
    ext === 'md' ||
    ext === 'markdown' ||
    ext === 'txt'
  );
}

