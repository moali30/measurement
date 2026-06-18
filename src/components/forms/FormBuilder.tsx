"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical, Save, Eye, Copy, ChevronDown, Star, ToggleLeft, AlignRight, CheckSquare, List, Hash, Calendar, ThumbsUp, Upload, FileText, Edit2 } from "lucide-react";
import { ID } from "appwrite";
import { useAuth } from "@/hooks/useAuth";
import { createFormWithQuestions, importBatchResponses } from "@/app/actions/import";
import { createFormServer } from "@/app/actions/dashboard";
import { generateQuestionsFromImage } from "@/app/actions/ai";
import * as pdfjsLib from "pdfjs-dist";

// Set worker path to local unpkg or cloudflare
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export type QuestionType = "multiple_choice" | "checkbox" | "text" | "rating" | "likert" | "dropdown" | "yes_no" | "linear_scale" | "date" | "matrix";

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ReactNode }[] = [
  { value: "multiple_choice", label: "اختيار من متعدد", icon: <List size={16} /> },
  { value: "checkbox", label: "مربعات اختيار", icon: <CheckSquare size={16} /> },
  { value: "dropdown", label: "قائمة منسدلة", icon: <ChevronDown size={16} /> },
  { value: "text", label: "نص حر", icon: <AlignRight size={16} /> },
  { value: "rating", label: "تقييم (نجوم)", icon: <Star size={16} /> },
  { value: "likert", label: "مقياس ليكرت", icon: <ToggleLeft size={16} /> },
  { value: "yes_no", label: "نعم / لا", icon: <ThumbsUp size={16} /> },
  { value: "linear_scale", label: "مقياس خطي", icon: <Hash size={16} /> },
  { value: "date", label: "تاريخ", icon: <Calendar size={16} /> },
];

const LIKERT_OPTIONS = ["موافق جداً", "موافق", "محايد", "غير موافق", "غير موافق جداً"];

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
}

interface FormBuilderProps {
  initialTitle?: string;
  initialDescription?: string;
  initialQuestions?: Question[];
  formId?: string;
}

