import type { DistributionSlice } from '@/lib/analysis/statistics';
import type { CommentGroup } from '@/lib/analysis/comments';
import type { Recommendation } from '@/lib/analysis/recommendations';

export interface Axis {
  name: string;
  start: number;
  end: number;
  /** أرقام الأسئلة الفعلية التابعة للمحور؛ أدق من نطاق قد يحتوي أسئلة تصنيفية */
  questionNumbers?: number[];
  /** متوسط الوزن النسبي لأسئلة المحور */
  average?: number;
  /** متوسط المؤشر المعياري لأسئلة المحور */
  normalizedAverage?: number;
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
  /** موضع المتوسط بين طرفي السُّلَّم من 100 — أرضيته صفر حقيقي */
  normalizedScore: number;
  rank?: number;

  /** الانحراف المعياري للعينة — يُحسب ويُصدَّر ولا يُعرض في جدول التقرير */
  stdDev: number;
  median: number;
  mode: number;

  /** استجابات فارغة أو غير رقمية لهذا السؤال */
  missing: number;
  /** نسبة من أجاب على هذا السؤال من إجمالي المشاركين */
  responseRate: number;

  /** السُّلَّم المستخدم في حساب هذا السؤال — ثابت 1-5 */
  scaleMax: number;
  scaleMin: number;
  distribution: DistributionSlice[];

  /** نسبة الرافضين (أدنى درجتين) من الاستجابات الصالحة */
  negativeShare: number;
  /** نسبة المحايدين (منتصف السُّلَّم) */
  neutralShare: number;
  /** نسبة الموافقين (أعلى درجتين) */
  positiveShare: number;

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

/** فئة واحدة داخل متغير ديموغرافي */
export interface SampleProfileValue {
  label: string;
  count: number;
  percentage: number;
}

/**
 * متغير ديموغرافي واحد وتوزيع المشاركين عليه.
 * أسئلة نعم/لا والاختيار من متعدد ليست بنوداً تُقيَّم، بل توصيف للعيّنة.
 */
export interface SampleProfileGroup {
  column: string;
  /** عدد من أجاب على هذا المتغير */
  answered: number;
  values: SampleProfileValue[];
}

export interface AnalysisOptionsSnapshot {
  reversedQuestions: string[];
  comparisonColumn?: string;
}

export interface AnalysisWarning {
  /** مفتاح ثابت يسمح للواجهة بتجميع التحذيرات أو ترجمتها لاحقاً */
  code: 'invalid-values-excluded' | 'empty-axis' | 'question-excluded';
  message: string;
  question?: string;
  questionNumber?: number;
}

/**
 * خلل يمنع إنتاج التقرير أصلاً.
 *
 * التحذير يوثَّق داخل التقرير ويكمل التحليل؛ الخطأ يوقفه. سؤال ليكرت ببدائل
 * غير خمس لا يمكن حسابه على السُّلَّم الخماسي، وحسابه بصمت ينتج نسبة خاطئة
 * لا ينقذها أي تحذير.
 */
export interface AnalysisError {
  code: 'non-standard-likert' | 'values-out-of-scale' | 'no-likert-questions';
  message: string;
  question?: string;
  questionNumber?: number;
}

export interface ReportData {
  title: string;
  surveyDate: string;
  reportDate: string;
  results: QuestionResult[];
  resultsForAnalysis: QuestionResult[];
  overallAverage: number;
  /** المتوسط العام معبَّراً عنه بالمؤشر المعياري */
  overallNormalized: number;
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

  /** توصيف العيّنة من المتغيرات الديموغرافية */
  sampleProfile?: SampleProfileGroup[];
  /** إجمالي المشاركين قبل استبعاد الفارغ لكل سؤال */
  totalRespondents?: number;
  /** معامل الثبات لجميع الأسئلة الكمية */
  overallCronbachAlpha?: number;
  cronbachRespondents?: number;
  comparison?: CategoryComparison;
  /** استبعادات أجراها المحرك لحماية سلامة النتائج */
  analysisWarnings?: AnalysisWarning[];
  /** الخيارات اللازمة لإعادة إنتاج التقرير عند حفظ إعداداته */
  /** توصيات مشتقة من الأرقام، مرتبة بالأولوية */
  recommendations?: Recommendation[];
  analysisOptions?: AnalysisOptionsSnapshot;
}
