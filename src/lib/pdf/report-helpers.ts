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
export function getResponseHistogramData(results: QuestionResult[]) {
  const levels = ['أدنى', 'منخفض', 'متوسط', 'مرتفع', 'أعلى'] as const;
  const totals = new Map<number, number>(levels.map((_, index) => [index, 0]));

  results.forEach((item) => {
    item.distribution.forEach((slice) => {
      // توحيد موضع الاستجابة داخل سُلَّمها يسمح بدمج السلالم الثلاثية
      // والخماسية من دون أن تعني القيمة 3 «الحد الأعلى» و«الحياد» معاً.
      const scaleMin = item.scaleMin ?? 1;
      const normalizedPosition =
        item.scaleMax > scaleMin
          ? (slice.value - scaleMin) / (item.scaleMax - scaleMin)
          : 0;
      const bucket = Math.min(4, Math.max(0, Math.round(normalizedPosition * 4)));
      totals.set(bucket, (totals.get(bucket) ?? 0) + slice.count);
    });
  });

  const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);

  return Array.from(totals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => ({
      name: levels[level],
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

export function getReportValidationErrors(data: unknown): string[] {
  if (!data || typeof data !== 'object') return ['جسم التقرير غير صالح.'];
  const candidate = data as ReportData;
  const errors: string[] = [];

  if (typeof candidate.title !== 'string' || !candidate.title.trim()) {
    errors.push('عنوان التقرير مفقود.');
  }
  if (!Array.isArray(candidate.results) || candidate.results.length === 0) {
    errors.push('لا توجد نتائج أسئلة قابلة للطباعة.');
    return errors;
  }

  candidate.results.forEach((item, index) => {
    const label = `السؤال ${item.questionNumber ?? index + 1}`;
    const scaleMin = item.scaleMin ?? 1;
    if (!Number.isFinite(item.scaleMax) || !Number.isFinite(scaleMin) || scaleMin >= item.scaleMax) {
      errors.push(`${label}: حدود السُلَّم غير صالحة.`);
      return;
    }
    if (!Number.isFinite(item.mean) || item.mean < scaleMin || item.mean > item.scaleMax) {
      errors.push(`${label}: المتوسط ${item.mean} خارج السُلَّم ${scaleMin}-${item.scaleMax}.`);
    }
    if (!Number.isFinite(item.relativeWeight) || item.relativeWeight < 0 || item.relativeWeight > 100) {
      errors.push(`${label}: الوزن النسبي ${item.relativeWeight}% خارج النطاق 0-100%.`);
    }
    if (!Number.isFinite(item.count) || item.count < 0) {
      errors.push(`${label}: عدد الاستجابات الصالحة غير صحيح.`);
    }
  });

  if (
    !Number.isFinite(candidate.overallAverage) ||
    candidate.overallAverage < 0 ||
    candidate.overallAverage > 100
  ) {
    errors.push(`المتوسط العام ${candidate.overallAverage}% خارج النطاق 0-100%.`);
  }

  return errors;
}

export function validateReportData(data: unknown): data is ReportData {
  return getReportValidationErrors(data).length === 0;
}
