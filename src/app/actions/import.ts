"use server";
import { Client, Databases, ID } from 'node-appwrite';

import { config } from '@/lib/config';

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
      client.setKey(process.env.APPWRITE_API_KEY || '');
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
      await databases.createDocument(dbId, "responses", responseId, {
        formId: formId,
        submittedAt: submitDate.toISOString(),
      });
      
      const answerPromises = [];
      for (let j = 0; j < headers.length; j++) {
        if (!headers[j]) continue;
        const val = row[j];
        if (val !== undefined && val !== null && val !== "") {
          answerPromises.push(databases.createDocument(dbId, "response_answers", ID.unique(), {
            formId: formId,
            responseId: responseId,
            questionId: questionIdMap[j],
            numberValue: !isNaN(Number(val)) ? Number(val) : null,
            textValue: String(val)
          }));
        }
      }
      
      // Batch execute the answers for this row to save time, using the Server SDK to bypass rate limits
      const chunk = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, idx) => arr.slice(idx * size, idx * size + size));
      for (let c of chunk(answerPromises, 20)) {
        await Promise.all(c);
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkAddAnswers(formId: string, questionId: string, answersList: { responseId: string, textValue: string }[]) {
  try {
    const client = new Client()
      .setEndpoint(config.appwriteUrl)
      .setProject(config.projectId)
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);
    const dbId = config.databaseId;

    const promises = answersList.map(a => databases.createDocument(dbId, "response_answers", ID.unique(), {
      formId,
      responseId: a.responseId,
      questionId,
      textValue: a.textValue
    }));

    const chunk = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, idx) => arr.slice(idx * size, idx * size + size));
    for (let c of chunk(promises, 20)) {
      await Promise.all(c);
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
