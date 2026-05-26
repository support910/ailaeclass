import type {
  Course,
  Exercise,
  ExerciseTemplate,
  Group,
  Groupmember,
  Lesson,
  LessonCompletion,
  LessonSection,
  ProfileCourseProgress
} from '$lib/utils/types';
import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js';

import { GenericUploader } from './presign';
import { QUESTION_TYPE, QUESTION_TYPES } from '$lib/components/Question/constants';
import { STATUS } from '$lib/utils/constants/course';
import { get } from 'svelte/store';
import { isOrgAdmin } from '$lib/utils/store/org';
import { isUUID } from '$lib/utils/functions/isUUID';
import { supabase, getAccessToken } from '$lib/utils/functions/supabase';

export async function fetchCourses(profileId, orgId) {
  if (!orgId || !profileId) return;

  const match: { member_profile_id?: string } = {};
  // Filter by profile_id if role isn't admin within organization
  if (!get(isOrgAdmin)) {
    match.member_profile_id = profileId;
  }

  // Gets courses for a particular organisation where the current logged in user is a groupmember
  const { data: allCourses } = await supabase
    .rpc('get_courses', {
      org_id_arg: orgId,
      profile_id_arg: profileId
    })
    .match(match);

  console.log(`allCourses`, allCourses);
  if (!Array.isArray(allCourses)) {
    return {
      allCourses: []
    };
  }

  return { allCourses };
}

export async function fetchProfileCourseProgress(
  courseId,
  profileId
): Promise<{
  data: ProfileCourseProgress[] | null;
  error: PostgrestError | null;
}> {
  const { data, error } = await supabase.rpc('get_course_progress', {
    course_id_arg: courseId,
    profile_id_arg: profileId
  });

  return { data, error };
}

export async function checkExercisesComplete(
  lessonId: Lesson['id'],
  groupMemberId: Groupmember['id']
) {
  const { data, error } = await supabase.rpc('check_if_student_completed_exercises', {
    lesson_id_arg: lessonId,
    groupmember_id_arg: groupMemberId
  });

  return { data, error };
}

const SLUG_QUERY = `
  id,
  title,
  type,
  description,
  overview,
  logo,
  is_published,
  slug,
  cost,
  version,
  currency,
  metadata,
  is_certificate_downloadable,
  certificate_theme,
  join_code,
  lesson_section(id, title, order),
  lessons:lesson(
    id, title, order, section_id
  )
`;

const ID_QUERY = `
  id,
  title,
  type,
  description,
  overview,
  logo,
  is_published,
  version,
  group(*,
    members:groupmember(*)
  ),
  slug,
  cost,
  currency,
  metadata,
  is_certificate_downloadable,
  certificate_theme,
  join_code,
  lesson_section(id, title, order, created_at),
  lessons:lesson(
    id, title, public, lesson_at, is_unlocked, order, created_at, section_id,
    note, videos, slide_url, call_url, totalExercises:exercise(count), totalComments:lesson_comment(count),
    profile:teacher_id(id, avatar_url, fullname),
    lesson_completion(id, profile_id, is_complete)
  ),
  attendance:group_attendance(*),
  polls:apps_poll(status)
`;

export async function fetchCourse(courseId?: Course['id'], slug?: Course['slug']) {
  const match: { slug?: string; id?: string; status?: string } = {};

  if (slug) {
    match.slug = slug;
  } else {
    match.id = courseId;
  }

  match.status = STATUS[STATUS.ACTIVE];

  const response: PostgrestSingleResponse<Course | null> = await supabase
    .from('course')
    .select(slug ? SLUG_QUERY : ID_QUERY)
    .match(match)
    .single();

  const { data, error } = response;

  if (!data || error) {
    console.log(`fetchCourse => error`, error);
    return { data, error };
  }

  // Enrich group.members with profile data separately
  // because PostgREST schema cache may miss the groupmember->profile FK
  if ((data as any).group?.members && Array.isArray((data as any).group.members)) {
    const members = (data as any).group.members;
    const profileIds = members.map((m: any) => m.profile_id).filter(Boolean);
    const uniqueProfileIds = [...new Set(profileIds)];

    if (uniqueProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profile')
        .select('id, fullname, avatar_url, email')
        .in('id', uniqueProfileIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });

      members.forEach((m: any) => {
        m.profile = profileMap[m.profile_id] || null;
      });
    }
  }

  return {
    data,
    error
  };
}

