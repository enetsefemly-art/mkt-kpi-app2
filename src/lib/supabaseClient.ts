import { createClient } from '@supabase/supabase-js';
import { getPublicEnv } from './env';

const { url, key } = getPublicEnv();

// Fallback to prevent crash if env vars are missing
const safeUrl = url || 'https://placeholder.supabase.co';
const safeKey = key || 'placeholder';

export const supabase = createClient(safeUrl, safeKey);
