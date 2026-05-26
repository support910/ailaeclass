import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { config } from '$lib/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let wsTransport: any;
try {
  const wsModule = await import('ws');
  wsTransport = wsModule.default;
} catch {
  // ws not available, skip
}

export let supabase: SupabaseClient;

/**
 * Should only be called on server files
 *
 * @returns supabase
 */
export const getServerSupabase = () => {
  if (supabase) return supabase;

  const serviceRoleKey = env.PRIVATE_SUPABASE_SERVICE_ROLE || '';

  if (!serviceRoleKey) {
    throw new Error('Missing Supabase server config: PRIVATE_SUPABASE_SERVICE_ROLE is required.');
  }

  if (!dev && serviceRoleKey === 'some-key-here') {
    throw new Error('Invalid production Supabase config: PRIVATE_SUPABASE_SERVICE_ROLE is still using the placeholder value.');
  }

  const options: any = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  };
  if (wsTransport) {
    options.realtime = { transport: wsTransport };
  }

  supabase = createClient(
    config.supabaseConfig.url,
    serviceRoleKey,
    options
  );

  return supabase;
};

/**
 * Extract user ID from the Authorization Bearer token using Supabase auth verification.
 * This replaces the insecure `request.headers.get('user_id')` pattern.
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
