import { Axis, QuestionResult, ReportData } from '@/types/analysis';
import { DISTRIBUTION_BANDS } from '@/lib/analysis/scale';

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

export function getTop10ChartData(resultsForAnalysis: QuestionResult[]) {
  return resultsForAnalysis.slice(0, 10).map((item) => ({
    name: `س ${item.questionNumber}`,
    weight: item.relativeWeight,
  }));
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
 * المدرج التكراري العام: كم استجابة وقعت على كل مستوى من السُّلَّم عبر كل
 * الأسئلة مجتمعة. يوضح ميل العينة ككل (متفائلة / محايدة / ناقدة) وهو ما لا
 * يظهره متوسط كل سؤال على حدة.
 */
export function getResponseHistogramData(results: QuestionResult[], scaleMax: number) {
  const totals = new Map<number, number>();
  for (let level = 1; level <= scaleMax; level += 1) totals.set(level, 0);

  results.forEach((item) => {
    item.distribution.forEach((slice) => {
      if (totals.has(slice.value)) {
        totals.set(slice.value, (totals.get(slice.value) ?? 0) + slice.count);
      }
    });
  });

  const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);

  return Array.from(totals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => ({
      name: String(level),
      count,
      percentage: grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0,
    }));
}

/** أدنى الأسئلة تقييماً — تصاعدياً حتى يقرأ الرسم من الأسوأ */
export function getBottom5ChartData(resultsForAnalysis: QuestionResult[]) {
  return resultsForAnalysis
    .slice(-5)
    .reverse()
    .map((item) => ({
      name: `س ${item.questionNumber}`,
      weight: item.relativeWeight,
    }));
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

export function validateReportData(data: unknown): data is ReportData {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as ReportData;
  return (
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.results) &&
    candidate.results.length > 0
  );
}
