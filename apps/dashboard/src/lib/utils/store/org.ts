import type { CurrentOrg, OrgAudience, OrgTeamMember } from '../types/org';
import { browser, dev } from '$app/environment';
import { derived, writable } from 'svelte/store';

import { PLAN } from 'shared/src/plans/constants';
import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { ROLE } from '$lib/utils/constants/roles';
import { STEPS } from '../constants/quiz';
import type { UserLessonDataType, Exercise } from '$lib/utils/types';
import type { Writable } from 'svelte/store';
import { isSingleOrgMode } from '$lib/utils/config/singleOrg';

// Trigger build
export const defaultCurrentOrgState: CurrentOrg = {
  id: '',
  name: '',
  shortName: '',
  siteName: '',
  avatar_url: '',
  memberId: '',
  role_id: 0,
  landingpage: {},
  customization: {
    apps: { poll: true, comments: true },
    course: { grading: true, newsfeed: true },
    dashboard: { exercise: true, community: true, bannerText: '', bannerImage: '' }
  },
  theme: '',
  organization_plan: [],
  is_restricted: false
};

export const orgs = writable<CurrentOrg[]>([]);
export const currentOrg: Writable<CurrentOrg> = writable(defaultCurrentOrgState);
export const orgAudience = writable<OrgAudience[]>([]);
export const orgTeam = writable<OrgTeamMember[]>([]);
export const isOrgAdmin = derived(currentOrg, ($currentOrg) => {
  if ($currentOrg.role_id === 0) return null;

  return $currentOrg.role_id === ROLE.ADMIN && $currentOrg.verified === true;
});

export const isOrgTeacher = derived(currentOrg, ($currentOrg) => {
  if ($currentOrg.role_id === 0) return null;

  return ($currentOrg.role_id === ROLE.ADMIN || $currentOrg.role_id === ROLE.TUTOR) && $currentOrg.verified === true;
});

const getActivePlan = (org: CurrentOrg) => {
  return org.organization_plan.find((p) => p.is_active);
};

export const currentOrgPlan = derived(currentOrg, ($currentOrg) => getActivePlan($currentOrg));

export const currentOrgPath = derived(currentOrg, ($currentOrg) =>
  $currentOrg.siteName ? `/org/${$currentOrg.siteName}` : '/org/*'
);

export const currentOrgDomain = derived(currentOrg, ($currentOrg) => {
  const browserOrigin = dev && browser && window.location.origin;

  // In single-org mode, the app domain IS the org domain
  if (isSingleOrgMode()) {
    return browserOrigin || (browser ? window.location.origin : '');
  }

  // Get the root domain from window.location
  let rootDomain = '';
  if (browser && typeof window !== 'undefined') {
    const host = window.location.hostname;
    const parts = host.split('.');
    if (parts.length >= 2) {
      rootDomain = parts.slice(-2).join('.');
    } else {
      rootDomain = host;
    }
  }

  return browserOrigin
    ? browserOrigin
    : $currentOrg.customDomain && $currentOrg.isCustomDomainVerified
      ? `https://${$currentOrg.customDomain}`
      : $currentOrg.siteName
        ? `https://${$currentOrg.siteName}.${rootDomain}`
        : '';
});

export const isFreePlan = derived(currentOrg, ($currentOrg) => {
  if (!$currentOrg.id || PUBLIC_IS_SELFHOSTED === 'true') return false;

  const plan = getActivePlan($currentOrg);

  return !plan || plan.plan_name === PLAN.BASIC;
});

export const currentOrgMaxAudience = derived(currentOrgPlan, ($plan) =>
  !$plan
    ? 20
    : $plan.plan_name === PLAN.EARLY_ADOPTER
      ? 10000
      : $plan.plan_name === PLAN.ENTERPRISE
        ? Number.MAX_SAFE_INTEGER
        : 20
);

// Quiz
export const createQuizModal = writable({
  open: false,
  openEdit: false,
  title: '',
  id: null
});

export const deleteModal = writable({
  id: null,
  open: false,
  isQuestion: false
});

interface QuizOption {
  id: number;
  label: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  id: number;
  label: string;
  type: string;
  options: QuizOption[];
}

interface QuizStore {
  uuid: string;
  title: string;
  questions: QuizQuestion[];
  timelimit: string;
  theme: string;
  pin: string;
}

export const quizesStore = writable<QuizStore[]>([]);

export const quizStore = writable<QuizStore>({
  uuid: '',
  title: '',
  questions: [],
  timelimit: '10s',
  theme: 'standard',
  pin: ''
});

export const playQuizStore = writable({
  step: STEPS.CONNECT_TO_PLAY
});

// Exam system stores
export const createExamModal = writable({
  open: false,
  title: '',
  description: '',
  courseId: '',
  lessonId: '',
  durationMinutes: 60,
  attemptsAllowed: 1,
  passingScore: 60,
  showResultPolicy: 'after_grade',
  isLoading: false
});

export const examsStore = writable<Exercise[]>([]);

export const userUpcomingData = writable<UserLessonDataType[]>([]);
