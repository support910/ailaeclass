import { getSupabase, supabase } from '$lib/utils/functions/supabase';

import type { CurrentOrg } from '$lib/utils/types/org';
import type { MetaTagsProps } from 'svelte-meta-tags';
import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { blockedSubdomain } from '$lib/utils/constants/app';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getCurrentOrg } from '$lib/utils/services/org';
import { redirect } from '@sveltejs/kit';
import { BRAND } from '$lib/utils/config/brand';
import { isSingleOrgMode, getSingleOrgSiteName } from '$lib/utils/config/singleOrg';

if (!supabase) {
  getSupabase();
}

export const ssr = PUBLIC_IS_SELFHOSTED === 'true' ? false : true;

interface LoadOutput {
  orgSiteName: string;
  isOrgSite: boolean;
  skipAuth: boolean;
  org: CurrentOrg | null;
  baseMetaTags: MetaTagsProps;
  serverLang: string;
}

const APP_SUBDOMAINS = env.PRIVATE_APP_SUBDOMAINS?.split(',') || [];

export const load = async ({ url, cookies, request }): Promise<LoadOutput> => {
  const response: LoadOutput = {
    orgSiteName: '',
    isOrgSite: false,
    skipAuth: false,
    org: null,
    baseMetaTags: getBaseMetaTags(url),
    serverLang: request.headers?.get('accept-language') || ''
  };

  console.log('PUBLIC_IS_SELFHOSTED', PUBLIC_IS_SELFHOSTED);

  // Single-org mode: resolve the configured org directly, skip all subdomain/custom-domain logic
  if (isSingleOrgMode()) {
    const siteName = getSingleOrgSiteName()!;
    const org = (await getCurrentOrg(siteName, true)) || null;
    if (org) {
      response.org = org;
      response.isOrgSite = true;
      response.orgSiteName = siteName;
    } else if (!dev) {
      // Org configured but not found in DB — this is a deployment error
      console.error(`Single-org mode: organization with siteName "${siteName}" not found in database`);
      throw redirect(307, '/404?type=org_missing');
    }
    return response;
  }

  // Selfhosted usecase would be here
  if (PUBLIC_IS_SELFHOSTED === 'true') {
    const subdomain = getSubdomain(url);
    console.log('subdomain', subdomain);

    // Student dashboard
    if (subdomain) {
      const org = (await getCurrentOrg(subdomain, true)) || null;

      // Organization by subdomain not found
      if (!org) {
        return response;
      }

      response.org = org;
      response.isOrgSite = true;
      response.orgSiteName = subdomain;
    }

    // Never go beyond this for selfhosted instances
    return response;
  }

  const isLocalHost = url.host.includes('localhost');

  const tempSiteName = url.searchParams.get('org');

  if (isLocalHost && tempSiteName) {
    console.log('setting sitename temp');
    cookies.set('_orgSiteName', tempSiteName, {
      path: '/'
    });
  }

  const _orgSiteName = cookies.get('_orgSiteName');
  const debugPlay = cookies.get('debugPlay');
  const debugMode = _orgSiteName && _orgSiteName !== 'false';

  const subdomain = getSubdomain(url) || '';

  const isDev = dev || isLocalHost;

  if (isURLCustomDomain(url)) {
    // Custom domain
    response.org = (await getCurrentOrg(url.host, true, true)) || null;

    console.log('custom domain response.org', response.org);

    if (!response.org) {
      console.error('Custom domain org not found, loading dashboard');
      return response;
    }

    response.isOrgSite = true;
    response.orgSiteName = response.org?.siteName || '';
    return response;
  } else if (!blockedSubdomain.includes(subdomain)) {
    if (APP_SUBDOMAINS.includes(subdomain)) {
      // This is an app domain specified in the .env file
      return response;
    }

    console.log('subdomain', subdomain);

    response.isOrgSite = debugMode || !!subdomain;
    response.orgSiteName = debugMode ? _orgSiteName : subdomain;
    response.org = (await getCurrentOrg(response.orgSiteName, true)) || null;

    if (!response.org && !isDev) {
      throw redirect(307, '/404?type=org');
    } else if (!response.org && _orgSiteName) {
      cookies.delete('_orgSiteName', { path: '/' });
    }
  } else if (subdomain === 'play' || debugPlay === 'true') {
    response.skipAuth = true;
  } else if (!APP_SUBDOMAINS.includes(subdomain) && !isDev) {
    // This case is for anything in our blockedSubdomains
    throw redirect(307, '/');
  }

  return response;
};

function isURLCustomDomain(url: URL) {
  if (url.host.includes('localhost')) {
    return false;
  }

  const notCustomDomainHosts = [env.PRIVATE_APP_HOST || '', 'classroomio.com', 'vercel.app'].filter(
    Boolean
  );

  return !notCustomDomainHosts.some((host) => url.host.endsWith(host));
}

function getBaseMetaTags(url: URL) {
  return Object.freeze({
    title: `${BRAND.name} | ${BRAND.description}`,
    description:
      'A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations',
    canonical: new URL(url.pathname, url.origin).href,
    openGraph: {
      type: 'website',
      url: new URL(url.pathname, url.origin).href,
      locale: 'en_IE',
      title: `${BRAND.name} | ${BRAND.description}`,
      description:
        'A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations',
      siteName: BRAND.name,
      images: [
        {
          url: `${url.origin}/logo-512.png`,
          alt: `${BRAND.name} OG Image`,
          width: 1920,
          height: 1080,
          secureUrl: `${url.origin}/logo-512.png`,
          type: 'image/png'
        }
      ]
    },
    twitter: {
      handle: `@${BRAND.shortName}`,
      site: `@${BRAND.shortName}`,
      cardType: 'summary_large_image' as const,
      title: `${BRAND.name} | ${BRAND.description}`,
      description:
        'A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations',
      image: `${url.origin}/logo-512.png`,
      imageAlt: `${BRAND.name} OG Image`
    }
  });
}

function getSubdomain(url: URL) {
  const host = url.hostname.replace('www.', '');
  const parts = host.split('.');
  const appHost = env.PRIVATE_APP_HOST;

  const appHostParts = appHost.split('.');
  const isAppHost = parts.slice(-appHostParts.length).join('.') === appHost;

  if (isAppHost) {
    // Subdomain exists only if extra part(s) before main domain
    return parts.length > appHostParts.length ? parts[0] : null;
  }

  return null;
}
