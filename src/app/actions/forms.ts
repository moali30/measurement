"use server";
import { Client, Databases, Query, ID } from 'node-appwrite';
import { config } from '@/lib/config';

const API_KEY = process.env.APPWRITE_API_KEY || 'standard_2dca5d5f948513772e540167e6ac4e0eb306d46094b624f072d356c7633f07ba6c26e5e34693ecc704e1b2df5eef58feeaf9ac91fe8a441bf53b459feab16d83826afe218c557ef6f9f4ea802b14b6e0247f4481d62791208978afc5f4413177340a72f36f6fcc8fec2853dd6b27afe6a2ff631ae9e5f6c118085f20d03c2aab';

function getAdminClient() {
  return new Client()
    .setEndpoint(config.appwriteUrl)
    .setProject(config.projectId)
    .setKey(API_KEY);
}

/**
 * Load form data by slug - runs on the server, bypasses CORS.
 */
export async function loadFormBySlug(slug: string) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;
    const decodedSlug = decodeURIComponent(slug);

    const formsRes = await databases.listDocuments(dbId, "forms", [
      Query.equal("slug", decodedSlug),
      Query.limit(1),
    ]);

    if (formsRes.documents.length === 0) {
      return { success: false, error: "not_found" };
    }

    const formDoc = formsRes.documents[0];

    if (formDoc.status !== "active") {
      return { success: false, error: "closed" };
    }

    // Load questions
    const questionsRes = await databases.listDocuments(dbId, "questions", [
      Query.equal("formId", formDoc.$id),
      Query.orderAsc("order"),
      Query.limit(100),
    ]);

    return {
      success: true,
      form: {
        $id: formDoc.$id,
        title: formDoc.title,
        description: formDoc.description,
        status: formDoc.status,
        confirmationMsg: formDoc.confirmationMsg,
      },
      questions: questionsRes.documents.map((q: any) => ({
        $id: q.$id,
        text: q.text,
        type: q.type,
        options: q.options || [],
        required: q.required || false,
        order: q.order,
        minValue: q.minValue,
        maxValue: q.maxValue,
        minLabel: q.minLabel,
        maxLabel: q.maxLabel,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Submit form response - runs on the server, bypasses CORS.
 */
export async function submitFormResponse(
  formId: string,
  answersData: { questionId: string; textValue: string; numberValue?: number | null }[]
) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;

    // Create response
    const responseId = ID.unique();
    await databases.createDocument(dbId, "responses", responseId, {
      formId,
      submittedAt: new Date().toISOString(),
    });

    // Create all answers in parallel
    const answerPromises = answersData.map(a =>
      databases.createDocument(dbId, "response_answers", ID.unique(), {
        formId,
        responseId,
        questionId: a.questionId,
        textValue: a.textValue,
        numberValue: a.numberValue ?? null,
      })
    );
    await Promise.all(answerPromises);

    // Update response count
    try {
      const formDoc = await databases.getDocument(dbId, "forms", formId);
      const currentCount = (formDoc as any).responsesCount || 0;
      await databases.updateDocument(dbId, "forms", formId, {
        responsesCount: currentCount + 1,
      });
    } catch {}

    return { success: true, responseId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
