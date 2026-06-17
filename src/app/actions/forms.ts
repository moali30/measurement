"use server";
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Load form data by slug
 */
export async function loadFormBySlug(slug: string) {
  try {
    const supabase = createAdminClient();
    const decodedSlug = decodeURIComponent(slug);

    const { data: forms, error: formError } = await supabase
      .from('forms')
      .select('*')
      .eq('slug', decodedSlug)
      .limit(1);

    if (formError) {
      return { success: false, error: formError.message };
    }

    if (!forms || forms.length === 0) {
      return { success: false, error: "not_found" };
    }

    const formDoc = forms[0];

    if (formDoc.status !== "active") {
      return { success: false, error: "closed" };
    }

    // Load questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('form_id', formDoc.id)
      .order('order_index', { ascending: true })
      .limit(100);

    if (questionsError) {
      return { success: false, error: questionsError.message };
    }

    return {
      success: true,
      form: {
        $id: formDoc.id,
        title: formDoc.title,
        description: formDoc.description,
        status: formDoc.status,
        confirmationMsg: formDoc.confirmation_msg,
        collegeLogo: formDoc.college_logo,
        universityLogo: formDoc.university_logo,
        qualityLogo: formDoc.quality_logo,
      },
      questions: (questions || []).map((q: any) => ({
        $id: q.id,
        text: q.text,
        type: q.type,
        options: q.options || [],
        required: q.required || false,
        order: q.order_index,
        minValue: q.min_value,
        maxValue: q.max_value,
        minLabel: q.min_label,
        maxLabel: q.max_label,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Submit form response
 */
export async function submitFormResponse(
  formId: string,
  answersData: { questionId: string; textValue: string; numberValue?: number | null }[]
) {
  try {
    const supabase = createAdminClient();

    // Create response
    const { data: response, error: responseError } = await supabase
      .from('responses')
      .insert({ form_id: formId, submitted_at: new Date().toISOString() })
      .select()
      .single();

    if (responseError) {
      return { success: false, error: responseError.message };
    }

    const responseId = response.id;

    // Create all answers
    const answersToInsert = answersData.map(a => ({
      form_id: formId,
      response_id: responseId,
      question_id: a.questionId,
      text_value: a.textValue,
      number_value: a.numberValue ?? null,
    }));

    const { error: answersError } = await supabase
      .from('response_answers')
      .insert(answersToInsert);

    if (answersError) {
      return { success: false, error: answersError.message };
    }

    // Update response count (using RPC or direct update, direct for now)
    const { data: formDoc } = await supabase.from('forms').select('responses_count').eq('id', formId).single();
    if (formDoc) {
      await supabase.from('forms').update({ responses_count: (formDoc.responses_count || 0) + 1 }).eq('id', formId);
    }

    return { success: true, responseId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
