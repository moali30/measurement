"use server";
import { createAdminClient } from '@/lib/supabase/server';

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
    const supabase = createAdminClient();

    // Create form
    const { data: formDoc, error: formError } = await supabase
      .from('forms')
      .insert({
        title,
        description,
        created_by: createdBy || null,
        status: "active",
        slug,
        responses_count: totalResponses,
        allow_anonymous: true,
        prevent_duplicate: false,
        require_login: false,
        created_at: startDateIso,
        updated_at: startDateIso,
      })
      .select()
      .single();

    if (formError) {
      return { success: false, error: formError.message };
    }

    const newFormId = formDoc.id;

    // Create questions
    const questionIdMap: Record<string, string> = {};
    const questionsToInsert = [];

    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      // Generate a temporary ID or just rely on returned DB IDs, but since we need a map:
      questionsToInsert.push({
        form_id: newFormId,
        text: headers[i],
        type: "likert",
        options: questionOptions,
        required: true,
        order_index: i,
        min_value: null,
        max_value: null,
        min_label: null,
        max_label: null,
      });
    }

    if (questionsToInsert.length > 0) {
      const { data: createdQuestions, error: qError } = await supabase
        .from('questions')
        .insert(questionsToInsert)
        .select();

      if (qError) {
        return { success: false, error: qError.message };
      }

      // Map back using order_index
      createdQuestions?.forEach(q => {
        questionIdMap[String(q.order_index)] = q.id;
      });
    }

    return { success: true, formId: newFormId, questionIdMap };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function importBatchResponses(
  formId: string,
  headers: string[],
  dataRows: any[][],
  questionIdMap: Record<string, string>,
  startDateIso: string,
  maxDays: number
) {
  try {
    const supabase = createAdminClient();
    const startDate = new Date(startDateIso);

    // Create responses first
    const responsesToInsert = dataRows.map(() => {
      const randomDays = Math.floor(Math.random() * maxDays);
      const randomHours = 9 + Math.floor(Math.random() * 8); // 9 AM to 4 PM
      const randomMinutes = Math.floor(Math.random() * 60);
      const submitDate = new Date(startDate);
      submitDate.setDate(submitDate.getDate() + randomDays);
      submitDate.setHours(randomHours, randomMinutes, 0, 0);

      return {
        form_id: formId,
        submitted_at: submitDate.toISOString(),
      };
    });

    // We need the returned IDs, so insert and select
    const { data: createdResponses, error: rError } = await supabase
      .from('responses')
      .insert(responsesToInsert)
      .select('id');

    if (rError || !createdResponses) {
      return { success: false, error: rError?.message || 'Failed to create responses' };
    }

    // Prepare answers
    const answersToInsert: any[] = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const responseId = createdResponses[i].id;

      for (let j = 0; j < headers.length; j++) {
        if (!headers[j]) continue;
        const val = row[j];
        if (val !== undefined && val !== null && val !== "") {
          answersToInsert.push({
            form_id: formId,
            response_id: responseId,
            question_id: questionIdMap[String(j)],
            number_value: !isNaN(Number(val)) ? Number(val) : null,
            text_value: String(val),
          });
        }
      }
    }

    // Insert answers in batches of 500
    const batchSize = 500;
    for (let i = 0; i < answersToInsert.length; i += batchSize) {
      const batch = answersToInsert.slice(i, i + batchSize);
      const { error: aError } = await supabase.from('response_answers').insert(batch);
      if (aError) {
        console.error("Batch insert error:", aError);
        // Continue trying other batches
      }
    }

    return { success: true, count: dataRows.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

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
    const supabase = createAdminClient();

    const answersToInsert = answersList.map(a => ({
      form_id: formId,
      response_id: a.responseId,
      question_id: questionId,
      text_value: a.textValue,
    }));

    // Insert in batches of 500
    const batchSize = 500;
    for (let i = 0; i < answersToInsert.length; i += batchSize) {
      const batch = answersToInsert.slice(i, i + batchSize);
      await supabase.from('response_answers').insert(batch);
    }
    
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
