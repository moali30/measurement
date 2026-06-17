import { createClient } from '@supabase/supabase-js';
import { Client as AppwriteClient, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const appwrite = new AppwriteClient().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const databases = new Databases(appwrite);
const APPWRITE_DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

async function check() {
  const { documents: aForms } = await databases.listDocuments(APPWRITE_DB, 'forms', [Query.limit(5000)]);
  const targetAppwriteForm = aForms.find(f => f.title.includes('استطلاع رأي طلاب البرنامج في صياغة رسالة'));
  if (!targetAppwriteForm) { console.log("Not found in Appwrite"); return; }
  
  const { data: sForms } = await supabase.from('forms').select('id, title').eq('title', targetAppwriteForm.title);
  if (!sForms || sForms.length === 0) return;
  const sFormId = sForms[0].id;
  
  const { data: sQuestions } = await supabase.from('questions').select('id, text, form_id').eq('form_id', sFormId);
  
  console.log(`Supabase Questions for form:`);
  for (const sq of sQuestions || []) {
    console.log(` - ${sq.text}`);
  }
}
check();
