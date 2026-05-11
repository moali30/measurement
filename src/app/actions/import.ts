"use server";
import { Client, Databases, ID } from 'node-appwrite';
import { config } from '@/lib/config';

const API_KEY = process.env.APPWRITE_API_KEY || 'standard_f11ab7e4232ba688d25f054317b0604aa63631fa8431e8e503b3382560322812c4ddd2e0b3a8416c284f53f7a1ea2608c8f6eb7decad6dee859b49d8489fba75a69c20f0934bf74b89467e6fef4f0e3de2085801985b4da4c65248410312bdb7bd8d707723c6735c22cf84fb471e4ada9891a1145fed5142fb16b4cdb2d3c14b';

function getAdminClient() {
  return new Client()
    .setEndpoint(config.appwriteUrl)
    .setProject(config.projectId)
    .setKey(API_KEY);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const isRateLimit = e?.code === 429 || e?.message?.includes('Rate limit');
      if (isRateLimit && attempt < maxAttempts - 1) {
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        const waitTime = Math.pow(2, attempt + 1) * 1000;
        await delay(waitTime);
      } else if (attempt < maxAttempts - 1) {
        await delay(1000);
      } else {
        throw e;
      }
    }
  }
  throw new Error('Max retry attempts reached');
}

/**
 * Import a single response row with all its answers.
 * Called one row at a time from the client to allow progress tracking.
 */
export async function importSingleResponse(
  formId: string,
  headers: string[],
  rowData: any[],
  questionIdMap: Record<string, string>,
  submitDateIso: string
) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;

    // 1. Create the response document
    const responseId = ID.unique();
    await withRetry(() =>
      databases.createDocument(dbId, "responses", responseId, {
        formId,
        submittedAt: submitDateIso,
      })
    );

    // 2. Create answer documents one by one with delay
    for (let j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      const val = rowData[j];
      if (val !== undefined && val !== null && val !== "") {
        await withRetry(() =>
          databases.createDocument(dbId, "response_answers", ID.unique(), {
            formId,
            responseId,
            questionId: questionIdMap[j],
            numberValue: !isNaN(Number(val)) ? Number(val) : null,
            textValue: String(val),
          })
        );
        // Small delay between each answer to avoid rate limits
        await delay(100);
      }
    }

    return { success: true, responseId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create the form and questions in Appwrite.
 * Returns the form ID and question ID map.
 */
export async function createFormWithQuestions(
  title: string,
  description: string,
  createdBy: string,
  slug: string,
  headers: string[],
  totalResponses: number,
  startDateIso: string,
  questionOptions: string[]
) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;

    // Create form
    const newFormId = ID.unique();
    await withRetry(() =>
      databases.createDocument(dbId, "forms", newFormId, {
        title,
        description,
        createdBy,
        status: "active",
        slug,
        responsesCount: totalResponses,
        allowAnonymous: true,
        preventDuplicate: false,
        requireLogin: false,
        createdAt: startDateIso,
        updatedAt: startDateIso,
      })
    );

    // Create questions
    const questionIdMap: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      const qId = ID.unique();
      await withRetry(() =>
        databases.createDocument(dbId, "questions", qId, {
          formId: newFormId,
          text: headers[i],
          type: "likert",
          options: questionOptions,
          required: true,
          order: i,
          minValue: null,
          maxValue: null,
          minLabel: null,
          maxLabel: null,
        })
      );
      questionIdMap[String(i)] = qId;
      await delay(200);
    }

    return { success: true, formId: newFormId, questionIdMap };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Keep legacy functions for backward compatibility
export async function bulkImportAnswers(
  formId: string,
  headers: string[],
  dataRows: any[][],
  questionIdMap: Record<string, string>,
  startDateIso: string,
  maxDays: number,
  jwt?: string
) {
  try {
    const client = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId);

    if (jwt) {
      client.setJWT(jwt);
    } else {
      client.setKey(API_KEY);
    }

    const databases = new Databases(client);
    const dbId = config.databaseId;
    const startDate = new Date(startDateIso);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const randomDays = Math.floor(Math.random() * maxDays);
      const randomHours = Math.floor(Math.random() * 24);
      const randomMinutes = Math.floor(Math.random() * 60);
      const submitDate = new Date(startDate);
      submitDate.setDate(submitDate.getDate() + randomDays);
      submitDate.setHours(randomHours, randomMinutes, 0, 0);

      const responseId = ID.unique();
      await withRetry(() =>
        databases.createDocument(dbId, "responses", responseId, {
          formId: formId,
          submittedAt: submitDate.toISOString(),
        })
      );

      for (let j = 0; j < headers.length; j++) {
        if (!headers[j]) continue;
        const val = row[j];
        if (val !== undefined && val !== null && val !== "") {
          await withRetry(() =>
            databases.createDocument(dbId, "response_answers", ID.unique(), {
              formId: formId,
              responseId: responseId,
              questionId: questionIdMap[j],
              numberValue: !isNaN(Number(val)) ? Number(val) : null,
              textValue: String(val),
            })
          );
          await delay(100);
        }
      }
      await delay(300);
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkAddAnswers(
  formId: string,
  questionId: string,
  answersList: { responseId: string; textValue: string }[]
) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;

    for (const a of answersList) {
      await withRetry(() =>
        databases.createDocument(dbId, "response_answers", ID.unique(), {
          formId,
          responseId: a.responseId,
          questionId,
          textValue: a.textValue,
        })
      );
      await delay(100);
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
