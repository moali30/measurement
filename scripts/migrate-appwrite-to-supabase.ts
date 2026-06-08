import { Client as AppwriteClient, Databases, Users, Query } from 'node-appwrite';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// --- CONFIGURATION ---
const APPWRITE_URL = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_KEY = process.env.APPWRITE_API_KEY!;
const APPWRITE_DB = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Clients
const appwrite = new AppwriteClient()
  .setEndpoint(APPWRITE_URL)
  .setProject(APPWRITE_PROJECT)
  .setKey(APPWRITE_KEY);

const databases = new Databases(appwrite);
const users = new Users(appwrite);

const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function migrateData() {
  console.log('Starting Migration...');

  // 1. Migrate Users
  console.log('Migrating Users...');
  const appwriteUsers = await users.list();
  console.log(`Found ${appwriteUsers.users.length} users in Appwrite`);

  const { data: supabaseUsersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
      console.error('Failed to list Supabase users', listError);
      return;
  }
  
  const existingEmails = new Map<string, string>();
  supabaseUsersData.users.forEach(u => existingEmails.set(u.email || '', u.id));

  const userMap = new Map<string, string>(); // Appwrite ID -> Supabase ID

  for (const user of appwriteUsers.users) {
    let supabaseUserId = existingEmails.get(user.email);

    if (!supabaseUserId) {
        // Create user in Supabase Auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: user.email,
            email_confirm: true,
            password: 'ImportedUser123!', // Users will need to reset password
            user_metadata: { name: user.name, appwrite_id: user.$id }
        });

        if (createError) {
            console.error(`Failed to create user ${user.email}:`, createError.message);
            continue;
        }
        supabaseUserId = newUser.user.id;
        console.log(`Created user: ${user.email} (ID: ${supabaseUserId})`);
    } else {
        console.log(`User ${user.email} already exists in Supabase (ID: ${supabaseUserId})`);
    }
    userMap.set(user.$id, supabaseUserId);
  }

  // 2. Migrate Forms
  console.log('Migrating Forms...');
  let formsCursor = null;
  const formsToInsert = [];
  let appwriteFormsDocuments: any[] = [];
  do {
      const appwriteForms = await databases.listDocuments(APPWRITE_DB, 'forms', [Query.limit(5000)]);
      appwriteFormsDocuments = appwriteForms.documents;
      
      for (const form of appwriteForms.documents) {
          formsToInsert.push({
              title: form.title,
              description: form.description,
              created_by: userMap.get(form.createdBy) || null, // map if needed
              status: form.status,
              slug: form.slug,
              responses_count: form.responsesCount,
              allow_anonymous: form.allowAnonymous,
              prevent_duplicate: form.preventDuplicate,
              require_login: form.requireLogin,
              confirmation_msg: form.confirmationMsg,
              created_at: form.createdAt || form.$createdAt,
              updated_at: form.updatedAt || form.$updatedAt
          });
      }
      break; 
  } while (formsCursor);

  if (formsToInsert.length > 0) {
      const formIdMap = new Map<string, string>(); // Appwrite form ID -> Supabase form UUID
      
      for (const form of formsToInsert) {
          const { data: insertedForm, error } = await supabase.from('forms').upsert(form, { onConflict: 'slug' }).select().single();
          
          if (error) {
              console.error(`Error inserting form ${form.title}:`, error.message);
          } else if (insertedForm) {
              // Now we find the original Appwrite ID by looking it up in our formsToInsert by slug
              // slug is UNIQUE so it's a safe lookup
              const originalForm = appwriteFormsDocuments.find((d: any) => d.slug === insertedForm.slug);
              if (originalForm) {
                  formIdMap.set(originalForm.$id, insertedForm.id);
              }
          }
      }
      console.log(`Migrated forms. Form mapping created for ${formIdMap.size} forms.`);

      // 3. Migrate Questions
      console.log('Migrating Questions...');
      const questionsToInsert = [];
      const appwriteQuestions = await databases.listDocuments(APPWRITE_DB, 'questions', [Query.limit(5000)]); 
      
      const questionIdMap = new Map<string, string>(); // Appwrite question ID -> Supabase question UUID
      
      for (const q of appwriteQuestions.documents) {
          const supabaseFormId = formIdMap.get(q.formId);
          if (!supabaseFormId) {
             console.warn(`Skipping question ${q.$id} because form ${q.formId} not found in map`);
             continue;
          }
          
          const { data: insertedQuestion, error } = await supabase.from('questions').insert([{
              form_id: supabaseFormId,
              text: q.text,
              type: q.type,
              options: q.options || [],
              required: q.required,
              order_index: q.order,
              min_value: q.minValue,
              max_value: q.maxValue,
              min_label: q.minLabel,
              max_label: q.maxLabel
          }]).select().single();
          
          if (error) {
              console.error(`Error inserting question ${q.$id}:`, error.message);
          } else if (insertedQuestion) {
              questionIdMap.set(q.$id, insertedQuestion.id);
          }
      }
      console.log(`Migrated questions. Question mapping created for ${questionIdMap.size} questions.`);

      // 4. Migrate Responses
      console.log('Migrating Responses...');
      const appwriteResponses = await databases.listDocuments(APPWRITE_DB, 'responses', [Query.limit(5000)]);
      const responseIdMap = new Map<string, string>(); // Appwrite response ID -> Supabase response UUID
      
      for (const r of appwriteResponses.documents) {
          const supabaseFormId = formIdMap.get(r.formId);
          if (!supabaseFormId) continue;
          
          const { data: insertedResponse, error } = await supabase.from('responses').insert([{
              form_id: supabaseFormId,
              submitted_at: r.submittedAt || r.$createdAt
          }]).select().single();
          
          if (error) {
              console.error(`Error inserting response ${r.$id}:`, error.message);
          } else if (insertedResponse) {
              responseIdMap.set(r.$id, insertedResponse.id);
          }
      }
      console.log(`Migrated responses. Response mapping created for ${responseIdMap.size} responses.`);

      // 5. Migrate Response Answers
      console.log('Migrating Response Answers...');
      const answersToInsert = [];
      const appwriteAnswers = await databases.listDocuments(APPWRITE_DB, 'response_answers', [Query.limit(5000)]);
      
      for (const a of appwriteAnswers.documents) {
          const supabaseFormId = formIdMap.get(a.formId);
          const supabaseResponseId = responseIdMap.get(a.responseId);
          const supabaseQuestionId = questionIdMap.get(a.questionId);
          
          if (!supabaseFormId || !supabaseResponseId || !supabaseQuestionId) continue;
          
          answersToInsert.push({
              form_id: supabaseFormId,
              response_id: supabaseResponseId,
              question_id: supabaseQuestionId,
              text_value: a.textValue,
              number_value: a.numberValue
          });
      }
      
      const chunkSize = 500;
      for (let i = 0; i < answersToInsert.length; i += chunkSize) {
          const chunk = answersToInsert.slice(i, i + chunkSize);
          const { error } = await supabase.from('response_answers').insert(chunk);
          if (error) console.error('Error inserting response answers:', error.message);
      }
      console.log(`Migrated ${answersToInsert.length} response answers.`);
  }

  console.log('Migration Completed!');
}

migrateData().catch(console.error);