export async function fetchCourseFromAPI(courseId: Course['id']) {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch('/api/courses/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ courseId })
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!response.ok) {
      const message =
        json?.message || json?.error || text || response.statusText || 'Request failed';
      console.error('fetchCourseFromAPI HTTP error:', response.status, message);
      return { data: null, error: { message: `HTTP ${response.status}: ${message}` } };
    }

    if (!json || json.success === false) {
      const message = json?.message || json?.error || text || 'Unknown API error';
      console.error('fetchCourseFromAPI API error:', message);
      return { data: null, error: { message } };
    }

    // Merge viewer into data so CourseContainer can resolve membership without a second auth lookup
    const dataWithViewer = json.data ? { ...json.data, viewer: json.viewer } : null;
    return { data: dataWithViewer, error: null };
  } catch (error) {
    console.error('fetchCourseFromAPI network error:', error);
    return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
  }
}

export async function fetchExploreCourses(profileId, orgId) {
  if (!orgId || !profileId) return;

  const { data: allCourses } = await supabase.rpc('get_explore_courses', {
    org_id_arg: orgId,
    profile_id_arg: profileId
  });

  if (!Array.isArray(allCourses)) {
    return {
      allCourses: []
    };
  }

  return { allCourses };
}

export async function fetchGroup(groupId: Group['id']) {
  const { data, error } = await supabase
    .from('group')
    .select(`*,members:groupmember(*)`)
    .match({ id: groupId })
    .single();

  // Enrich members with profile data separately
  if (data?.members && Array.isArray(data.members)) {
    const profileIds = data.members.map((m: any) => m.profile_id).filter(Boolean);
    const uniqueProfileIds = [...new Set(profileIds)];

    if (uniqueProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profile')
        .select('id, fullname, avatar_url, email')
        .in('id', uniqueProfileIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });

      data.members.forEach((m: any) => {
        m.profile = profileMap[m.profile_id] || null;
      });
    }
  }

  return {
    data,
    error
  };
}

export async function uploadAvatar(courseId: string, avatar: string) {
  const filename = `course/${courseId + Date.now()}.webp`;
  let logo;

  const { data } = await supabase.storage.from('avatars').upload(filename, avatar, {
    cacheControl: '3600',
    upsert: false
  });

  if (data) {
    const { data } = supabase.storage.from('avatars').getPublicUrl(filename);

    if (!data.publicUrl) return;

    logo = data.publicUrl;
  }

  return logo;
}

export async function updateCourse(
  courseId: Course['id'],
  avatar: string | undefined,
  course: Partial<Course>
) {
  if (avatar && courseId) {
    const filename = `course/${courseId + Date.now()}.webp`;

    const { data } = await supabase.storage.from('avatars').upload(filename, avatar, {
      cacheControl: '3600',
      upsert: false
    });

    if (data) {
      const { data: response } = supabase.storage.from('avatars').getPublicUrl(filename);

      if (!response.publicUrl) return;

      course.logo = response.publicUrl;
    }
  }

  await supabase.from('course').update(course).match({ id: courseId });

  return course.logo;
}

export async function deleteCourse(courseId: Course['id']) {
  return await supabase.from('course').update({ status: 'DELETED' }).match({ id: courseId });
}

export function addGroupMember(member: any) {
  return supabase.from('groupmember').insert(member).select();
}

export function addDefaultNewsFeed(feed) {
  return supabase.from('course_newsfeed').insert(feed);
}

export function updatedGroupMember(update: any, match: any) {
  return supabase.from('groupmember').update(update).match(match);
}

export function deleteGroupMember(groupMemberId: Groupmember['id']) {
  return supabase.from('groupmember').delete().match({ id: groupMemberId });
}

export async function getMarks(courseId) {
  if (!courseId) return;

  // Gets courses for a particular organisation where the current logged in user is a groupmember
  const { data: marks } = await supabase.rpc('get_marks').eq('course_id', courseId);

  return { marks };
}

