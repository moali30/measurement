import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: responses } = await supabase.from('responses').select('id, submitted_at').order('submitted_at', { ascending: false }).limit(5);
  console.log("Recent responses in Supabase:", responses);
}
check();
