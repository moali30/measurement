/**
 * طبقة التوفيق: نتحقق من الأرقام بمقارنتها بمصدر مستقل، لا بإعادة قراءتها.
 *
 * سببان مباشران:
 *   ١) التطبيق يقرأ من مسارين — قاعدة البيانات بنصوص البدائل، وملف Excel
 *      بأرقام خام بلا توصيف. الخلل الأصلي (نسبة 131%) وُلد من انحراف مسار عن
 *      الآخر، فالمقارنة بينهما هي الحارس الطبيعي ضد تكراره.
 *   ٢) اختبار يعيد تنفيذ خوارزمية المحرك لا يثبت شيئاً؛ الحساب هنا مكتوب
 *      بطريقة مختلفة عمداً (تكرار مباشر على القيم) ليكون رأياً ثانياً حقيقياً.
 */
import { describe, expect, it } from 'vitest';
import { processData } from '@/lib/analysis-utils';
import { auditReport } from '@/lib/analysis/audit';
import { ANALYSIS_SCALE } from '@/lib/analysis/scale';
import {
  LIKERT_LABELS,
  LevelCounts,
  VALUE_MAP,
  analyseSurvey,
  buildSurvey,
  choiceAt,
  respondentsIn,
  toReport,
} from './fixtures';

const PATTERNS: LevelCounts[] = [
  [11, 6, 2, 1, 0],
  [3, 4, 3, 5, 5],
  [7, 3, 1, 4, 5],
  [2, 3, 3, 6, 6],
  [12, 5, 2, 1, 0],
];

/** حساب مرجعي مكتوب بطريقة مختلفة: تكرار مباشر بلا أي استدعاء للمحرك */
function referenceStats(values: number[]) {
  let sum = 0;
  let negative = 0;
  let neutral = 0;
  let positive = 0;
  const midpoint = (ANALYSIS_SCALE.min + ANALYSIS_SCALE.max) / 2;

  for (const value of values) {
    sum += value;
    if (value < midpoint) negative += 1;
    else if (value > midpoint) positive += 1;
    else neutral += 1;
  }

  const n = values.length;
  const mean = sum / n;
  let squares = 0;
  for (const value of values) squares += (value - mean) ** 2;

  const round2 = (x: number) => Math.round(x * 100) / 100;
  return {
    count: n,
    mean: round2(mean),
    stdDev: round2(n > 1 ? Math.sqrt(squares / (n - 1)) : 0),
    relativeWeight: round2((sum / (n * ANALYSIS_SCALE.max)) * 100),
    normalizedScore: round2(
      ((mean - ANALYSIS_SCALE.min) / (ANALYSIS_SCALE.max - ANALYSIS_SCALE.min)) * 100
    ),
    negativeShare: round2((negative / n) * 100),
    neutralShare: round2((neutral / n) * 100),
    positiveShare: round2((positive / n) * 100),
  };
}

describe('مسار قاعدة البيانات ومسار Excel يعطيان النتيجة نفسها', () => {
  const survey = buildSurvey({ patterns: PATTERNS, withDemographics: false });

  // مسار قاعدة البيانات: نصوص البدائل مع توصيف النوع وخريطة الترميز
  const fromDatabase = analyseSurvey(survey);

  // مسار Excel: أرقام خام، بلا نوع سؤال ولا خريطة بدائل ولا عدد بدائل
  const numericRows = survey.rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, VALUE_MAP[String(value)]])
    )
  );
  const fromSpreadsheet = processData(numericRows, [], undefined, undefined, {});

  it('يحلّل العدد نفسه من البنود', () => {
    expect(fromSpreadsheet.results).toHaveLength(fromDatabase.results.length);
  });

  it('يعطي كل بند الأرقام نفسها رقماً برقم', () => {
    fromDatabase.results.forEach((expectedItem, index) => {
      const actual = fromSpreadsheet.results[index];
      expect(actual.question).toBe(expectedItem.question);
      expect(actual.count).toBe(expectedItem.count);
      expect(actual.mean).toBe(expectedItem.mean);
      expect(actual.relativeWeight).toBe(expectedItem.relativeWeight);
      expect(actual.normalizedScore).toBe(expectedItem.normalizedScore);
      expect(actual.stdDev).toBe(expectedItem.stdDev);
      expect(actual.median).toBe(expectedItem.median);
      expect(actual.negativeShare).toBe(expectedItem.negativeShare);
      expect(actual.neutralShare).toBe(expectedItem.neutralShare);
      expect(actual.positiveShare).toBe(expectedItem.positiveShare);
      expect(actual.distribution).toEqual(expectedItem.distribution);
    });
  });

  it('يعطي المتوسط العام والمؤشر العام نفسيهما', () => {
    expect(fromSpreadsheet.overallAverage).toBe(fromDatabase.overallAverage);
    expect(fromSpreadsheet.overallNormalized).toBe(fromDatabase.overallNormalized);
  });

  it('يعطي معامل الثبات نفسه', () => {
    expect(fromSpreadsheet.overallCronbachAlpha).toBe(fromDatabase.overallCronbachAlpha);
  });
});