export async function fetchLesson(lessonId: Lesson['id']) {
  // TODO: add documents to the query
  const { data, error } = await supabase
    .from('lesson')
    .select(
      `id,
      title,
      note,
      videos,
      slide_url,
      documents,
      call_url,
      totalExercises:exercise(count),
      totalComments:lesson_comment(count),
      lesson_completion(id, profile_id, is_complete),
      lesson_language(id, content, locale)
    `
    )
    .eq('id', lessonId)
    .single();

  if (data) {
    const videoKeys =
      data.videos?.filter((video) => video.type === 'upload')?.map((video) => video.key) || [];

    const docKeys = data.documents?.map((doc) => doc.key) || [];

    try {
      // Get presigned URLs for videos and documents
      const genericUploader = new GenericUploader('generic');

      const urls = await genericUploader.getAllDownloadPresignedUrl(videoKeys, docKeys);

      data.videos = data.videos.map((video) => {
        if (urls.videos[video.key]) {
          video.link = urls.videos[video.key];
        }
        return video;
      });

      data.documents = data.documents.map((doc) => {
        doc.link = urls.documents[doc.key];
        return doc;
      });
    } catch (error) {
      console.error('Error retrieving presigned assets (videos and documents):', error);
    }
  }

  return { data, error };
}

export function fetchLesssonLanguageHistory(lessonId: string, locale: string, endRange: number) {
  return supabase
    .from('lesson_versions')
    .select('*')
    .range(0, endRange)
    .eq('lesson_id', lessonId)
    .eq('locale', locale)
    .order('timestamp', { ascending: false });
}

export function createLesson(lesson: any) {
  return supabase.from('lesson').insert(lesson).select();
}
export function createLessonSection(section: any) {
  return supabase.from('lesson_section').insert(section).select();
}
export function updateLessonSection(section: any, sectionId: LessonSection['id']) {
  return supabase
    .from('lesson_section')
    .update({ ...section, id: undefined })
    .match({ id: sectionId });
}

export async function updateLesson(lesson: any, lessonId: Lesson['id']) {
  return supabase
    .from('lesson')
    .update({ ...lesson, id: undefined })
    .match({ id: lessonId });
}

export function updateLessonCompletion(completion: LessonCompletion, shouldUpdate: boolean) {
  if (shouldUpdate) {
    return supabase
      .from('lesson_completion')
      .update({
        is_complete: completion.is_complete
      })
      .eq('id', completion.id);
  } else {
    return supabase.from('lesson_completion').insert(completion);
  }
}

export const upsertLessons = (data: { id: string; order: number }[]) => {
  return supabase.from('lesson').upsert(data);
};

export const upsertLessonSections = (data: { id: string; order: number }[]) => {
  return supabase.from('lesson_section').upsert(data);
};

export function deleteLesson(lessonId: Lesson['id']) {
  // Need to implement soft delete
  return supabase.from('lesson').delete().match({ id: lessonId });
}

export function deleteLessonSection(id: LessonSection['id']) {
  // Need to implement soft delete
  return supabase.from('lesson_section').delete().match({ id });
}

export function createExercise(exercise: any) {
  return supabase.from('exercise').insert(exercise).select();
}

export async function fetchExercisesByMarks(courseId: Course['id']) {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch('/api/courses/exercises', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ courseId })
    });

    const result = await response.json();

    if (!result.success) {
      return { data: null, error: result.message };
    }

    return { data: result.data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

function isNew(item: any) {
  return isNaN(item);
}

export async function createExerciseFromTemplate(
  lessonId: string,
  template: ExerciseTemplate
): Promise<any | undefined> {
  const { data, error } = await createExercise({
    title: template.title,
    description: template.description,
    lesson_id: lessonId
  });

  if (error) {
    console.error('Something went wrong', error);
    return;
  }

  const { id } = data[0] || {};
  if (!id) {
    console.error('Something went wrong, no id', error);
    return;
  }

  await upsertExercise(template.questionnaire, id);

  return data[0];
}

export async function upsertExercise(questionnaire: any, exerciseId: Exercise['id']) {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/exercises/${exerciseId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(questionnaire)
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('upsertExercise API error:', result);
      return null;
    }

    return result.questions || [];
  } catch (err) {
    console.error('upsertExercise network error:', err);
    return null;
  }
}

interface LooseObject {
  [key: string]: any;
}

export async function submitExercise(
  answers: Array<string>,
  questions: Array<{ name: string; id: string }>,
  exerciseId: Exercise['id'],
  courseId: Course['id'],
  groupMemberId: Groupmember['id'] | undefined
) {
  if (!groupMemberId) {
    return;
  }

  const questionsByName = questions.reduce(
    (acc, q) => ({ ...acc, [q.name]: q.id }),
    {}
  ) as LooseObject;
  const questionAnswers = [];

  const { data: submission } = await supabase
    .from('submission')
    .insert({
      submitted_by: groupMemberId,
      exercise_id: exerciseId,
      course_id: courseId
    })
    .select();

  for (const questionName in answers) {
    const value = answers[questionName];

    const questionAnswer = {
      group_member_id: groupMemberId,
      question_id: questionsByName[questionName],
      open_answer: '',
      answers: [],
      submission_id: Array.isArray(submission) ? submission[0].id : null
    };

    if (typeof value === 'string') {
      questionAnswer.open_answer = value;
    } else {
      questionAnswer.answers = value;
    }

    questionAnswers.push(questionAnswer);
  }

  const res = await supabase.from('question_answer').insert(questionAnswers).select();
  console.log(`res`, res, 'submission', submission);
  return {
    submission,
    res
  };
}

