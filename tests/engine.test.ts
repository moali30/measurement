import { describe, expect, it } from 'vitest';
import { getPolarizedQuestions, processData } from '@/lib/analysis-utils';
import { ANALYSIS_SCALE, RELATIVE_WEIGHT_FLOOR } from '@/lib/analysis/scale';
import {
  LevelCounts,
  VALUE_MAP,
  analyseSingle,
  choiceAt,
  analyseSurvey,
  buildSurvey,
  rowsFor,
} from './fixtures';

const QUESTION = '1. المحاضر يشرح بوضوح';

describe('العيّنة الذهبية — محسوبة بالورقة', () => {
  // ١٠ مشاركين: ٣ موافق جداً، ٤ موافق، ٢ محايد، ١ غير موافق
  // المجموع = ١٥+١٦+٦+٢ = ٣٩ · المتوسط ٣٫٩ · الوزن ٣٩÷٥٠ · المعياري (٣٫٩−١)÷٤
  const item = analyseSingle(QUESTION, [3, 4, 2, 1, 0]).results[0];

  it('يقرأ عدد الاستجابات الصالحة', () => expect(item.count).toBe(10));
  it('يحسب المتوسط', () => expect(item.mean).toBe(3.9));
  it('يحسب الوزن النسبي', () => expect(item.relativeWeight).toBe(78));
  it('يحسب المؤشر المعياري', () => expect(item.normalizedScore).toBe(72.5));
  it('يوزّع اتجاهات الرأي', () => {
    expect(item.negativeShare).toBe(10);
    expect(item.neutralShare).toBe(20);
    expect(item.positiveShare).toBe(70);
  });
  it('يثبّت السُّلَّم الخماسي', () => {
    expect(item.scaleMin).toBe(ANALYSIS_SCALE.min);
    expect(item.scaleMax).toBe(ANALYSIS_SCALE.max);
  });
});

describe('حدود السُّلَّم ومعناها المنطوق', () => {
  it('أسوأ تقييم ممكن أرضيته ٢٠٪ بالوزن وصفر بالمؤشر', () => {
    const worst = analyseSingle(QUESTION, [0, 0, 0, 0, 8]).results[0];
    expect(worst.relativeWeight).toBe(RELATIVE_WEIGHT_FLOOR);
    expect(worst.normalizedScore).toBe(0);
  });

  it('أفضل تقييم ممكن مئة بالمقياسين', () => {
    const best = analyseSingle(QUESTION, [8, 0, 0, 0, 0]).results[0];
    expect(best.relativeWeight).toBe(100);
    expect(best.normalizedScore).toBe(100);
  });

  it('الحياد التام ٦٠٪ بالوزن و٥٠ بالمؤشر', () => {
    const neutral = analyseSingle(QUESTION, [0, 0, 10, 0, 0]).results[0];
    expect(neutral.relativeWeight).toBe(60);
    expect(neutral.normalizedScore).toBe(50);
  });
});

describe('الانقسام لا يظهر في المتوسط', () => {
  const neutral = analyseSingle(QUESTION, [0, 0, 10, 0, 0]).results[0];
  const split = analyseSingle(QUESTION, [5, 0, 0, 0, 5]).results[0];
  const spread = analyseSingle(QUESTION, [1, 2, 4, 2, 1]).results[0];

  it('ثلاثة واقعات مختلفة تعطي المتوسط والوزن والمؤشر نفسها', () => {
    [split, spread].forEach((item) => {
      expect(item.mean).toBe(neutral.mean);
      expect(item.relativeWeight).toBe(neutral.relativeWeight);
      expect(item.normalizedScore).toBe(neutral.normalizedScore);
    });
  });

  it('التشتت وحده يفرّق بينها', () => {
    expect(neutral.stdDev).toBe(0);
    expect(spread.stdDev).toBeGreaterThan(0);
    expect(split.stdDev).toBeGreaterThan(spread.stdDev);
  });

  it('كاشف الانقسام يمسك المنقسم ويترك المحايد', () => {
    expect(getPolarizedQuestions([split])).toHaveLength(1);
    expect(getPolarizedQuestions([neutral])).toHaveLength(0);
  });

  it('يرتّب المنقسمة بالطرف الأصغر: أشدّ انقسام ما تقاربت فيه الكتلتان', () => {
    const survey = buildSurvey({
      patterns: [
        [10, 0, 0, 0, 10], // 50 / 50 — الطرف الأصغر 50
        [8, 0, 0, 0, 12], // 40 / 60 — الطرف الأصغر 40
        [5, 0, 0, 5, 10], // 25 / 50 — الطرف الأصغر 25
      ],
      withDemographics: false,
    });
    const polarized = getPolarizedQuestions(analyseSurvey(survey).results);
    expect(polarized.map((item) => item.questionNumber)).toEqual([1, 2, 3]);
  });
});

