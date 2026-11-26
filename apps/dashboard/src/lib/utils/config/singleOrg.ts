import { PUBLIC_SINGLE_ORG_SITE_NAME } from '$env/static/public';

/**
 * Returns the single-org siteName if configured, or null if multi-tenant mode.
 * This is the single source of truth for "are we in single-org mode?".
 */
export function getSingleOrgSiteName(): string | null {
  const configuredSiteName = PUBLIC_SINGLE_ORG_SITE_NAME?.trim();
  const siteName = configuredSiteName || 'admin';

  if (!siteName || ['false', '0', 'none', 'null', 'undefined', 'placeholder'].includes(siteName.toLowerCase())) {
    return null;
  }

  return siteName;
}

export function isSingleOrgMode(): boolean {
  return !!getSingleOrgSiteName();
}
