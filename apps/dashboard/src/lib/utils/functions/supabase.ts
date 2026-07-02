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
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null) continue; // Skip if null (shouldn't happen)
    if (/sb-[\w-]+-auth-token/.test(key)) {
      return true;
    }
  }

  return false;
};

const getStoredAccessToken = () => {
  if (!browser) return '';

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !/^sb-[\w-]+-auth-token$/.test(key)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const token =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token;
      if (token) return token;
    }
  } catch {
    return '';
  }

  return '';
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
