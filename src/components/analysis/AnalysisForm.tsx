'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Axis, ReportData } from '@/types/analysis';
import { Upload, FileText, Calendar, Edit3, Image as ImageIcon, Plus, Trash2, Play, Database, PenTool } from 'lucide-react';
import { listFormsServer, loadFormDetailServer } from '@/app/actions/dashboard';
import { listSignaturesServer } from '@/app/actions/signatures';
import { toast } from 'sonner';

interface AnalysisFormProps {
  onGenerate: (data: Partial<ReportData>, rawData: Record<string, any>[], questionTypes?: Record<string, string>) => void;
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

  // Filtering & processing state
  const [loadedRawData, setLoadedRawData] = useState<Record<string, any>[]>([]);
  const [questionTypes, setQuestionTypes] = useState<Record<string, string>>({});
  const [availableFilters, setAvailableFilters] = useState<{column: string, values: string[]}[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

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

        // --- Process Raw Data and Filters immediately ---
        const rawData: Record<string, any>[] = [];
        const qTypes: Record<string, string> = {};
        const filterableCols: {column: string, values: string[]}[] = [];
        
        const { responses, answers } = result;
        
        const answersByResponse = new Map<string, any[]>();
        answers.forEach((ans: any) => {
          if (!answersByResponse.has(ans.responseId)) {
            answersByResponse.set(ans.responseId, []);
          }
          answersByResponse.get(ans.responseId)!.push(ans);
        });
        
        const analysisQuestions = result.questions.filter((q: any) => 
          ['likert', 'text', 'textarea', 'rating', 'number', 'radio', 'select', 'dropdown', 'checkbox'].includes(q.type)
        );
        
        analysisQuestions.forEach((q: any) => {
            const key = `${q.order}. ${q.text}`;
            qTypes[key] = q.type;
            if (['radio', 'select', 'dropdown'].includes(q.type)) {
                filterableCols.push({ column: key, values: [] });
            }
        });
        
        responses.forEach((resp: any) => {
          const row: Record<string, any> = {};
          const respAnswers = answersByResponse.get(resp.$id) || [];
          
          analysisQuestions.forEach((q: any) => {
            const ans = respAnswers.find((a: any) => a.questionId === q.$id);
            const key = `${q.order}. ${q.text}`;
            if (ans) {
               row[key] = ans.numberValue !== null && ans.numberValue !== undefined ? ans.numberValue : ans.textValue;
               
               // Collect unique values for filterable columns
               if (['radio', 'select', 'dropdown'].includes(q.type) && row[key]) {
                   const fCol = filterableCols.find(f => f.column === key);
                   if (fCol && !fCol.values.includes(row[key])) {
                       fCol.values.push(row[key]);
                   }
               }
            } else {
               row[key] = null;
            }
          });
          rawData.push(row);
        });
        
        setLoadedRawData(rawData);
        setQuestionTypes(qTypes);
        setAvailableFilters(filterableCols.filter(f => f.values.length > 0));
        setActiveFilters({});
        if (!title && result.form.title) setTitle(result.form.title);
      }
    }
    fetchFormDetails();
  }, [selectedFormId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      const reader = new FileReader();
      reader.onload = (event) => {
         try {
             let rawData: any[] = [];
             const extension = selectedFile.name.split('.').pop()?.toLowerCase();
             if (extension === 'json') {
               rawData = JSON.parse(event.target?.result as string);
             } else if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
               const workbook = XLSX.read(event.target?.result, { type: 'binary' });
               const firstSheet = workbook.SheetNames[0];
               rawData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
             }
             
             if (rawData.length > 0) {
                const keys = Object.keys(rawData[0]);
                const filterableCols: {column: string, values: string[]}[] = [];
                
                keys.forEach(key => {
                   const uniqueValues = new Set<string>();
                   let isNumeric = false;
                   for(const row of rawData) {
                      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                          const valStr = String(row[key]).trim();
                          if (!isNaN(parseFloat(valStr)) && !["موافق", "محايد", "نعم", "لا"].some(v => valStr.includes(v))) {
                              isNumeric = true;
                          }
                          uniqueValues.add(valStr);
                      }
                   }
                   if (!isNumeric && uniqueValues.size > 0 && uniqueValues.size <= 10) {
                       filterableCols.push({ column: key, values: Array.from(uniqueValues) });
                   }
                });
                
                setLoadedRawData(rawData);
                setQuestionTypes({});
                setAvailableFilters(filterableCols);
                setActiveFilters({});
             }
         } catch(err) {
            console.error('Error parsing file for preview', err);
         }
      };
      
      if (selectedFile.name.endsWith('.json') || selectedFile.type === 'application/json') {
        reader.readAsText(selectedFile);
      } else {
        reader.readAsBinaryString(selectedFile);
      }
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
      if (!selectedFormId || loadedRawData.length === 0) {
        toast.warning('يرجى اختيار استبيان من القائمة أولاً');
        return;
      }
    } else {
      if (!file || loadedRawData.length === 0) {
        toast.warning('يرجى رفع ملف البيانات أولاً');
        return;
      }
    }
    
    // Apply Filters
    let finalData = [...loadedRawData];
    Object.keys(activeFilters).forEach(col => {
       const selectedVals = activeFilters[col];
       if (selectedVals.length > 0) {
           finalData = finalData.filter(row => selectedVals.includes(String(row[col])));
       }
    });

    if (finalData.length === 0) {
       toast.error('لا توجد بيانات متاحة بعد تطبيق الفلاتر المحددة.');
       return;
    }

    onGenerate(baseData, finalData, questionTypes);
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

        {/* Filters Section */}
        {availableFilters.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-800 dark:text-indigo-400">
               تصفية البيانات (الفلاتر)
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
               يمكنك تحديد الفئات التي ترغب في تضمينها في التحليل. إذا لم تحدد أي خيار، سيتم تجاهل الفلتر وإدراج الجميع.
            </p>
            <div className="space-y-6">
               {availableFilters.map((filter, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                     <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3">{filter.column}</h3>
                     <div className="flex flex-wrap gap-4">
                        {filter.values.map((val, vIdx) => {
                           const isChecked = activeFilters[filter.column]?.includes(val) || false;
                           return (
                              <label key={vIdx} className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 hover:border-indigo-500 transition-colors">
                                 <input 
                                   type="checkbox" 
                                   className="form-checkbox text-indigo-600 rounded"
                                   checked={isChecked}
                                   onChange={(e) => {
                                      const newFilters = { ...activeFilters };
                                      if (!newFilters[filter.column]) newFilters[filter.column] = [];
                                      
                                      if (e.target.checked) {
                                         newFilters[filter.column].push(val);
                                      } else {
                                         newFilters[filter.column] = newFilters[filter.column].filter(v => v !== val);
                                      }
                                      setActiveFilters(newFilters);
                                   }}
                                 />
                                 <span className="text-sm text-gray-800 dark:text-gray-200">{val}</span>
                              </label>
                           );
                        })}
                     </div>
                  </div>
               ))}
            </div>
          </div>
        )}

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
