import { createClient } from '@supabase/supabase-js';
import { getPublicEnv } from './env';

const { url, key, isConfigured } = getPublicEnv();

function getSafeUrl(url: string | undefined): string {
  if (!url) return 'https://placeholder.supabase.co';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

const safeUrl = getSafeUrl(url);
const safeKey = key || 'placeholder';

export const isSupabaseConfigured = isConfigured;
export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'kpi-app-auth-v2'
  }
});
