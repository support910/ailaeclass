import { PUBLIC_SINGLE_ORG_SITE_NAME } from '$env/static/public';

/**
 * Returns the single-org siteName if configured, or null if multi-tenant mode.
 * This is the single source of truth for "are we in single-org mode?".
 */
export function getSingleOrgSiteName(): string | null {
  return PUBLIC_SINGLE_ORG_SITE_NAME || null;
}

export function isSingleOrgMode(): boolean {
  return !!getSingleOrgSiteName();
}
