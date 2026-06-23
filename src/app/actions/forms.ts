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
      .limit(1000);

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

    // 1. Server-side Validation: Form Status
    const { data: formDoc, error: fError } = await supabase.from('forms').select('status').eq('id', formId).single();
    if (fError || !formDoc) return { success: false, error: 'Form not found' };
    if (formDoc.status !== 'active') return { success: false, error: 'Form is closed' };

    // 2. Server-side Validation: Required Questions
    const { data: questions, error: qError } = await supabase.from('questions').select('id, required').eq('form_id', formId);
    if (qError) return { success: false, error: qError.message };

    const requiredQuestionIds = questions.filter(q => q.required).map(q => q.id);
    const providedAnswers = answersData.filter(a => Boolean(a.textValue?.trim()) || (a.numberValue !== null && a.numberValue !== undefined));
    const providedAnswerIds = new Set(providedAnswers.map(a => a.questionId));

    for (const reqId of requiredQuestionIds) {
      if (!providedAnswerIds.has(reqId)) {
        return { success: false, error: 'Missing required answer for a question' };
      }
    }

    // 3. Create response
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

    // 4. Update response count (using RPC for concurrency safety, fallback to direct update)
    const { error: rpcError } = await supabase.rpc('increment_responses_count', { row_id: formId });
    
    if (rpcError) {
      // Fallback if RPC is not yet created by the user
      const { data: formDocToUpdate } = await supabase.from('forms').select('responses_count').eq('id', formId).single();
      if (formDocToUpdate) {
        await supabase.from('forms').update({ responses_count: (formDocToUpdate.responses_count || 0) + 1 }).eq('id', formId);
      }
    }

    return { success: true, responseId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Upload a file for a form response
 */
export async function uploadFormFile(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) return { success: false, error: 'No file provided' };

    const supabase = createAdminClient();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Generate a unique filename
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const { data, error } = await supabase.storage.from('form_files').upload(fileName, buffer, {
      contentType: file.type,
      upsert: false
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: { publicUrl } } = supabase.storage.from('form_files').getPublicUrl(fileName);

    return { success: true, url: publicUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
