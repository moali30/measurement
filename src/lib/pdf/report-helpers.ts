import { Axis, QuestionResult, ReportData } from '@/types/analysis';
import { auditReport, formatAuditIssue } from '@/lib/analysis/audit';
import { DISTRIBUTION_BANDS, POLARIZATION } from '@/lib/analysis/scale';

export function cleanAutoCommentHtml(html: string): string {
  return html
    .replace(/bg-[a-z0-9-\/]+/g, '')
    .replace(/text-[a-z0-9-\/]+/g, '')
    .replace(/border-[a-z0-9-\/]+/g, '')
    .replace(/dark:[a-z0-9-\/]+/g, '')
    .replace(/shadow-[a-z0-9-\/]+/g, '')
    .replace(/rounded-[a-z0-9-\/]+/g, '');
}

export function getRespondentCount(results: QuestionResult[]): number {
  if (!results.length) return 0;
  return Math.max(...results.map((item) => item.count));
}

/**
 * الأسئلة التي انقسم الرأي حولها: طرفا التوزيع معاً فوق العتبة.
 * منسوخة عن محرك التحليل حتى تعمل صفحة الطباعة على تقرير محفوظ بلا إعادة حساب.
 */
export function getPolarizedResults(results: QuestionResult[]): QuestionResult[] {
  return results
    .filter(
      (item) =>
        item.count > 0 &&
        (item.negativeShare ?? 0) >= POLARIZATION.endShare &&
        (item.positiveShare ?? 0) >= POLARIZATION.endShare
    )
    .sort(
      (a, b) =>
        Math.min(b.negativeShare, b.positiveShare) - Math.min(a.negativeShare, a.positiveShare)
    );
}

export interface DistributionBucket {
  name: string;
  value: number;
  fill: string;
  /** نسبة الأسئلة داخل هذه الفئة من إجمالي الأسئلة */
  percentage: number;
}

/**
 * توزيع الأسئلة على فئات الأداء، بالعدد والنسبة معاً.
 *
 * وسيلة الإيضاح في التقرير تُبنى من هنا بدل `<Legend/>` الافتراضي، لأن الأخير
 * يعرض الاسم فقط ويرسم عناصر مطلقة الموضع تُقصّ عند حد الصفحة في الطباعة.
 */
export function getWeightDistribution(results: QuestionResult[]): DistributionBucket[] {
  const total = results.length;
  const counts = {
    high: results.filter((item) => item.relativeWeight >= DISTRIBUTION_BANDS.high).length,
    medium: results.filter(
      (item) =>
        item.relativeWeight >= DISTRIBUTION_BANDS.medium &&
        item.relativeWeight < DISTRIBUTION_BANDS.high
    ).length,
    low: results.filter((item) => item.relativeWeight < DISTRIBUTION_BANDS.medium).length,
  };

  return [
    { name: `مرتفع (≥ ${DISTRIBUTION_BANDS.high}%)`, value: counts.high, fill: '#4caf50' },
    {
      name: `متوسط (${DISTRIBUTION_BANDS.medium}-${DISTRIBUTION_BANDS.high}%)`,
      value: counts.medium,
      fill: '#ffc107',
    },
    { name: `منخفض (< ${DISTRIBUTION_BANDS.medium}%)`, value: counts.low, fill: '#f44336' },
  ].map((bucket) => ({
    ...bucket,
    percentage: total > 0 ? Math.round((bucket.value / total) * 100) : 0,
  }));
}

/** الشرائح غير الصفرية فقط — الرسم الدائري لا يجب أن يحتوي قطاعات بلا مساحة */
export function getWeightDistributionPieData(results: QuestionResult[]): DistributionBucket[] {
  return getWeightDistribution(results).filter((item) => item.value > 0);
}

/**
 * يحوّل تاريخ ISO إلى صيغة عربية مقروءة بأرقام لاتينية.
 * يُعيد النص كما هو إذا تعذّر التحويل، فالغلاف لا يجب أن يعرض "Invalid Date".
 */
export function formatReportDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getAxisExtremes(axes: Axis[]): { best: Axis | null; worst: Axis | null } {
  if (!axes.length) return { best: null, worst: null };
  return {
    best: axes.reduce((a, b) => ((a.average || 0) > (b.average || 0) ? a : b)),
    worst: axes.reduce((a, b) => ((a.average || 0) < (b.average || 0) ? a : b)),
  };
}

export function getAxesChartData(axes: Axis[]) {
  return axes.map((axis) => ({
    name: axis.name,
    average: axis.average || 0,
  }));
}

/**
 * التحقق قبل الطباعة واجهة رفيعة فوق المدقق.
 *
 * كانت هنا نسخة ثانية من قواعد السلامة، فأي قاعدة تُضاف في مكان تغيب عن الآخر
 * ويصبح «سليم» في الواجهة غير «سليم» على الخادم. المصدر الوحيد الآن `audit.ts`.
 */
export function getReportValidationErrors(data: unknown): string[] {
  if (!data || typeof data !== 'object') return ['جسم التقرير غير صالح.'];
  return auditReport(data as ReportData).errors.map(formatAuditIssue);
}

export function validateReportData(data: unknown): data is ReportData {
  return getReportValidationErrors(data).length === 0;
}
