/**
 * أنواع مشتركة بين الخادم والعميل لتصدير نتائج الاستبيانات إلى Excel.
 */

export interface ExportSheetData {
  formId: string;
  title: string;
  /** رؤوس الأعمدة: ["#", "التاريخ", ...نصوص الأسئلة] */
  headers: string[];
  /** الصفوف — العمود رقم 1 يحتوي التاريخ بصيغة ISO ليُحوَّل لتاريخ حقيقي في المتصفح */
  rows: (string | number | null)[][];
  responsesCount: number;
  questionsCount: number;
}

export interface ExportFormResult {
  success: boolean;
  error?: string;
  sheet: ExportSheetData | null;
}
