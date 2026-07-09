import { browser } from '$app/environment';
import { config } from '$lib/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let wsTransport: any;
if (!browser) {
  try {
    const wsModule = await import('ws');
    wsTransport = wsModule.default;
  } catch {
    // ws not available, skip
  }
}

export let supabase: SupabaseClient;

export const getSupabase = () => {
  if (supabase) return supabase;

  const options: any = {};
  if (!browser && wsTransport) {
    options.realtime = { transport: wsTransport };
  }

  supabase = createClient(config.supabaseConfig.url, config.supabaseConfig.anonKey, options);

  return supabase;
};

export const hasSession = async () => {
  const { data } = await getSupabase().auth.getSession();
  console.log('has session', data);

  return data.session !== null;
};

export const isSupabaseTokenInLocalStorage = () => {
  if (!browser) return false;

  const storageKey = getSupabaseStorageKey();
  return storageKey ? localStorage.getItem(storageKey) !== null : false;
};

const getSupabaseStorageKey = () => {
  try {
    const host = new URL(config.supabaseConfig.url).hostname;
    const projectRef = host.split('.')[0];
    return projectRef ? `sb-${projectRef}-auth-token` : '';
  } catch {
    return '';
  }
};

const readAccessTokenFromStorageValue = (raw: string) => {
  try {
    const parsed = JSON.parse(raw);
    return (
      parsed?.access_token ||
      parsed?.currentSession?.access_token ||
      parsed?.session?.access_token ||
      parsed?.[0]?.access_token ||
      ''
    );
  } catch {
    return '';
  }
};

const getStoredAccessToken = () => {
  if (!browser) return '';

  const storageKey = getSupabaseStorageKey();
  if (!storageKey) return '';

  const raw = localStorage.getItem(storageKey);
  if (!raw) return '';

  return readAccessTokenFromStorageValue(raw);
};

export const getAccessToken = async () => {
  const storedToken = getStoredAccessToken();

  try {
    const sessionPromise = getSupabase().auth.getSession();
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2000);
    });
    const result = await Promise.race([sessionPromise, timeoutPromise]);

    if (result && 'data' in result) {
      return result.data.session?.access_token || storedToken;
    }
  } catch {
    return storedToken;
  }

  return storedToken;
};
