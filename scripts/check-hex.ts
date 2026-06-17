import { createClient } from '@supabase/supabase-js';
import { Client as AppwriteClient, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const appwrite = new AppwriteClient().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const databases = new Databases(appwrite);
const APPWRITE_DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

function strToHex(str: string) {
  return str.split('').map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
}

async function check() {
  const { documents: aForms } = await databases.listDocuments(APPWRITE_DB, 'forms', [Query.limit(5000)]);
  const targetAppwriteForm = aForms.find(f => f.title.includes('استطلاع رأي طلاب البرنامج في صياغة رسالة'));
  if (!targetAppwriteForm) return;
  
  const { data: sForms } = await supabase.from('forms').select('id, title').eq('title', targetAppwriteForm.title);
  if (!sForms || sForms.length === 0) return;
  const sFormId = sForms[0].id;
  
  let allAppwriteQuestions: any[] = [];
  let lastId: string | null = null;
  while(true) {
    const q = [Query.limit(5000)];
    if (lastId) q.push(Query.cursorAfter(lastId));
    const { documents: aqs } = await databases.listDocuments(APPWRITE_DB, 'questions', q);
    allAppwriteQuestions = allAppwriteQuestions.concat(aqs);
    if (aqs.length < 5000) break;
    lastId = aqs[aqs.length - 1].$id;
  }
  
  const aQuestions = allAppwriteQuestions.filter(q => q.formId === targetAppwriteForm.$id);
  const { data: sQuestions } = await supabase.from('questions').select('id, text, form_id').limit(100000);
  const sqForForm = sQuestions?.filter(q => q.form_id === sFormId);
  
  if (aQuestions.length > 0 && sqForForm && sqForForm.length > 0) {
    console.log("Appwrite:", aQuestions[0].text);
    console.log("Hex:", strToHex(aQuestions[0].text));
    console.log("Supabase:", sqForForm[0].text);
    console.log("Hex:", strToHex(sqForForm[0].text));
  }
}
check();
