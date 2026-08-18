import type { DistributionSlice } from '@/lib/analysis/statistics';
import type { CommentGroup } from '@/lib/analysis/comments';

export interface Axis {
  name: string;
  start: number;
  end: number;
  /** أرقام الأسئلة الفعلية التابعة للمحور؛ أدق من نطاق قد يحتوي أسئلة تصنيفية */
  questionNumbers?: number[];
  average?: number;
  count?: number;
  rank?: number;
  /** معامل الثبات للمحور، إذا أمكن حسابه من سؤالين واستجابتين مكتملتين على الأقل */
  cronbachAlpha?: number;
  reliabilityRespondents?: number;
}

export interface QuestionResult {
  question: string;
  questionNumber: number;
  /** عدد الاستجابات الصالحة (الفارغة مستبعدة) */
  count: number;
  mean: number;
  relativeWeight: number;
  rank?: number;

  /** الانحراف المعياري للعينة */
  stdDev: number;
  median: number;
  mode: number;

  /** استجابات فارغة أو غير رقمية لهذا السؤال */
  missing: number;
  /** نسبة من أجاب على هذا السؤال من إجمالي المشاركين */
  responseRate: number;

  /** السُّلَّم المستخدم في حساب هذا السؤال */
  scaleMax: number;
  distribution: DistributionSlice[];

  /** سؤال نعم/لا — يُعرض منفصلاً ولا يدخل المتوسط العام */
  isBinary?: boolean;
  /** سؤال عكسي أُعيد ترميزه قبل الحساب */
  isReversed?: boolean;
}

/** صف واحد في جدول المقارنة بين الفئات */
export interface CategoryComparisonRow {
  /** قيمة الفئة، مثل «ذكر» أو «المستوى الرابع» */
  category: string;
  /** عدد المشاركين داخل هذه الفئة */
  respondents: number;
  overallAverage: number;
  /** متوسط كل محور داخل هذه الفئة، بترتيب `axes` */
  axisAverages: number[];
}

export interface CategoryComparison {
  /** العمود الذي جرت المقارنة على أساسه */
  column: string;
  axisNames: string[];
  rows: CategoryComparisonRow[];
}

export interface AnalysisOptionsSnapshot {
  reversedQuestions: string[];
  comparisonColumn?: string;
  scaleMaxOverride?: number;
}

export interface ReportData {
  title: string;
  surveyDate: string;
  reportDate: string;
  results: QuestionResult[];
  resultsForAnalysis: QuestionResult[];
  overallAverage: number;
  axes: Axis[];
  autoComment: string;
  manualComment: string;
  logos: {
    quality: string;
    university: string;
    college: string;
  };
  signatures: {name: string, url: string}[];

  /** تعليقات المشاركين بعد التنظيف والتجميع */
  comments?: CommentGroup[];
  filters?: {column: string, values: string[]}[];

  /** أسئلة نعم/لا — خارج المتوسط العام */
  binaryResults?: QuestionResult[];
  /** إجمالي المشاركين قبل استبعاد الفارغ لكل سؤال */
  totalRespondents?: number;
  /** السُّلَّم الفعلي المستخدم — تعرضه صفحة المنهجية */
  scaleMax?: number;
  /** معامل الثبات لجميع الأسئلة الكمية غير الثنائية */
  overallCronbachAlpha?: number;
  cronbachRespondents?: number;
  comparison?: CategoryComparison;
  /** الخيارات اللازمة لإعادة إنتاج التقرير عند حفظ إعداداته */
  analysisOptions?: AnalysisOptionsSnapshot;
}
