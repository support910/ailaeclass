import { redirect } from '@sveltejs/kit';

export const load = () => {
  throw redirect(307, 'https://www.npmjs.com/package/@ailaeclass/course-app');
};
