import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { count: resCount, error: err1 } = await supabase.from('responses').select('*', { count: 'exact', head: true });
  const { count: ansCount, error: err2 } = await supabase.from('response_answers').select('*', { count: 'exact', head: true });
  console.log('Responses:', resCount, err1);
  console.log('Answers:', ansCount, err2);
  
  // get one response and its answers
  const { data } = await supabase.from('responses').select('*, response_answers(*)').limit(1);
  console.log(JSON.stringify(data, null, 2));
}

check();
