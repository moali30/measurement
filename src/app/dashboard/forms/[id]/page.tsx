"use client";

import { useState, useEffect } from "react";
import { ID } from "appwrite";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Edit3, BarChart2, Download, FileSpreadsheet, Printer, Trash2, Plus, Save, GripVertical, Star, CheckSquare, List, AlignRight, ChevronDown, ToggleLeft, ThumbsUp, Hash, Calendar, Copy, Eye, Upload, Image, X } from "lucide-react";
import Link from "next/link";
import { bulkAddAnswers } from "@/app/actions/import";
import { loadFormDetailServer, updateFormServer, saveQuestionServer, createResponseServer, createAnswerServer } from "@/app/actions/dashboard";

interface FormData { $id: string; title: string; description: string; status: string; slug: string; responsesCount: number; createdAt: string; collegeLogo?: string; universityLogo?: string; qualityLogo?: string; }
interface Question { $id: string; text: string; type: string; options: string[]; required: boolean; order: number; minLabel?: string; maxLabel?: string; minValue?: number; maxValue?: number; }
interface Response { $id: string; submittedAt: string; }
interface Answer { $id: string; responseId: string; questionId: string; textValue?: string; numberValue?: number; selectedOptions?: string[]; }

type Tab = "edit" | "responses";

export default function FormDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("edit");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(null);

  // Helper functions moved to top
  const fmtDate = (d: string) => { 
    try { 
      return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); 
    } catch { return d; } 
  };

  useEffect(() => { if (user) loadAll(); }, [user, params.id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Server Action - no direct Appwrite connection!
      const result = await loadFormDetailServer(params.id);
      if (result.success) {
        setForm(result.form as FormData);
        setQuestions(result.questions as Question[]);
        setResponses(result.responses as Response[]);
        setAnswers(result.answers as Answer[]);
        const uniqueCats = Array.from(new Set((result.questions as any[]).map((q: any) => q.minLabel).filter(Boolean))) as string[];
        setCategories(uniqueCats);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ─── SAVE QUESTIONS ───
  const saveQuestions = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await updateFormServer(form.$id, { title: form.title, description: form.description });
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const isNew = q.$id.startsWith("new_");
        await saveQuestionServer(q.$id, form.$id, { text: q.text, type: q.type, options: q.options, required: q.required, order: i }, isNew);
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); alert("خطأ أثناء الحفظ"); }
    finally { setSaving(false); }
  };

  const addQuestion = (override?: Partial<Question>, toFront = false) => {
    const newQ = { $id: "new_" + ID.unique(), text: "", type: "multiple_choice", options: ["خيار 1"], required: false, order: 0, ...override };
    setQuestions(prev => toFront ? [newQ, ...prev] : [...prev, newQ]);
  };

  const updateQ = (id: string, u: Partial<Question>) => setQuestions(qs => qs.map(q => q.$id === id ? { ...q, ...u } : q));
  
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQs = [...questions];
    if (direction === 'up' && index > 0) {
      [newQs[index - 1], newQs[index]] = [newQs[index], newQs[index - 1]];
    } else if (direction === 'down' && index < newQs.length - 1) {
      [newQs[index + 1], newQs[index]] = [newQs[index], newQs[index + 1]];
    }
    newQs.forEach((q, i) => q.order = i);
    setQuestions(newQs);
  };

  const importQuestionsOnly = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx, .xls";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        const headers = rows[0] as string[];
        if (!headers || headers.length === 0) throw new Error("الملف فارغ أو لا يحتوي على صفوف العناوين");
        
        const newQs: Question[] = headers.map((h, i) => ({
          $id: `new_${Date.now()}_${i}`,
          text: h,
          type: "likert",
          options: ["موافق جداً", "موافق", "محايد", "غير موافق", "غير موافق جداً"],
          required: true,
          order: questions.length + i,
        }));
        setQuestions(prev => [...prev, ...newQs]);
      } catch (err: any) {
        alert("حدث خطأ أثناء قراءة الأسئلة: " + err.message);
      }
    };
    input.click();
  };

  const deleteQ = (id: string) => setQuestions(questions.filter(q => q.$id !== id));

  const addOpt = (qId: string) => setQuestions(qs => qs.map(q => q.$id === qId ? { ...q, options: [...q.options, `خيار ${q.options.length + 1}`] } : q));
  const updOpt = (qId: string, i: number, v: string) => setQuestions(qs => qs.map(q => { if (q.$id !== qId) return q; const o = [...q.options]; o[i] = v; return { ...q, options: o }; }));
  const rmOpt = (qId: string, i: number) => setQuestions(qs => qs.map(q => q.$id === qId ? { ...q, options: q.options.filter((_, j) => j !== i) } : q));

  const uploadLogo = async (type: "collegeLogo" | "universityLogo" | "qualityLogo") => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !form) return;
      try {
        // Convert to base64 for storage in document (no client SDK needed)
        const url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        await updateFormServer(form.$id, { [type]: url });
        setForm({ ...form, [type]: url });
      } catch (e: any) { 
        console.error(e); 
        alert("خطأ في رفع الصورة: " + (e?.message || "")); 
      }
    };
    input.click();
  };

  const exportExcel = async () => {
    if (!form) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = responses.map((r, idx) => {
        const row: Record<string, string | number> = { "#": idx + 1, "التاريخ": new Date(r.submittedAt).toLocaleString("ar-SA") };
        questions.forEach(q => {
          const a = answers.find(a => a.responseId === r.$id && a.questionId === q.$id);
          if (!a) { row[q.text] = ""; return; }
          if (a.selectedOptions?.length) row[q.text] = a.selectedOptions.join("، ");
          else if (a.numberValue !== undefined && a.numberValue !== null) row[q.text] = a.numberValue;
          else row[q.text] = a.textValue || "";
        });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "الردود");
      XLSX.writeFile(wb, `${form.title}.xlsx`);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  const importExcelData = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx, .xls";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !form) return;
      const dateStr = prompt("أدخل تاريخ الاستبيان (مثال: 2024-05-01):", new Date().toISOString().split('T')[0]);
      if (!dateStr) return;
      const startDate = new Date(dateStr);
      if (isNaN(startDate.getTime())) { alert("تاريخ غير صحيح"); return; }
      setSaving(true);
      try {
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (rows.length < 2) throw new Error("الملف فارغ أو لا يحتوي على بيانات كافية.");
        const headers = rows[0].map(h => String(h || "").trim());
        const dataRows = rows.slice(1).filter(r => r && r.length > 0);
        const questionIdMap = new Map();
        for (let i = 0; i < headers.length; i++) {
          if (!headers[i]) continue;
          const qResult = await saveQuestionServer("", form.$id, {
            text: headers[i], type: "likert", options: ["1", "2", "3", "4", "5"],
            required: true, order: questions.length + i,
          }, true);
          if (qResult.success && qResult.newId) questionIdMap.set(i, qResult.newId);
        }
        const maxDays = 6;
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const randomDays = Math.floor(Math.random() * maxDays);
          const randomHours = 9 + Math.floor(Math.random() * 8); // 9 AM to 4 PM
          const randomMinutes = Math.floor(Math.random() * 60);
          const submitDate = new Date(startDate);
          submitDate.setDate(submitDate.getDate() + randomDays);
          submitDate.setHours(randomHours, randomMinutes, 0, 0);
          const rResult = await createResponseServer(form.$id, submitDate.toISOString());
          if (!rResult.success || !rResult.responseId) continue;
          for (let j = 0; j < headers.length; j++) {
            if (!headers[j]) continue;
            const val = row[j];
            if (val !== undefined && val !== null && val !== "") {
              await createAnswerServer(form.$id, rResult.responseId, questionIdMap.get(j), String(val), !isNaN(Number(val)) ? Number(val) : null);
            }
          }
        }
        alert("تم استيراد الأسئلة والإجابات بنجاح!");
        loadAll();
      } catch (error) { console.error(error); alert("حدث خطأ أثناء الاستيراد."); }
      finally { setSaving(false); }
    };
    input.click();
  };

  const distributeNamesFromExcel = async () => {
    if (!form) return;
    const nameQ = questions.find(q => q.text.includes("الاسم") || q.text.includes("اسم"));
    if (!nameQ) {
      alert("يرجى إضافة سؤال 'الاسم' باستخدام الزر المخصص أولاً!");
      return;
    }
    if (nameQ.$id.startsWith("new_")) {
      alert("لقد قمت بإضافة سؤال الاسم ولكن لم تقم بحفظه. يرجى الضغط على 'حفظ التعديلات' أولاً، ثم حاول التوزيع مرة أخرى!");
      return;
    }
    if (responses.length === 0) {
      alert("لا توجد ردود حالية لتوزيع الأسماء عليها!");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx, .xls";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const pctStr = prompt("ما هي نسبة الردود التي تريد أن تظل مجهولة بدون اسم؟ (أدخل رقم من 0 إلى 100، مثال: 20)", "20");
      if (!pctStr) return;
      const anonPct = parseInt(pctStr, 10);
      if (isNaN(anonPct) || anonPct < 0 || anonPct > 100) { alert("نسبة غير صحيحة"); return; }
      setSaving(true);
      try {
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const names = rows.flat().map(n => String(n || "").trim()).filter(n => n.length > 0);
        if (names.length === 0) throw new Error("ملف الإكسيل لا يحتوي على أسماء");
        const countToAssign = Math.floor(responses.length * (1 - (anonPct / 100)));
        if (countToAssign <= 0) { alert("بناءً على النسبة، لن يتم تعيين أي أسماء."); setSaving(false); return; }
        
        let shuffledResponses = [...responses].sort(() => 0.5 - Math.random());
        let selectedResponses = shuffledResponses.slice(0, countToAssign);
        const shuffledNames = [...names].sort(() => 0.5 - Math.random());
        
        if (selectedResponses.length > shuffledNames.length) {
          alert(`تحذير: عدد الردود المطلوب تعيين أسماء لها (${selectedResponses.length}) أكبر من عدد الأسماء المتاحة في ملف الإكسيل (${shuffledNames.length}). سيتم توزيع الأسماء المتاحة فقط لضمان عدم تكرار أي اسم.`);
          selectedResponses = selectedResponses.slice(0, shuffledNames.length);
        }

        const answersList = selectedResponses.map((r, i) => ({
          responseId: r.$id,
          textValue: shuffledNames[i]
        }));
        const res = await bulkAddAnswers(form.$id, nameQ.$id, answersList);
        if (!res.success) throw new Error(res.error);
        alert("تم توزيع الأسماء بنجاح!");
        loadAll();
      } catch (error: any) { console.error(error); alert("حدث خطأ أثناء التوزيع: " + (error?.message || "")); }
      finally { setSaving(false); }
    };
    input.click();
  };

  const getBase64ImageFromUrl = async (imageUrl: string) => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { return ""; }
  };

  const printAllPDFs = async () => {
    if (responses.length === 0 || !form) return;
    setPrintingPdf(true);
    let iframe: HTMLIFrameElement | null = null;
    try {
      const [jsPDFModule, JSZipModule, fileSaverModule, html2canvasModule] = await Promise.all([
        import("jspdf"), import("jszip"), import("file-saver"), import("html2canvas")
      ]);
      const jsPDF = jsPDFModule.jsPDF || (jsPDFModule as any).default?.jsPDF || (jsPDFModule as any).default;
      const JSZip = JSZipModule.default || JSZipModule;
      const saveAs = fileSaverModule.saveAs || fileSaverModule.default?.saveAs || fileSaverModule.default;
      const html2canvas = html2canvasModule.default || html2canvasModule;

      const zip = new JSZip();

      iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.top = "-9999px";
      iframe.style.left = "-9999px";
      iframe.style.width = "210mm";
      iframe.style.height = "10000px";
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);
        const b64College = form.collegeLogo ? await getBase64ImageFromUrl(form.collegeLogo) : "";
        const b64University = form.universityLogo ? await getBase64ImageFromUrl(form.universityLogo) : "";
        const b64Quality = form.qualityLogo ? await getBase64ImageFromUrl(form.qualityLogo) : "";

        for (let ri = 0; ri < responses.length; ri++) {
          const r = responses[ri];
          let html = `<div dir="rtl" style="font-family: system-ui, -apple-system, sans-serif; padding-top: 10px; background-color: white; color: black; line-height: 1.5;">`;
          let headerHtml = ``;
          if (b64College || b64University || b64Quality) {
            headerHtml = `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px;">
                <div style="width: 80px;">${b64Quality ? `<img src="${b64Quality}" style="max-height: 80px; max-width: 100%; object-fit: contain;" />` : ''}</div>
                <div style="text-align: center; flex: 1; padding: 0 15px;">
                  <h1 style="font-size: 22px; font-weight: bold; margin: 0 0 5px 0; color: black;">${form.title}</h1>
                  <p style="color: #6b7280; font-size: 13px; margin: 0;">رد #${ri + 1} | ${fmtDate(r.submittedAt)}</p>
                </div>
                <div style="width: 80px; display: flex; flex-direction: column; gap: 10px; align-items: center;">
                  ${b64University ? `<img src="${b64University}" style="max-height: 50px; max-width: 100%; object-fit: contain;" />` : ''}
                  ${b64College ? `<img src="${b64College}" style="max-height: 50px; max-width: 100%; object-fit: contain;" />` : ''}
                </div>
              </div>`;
          } else {
            headerHtml = `
              <div style="text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 20px;">
                <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 10px 0; color: black;">${form.title}</h1>
                <p style="color: #6b7280; font-size: 14px; margin: 0;">رد #${ri + 1} | التاريخ: ${fmtDate(r.submittedAt)}</p>
              </div>`;
          }

          const doc = iframe.contentWindow!.document;
          doc.open();
          doc.write(`
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
              <meta charset="utf-8">
              <style>
                body { margin: 0; padding: 0; background: #e5e7eb; font-family: system-ui, -apple-system, sans-serif; }
                * { box-sizing: border-box; border-style: solid; border-width: 0; border-color: #e5e7eb; }
                .page { width: 794px; height: 1123px; padding: 40px; background: white; position: relative; overflow: hidden; margin-bottom: 10px; }
                .footer { position: absolute; bottom: 20px; left: 0; width: 100%; text-align: center; font-size: 11px; color: #9ca3af; border-top-width: 1px; padding-top: 10px; }
              </style>
            </head>
            <body>
              <div id="printContainer"></div>
            </body>
            </html>
          `);
          doc.close();

          await new Promise(resolve => setTimeout(resolve, 100));

          const container = doc.getElementById("printContainer")!;
          let currentPage = doc.createElement("div");
          currentPage.className = "page";
          container.appendChild(currentPage);

          const headerEl = doc.createElement("div");
          headerEl.innerHTML = headerHtml;
          currentPage.appendChild(headerEl);

          let currentY = 40 + headerEl.offsetHeight;

          for (let qi = 0; qi < questions.length; qi++) {
            const q = questions[qi];
            const a = answers.find(ans => ans.responseId === r.$id && ans.questionId === q.$id);
            let ansText = "—";
            if (a) {
              let valStr = a.textValue || (a.numberValue !== undefined && a.numberValue !== null ? String(a.numberValue) : "");
              if (a.selectedOptions?.length) {
                ansText = a.selectedOptions.join("، ");
              } else if (valStr) {
                ansText = valStr;
                if (q.type === "likert" && ["1","2","3","4","5"].includes(valStr) && !q.options.includes(valStr) && q.options.length === 5) {
                  ansText = q.options[5 - parseInt(valStr)];
                }
              }
            }

            const qEl = doc.createElement("div");
            qEl.style.borderBottomWidth = "1px";
            qEl.style.padding = "12px 16px";
            qEl.style.marginBottom = "12px";
            qEl.innerHTML = `
                <h3 style="font-size: 15px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${qi + 1}. ${q.text}</h3>
                <p style="font-size: 14px; color: #4b5563; margin: 0;">الرد: <strong style="color: #2563eb;">${ansText}</strong></p>
            `;

            currentPage.appendChild(qEl);
            const qHeight = qEl.offsetHeight;

            if (currentY + qHeight > 1050) {
              currentPage.removeChild(qEl);
              const footer = doc.createElement("div");
              footer.className = "footer";
              footer.innerText = "تم الإنشاء بواسطة AEMS - نظام إدارة القياس والتقويم الأكاديمي";
              currentPage.appendChild(footer);

              currentPage = doc.createElement("div");
              currentPage.className = "page";
              container.appendChild(currentPage);
              currentPage.appendChild(qEl);
              currentY = 40 + qHeight;
            } else {
              currentY += qHeight;
            }
          }

          const finalFooter = doc.createElement("div");
          finalFooter.className = "footer";
          finalFooter.innerText = "تم الإنشاء بواسطة AEMS - نظام إدارة القياس والتقويم الأكاديمي";
          currentPage.appendChild(finalFooter);

          await new Promise(resolve => setTimeout(resolve, 200));

          const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
          const pages = doc.querySelectorAll('.page');

          for (let pIdx = 0; pIdx < pages.length; pIdx++) {
            if (pIdx > 0) pdf.addPage();
            const canvas = await html2canvas(pages[pIdx] as HTMLElement, { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL("image/jpeg", 0.95);
            pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
          }

          zip.file(`response_${ri + 1}.pdf`, pdf.output("arraybuffer"));
        }
        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, `${form.title}_PDFs.zip`);
      } catch (e: any) { console.error("PDF export error:", e); alert("خطأ أثناء إنشاء الملفات: " + (e?.message || "يرجى المحاولة مرة أخرى")); }
      finally {
        if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
        setPrintingPdf(false);
      }
  };

  const getAnalytics = () => {
    return questions.map(q => {
      const qAnswers = answers.filter(a => a.questionId === q.$id);
      if (["multiple_choice", "checkbox", "dropdown", "likert", "yes_no"].includes(q.type)) {
        const counts: Record<string, number> = {};
        q.options.forEach(o => { counts[o] = 0; });
        qAnswers.forEach(a => {
          let valStr = a.textValue || (a.numberValue !== undefined && a.numberValue !== null ? String(a.numberValue) : "");
          if (a.selectedOptions && a.selectedOptions.length) {
            a.selectedOptions.forEach(o => { counts[o] = (counts[o] || 0) + 1; });
          } else if (valStr) {
            if (q.type === "likert" && ["1","2","3","4","5"].includes(valStr) && !counts.hasOwnProperty(valStr) && q.options.length === 5) {
              valStr = q.options[5 - parseInt(valStr)];
            }
            if (counts.hasOwnProperty(valStr)) {
              counts[valStr] = (counts[valStr] || 0) + 1;
            } else {
              counts[valStr] = (counts[valStr] || 0) + 1;
            }
          }
        });
        return { question: q.text, type: q.type, counts, total: qAnswers.length };
      }
      if (["rating", "linear_scale"].includes(q.type)) {
        const vals = qAnswers.filter(a => a.numberValue !== undefined && a.numberValue !== null).map(a => a.numberValue!);
        const avg = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : "—";
        return { question: q.text, type: q.type, average: avg, total: vals.length };
      }
      return { question: q.text, type: q.type, total: qAnswers.length, textResponses: qAnswers.map(a => a.textValue || "").filter(Boolean) };
    });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  if (!form) return <div className="text-center py-20 text-gray-500">الاستبيان غير موجود</div>;

  const analytics = getAnalytics();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/forms"><button className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><ArrowRight size={20} /></button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{form.title}</h1>
          <p className="text-sm text-gray-500">إنشاء: {fmtDate(form.createdAt)} • {responses.length} رد</p>
        </div>
        <a href={`/f/${form.slug}`} target="_blank" rel="noopener"><Button variant="outline" className="rounded-xl flex gap-2 text-sm"><Eye size={14} /> معاينة</Button></a>
      </div>

      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab("edit")} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "edit" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}><Edit3 size={14} className="inline ml-1.5" />تعديل الأسئلة</button>
        <button onClick={() => setActiveTab("responses")} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "responses" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}><BarChart2 size={14} className="inline ml-1.5" />التقرير والردود ({responses.length})</button>
      </div>

      {activeTab === "edit" && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">الشعارات (تظهر في التقارير والطباعة)</h3>
            <div className="grid grid-cols-3 gap-4">
              {([["collegeLogo", "شعار الكلية"], ["universityLogo", "شعار الجامعة"], ["qualityLogo", "شعار ضمان الجودة"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => uploadLogo(key)} className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-center group">
                  {(form as any)[key] ? <img src={(form as any)[key]} alt={label} className="w-16 h-16 mx-auto object-contain mb-2 rounded-lg" /> : <div className="w-16 h-16 mx-auto mb-2 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-100"><Upload size={20} className="text-gray-400 group-hover:text-blue-500" /></div>}
                  <span className="text-xs text-gray-500">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-2 bg-gradient-to-l from-blue-500 to-blue-700" />
            <div className="p-6">
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full text-2xl font-bold border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none pb-2 transition-colors" placeholder="عنوان الاستبيان" />
              <textarea value={form.description.replace("[single_response]", "").trim()} onChange={e => setForm({ ...form, description: e.target.value + (form.description.includes("[single_response]") ? "\n[single_response]" : "") })} rows={4} className="w-full mt-3 text-gray-500 border border-gray-200 rounded-xl p-3 focus:border-blue-400 focus:outline-none transition-colors text-sm resize-none" placeholder="وصف تفصيلي للاستبيان..." />
              <div className="mt-4 flex items-center justify-between bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">منع الردود المتعددة</h4>
                  <p className="text-xs text-gray-500">يسمح برد واحد فقط لكل جهاز/متصفح لضمان عدم التكرار.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={form.description.includes("[single_response]")} onChange={e => {
                    const hasSingle = form.description.includes("[single_response]");
                    if (e.target.checked && !hasSingle) setForm({ ...form, description: form.description + "\n[single_response]" });
                    else if (!e.target.checked && hasSingle) setForm({ ...form, description: form.description.replace("[single_response]", "").trim() });
                  }} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
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
                    <button onClick={() => {
                      if (confirm("هل أنت متأكد من حذف هذا المحور؟ سيتم فصله عن الأسئلة المرتبطة به.")) {
                        setCategories(categories.filter(cat => cat !== c));
                        setQuestions(qs => qs.map(q => q.minLabel === c ? { ...q, minLabel: undefined } : q));
                      }
                    }} className="mr-2 hover:text-red-500 font-bold">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {questions.map((q, qi) => (
            <div key={q.$id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 mt-1">
                  <button onClick={() => moveQuestion(qi, 'up')} disabled={qi === 0} className="text-gray-300 hover:text-blue-500 disabled:opacity-30"><ArrowRight size={14} className="rotate-[-90deg]" /></button>
                  <span className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">{qi + 1}</span>
                  <button onClick={() => moveQuestion(qi, 'down')} disabled={qi === questions.length - 1} className="text-gray-300 hover:text-blue-500 disabled:opacity-30"><ArrowRight size={14} className="rotate-90" /></button>
                </div>
                <div className="flex-1 space-y-3">
                  <input type="text" value={q.text} onChange={e => updateQ(q.$id, { text: e.target.value })} className="w-full text-sm font-medium border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none pb-1" placeholder="نص السؤال..." />
                  <select value={q.type} onChange={e => updateQ(q.$id, { type: e.target.value })} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 cursor-pointer focus:outline-none">
                    {[["multiple_choice", "اختيار من متعدد"], ["checkbox", "مربعات اختيار"], ["dropdown", "قائمة منسدلة"], ["text", "نص حر"], ["rating", "تقييم"], ["likert", "ليكرت"], ["yes_no", "نعم/لا"], ["linear_scale", "مقياس خطي"], ["date", "تاريخ"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {["multiple_choice", "checkbox", "dropdown"].includes(q.type) && (
                    <div className="space-y-1.5">
                      {q.options.map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{oi + 1}.</span>
                          <input value={o} onChange={e => updOpt(q.$id, oi, e.target.value)} className="flex-1 text-sm border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none pb-0.5" />
                          {q.options.length > 1 && <button onClick={() => rmOpt(q.$id, oi)} className="text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>}
                        </div>
                      ))}
                      <button onClick={() => addOpt(q.$id)} className="text-blue-500 text-xs flex items-center gap-1 hover:text-blue-600"><Plus size={12} />إضافة خيار</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">مطلوب <input type="checkbox" checked={q.required} onChange={e => updateQ(q.$id, { required: e.target.checked })} className="rounded" /></label>
                  <button onClick={() => deleteQ(q.$id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-3 mr-9 flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <span className="text-xs font-medium text-gray-500">المحور المرتبط:</span>
                <select value={q.minLabel || ""} onChange={e => updateQ(q.$id, { minLabel: e.target.value })} className="flex-1 text-xs bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none pb-0.5 cursor-pointer">
                  <option value="">بدون محور</option>
                  {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          ))}
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={() => addQuestion()} className="rounded-xl flex gap-2"><Plus size={16} />إضافة سؤال</Button>
            {user?.email === "admin@aems.app" && (
              <>
                <Button variant="outline" onClick={importQuestionsOnly} disabled={saving} className="rounded-xl flex gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50">إضافة أسئلة عبر Excel</Button>
                <Button variant="outline" onClick={() => addQuestion({ text: "الاسم", type: "text", required: false }, true)} className="rounded-xl flex gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">إضافة حقل الاسم (اختياري)</Button>
                <Button variant="outline" onClick={distributeNamesFromExcel} disabled={saving} className="rounded-xl flex gap-2 text-purple-600 border-purple-200 hover:bg-purple-50"><FileSpreadsheet size={16} />توزيع أسماء (Excel)</Button>
                <Button variant="outline" onClick={importExcelData} disabled={saving} className="rounded-xl flex gap-2 text-green-600 border-green-200 hover:bg-green-50"><FileSpreadsheet size={16} />استيراد إجابات Excel</Button>
              </>
            )}
            <Button onClick={saveQuestions} disabled={saving} className={`rounded-xl flex gap-2 ${saved ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}>{saving ? "جاري الحفظ..." : saved ? "✓ تم الحفظ" : <><Save size={16} />حفظ التعديلات</>}</Button>
          </div>
        </div>
      )}

      {activeTab === "responses" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4 shadow-sm"><p className="text-3xl font-bold text-gray-900">{responses.length}</p><p className="text-xs text-gray-500">إجمالي الردود</p></div>
            <div className="bg-white rounded-xl border p-4 shadow-sm"><p className="text-3xl font-bold text-gray-900">{questions.length}</p><p className="text-xs text-gray-500">عدد الأسئلة</p></div>
            <div className="bg-white rounded-xl border p-4 shadow-sm"><p className="text-3xl font-bold text-gray-900">{responses.length > 0 ? fmtDate(responses[0].submittedAt) : "—"}</p><p className="text-xs text-gray-500">آخر رد</p></div>
            <div className="bg-white rounded-xl border p-4 shadow-sm"><p className="text-3xl font-bold text-gray-900">{form.status === "active" ? "نشط" : "مسودة"}</p><p className="text-xs text-gray-500">حالة الاستبيان</p></div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={exportExcel} disabled={exporting || responses.length === 0} variant="outline" className="rounded-xl flex gap-2"><FileSpreadsheet size={16} className="text-green-600" />{exporting ? "جاري التصدير..." : "تصدير Excel"}</Button>
            <Button onClick={printAllPDFs} disabled={printingPdf || responses.length === 0} variant="outline" className="rounded-xl flex gap-2"><Printer size={16} className="text-red-500" />{printingPdf ? "جاري الإنشاء..." : `طباعة PDF + ZIP (${responses.length} رد)`}</Button>
          </div>
          {responses.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center"><div className="text-5xl mb-4">📊</div><h3 className="text-lg font-semibold text-gray-700 mb-1">لا توجد ردود بعد</h3><p className="text-sm text-gray-400">شارك رابط الاستبيان لبدء جمع الردود</p></div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">تحليل الإجابات</h3>
              {analytics.map((a, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3"><span className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">{i + 1}</span><h4 className="font-semibold text-gray-800 text-sm">{a.question}</h4><span className="text-xs text-gray-400 mr-auto">{a.total} رد</span></div>
                  {"counts" in a && a.counts && (
                    <div className="space-y-2">
                      {Object.entries(a.counts).map(([opt, count]) => {
                        const pct = a.total > 0 ? Math.round((count / a.total) * 100) : 0;
                        return (
                          <div key={opt} className="flex items-center gap-3">
                            <span className="text-xs text-gray-600 w-28 truncate text-left">{opt}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden"><div className="bg-blue-500 h-full rounded-full flex items-center justify-end px-2 transition-all" style={{ width: `${Math.max(pct, 2)}%` }}>{pct > 10 && <span className="text-xs text-white font-medium">{pct}%</span>}</div></div>
                            <span className="text-xs text-gray-500 w-12 text-left">{count} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {"average" in a && <div className="flex items-center gap-2"><span className="text-2xl font-bold text-blue-600">{a.average}</span><span className="text-sm text-gray-400">/ 5 متوسط</span></div>}
                  {"textResponses" in a && a.textResponses && a.textResponses.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-auto">
                      {a.textResponses.slice(0, 10).map((t, ti) => <div key={ti} className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{t}</div>)}
                      {a.textResponses.length > 10 && <p className="text-xs text-gray-400">+{a.textResponses.length - 10} رد آخر</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {responses.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b bg-gray-50"><h3 className="text-sm font-semibold text-gray-700">سجل الردود (اضغط على أي رد لعرض إجاباته)</h3></div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-auto">
                {responses.map((r, ri) => (
                  <div key={r.$id} onClick={() => setSelectedResponse(r)} className="px-5 py-3 flex items-center justify-between hover:bg-blue-50 cursor-pointer transition-colors group">
                    <div className="flex items-center gap-3"><span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold group-hover:bg-blue-100">{ri + 1}</span><span className="text-sm text-gray-700">رد #{ri + 1}</span></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{fmtDate(r.submittedAt)}</span>
                      <Eye size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response Detail Modal */}
          {selectedResponse && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedResponse(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-l from-blue-50 to-white">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">تفاصيل الرد #{responses.indexOf(selectedResponse) + 1}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(selectedResponse.submittedAt)}</p>
                  </div>
                  <button onClick={() => setSelectedResponse(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
                </div>
                {/* Answers */}
                <div className="overflow-y-auto max-h-[65vh] p-6 space-y-4">
                  {questions.map((q, qi) => {
                    const a = answers.find(ans => ans.responseId === selectedResponse.$id && ans.questionId === q.$id);
                    let ansText = "—";
                    if (a) {
                      let valStr = a.textValue || (a.numberValue !== undefined && a.numberValue !== null ? String(a.numberValue) : "");
                      if (a.selectedOptions && a.selectedOptions.length) {
                        ansText = a.selectedOptions.join("، ");
                      } else if (valStr) {
                        ansText = valStr;
                        if (q.type === "likert" && ["1","2","3","4","5"].includes(valStr) && q.options.length === 5) {
                          ansText = q.options[5 - parseInt(valStr)];
                        }
                      }
                    }
                    return (
                      <div key={q.$id} className="border-b border-gray-100 pb-3 last:border-0">
                        <div className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{qi + 1}</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-800 mb-1">{q.text}</p>
                            <div className={`text-sm px-3 py-1.5 rounded-lg inline-block ${ansText === "—" ? "bg-gray-50 text-gray-400" : "bg-blue-50 text-blue-700 font-medium"}`}>{ansText}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
