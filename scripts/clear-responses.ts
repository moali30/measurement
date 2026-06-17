import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function clear() {
  console.log("Clearing responses...");
  while (true) {
    const { data: responses, error } = await supabase.from('responses').select('id').limit(100);
    if (error) { console.error("Error fetching responses:", error); break; }
    if (!responses || responses.length === 0) { console.log("All responses cleared!"); break; }
    
    const ids = responses.map(r => r.id);
    const { error: delError } = await supabase.from('responses').delete().in('id', ids);
    if (delError) { console.error("Error deleting:", delError); break; }
    
    console.log(`Deleted ${ids.length} responses...`);
  }
}
clear();
