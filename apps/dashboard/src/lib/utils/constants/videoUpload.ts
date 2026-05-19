export const VIDEO_UPLOAD_BUCKET = 'videos';

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska'
] as const;

export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
