"use server";
import { Client, Databases, Query, ID } from 'node-appwrite';
import { cookies } from 'next/headers';
import { config } from '@/lib/config';

const API_KEY = process.env.APPWRITE_API_KEY || 'standard_2dca5d5f948513772e540167e6ac4e0eb306d46094b624f072d356c7633f07ba6c26e5e34693ecc704e1b2df5eef58feeaf9ac91fe8a441bf53b459feab16d83826afe218c557ef6f9f4ea802b14b6e0247f4481d62791208978afc5f4413177340a72f36f6fcc8fec2853dd6b27afe6a2ff631ae9e5f6c118085f20d03c2aab';

function getAdminClient() {
  return new Client()
    .setEndpoint(config.appwriteUrl)
    .setProject(config.projectId)
    .setKey(API_KEY);
}

/**
 * List all forms - server-side, no CORS needed.
 */
export async function listFormsServer() {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;
    
    const r = await databases.listDocuments(dbId, "forms", [
      Query.orderDesc("$createdAt"),
      Query.limit(50),
    ]);
    
    return {
      success: true,
      forms: r.documents.map((d: any) => ({
        $id: d.$id,
        title: d.title,
        description: d.description || "",
        status: d.status,
        responsesCount: d.responsesCount || 0,
        createdAt: d.createdAt || d.$createdAt,
        slug: d.slug || "",
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message, forms: [] };
  }
}

/**
 * Delete a form - server-side.
 */
export async function deleteFormServer(formId: string) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;
    await databases.deleteDocument(dbId, "forms", formId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Toggle form status - server-side.
 */
export async function toggleFormStatusServer(formId: string, newStatus: string) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;
    await databases.updateDocument(dbId, "forms", formId, { status: newStatus });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Load full form details with questions, responses, and answers - server-side.
 */
export async function loadFormDetailServer(formId: string) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;

    const f = await databases.getDocument(dbId, "forms", formId);
    const qs = await databases.listDocuments(dbId, "questions", [
      Query.equal("formId", formId), Query.orderAsc("order"), Query.limit(100),
    ]);
    const rs = await databases.listDocuments(dbId, "responses", [
      Query.equal("formId", formId), Query.orderDesc("submittedAt"), Query.limit(500),
    ]);

    let answerDocs: any[] = [];
    if (rs.documents.length > 0) {
      const ans = await databases.listDocuments(dbId, "response_answers", [
        Query.equal("formId", formId), Query.limit(5000),
      ]);
      answerDocs = ans.documents;
    }

    return {
      success: true,
      form: { $id: f.$id, title: f.title, description: f.description || "", status: f.status, slug: f.slug, responsesCount: f.responsesCount || 0, createdAt: f.createdAt || f.$createdAt, collegeLogo: f.collegeLogo, universityLogo: f.universityLogo, qualityLogo: f.qualityLogo },
      questions: qs.documents.map((q: any) => ({ $id: q.$id, text: q.text, type: q.type, options: q.options || [], required: q.required || false, order: q.order, minLabel: q.minLabel, maxLabel: q.maxLabel, minValue: q.minValue, maxValue: q.maxValue })),
      responses: rs.documents.map((r: any) => ({ $id: r.$id, submittedAt: r.submittedAt })),
      answers: answerDocs.map((a: any) => ({ $id: a.$id, responseId: a.responseId, questionId: a.questionId, textValue: a.textValue, numberValue: a.numberValue, selectedOptions: a.selectedOptions })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update form details - server-side.
 */
export async function updateFormServer(formId: string, data: Record<string, any>) {
  try {
    const databases = new Databases(getAdminClient());
    await databases.updateDocument(config.databaseId, "forms", formId, data);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Save question (create or update) - server-side.
 */
export async function saveQuestionServer(questionId: string, formId: string, data: Record<string, any>, isNew: boolean) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;
    if (isNew) {
      const newDoc = await databases.createDocument(dbId, "questions", ID.unique(), { formId, ...data });
      return { success: true, newId: newDoc.$id };
    } else {
      await databases.updateDocument(dbId, "questions", questionId, data);
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a response with answers - server-side (for inline Excel import).
 */
export async function createResponseServer(formId: string, submittedAt: string) {
  try {
    const databases = new Databases(getAdminClient());
    const doc = await databases.createDocument(config.databaseId, "responses", ID.unique(), { formId, submittedAt });
    return { success: true, responseId: doc.$id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createAnswerServer(formId: string, responseId: string, questionId: string, textValue: string, numberValue?: number | null) {
  try {
    const databases = new Databases(getAdminClient());
    await databases.createDocument(config.databaseId, "response_answers", ID.unique(), {
      formId, responseId, questionId, textValue, numberValue: numberValue ?? null,
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
