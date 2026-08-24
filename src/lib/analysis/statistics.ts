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
export function reverseCode(
  value: number,
  scaleMax: number,
  scaleMin: number = ANALYSIS_SCALE.min
): number {
  return scaleMin + scaleMax - value;
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

/** انحراف العينة؛ صفر عند عدم كفاية القيم أو انعدام التباين */
function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function pearsonCorrelation(a: number[], b: number[]): number | undefined {
  if (a.length !== b.length || a.length < 2) return undefined;
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  const sdA = sampleStdDev(a);
  const sdB = sampleStdDev(b);
  if (sdA === 0 || sdB === 0) return undefined;

  const covariance = a.reduce(
    (sum, value, index) => sum + (value - meanA) * (b[index] - meanB),
    0
  ) / (a.length - 1);
  return covariance / (sdA * sdB);
}

/**
 * يحسب ألفا كرونباخ المعياري من مصفوفة «مشارك × سؤال».
 *
 * نستخدم الحذف القائمي: لا تدخل إلا الصفوف المكتملة على جميع بنود المجموعة،
 * ثم نحسب متوسط الارتباطات البينية وصيغة ألفا المعيارية. هذه الصيغة لا تجعل
 * البند الخماسي أثقل من البند الثلاثي لمجرد اتساع مداه. لا نعيد قيمة إذا انعدم
 * تباين أي بند أو تعذر الحساب رياضياً.
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

  const columns = Array.from({ length: items }, (_, itemIndex) =>
    complete.map((row) => row[itemIndex])
  );
  const correlations: number[] = [];
  for (let left = 0; left < items; left += 1) {
    for (let right = left + 1; right < items; right += 1) {
      const correlation = pearsonCorrelation(columns[left], columns[right]);
      if (correlation === undefined) return undefined;
      correlations.push(correlation);
    }
  }

  if (correlations.length === 0) return undefined;
  const averageCorrelation = correlations.reduce((sum, value) => sum + value, 0) / correlations.length;
  const denominator = 1 + (items - 1) * averageCorrelation;
  if (denominator === 0) return undefined;
  const alpha = (items * averageCorrelation) / denominator;

  if (!Number.isFinite(alpha)) return undefined;
  return { alpha: round2(alpha), respondents: complete.length, items };
}

/**
 * التوزيع التكراري على مستويات السُّلَّم.
 * القيم غير الصحيحة (متوسطات مستوردة مثلاً) تُقرَّب لأقرب مستوى حتى لا تختفي.
 */
export function computeDistribution(
  values: number[],
  scaleMax: number,
  scaleMin: number = ANALYSIS_SCALE.min
): DistributionSlice[] {
  const total = values.length;
  const counts = new Map<number, number>();

  for (let level = scaleMin; level <= scaleMax; level += 1) {
    counts.set(level, 0);
  }

  values.forEach((value) => {
    const level = Math.min(scaleMax, Math.max(scaleMin, Math.round(value)));
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
