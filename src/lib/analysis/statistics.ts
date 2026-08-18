/**
 * الدوال الإحصائية الخام لتحليل الاستبيان.
 *
 * مفصولة عن `analysis-utils.ts` عمداً: هذا الملف رياضيات بحتة بلا معرفة بشكل
 * التقرير أو بصياغة النصوص، فيسهل التحقق منه ومراجعته.
 */

import { ANALYSIS_SCALE } from './scale';

/**
 * السلالم الشائعة التي نقرّب إليها عند اكتشاف السُّلَّم تلقائياً.
 *
 * تبدأ من السُّلَّم الافتراضي ولا تنزل تحته: عدم اختيار أحد لأعلى تقدير ليس
 * دليلاً على أن السُّلَّم أقصر، والنزول يضخّم الوزن النسبي بصمت.
 */
const STANDARD_SCALES = [5, 7, 10] as const;

export interface DistributionSlice {
  /** قيمة الاستجابة (1، 2، 3 …) */
  value: number;
  count: number;
  /** نسبة من الاستجابات الصالحة لهذا السؤال */
  percentage: number;
}

export interface DescriptiveStats {
  /** عدد الاستجابات الصالحة */
  count: number;
  sum: number;
  mean: number;
  /** الانحراف المعياري للعينة (قسمة على n−1) */
  stdDev: number;
  median: number;
  /** المنوال — أصغر القيم تكراراً الأعلى عند التساوي */
  mode: number;
}

export interface CronbachAlphaResult {
  alpha: number;
  /** عدد الاستجابات المكتملة التي دخلت الحساب */
  respondents: number;
  items: number;
}

/**
 * يكتشف أقصى قيمة في سُلَّم القياس.
 *
 * محافظ عن قصد: ما دامت أعلى قيمة مرصودة ضمن السُّلَّم الافتراضي نُبقيه، ولا
 * نستنتج سُلَّماً أقصر أبداً. الاستنتاج لأسفل كان ينتج أرقاماً خاطئة صامتة —
 * سؤال أجاب عنه الجميع بـ«محايد» (3 من 5) كان يُحسب على سُلَّم من 3 فيظهر
 * بوزن نسبي 100%. نرفع السُّلَّم فقط حين تتجاوزه البيانات فعلاً.
 *
 * السُّلَّم الأقصر (رباعي أو ثلاثي) يُضبط يدوياً من واجهة التحليل، ويُعلَن في
 * صفحة منهجية التقرير.
 */
export function detectScaleMax(values: number[], override?: number): number {
  if (override && override > 1) return override;
  if (values.length === 0) return ANALYSIS_SCALE.max;

  // reduce بدل Math.max(...values) لأن النشر على آلاف القيم يخاطر بتجاوز المكدس
  const observedMax = values.reduce((max, value) => (value > max ? value : max), -Infinity);
  if (!Number.isFinite(observedMax) || observedMax <= ANALYSIS_SCALE.max) {
    return ANALYSIS_SCALE.max;
  }

  return STANDARD_SCALES.find((scale) => observedMax <= scale) ?? Math.ceil(observedMax);
}

/** يعكس ترميز سؤال عكسي: أفضل إجابة تصبح أعلى قيمة */
export function reverseCode(value: number, scaleMax: number): number {
  return ANALYSIS_SCALE.min + scaleMax - value;
}

export function computeDescriptiveStats(values: number[]): DescriptiveStats {
  const count = values.length;
  if (count === 0) {
    return { count: 0, sum: 0, mean: 0, stdDev: 0, median: 0, mode: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;

  // انحراف العينة — المتعارف عليه في تقارير الاستبيانات. عند استجابة واحدة
  // لا معنى للتشتت فنُعيد صفراً بدل القسمة على صفر.
  const variance =
    count > 1 ? values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (count - 1) : 0;
  const stdDev = Math.sqrt(variance);

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const frequency = new Map<number, number>();
  sorted.forEach((v) => frequency.set(v, (frequency.get(v) ?? 0) + 1));
  let mode = sorted[0];
  let highestFrequency = 0;
  frequency.forEach((freq, value) => {
    if (freq > highestFrequency) {
      highestFrequency = freq;
      mode = value;
    }
  });

  return {
    count,
    sum,
    mean: round2(mean),
    stdDev: round2(stdDev),
    median: round2(median),
    mode,
  };
}

/** تباين العينة؛ صفر عند عدم كفاية القيم */
function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}

/**
 * يحسب ألفا كرونباخ من مصفوفة «مشارك × سؤال».
 *
 * نستخدم الحذف القائمي: لا تدخل إلا الصفوف المكتملة على جميع بنود المجموعة،
 * لأن مزج أحجام عينات مختلفة بين تباينات البنود وتباين المجموع ينتج معاملاً
 * غير متسق. لا نعيد قيمة إذا تعذر الحساب رياضياً.
 */
export function computeCronbachAlpha(
  rows: Array<Array<number | null>>
): CronbachAlphaResult | undefined {
  const items = rows[0]?.length ?? 0;
  if (items < 2) return undefined;

  const complete = rows.filter(
    (row): row is number[] =>
      row.length === items && row.every((value) => typeof value === 'number' && Number.isFinite(value))
  );
  if (complete.length < 2) return undefined;

  const itemVariances = Array.from({ length: items }, (_, itemIndex) =>
    sampleVariance(complete.map((row) => row[itemIndex]))
  );
  const totals = complete.map((row) => row.reduce((sum, value) => sum + value, 0));
  const totalVariance = sampleVariance(totals);
  if (totalVariance <= 0) return undefined;

  const alpha =
    (items / (items - 1)) *
    (1 - itemVariances.reduce((sum, variance) => sum + variance, 0) / totalVariance);

  if (!Number.isFinite(alpha)) return undefined;
  return { alpha: round2(alpha), respondents: complete.length, items };
}

/**
 * التوزيع التكراري على مستويات السُّلَّم.
 * القيم غير الصحيحة (متوسطات مستوردة مثلاً) تُقرَّب لأقرب مستوى حتى لا تختفي.
 */
export function computeDistribution(values: number[], scaleMax: number): DistributionSlice[] {
  const total = values.length;
  const counts = new Map<number, number>();

  for (let level = ANALYSIS_SCALE.min; level <= scaleMax; level += 1) {
    counts.set(level, 0);
  }

  values.forEach((value) => {
    const level = Math.min(scaleMax, Math.max(ANALYSIS_SCALE.min, Math.round(value)));
    counts.set(level, (counts.get(level) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[0] - a[0]) // من الأعلى للأدنى — ترتيب العرض المعتاد
    .map(([value, count]) => ({
      value,
      count,
      percentage: total > 0 ? round2((count / total) * 100) : 0,
    }));
}

/** الوزن النسبي بالصيغة الأكاديمية المتعارف عليها */
export function computeRelativeWeight(sum: number, count: number, scaleMax: number): number {
  if (count === 0 || scaleMax === 0) return 0;
  return round2((sum / (count * scaleMax)) * 100);
}

/** ترتيب تنافسي: المتساوون يأخذون نفس الرتبة ثم يقفز الترتيب */
export function assignCompetitionRanks<T>(
  items: T[],
  getValue: (item: T) => number
): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => getValue(b) - getValue(a));
  let currentRank = 1;

  return sorted.map((item, index) => {
    if (index > 0 && getValue(item) < getValue(sorted[index - 1])) {
      currentRank = index + 1;
    }
    return { ...item, rank: currentRank };
  });
}

function round2(value: number): number {
  return parseFloat(value.toFixed(2));
}
