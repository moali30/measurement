import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDuplicates() {
  const { data: forms } = await supabase.from('forms').select('id, title');
  if (!forms) return console.log("No forms");

  let totalDeleted = 0;

  for (const form of forms) {
    const { data: questions } = await supabase.from('questions').select('id, text, order_index').eq('form_id', form.id);
    if (!questions) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byText = new Map<string, any[]>();
    for (const q of questions) {
      if (!byText.has(q.text)) byText.set(q.text, []);
      byText.get(q.text)!.push(q);
    }

    const entries = Array.from(byText.entries());
    for (const [text, qs] of entries) {
      if (qs.length > 1) {
        console.log(`\nForm: ${form.title} | Question: ${text.substring(0, 50)}... (${qs.length} duplicates)`);
        
        // Find which ones have answers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const qsWithCounts = await Promise.all(qs.map(async (q: any) => {
          const { count } = await supabase.from('answers').select('*', { count: 'exact', head: true }).eq('question_id', q.id);
          return { ...q, count: count || 0 };
        }));

        qsWithCounts.sort((a, b) => b.count - a.count); // sort descending by answer count
        
        const toKeep = qsWithCounts[0];
        const toDelete = qsWithCounts.slice(1);
        
        console.log(`  - KEEPING: ${toKeep.id} (Answers: ${toKeep.count})`);
        
        for (const qDel of toDelete) {
          console.log(`  - DELETING: ${qDel.id} (Answers: ${qDel.count})`);
          // Execute delete
          await supabase.from('questions').delete().eq('id', qDel.id);
          totalDeleted++;
        }
      }
    }
  }
  
  console.log(`\nClean up finished! Total duplicate questions deleted: ${totalDeleted}`);
}

cleanDuplicates().catch(console.error);
