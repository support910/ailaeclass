export const IMAGE_UPLOAD_BUCKET = 'question-images';

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const;

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
