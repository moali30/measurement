'use client';

import React, { useEffect, useRef, useState } from 'react';
import AnalysisForm, { AnalysisEngineOptions } from '@/components/analysis/AnalysisForm';
import AnalysisReport from '@/components/analysis/AnalysisReport';
import { processData } from '@/lib/analysis-utils';
import { ReportData } from '@/types/analysis';
import { Braces, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { PDF_CONFIG } from '@/lib/pdf/config';
import { exportAnalysisSettings, exportAnalysisWorkbook } from '@/lib/analysis-export';

/** هامش أمان تحت حد جسم الطلب على Vercel (~4.5MB) */
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

async function countPdfPages(blob: Blob): Promise<number> {
  const raw = new TextDecoder('latin1').decode(await blob.arrayBuffer());
  const treeCounts = Array.from(raw.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,500}?\/Count\s+(\d+)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (treeCounts.length > 0) return Math.max(...treeCounts);

  const pageObjects = raw.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  return Math.max(1, pageObjects);
}

function downloadPdfBlob(blob: Blob, data: ReportData) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = PDF_CONFIG.buildFilename(data.title, data.reportDate);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AnalysisPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewPdfBlob, setPreviewPdfBlob] = useState<Blob | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPageCount, setPreviewPageCount] = useState(1);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewError, setPreviewError] = useState('');

  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  const handleGenerate = (
    formData: Partial<ReportData>,
    rawData: Record<string, unknown>[],
    questionTypes?: Record<string, string>,
    commentQuestions?: string[],
    engineOptions?: AnalysisEngineOptions
  ) => {
    setIsGenerating(true);
    // Simulate slight delay for UX
    setTimeout(() => {
      const processed = processData(rawData, formData.axes || [], questionTypes, commentQuestions, {
        reversedQuestions: engineOptions?.reversedQuestions,
        comparisonColumn: engineOptions?.comparisonColumn,
        scaleMaxOverride: engineOptions?.scaleMaxOverride,
        questionScaleMax: engineOptions?.questionScaleMax,
        questionScaleMin: engineOptions?.questionScaleMin,
        questionValueMaps: engineOptions?.questionValueMaps,
      });

      // محور لا يطابق أي سؤال يعني أن نطاق الأرقام خاطئ. بدون هذا التحذير كان
      // المحور يخرج في التقرير بمتوسط 0% ويبدو كأنه نتيجة حقيقية.
      const emptyAxes = processed.axes.filter((axis) => !axis.count);
      if (emptyAxes.length > 0) {
        toast.warning(
          `${emptyAxes.length === 1 ? 'محور لا يطابق' : 'محاور لا تطابق'} أي أسئلة: ${emptyAxes
            .map((axis) => `«${axis.name}»`)
            .join('، ')} — راجع نطاق أرقام الأسئلة.`,
          { duration: 8000 }
        );
      }

      const repairedScales = (processed.analysisWarnings ?? []).filter(
        (warning) => warning.code === 'scale-promoted' || warning.code === 'invalid-values-excluded'
      );
      if (repairedScales.length > 0) {
        toast.warning(
          `راجع سلامة السلالم: أجرى المحرك ${repairedScales.length} تصحيحاً موثقاً داخل التقرير لمنع نتائج غير منطقية.`,
          { duration: 10000 }
        );
      }

      setPreviewPdfBlob(null);
      setPreviewPdfUrl(null);
      setReportData({
        ...formData,
        ...processed
      } as ReportData);
      setIsGenerating(false);
    }, 500);
  };

  const requestPdfBlob = async (): Promise<Blob> => {
    if (!reportData) throw new Error('لا يوجد تقرير جاهز للتصدير');
    const payload = JSON.stringify(reportData);

    // حد جسم الطلب على Vercel قرابة 4.5MB، والشعارات base64 هي أثقل ما فيه.
    if (new Blob([payload]).size > MAX_PAYLOAD_BYTES) {
      throw new Error(
        'حجم بيانات التقرير كبير جداً — الشعارات أو التوقيعات المرفوعة ضخمة. استخدم صوراً أصغر وأعد المحاولة.'
      );
    }

    const response = await fetch('/api/reports/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error || 'فشل إنشاء ملف PDF');
    }

    return response.blob();
  };

  const handleOpenPreview = async () => {
    if (!reportData) return;
    setIsPreviewOpen(true);
    setPreviewError('');
    setPreviewPage(1);
    setIsExporting(true);

    try {
      const blob = previewPdfBlob ?? await requestPdfBlob();
      if (!previewPdfBlob) setPreviewPdfBlob(blob);
      if (!previewPdfUrl) setPreviewPdfUrl(URL.createObjectURL(blob));
      setPreviewPageCount(await countPdfPages(blob));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذرت معاينة التقرير';
      setPreviewError(message);
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    setIsExporting(true);

    try {
      toast.info('جاري تجهيز التقرير، يرجى الانتظار...');

      const blob = previewPdfBlob ?? await requestPdfBlob();
      if (!previewPdfBlob) setPreviewPdfBlob(blob);
      downloadPdfBlob(blob, reportData);

      toast.success('تم تصدير التقرير بنجاح!');
    } catch (err: unknown) {
      console.error('Error exporting PDF:', err);
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء التصدير';
      toast.error(`خطأ: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-indigo-900 dark:text-indigo-400 mb-2 font-serif" dir="rtl">تحليل الاستبيانات الأكاديمي</h1>
        <p className="text-gray-600 dark:text-gray-400 font-medium" dir="rtl">نظام متقدم لتحليل البيانات وإنشاء التقارير الأكاديمية</p>
      </div>

      <div className="print:hidden">
        <AnalysisForm onGenerate={handleGenerate} isLoading={isGenerating} />
      </div>

      {reportData && (
        <div className="mt-12 border-t pt-8">
          <div className="flex flex-wrap gap-4 justify-center mb-8 print:hidden" dir="rtl">
             <button onClick={handleOpenPreview} className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md transition-transform hover:-translate-y-1">
                <Printer className="w-5 h-5" /> معاينة PDF الفعلية
             </button>
             <button onClick={() => exportAnalysisWorkbook(reportData)} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md transition-transform hover:-translate-y-1">
                <FileSpreadsheet className="w-5 h-5" /> تصدير Excel
             </button>
             <button onClick={() => exportAnalysisSettings(reportData)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition-transform hover:-translate-y-1">
                <Braces className="w-5 h-5" /> حفظ الإعدادات JSON
             </button>
          </div>

          <div className="print:hidden">
            <AnalysisReport data={reportData} />
          </div>
          


          {/* Preview Modal */}
          {isPreviewOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden">
               <div className="bg-gray-200 rounded-xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
                  <div className="bg-white px-4 py-3 border-b flex flex-wrap gap-3 justify-between items-center" dir="rtl">
                     <h3 className="font-bold text-lg text-gray-800">معاينة التقرير</h3>
                     <div className="flex flex-wrap items-center gap-2">
                        {previewPdfUrl && (
                          <>
                            <button
                              onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                              disabled={previewPage <= 1}
                              className="p-2 bg-gray-100 rounded disabled:opacity-40"
                              aria-label="الصفحة السابقة"
                            ><ChevronRight className="w-4 h-4" /></button>
                            <span className="text-sm font-bold min-w-24 text-center">
                              صفحة {previewPage} من {previewPageCount}
                            </span>
                            <button
                              onClick={() => setPreviewPage((page) => Math.min(previewPageCount, page + 1))}
                              disabled={previewPage >= previewPageCount}
                              className="p-2 bg-gray-100 rounded disabled:opacity-40"
                              aria-label="الصفحة التالية"
                            ><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={() => setPreviewZoom((zoom) => Math.max(50, zoom - 10))} className="p-2 bg-gray-100 rounded" aria-label="تصغير">
                              <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className="text-sm min-w-12 text-center">{previewZoom}%</span>
                            <button onClick={() => setPreviewZoom((zoom) => Math.min(200, zoom + 10))} className="p-2 bg-gray-100 rounded" aria-label="تكبير">
                              <ZoomIn className="w-4 h-4" />
                            </button>
                            <button onClick={() => previewFrameRef.current?.contentWindow?.print()} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm">
                              <Printer className="w-4 h-4" /> طباعة مباشرة
                            </button>
                          </>
                        )}
                        <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm text-sm disabled:opacity-50">
                           {isExporting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Download className="w-4 h-4" />}
                           {isExporting ? 'جاري التصدير...' : 'حفظ كـ PDF'}
                        </button>
                        <button onClick={() => setIsPreviewOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-sm">
                           إغلاق
                        </button>
                     </div>
                  </div>
                  <div className="flex-1 min-h-0 bg-gray-300 p-3">
                     {isExporting && !previewPdfUrl && (
                       <div className="h-full flex items-center justify-center font-bold text-gray-700">جاري إنشاء صفحات PDF الفعلية…</div>
                     )}
                     {previewError && !previewPdfUrl && (
                       <div className="h-full flex items-center justify-center text-red-700 font-bold">{previewError}</div>
                     )}
                     {previewPdfUrl && (
                       <iframe
                         ref={previewFrameRef}
                         title="معاينة تقرير PDF"
                         src={`${previewPdfUrl}#page=${previewPage}&zoom=${previewZoom}`}
                         className="w-full h-full rounded bg-white border-0"
                       />
                     )}
                  </div>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
