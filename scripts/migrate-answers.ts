import { Client as AppwriteClient, Databases, Query } from 'node-appwrite';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const APPWRITE_URL = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_KEY = process.env.APPWRITE_API_KEY!;
const APPWRITE_DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const appwrite = new AppwriteClient()
  .setEndpoint(APPWRITE_URL)
  .setProject(APPWRITE_PROJECT)
  .setKey(APPWRITE_KEY);

const databases = new Databases(appwrite);
const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function getAllAppwriteDocuments(collectionId: string) {
  let allDocs: any[] = [];
  let lastId: string | null = null;
  console.log(`Fetching all documents for ${collectionId}...`);
  while (true) {
    const queries = [Query.limit(5000)];
    if (lastId) queries.push(Query.cursorAfter(lastId));
    
    let response: any;
    for (let attempts = 0; attempts < 5; attempts++) {
      try {
        response = await databases.listDocuments(APPWRITE_DB, collectionId, queries);
        break;
      } catch (err: any) {
        if (attempts === 4) throw err;
        console.log(`\nRetrying fetch due to error: ${err.message}...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (!response) throw new Error("Response is undefined after retries");
    allDocs = allDocs.concat(response.documents);
    process.stdout.write(`\rFetched ${allDocs.length} ${collectionId} so far...`);
    
    if (response.documents.length < 5000) break;
    lastId = response.documents[response.documents.length - 1].$id;
  }
  console.log();
  return allDocs;
}

async function run() {
  console.log('--- STARTING BULK MIGRATION OF RESPONSES AND ANSWERS ---');

  // 1. Deleting all existing responses in Supabase (cascades to answers)...
  console.log('1. Responses already cleared externally...');
  // const { error: deleteError } = await supabase.from('responses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // if (deleteError) {
  //   console.error('Failed to clear responses:', deleteError);
  //   return;
  // }
  console.log('Cleared existing responses successfully.');

  // 2. Fetch data from Appwrite
  console.log('2. Fetching data from Appwrite...');
  const appwriteForms = await getAllAppwriteDocuments('forms');
  const appwriteQuestions = await getAllAppwriteDocuments('questions');
  const appwriteResponses = await getAllAppwriteDocuments('responses');
  const appwriteAnswers = await getAllAppwriteDocuments('response_answers');

  // 3. Fetch forms/questions from Supabase
  console.log('3. Mapping Forms and Questions...');
  
  let supabaseForms: any[] = [];
  let formOffset = 0;
  while (true) {
    const { data } = await supabase.from('forms').select('id, slug').range(formOffset, formOffset + 999);
    if (!data || data.length === 0) break;
    supabaseForms = supabaseForms.concat(data);
    if (data.length < 1000) break;
    formOffset += 1000;
  }

  let supabaseQuestions: any[] = [];
  let qOffset = 0;
  while (true) {
    const { data } = await supabase.from('questions').select('id, form_id, text').range(qOffset, qOffset + 999);
    if (!data || data.length === 0) break;
    supabaseQuestions = supabaseQuestions.concat(data);
    if (data.length < 1000) break;
    qOffset += 1000;
  }

  const formIdMap = new Map<string, string>(); // Appwrite ID -> Supabase ID
  for (const aForm of appwriteForms) {
    const sForm = supabaseForms.find(f => f.slug === aForm.slug);
    if (sForm) formIdMap.set(aForm.$id, sForm.id);
  }

  const questionIdMap = new Map<string, string>();
  for (const aQuestion of appwriteQuestions) {
    const sFormId = formIdMap.get(aQuestion.formId);
    if (!sFormId) continue;
    const sQuestion = supabaseQuestions.find(q => q.form_id === sFormId && q.text.trim() === aQuestion.text.trim());
    if (sQuestion) questionIdMap.set(aQuestion.$id, sQuestion.id);
  }

  console.log(`Mapped ${formIdMap.size} forms and ${questionIdMap.size} questions.`);

  // 4. Prepare Responses
  console.log('4. Preparing Responses...');
  const responseIdMap = new Map<string, string>(); // Appwrite Response ID -> New UUID
  const responsesToInsert: any[] = [];

  for (const r of appwriteResponses) {
    const sFormId = formIdMap.get(r.formId);
    if (!sFormId) continue;

    const newUuid = crypto.randomUUID();
    responseIdMap.set(r.$id, newUuid);

    responsesToInsert.push({
      id: newUuid,
      form_id: sFormId,
      submitted_at: r.submittedAt || r.$createdAt
    });
  }

  // Insert Responses in chunks
  console.log(`Inserting ${responsesToInsert.length} responses...`);
  const CHUNK_SIZE = 500;
  for (let i = 0; i < responsesToInsert.length; i += CHUNK_SIZE) {
    const chunk = responsesToInsert.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('responses').insert(chunk);
    if (error) {
      console.error(`Error inserting responses at index ${i}:`, error.message);
    } else {
      process.stdout.write(`\rInserted ${Math.min(i + CHUNK_SIZE, responsesToInsert.length)} / ${responsesToInsert.length} responses`);
    }
  }
  console.log();

  // 5. Prepare Answers
  console.log('5. Preparing Answers...');
  const answersToInsert: any[] = [];

  for (const a of appwriteAnswers) {
    const sFormId = formIdMap.get(a.formId);
    const sResponseId = responseIdMap.get(a.responseId);
    const sQuestionId = questionIdMap.get(a.questionId);

    if (!sFormId || !sResponseId || !sQuestionId) continue;

    answersToInsert.push({
      form_id: sFormId,
      response_id: sResponseId,
      question_id: sQuestionId,
      text_value: a.textValue,
      number_value: a.numberValue
    });
  }

  // Insert Answers in chunks
  console.log(`Inserting ${answersToInsert.length} answers...`);
  for (let i = 0; i < answersToInsert.length; i += CHUNK_SIZE) {
    const chunk = answersToInsert.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('response_answers').insert(chunk);
    if (error) {
      console.error(`Error inserting answers at index ${i}:`, error.message);
    } else {
      process.stdout.write(`\rInserted ${Math.min(i + CHUNK_SIZE, answersToInsert.length)} / ${answersToInsert.length} answers`);
    }
  }
  console.log();

  console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
}

run().catch(console.error);
