import type { Course } from '$lib/utils/types';
import { supabase, getAccessToken } from '$lib/utils/functions/supabase';
import type { Reaction, FeedApi, Feed } from '$lib/utils/types/feed';

export async function fetchNewsFeedReaction(feedId: Feed['id']) {
  return supabase.from('course_newsfeed').select(`reaction`).eq('id', feedId).single();
}

export async function fetchNewsFeeds(courseId?: Course['id']) {
  const accessToken = await getAccessToken();

  const response = await fetch(`/api/courses/newsfeed?courseId=${courseId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: accessToken
    }
  });

  if (!response.ok) {
    const error = await response.text();
    return {
      data: null,
      error: { message: error }
    };
  }

  const { success, data, message } = await response.json();

  if (!success) {
    return {
      data: null,
      error: { message }
    };
  }

  return { data, error: null };
}

export async function createNewFeed(post: {
  content: string;
  author_id: string;
  course_id: string;
  reaction: Reaction;
}) {
  const response = await supabase
    .from('course_newsfeed')
    .insert({
      content: post.content,
      author_id: post.author_id,
      course_id: post.course_id,
      reaction: post.reaction
    })
    .select();

  return { response };
}

export async function handleEditFeed(feedId: string, content: string) {
  const response = await supabase
    .from('course_newsfeed')
    .update({ content: content })
    .match({ id: feedId })
    .select();
  return response;
}

export async function createComment(comment: {
  content: string;
  author_id: string;
  course_newsfeed_id: string;
}) {
  const response = await supabase
    .from('course_newsfeed_comment')
    .insert({
      content: comment.content,
      author_id: comment.author_id,
      course_newsfeed_id: comment.course_newsfeed_id
    })
    .select();

  return { response };
}

export async function toggleFeedIsPinned(feedId: string, isPinned: boolean) {
  const response = await supabase
    .from('course_newsfeed')
    .update({
      is_pinned: isPinned
    })
    .match({ id: feedId });

  return { response };
}

export async function deleteNewsFeedComment(commentId: string) {
  const response = await supabase.from('course_newsfeed_comment').delete().match({ id: commentId });

  return response;
}
export async function deleteNewsFeed(feedId: string) {
  await supabase.from('course_newsfeed_comment').delete().match({ course_newsfeed_id: feedId });
  const response = await supabase.from('course_newsfeed').delete().match({ id: feedId });

  return response;
}

export async function getFeedForNotification(params: {
  feedId: string;
  authorId: string;
  supabase: typeof supabase;
}) {
  // Fetch feed, author, course, group without nested profile
  // because PostgREST schema cache may miss the groupmember->profile FK
  const { data, error } = await params.supabase
    .from('course_newsfeed')
    .select(
      `
    content,
    author_id,
    course(
      id,
      title,
      group(
        organization(siteName, name),
        members:groupmember(id, profile_id)
      )
    )
  `
    )
    .eq('id', params.feedId)
    .limit(1)
    .returns<
      {
        content: string;
        author_id: string;
        course: {
          id: string;
          title: string;
          group: {
            organization: {
              name: string;
              siteName: string;
            };
            members: {
              id: string;
              profile_id: string;
            }[];
          };
        };
      }[]
    >();

  if (error) {
    console.error('Failed to get feed', error);
    return null;
  }
  console.log({
    data
  });
  const [feed] = data || [];

  if (!feed) return;

  // Collect profile_ids to query separately
  const profileIds: string[] = [];
  if (feed.author_id) {
    profileIds.push(feed.author_id); // Actually author_id is groupmember id, we need to resolve it
  }
  (feed.course?.group?.members || []).forEach((m) => {
    if (m.profile_id) profileIds.push(m.profile_id);
  });

  // Wait, author_id is groupmember id not profile_id. We need groupmember table lookup.
  // Let's query groupmember for author_id and collect profile_ids
  let allProfileIds = [...new Set(profileIds)];
  if (feed.author_id) {
    const { data: authorGm } = await params.supabase
      .from('groupmember')
      .select('profile_id')
      .eq('id', feed.author_id)
      .single();
    if (authorGm?.profile_id && !allProfileIds.includes(authorGm.profile_id)) {
      allProfileIds.push(authorGm.profile_id);
    }
  }

  let profileMap: Record<string, { fullname: string; email: string }> = {};
  if (allProfileIds.length > 0) {
    const { data: profiles } = await params.supabase
      .from('profile')
      .select('id, fullname, email')
      .in('id', allProfileIds);

    (profiles || []).forEach((p: any) => {
      profileMap[p.id] = p;
    });
  }

  // Resolve author profile
  let authorProfile: { fullname?: string; email?: string } | null = null;
  if (feed.author_id) {
    const { data: authorGm } = await params.supabase
      .from('groupmember')
      .select('profile_id')
      .eq('id', feed.author_id)
      .single();
    if (authorGm?.profile_id) {
      authorProfile = profileMap[authorGm.profile_id] || null;
    }
  }

  return {
    id: params.feedId,
    courseId: feed.course.id,
    courseTitle: feed.course.title,
    teacherName: authorProfile?.fullname,
    teacherEmail: authorProfile?.email,
    content: feed.content,
    org: feed.course.group?.organization,
    courseMembers: feed.course?.group?.members
      ?.filter((member) => member.id !== params.authorId)
      ?.map((member) => {
        return profileMap[member.profile_id] || { fullname: '', email: '' };
      })
  };
}
