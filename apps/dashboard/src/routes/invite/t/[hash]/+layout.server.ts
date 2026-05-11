import { redirect } from '@sveltejs/kit';
import { getCurrentOrg } from '$lib/utils/services/org';
import { getSupabase, supabase } from '$lib/utils/functions/supabase';
import { getProfile } from '$lib/utils/functions/user';
import { getSingleOrgSiteName } from '$lib/utils/config/singleOrg';

if (!supabase) {
  getSupabase();
}

// we need to know if the email exists or not.
// with this we can only ask the user to accept
export const load = async ({ params = { hash: '' } }) => {
  try {
    const hashData = atob(decodeURIComponent(params.hash));
    console.log('hashData', hashData);

    const { orgId, email, orgSiteName } = JSON.parse(hashData);

    // In single-org mode, always resolve to the configured org
    const resolvedOrgSiteName = getSingleOrgSiteName() || orgSiteName;
    const currentOrg = await getCurrentOrg(resolvedOrgSiteName, true);

    const profile = await getProfile(email);
    console.log('profile data', profile);

    return {
      invite: {
        orgId: currentOrg?.id || orgId, // Use resolved org ID to avoid confusion
        email,
        currentOrg,
        profile
      }
    };
  } catch (error) {
    console.error('Error decoding invite params.hash', error);
    throw redirect(307, '/404');
  }
};
