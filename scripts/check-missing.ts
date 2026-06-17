import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: forms } = await supabase.from('forms').select('id, title, slug');
  
  if (!forms) return;

  for (const f of forms) {
    const { count: respCount } = await supabase.from('responses').select('id', { count: 'exact', head: true }).eq('form_id', f.id);
    const { count: ansCount } = await supabase.from('response_answers').select('id', { count: 'exact', head: true }).eq('form_id', f.id);
    
    if (respCount && respCount > 0 && (!ansCount || ansCount === 0)) {
       console.log(`Form ${f.title} (${f.id}) has ${respCount} responses but ${ansCount} answers! Slug: ${f.slug}`);
    }
  }
}
check();
