import { redirect } from '@sveltejs/kit';
import { isSingleOrgMode } from '$lib/utils/config/singleOrg';

export const load = async () => {
  if (isSingleOrgMode()) {
    // Redirect to /lms — getProfile will handle role-based routing from there
    throw redirect(302, '/lms');
  }
};
