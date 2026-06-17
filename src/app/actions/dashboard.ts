"use server";
import { createAdminClient } from '@/lib/supabase/server';

export async function listFormsServer() {
  try {
    const supabase = createAdminClient();
    
    const { data: forms, error } = await supabase
      .from('forms')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
      
    if (error) throw error;
    
    return {
      success: true,
      forms: forms.map((d: any) => ({
        $id: d.id,
        title: d.title,
        description: d.description || "",
        status: d.status,
        responsesCount: d.responses_count || 0,
        createdAt: d.created_at,
        slug: d.slug || "",
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message, forms: [] };
  }
}

export async function deleteFormServer(formId: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('forms').delete().eq('id', formId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleFormStatusServer(formId: string, newStatus: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('forms').update({ status: newStatus }).eq('id', formId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function loadFormDetailServer(formId: string) {
  try {
    const supabase = createAdminClient();

    const { data: f, error: fError } = await supabase.from('forms').select('*').eq('id', formId).single();
    if (fError) throw fError;

    const { data: qs } = await supabase.from('questions').select('*').eq('form_id', formId).order('order_index', { ascending: true }).limit(100);
    const { data: rs } = await supabase.from('responses').select('id, submitted_at').eq('form_id', formId).order('submitted_at', { ascending: false }).limit(500);
    
    let answerDocs: any[] = [];
    if (rs && rs.length > 0) {
      const { data: ans } = await supabase.from('response_answers').select('*').eq('form_id', formId).limit(5000);
      if (ans) answerDocs = ans;
    }

    return {
      success: true,
      form: { 
        $id: f.id, 
        title: f.title, 
        description: f.description || "", 
        status: f.status, 
        slug: f.slug, 
        responsesCount: f.responses_count || 0, 
        createdAt: f.created_at, 
        collegeLogo: f.college_logo,
        universityLogo: f.university_logo, 
        qualityLogo: f.quality_logo 
      },
      questions: (qs || []).map((q: any) => ({ $id: q.id, text: q.text, type: q.type, options: q.options || [], required: q.required || false, order: q.order_index, minLabel: q.min_label, maxLabel: q.max_label, minValue: q.min_value, maxValue: q.max_value })),
      responses: (rs || []).map((r: any) => ({ $id: r.id, submittedAt: r.submitted_at })),
      answers: answerDocs.map((a: any) => ({ $id: a.id, responseId: a.response_id, questionId: a.question_id, textValue: a.text_value, numberValue: a.number_value, selectedOptions: a.selectedOptions })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateFormServer(formId: string, data: Record<string, any>) {
  try {
    const supabase = createAdminClient();
    
    // Map standard fields
    const updateData: any = {};
    if ('responsesCount' in data) updateData.responses_count = data.responsesCount;
    if ('title' in data) updateData.title = data.title;
    if ('description' in data) updateData.description = data.description;
    if ('status' in data) updateData.status = data.status;
    if ('slug' in data) updateData.slug = data.slug;
    
    if ('collegeLogo' in data) updateData.college_logo = data.collegeLogo;
    if ('universityLogo' in data) updateData.university_logo = data.universityLogo;
    if ('qualityLogo' in data) updateData.quality_logo = data.qualityLogo;
    
    const { error } = await supabase.from('forms').update(updateData).eq('id', formId);
    if (error) throw error;
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function saveQuestionServer(questionId: string, formId: string, data: Record<string, any>, isNew: boolean) {
  try {
    const supabase = createAdminClient();
    
    const dbData: any = {
      form_id: formId,
      text: data.text,
      type: data.type,
      options: data.options,
      required: data.required,
      order_index: data.order,
      min_value: data.minValue,
      max_value: data.maxValue,
      min_label: data.minLabel,
      max_label: data.maxLabel,
    };
    
    // remove undefined
    Object.keys(dbData).forEach(k => dbData[k] === undefined && delete dbData[k]);

    if (isNew) {
      const { data: newDoc, error } = await supabase.from('questions').insert(dbData).select().single();
      if (error) throw error;
      return { success: true, newId: newDoc.id };
    } else {
      const { error } = await supabase.from('questions').update(dbData).eq('id', questionId);
      if (error) throw error;
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createResponseServer(formId: string, submittedAt: string) {
  try {
    const supabase = createAdminClient();
    const { data: doc, error } = await supabase.from('responses').insert({ form_id: formId, submitted_at: submittedAt }).select().single();
    if (error) throw error;
    return { success: true, responseId: doc.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createAnswerServer(formId: string, responseId: string, questionId: string, textValue: string, numberValue?: number | null) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('response_answers').insert({
      form_id: formId, response_id: responseId, question_id: questionId, text_value: textValue, number_value: numberValue ?? null,
    });
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createFormServer(
  formData: { title: string; description: string; createdBy: string; slug: string; collegeLogo?: string; universityLogo?: string; qualityLogo?: string; },
  questionsData: { text: string; type: string; options: string[]; required: boolean; order: number; minValue?: number | null; maxValue?: number | null; minLabel?: string | null; maxLabel?: string | null; }[]
) {
  try {
    const supabase = createAdminClient();

    const { data: formDoc, error: fError } = await supabase.from('forms').insert({
      title: formData.title,
      description: formData.description,
      created_by: formData.createdBy || null,
      status: "draft",
      slug: formData.slug,
      responses_count: 0,
      allow_anonymous: true,
      prevent_duplicate: false,
      require_login: false,
      college_logo: formData.collegeLogo,
      university_logo: formData.universityLogo,
      quality_logo: formData.qualityLogo,
    }).select().single();

    if (fError) throw fError;

    const qToInsert = questionsData.map(q => ({
      form_id: formDoc.id,
      text: q.text,
      type: q.type,
      options: q.options,
      required: q.required,
      order_index: q.order,
      min_value: q.minValue ?? null,
      max_value: q.maxValue ?? null,
      min_label: q.minLabel ?? null,
      max_label: q.maxLabel ?? null,
    }));

    if (qToInsert.length > 0) {
      const { error: qError } = await supabase.from('questions').insert(qToInsert);
      if (qError) throw qError;
    }

    return { success: true, formId: formDoc.id, slug: formData.slug };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteAnswersByQuestionServer(formId: string, questionId: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('response_answers').delete().eq('question_id', questionId);
    if (error) throw error;
    // Assuming supabase handles large deletes without chunking, but maybe chunking needed
    return { success: true, deleted: 1 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function enableSingleResponseForAllServer() {
  try {
    const supabase = createAdminClient();
    
    // This fetches all forms without '[single_response]' in description and adds it
    const { data: forms, error: listError } = await supabase.from('forms').select('id, description').not('description', 'ilike', '%[single_response]%');
    
    if (listError) throw listError;
    
    let updated = 0;
    if (forms) {
      for (const form of forms) {
        const desc = form.description || "";
        const newDesc = (desc + "\n[single_response]").substring(0, 2000);
        await supabase.from('forms').update({ description: newDesc }).eq('id', form.id);
        updated++;
      }
    }

    return { success: true, total: forms?.length || 0, updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
