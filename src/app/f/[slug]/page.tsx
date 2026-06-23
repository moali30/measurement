"use client";

import { useState, useEffect } from "react";
import { loadFormBySlug, submitFormResponse, uploadFormFile } from "@/app/actions/forms";
import { toast } from "sonner";

interface Question {
  $id: string;
  text: string;
  type: string;
  options: string[];
  required: boolean;
  order: number;
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
}

interface FormData {
  $id: string;
  title: string;
  description: string;
  status: string;
  confirmationMsg?: string;
  collegeLogo?: string;
  universityLogo?: string;
  qualityLogo?: string;
}

export default function PublicFormPage({ params }: { params: { slug: string } }) {
  const [form, setForm] = useState<FormData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    loadForm();
  }, [params.slug]);

  const loadForm = async () => {
    try {
      // Use Server Action to bypass CORS - works on ALL devices
      const result = await loadFormBySlug(params.slug);
      
      if (!result.success) {
        setError(result.error || "error");
        setLoading(false);
        return;
      }

      const formDoc = result.form as FormData;

      if (formDoc.description?.includes("[single_response]")) {
        if (localStorage.getItem(`submitted_${formDoc.$id}`)) {
          setAlreadySubmitted(true);
          setLoading(false);
          return;
        }
      }

      setForm(formDoc);
      setQuestions(result.questions as Question[]);
    } catch (err) {
      console.error(err);
      setError("error");
    } finally {
      setLoading(false);
    }
  };

  const setAnswer = (qId: string, value: string | string[] | number) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
    setValidationErrors(prev => { const n = { ...prev }; delete n[qId]; return n; });
  };

  const toggleCheckbox = (qId: string, option: string) => {
    const current = (answers[qId] as string[]) || [];
    const updated = current.includes(option) ? current.filter(o => o !== option) : [...current, option];
    setAnswer(qId, updated);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    for (const q of questions) {
      if (q.required) {
        const a = answers[q.$id];
        if (!a || (Array.isArray(a) && a.length === 0) || (typeof a === "string" && !a.trim())) {
          errors[q.$id] = "هذا السؤال مطلوب";
        }
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !form) return;
    setSubmitting(true);
    try {
      // Build answers array for server action
      const answersData: { questionId: string; textValue: string; numberValue?: number | null }[] = [];
      
      for (const q of questions) {
        const a = answers[q.$id];
        if (a === undefined || a === null) continue;

        if (typeof a === "number") {
          answersData.push({ questionId: q.$id, textValue: String(a), numberValue: a });
        } else if (typeof a === "string") {
          answersData.push({ questionId: q.$id, textValue: a });
        } else if (Array.isArray(a)) {
          answersData.push({ questionId: q.$id, textValue: a.join(", ") });
        }
      }

      // Use Server Action to submit - bypasses CORS
      const result = await submitFormResponse(form.$id, answersData);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      if (form.description?.includes("[single_response]")) {
        localStorage.setItem(`submitted_${form.$id}`, "true");
      }

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء إرسال الإجابات. يرجى المحاولة مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">جاري تحميل الاستبيان...</p>
        </div>
      </div>
    );
  }

  // Error States
  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-md mx-4">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">الاستبيان غير موجود</h2>
          <p className="text-gray-500 text-sm">تأكد من صحة الرابط أو تواصل مع مُنشئ الاستبيان</p>
        </div>
      </div>
    );
  }

  if (error === "closed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-md mx-4">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">الاستبيان مغلق</h2>
          <p className="text-gray-500 text-sm">هذا الاستبيان لم يعد يقبل ردوداً جديدة</p>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-4 border-amber-500">
          <div className="w-20 h-20 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">عذراً</h2>
          <p className="text-gray-600 mb-6">لقد قمت بالرد على هذا الاستبيان مسبقاً. لا يُسمح بأكثر من رد واحد.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-md mx-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">حدث خطأ</h2>
          <p className="text-gray-500 text-sm">يرجى المحاولة مرة أخرى لاحقاً</p>
        </div>
      </div>
    );
  }

  // Success State
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-green-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-12 max-w-md mx-4">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">شكراً لك! ✨</h2>
          <p className="text-gray-500">
            {form?.confirmationMsg || "تم إرسال إجابتك بنجاح. نشكرك على وقتك ومشاركتك."}
          </p>
        </div>
      </div>
    );
  }

  // Form UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="h-2 bg-gradient-to-l from-blue-500 to-blue-700" />
          
          {/* Logos section */}
          {(form?.qualityLogo || form?.universityLogo || form?.collegeLogo) && (
            <div className="px-8 pt-8 flex justify-between items-center flex-wrap gap-4">
              <div className="w-24 flex justify-end">
                {form?.qualityLogo && <img src={form.qualityLogo} alt="شعار ضمان الجودة" className="max-h-20 object-contain" />}
              </div>
              <div className="flex-1 flex justify-center">
                {form?.universityLogo && <img src={form.universityLogo} alt="شعار الجامعة" className="max-h-20 object-contain" />}
              </div>
              <div className="w-24 flex justify-start">
                {form?.collegeLogo && <img src={form.collegeLogo} alt="شعار الكلية" className="max-h-20 object-contain" />}
              </div>
            </div>
          )}

          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{form?.title}</h1>
            {form?.description && (
              <p className="text-gray-500 text-sm whitespace-pre-wrap">{form.description.replace("[single_response]", "").trim()}</p>
            )}
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
              <span>🔒 إجاباتك سرية ومجهولة الهوية</span>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const prevCat = idx > 0 ? questions[idx - 1].minLabel : null;
            const showHeader = q.minLabel && q.minLabel !== prevCat;
            
            return (
              <div key={q.$id}>
                {showHeader && (
                  <div className="mt-8 mb-4 flex items-center gap-3">
                    <div className="h-px bg-gray-200 flex-1" />
                    <h2 className="text-lg font-bold text-blue-800 bg-blue-50 px-6 py-2 rounded-full border border-blue-100">{q.minLabel}</h2>
                    <div className="h-px bg-gray-200 flex-1" />
                  </div>
                )}
                <div className={`bg-white rounded-2xl shadow-sm border p-6 transition-all ${validationErrors[q.$id] ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-3 mb-4">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{idx + 1}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {q.text}
                    {q.required && <span className="text-red-500 mr-1">*</span>}
                  </h3>
                </div>
              </div>

              <div className="pr-10">
                {/* Multiple Choice */}
                {q.type === "multiple_choice" && (
                  <div className="space-y-2">
                    {q.options.map((opt, i) => (
                      <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${answers[q.$id] === opt ? 'border-blue-400 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${answers[q.$id] === opt ? 'border-blue-500' : 'border-gray-300'}`}>
                          {answers[q.$id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                        </div>
                        <span className="text-sm text-gray-700">{opt}</span>
                        <input type="radio" name={q.$id} value={opt} checked={answers[q.$id] === opt} onChange={() => setAnswer(q.$id, opt)} className="sr-only" />
                      </label>
                    ))}
                  </div>
                )}

                {/* Checkbox */}
                {q.type === "checkbox" && (
                  <div className="space-y-2">
                    {q.options.map((opt, i) => {
                      const checked = ((answers[q.$id] as string[]) || []).includes(opt);
                      return (
                        <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-blue-400 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                            {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <span className="text-sm text-gray-700">{opt}</span>
                          <input type="checkbox" checked={checked} onChange={() => toggleCheckbox(q.$id, opt)} className="sr-only" />
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Dropdown */}
                {q.type === "dropdown" && (
                  <select value={(answers[q.$id] as string) || ""} onChange={e => setAnswer(q.$id, e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white appearance-none cursor-pointer">
                    <option value="">اختر إجابة...</option>
                    {q.options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                  </select>
                )}

                {/* Text */}
                {q.type === "text" && (
                  <textarea value={(answers[q.$id] as string) || ""} onChange={e => setAnswer(q.$id, e.target.value)}
                    rows={3} placeholder="اكتب إجابتك هنا..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 resize-none" />
                )}

                {/* Rating */}
                {q.type === "rating" && (
                  <div className="flex gap-2" dir="ltr">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setAnswer(q.$id, s)} className="group">
                        <svg className={`w-10 h-10 transition-all ${(answers[q.$id] as number) >= s ? 'text-amber-400 fill-amber-400 scale-110' : 'text-gray-200 fill-gray-200 hover:text-amber-200 hover:fill-amber-200'}`} viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                )}

                {/* Likert */}
                {q.type === "likert" && (
                  <div className="grid grid-cols-5 gap-2">
                    {["موافق جداً", "موافق", "محايد", "غير موافق", "غير موافق جداً"].map((opt, i) => (
                      <label key={i} className={`flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-center ${answers[q.$id] === opt ? 'border-blue-400 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${answers[q.$id] === opt ? 'border-blue-500' : 'border-gray-300'}`}>
                          {answers[q.$id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-blue-500"/>}
                        </div>
                        <span className="text-xs text-gray-600">{opt}</span>
                        <input type="radio" name={q.$id} value={opt} checked={answers[q.$id] === opt} onChange={() => setAnswer(q.$id, opt)} className="sr-only"/>
                      </label>
                    ))}
                  </div>
                )}

                {/* Yes/No */}
                {q.type === "yes_no" && (
                  <div className="flex gap-3">
                    <button onClick={() => setAnswer(q.$id, "نعم")} className={`flex-1 py-3.5 rounded-xl font-medium text-sm border-2 transition-all ${answers[q.$id] === "نعم" ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>✓ نعم</button>
                    <button onClick={() => setAnswer(q.$id, "لا")} className={`flex-1 py-3.5 rounded-xl font-medium text-sm border-2 transition-all ${answers[q.$id] === "لا" ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>✗ لا</button>
                  </div>
                )}

                {/* Linear Scale */}
                {q.type === "linear_scale" && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                      <span>{q.minLabel || ""}</span><span>{q.maxLabel || ""}</span>
                    </div>
                    <div className="flex gap-2 justify-between">
                      {Array.from({ length: (q.maxValue || 5) - (q.minValue || 1) + 1 }, (_, i) => (q.minValue || 1) + i).map(n => (
                        <button key={n} onClick={() => setAnswer(q.$id, n)}
                          className={`w-10 h-10 rounded-full border-2 text-sm font-medium transition-all ${(answers[q.$id] as number) === n ? 'border-blue-500 bg-blue-500 text-white scale-110 shadow-md' : 'border-gray-200 text-gray-500 hover:border-blue-300'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date */}
                {q.type === "date" && (
                  <input type="date" value={(answers[q.$id] as string) || ""} onChange={e => setAnswer(q.$id, e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
                )}

                {/* File */}
                {q.type === "file" && (
                  <div>
                    <input type="file" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      const tId = toast.loading("جاري رفع الملف...");
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await uploadFormFile(formData);
                        if (res.success && res.url) {
                          setAnswer(q.$id, res.url);
                          toast.success("تم رفع الملف بنجاح", { id: tId });
                        } else {
                          toast.error(res.error || "حدث خطأ أثناء الرفع", { id: tId });
                          e.target.value = "";
                        }
                      } catch (err) {
                        toast.error("حدث خطأ أثناء الرفع", { id: tId });
                        e.target.value = "";
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer" />
                    
                    {answers[q.$id] && typeof answers[q.$id] === "string" && (answers[q.$id] as string).startsWith("http") && (
                      <div className="mt-3 text-sm text-emerald-600 flex items-center gap-1 bg-emerald-50 w-fit px-3 py-1.5 rounded-lg border border-emerald-100">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        تم إرفاق الملف بنجاح
                      </div>
                    )}
                  </div>
                )}

                {/* Validation Error */}
                {validationErrors[q.$id] && (
                  <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                    {validationErrors[q.$id]}
                  </p>
                )}
              </div>
            </div>
            </div>
          )})}
        </div>

        {/* Submit */}
        {questions.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
            <p className="text-xs text-gray-400">جميع البيانات سرية ومحمية</p>
            <button onClick={handleSubmit} disabled={submitting}
              className="px-8 py-3 bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold shadow-md shadow-blue-200 transition-all disabled:opacity-60 flex items-center gap-2">
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>جاري الإرسال...</>
              ) : "إرسال الإجابات ←"}
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6 pb-8">
          مدعوم بواسطة AEMS — نظام إدارة القياس والتقويم
        </p>
      </div>
    </div>
  );
}
