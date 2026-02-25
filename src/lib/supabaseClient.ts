import { createClient } from '@supabase/supabase-js';
import { getPublicEnv } from './env';

const { url, key } = getPublicEnv();

export const supabase = createClient(url, key);
