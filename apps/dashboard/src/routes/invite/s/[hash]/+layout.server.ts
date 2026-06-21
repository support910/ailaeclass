import { redirect } from '@sveltejs/kit';
import { getSupabase, supabase } from '$lib/utils/functions/supabase';
import { getCurrentOrg } from '$lib/utils/services/org';
import { getSingleOrgSiteName } from '$lib/utils/config/singleOrg';

if (!supabase) {
  getSupabase();
}

function decodeCourseInviteHash(hash: string) {
  const binary = atob(decodeURIComponent(hash));

  try {
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return binary;
  }
}

export const load = async ({ params = { hash: '' } }) => {
  try {
    const courseHashData = decodeCourseInviteHash(params.hash);
    console.log('courseHashData', courseHashData);

    const { id, name, description, orgSiteName } = JSON.parse(courseHashData);

    if (!id || !name || !description || !orgSiteName) {
      throw 'Validation failed';
    }

    // In single-org mode, always resolve to the configured org
    const resolvedOrgSiteName = getSingleOrgSiteName() || orgSiteName;
    const currentOrg = await getCurrentOrg(resolvedOrgSiteName, true);

    return {
      id,
      name,
      description,
      currentOrg
    };
  } catch (error) {
    console.error('Error decoding course invite params.hash', error);
    throw redirect(307, '/404');
  }
};