export async function deleteExercise(questions: Array<{ id: string }>, exerciseId: Exercise['id']) {
  for (const question of questions) {
    const { id } = question;

    await supabase.from('option').delete().match({ question_id: id });
    await supabase.from('question_answer').delete().match({ question_id: id });

    await supabase.from('question').delete().match({ id });
  }

  await supabase.from('submission').delete().match({ exercise_id: exerciseId });
  await supabase.from('exercise').delete().match({ id: exerciseId });
}

// ============================================================
// Exam System Service Functions
// ============================================================

interface ExamExerciseInput {
  title: string;
  description?: string;
  lesson_id: string;
  course_id: string;
  due_by?: string;
  duration_minutes?: number;
  attempts_allowed?: number;
  passing_score?: number;
  show_result_policy?: string;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  available_from?: string;
  available_until?: string;
  settings?: Record<string, any>;
}

interface ExamSettingsInput {
  title?: string;
  description?: string;
  duration_minutes?: number;
  attempts_allowed?: number;
  passing_score?: number;
  show_result_policy?: string;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  available_from?: string;
  available_until?: string;
  settings?: Record<string, any>;
}

/**
 * Create a new exam exercise (assessment_type = 'exam').
 * Uses server endpoint for authorization and validation.
 */
export async function createExamExercise(input: ExamExerciseInput) {
  try {
    const token = await getAccessToken();
    const res = await fetch('/api/exams/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(input)
    });
    const json = await res.json();
    if (!json.success) {
      return { data: null, error: { message: json.message || 'Failed to create exam' } as PostgrestError };
    }
    return { data: [json.exam], error: null };
  } catch (e) {
    console.error('createExamExercise error:', e);
    return {
      data: null,
      error: { message: e instanceof Error ? e.message : 'Network error' } as PostgrestError
    };
  }
}

/**
 * Update exam-specific settings for an existing exercise.
 */
export async function updateExamSettings(
  exerciseId: Exercise['id'],
  settings: ExamSettingsInput
) {
  const payload: Record<string, any> = {};

  if (settings.title !== undefined) payload.title = settings.title;
  if (settings.description !== undefined) payload.description = settings.description;
  if (settings.duration_minutes !== undefined) payload.duration_minutes = settings.duration_minutes;
  if (settings.attempts_allowed !== undefined) payload.attempts_allowed = settings.attempts_allowed;
  if (settings.passing_score !== undefined) payload.passing_score = settings.passing_score;
  if (settings.show_result_policy !== undefined) payload.show_result_policy = settings.show_result_policy;
  if (settings.shuffle_questions !== undefined) payload.shuffle_questions = settings.shuffle_questions;
  if (settings.shuffle_options !== undefined) payload.shuffle_options = settings.shuffle_options;
  if (settings.available_from !== undefined) payload.available_from = settings.available_from;
  if (settings.available_until !== undefined) payload.available_until = settings.available_until;
  if (settings.settings !== undefined) payload.settings = settings.settings;

  if (Object.keys(payload).length === 0) {
    return { data: null, error: null };
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/exams/${exerciseId}/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('updateExamSettings API error:', result);
      return {
        data: null,
        error: { message: result.message || 'Failed to update exam settings' } as PostgrestError
      };
    }

    return { data: result.exam, error: null };
  } catch (err) {
    console.error('updateExamSettings network error:', err);
    return {
      data: null,
      error: { message: 'Network error while updating exam settings' } as PostgrestError
    };
  }
}

/**
 * Fetch all exam exercises for a given course.
 */
