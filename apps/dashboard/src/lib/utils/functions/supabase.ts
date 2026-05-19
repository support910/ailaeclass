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

export const getAccessToken = async () => {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token || '';
};
