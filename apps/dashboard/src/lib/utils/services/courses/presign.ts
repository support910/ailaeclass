import { type Writable, get } from 'svelte/store';
import {
  lessonDocUpload,
  lessonVideoUpload
} from '$lib/components/Course/components/Lesson/store/lessons';

import axios from 'axios';
import { appApi } from '$lib/utils/services/api';
import { getAccessToken, getSupabase } from '$lib/utils/functions/supabase';
import {
  DOCUMENT_UPLOAD_BUCKET,
  getDocumentUploadMimeType
} from '$lib/utils/constants/documentUpload';
import { IMAGE_UPLOAD_BUCKET } from '$lib/utils/constants/imageUpload';

export type UploadType = 'document' | 'video' | 'generic';

export class ImageUploadNetworkError extends Error {
  constructor() {
    super('Image upload network error');
    this.name = 'ImageUploadNetworkError';
  }
}

export class GenericUploader {
  public abortController: AbortController | null = null;
  private uploadType: UploadType;
  protected uploadStore: Writable<any>;

  constructor(uploadType: UploadType) {
    this.uploadType = uploadType;
    this.uploadStore = uploadType === 'document' ? lessonDocUpload : lessonVideoUpload;
    this.abortController = new AbortController();
  }

  async getDownloadPresignedUrl(keys: string[], type = this.uploadType) {
    const endpoint =
      type === 'document'
        ? appApi.course.presign.document.download
        : appApi.course.presign.video.download;

    const response = await endpoint.$post({
      json: {
        keys
      }
    });

    return response.json();
  }

  async getAllDownloadPresignedUrl(videoKeys: string[], docKeys: string[]) {
    const urls = {
      videos: {},
      documents: {}
    };

    try {
      if (videoKeys.length) {
        const videoUploader = new VideoUploader();
        const videoResponse = await videoUploader.getDownloadPresignedUrl(videoKeys);
        urls.videos = videoResponse?.urls || {};
      }

      if (docKeys.length) {
        const documentUploader = new DocumentUploader();
        const docResponse = await documentUploader.getDownloadPresignedUrl(docKeys);
        urls.documents = docResponse?.urls || {};
      }
    } catch (error) {
      console.error('Error getting download presigned url:', error);
    }

    return urls;
  }

  async getPresignedUrl(file: File) {
    const endpoint =
      this.uploadType === 'document'
        ? appApi.course.presign.document.upload
        : appApi.course.presign.video.upload;

    const response = await endpoint.$post({
      json: {
        fileName: file?.name,
        fileType: file?.type
      }
    });

    return response.json();
  }

  async uploadFile(params: { url: string; file: File }) {
    await axios.put(params.url, params.file, {
      headers: {
        'Content-Type': params.file.type
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      signal: this.abortController?.signal,
      onUploadProgress: (progressEvent) => {
        if (get(this.uploadStore).isCancelled) {
          this.abortController?.abort();
          return;
        }

        const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
        this.uploadStore.update((state) => ({
          ...state,
          uploadProgress: progress
        }));
      }
    });
  }

  initUpload() {
    this.uploadStore.update((state) => ({
      ...state,
      isUploading: true,
      uploadProgress: 0,
      error: null,
      isCancelled: false
    }));

    this.abortController = new AbortController();
  }

  cancelUpload() {
    this.uploadStore.update((store) => ({
      ...store,
      isCancelled: true,
      isUploading: false
    }));

    this.abortController?.abort();
    this.abortController = null;
  }
}

export class DocumentUploader extends GenericUploader {
  private signedUpload: { path: string; token: string } | null = null;

  constructor() {
    super('document');
  }

  async getDownloadPresignedUrl(keys: string[]) {
    const token = await getAccessToken();
    const response = await fetch('/api/documents/presign/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ keys })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'Unable to prepare document download');
    }

    return response.json();
  }

  async getPresignedUrl(file: File) {
    const token = await getAccessToken();
    const fileType = getDocumentUploadMimeType(file?.name, file?.type);
    const response = await fetch('/api/documents/presign/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fileName: file?.name,
        fileType,
        fileSize: file?.size
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'Unable to prepare document upload');
    }

    const data = await response.json();
    this.signedUpload = { path: data.path, token: data.token };
    return data;
  }

  async uploadFile(params: { url: string; file: File }) {
    if (!this.signedUpload) {
      throw new Error('Missing signed upload token');
    }
    const fileType = getDocumentUploadMimeType(params.file?.name, params.file?.type);

    this.uploadStore.update((state) => ({
      ...state,
      uploadProgress: 10
    }));

    const { error } = await getSupabase()
      .storage
      .from(DOCUMENT_UPLOAD_BUCKET)
      .uploadToSignedUrl(this.signedUpload.path, this.signedUpload.token, params.file, {
        contentType: fileType || params.file.type
      });

    if (error) {
      throw error;
    }

    this.uploadStore.update((state) => ({
      ...state,
      uploadProgress: 100
    }));
  }
}

export class ImageUploader extends GenericUploader {
  private signedUpload: { path: string; token: string } | null = null;

  constructor() {
    super('document');
  }

  async getDownloadPresignedUrl(keys: string[]) {
    const token = await getAccessToken();
    const response = await fetch('/api/images/presign/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ keys })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'Unable to prepare image download');
    }

    return response.json();
  }

  async getPresignedUrl(file: File) {
    const token = await getAccessToken();
    const response = await fetch('/api/images/presign/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fileName: file?.name,
        fileType: file?.type,
        fileSize: file?.size
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'Unable to prepare image upload');
    }

    const data = await response.json();
    this.signedUpload = { path: data.path, token: data.token };
    return data;
  }

  async uploadDirect(file: File) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Please log in again before uploading images');
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/images/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        const result = await response.json().catch(() => null);
        const retryableStatus = [502, 503, 504].includes(response.status);

        if ((!response.ok || !result?.success) && retryableStatus && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Unable to upload image');
        }

        return result;
      } catch (error) {
        const isNetworkError =
          error instanceof TypeError || error instanceof ImageUploadNetworkError;
        if (!isNetworkError) throw error;

        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }

        throw new ImageUploadNetworkError();
      }
    }

    throw new ImageUploadNetworkError();
  }

  async uploadFile(params: { url: string; file: File }) {
    if (!this.signedUpload) {
      throw new Error('Missing signed upload token');
    }

    this.uploadStore.update((state) => ({
      ...state,
      uploadProgress: 10
    }));

    const { error } = await getSupabase()
      .storage
      .from(IMAGE_UPLOAD_BUCKET)
      .uploadToSignedUrl(this.signedUpload.path, this.signedUpload.token, params.file, {
        contentType: params.file.type
      });

    if (error) {
      throw error;
    }

    this.uploadStore.update((state) => ({
      ...state,
      uploadProgress: 100
    }));
  }
}

export class VideoUploader extends GenericUploader {
  constructor() {
    super('video');
  }

  async getPresignedUrl(file: File) {
    const token = await getAccessToken();
    const response = await fetch('/api/videos/presign/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fileName: file?.name,
        fileType: file?.type,
        fileSize: file?.size
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'Unable to prepare video upload');
    }

    return response.json();
  }

  async getDownloadPresignedUrl(keys: string[]) {
    const token = await getAccessToken();
    const response = await fetch('/api/videos/presign/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ keys })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || 'Unable to prepare video download');
    }

    return response.json();
  }
}
