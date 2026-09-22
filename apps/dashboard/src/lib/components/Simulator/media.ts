function waitForEvent(element: HTMLVideoElement, event: string, action?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => done(new Error('video_decode')), 15000);
    const ready = () => done();
    const failed = () => done(new Error('video_decode'));
    function done(error?: Error) {
      clearTimeout(timeout);
      element.removeEventListener(event, ready);
      element.removeEventListener('error', failed);
      error ? reject(error) : resolve();
    }
    element.addEventListener(event, ready, { once: true });
    element.addEventListener('error', failed, { once: true });
    action?.();
  });
}

export async function extractMedia(blob: Blob, kind: 'image' | 'video', progress: (n: number) => void) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('video_decode');
  function frame(source: CanvasImageSource, width: number, height: number, edge = 960) {
    const scale = Math.min(1, edge / width, edge / height);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context!.drawImage(source, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    for (const quality of [0.8, 0.65, 0.5]) {
      if (dataUrl.length <= 700_000) break;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length > 700_000) throw new Error('file_too_large');
    return dataUrl;
  }
  if (kind === 'image') {
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(blob); } catch { throw new Error('video_decode'); }
    try { return { duration: 0, frames: [{ at: 0, dataUrl: frame(bitmap, bitmap.width, bitmap.height, 1600) }] }; }
    finally { bitmap.close(); }
  }
  const video = document.createElement('video');
  const url = URL.createObjectURL(blob);
  video.muted = true;
  video.preload = 'auto';
  try {
    await waitForEvent(video, 'loadeddata', () => { video.src = url; video.load(); });
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0 || duration > 1200) throw new Error('video_duration');
    const frames = [];
    for (let i = 0; i < 12; i++) {
      const at = duration * (0.025 + (i / 11) * 0.95);
      await waitForEvent(video, 'seeked', () => { video.currentTime = at; });
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2) throw new Error('video_decode');
      frames.push({ at, dataUrl: frame(video, video.videoWidth, video.videoHeight) });
      progress(i + 1);
    }
    return { duration, frames };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
