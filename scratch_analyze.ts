import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  const { data: forms } = await supabase.from('forms').select('id, title');
  if (!forms) return console.log("No forms");



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
        
        for (const q of qs) {
          const { count } = await supabase.from('answers').select('id', { count: 'exact', head: true }).eq('question_id', q.id);
          console.log(`  - Q ID: ${q.id} | Answers: ${count}`);
        }
      }
    }
  }
}

analyze().catch(console.error);