export async function fetchCourseExams(courseId: Course['id']) {
  if (!courseId) return { data: [], error: null };

  const { data: lessons, error: lessonError } = await supabase
    .from('lesson')
    .select('id')
    .eq('course_id', courseId);

  if (lessonError || !lessons || lessons.length === 0) {
    return { data: [], error: lessonError };
  }

  const lessonIds = lessons.map((l) => l.id);

  const { data, error } = await supabase
    .from('exercise')
    .select('*')
    .in('lesson_id', lessonIds)
    .eq('assessment_type', 'exam')
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

/**
 * Fetch all exam exercises for a given lesson.
 */
export async function fetchLessonExams(lessonId: Lesson['id']) {
  if (!lessonId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('exercise')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('assessment_type', 'exam')
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

/**
 * Publish an exam by setting published_at to now().
 */
export async function publishExam(exerciseId: Exercise['id']) {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/exams/${exerciseId}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'publish' })
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('publishExam API error:', result);
      return {
        data: null,
        error: { message: result.message || 'Failed to publish exam' } as PostgrestError
      };
    }

    return { data: result.exam, error: null };
  } catch (err) {
    console.error('publishExam network error:', err);
    return {
      data: null,
      error: { message: 'Network error while publishing exam' } as PostgrestError
    };
  }
}

/**
 * Unpublish an exam by clearing published_at.
 */
export async function unpublishExam(exerciseId: Exercise['id']) {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/exams/${exerciseId}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'unpublish' })
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('unpublishExam API error:', result);
      return {
        data: null,
        error: { message: result.message || 'Failed to unpublish exam' } as PostgrestError
      };
    }

    return { data: result.exam, error: null };
  } catch (err) {
    console.error('unpublishExam network error:', err);
    return {
      data: null,
      error: { message: 'Network error while unpublishing exam' } as PostgrestError
    };
  }
}

/**
 * Delete an exam permanently (teacher/admin only).
 */
export async function deleteExam(exerciseId: Exercise['id']) {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/exams/${exerciseId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('deleteExam API error:', result);
      return {
        error: { message: result.message || 'Failed to delete exam' } as PostgrestError
      };
    }

    return { error: null };
  } catch (err) {
    console.error('deleteExam network error:', err);
    return {
      error: { message: 'Network error while deleting exam' } as PostgrestError
    };
  }
}

/**
 * Fetch a single exam exercise by id, ensuring assessment_type='exam'.
 * Includes questions and options.
 */
export async function fetchExamById(exerciseId: Exercise['id']) {
  if (!exerciseId) return { data: null, error: null };

  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/exams/${exerciseId}/detail`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('fetchExamById API error:', result);
      return {
        data: null,
        error: { message: result.message || 'Failed to load exam' } as PostgrestError
      };
    }

    const data = result.exam;

    if (Array.isArray(data.questions)) {
      data.questions.forEach((question: any) => {
        question.question_type = QUESTION_TYPES.find(
          (type) => type.id === question.question_type?.id
        ) || question.question_type;
      });
      data.questions = data.questions.sort((a: any, b: any) => a.order - b.order);
    } else {
      data.questions = [];
    }

    return { data, error: null };
  } catch (err) {
    console.error('fetchExamById network error:', err);
    return {
      data: null,
      error: { message: 'Network error while loading exam' } as PostgrestError
    };
  }
}

/**
 * Fetch all exam exercises for an organization.
 * Uses lesson -> course join to filter by organization_id.
 */
export async function fetchOrgExams(orgId: string) {
  if (!orgId) return { data: [], error: null };

  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/org/${orgId}/exams`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('fetchOrgExams API error:', result);
      return {
        data: [],
        error: { message: result.message || 'Failed to load exams' } as PostgrestError
      };
    }

    return { data: result.exams || [], error: null };
  } catch (err) {
    console.error('fetchOrgExams network error:', err);
    return {
      data: [],
      error: { message: 'Network error while loading exams' } as PostgrestError
    };
  }
}

// ============================================================
// Student Exam Flow Service Functions
// ============================================================

const SUBMISSION_STATUS = {
  SUBMITTED: 1,
  IN_PROGRESS: 2,
  GRADED: 3
};

/**
 * Fetch a published exam for student viewing via server endpoint.
 * Server handles availability checks, strips is_correct, and returns attempt state.
 */
export async function fetchStudentExam(exerciseId: Exercise['id'], courseId: Course['id']) {
  if (!exerciseId || !courseId) return { data: null, error: { message: 'Missing exam or course ID' } as PostgrestError };

  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/exams/${exerciseId}?courseId=${courseId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.message || `HTTP ${res.status}`;
      return { data: null, error: { message: `HTTP ${res.status}: ${msg}` } as PostgrestError };
    }

    const json = await res.json().catch(() => null);
    if (!json) {
      return { data: null, error: { message: 'Invalid response from server' } as PostgrestError };
    }
    if (!json.success) {
      return { data: null, error: { message: json.message || 'Failed to load exam' } as PostgrestError };
    }
    return { data: json, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Network error' } as PostgrestError };
  }
}