describe('حساب مرجعي مستقل عن المحرك', () => {
  const survey = buildSurvey({ patterns: PATTERNS, withDemographics: false });
  const processed = analyseSurvey(survey);

  it('يطابق المحرك في كل بند', () => {
    PATTERNS.forEach((counts, index) => {
      const values = Array.from({ length: respondentsIn(counts) }, (_, person) =>
        VALUE_MAP[choiceAt(counts, person)]
      );
      const reference = referenceStats(values);
      const item = processed.results[index];

      expect(item.count).toBe(reference.count);
      expect(item.mean).toBe(reference.mean);
      expect(item.stdDev).toBe(reference.stdDev);
      expect(item.relativeWeight).toBe(reference.relativeWeight);
      expect(item.negativeShare).toBe(reference.negativeShare);
      expect(item.neutralShare).toBe(reference.neutralShare);
      expect(item.positiveShare).toBe(reference.positiveShare);
      // المؤشر يُحسب من المجموع لا من المتوسط المقرَّب، فيُقارن بهامش التقريب
      expect(Math.abs(item.normalizedScore - reference.normalizedScore)).toBeLessThanOrEqual(0.15);
    });
  });
});

describe('ترميز البدائل يتبع ترتيب النموذج لا ترتيب الحروف', () => {
  it('البديل الأول يأخذ أعلى درجة', () => {
    const question = '1. س';
    const rows = LIKERT_LABELS.map((label) => ({ [question]: label }));
    const result = processData(rows, [], { [question]: 'likert' }, [], {
      questionOptionCounts: { [question]: 5 },
      questionValueMaps: { [question]: VALUE_MAP },
    });
    // خمس إجابات، واحدة على كل بديل: المتوسط منتصف السُّلَّم
    expect(result.results[0].mean).toBe(3);
    expect(result.results[0].distribution.every((slice) => slice.count === 1)).toBe(true);
  });

  it('قلب ترتيب البدائل يقلب النتيجة — ولهذا يُثبَّت الترتيب في النموذج', () => {
    const question = '1. س';
    const flipped = Object.fromEntries(
      LIKERT_LABELS.map((label, index) => [label, index + 1])
    );
    const rows = Array.from({ length: 8 }, () => ({ [question]: LIKERT_LABELS[0] }));

    const correct = processData(rows, [], { [question]: 'likert' }, [], {
      questionOptionCounts: { [question]: 5 },
      questionValueMaps: { [question]: VALUE_MAP },
    });
    const inverted = processData(rows, [], { [question]: 'likert' }, [], {
      questionOptionCounts: { [question]: 5 },
      questionValueMaps: { [question]: flipped },
    });

    expect(correct.results[0].relativeWeight).toBe(100);
    expect(inverted.results[0].relativeWeight).toBe(20);
  });
});

describe('ثبات المخرجات: نفس المدخل يعطي نفس التقرير حرفياً', () => {
  it('لا يعتمد على ترتيب الصفوف في الحساب الكمي', () => {
    const survey = buildSurvey({ patterns: PATTERNS, withDemographics: false });
    const inOrder = analyseSurvey(survey);
    const shuffled = analyseSurvey({
      ...survey,
      rows: [...survey.rows].reverse(),
    });
    expect(shuffled.results.map((item) => item.relativeWeight)).toEqual(
      inOrder.results.map((item) => item.relativeWeight)
    );
    expect(shuffled.overallNormalized).toBe(inOrder.overallNormalized);
  });

  it('تشغيلان متتاليان يعطيان تقريراً متطابقاً', () => {
    const survey = buildSurvey({ patterns: PATTERNS });
    const first = JSON.stringify(analyseSurvey(survey, survey.genderKey));
    const second = JSON.stringify(analyseSurvey(survey, survey.genderKey));
    expect(second).toBe(first);
  });
});

describe('التقارير المولَّدة تجتاز التدقيق دائماً', () => {
  const shapes: Array<[string, LevelCounts[]]> = [
    ['إجماع تام', [[20, 0, 0, 0, 0]]],
    ['رفض تام', [[0, 0, 0, 0, 20]]],
    ['حياد تام', [[0, 0, 20, 0, 0]]],
    ['انقسام حاد', [[10, 0, 0, 0, 10]]],
    ['توزيع طبيعي', [[2, 5, 6, 5, 2]]],
    ['متعدد البنود', PATTERNS],
  ];

  it.each(shapes)('%s', (_label, patterns) => {
    const survey = buildSurvey({
      patterns,
      axes: [
        {
          name: 'المحور',
          start: 1,
          end: patterns.length,
          questionNumbers: patterns.map((_, index) => index + 1),
        },
      ],
    });
    const audit = auditReport(toReport(analyseSurvey(survey, survey.genderKey)));
    expect(audit.errors).toEqual([]);
  });
});
