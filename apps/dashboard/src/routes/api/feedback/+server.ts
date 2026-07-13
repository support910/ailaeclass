import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_UPLOAD_BUCKET,
  MAX_IMAGE_SIZE
} from '$lib/utils/constants/imageUpload';

const FEEDBACK_ADMIN_EMAIL = 'admin@5gnu.com';
const MAX_SCREENSHOTS = 3;

function bearerToken(request: Request) {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
}

async function authenticate(request: Request) {
  const supabase = getServerSupabase();
  const token = bearerToken(request);
  if (!token) return { supabase, user: null };
  const { data, error } = await supabase.auth.getUser(token);
  return { supabase, user: error ? null : data.user };
}

function isFeedbackAdmin(email?: string | null) {
  return email?.trim().toLowerCase() === FEEDBACK_ADMIN_EMAIL;
}

function sanitizeFileName(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
  const base = fileName
    .replace(/\.[^/.]+$/, '')
    .normalize('NFC')
    .replace(/[^a-zA-Z0-9_.-]/gu, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return `${base || 'screenshot'}.${ext}`;
}

async function ensureImageBucket(supabase: ReturnType<typeof getServerSupabase>) {
  const { data } = await supabase.storage.getBucket(IMAGE_UPLOAD_BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(IMAGE_UPLOAD_BUCKET, {
    public: false,
    fileSizeLimit: MAX_IMAGE_SIZE,
    allowedMimeTypes: [...ALLOWED_IMAGE_TYPES]
  });
  if (error && !error.message.toLowerCase().includes('already exists')) throw error;
}

async function verifyOrgMembership(
  supabase: ReturnType<typeof getServerSupabase>,
  userId: string,
  orgId: string
) {
  if (!orgId) return true;
  const { data } = await supabase
    .from('organizationmember')
    .select('id')
    .eq('organization_id', orgId)
    .eq('profile_id', userId)
    .eq('verified', true)
    .maybeSingle();
  return !!data;
}

export const POST: RequestHandler = async ({ request }) => {
  const { supabase, user } = await authenticate(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const issueLocation = String(form.get('issueLocation') || '').trim();
  const description = String(form.get('description') || '').trim();
  const occurredAt = String(form.get('occurredAt') || '').trim();
  const pageUrl = String(form.get('pageUrl') || '').trim();
  const pagePort = String(form.get('pagePort') || '').trim();
  const orgId = String(form.get('orgId') || '').trim();
  const screenshots = form.getAll('screenshots').filter((item): item is File => item instanceof File && item.size > 0);

  if (!issueLocation || !description || !occurredAt || !pageUrl) {
    return json({ success: false, message: 'Please complete all required fields.' }, { status: 400 });
  }
  if (issueLocation.length > 200 || description.length > 2000 || pageUrl.length > 1000) {
    return json({ success: false, message: 'Feedback content is too long.' }, { status: 400 });
  }
  if (!Number.isFinite(Date.parse(occurredAt))) {
    return json({ success: false, message: 'Invalid occurrence time.' }, { status: 400 });
  }
  if (screenshots.length < 1 || screenshots.length > MAX_SCREENSHOTS) {
    return json({ success: false, message: 'Please upload 1 to 3 screenshots.' }, { status: 400 });
  }
  if (!(await verifyOrgMembership(supabase, user.id, orgId))) {
    return json({ success: false, message: 'Organization access denied.' }, { status: 403 });
  }
  for (const file of screenshots) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > MAX_IMAGE_SIZE) {
      return json({ success: false, message: 'Screenshots must be supported images under 5MB.' }, { status: 400 });
    }
  }

  const uploadedPaths: string[] = [];
  try {
    await ensureImageBucket(supabase);
    for (const file of screenshots) {
      const path = `feedback/${user.id}/${randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from(IMAGE_UPLOAD_BUCKET)
        .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
      if (error) throw error;
      uploadedPaths.push(path);
    }

    const { data: profile } = await supabase
      .from('profile')
      .select('fullname')
      .eq('id', user.id)
      .maybeSingle();
    const { data, error } = await supabase
      .from('user_feedback')
      .insert({
        reporter_profile_id: user.id,
        reporter_email: user.email.toLowerCase(),
        reporter_name: profile?.fullname || '',
        organization_id: orgId || null,
        issue_location: issueLocation,
        description,
        occurred_at: new Date(occurredAt).toISOString(),
        page_url: pageUrl,
        page_port: pagePort,
        screenshot_paths: uploadedPaths
      })
      .select('id, created_at')
      .single();
    if (error) throw error;
    return json({ success: true, feedback: data }, { status: 201 });
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(IMAGE_UPLOAD_BUCKET).remove(uploadedPaths);
    }
    console.error('Feedback submission failed:', error);
    return json(
      { success: false, message: error instanceof Error ? error.message : 'Unable to submit feedback.' },
      { status: 500 }
    );
  }
};

export const GET: RequestHandler = async ({ request }) => {
  const { supabase, user } = await authenticate(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!isFeedbackAdmin(user.email)) return json({ success: false, message: 'Access denied' }, { status: 403 });

  const { data, error } = await supabase
    .from('user_feedback')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return json({ success: false, message: error.message }, { status: 500 });

  const feedback = (data || []).map((item) => ({
    ...item,
    screenshot_count: item.screenshot_paths?.length || 0,
    screenshot_paths: undefined
  }));
  return json({ success: true, feedback });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const { supabase, user } = await authenticate(request);
  if (!user?.email) return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  if (!isFeedbackAdmin(user.email)) return json({ success: false, message: 'Access denied' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = String(body?.id || '');
  const status = String(body?.status || '');
  if (!id || !['read', 'resolved'].includes(status)) {
    return json({ success: false, message: 'Invalid feedback update.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates =
    status === 'resolved'
      ? { status, read_at: now, resolved_at: now, updated_at: now }
      : { status, read_at: now, updated_at: now };
  const { data, error } = await supabase
    .from('user_feedback')
    .update(updates)
    .eq('id', id)
    .select('id, status, read_at, resolved_at')
    .maybeSingle();
  if (error) return json({ success: false, message: error.message }, { status: 500 });
  if (!data) return json({ success: false, message: 'Feedback not found.' }, { status: 404 });
  return json({ success: true, feedback: data });
};
