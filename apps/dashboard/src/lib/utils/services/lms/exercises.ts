import { supabase } from '$lib/utils/functions/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export interface LMSExercise {
  id: string;
  title: string;
  updated_at: string;
  questions: {
    points: number;
  }[];
  submission: {
    status_id: number;
    updated_at: string;
    total: number;
    groupmember: {
      id: string;
      profile: {
        id: string;
      }[];
    }[];
  }[];
  lesson: {
    id: string;
    title: string;
    order: number;
    course: {
      id: string;
      title: string;
      group: {
        organisation: {
          id: string;
        }[];
      }[];
      groupmember: {
        id: string;
        profile: {
          id: string;
        }[];
      }[];
    };
  };
}

interface FetchLMSExercisesResponse {
  exercises: LMSExercise[] | null;
  error: PostgrestError | null;
}

export async function fetchLMSExercises(
  profileId: string,
  orgId: string
): Promise<FetchLMSExercisesResponse> {
  try {
    // Step 1: Get all group_ids where the user is a member
    const { data: memberGroups, error: memberError } = await supabase
      .from('groupmember')
      .select('group_id')
      .eq('profile_id', profileId);

    if (memberError) {
      console.error('fetchLMSExercises memberGroups error:', memberError);
      return { exercises: null, error: memberError };
    }

    const groupIds = (memberGroups || []).map((m) => m.group_id).filter(Boolean);
    if (groupIds.length === 0) {
      return { exercises: [], error: null };
    }

    // Step 2: Get courses for those groups in this org
    const { data: courses, error: courseError } = await supabase
      .from('course')
      .select('id')
      .in('group_id', groupIds)
      .eq('status', 'ACTIVE');

    if (courseError) {
      console.error('fetchLMSExercises courses error:', courseError);
      return { exercises: null, error: courseError };
    }

    const courseIds = (courses || []).map((c) => c.id).filter(Boolean);
    if (courseIds.length === 0) {
      return { exercises: [], error: null };
    }

    // Step 3: Get unlocked lessons for those courses
    const { data: lessons, error: lessonError } = await supabase
      .from('lesson')
      .select('id')
      .in('course_id', courseIds)
      .eq('is_unlocked', true);

    if (lessonError) {
      console.error('fetchLMSExercises lessons error:', lessonError);
      return { exercises: null, error: lessonError };
    }

    const lessonIds = (lessons || []).map((l) => l.id).filter(Boolean);
    if (lessonIds.length === 0) {
      return { exercises: [], error: null };
    }

    // Step 4: Get exercises for those lessons
    const { data: exercises, error: exerciseError } = await supabase
      .from('exercise')
      .select(
        `
        id,
        title,
        updated_at,
        questions:question(points),
        lesson!inner (
          id,
          title,
          order,
          is_unlocked,
          course!inner (
            id,
            title
          )
        )
      `
      )
      .in('lesson_id', lessonIds);

    if (exerciseError) {
      console.error('fetchLMSExercises exercises error:', exerciseError);
      return { exercises: null, error: exerciseError };
    }

    if (!exercises || exercises.length === 0) {
      return { exercises: [], error: null };
    }

    // Step 5: Get the user's submissions for these exercises
    const exerciseIds = exercises.map((e: any) => e.id);
    const { data: submissions, error: subError } = await supabase
      .from('submission')
      .select('status_id, updated_at, total, exercise_id')
      .in('exercise_id', exerciseIds)
      .eq('submitted_by', profileId);

    if (subError) {
      console.error('fetchLMSExercises submissions error:', subError);
    }

    // Build a map of exercise_id -> submission
    const submissionMap: Record<string, any> = {};
    (submissions || []).forEach((sub: any) => {
      submissionMap[sub.exercise_id] = sub;
    });

    // Merge submissions into exercises
    const merged = exercises.map((ex: any) => ({
      ...ex,
      submission: submissionMap[ex.id]
        ? [
            {
              status_id: submissionMap[ex.id].status_id,
              updated_at: submissionMap[ex.id].updated_at,
              total: submissionMap[ex.id].total,
              groupmember: []
            }
          ]
        : [
            {
              status_id: 0,
              updated_at: ex.updated_at,
              total: 0,
              groupmember: []
            }
          ]
    }));

    return { exercises: merged as LMSExercise[], error: null };
  } catch (err: any) {
    console.error('fetchLMSExercises exception:', err);
    return { exercises: null, error: { message: err.message || 'Unknown error' } as PostgrestError };
  }
}