describe('الأسئلة العكسية', () => {
  it('تقلب أدنى إجابة إلى أعلى درجة قبل الحساب', () => {
    const reversed = analyseSingle(QUESTION, [0, 0, 0, 0, 7], {
      reversedQuestions: [QUESTION],
    }).results[0];
    expect(reversed.mean).toBe(5);
    expect(reversed.relativeWeight).toBe(100);
    expect(reversed.isReversed).toBe(true);
  });

  it('تعكس اتجاهات الرأي معها', () => {
    const plain = analyseSingle(QUESTION, [6, 2, 0, 0, 0]).results[0];
    const reversed = analyseSingle(QUESTION, [6, 2, 0, 0, 0], {
      reversedQuestions: [QUESTION],
    }).results[0];
    expect(plain.positiveShare).toBe(reversed.negativeShare);
    expect(plain.negativeShare).toBe(reversed.positiveShare);
  });
});

describe('حراسة السُّلَّم — قرار معلن لا قيمة تُستنتج', () => {
  it('سُلَّم مختلف يوقف التقرير ولا يُصحَّح بصمت', () => {
    // نصف القيم خارج المقياس: هذه علامة عمود قيس على سُلَّم آخر
    const result = processData([{ [QUESTION]: 7 }, { [QUESTION]: 3 }], [], { [QUESTION]: 'likert' }, [], {
      questionOptionCounts: { [QUESTION]: 5 },
    });
    expect(result.analysisErrors.map((error) => error.code)).toEqual(['values-out-of-scale']);
    expect(result.results).toHaveLength(0);
  });

  it('قيمة شاردة واحدة تُعدّ مفقودة ويُبلَّغ عنها بدل إيقاف التقرير', () => {
    // صفرٌ ورثته بيانات مهاجَرة عن خانة لم تُملأ هو إجابة غير صالحة، لا دليل
    // على سُلَّم آخر. إيقاف تقرير كامل بسببه يعامل الشاردة معاملة اختلاف السُّلَّم.
    const rows = Array.from({ length: 20 }, (_, index) => ({ [QUESTION]: (index % 5) + 1 }));
    rows[0] = { [QUESTION]: 0 };
    const result = processData(rows, [], { [QUESTION]: 'likert' }, [], {
      questionOptionCounts: { [QUESTION]: 5 },
    });

    expect(result.analysisErrors).toEqual([]);
    expect(result.results[0].count).toBe(19);
    expect(result.results[0].missing).toBe(1);
    expect(result.analysisWarnings.map((warning) => warning.code)).toContain(
      'invalid-values-excluded'
    );
  });

  it('ليكرت ببدائل غير خمس يوقف التقرير', () => {
    const result = processData(rowsFor(QUESTION, [1, 1, 1, 0, 0]), [], { [QUESTION]: 'likert' }, [], {
      questionOptionCounts: { [QUESTION]: 3 },
      questionValueMaps: { [QUESTION]: VALUE_MAP },
    });
    expect(result.analysisErrors.map((error) => error.code)).toEqual(['non-standard-likert']);
  });

  it('رسالة الخطأ تسمّي السؤال وتقترح الإصلاح', () => {
    const result = processData([{ [QUESTION]: 9 }], [], { [QUESTION]: 'likert' }, [], {
      questionOptionCounts: { [QUESTION]: 5 },
    });
    expect(result.analysisErrors[0].message).toContain('المحاضر يشرح بوضوح');
    expect(result.analysisErrors[0].message).toContain('التعليقات');
  });

  it('عمود ترقيم أو تاريخ في ملف مصدَّر يُستبعد ولا يوقف التقرير', () => {
    // ملف النتائج المصدَّر يحمل ترقيماً وتاريخاً دائماً؛ رفض التقرير بسببهما
    // كان يجعل كل ملف تصدير غير قابل للتحليل.
    const rows = Array.from({ length: 20 }, (_, index) => ({
      '#': index + 1,
      التاريخ: 46195.5 + index,
      [QUESTION]: choiceAt([8, 6, 4, 2, 0], index),
    }));
    const result = processData(rows, [], undefined, undefined, {});

    expect(result.analysisErrors).toEqual([]);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].question).toBe(QUESTION);
    expect(result.analysisWarnings.map((warning) => warning.question).sort()).toEqual([
      '#',
      'التاريخ',
    ]);
  });

  it('العمود المعلن ببنوده لا يُستبعد كعمود دخيل مهما فسدت قيمه', () => {
    // التمييز الباقي بعد تخفيف الحارس: العمود غير المعلن يُستبعد بصمت موثّق،
    // والمعلن يوقف التقرير — فالمُعلن بند قياس لا عمود عابر في ملف.
    const rows = Array.from({ length: 20 }, (_, index) => ({ [QUESTION]: index + 1 }));

    const declared = processData(rows, [], { [QUESTION]: 'likert' }, [], {
      questionOptionCounts: { [QUESTION]: 5 },
    });
    expect(declared.analysisErrors.map((error) => error.code)).toEqual(['values-out-of-scale']);

    // غير المعلن يُستبعد فلا يبقى بند يُحلَّل — لا يُبلَّغ عنه كخلل في مقياسه
    const undeclared = processData(rows, [], undefined, undefined, {});
    expect(undeclared.analysisErrors.map((error) => error.code)).toEqual(['no-likert-questions']);
  });

  it('إجابة نصية شاذة داخل بند ليكرت تُعدّ مفقودة لا تُهمَل', () => {
    // سؤال نعم/لا وُسم ليكرت بالخطأ يترك إجابات لا يقرؤها الترميز. إغفالها
    // يكسر ثابت «الصالح + المفقود = المشاركين» فيُرفض التقرير برسالة لا تدل
    // على السبب، مع أن العلاج هو تصحيح نوع السؤال.
    const rows = rowsFor(QUESTION, [6, 4, 0, 0, 0]);
    rows[0] = { [QUESTION]: 'نعم' };
    const result = processData(rows, [], { [QUESTION]: 'likert' }, [], {
      questionOptionCounts: { [QUESTION]: 5 },
      questionValueMaps: { [QUESTION]: VALUE_MAP },
    });

    expect(result.analysisErrors).toEqual([]);
    const item = result.results[0];
    expect(item.count).toBe(9);
    expect(item.missing).toBe(1);
    expect(item.count + item.missing).toBe(result.totalRespondents);
  });

  it('بيانات بلا بند ليكرت واحد ترفض التحليل', () => {
    const result = processData([{ 'أ. النوع': 'ذكر' }], [], { 'أ. النوع': 'radio' }, []);
    expect(result.analysisErrors.map((error) => error.code)).toEqual(['no-likert-questions']);
  });
});

