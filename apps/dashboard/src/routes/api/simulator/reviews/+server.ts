import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { parseDriveLink, downloadDrive, readLimited, SimulatorError } from '$lib/server/simulator/drive.js';
import { parseResults } from '$lib/server/simulator/data.js';
import { identity, readJson, databaseError, failure, updateReview } from '$lib/server/simulator/repository.server';

const input = z.object({
  title: z.string().trim().min(1).max(120), url: z.string().max(2048),
  flightType: z.enum(['simulator', 'real']).default('simulator'), videoUrl: z.string().trim().max(2048).default(''),
  scenario: z.enum(['figure_eight', 'hover', 'route', 'landing']), consent: z.literal(true)
}).strict();

let activeDownloads = 0;

export const GET: RequestHandler = async ({ request, url }) => {
  try {
    const { db, userId } = await identity(request);
    const offset = Math.floor(Math.max(0, Math.min(10000, Number(url.searchParams.get('offset')) || 0)));
    const { data, error } = await db.from('simulator_drive_reviews')
      .select('id,title,scenario,flight_type,source_kind,status,error_code,created_at,attempts')
      .eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + 19);
    if (error) throw databaseError(error);
    return json({ reviews: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
};

export const POST: RequestHandler = async ({ request }) => {
  let current: Awaited<ReturnType<typeof identity>> | undefined;
  let id: string | undefined;
  let downloading = false;
  try {
    current = await identity(request);
    const result = input.safeParse(await readJson(request));
    if (!result.success) throw new SimulatorError('invalid_request');
    const form = result.data;
    const link = parseDriveLink(form.url);
    const videoLink = form.videoUrl ? parseDriveLink(form.videoUrl) : null;
    if (videoLink && (form.flightType !== 'real' || videoLink.sourceUrl === link.sourceUrl)) throw new SimulatorError('invalid_request');
    if (activeDownloads >= 1) throw new SimulatorError('rate_limit', 429);
    activeDownloads++;
    downloading = true;
    const { db, userId } = current;
    const reserved = await db.rpc('reserve_simulator_review', {
      p_user_id: userId, p_title: form.title, p_source_url: link.sourceUrl, p_scenario: form.scenario,
      p_flight_type: form.flightType, p_video_source_url: videoLink?.sourceUrl ?? null
    });
    if (reserved.error) throw databaseError(reserved.error);
    id = reserved.data;
    const download = await downloadDrive(link);
    const bytes = await readLimited(download.response.body, download.limit);
    if (videoLink) {
      if (download.kind !== 'image') throw new SimulatorError('pair_requires_image');
      const recording = await downloadDrive(videoLink);
      if (recording.kind !== 'video') { await recording.response.body?.cancel(); throw new SimulatorError('pair_requires_video'); }
      const recordingBytes = await readLimited(recording.response.body, recording.limit);
      await updateReview(db, userId, id!, { source_kind: 'image_video', status: 'imported' });
      const files = new FormData();
      files.append('image', new Blob([bytes], { type: download.mime }), 'results-image');
      files.append('video', new Blob([recordingBytes], { type: recording.mime }), 'flight-video');
      return new Response(files, { headers: { 'X-Review-Id': id!, 'X-Review-Kind': 'image_video', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    let summary = null;
    if (download.kind === 'data') {
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new SimulatorError('invalid_data'); }
      summary = parseResults(text);
    }
    await updateReview(db, userId, id!, { source_kind: download.kind, status: 'imported', data_summary: summary });
    if (download.kind === 'data') return json({ id, kind: 'data', summary }, { headers: { 'Cache-Control': 'no-store' } });
    return new Response(bytes, { headers: {
      'Content-Type': download.mime, 'Content-Length': String(bytes.length), 'X-Review-Id': id!,
      'X-Review-Kind': download.kind, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
    } });
  } catch (error) {
    if (current && id) await updateReview(current.db, current.userId, id, { status: 'failed', error_code: error instanceof SimulatorError ? error.code : 'download_failed' }).catch(() => {});
    return failure(error);
  } finally {
    if (downloading) activeDownloads--;
  }
};