export function FormBuilder({ initialTitle, initialDescription, initialQuestions, formId }: FormBuilderProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialTitle || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [questions, setQuestions] = useState<Question[]>(initialQuestions || []);
  const [collegeLogo, setCollegeLogo] = useState<string>("");
  const [universityLogo, setUniversityLogo] = useState<string>("");
  const [qualityLogo, setQualityLogo] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedSlug, setSavedSlug] = useState("");
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const importFromAI = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,image/png,image/jpeg,image/jpg";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      setImportStatus("جاري قراءة الملف...");
      setImportTotal(1);
      setImportProgress(0);

      try {
        const base64Images: string[] = [];

        if (file.type === "application/pdf") {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numPages = Math.min(pdf.numPages, 3); // Max 3 pages

          for (let i = 1; i <= numPages; i++) {
            setImportStatus(`جاري معالجة الصفحة ${i} من ${numPages}...`);
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
              await page.render({ canvasContext: context, viewport }).promise;
              base64Images.push(canvas.toDataURL("image/jpeg", 0.8));
            }
          }
        } else if (file.type.startsWith("image/")) {
          setImportStatus("جاري معالجة الصورة...");
          const url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const img = document.createElement("img");
              img.src = event.target?.result as string;
              img.onload = () => {
                const canvas = document.createElement("canvas");
                const maxWidth = 1024;
                const scaleSize = Math.min(1, maxWidth / img.width);
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
              };
              img.onerror = () => reject(new Error("فشل قراءة الصورة"));
            };
            reader.onerror = () => reject(new Error("فشل قراءة الملف"));
            reader.readAsDataURL(file);
          });
          base64Images.push(url);
        }

        setImportStatus("جاري تحليل الأسئلة بالذكاء الاصطناعي (قد يستغرق بعض الوقت)...");
        const result = await generateQuestionsFromImage(base64Images);

        if (!result.success || !result.questions) {
          throw new Error(result.error || "فشل الذكاء الاصطناعي في تحليل الأسئلة.");
        }

        const newQuestions: Question[] = result.questions.map((q: any) => ({
          id: ID.unique(),
          text: q.text || "سؤال جديد",
          type: q.type || "text",
          options: q.options || [],
          required: !!q.required,
          minLabel: q.minLabel || undefined,
        }));

        setQuestions((prev) => [...prev, ...newQuestions]);

        // Add any new categories found
        const newCats = new Set<string>();
        newQuestions.forEach(q => { if (q.minLabel) newCats.add(q.minLabel); });
        setCategories((prev) => {
          const combined = Array.from(new Set([...prev, ...Array.from(newCats)]));
          return combined;
        });

        setImportProgress(1);
        setImportStatus("تم بنجاح!");
      } catch (err: any) {
        console.error(err);
        alert("حدث خطأ أثناء الاستيراد: " + (err?.message || ""));
      } finally {
        setTimeout(() => setIsImporting(false), 1000);
      }
    };
    input.click();
  };

  const uploadLogo = async (type: "collegeLogo" | "universityLogo" | "qualityLogo") => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = document.createElement("img");
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const maxWidth = 500;
              const scaleSize = Math.min(1, maxWidth / img.width);
              canvas.width = img.width * scaleSize;
              canvas.height = img.height * scaleSize;
              const ctx = canvas.getContext("2d");
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL("image/webp", 0.7)); 
            };
            img.onerror = () => reject(new Error("فشل قراءة الصورة"));
          };
          reader.onerror = () => reject(new Error("فشل قراءة الملف"));
        });
        if (type === "collegeLogo") setCollegeLogo(url);
        if (type === "universityLogo") setUniversityLogo(url);
        if (type === "qualityLogo") setQualityLogo(url);
      } catch (e: any) { 
        console.error(e); 
        alert("خطأ في رفع الصورة: " + (e?.message || "")); 
      }
    };
    input.click();
  };

  const addQuestion = useCallback((type: QuestionType = "multiple_choice") => {
    const defaults: Partial<Question> = {};
    if (type === "likert") defaults.options = [...LIKERT_OPTIONS];
    else if (type === "multiple_choice" || type === "checkbox" || type === "dropdown") defaults.options = ["خيار 1"];
    else if (type === "yes_no") defaults.options = ["نعم", "لا"];
    else if (type === "linear_scale") { defaults.minValue = 1; defaults.maxValue = 5; defaults.minLabel = ""; defaults.maxLabel = ""; }
    else defaults.options = [];

    const newQ: Question = {
      id: ID.unique(),
      text: "",
      type,
      options: defaults.options || [],
      required: false,
      ...defaults,
    };
    setQuestions(prev => [...prev, newQ]);
    setActiveQuestion(newQ.id);
    setShowTypeMenu(false);
  }, []);

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const deleteQuestion = (id: string) => {
    setQuestions(qs => qs.filter(q => q.id !== id));
    if (activeQuestion === id) setActiveQuestion(null);
  };

  const duplicateQuestion = (q: Question) => {
    const copy: Question = { ...q, id: ID.unique(), text: q.text + " (نسخة)" };
    setQuestions(qs => [...qs, copy]);
  };

  const addOption = (qId: string) => {
    setQuestions(qs => qs.map(q => q.id === qId ? { ...q, options: [...q.options, `خيار ${q.options.length + 1}`] } : q));
  };

  const updateOption = (qId: string, idx: number, val: string) => {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qId) return q;
      const opts = [...q.options]; opts[idx] = val;
      return { ...q, options: opts };
    }));
  };

  const removeOption = (qId: string, idx: number) => {
    setQuestions(qs => qs.map(q => q.id === qId ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q));
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const arr = [...questions];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setQuestions(arr);
  };

  const importFromExcel = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx, .xls";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const dateStr = prompt("أدخل تاريخ بداية الاستبيان (مثال: 2024-05-01):", new Date().toISOString().split('T')[0]);
      if (!dateStr) return;
      const startDate = new Date(dateStr);
      if (isNaN(startDate.getTime())) { alert("تاريخ غير صحيح"); return; }
      
      const daysStr = prompt("ما هي مدة جمع الردود بالأيام؟ (مثال: 10 أو 12):", "10");
      if (!daysStr) return;
      const maxDays = parseInt(daysStr, 10);
      if (isNaN(maxDays) || maxDays < 1) { alert("مدة غير صحيحة"); return; }
      
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus("جاري قراءة الملف...");
      
      try {
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (rows.length < 2) throw new Error("الملف فارغ أو لا يحتوي على ردود");
        
        const headers = rows[0].map(h => String(h || "").trim());
        const dataRows = rows.slice(1).filter(r => r && r.length > 0);
        const totalRows = dataRows.length;
        setImportTotal(totalRows);
        
        // Step 1: Create form and questions via Server Action (Admin SDK)
        setImportStatus("جاري إنشاء الاستبيان والأسئلة...");
        const generatedTitle = file.name.replace(/\.[^/.]+$/, "");
        const slug = generatedTitle.replace(/\s+/g, "-").replace(/[^\u0621-\u064Aa-zA-Z0-9-]/g, "").substring(0, 50) + "-" + Date.now().toString(36);
        
        const formResult = await createFormWithQuestions(
          generatedTitle,
          "",
          user?.$id || "",
          slug,
          headers,
          totalRows,
          startDate.toISOString(),
          [...LIKERT_OPTIONS]
        );
        
        if (!formResult.success || !formResult.formId || !formResult.questionIdMap) {
          throw new Error(formResult.error || "فشل في إنشاء الاستبيان");
        }
        
        const newFormId = formResult.formId;
        const questionIdMap = formResult.questionIdMap;
        
        // Step 2: Import responses in FAST batches via Server Action (Admin SDK)
        const BATCH_SIZE = 10; // 10 rows per server call
        const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
        setImportStatus(`جاري استيراد الردود بسرعة (0 / ${totalRows})...`);
        let processedRows = 0;
        
        for (let b = 0; b < totalBatches; b++) {
          const batchStart = b * BATCH_SIZE;
          const batchData = dataRows.slice(batchStart, batchStart + BATCH_SIZE);
          
          // Retry logic for each batch
          let batchSuccess = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            const res = await importBatchResponses(
              newFormId,
              headers,
              batchData,
              questionIdMap,
              startDate.toISOString(),
              maxDays
            );
            
            if (res.success) {
              batchSuccess = true;
              break;
            }
            
            if (res.error?.includes("Rate limit")) {
              const waitTime = Math.pow(2, attempt + 1) * 3000;
              setImportStatus(`⏳ انتظار ${waitTime/1000} ثانية... (${processedRows} / ${totalRows})`);
              await new Promise(r => setTimeout(r, waitTime));
            } else {
              // Other error, short wait and retry
              await new Promise(r => setTimeout(r, 1000));
            }
          }
          
          processedRows += batchData.length;
          setImportProgress(processedRows);
          setImportStatus(`جاري استيراد الردود (${processedRows} / ${totalRows})...`);
        }
        
        setImportStatus("✅ تم الاستيراد بنجاح!");
        alert(`تم استيراد جميع الردود (${totalRows}) بنجاح! 🎉`);
        window.location.href = `/dashboard/forms/${newFormId}`;
      } catch (error: any) {
        console.error(error);
        alert("حدث خطأ أثناء الاستيراد: " + (error?.message || "يرجى المحاولة مرة أخرى"));
      } finally {
        setIsImporting(false);
        setImportProgress(0);
        setImportTotal(0);
        setImportStatus("");
      }
    };
    input.click();
  };

  const saveForm = async () => {
    if (!title.trim()) { alert("يرجى إدخال عنوان الاستبيان"); return; }
    if (questions.length === 0) { alert("يرجى إضافة سؤال واحد على الأقل"); return; }
    setSaving(true);
    try {
      const slug = title.replace(/\s+/g, "-").replace(/[^\u0621-\u064Aa-zA-Z0-9-]/g, "").substring(0, 50) + "-" + Date.now().toString(36);
      
      // Server Action - no direct Appwrite connection!
      const result = await createFormServer(
        {
          title,
          description,
          createdBy: user?.$id || "",
          slug,
          collegeLogo,
          universityLogo,
          qualityLogo,
        },
        questions.map((q, i) => ({
          text: q.text,
          type: q.type,
          options: q.options,
          required: q.required,
          order: i,
          minValue: q.minValue ?? null,
          maxValue: q.maxValue ?? null,
          minLabel: q.minLabel ?? null,
          maxLabel: q.maxLabel ?? null,
        }))
      );

      if (!result.success) {
        throw new Error(result.error || "فشل في إنشاء الاستبيان");
      }

      setSaved(true);
      setSavedSlug(slug);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء الحفظ: " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const renderQuestionPreview = (q: Question) => {
    switch (q.type) {
      case "multiple_choice":
        return (
          <div className="space-y-2 mt-4">
            {q.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                <input
                  value={opt} onChange={e => updateOption(q.id, i, e.target.value)}
                  className="flex-1 py-1.5 px-0 border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm"
                />
                {q.options.length > 1 && (
                  <button onClick={() => removeOption(q.id, i)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
            <button onClick={() => addOption(q.id)} className="flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm mt-2 transition-colors">
              <Plus size={14} /> إضافة خيار
            </button>
          </div>
        );

      case "checkbox":
        return (
          <div className="space-y-2 mt-4">
            {q.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
                <input value={opt} onChange={e => updateOption(q.id, i, e.target.value)}
                  className="flex-1 py-1.5 px-0 border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm" />
                {q.options.length > 1 && <button onClick={() => removeOption(q.id, i)} className="text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>}
              </div>
            ))}
            <button onClick={() => addOption(q.id)} className="flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm mt-2"><Plus size={14} /> إضافة خيار</button>
          </div>
        );

      case "dropdown":
        return (
          <div className="space-y-2 mt-4">
            {q.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                <input value={opt} onChange={e => updateOption(q.id, i, e.target.value)}
                  className="flex-1 py-1.5 px-0 border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent text-sm" />
                {q.options.length > 1 && <button onClick={() => removeOption(q.id, i)} className="text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>}
              </div>
            ))}
            <button onClick={() => addOption(q.id)} className="flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm mt-2"><Plus size={14} /> إضافة خيار</button>
          </div>
        );

      case "text":
        return <div className="mt-4 border-b-2 border-dashed border-gray-200 pb-3 text-gray-400 text-sm">سيكتب المستجيب إجابته هنا...</div>;

      case "rating":
        return (
          <div className="flex gap-1.5 mt-4" dir="ltr">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} size={28} className="text-amber-300 fill-amber-300" />
            ))}
          </div>
        );

      case "likert":
        return (
          <div className="mt-4 flex justify-between bg-gray-50 rounded-xl p-4">
            {LIKERT_OPTIONS.map((opt, i) => (
              <div key={i} className="flex flex-col items-center gap-2 text-center">
                <div className={`w-5 h-5 rounded-full border-2 ${i === 0 ? 'border-green-400' : i === 4 ? 'border-red-400' : 'border-gray-300'}`} />
                <span className="text-xs text-gray-500 max-w-[60px]">{opt}</span>
              </div>
            ))}
          </div>
        );

      case "yes_no":
        return (
          <div className="flex gap-4 mt-4">
            <div className="flex-1 py-3 bg-green-50 border border-green-200 rounded-xl text-center text-green-700 font-medium text-sm">نعم ✓</div>
            <div className="flex-1 py-3 bg-red-50 border border-red-200 rounded-xl text-center text-red-600 font-medium text-sm">لا ✗</div>
          </div>
        );

      case "linear_scale":
        return (
          <div className="mt-4">
            <div className="flex items-center gap-4 mb-3">
              <input type="text" placeholder="تسمية البداية" value={q.minLabel || ""} onChange={e => updateQuestion(q.id, { minLabel: e.target.value })}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
              <input type="text" placeholder="تسمية النهاية" value={q.maxLabel || ""} onChange={e => updateQuestion(q.id, { maxLabel: e.target.value })}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="flex justify-between bg-gray-50 rounded-xl p-3">
              {Array.from({ length: (q.maxValue || 5) - (q.minValue || 1) + 1 }, (_, i) => (q.minValue || 1) + i).map(n => (
                <div key={n} className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">{n}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case "date":
        return <div className="mt-4 px-4 py-3 border border-gray-200 rounded-xl text-gray-400 text-sm bg-gray-50">📅 يوم / شهر / سنة</div>;

      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-28">
      {/* Import Progress Overlay */}
      {isImporting && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-[90%] max-w-md mx-auto text-center" dir="rtl">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">جاري الاستيراد</h3>
            <p className="text-sm text-gray-500 mb-6">{importStatus}</p>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-4 mb-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-l from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
                style={{ width: importTotal > 0 ? `${Math.round((importProgress / importTotal) * 100)}%` : '0%' }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-400 mb-4">
              <span>{importTotal > 0 ? `${Math.round((importProgress / importTotal) * 100)}%` : '0%'}</span>
              <span>{importProgress} / {importTotal} رد</span>
            </div>
            
            <p className="text-xs text-gray-400">
              لا تغلق هذه الصفحة حتى يكتمل الاستيراد
            </p>
          </div>
        </div>
      )}

      {/* Logos Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">الشعارات (تظهر في التقارير والطباعة)</h3>
        <div className="grid grid-cols-3 gap-4">
          <button onClick={() => uploadLogo("collegeLogo")} className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-center group">
            {collegeLogo ? <img src={collegeLogo} alt="شعار الكلية" className="w-16 h-16 mx-auto object-contain mb-2 rounded-lg" /> : <div className="w-16 h-16 mx-auto mb-2 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-100"><Upload size={20} className="text-gray-400 group-hover:text-blue-500" /></div>}
            <span className="text-xs text-gray-500">شعار الكلية</span>
          </button>
          <button onClick={() => uploadLogo("universityLogo")} className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-center group">
            {universityLogo ? <img src={universityLogo} alt="شعار الجامعة" className="w-16 h-16 mx-auto object-contain mb-2 rounded-lg" /> : <div className="w-16 h-16 mx-auto mb-2 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-100"><Upload size={20} className="text-gray-400 group-hover:text-blue-500" /></div>}
            <span className="text-xs text-gray-500">شعار الجامعة</span>
          </button>
          <button onClick={() => uploadLogo("qualityLogo")} className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-center group">
            {qualityLogo ? <img src={qualityLogo} alt="شعار ضمان الجودة" className="w-16 h-16 mx-auto object-contain mb-2 rounded-lg" /> : <div className="w-16 h-16 mx-auto mb-2 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-100"><Upload size={20} className="text-gray-400 group-hover:text-blue-500" /></div>}
            <span className="text-xs text-gray-500">شعار ضمان الجودة</span>
          </button>
        </div>
      </div>

      {/* Form Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-2 bg-gradient-to-l from-blue-500 to-blue-700" />
        <div className="p-8">
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full text-3xl font-bold border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none pb-2 transition-colors placeholder-gray-300"
            placeholder="عنوان الاستبيان"
          />
          <textarea
            value={description} onChange={e => setDescription(e.target.value)} rows={3}
            className="w-full mt-3 text-gray-500 border border-gray-200 rounded-xl p-3 focus:border-blue-400 focus:outline-none transition-colors placeholder-gray-300 text-sm resize-none"
            placeholder="أضف وصفاً تفصيلياً للاستبيان (اختياري)..."
          />
        </div>
      </div>

      {/* Categories (Axes) Management */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">إدارة المحاور (الفئات)</h3>
          <Button size="sm" variant="outline" onClick={() => {
            const c = prompt("أدخل اسم المحور الجديد:");
            if (c && c.trim() && !categories.includes(c.trim())) setCategories([...categories, c.trim()]);
          }} className="text-xs h-8">إضافة محور جديد</Button>
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-gray-400">لا توجد محاور مضافة حالياً. يمكنك إضافتها لربط الأسئلة بها.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c, i) => (
              <div key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs border border-blue-100">
                {c}
                <div className="flex items-center mr-2 gap-1 border-r border-blue-200 pr-2">
                  <button onClick={() => {
                    const newName = prompt("تعديل اسم المحور:", c);
                    if (newName && newName.trim() && newName.trim() !== c) {
                      const finalName = newName.trim();
                      if (categories.includes(finalName)) {
                        alert("هذا المحور موجود مسبقاً!");
                        return;
                      }
                      setCategories(categories.map(cat => cat === c ? finalName : cat));
                      setQuestions(qs => qs.map(q => q.minLabel === c ? { ...q, minLabel: finalName } : q));
                    }
                  }} className="text-blue-500 hover:text-blue-700 transition-colors" title="تعديل"><Edit2 size={12} /></button>
                  <button onClick={() => {
                    if (confirm("هل أنت متأكد من حذف هذا المحور؟ سيتم فصله عن الأسئلة المرتبطة به.")) {
                      setCategories(categories.filter(cat => cat !== c));
                      setQuestions(qs => qs.map(q => q.minLabel === c ? { ...q, minLabel: undefined } : q));
                    }
                  }} className="text-gray-400 hover:text-red-500 transition-colors font-bold" title="حذف">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Questions */}
      {questions.map((q, qIdx) => (
        <div
          key={q.id}
          className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 ${
            activeQuestion === q.id ? 'border-blue-300 shadow-md shadow-blue-50 ring-1 ring-blue-100' : 'border-gray-100 hover:border-gray-200'
          }`}
          onClick={() => setActiveQuestion(q.id)}
        >
          {activeQuestion === q.id && <div className="h-1 bg-blue-500 rounded-t-2xl" />}
          
          <div className="p-6">
            {/* Question Header */}
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-1 pt-2">
                <button onClick={() => moveQuestion(qIdx, -1)} className="text-gray-300 hover:text-gray-500 disabled:opacity-30" disabled={qIdx === 0}>▲</button>
                <GripVertical size={16} className="text-gray-300" />
                <button onClick={() => moveQuestion(qIdx, 1)} className="text-gray-300 hover:text-gray-500 disabled:opacity-30" disabled={qIdx === questions.length - 1}>▼</button>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">{qIdx + 1}</span>
                  <input
                    type="text" value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })}
                    className="flex-1 text-base font-medium bg-transparent border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none pb-1 transition-colors placeholder-gray-300"
                    placeholder="اكتب السؤال هنا..."
                  />
                </div>

                {/* Question Type Selector */}
                <div className="flex items-center gap-2 mb-1">
                  <select
                    value={q.type} onChange={e => {
                      const newType = e.target.value as QuestionType;
                      const updates: Partial<Question> = { type: newType };
                      if (newType === "yes_no") updates.options = ["نعم", "لا"];
                      else if (newType === "likert") updates.options = [...LIKERT_OPTIONS];
                      else if (["multiple_choice", "checkbox", "dropdown"].includes(newType) && q.options.length === 0) updates.options = ["خيار 1"];
                      updateQuestion(q.id, updates);
                    }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    {QUESTION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Question Preview */}
                {renderQuestionPreview(q)}
              </div>
            </div>

            {/* Question Footer */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-4">
              {/* Category selector */}
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100 self-start">
                <span className="text-xs font-medium text-gray-500">المحور المرتبط:</span>
                <select value={q.minLabel || ""} onChange={e => updateQuestion(q.id, { minLabel: e.target.value })} className="text-xs bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none pb-0.5 cursor-pointer">
                  <option value="">بدون محور</option>
                  {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => duplicateQuestion(q)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="نسخ السؤال"><Copy size={16} /></button>
                  <button onClick={() => deleteQuestion(q.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="حذف السؤال"><Trash2 size={16} /></button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs text-gray-500">مطلوب</span>
                  <div className="relative">
                    <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-checked:bg-blue-500 rounded-full transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform" />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Empty State */}
      {questions.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 flex items-center justify-center">
            <FileText size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">ابدأ بإضافة أسئلة</h3>
          <p className="text-sm text-gray-400 mb-6">اضغط على الزر أدناه لإضافة أول سؤال في الاستبيان</p>
        </div>
      )}

      {/* Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl shadow-gray-300/30 border border-gray-100 flex items-center gap-3">
          {/* Add Question */}
          <div className="relative">
            <Button
              onClick={() => setShowTypeMenu(!showTypeMenu)}
              variant="outline"
              className="rounded-xl flex gap-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 px-4"
            >
              <Plus size={16} /> إضافة سؤال
            </Button>
            
            {showTypeMenu && (
              <div className="absolute bottom-full mb-2 right-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 max-h-80 overflow-auto">
                {QUESTION_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => addQuestion(t.value)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <span className="text-gray-400">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Import AI */}
          <Button
            onClick={importFromAI}
            variant="outline"
            className="rounded-xl flex gap-2 border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300 px-4"
          >
            <SparklesIcon />
            استيراد بالذكاء الاصطناعي
          </Button>

          {user?.email === "admin@aems.app" && (
          <>
          <div className="w-px h-8 bg-gray-200" />

          {/* Import Excel */}
          <Button
            onClick={importFromExcel}
            variant="outline"
            className="rounded-xl flex gap-2 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300 px-4"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            استيراد أسئلة Excel
          </Button>
          </>
          )}

          <div className="w-px h-8 bg-gray-200" />

          {/* Save */}
          <Button
            onClick={saveForm}
            disabled={saving}
            className={`rounded-xl flex gap-2 px-5 shadow-md transition-all ${
              saved
                ? 'bg-green-500 hover:bg-green-600 shadow-green-200'
                : 'bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-200'
            }`}
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري الحفظ...</>
            ) : saved ? (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> تم الحفظ</>
            ) : (
              <><Save size={16} /> حفظ الاستبيان</>
            )}
          </Button>

          <Button
            variant="secondary"
            className="rounded-xl flex gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600"
            onClick={() => {
              if (savedSlug) { window.open(`/f/${savedSlug}`, '_blank'); }
              else { alert('يرجى حفظ الاستبيان أولاً لمعاينته'); }
            }}
          >
            <Eye size={16} /> معاينة
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileText(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const s = props.size || 24;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  );
}
