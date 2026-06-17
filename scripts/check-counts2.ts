import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: forms } = await supabase.from('forms').select('id, title, slug').limit(50);
  console.log("Forms:", forms?.map(f => `${f.title} (${f.id})`).join('\n'));

  // Get first form
  const formId = forms?.[0]?.id;
  if (!formId) return;

  const { count: respCount } = await supabase.from('responses').select('id', { count: 'exact', head: true }).eq('form_id', formId);
  console.log(`Responses for ${formId}:`, respCount);

  const { count: ansCount } = await supabase.from('response_answers').select('id', { count: 'exact', head: true }).eq('form_id', formId);
  console.log(`Answers for ${formId}:`, ansCount);
}
check();
