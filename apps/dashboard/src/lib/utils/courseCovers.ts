import type { Course } from '$lib/utils/types';

export type CourseCoverOption = {
  id: string;
  src: string;
  labelKey: string;
};

export const COURSE_COVER_OPTIONS: CourseCoverOption[] = [
  {
    id: 'classroom',
    src: '/images/course-covers/defaults/classroom.jpg',
    labelKey: 'courses.new_course_modal.cover_classroom'
  },
  {
    id: 'programming',
    src: '/images/course-covers/defaults/programming.jpg',
    labelKey: 'courses.new_course_modal.cover_programming'
  },
  {
    id: 'analytics',
    src: '/images/course-covers/defaults/analytics.jpg',
    labelKey: 'courses.new_course_modal.cover_analytics'
  },
  {
    id: 'robotics',
    src: '/images/course-covers/defaults/robotics.jpg',
    labelKey: 'courses.new_course_modal.cover_robotics'
  },
  {
    id: 'teamwork',
    src: '/images/course-covers/defaults/teamwork.jpg',
    labelKey: 'courses.new_course_modal.cover_teamwork'
  },
  {
    id: 'software-engineering',
    src: '/images/course-covers/defaults/software-engineering.jpg',
    labelKey: 'courses.new_course_modal.cover_engineering'
  },
  {
    id: 'library-learning',
    src: '/images/course-covers/defaults/library-learning.jpg',
    labelKey: 'courses.new_course_modal.cover_library'
  },
  {
    id: 'science-lab',
    src: '/images/course-covers/defaults/science-lab.jpg',
    labelKey: 'courses.new_course_modal.cover_science'
  },
  {
    id: 'drone-training',
    src: '/images/course-covers/generated/drone-flight-training.webp',
    labelKey: 'courses.new_course_modal.cover_drone'
  },
  {
    id: 'ai-chatbot',
    src: '/images/course-covers/generated/ai-chatbot-development.webp',
    labelKey: 'courses.new_course_modal.cover_ai'
  },
  {
    id: 'course-operations',
    src: '/images/course-covers/generated/lms-quality-operations.webp',
    labelKey: 'courses.new_course_modal.cover_operations'
  }
];

const FALLBACK_COVER = '/images/ailaeclass-course-img-template.jpg';

function hashTitle(value: string): number {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
}

export function getCourseCover(course?: Partial<Course> | null): string {
  if (course?.logo) return course.logo;

  const title = String(course?.title || '').toLowerCase();
  if (/无人机|無人機|drone|flycart|航空|飞行|飛行|大疆/.test(title)) {
    return '/images/course-covers/generated/drone-flight-training.webp';
  }
  if (/chatbot|聊天机器人|聊天機器人|poe/.test(title)) {
    return '/images/course-covers/generated/ai-chatbot-development.webp';
  }
  if (/联调|聯調|quality|operations|管理系统|管理系統/.test(title)) {
    return '/images/course-covers/generated/lms-quality-operations.webp';
  }
  if (/code|编程|編程|python|vscode|开发|開發/.test(title)) {
    return '/images/course-covers/defaults/programming.jpg';
  }

  if (!title) return FALLBACK_COVER;
  const defaults = COURSE_COVER_OPTIONS.slice(0, 8);
  return defaults[hashTitle(title) % defaults.length]?.src || FALLBACK_COVER;
}
