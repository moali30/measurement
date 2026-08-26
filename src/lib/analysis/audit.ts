/**
 * تدقيق آلي على سلامة أرقام التقرير.
 *
 * الفلسفة: لا نتحقق من عيّنة اختبار بعينها، بل من **ثوابت** يجب أن تصح على أي
 * بيانات مهما كانت. الثابت الذي ينكسر يعني خطأ في الحساب أو في نقل الأرقام،
 * لا نتيجة غير متوقعة. مثال: مجموع نسب التوزيع لا بد أن يساوي 100 مهما كانت
 * الإجابات؛ فلو خالف ذلك فالخلل في المحرك لا في الاستبيان.
 *
 * التمييز بين المستويين مقصود:
 * - `error`  رقم مغلوط أو متناقض — يمنع إنتاج التقرير.
 * - `warning` رقم صحيح لكنه ضعيف الدلالة — يُطبع كملاحظة ولا يمنع شيئاً.
 */

import type { Axis, QuestionResult, ReportData } from '@/types/analysis';
import {
  ANALYSIS_SCALE,
  DISTRIBUTION_BANDS,
  NARRATIVE_THRESHOLDS,
  POLARIZATION,
  QUALITY_THRESHOLDS,
  RELATIVE_WEIGHT_FLOOR,
} from './scale';
import { FINDING_THRESHOLDS, collectFindings } from './findings';
import { MAX_RECOMMENDATIONS } from './recommendations';

export { QUALITY_THRESHOLDS };

export type AuditSeverity = 'error' | 'warning';

export interface AuditIssue {
  severity: AuditSeverity;
  code: string;
  /** موضع الخلل: «السؤال 12» أو «المحور: الموارد» */
  scope?: string;
  message: string;
}

export interface AuditSummary {
  /** عدد الثوابت التي جرى فحصها فعلاً */
  checks: number;
  issues: AuditIssue[];
  errors: AuditIssue[];
  warnings: AuditIssue[];
}

/**
 * هوامش التقريب.
 *
 * كل رقم معروض مقرَّب إلى منزلتين، فمقارنة رقمين مشتقين من المصدر نفسه تحتمل
 * فارقاً مقداره تقريبَان. أما المتوسط فيدخل في المؤشر المعياري مضروباً في مدى
 * السُّلَّم، فيتضخم خطؤه خمسة وعشرين ضعفاً ويحتاج هامشاً أوسع.
 */
const TOLERANCE = {
  /** رقمان مشتقان مباشرة من المجموع نفسه */
  derived: 0.05,
  /** مشتق من المتوسط المقرَّب */
  fromMean: 0.2,
  /** مجموع نسب مقرَّبة كلٌّ على حدة */
  percentageSum: 0.06,
  /** متوسط متوسطات */
  aggregate: 0.02,
} as const;

class Auditor {
  checks = 0;
  issues: AuditIssue[] = [];

