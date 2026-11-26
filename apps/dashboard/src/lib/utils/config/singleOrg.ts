import { PUBLIC_SINGLE_ORG_SITE_NAME } from '$env/static/public';

/**
 * Returns the single-org siteName if configured, or null if multi-tenant mode.
 * This is the single source of truth for "are we in single-org mode?".
 */
export function getSingleOrgSiteName(): string | null {
  const configuredSiteName = PUBLIC_SINGLE_ORG_SITE_NAME?.trim();

  // 未設定（或設成哨兵值）＝ 多機構模式。以前會 fallback 去 'admin'，
  // 令所有帳號被釘死在第一個機構，非學校機構帳號一登入就被塞入學校 org。
  if (!configuredSiteName) return null;

  if (['false', '0', 'none', 'null', 'undefined', 'placeholder'].includes(configuredSiteName.toLowerCase())) {
    return null;
  }

  return configuredSiteName;
}

export function isSingleOrgMode(): boolean {
  return !!getSingleOrgSiteName();
}
