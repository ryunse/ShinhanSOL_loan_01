import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('.env 파일에 SUPABASE_URL과 SUPABASE_ANON_KEY를 설정해주세요.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
