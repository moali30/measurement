'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Axis, ReportData } from '@/types/analysis';
import { Upload, FileText, Calendar, Edit3, Image as ImageIcon, Plus, Trash2, Play, Database, PenTool } from 'lucide-react';
import { listFormsServer, loadFormDetailServer } from '@/app/actions/dashboard';
import { listSignaturesServer } from '@/app/actions/signatures';
import { toast } from 'sonner';

interface AnalysisFormProps {
  onGenerate: (data: Partial<ReportData>, rawData: Record<string, any>[]) => void;
  isLoading: boolean;
}

export default function AnalysisForm({ onGenerate, isLoading }: AnalysisFormProps) {
  const [dataSource, setDataSource] = useState<'db' | 'file'>('db');
  const [formsList, setFormsList] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [isFetchingForms, setIsFetchingForms] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualComment, setManualComment] = useState('');
  const [axes, setAxes] = useState<Axis[]>([{ name: '', start: 1, end: 1 }]);
  
  const [logos, setLogos] = useState({ quality: '', university: '', college: '' });
  const [signaturesList, setSignaturesList] = useState<any[]>([]);
  const [selectedSignatures, setSelectedSignatures] = useState<{name: string, url: string}[]>([]);

  useEffect(() => {
    async function loadForms() {
      setIsFetchingForms(true);
      const result = await listFormsServer();
      if (result.success && result.forms) {
        setFormsList(result.forms);
      }
      setIsFetchingForms(false);
    }
    async function loadSigs() {
      const res = await listSignaturesServer();
      if (res.success && res.signatures) {
        setSignaturesList(res.signatures);
      }
    }
    loadForms();
    loadSigs();
  }, []);

  useEffect(() => {
    async function fetchFormDetails() {
      if (!selectedFormId) return;
      const result = await loadFormDetailServer(selectedFormId);
      if (result.success && result.form && result.questions) {
        // Map logos
        setLogos(prev => ({
          ...prev,
          college: result.form.collegeLogo || prev.college,
          university: result.form.universityLogo || prev.university,
          quality: result.form.qualityLogo || prev.quality
        }));
        
        // Map axes based on question minLabel
        const formAxes: Axis[] = [];
        let currentAxis: Partial<Axis> | null = null;
        let lastOrder = 0;

        const likertQuestions = result.questions.filter((q: any) => q.type === 'likert');

        likertQuestions.forEach((q: any, i: number) => {
          const currentOrder = i + 1;
          if (q.minLabel) {
             if (currentAxis && currentAxis.name !== q.minLabel) {
                // close previous axis
                (currentAxis as Partial<Axis>).end = lastOrder;
                formAxes.push(currentAxis as Axis);
                // start new axis
                currentAxis = { name: q.minLabel, start: currentOrder };
             } else if (!currentAxis) {
                currentAxis = { name: q.minLabel, start: currentOrder };
             }
          }
          lastOrder = currentOrder;
        });

        if (currentAxis) {
          (currentAxis as Partial<Axis>).end = lastOrder;
          formAxes.push(currentAxis as Axis);
        }

        if (formAxes.length > 0) {
          setAxes(formAxes);
        }
      }
    }
    fetchFormDetails();
  }, [selectedFormId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImageUpload = (type: 'quality' | 'university' | 'college' | 'signature', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setLogos(prev => ({ ...prev, [type]: result }));
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleAddAxis = () => {
    setAxes([...axes, { name: '', start: 1, end: 1 }]);
  };

  const handleRemoveAxis = (index: number) => {
    setAxes(axes.filter((_, i) => i !== index));
  };

  const handleAxisChange = (index: number, field: keyof Axis, value: string | number) => {
    const newAxes = [...axes];
    newAxes[index] = { ...newAxes[index], [field]: value };
    setAxes(newAxes);
  };

  const handleGenerate = async () => {
    const validAxes = axes.filter(a => a.name && a.start <= a.end);

    const baseData = {
      title: title || 'تقرير تحليل الاستبيان',
      surveyDate,
      reportDate,
      manualComment,
      axes: validAxes,
      logos,
      signatures: selectedSignatures
    };

    if (dataSource === 'db') {
      if (!selectedFormId) {
        toast.warning('يرجى اختيار استبيان من القائمة أولاً');
        return;
      }
      
      const result = await loadFormDetailServer(selectedFormId);
      if (!result.success || !result.form) {
        toast.error('حدث خطأ أثناء تحميل بيانات الاستبيان: ' + result.error);
        return;
      }

      // Map DB responses to rawData array
      const rawData: Record<string, any>[] = [];
      const { questions, responses, answers } = result;

      // Optimize answer lookup by grouping them by responseId
      const answersByResponse = new Map<string, any[]>();
      answers.forEach((ans: any) => {
        if (!answersByResponse.has(ans.responseId)) {
          answersByResponse.set(ans.responseId, []);
        }
        answersByResponse.get(ans.responseId)!.push(ans);
      });
      
      // We only care about likert questions for the analysis
      const likertQuestions = questions.filter((q: any) => q.type === 'likert');
      responses.forEach((resp: any) => {
        const row: Record<string, any> = {};
        const respAnswers = answersByResponse.get(resp.$id) || [];
        
        likertQuestions.forEach((q: any) => {
          const ans = respAnswers.find((a: any) => a.questionId === q.$id);
          // format question text with number if possible, or just use text
          const key = `${q.order}. ${q.text}`;
          if (ans) {
             row[key] = ans.numberValue !== null && ans.numberValue !== undefined ? ans.numberValue : ans.textValue;
          } else {
             row[key] = 0;
          }
        });
        rawData.push(row);
      });

      // Update basic fields if not already typed by user
      if (!title && result.form.title) setTitle(result.form.title);
      
      onGenerate(baseData, rawData);
    } else {
      if (!file) {
        toast.warning('يرجى رفع ملف البيانات أولاً');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let rawData: any[] = [];
          const extension = file.name.split('.').pop()?.toLowerCase();
          
          if (extension === 'json') {
            rawData = JSON.parse(e.target?.result as string);
          } else if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
            const workbook = XLSX.read(e.target?.result, { type: 'binary' });
            const firstSheet = workbook.SheetNames[0];
            rawData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
          } else {
            toast.error('صيغة الملف غير مدعومة. يرجى استخدام Excel أو CSV أو JSON');
            return;
          }

          onGenerate(baseData, rawData);

        } catch (error) {
          console.error('Error processing file:', error);
          toast.error('حدث خطأ في معالجة الملف');
        }
      };

      if (file.name.endsWith('.json') || file.type === 'application/json') {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Basic Data */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-800 dark:text-indigo-400">
          <FileText className="mr-2 h-6 w-6" /> مصدر البيانات والأساسيات
        </h2>
        
        {/* Data Source Selector */}
        <div className="mb-6 flex gap-4 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg w-fit">
          <button
            onClick={() => setDataSource('db')}
            className={`flex items-center gap-2 px-6 py-2 rounded-md font-semibold transition-all ${dataSource === 'db' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <Database className="w-4 h-4" /> استيراد من النظام
          </button>
          <button
            onClick={() => setDataSource('file')}
            className={`flex items-center gap-2 px-6 py-2 rounded-md font-semibold transition-all ${dataSource === 'file' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <Upload className="w-4 h-4" /> رفع ملف يدوي
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {dataSource === 'db' ? (
            <div className="space-y-2">
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                <Database className="mr-2 h-4 w-4 text-indigo-500" /> اختر الاستبيان
              </label>
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                disabled={isFetchingForms}
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- يرجى الاختيار --</option>
                {formsList.map(f => (
                  <option key={f.$id} value={f.$id}>{f.title} ({f.responsesCount} ردود)</option>
                ))}
              </select>
              {isFetchingForms && <p className="text-xs text-gray-500">جاري تحميل قائمة الاستبيانات...</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                <Upload className="mr-2 h-4 w-4 text-indigo-500" /> ملف البيانات (Excel/CSV/JSON)
              </label>
              <div className="relative border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-lg p-3 hover:border-indigo-400 transition-colors bg-indigo-50/50 dark:bg-indigo-900/20">
                <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="text-center">
                  <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{file ? file.name : 'اختر ملف البيانات'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Edit3 className="mr-2 h-4 w-4 text-indigo-500" /> عنوان التقرير
            </label>
            <input type="text" placeholder="أدخل عنوان التقرير (يترك فارغاً لاستخدام عنوان الاستبيان)" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Calendar className="mr-2 h-4 w-4 text-indigo-500" /> تاريخ الاستبيان
            </label>
            <input type="date" value={surveyDate} onChange={e => setSurveyDate(e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Calendar className="mr-2 h-4 w-4 text-indigo-500" /> تاريخ التقرير
            </label>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Edit3 className="mr-2 h-4 w-4 text-indigo-500" /> ملاحظات إضافية (يدوي)
          </label>
          <textarea rows={4} value={manualComment} onChange={e => setManualComment(e.target.value)} placeholder="أدخل أي ملاحظات إضافية هنا" className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
        </div>
      </div>

      {/* Axes */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-800 dark:text-indigo-400">
           إعدادات المحاور
        </h2>
        <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-lg border-r-4 border-indigo-600 space-y-4">
          {axes.map((axis, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
              <input type="text" placeholder="اسم المحور" value={axis.name} onChange={e => handleAxisChange(index, 'name', e.target.value)} className="flex-1 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex items-center gap-2">
                <span className="text-sm">من السؤال</span>
                <input type="number" min="1" value={axis.start} onChange={e => handleAxisChange(index, 'start', parseInt(e.target.value))} className="w-20 p-2 text-center border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900" />
                <span className="text-sm">إلى</span>
                <input type="number" min="1" value={axis.end} onChange={e => handleAxisChange(index, 'end', parseInt(e.target.value))} className="w-20 p-2 text-center border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900" />
              </div>
              <button onClick={() => handleRemoveAxis(index)} className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
          <button onClick={handleAddAxis} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors">
            <Plus className="h-4 w-4" /> إضافة محور جديد
          </button>
        </div>
      </div>

      {/* Logos and Signature */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-800 dark:text-indigo-400">
          <ImageIcon className="mr-2 h-6 w-6" /> الشعارات والتوقيع
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { id: 'quality', label: 'شعار الجودة', value: logos.quality },
            { id: 'university', label: 'شعار الجامعة', value: logos.university },
            { id: 'college', label: 'شعار الكلية', value: logos.college }
          ].map(item => (
            <div key={item.id} className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">{item.label}</label>
              <div className="relative border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-lg p-4 hover:border-indigo-400 transition-colors bg-indigo-50/50 dark:bg-indigo-900/20 text-center">
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(item.id as any, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {item.value ? 'تم الرفع ✓' : 'رفع الصورة'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-bold mt-8 mb-4 flex items-center text-indigo-800 dark:text-indigo-400">
          <PenTool className="mr-2 h-5 w-5" /> التوقيعات المعتمدة (توقيعين بحد أقصى)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((index) => (
            <div key={index} className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">التوقيع {index + 1}</label>
              <select 
                value={selectedSignatures[index]?.url || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const sig = signaturesList.find(s => s.image_url === val);
                  const newSigs = [...selectedSignatures];
                  if (sig) {
                    newSigs[index] = { name: sig.name, url: sig.image_url };
                  } else {
                    newSigs.splice(index, 1); // remove if empty
                  }
                  // Clean up array if there's an empty slot at 0 and item at 1
                  const cleanSigs = newSigs.filter(Boolean);
                  setSelectedSignatures(cleanSigs);
                }}
                className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- بدون توقيع --</option>
                {signaturesList.map(s => (
                  <option key={s.id} value={s.image_url}>{s.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center mt-8">
        <button 
          onClick={handleGenerate}
          disabled={isLoading || (dataSource === 'db' ? !selectedFormId && !isFetchingForms : !file)}
          className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg transform transition-all hover:-translate-y-1 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <Play className="h-6 w-6" />}
          إنشاء التقرير
        </button>
      </div>

    </div>
  );
}