describe('المتغيرات الديموغرافية توصف ولا تُقيَّم', () => {
  const survey = buildSurvey({ patterns: [[4, 4, 0, 0, 0]] });
  const result = analyseSurvey(survey);

  it('تخرج من المتوسط العام', () => {
    expect(result.results).toHaveLength(1);
    expect(result.results[0].question).toBe(survey.questionKeys[0]);
  });

  it('تظهر في توصيف العيّنة بالعدد والنسبة', () => {
    const gender = result.sampleProfile.find((group) => group.column === survey.genderKey);
    expect(gender?.answered).toBe(8);
    expect(gender?.values.reduce((sum, value) => sum + value.count, 0)).toBe(8);
    expect(gender?.values.reduce((sum, value) => sum + value.percentage, 0)).toBeCloseTo(100, 1);
  });

  it('سؤال نعم/لا يُعامل معاملة المتغير الديموغرافي', () => {
    const yesNo = result.sampleProfile.find((group) => group.column.includes('توصي'));
    expect(yesNo?.values.map((value) => value.label).sort()).toEqual(['لا', 'نعم']);
  });

  it('عمود نصي لم يختره المستخدم لا يُطبع كتعليق', () => {
    const withoutNotes = processData(survey.rows, [], survey.questionTypes, [], {
      questionOptionCounts: survey.questionOptionCounts,
      questionValueMaps: survey.questionValueMaps,
    });
    expect(withoutNotes.comments).toHaveLength(0);
  });
});

