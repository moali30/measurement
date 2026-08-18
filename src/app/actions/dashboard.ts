/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { ExportFormResult } from '@/types/export';

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

    const { data: qs } = await supabase.from('questions').select('*').eq('form_id', formId).order('order_index', { ascending: true }).limit(1000);
    const { data: rs } = await supabase.from('responses').select('id, submitted_at').eq('form_id', formId).order('submitted_at', { ascending: false }).limit(500);
    
    let answerDocs: any[] = [];
    if (rs && rs.length > 0) {
      let offset = 0;
      while(true) {
        const { data: ans } = await supabase.from('response_answers').select('*').eq('form_id', formId).range(offset, offset + 999);
        if (!ans || ans.length === 0) break;
        answerDocs = answerDocs.concat(ans);
        if (ans.length < 1000) break;
        offset += 1000;
      }
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

export async function deleteQuestionServer(questionId: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteResponseServer(responseId: string, formId: string) {
  try {
    const supabase = createAdminClient();
    
    // Delete answers first
    const { error: ansError } = await supabase.from('response_answers').delete().eq('response_id', responseId);
    if (ansError) throw ansError;
    
    // Delete response
    const { error: respError } = await supabase.from('responses').delete().eq('id', responseId);
    if (respError) throw respError;
    
    // Decrement responses count
    const { data: form } = await supabase.from('forms').select('responses_count').eq('id', formId).single();
    if (form && form.responses_count > 0) {
      await supabase.from('forms').update({ responses_count: form.responses_count - 1 }).eq('id', formId);
    }
    
    return { success: true };
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

export async function duplicateFormServer(formId: string) {
  try {
    const supabase = createAdminClient();
    
    // 1. Fetch form
    const { data: form, error: fError } = await supabase.from('forms').select('*').eq('id', formId).single();
    if (fError || !form) throw fError || new Error("Form not found");
    
    // 2. Fetch questions
    const { data: questions, error: qError } = await supabase.from('questions').select('*').eq('form_id', formId).order('order_index', { ascending: true });
    if (qError) throw qError;
    
    // 3. Insert new form
    const { data: newForm, error: nError } = await supabase.from('forms').insert({
      title: form.title + " (نسخة)",
      description: form.description,
      status: "draft",
      slug: Math.random().toString(36).substring(2, 10),
      responses_count: 0,
      created_by: form.created_by,
      allow_anonymous: form.allow_anonymous,
      prevent_duplicate: form.prevent_duplicate,
      require_login: form.require_login,
      college_logo: form.college_logo,
      university_logo: form.university_logo,
      quality_logo: form.quality_logo
    }).select().single();
    if (nError) throw nError;
    
    // 4. Insert questions
    if (questions && questions.length > 0) {
      const qToInsert = questions.map(q => ({
        form_id: newForm.id,
        text: q.text,
        type: q.type,
        options: q.options,
        required: q.required,
        order_index: q.order_index,
        min_value: q.min_value,
        max_value: q.max_value,
        min_label: q.min_label,
        max_label: q.max_label
      }));
      const { error: insQError } = await supabase.from('questions').insert(qToInsert);
      if (insQError) throw insQError;
    }
    
    return { success: true, newFormId: newForm.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/* ------------------------------------------------------------------ */
/* تصدير نتائج الاستبيانات إلى Excel (بدون الحاجة لفتح الاستبيان)      */
/* ------------------------------------------------------------------ */

const EXPORT_PAGE_SIZE = 1000;

/** أنواع الأسئلة التي تُصدَّر كأرقام وليس كنص */
const NUMERIC_QUESTION_TYPES = new Set(['rating', 'linear_scale', 'number']);

/**
 * يجلب كل السجلات المرتبطة بنموذج معيّن على دفعات، بدون أي حد أقصى.
 * الترتيب الثابت إلزامي — بدونه قد تتكرر أو تسقط صفوف بين الدفعات.
 */
async function fetchAllByFormId(
  supabase: any,
  table: string,
  columns: string,
  formId: string,
  orderColumns: string[]
) {
  const out: any[] = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase.from(table).select(columns).eq('form_id', formId);
    for (const col of orderColumns) query = query.order(col, { ascending: true });

    const { data, error } = await query.range(offset, offset + EXPORT_PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    out.push(...data);
    if (data.length < EXPORT_PAGE_SIZE) break;
    offset += EXPORT_PAGE_SIZE;
  }

  return out;
}

/** يختار القيمة المناسبة للخلية حسب نوع السؤال */
function resolveAnswerValue(answer: any, questionType: string): string | number {
  if (!answer) return '';

  const hasNumber = answer.number_value !== null && answer.number_value !== undefined;
  const hasText = answer.text_value !== null && answer.text_value !== undefined && answer.text_value !== '';

  // الأسئلة الرقمية (تقييم / مقياس خطي) تُصدَّر كأرقام لتسهيل الحساب
  if (NUMERIC_QUESTION_TYPES.has(questionType) && hasNumber) return Number(answer.number_value);

  // غير ذلك: النص هو المصدر الأصلي — يحافظ على الأصفار البادئة والأرقام الطويلة
  if (hasText) return String(answer.text_value);
  if (hasNumber) return Number(answer.number_value);

  return '';
}

/**
 * يبني بيانات ورقة Excel لاستبيان واحد — يُستدعى من صفحة قائمة
 * الاستبيانات مباشرة دون الحاجة لفتح صفحة تفاصيل الاستبيان.
 *
 * التصدير الجماعي ينفّذ استدعاءً منفصلاً لكل استبيان حتى لا يتجاوز
 * أي طلب واحد مهلة التنفيذ على Vercel.
 */
export async function exportFormResponsesServer(formId: string): Promise<ExportFormResult> {
  try {
    if (!formId) return { success: false, error: 'لم يتم تحديد أي استبيان', sheet: null };

    // التحقق من الجلسة — بيانات الردود لا تُتاح إلا لمستخدم مسجّل الدخول
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'يجب تسجيل الدخول لتصدير النتائج', sheet: null };
    }

    const supabase = createAdminClient();

    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('id, title')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return { success: false, error: 'الاستبيان غير موجود', sheet: null };
    }

    const questions = await fetchAllByFormId(
      supabase, 'questions', 'id, text, type, order_index', formId, ['order_index', 'id']
    );
    const responses = await fetchAllByFormId(
      supabase, 'responses', 'id, submitted_at', formId, ['submitted_at', 'id']
    );
    const answers = responses.length
      ? await fetchAllByFormId(
          supabase, 'response_answers', 'id, response_id, question_id, text_value, number_value', formId, ['id']
        )
      : [];

    // فهرسة الإجابات: response_id -> question_id -> answer
    const byResponse = new Map<string, Map<string, any>>();
    for (const a of answers) {
      let bucket = byResponse.get(a.response_id);
      if (!bucket) { bucket = new Map(); byResponse.set(a.response_id, bucket); }
      bucket.set(a.question_id, a);
    }

    const headers = ['#', 'التاريخ', ...questions.map((q: any) => String(q.text || ''))];

    const rows = responses.map((r: any, idx: number) => {
      const bucket = byResponse.get(r.id);
      const row: (string | number | null)[] = [idx + 1, r.submitted_at || ''];

      for (const q of questions) {
        row.push(resolveAnswerValue(bucket?.get(q.id), String(q.type || '')));
      }

      return row;
    });

    return {
      success: true,
      sheet: {
        formId: form.id,
        title: form.title || 'استبيان',
        headers,
        rows,
        responsesCount: responses.length,
        questionsCount: questions.length,
      },
    };
  } catch (error: any) {
    console.error('exportFormResponsesServer:', formId, error?.message);
    return { success: false, error: error?.message || 'تعذّر تحميل بيانات الاستبيان', sheet: null };
  }
}
