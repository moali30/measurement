'use client';

import React, { useState, useRef } from 'react';
import AnalysisForm from '@/components/analysis/AnalysisForm';
import AnalysisReport from '@/components/analysis/AnalysisReport';
import ReportPrintableView from '@/components/analysis/ReportPrintableView';
import { processData } from '@/lib/analysis-utils';
import { ReportData } from '@/types/analysis';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function AnalysisPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = (formData: Partial<ReportData>, rawData: Record<string, unknown>[], questionTypes?: Record<string, string>, commentQuestions?: string[]) => {
    setIsGenerating(true);
    // Simulate slight delay for UX
    setTimeout(() => {
      const processed = processData(rawData, formData.axes || [], questionTypes, commentQuestions);
      setReportData({
        ...formData,
        ...processed
      } as ReportData);
      setIsGenerating(false);
    }, 500);
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    
    try {
      toast.info('جاري تجهيز التقرير، يرجى الانتظار...');
      
      const pages = printRef.current.querySelectorAll('.report-page');
      if (pages.length === 0) {
        setIsExporting(false);
        return;
      }
      
      // Create A4 PDF (210mm x 297mm)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i] as HTMLElement;
        
        // Render canvas with scale 2 for high quality
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        if (i > 0) {
          pdf.addPage();
        }
        
        // The element is styled to be A4 proportions, but we ensure it fits perfectly
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save(`تقرير_${reportData?.title || 'تحليل_الاستبيان'}.pdf`);
      toast.success('تم تصدير التقرير بنجاح!');
    } catch (err: any) {
      console.error('Error exporting PDF:', err);
      toast.error(`خطأ: ${err.message || 'حدث خطأ أثناء التصدير'}`);
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
             <button onClick={() => setIsPreviewOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md transition-transform hover:-translate-y-1">
                <Printer className="w-5 h-5" /> معاينة وتصدير PDF
             </button>
          </div>

          <div className="print:hidden">
            <AnalysisReport data={reportData} />
          </div>
          


          {/* Preview Modal */}
          {isPreviewOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden">
               <div className="bg-gray-200 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="bg-white px-6 py-4 border-b flex justify-between items-center">
                     <h3 className="font-bold text-lg text-gray-800">معاينة التقرير</h3>
                     <div className="flex gap-3">
                        <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm text-sm disabled:opacity-50">
                           {isExporting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Download className="w-4 h-4" />}
                           {isExporting ? 'جاري التصدير...' : 'حفظ كـ PDF'}
                        </button>
                        <button onClick={() => setIsPreviewOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-sm">
                           إغلاق
                        </button>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 flex justify-center custom-scrollbar">
                     <div className="transform scale-75 md:scale-90 origin-top">
                        <div ref={printRef}>
                          <ReportPrintableView data={reportData} />
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
