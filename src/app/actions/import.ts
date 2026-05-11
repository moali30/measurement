"use server";
import { Client, Databases, ID } from 'node-appwrite';
import { config } from '@/lib/config';

const API_KEY = process.env.APPWRITE_API_KEY || 'standard_2dca5d5f948513772e540167e6ac4e0eb306d46094b624f072d356c7633f07ba6c26e5e34693ecc704e1b2df5eef58feeaf9ac91fe8a441bf53b459feab16d83826afe218c557ef6f9f4ea802b14b6e0247f4481d62791208978afc5f4413177340a72f36f6fcc8fec2853dd6b27afe6a2ff631ae9e5f6c118085f20d03c2aab';

function getAdminClient() {
  return new Client()
    .setEndpoint(config.appwriteUrl)
    .setProject(config.projectId)
    .setKey(API_KEY);
}

/**
 * Create the form and questions in Appwrite.
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
    await databases.createDocument(dbId, "forms", newFormId, {
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
    });

    // Create questions in parallel (small batch)
    const questionIdMap: Record<string, string> = {};
    const qPromises = headers.map((header, i) => {
      if (!header) return Promise.resolve();
      const qId = ID.unique();
      questionIdMap[String(i)] = qId;
      return databases.createDocument(dbId, "questions", qId, {
        formId: newFormId,
        text: header,
        type: "likert",
        options: questionOptions,
        required: true,
        order: i,
        minValue: null,
        maxValue: null,
        minLabel: null,
        maxLabel: null,
      });
    });
    await Promise.all(qPromises);

    return { success: true, formId: newFormId, questionIdMap };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * FAST batch import: processes multiple rows at once using Admin SDK.
 * Admin API key bypasses per-user rate limits.
 */
export async function importBatchResponses(
  formId: string,
  headers: string[],
  dataRows: any[][],
  questionIdMap: Record<string, string>,
  startDateIso: string,
  maxDays: number
) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;
    const startDate = new Date(startDateIso);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      // Random submit date
      const randomDays = Math.floor(Math.random() * maxDays);
      const randomHours = Math.floor(Math.random() * 24);
      const randomMinutes = Math.floor(Math.random() * 60);
      const submitDate = new Date(startDate);
      submitDate.setDate(submitDate.getDate() + randomDays);
      submitDate.setHours(randomHours, randomMinutes, 0, 0);

      // Create response
      const responseId = ID.unique();
      await databases.createDocument(dbId, "responses", responseId, {
        formId,
        submittedAt: submitDate.toISOString(),
      });

      // Create ALL answers for this row in parallel (fast!)
      const answerPromises: Promise<any>[] = [];
      for (let j = 0; j < headers.length; j++) {
        if (!headers[j]) continue;
        const val = row[j];
        if (val !== undefined && val !== null && val !== "") {
          answerPromises.push(
            databases.createDocument(dbId, "response_answers", ID.unique(), {
              formId,
              responseId,
              questionId: questionIdMap[String(j)],
              numberValue: !isNaN(Number(val)) ? Number(val) : null,
              textValue: String(val),
            })
          );
        }
      }

      // Execute all answers for this row at once
      await Promise.all(answerPromises);
    }

    return { success: true, count: dataRows.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Legacy compatibility
export async function bulkImportAnswers(
  formId: string,
  headers: string[],
  dataRows: any[][],
  questionIdMap: Record<string, string>,
  startDateIso: string,
  maxDays: number,
  jwt?: string
) {
  return importBatchResponses(formId, headers, dataRows, questionIdMap, startDateIso, maxDays);
}

export async function bulkAddAnswers(
  formId: string,
  questionId: string,
  answersList: { responseId: string; textValue: string }[]
) {
  try {
    const databases = new Databases(getAdminClient());
    const dbId = config.databaseId;

    const promises = answersList.map(a =>
      databases.createDocument(dbId, "response_answers", ID.unique(), {
        formId,
        responseId: a.responseId,
        questionId,
        textValue: a.textValue,
      })
    );
    await Promise.all(promises);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function importSingleResponse(
  formId: string,
  headers: string[],
  rowData: any[],
  questionIdMap: Record<string, string>,
  submitDateIso: string
) {
  return importBatchResponses(formId, headers, [rowData], questionIdMap, submitDateIso, 0);
}
