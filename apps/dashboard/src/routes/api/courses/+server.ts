import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ROLE } from '$lib/utils/constants/roles';
import { getOrgAccess } from '$lib/utils/functions/authz.server';
import { getServerSupabase, getUserIdFromRequest } from '$lib/utils/functions/supabase.server';

export const POST: RequestHandler = async ({ request }) => {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return json({ success: false, message: 'Unauthorized' }, { status: 401 });

  let body: { orgId?: string; title?: string; description?: string; type?: string; logo?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const orgId = String(body.orgId || '');
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const type = body.type === 'SELF_PACED' ? 'SELF_PACED' : 'LIVE_CLASS';
  const logo = String(body.logo || '').trim();
  if (!orgId || !title || !description) {
    return json(
      { success: false, message: 'Organization, title and description are required.' },
      { status: 400 }
    );
  }
  if (logo && !isAllowedCoverUrl(logo)) {
    return json({ success: false, message: 'Invalid course cover URL' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const access = await getOrgAccess(supabase, orgId, userId);
  if (!access.canManageCourses) {
    return json({ success: false, message: 'Access denied' }, { status: 403 });
  }

  let groupId: string | null = null;
  let courseId: string | null = null;
  try {
    const { data: profile } = await supabase
      .from('profile')
      .select('id, email')
      .eq('id', userId)
      .single();
    const { data: newGroup, error: groupError } = await supabase
      .from('group')
      .insert({ name: title, description, organization_id: orgId })
      .select('id')
      .single();
    if (groupError || !newGroup) throw groupError || new Error('Failed to create course group');
    groupId = newGroup.id;

    const { data: newCourse, error: courseError } = await supabase
      .from('course')
      .insert({ title, description, type, logo: logo || null, version: 'V2', group_id: groupId })
      .select('*')
      .single();
    if (courseError || !newCourse) throw courseError || new Error('Failed to create course');
    courseId = newCourse.id;

    const { data: member, error: memberError } = await supabase
      .from('groupmember')
      .insert({
        profile_id: userId,
        email: profile?.email || access.membership?.email || null,
        group_id: groupId,
        role_id: access.isAdmin ? ROLE.ADMIN : ROLE.TUTOR
      })
      .select('id')
      .single();
    if (memberError || !member) throw memberError || new Error('Failed to assign course owner');

    await supabase.from('course_newsfeed').insert({
      content: '<h2>Welcome to this course</h2><p>Thank you for joining this course.</p>',
      course_id: newCourse.id,
      is_pinned: true,
      author_id: member.id
    });

    return json({ success: true, course: newCourse }, { status: 201 });
  } catch (error) {
    if (courseId) await supabase.from('course').delete().eq('id', courseId);
    if (groupId) await supabase.from('group').delete().eq('id', groupId);
    const message = error instanceof Error ? error.message : 'Failed to create course';
    return json({ success: false, message }, { status: 500 });
  }
};

function isAllowedCoverUrl(value: string): boolean {
  if (value.length > 2048) return false;
  if (value.startsWith('/images/course-covers/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
