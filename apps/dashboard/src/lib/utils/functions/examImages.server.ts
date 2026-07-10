import type { SupabaseClient } from '@supabase/supabase-js';
import { IMAGE_UPLOAD_BUCKET } from '$lib/utils/constants/imageUpload';

type StoredImage = {
  url?: string;
  key?: string;
  fileKey?: string;
  path?: string;
  [key: string]: unknown;
};

function getStorageKey(image: StoredImage | null | undefined) {
  return image?.key || image?.fileKey || image?.path || '';
}

function collectImages(questions: any[]) {
  const imagesByKey = new Map<string, StoredImage[]>();

  const addImage = (image: StoredImage | null | undefined) => {
    const key = getStorageKey(image);
    if (!image || !key) return;

    const images = imagesByKey.get(key) || [];
    images.push(image);
    imagesByKey.set(key, images);
  };

  for (const question of questions || []) {
    addImage(question?.metadata?.image);

    for (const image of Object.values(question?.metadata?.optionImages || {})) {
      addImage(image as StoredImage);
    }

    for (const option of question?.options || []) {
      addImage(option?.metadata?.image);
    }
  }

  return imagesByKey;
}

/** Refresh private storage URLs before exam data is sent to an editor or runner. */
export async function refreshExamImageUrls(supabase: SupabaseClient, questions: any[]) {
  const imagesByKey = collectImages(questions);
  const keys = [...imagesByKey.keys()];
  if (keys.length === 0) return questions;

  const { data, error } = await supabase.storage
    .from(IMAGE_UPLOAD_BUCKET)
    .createSignedUrls(keys, 60 * 60 * 24 * 7);

  if (error) {
    console.warn('Unable to refresh exam image URLs');
    return questions;
  }

  for (const result of data || []) {
    if (!result.path || !result.signedUrl) continue;

    for (const image of imagesByKey.get(result.path) || []) {
      image.url = result.signedUrl;
    }
  }

  return questions;
}