describe('المحاور والمتوسط العام', () => {
  const patterns: LevelCounts[] = [
    [4, 2, 2, 0, 0],
    [0, 2, 4, 2, 0],
    [6, 1, 1, 0, 0],
    [0, 0, 2, 3, 3],
  ];
  const survey = buildSurvey({
    patterns,
    withDemographics: false,
    axes: [
      { name: 'الأول', start: 1, end: 2, questionNumbers: [1, 2] },
      { name: 'الثاني', start: 3, end: 4, questionNumbers: [3, 4] },
    ],
  });
  const result = analyseSurvey(survey);

  it('متوسط المحور يساوي متوسط أوزان بنوده', () => {
    result.axes.forEach((axis) => {
      const members = result.results.filter((item) =>
        axis.questionNumbers!.includes(item.questionNumber)
      );
      const expected =
        Math.round(
          (members.reduce((sum, item) => sum + item.relativeWeight, 0) / members.length) * 100
        ) / 100;
      expect(axis.average).toBe(expected);
    });
  });

  it('المتوسط العام يساوي متوسط أوزان كل البنود', () => {
    const expected =
      Math.round(
        (result.results.reduce((sum, item) => sum + item.relativeWeight, 0) /
          result.results.length) *
          100
      ) / 100;
    expect(result.overallAverage).toBe(expected);
  });

  it('يرتّب المحاور تنافسياً بالوزن', () => {
    const ranks = [...result.axes].sort((a, b) => b.average! - a.average!).map((a) => a.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a! - b!));
  });

  it('الرتب المتساوية للأوزان المتساوية', () => {
    const twin = buildSurvey({
      patterns: [
        [4, 2, 2, 0, 0],
        [4, 2, 2, 0, 0],
      ],
      withDemographics: false,
    });
    const twinResult = analyseSurvey(twin);
    expect(twinResult.results[0].relativeWeight).toBe(twinResult.results[1].relativeWeight);
    expect(twinResult.results[0].rank).toBe(twinResult.results[1].rank);
  });
});

describe('ثوابت تصح على كل التوزيعات الممكنة', () => {
  const RESPONDENTS = 6;

  it('تصمد عبر كل توزيعات ٦ مشاركين على ٥ بدائل', () => {
    let worstTransformGap = 0;
    let cases = 0;

    for (let a = 0; a <= RESPONDENTS; a += 1) {
      for (let b = 0; b <= RESPONDENTS - a; b += 1) {
        for (let c = 0; c <= RESPONDENTS - a - b; c += 1) {
          for (let d = 0; d <= RESPONDENTS - a - b - c; d += 1) {
            const e = RESPONDENTS - a - b - c - d;
            const item = analyseSingle(QUESTION, [a, b, c, d, e]).results[0];
            cases += 1;

            expect(item.mean).toBeGreaterThanOrEqual(ANALYSIS_SCALE.min);
            expect(item.mean).toBeLessThanOrEqual(ANALYSIS_SCALE.max);
            expect(item.relativeWeight).toBeGreaterThanOrEqual(RELATIVE_WEIGHT_FLOOR - 0.01);
            expect(item.relativeWeight).toBeLessThanOrEqual(100);
            expect(item.normalizedScore).toBeGreaterThanOrEqual(0);
            expect(item.normalizedScore).toBeLessThanOrEqual(100);
            expect(item.count + item.missing).toBe(RESPONDENTS);
            expect(item.distribution.reduce((sum, slice) => sum + slice.count, 0)).toBe(item.count);
            expect(
              item.negativeShare + item.neutralShare + item.positiveShare
            ).toBeCloseTo(100, 1);
            expect(item.median).toBeGreaterThanOrEqual(ANALYSIS_SCALE.min);
            expect(item.median).toBeLessThanOrEqual(ANALYSIS_SCALE.max);

            // التحويل بين المؤشرين خطي: المعياري = الوزن × ١٫٢٥ − ٢٥
            worstTransformGap = Math.max(
              worstTransformGap,
              Math.abs(item.relativeWeight * 1.25 - 25 - item.normalizedScore)
            );
          }
        }
      }
    }

    expect(cases).toBe(210);
    expect(worstTransformGap).toBeLessThan(0.05);
  });
});
