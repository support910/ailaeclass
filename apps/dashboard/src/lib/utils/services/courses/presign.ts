import { type Writable, get } from 'svelte/store';
import {
  lessonDocUpload,
  lessonVideoUpload
} from '$lib/components/Course/components/Lesson/store/lessons';

import axios from 'axios';
import { appApi } from '$lib/utils/services/api';
import { getAccessToken, getSupabase } from '$lib/utils/functions/supabase';
import { DOCUMENT_UPLOAD_BUCKET } from '$lib/utils/constants/documentUpload';

export type UploadType = 'document' | 'video' | 'generic';

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
    const response = await fetch('/api/documents/presign/upload', {
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

    this.uploadStore.update((state) => ({
      ...state,
      uploadProgress: 10
    }));

    const { error } = await getSupabase()
      .storage
      .from(DOCUMENT_UPLOAD_BUCKET)
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
