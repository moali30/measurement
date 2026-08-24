'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Axis, ReportData } from '@/types/analysis';
import { Upload, FileText, Calendar, Edit3, Image as ImageIcon, Plus, Trash2, Play, Database, PenTool } from 'lucide-react';
import { listFormsServer, loadFormDetailServer } from '@/app/actions/dashboard';
import { listSignaturesServer } from '@/app/actions/signatures';
import { readImageAsCompressedDataUrl, readImageUrlAsCompressedDataUrl } from '@/lib/image-utils';
import { toast } from 'sonner';

/** خيارات المحرك التي يضبطها المستخدم قبل توليد التقرير */
export interface AnalysisEngineOptions {
  reversedQuestions: string[];
  comparisonColumn?: string;
  scaleMaxOverride?: number;
  questionScaleMax?: Record<string, number>;
  questionScaleMin?: Record<string, number>;
  questionValueMaps?: Record<string, Record<string, number>>;
}

interface AnalysisFormProps {
  onGenerate: (
    data: Partial<ReportData>,
    rawData: Record<string, unknown>[],
    questionTypes?: Record<string, string>,
    commentQuestions?: string[],
    engineOptions?: AnalysisEngineOptions
  ) => void;
  isLoading: boolean;
}

export default function AnalysisForm({ onGenerate, isLoading }: AnalysisFormProps) {
  const [dataSource, setDataSource] = useState<'db' | 'file'>('db');
  const [formsList, setFormsList] = useState<{ $id: string; title: string; responsesCount: number; [key: string]: unknown }[]>([]);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [isFetchingForms, setIsFetchingForms] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualComment, setManualComment] = useState('');
  const [axes, setAxes] = useState<Axis[]>([{ name: '', start: 1, end: 1 }]);
  
  const [logos, setLogos] = useState({ quality: '', university: '', college: '' });
  const [signaturesList, setSignaturesList] = useState<{
    id: string;
    name: string;
    image_url: string;
    embedded_url?: string;
    [key: string]: unknown;
  }[]>([]);
  const [selectedSignatures, setSelectedSignatures] = useState<{
    name: string;
    url: string;
    sourceUrl?: string;
  }[]>([]);

  // Filtering & processing state
  const [loadedRawData, setLoadedRawData] = useState<Record<string, unknown>[]>([]);
  const [questionTypes, setQuestionTypes] = useState<Record<string, string>>({});
  const [availableFilters, setAvailableFilters] = useState<{column: string, values: string[]}[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

  const [availableCommentCols, setAvailableCommentCols] = useState<string[]>([]);
  const [commentQuestions, setCommentQuestions] = useState<string[]>([]);

  // خيارات المحرك
  const [reversedQuestions, setReversedQuestions] = useState<string[]>([]);
  const [comparisonColumn, setComparisonColumn] = useState('');
  const [scaleMaxOverride, setScaleMaxOverride] = useState('');
  const [questionScaleMax, setQuestionScaleMax] = useState<Record<string, number>>({});
  const [questionScaleMin, setQuestionScaleMin] = useState<Record<string, number>>({});
  const [questionValueMaps, setQuestionValueMaps] = useState<Record<string, Record<string, number>>>({});

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
        const embedded = await Promise.all(
          res.signatures.map(async (signature) => ({
            ...signature,
            embedded_url: await readImageUrlAsCompressedDataUrl(signature.image_url).catch(
              () => signature.image_url
            ),
          }))
        );
        setSignaturesList(embedded);
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
        // النماذج المنشأة من الواجهة تُخزّن order_index من الصفر، بينما بعض
        // البيانات القديمة تبدأ من 1. نعرض أرقاماً بشرية تبدأ من 1 في الحالتين.
        const orderOffset = result.questions.some(
          (question: Record<string, unknown>) => Number(question.order) === 0
        ) ? 1 : 0;
        const displayOrder = (question: Record<string, unknown>) =>
          Number(question.order) + orderOffset;
        const questionKey = (question: Record<string, unknown>) =>
          `${displayOrder(question)}. ${question.text}`;

        // قوالب الرأس والتذييل تحتاج الصور مضمّنة كـ data URL. إذا منع المصدر
        // التحميل عبر CORS نحتفظ بالرابط للغلاف بدلاً من إسقاط الصورة كلياً.
        const logoSources = {
          college: result.form.collegeLogo || '',
          university: result.form.universityLogo || '',
          quality: result.form.qualityLogo || '',
        };
        const embeddedLogos = Object.fromEntries(
          await Promise.all(
            Object.entries(logoSources).map(async ([key, value]) => [
              key,
              value
                ? await readImageUrlAsCompressedDataUrl(value).catch(() => value)
                : '',
            ])
          )
        ) as typeof logos;
        setLogos((previous) => ({
          college: embeddedLogos.college || previous.college,
          university: embeddedLogos.university || previous.university,
          quality: embeddedLogos.quality || previous.quality,
        }));
        
        // Map axes based on question minLabel.
        // مهم: النطاق يجب أن يُبنى على ترتيب السؤال الأصلي بعد تحويله لرقم عرض
        // يبدأ من 1، وليس على ترتيبه داخل قائمة likert. مفتاح العمود أدناه يحمل
        // الرقم نفسه، وprocessData
        // يستخرج questionNumber من نفس المفتاح. استخدام i+1 كان يزيح النطاق
        // بعدد الأسئلة غير الليكرتية السابقة (سؤال «النوع» مثلاً) فتخرج متوسطات
        // المحاور محسوبة على أسئلة أخرى بصمت.
        const formAxes: Axis[] = [];
        const axesByName = new Map<string, Axis>();

        const likertQuestions = result.questions.filter((q: Record<string, unknown>) => q.type === 'likert');

        likertQuestions.forEach((q: Record<string, unknown>) => {
          const currentOrder = displayOrder(q);
          if (!Number.isFinite(currentOrder)) return;
          const axisName = String(q.minLabel || '').trim();
          if (!axisName) return;

          const existing = axesByName.get(axisName);
          if (existing) {
            existing.start = Math.min(existing.start, currentOrder);
            existing.end = Math.max(existing.end, currentOrder);
            existing.questionNumbers = [...(existing.questionNumbers ?? []), currentOrder];
          } else {
            const axis: Axis = {
              name: axisName,
              start: currentOrder,
              end: currentOrder,
              questionNumbers: [currentOrder],
            };
            axesByName.set(axisName, axis);
            formAxes.push(axis);
          }
        });

        if (formAxes.length > 0) {
          setAxes(formAxes);
        }

        // --- Process Raw Data and Filters immediately ---
        const rawData: Record<string, unknown>[] = [];
        const qTypes: Record<string, string> = {};
        const qScales: Record<string, number> = {};
        const qScaleMins: Record<string, number> = {};
        const qValueMaps: Record<string, Record<string, number>> = {};
        const filterableCols: {column: string, values: string[]}[] = [];
        
        const { responses, answers } = result;
        
        const answersByResponse = new Map<string, Record<string, unknown>[]>();
        answers.forEach((ans: Record<string, unknown>) => {
          const respId = ans.responseId as string;
          if (!answersByResponse.has(respId)) {
            answersByResponse.set(respId, []);
          }
          answersByResponse.get(respId)!.push(ans);
        });
        
        const analysisQuestions = result.questions.filter((q: Record<string, unknown>) => 
          ['likert', 'text', 'textarea', 'rating', 'linear_scale', 'number', 'yes_no', 'radio', 'select', 'dropdown', 'multiple_choice', 'checkbox'].includes(q.type as string)
        );
        
        analysisQuestions.forEach((q: Record<string, unknown>) => {
            const key = questionKey(q);
            qTypes[key] = q.type as string;
            const explicitMax = Number(q.maxValue);
            const explicitMin = Number(q.minValue);
            const optionLabels = Array.isArray(q.options)
              ? q.options.map((option) => String(option).trim()).filter(Boolean)
              : [];
            const optionsCount = optionLabels.length;
            // في أسئلة ليكرت، البدائل التي يراها المشارك هي مصدر الحقيقة.
            // maxValue قد يبقى من نوع سؤال سابق أو من نموذج قديم، وتفضيله على
            // عدد البدائل كان يجعل خمس إجابات تُحلل على سُلَّم من ثلاث درجات.
            if (q.type === 'likert' && optionsCount > 1) {
              qScales[key] = optionsCount;
              qScaleMins[key] = 1;
              qValueMaps[key] = Object.fromEntries(
                optionLabels.map((option, index) => [option, optionsCount - index])
              );
            } else if (
              Number.isFinite(explicitMax) &&
              Number.isFinite(explicitMin) &&
              explicitMax > explicitMin
            ) {
              qScales[key] = explicitMax;
              qScaleMins[key] = explicitMin;
            } else if (Number.isFinite(explicitMax) && explicitMax > 1) {
              qScales[key] = explicitMax;
              qScaleMins[key] = 1;
            }
            if (['radio', 'select', 'dropdown', 'multiple_choice'].includes(q.type as string)) {
                filterableCols.push({ column: key, values: [] });
            }
        });
        
        responses.forEach((resp: Record<string, unknown>) => {
          const row: Record<string, unknown> = {};
          const respAnswers = answersByResponse.get(resp.$id as string) || [];
          
          analysisQuestions.forEach((q: Record<string, unknown>) => {
            const ans = respAnswers.find((a: Record<string, unknown>) => a.questionId === q.$id);
            const key = questionKey(q);
            if (ans) {
               row[key] = ans.numberValue !== null && ans.numberValue !== undefined ? ans.numberValue : ans.textValue;
               
               // Collect unique values for filterable columns
               if (['radio', 'select', 'dropdown', 'multiple_choice'].includes(q.type as string) && row[key]) {
                   const fCol = filterableCols.find(f => f.column === key);
                   if (fCol && !fCol.values.includes(row[key] as string)) {
                       fCol.values.push(row[key] as string);
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
        setQuestionScaleMax(qScales);
        setQuestionScaleMin(qScaleMins);
        setQuestionValueMaps(qValueMaps);
        setAvailableFilters(filterableCols.filter(f => f.values.length > 0));
        setActiveFilters({});
        
        const allQuestionsKeys = analysisQuestions.map(questionKey);
        setAvailableCommentCols(allQuestionsKeys);
        const textQuestions = analysisQuestions
           .filter((q: Record<string, unknown>) => q.type === 'text' || q.type === 'textarea')
           .map(questionKey);
        setCommentQuestions(textQuestions);
        
        if (result.form.title) {
           setSurveyTitle(result.form.title);
           setTitle((current) => current || result.form.title);
        }
        if (result.form.createdAt) {
           try {
             setSurveyDate(new Date(result.form.createdAt).toISOString().split('T')[0]);
           } catch {
             // Ignore invalid date strings
           }
        }
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
             let rawData: Record<string, unknown>[] = [];
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
                setQuestionScaleMax({});
                setQuestionScaleMin({});
                setQuestionValueMaps({});
                setAvailableFilters(filterableCols);
                setActiveFilters({});
                
                const allCols = keys;
                setAvailableCommentCols(allCols);
                
                const detectedComments: string[] = [];
                allCols.forEach(key => {
                   let isText = false;
                   for(const row of rawData) {
                      const val = String(row[key] || '').trim();
                      if (val && isNaN(parseFloat(val)) && !["موافق", "محايد", "نعم", "لا", "ممتاز", "جيد", "مقبول", "ضعيف"].some(v => val.includes(v))) {
                          isText = true;
                          break;
                      }
                   }
                   if (isText) detectedComments.push(key);
                });
                setCommentQuestions(detectedComments);
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

  const handleImageUpload = async (type: 'quality' | 'university' | 'college' | 'signature', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const dataUrl = await readImageAsCompressedDataUrl(e.target.files[0]);
        setLogos(prev => ({ ...prev, [type]: dataUrl }));
      } catch {
        toast.error('تعذّرت قراءة الصورة. جرّب صيغة PNG أو JPG.');
      }
    }
  };

  const handleSettingsUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const settingsFile = event.target.files?.[0];
    if (!settingsFile) return;

    try {
      const parsed = JSON.parse(await settingsFile.text()) as Record<string, unknown>;
      if (parsed.version !== 1 || typeof parsed.title !== 'string' || !Array.isArray(parsed.axes)) {
        throw new Error('unsupported settings format');
      }

      setTitle(parsed.title);
      if (typeof parsed.surveyDate === 'string') setSurveyDate(parsed.surveyDate);
      if (typeof parsed.reportDate === 'string') setReportDate(parsed.reportDate);
      if (typeof parsed.manualComment === 'string') setManualComment(parsed.manualComment);

      const loadedAxes = parsed.axes.filter((axis): axis is Axis => {
        if (!axis || typeof axis !== 'object') return false;
        const candidate = axis as Partial<Axis>;
        return (
          typeof candidate.name === 'string' &&
          typeof candidate.start === 'number' &&
          typeof candidate.end === 'number'
        );
      });
      if (loadedAxes.length > 0) setAxes(loadedAxes);

      if (Array.isArray(parsed.filters)) {
        const restoredFilters: Record<string, string[]> = {};
        parsed.filters.forEach((filter) => {
          if (!filter || typeof filter !== 'object') return;
          const candidate = filter as { column?: unknown; values?: unknown };
          if (typeof candidate.column === 'string' && Array.isArray(candidate.values)) {
            restoredFilters[candidate.column] = candidate.values.map(String);
          }
        });
        setActiveFilters(restoredFilters);
      }

      if (Array.isArray(parsed.signatures)) {
        setSelectedSignatures(
          parsed.signatures
            .filter((signature) => signature && typeof signature === 'object')
            .map((signature) => signature as { name?: unknown; url?: unknown })
            .filter((signature) => typeof signature.name === 'string' && typeof signature.url === 'string')
            .slice(0, 2)
            .map((signature) => ({ name: String(signature.name), url: String(signature.url) }))
        );
      }

      if (parsed.analysisOptions && typeof parsed.analysisOptions === 'object') {
        const options = parsed.analysisOptions as {
          reversedQuestions?: unknown;
          comparisonColumn?: unknown;
          scaleMaxOverride?: unknown;
        };
        setReversedQuestions(
          Array.isArray(options.reversedQuestions) ? options.reversedQuestions.map(String) : []
        );
        setComparisonColumn(typeof options.comparisonColumn === 'string' ? options.comparisonColumn : '');
        setScaleMaxOverride(
          typeof options.scaleMaxOverride === 'number' ? String(options.scaleMaxOverride) : ''
        );
      }

      toast.success('تم تحميل إعدادات التقرير. راجع مصدر البيانات ثم أنشئ التقرير.');
    } catch {
      toast.error('ملف الإعدادات غير صالح أو من إصدار غير مدعوم.');
    } finally {
      event.target.value = '';
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
    newAxes[index] = {
      ...newAxes[index],
      [field]: value,
      // تعديل النطاق يعلن أن المستخدم يريد النطاق اليدوي بدلاً من العضوية
      // الدقيقة القادمة من قاعدة البيانات.
      ...((field === 'start' || field === 'end') ? { questionNumbers: undefined } : {}),
    };
    setAxes(newAxes);
  };

  const handleGenerate = async () => {
    const validAxes = axes.filter(a => a.name && a.start <= a.end);

    const filterArray = Object.keys(activeFilters)
        .filter(col => activeFilters[col].length > 0)
        .map(col => ({ column: col, values: activeFilters[col] }));

    const baseData = {
      title: title || surveyTitle || 'تقرير تحليل الاستبيان',
      surveyDate,
      reportDate,
      manualComment,
      axes: validAxes,
      logos,
      signatures: selectedSignatures.map(({ name, url }) => ({ name, url })),
      filters: filterArray,
      analysisOptions: {
        reversedQuestions,
        comparisonColumn: comparisonColumn || undefined,
        scaleMaxOverride: scaleMaxOverride ? Number(scaleMaxOverride) : undefined,
      }
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

    onGenerate(baseData, finalData, questionTypes, commentQuestions, {
      reversedQuestions,
      scaleMaxOverride: scaleMaxOverride ? Number(scaleMaxOverride) : undefined,
      questionScaleMax,
      questionScaleMin,
      questionValueMaps,
      // عمود المقارنة لا معنى له لو صُفّي إلى قيمة واحدة
      comparisonColumn:
        comparisonColumn && (activeFilters[comparisonColumn]?.length ?? 0) !== 1
          ? comparisonColumn
          : undefined,
    });
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

          <div className="mt-5">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer font-semibold text-sm">
              <FileText className="w-4 h-4" /> تحميل إعدادات تقرير محفوظة (JSON)
              <input type="file" accept="application/json,.json" onChange={handleSettingsUpload} className="hidden" />
            </label>
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

        {/* Comments Selection Section */}
        {availableCommentCols.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-800 dark:text-indigo-400">
               أسئلة التعليقات والملاحظات (النصية)
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
               حدد الأسئلة التي ترغب في إدراجها كتعليقات في نهاية التقرير ولن تدخل في التحليل الكمي.
            </p>
            <div className="max-h-64 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/50">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                 {availableCommentCols.map((col, idx) => {
                    const isChecked = commentQuestions.includes(col);
                    return (
                       <label key={idx} className="flex items-start gap-3 cursor-pointer bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700 hover:border-indigo-500 transition-colors shadow-sm">
                          <input 
                            type="checkbox" 
                            className="form-checkbox mt-1 text-indigo-600 rounded"
                            checked={isChecked}
                            onChange={(e) => {
                               if (e.target.checked) {
                                  setCommentQuestions([...commentQuestions, col]);
                               } else {
                                  setCommentQuestions(commentQuestions.filter(c => c !== col));
                               }
                            }}
                          />
                          <span className="text-sm text-gray-800 dark:text-gray-200 leading-tight">{col}</span>
                       </label>
                    );
                 })}
               </div>
            </div>
          </div>
        )}

      {/* Engine options: reverse-coded questions + category comparison */}
      {availableCommentCols.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-800 dark:text-indigo-400">
            خيارات التحليل المتقدمة
          </h2>

          {availableFilters.length > 0 && (
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                مقارنة بين الفئات
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                اختر عموداً تصنيفياً لإضافة جدول يقارن متوسطات المحاور بين فئاته (مثلاً: النوع أو المستوى).
              </p>
              <select
                value={comparisonColumn}
                onChange={(e) => setComparisonColumn(e.target.value)}
                className="w-full md:w-2/3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- بدون مقارنة --</option>
                {availableFilters.map((filter) => (
                  <option key={filter.column} value={filter.column}>{filter.column}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              سُلَّم القياس
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              اتركه تلقائياً لاستخدام توصيف كل سؤال أو اكتشافه من البيانات، وثبّته يدوياً إذا كان ملف Excel لا يحتوي توصيف السُّلَّم.
            </p>
            <select
              value={scaleMaxOverride}
              onChange={(e) => setScaleMaxOverride(e.target.value)}
              className="w-full md:w-2/3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">تلقائي — لكل سؤال</option>
              {[3, 4, 5, 7, 10].map((value) => (
                <option key={value} value={value}>تثبيت السُّلَّم على {value} درجات</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              الأسئلة العكسية
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              حدد الأسئلة التي تكون فيها أدنى إجابة هي الأفضل (مثل «أواجه صعوبة في…»).
              ستُعاد ترميزها قبل الحساب حتى لا تُحسب نقطة ضعف وهي نقطة قوة.
            </p>
            <div className="max-h-56 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableCommentCols
                  .filter((col) => !commentQuestions.includes(col))
                  .map((col) => (
                    <label key={col} className="flex items-start gap-3 cursor-pointer bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700 hover:border-indigo-500 transition-colors shadow-sm">
                      <input
                        type="checkbox"
                        className="form-checkbox mt-1 text-indigo-600 rounded"
                        checked={reversedQuestions.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) setReversedQuestions([...reversedQuestions, col]);
                          else setReversedQuestions(reversedQuestions.filter((c) => c !== col));
                        }}
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200 leading-tight">{col}</span>
                    </label>
                  ))}
              </div>
            </div>
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
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(item.id as 'quality' | 'university' | 'college' | 'signature', e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
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
                value={selectedSignatures[index]?.sourceUrl || selectedSignatures[index]?.url || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const sig = signaturesList.find(s => s.image_url === val);
                  const newSigs = [...selectedSignatures];
                  if (sig) {
                    newSigs[index] = {
                      name: sig.name,
                      url: sig.embedded_url || sig.image_url,
                      sourceUrl: sig.image_url,
                    };
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