  expect(
    condition: boolean,
    severity: AuditSeverity,
    code: string,
    message: string,
    scope?: string
  ): void {
    this.checks += 1;
    if (!condition) this.issues.push({ severity, code, message, scope });
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** المؤشر المعياري المقابل لوزن نسبي معلوم — التحويل خطي وقابل للعكس */
function normalizedFromWeight(weight: number): number {
  return ((weight - RELATIVE_WEIGHT_FLOOR) / (100 - RELATIVE_WEIGHT_FLOOR)) * 100;
}

function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function questionBelongsToAxis(item: QuestionResult, axis: Axis): boolean {
  if (axis.questionNumbers?.length) return axis.questionNumbers.includes(item.questionNumber);
  return item.questionNumber >= axis.start && item.questionNumber <= axis.end;
}

function auditQuestion(audit: Auditor, item: QuestionResult, totalRespondents: number): void {
  const scope = `السؤال ${item.questionNumber}`;

  audit.expect(
    item.scaleMin === ANALYSIS_SCALE.min && item.scaleMax === ANALYSIS_SCALE.max,
    'error',
    'scale-mismatch',
    `السُلَّم ${item.scaleMin}-${item.scaleMax} لا يطابق ${ANALYSIS_SCALE.label}.`,
    scope
  );

  audit.expect(
    isFiniteNumber(item.mean) && item.mean >= item.scaleMin && item.mean <= item.scaleMax,
    'error',
    'mean-out-of-scale',
    `المتوسط ${item.mean} خارج السُلَّم ${item.scaleMin}-${item.scaleMax}.`,
    scope
  );

  audit.expect(
    isFiniteNumber(item.relativeWeight) &&
      item.relativeWeight >= RELATIVE_WEIGHT_FLOOR - TOLERANCE.derived &&
      item.relativeWeight <= 100,
    'error',
    'weight-out-of-range',
    `الوزن النسبي ${item.relativeWeight}% خارج النطاق ${RELATIVE_WEIGHT_FLOOR}-100%.`,
    scope
  );

  audit.expect(
    isFiniteNumber(item.normalizedScore) &&
      item.normalizedScore >= 0 &&
      item.normalizedScore <= 100,
    'error',
    'normalized-out-of-range',
    `المؤشر المعياري ${item.normalizedScore} خارج النطاق 0-100.`,
    scope
  );

  // ثلاثة أرقام مشتقة من مجموع واحد؛ اتساقها الثلاثي يثبت أنها لم تُحسب من مصادر مختلفة
  if (isFiniteNumber(item.mean) && isFiniteNumber(item.relativeWeight)) {
    const expectedWeight = (item.mean / item.scaleMax) * 100;
    audit.expect(
      Math.abs(expectedWeight - item.relativeWeight) <= TOLERANCE.fromMean,
      'error',
      'weight-mean-mismatch',
      `الوزن النسبي ${item.relativeWeight}% لا يطابق المتوسط ${item.mean} ` +
        `(المتوقع ${round2(expectedWeight)}%).`,
      scope
    );
  }

  if (isFiniteNumber(item.mean) && isFiniteNumber(item.normalizedScore)) {
    const expected =
      ((item.mean - item.scaleMin) / (item.scaleMax - item.scaleMin)) * 100;
    audit.expect(
      Math.abs(expected - item.normalizedScore) <= TOLERANCE.fromMean,
      'error',
      'normalized-mean-mismatch',
      `المؤشر المعياري ${item.normalizedScore} لا يطابق المتوسط ${item.mean} ` +
        `(المتوقع ${round2(expected)}).`,
      scope
    );
  }

  if (isFiniteNumber(item.relativeWeight) && isFiniteNumber(item.normalizedScore)) {
    const expected = normalizedFromWeight(item.relativeWeight);
    audit.expect(
      Math.abs(expected - item.normalizedScore) <= TOLERANCE.derived,
      'error',
      'normalized-weight-mismatch',
      `المؤشر المعياري ${item.normalizedScore} لا يطابق الوزن النسبي ` +
        `${item.relativeWeight}% (المتوقع ${round2(expected)}).`,
      scope
    );
  }

  audit.expect(
    Number.isInteger(item.count) && item.count >= 0,
    'error',
    'invalid-count',
    `عدد الاستجابات الصالحة ${item.count} غير صحيح.`,
    scope
  );

  audit.expect(
    item.count + item.missing === totalRespondents,
    'error',
    'count-missing-mismatch',
    `الصالح ${item.count} + المفقود ${item.missing} لا يساوي عدد المشاركين ${totalRespondents}.`,
    scope
  );

  const distributionCount = item.distribution.reduce((sum, slice) => sum + slice.count, 0);
  audit.expect(
    distributionCount === item.count,
    'error',
    'distribution-count-mismatch',
    `مجموع أعداد التوزيع ${distributionCount} لا يساوي عدد الاستجابات الصالحة ${item.count}.`,
    scope
  );

  const levels = item.distribution.map((slice) => slice.value).sort((a, b) => a - b);
  const expectedLevels = Array.from(
    { length: item.scaleMax - item.scaleMin + 1 },
    (_, index) => item.scaleMin + index
  );
  audit.expect(
    levels.length === expectedLevels.length && levels.every((v, i) => v === expectedLevels[i]),
    'error',
    'distribution-levels-mismatch',
    `مستويات التوزيع [${levels.join(', ')}] لا تطابق السُلَّم.`,
    scope
  );

  const shares = [item.negativeShare, item.neutralShare, item.positiveShare];
  audit.expect(
    shares.every((share) => isFiniteNumber(share) && share >= 0 && share <= 100),
    'error',
    'shares-out-of-range',
    'نسب اتجاه الرأي خارج النطاق 0-100%.',
    scope
  );

  if (item.count > 0) {
    audit.expect(
      Math.abs(shares.reduce((a, b) => a + b, 0) - 100) <= TOLERANCE.percentageSum,
      'error',
      'shares-sum-mismatch',
      `مجموع نسب اتجاه الرأي ${round2(shares.reduce((a, b) => a + b, 0))}% لا يساوي 100%.`,
      scope
    );

    const percentageSum = item.distribution.reduce((sum, slice) => sum + slice.percentage, 0);
    audit.expect(
      Math.abs(percentageSum - 100) <= TOLERANCE.percentageSum,
      'error',
      'distribution-sum-mismatch',
      `مجموع نسب التوزيع ${round2(percentageSum)}% لا يساوي 100%.`,
      scope
    );

    // النسب الثلاث ليست حساباً مستقلاً بل تجميع للتوزيع نفسه
    const midpoint = (item.scaleMin + item.scaleMax) / 2;
    const fromDistribution = item.distribution.reduce(
      (totals, slice) => {
        if (slice.value < midpoint) totals.negative += slice.percentage;
        else if (slice.value > midpoint) totals.positive += slice.percentage;
        else totals.neutral += slice.percentage;
        return totals;
      },
      { negative: 0, neutral: 0, positive: 0 }
    );
    audit.expect(
      Math.abs(fromDistribution.negative - item.negativeShare) <= TOLERANCE.percentageSum &&
        Math.abs(fromDistribution.neutral - item.neutralShare) <= TOLERANCE.percentageSum &&
        Math.abs(fromDistribution.positive - item.positiveShare) <= TOLERANCE.percentageSum,
      'error',
      'shares-distribution-mismatch',
      `نسب اتجاه الرأي (${shares.map(round2).join('/')}) لا تطابق التوزيع التكراري ` +
        `(${[fromDistribution.negative, fromDistribution.neutral, fromDistribution.positive]
          .map(round2)
          .join('/')}).`,
      scope
    );
  }

  audit.expect(
    item.median >= item.scaleMin && item.median <= item.scaleMax,
    'error',
    'median-out-of-scale',
    `الوسيط ${item.median} خارج السُلَّم.`,
    scope
  );

  audit.expect(
    item.mode >= item.scaleMin && item.mode <= item.scaleMax,
    'error',
    'mode-out-of-scale',
    `المنوال ${item.mode} خارج السُلَّم.`,
    scope
  );

  // أقصى انحراف عينة ممكن على سُلَّم مداه ٤ هو ٢٫٨٣ (قيمتان متطرفتان فقط)
  audit.expect(
    isFiniteNumber(item.stdDev) && item.stdDev >= 0 && item.stdDev <= item.scaleMax - item.scaleMin,
    'error',
    'stddev-implausible',
    `الانحراف المعياري ${item.stdDev} مستحيل على هذا السُلَّم.`,
    scope
  );

  if (totalRespondents > 0) {
    const expectedRate = (item.count / totalRespondents) * 100;
    audit.expect(
      Math.abs(expectedRate - item.responseRate) <= TOLERANCE.derived,
      'error',
      'response-rate-mismatch',
      `معدل الاستجابة ${item.responseRate}% لا يطابق ${item.count}/${totalRespondents}.`,
      scope
    );
  }

  audit.expect(
    item.responseRate >= QUALITY_THRESHOLDS.minimumResponseRate,
    'warning',
    'low-response-rate',
    `أجاب عنه ${item.responseRate}% فقط من المشاركين — راجع وضوح صياغته أو حساسيته.`,
    scope
  );
}

function auditRanking(audit: Auditor, data: ReportData): void {
  const ranked = data.resultsForAnalysis;

  audit.expect(
    ranked.length === data.results.length,
    'error',
    'ranking-length-mismatch',
    `جدول الترتيب فيه ${ranked.length} بنداً وجدول النتائج فيه ${data.results.length}.`
  );

  const rankedKeys = new Set(ranked.map((item) => item.question));
  audit.expect(
    data.results.every((item) => rankedKeys.has(item.question)),
    'error',
    'ranking-membership-mismatch',
    'جدول الترتيب لا يحوي الأسئلة نفسها الواردة في جدول النتائج.'
  );

  audit.expect(
    ranked.every(
      (item, index) => index === 0 || ranked[index - 1].relativeWeight >= item.relativeWeight
    ),
    'error',
    'ranking-not-sorted',
    'جدول الترتيب غير مرتب تنازلياً حسب الوزن النسبي.'
  );

  // ترتيب تنافسي: التساوي في الوزن يوجب التساوي في الرتبة، والأعلى وزناً أصغر رتبةً
  const rankByQuestion = new Map(data.results.map((item) => [item.question, item.rank]));
  let rankingConsistent = true;
  for (let i = 0; i < ranked.length && rankingConsistent; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      const left = rankByQuestion.get(ranked[i].question);
      const right = rankByQuestion.get(ranked[j].question);
      if (left === undefined || right === undefined) continue;
      const sameWeight = ranked[i].relativeWeight === ranked[j].relativeWeight;
      if (sameWeight ? left !== right : left >= right) {
        rankingConsistent = false;
        break;
      }
    }
  }
  audit.expect(
    rankingConsistent,
    'error',
    'rank-inconsistent',
    'الرتب لا تتفق مع الأوزان النسبية: بندان متساويان برتبتين مختلفتين، أو أعلى وزناً برتبة أدنى.'
  );

  const numbers = data.results.map((item) => item.questionNumber);
  audit.expect(
    new Set(numbers).size === numbers.length,
    'error',
    'duplicate-question-numbers',
    'رقم سؤال مكرر — الرتب والمحاور تُبنى على الأرقام فتختلط النتائج.'
  );
}

function auditAggregates(audit: Auditor, data: ReportData): void {
  const expectedOverall = mean(data.results.map((item) => item.relativeWeight));
  audit.expect(
    Math.abs(expectedOverall - data.overallAverage) <= TOLERANCE.aggregate,
    'error',
    'overall-average-mismatch',
    `المتوسط العام ${data.overallAverage}% لا يساوي متوسط أوزان البنود ` +
      `(المتوقع ${round2(expectedOverall)}%).`
  );

  const expectedNormalized = mean(data.results.map((item) => item.normalizedScore));
  audit.expect(
    Math.abs(expectedNormalized - data.overallNormalized) <= TOLERANCE.aggregate,
    'error',
    'overall-normalized-mismatch',
    `المؤشر المعياري العام ${data.overallNormalized} لا يساوي متوسط مؤشرات البنود ` +
      `(المتوقع ${round2(expectedNormalized)}).`
  );

  audit.expect(
    Math.abs(normalizedFromWeight(data.overallAverage) - data.overallNormalized) <=
      TOLERANCE.derived,
    'error',
    'overall-transform-mismatch',
    `المؤشران العامان لا تربطهما المعادلة الخطية: ${data.overallAverage}% مقابل ` +
      `${data.overallNormalized}.`
  );

  if (data.overallCronbachAlpha !== undefined) {
    audit.expect(
      data.overallCronbachAlpha <= 1,
      'error',
      'alpha-above-one',
      `ألفا كرونباخ ${data.overallCronbachAlpha} أكبر من الواحد الصحيح.`
    );
    audit.expect(
      data.overallCronbachAlpha <= QUALITY_THRESHOLDS.redundantAlpha,
      'warning',
      'alpha-redundant',
      `ألفا ${data.overallCronbachAlpha} مرتفع جداً — قد يعني بنوداً تقيس الشيء نفسه بصياغات مختلفة.`
    );
  }

  if (data.cronbachRespondents !== undefined && data.totalRespondents !== undefined) {
    audit.expect(
      data.cronbachRespondents <= data.totalRespondents,
      'error',
      'reliability-sample-too-large',
      `عينة الثبات ${data.cronbachRespondents} أكبر من عدد المشاركين ${data.totalRespondents}.`
    );
  }

  audit.expect(
    (data.totalRespondents ?? 0) >= QUALITY_THRESHOLDS.minimumRespondents,
    'warning',
    'small-sample',
    `عدد المشاركين ${data.totalRespondents ?? 0} أقل من ` +
      `${QUALITY_THRESHOLDS.minimumRespondents} — النتائج وصفية لهذه العيّنة ولا تحتمل التعميم.`
  );
}

function auditAxes(audit: Auditor, data: ReportData): void {
  if (data.axes.length === 0) return;

  const membership = new Map<number, number>();

  data.axes.forEach((axis) => {
    const scope = `المحور «${axis.name}»`;
    const members = data.results.filter((item) => questionBelongsToAxis(item, axis));
    members.forEach((item) =>
      membership.set(item.questionNumber, (membership.get(item.questionNumber) ?? 0) + 1)
    );

    audit.expect(
      (axis.count ?? 0) === members.length,
      'error',
      'axis-count-mismatch',
      `عدد أسئلة المحور ${axis.count ?? 0} لا يساوي الأسئلة المطابقة فعلاً ${members.length}.`,
      scope
    );

    if (members.length > 0) {
      const expectedAverage = mean(members.map((item) => item.relativeWeight));
      audit.expect(
        Math.abs(expectedAverage - (axis.average ?? 0)) <= TOLERANCE.aggregate,
        'error',
        'axis-average-mismatch',
        `متوسط المحور ${axis.average}% لا يساوي متوسط أوزان بنوده ` +
          `(المتوقع ${round2(expectedAverage)}%).`,
        scope
      );

      const expectedNormalized = mean(members.map((item) => item.normalizedScore));
      audit.expect(
        Math.abs(expectedNormalized - (axis.normalizedAverage ?? 0)) <= TOLERANCE.aggregate,
        'error',
        'axis-normalized-mismatch',
        `المؤشر المعياري للمحور ${axis.normalizedAverage} لا يساوي متوسط مؤشرات بنوده ` +
          `(المتوقع ${round2(expectedNormalized)}).`,
        scope
      );
    } else {
      audit.expect(
        false,
        'error',
        'empty-axis',
        'المحور لا يطابق أي سؤال محلَّل — راجع نطاق أرقام الأسئلة.',
        scope
      );
    }

    if (axis.cronbachAlpha !== undefined) {
      audit.expect(
        axis.cronbachAlpha <= 1,
        'error',
        'axis-alpha-above-one',
        `ألفا المحور ${axis.cronbachAlpha} أكبر من الواحد الصحيح.`,
        scope
      );
      audit.expect(
        axis.cronbachAlpha >= QUALITY_THRESHOLDS.minimumAlpha,
        'warning',
        'axis-alpha-low',
        `ألفا ${axis.cronbachAlpha} أقل من ${QUALITY_THRESHOLDS.minimumAlpha} — ` +
          'بنود المحور لا تقيس بعداً واحداً متماسكاً، فمتوسطه أضعف دلالة.',
        scope
      );
    }

    audit.expect(
      members.length >= QUALITY_THRESHOLDS.minimumAxisItems,
      'warning',
      'axis-too-few-items',
      `المحور مبني على ${members.length} بنداً فقط — متوسطه شديد الحساسية لبند واحد.`,
      scope
    );
  });

  const duplicated = Array.from(membership.entries())
    .filter(([, count]) => count > 1)
    .map(([number]) => number);
  audit.expect(
    duplicated.length === 0,
    'warning',
    'question-in-multiple-axes',
    `الأسئلة ${duplicated.join('، ')} تنتمي لأكثر من محور، فتُحسب مرتين في مقارنة المحاور.`
  );

  const orphans = data.results
    .filter((item) => !membership.has(item.questionNumber))
    .map((item) => item.questionNumber);
  audit.expect(
    orphans.length === 0,
    'warning',
    'question-without-axis',
    `الأسئلة ${orphans.slice(0, 12).join('، ')} لا تنتمي لأي محور، فتدخل المتوسط العام ` +
      'ولا تظهر في جدول المحاور.'
  );
}

function auditComparison(audit: Auditor, data: ReportData): void {
  const comparison = data.comparison;
  if (!comparison) return;

  const totalRows = comparison.rows.reduce((sum, row) => sum + row.respondents, 0);
  audit.expect(
    data.totalRespondents === undefined || totalRows <= data.totalRespondents,
    'error',
    'comparison-oversized',
    `مجموع أفراد فئات المقارنة ${totalRows} يتجاوز عدد المشاركين ${data.totalRespondents}.`
  );

  comparison.rows.forEach((row) => {
    const scope = `فئة «${row.category}»`;
    audit.expect(
      row.axisAverages.length === comparison.axisNames.length,
      'error',
      'comparison-columns-mismatch',
      `عدد متوسطات المحاور ${row.axisAverages.length} لا يطابق عدد أعمدة الجدول ` +
        `${comparison.axisNames.length}.`,
      scope
    );
    audit.expect(
      row.axisAverages.every(
        (average) => average === 0 || (average >= RELATIVE_WEIGHT_FLOOR && average <= 100)
      ) &&
        (row.overallAverage === 0 ||
          (row.overallAverage >= RELATIVE_WEIGHT_FLOOR && row.overallAverage <= 100)),
      'error',
      'comparison-value-out-of-range',
      `متوسط في صف الفئة خارج النطاق ${RELATIVE_WEIGHT_FLOOR}-100%.`,
      scope
    );
  });
}

function auditSampleProfile(audit: Auditor, data: ReportData): void {
  const profile = data.sampleProfile ?? [];
  profile.forEach((group) => {
    const scope = `المتغير «${group.column}»`;
    const counted = group.values.reduce((sum, value) => sum + value.count, 0);
    audit.expect(
      counted === group.answered,
      'error',
      'profile-count-mismatch',
      `مجموع فئات المتغير ${counted} لا يساوي عدد من أجاب ${group.answered}.`,
      scope
    );
    audit.expect(
      data.totalRespondents === undefined || group.answered <= data.totalRespondents,
      'error',
      'profile-oversized',
      `عدد من أجاب ${group.answered} يتجاوز عدد المشاركين ${data.totalRespondents}.`,
      scope
    );
    if (group.answered > 0) {
      const percentageSum = group.values.reduce((sum, value) => sum + value.percentage, 0);
      audit.expect(
        Math.abs(percentageSum - 100) <= TOLERANCE.percentageSum,
        'error',
        'profile-sum-mismatch',
        `مجموع نسب فئات المتغير ${round2(percentageSum)}% لا يساوي 100%.`,
        scope
      );
    }
  });
}

/**
 * الرسم الدائري دالة في جدول النتائج لا تصميم مستقل.
 *
 * الفئات الثلاث متباينة وتغطي المدى كله، فمجموعها يجب أن يساوي عدد الأسئلة.
 * وزن غير رقمي لا يقع في أي فئة، فينكسر المجموع ويُكشف الخلل — وهو ما لا
 * يظهر في الرسم نفسه لأن القطاعات تُرسم بما وجدته.
 *
 * تُحسب هنا مباشرةً لا عبر `report-helpers`: ذلك الملف يستورد المدقق، فاستيراده
 * منه يغلق دورة تنكسر عند أول ثابت يُقرأ وقت التهيئة.
 */
function auditCharts(audit: Auditor, data: ReportData): void {
  const high = data.results.filter(
    (item) => item.relativeWeight >= DISTRIBUTION_BANDS.high
  ).length;
  const medium = data.results.filter(
    (item) =>
      item.relativeWeight >= DISTRIBUTION_BANDS.medium &&
      item.relativeWeight < DISTRIBUTION_BANDS.high
  ).length;
  const low = data.results.filter(
    (item) => item.relativeWeight < DISTRIBUTION_BANDS.medium
  ).length;

  audit.expect(
    high + medium + low === data.results.length,
    'error',
    'distribution-buckets-mismatch',
    `مجموع فئات الأداء ${high + medium + low} لا يساوي عدد الأسئلة ${data.results.length}.`
  );
}

/**
 * التوصيات مشتقة من الأرقام، فتخضع لنفس التدقيق.
 *
 * أهم ثابت هنا: **كل رقم في نص التوصية موجود في أدلتها**. تقرير رسمي يذكر
 * نسبة لا أصل لها أسوأ من تقرير بلا توصيات، لأن القارئ يصدّقها ويبني عليها.
 * نستخرج كل عدد من النص ونطالب بوجود ما يقابله في الأدلة أو في عتبات النظام.
 */
function auditRecommendations(audit: Auditor, data: ReportData): void {
  const recommendations = data.recommendations ?? [];
  if (recommendations.length === 0) return;

  const findings = collectFindings(data);
  const findingIds = new Set(findings.map((finding) => finding.id));
  const evidenceById = new Map(findings.map((finding) => [finding.id, finding.evidence]));

  audit.expect(
    recommendations.length <= MAX_RECOMMENDATIONS,
    'error',
    'too-many-recommendations',
    `عدد التوصيات ${recommendations.length} يتجاوز الحد ${MAX_RECOMMENDATIONS}.`
  );

  const ids = recommendations.map((recommendation) => recommendation.id);
  audit.expect(
    new Set(ids).size === ids.length,
    'error',
    'duplicate-recommendation-id',
    'معرّف توصية مكرر — الجدول سيعرض السطر نفسه مرتين.'
  );

  audit.expect(
    recommendations.every(
      (recommendation, index) =>
        index === 0 || recommendations[index - 1].severity >= recommendation.severity
    ),
    'error',
    'recommendations-not-sorted',
    'التوصيات غير مرتبة بالأولوية تنازلياً.'
  );

  recommendations.forEach((recommendation) => {
    const scope = `التوصية «${recommendation.id}»`;

    audit.expect(
      recommendation.findingIds.length > 0 &&
        recommendation.findingIds.every((id) => findingIds.has(id)),
      'error',
      'recommendation-without-finding',
      'التوصية لا تستند إلى نتيجة قائمة في البيانات.',
      scope
    );

    audit.expect(
      Boolean(recommendation.rationale.trim()) &&
        Boolean(recommendation.indicator.trim()) &&
        Boolean(recommendation.target.trim()),
      'error',
      'recommendation-incomplete',
      'الجانب ناقص أحد حقوله: المبرر أو المؤشر أو الهدف.',
      scope
    );

    // كل عدد في المبرر والهدف يجب أن يقابله رقم في الأدلة أو عتبة معلنة
    const allowed = new Set<number>(ALLOWED_CONSTANTS);
    recommendation.findingIds.forEach((id) => {
      Object.values(evidenceById.get(id) ?? {}).forEach((value) => {
        if (typeof value === 'number') allowed.add(round2(value));
      });
    });
    recommendation.questionNumbers.forEach((number) => allowed.add(number));

    const quoted = `${recommendation.rationale} ${recommendation.target}`;
    const numbers = (quoted.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
    const unsupported = numbers.filter(
      (number) => !Array.from(allowed).some((value) => Math.abs(value - number) < 0.01)
    );
    audit.expect(
      unsupported.length === 0,
      'error',
      'recommendation-unsupported-number',
      `أرقام في نص التوصية بلا أصل في الأدلة: ${unsupported.join('، ')}.`,
      scope
    );
  });
}

/**
 * أرقام يجوز ذكرها في نص التوصية دون أن تكون نتيجة مستخرجة، لأنها عتبات معلنة
 * في صفحة المنهجية. تُبنى من الثوابت نفسها لا تُكتب يدوياً، فتغيير أي عتبة
 * ينسحب هنا تلقائياً بدل أن يُسقط توصية سليمة.
 */
const ALLOWED_CONSTANTS: number[] = [
  0,
  RELATIVE_WEIGHT_FLOOR,
  DISTRIBUTION_BANDS.medium,
  DISTRIBUTION_BANDS.high,
  NARRATIVE_THRESHOLDS.weakness,
  NARRATIVE_THRESHOLDS.strength,
  POLARIZATION.endShare,
  QUALITY_THRESHOLDS.minimumAlpha,
  QUALITY_THRESHOLDS.minimumResponseRate,
  FINDING_THRESHOLDS.groupGap,
  FINDING_THRESHOLDS.negativeTail,
  FINDING_THRESHOLDS.axisWeakness,
  90,
  95,
  100,
];

/** يفحص كل ثوابت التقرير ويعيد ما انكسر منها */
export function auditReport(data: ReportData): AuditSummary {
  const audit = new Auditor();

  audit.expect(
    typeof data.title === 'string' && data.title.trim().length > 0,
    'error',
    'missing-title',
    'عنوان التقرير مفقود.'
  );

  audit.expect(
    Array.isArray(data.results) && data.results.length > 0,
    'error',
    'no-results',
    'لا توجد نتائج أسئلة قابلة للطباعة.'
  );

  if (Array.isArray(data.results) && data.results.length > 0) {
    const totalRespondents = data.totalRespondents ?? 0;
    data.results.forEach((item) => auditQuestion(audit, item, totalRespondents));
    auditRanking(audit, data);
    auditAggregates(audit, data);
    auditAxes(audit, data);
    auditComparison(audit, data);
    auditSampleProfile(audit, data);
    auditCharts(audit, data);
    auditRecommendations(audit, data);
  }

  const errors = audit.issues.filter((issue) => issue.severity === 'error');
  const warnings = audit.issues.filter((issue) => issue.severity === 'warning');
  return { checks: audit.checks, issues: audit.issues, errors, warnings };
}

/** صياغة سطر واحد يجمع موضع الخلل ورسالته */
export function formatAuditIssue(issue: AuditIssue): string {
  return issue.scope ? `${issue.scope}: ${issue.message}` : issue.message;
}
