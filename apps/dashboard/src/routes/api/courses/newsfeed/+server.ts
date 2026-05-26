import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/utils/functions/supabase.server';
import { checkUserCoursePermissions } from '$lib/utils/functions/permissions';

export const GET: RequestHandler = async ({ request, url }) => {
  const courseId = url.searchParams.get('courseId');
  const userId = request.headers.get('user_id');

  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!courseId) {
    return json({ success: false, message: 'Course ID is required' }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();

    // Resolve group_id from course for permission check
    const { data: courseRow, error: courseError } = await supabase
      .from('course')
      .select('group_id')
      .eq('id', courseId)
      .single();

    if (courseError || !courseRow) {
      return json({ success: false, message: 'Course not found' }, { status: 404 });
    }

    const { hasAccess } = await checkUserCoursePermissions(supabase, userId, courseRow.group_id);

    if (!hasAccess) {
      return json(
        {
          success: false,
          message: 'Access denied. User is not a member of this course or organization.'
        },
        { status: 403 }
      );
    }

    // Step 1: Fetch newsfeeds and comments without nested author profile
    // (PostgREST schema cache sometimes misses the groupmember->profile FK)
    const { data: newsfeeds, error } = await supabase
      .from('course_newsfeed')
      .select(
        `
        id,
        created_at,
        content,
        course_id,
        author_id,
        reaction,
        is_pinned,
        comment:course_newsfeed_comment(
            id,
            created_at,
            author_id,
            content,
            course_newsfeed_id
        )
      `
      )
      .match({ course_id: courseId })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('newsfeed query error:', error);
      throw new Error(`Error fetching newsfeeds: ${error.message || JSON.stringify(error)}`);
    }

    const feeds = newsfeeds || [];

    // Step 2: Collect all author_ids (groupmember ids) from feeds and comments
    const authorIdSet = new Set<string>();
    feeds.forEach((feed: any) => {
      if (feed.author_id) authorIdSet.add(feed.author_id);
      (feed.comment || []).forEach((c: any) => {
        if (c.author_id) authorIdSet.add(c.author_id);
      });
    });

    const authorIds = Array.from(authorIdSet);

    // Step 3: Query groupmember to get profile_id mapping
    let profileIdMap: Record<string, string> = {}; // groupmember_id -> profile_id
    if (authorIds.length > 0) {
      const { data: groupMembers, error: gmError } = await supabase
        .from('groupmember')
        .select('id, profile_id')
        .in('id', authorIds);

      if (gmError) {
        console.error('groupmember query error:', gmError);
      } else {
        (groupMembers || []).forEach((gm: any) => {
          if (gm.profile_id) profileIdMap[gm.id] = gm.profile_id;
        });
      }
    }

    // Step 4: Query profile data
    const profileIds = Object.values(profileIdMap).filter(Boolean) as string[];
    let profileMap: Record<string, any> = {}; // profile_id -> profile object
    if (profileIds.length > 0) {
      const { data: profiles, error: pError } = await supabase
        .from('profile')
        .select('id, fullname, avatar_url')
        .in('id', profileIds);

      if (pError) {
        console.error('profile query error:', pError);
      } else {
        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });
      }
    }

    // Step 5: Merge author data into feeds
    const enrichedFeeds = feeds.map((feed: any) => {
      const feedProfileId = profileIdMap[feed.author_id];
      const enrichedFeed = {
        ...feed,
        author: feedProfileId
          ? {
              profile: profileMap[feedProfileId] || null
            }
          : { profile: null }
      };

      if (Array.isArray(enrichedFeed.comment)) {
        enrichedFeed.comment = enrichedFeed.comment.map((c: any) => {
          const commentProfileId = profileIdMap[c.author_id];
          return {
            ...c,
            author: commentProfileId
              ? {
                  profile: profileMap[commentProfileId] || null
                }
              : { profile: null }
          };
        });
      }

      return enrichedFeed;
    });

    return json({
      success: true,
      data: enrichedFeeds
    });
  } catch (error) {
    console.error('GET /api/courses/newsfeed exception:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json(
      {
        success: false,
        message
      },
      { status: 500 }
    );
  }
};
