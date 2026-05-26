import { getAccessToken } from '$lib/utils/functions/supabase';

export async function fetchExamMeta(examId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch(`/api/exams/${examId}/meta`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    return { data: null, error: { message: error } };
  }

  const body = await response.json();

  if (!body.success) {
    return { data: null, error: { message: body.message || 'Failed to load exam info' } };
  }

  return { data: body, error: null };
}

export async function fetchExamSubmissions(examId: string, courseId: string) {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `/api/exams/${examId}/submissions?courseId=${encodeURIComponent(courseId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { data: null, error: { message: error } };
  }

  const body = await response.json();

  if (!body.success) {
    return { data: null, error: { message: body.message || 'Failed to load submissions' } };
  }

  return { data: body, error: null };
}

export async function fetchExamSubmissionDetail(
  examId: string,
  submissionId: string,
  courseId: string
) {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `/api/exams/${examId}/submissions/${submissionId}?courseId=${encodeURIComponent(courseId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { data: null, error: { message: error } };
  }

  const body = await response.json();

  if (!body.success) {
    return { data: null, error: { message: body.message || 'Failed to load submission detail' } };
  }

  return { data: body, error: null };
}

export async function gradeExamSubmission(
  examId: string,
  submissionId: string,
  payload: {
    courseId: string;
    questionGrades: { questionAnswerId: string; point: number; feedback?: string }[];
    submissionFeedback?: string;
  }
) {
  const accessToken = await getAccessToken();

  const response = await fetch(`/api/exams/${examId}/submissions/${submissionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    return { data: null, error: { message: error } };
  }

  const body = await response.json();

  if (!body.success) {
    return { data: null, error: { message: body.message || 'Failed to save grades' } };
  }

  return { data: body, error: null };
}