/**
 * Fetch the latest submission (attempt) for a student on a given exam.
 */
export async function fetchExamAttempt(exerciseId: Exercise['id'], groupMemberId: string) {
  if (!exerciseId || !groupMemberId) return { data: null, error: null };

  const { data, error } = await supabase
    .from('submission')
    .select(
      `
      *,
      answers:question_answer(*, question:question_id(*))
    `
    )
    .eq('exercise_id', exerciseId)
    .eq('submitted_by', groupMemberId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

/**
 * Count how many attempts a student has made for an exam.
 */
export async function countExamAttempts(exerciseId: Exercise['id'], groupMemberId: string) {
  if (!exerciseId || !groupMemberId) return { count: 0, error: null };

  const { count, error } = await supabase
    .from('submission')
    .select('*', { count: 'exact', head: true })
    .eq('exercise_id', exerciseId)
    .eq('submitted_by', groupMemberId);

  return { count: count || 0, error };
}

/**
 * Start a new exam attempt via server endpoint.
 * Server handles availability, attempts limit, membership verification, and resume logic.
 */
export async function startExamAttempt(
  exerciseId: Exercise['id'],
  courseId: Course['id']
) {
  if (!exerciseId || !courseId) {
    return { data: null, error: { message: 'Missing required fields' } as PostgrestError };
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/exams/${exerciseId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ courseId })
    });
    const json = await res.json();
    if (!json.success) {
      return { data: null, error: { message: json.message || 'Failed to start exam' } as PostgrestError };
    }
    return { data: json.submission, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Network error' } as PostgrestError };
  }
}

/**
 * Submit an exam attempt via server endpoint.
 * Server handles ownership verification, auto-scoring, and submission finalization.
 * Client must NOT pass questions or groupMemberId; only answers are sent.
 */
export async function submitExamAttempt(
  exerciseId: Exercise['id'],
  courseId: Course['id'],
  submissionId: string,
  answers: Record<string, string | string[]>
) {
  if (!exerciseId || !courseId || !submissionId) {
    return { data: null, error: { message: 'Missing required fields' } as PostgrestError };
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/exams/${exerciseId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ courseId, submissionId, answers })
    });
    const json = await res.json();
    if (!json.success) {
      return { data: null, error: { message: json.message || 'Failed to submit exam' } as PostgrestError };
    }
    return { data: json, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Network error' } as PostgrestError };
  }
}

// ============================================================
// Course Join Request Service Functions
// ============================================================

export async function searchCourseByCode(code: string) {
  try {
    const res = await fetch(`/api/courses/search?code=${encodeURIComponent(code)}`);
    const json = await res.json();
    if (!json.success) {
      return { data: null, error: { message: json.message } as PostgrestError };
    }
    return { data: json.course, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Network error' } as PostgrestError };
  }
}

export async function submitJoinRequest(courseId: string) {
  try {
    const token = await getAccessToken();
    const res = await fetch('/api/courses/join-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ courseId })
    });
    const json = await res.json();
    if (!json.success) {
      return { data: null, error: { message: json.message } as PostgrestError };
    }
    return { data: json.request, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'Network error' } as PostgrestError };
  }
}

export async function fetchJoinRequests(courseId: string, status = 'pending') {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/courses/${courseId}/join-requests?status=${status}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();
    if (!json.success) {
      return { data: [], error: { message: json.message } as PostgrestError };
    }
    return { data: json.requests || [], error: null };
  } catch (e) {
    return { data: [], error: { message: e instanceof Error ? e.message : 'Network error' } as PostgrestError };
  }
}

export async function approveJoinRequest(requestId: string) {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/courses/join-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    const json = await res.json();
    if (!json.success) {
      return { success: false, error: { message: json.message } as PostgrestError };
    }
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: { message: e instanceof Error ? e.message : 'Network error' } as PostgrestError };
  }
}

export async function rejectJoinRequest(requestId: string) {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/courses/join-requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    const json = await res.json();
    if (!json.success) {
      return { success: false, error: { message: json.message } as PostgrestError };
    }
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: { message: e instanceof Error ? e.message : 'Network error' } as PostgrestError };
  }
}
