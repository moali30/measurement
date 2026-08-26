import { describe, expect, it } from 'vitest';
import {
  computeCronbachAlpha,
  computeDescriptiveStats,
  computeDistribution,
  computeNormalizedScore,
  computeOpinionShares,
  computeRelativeWeight,
  reverseCode,
} from '@/lib/analysis/statistics';
import { aggregateAnswers } from '@/lib/analysis/comments';

describe('الإحصاء الوصفي', () => {
  it('يحسب المتوسط والانحراف والوسيط والمنوال', () => {
    expect(computeDescriptiveStats([1, 2, 3, 4])).toEqual({
      count: 4,
      sum: 10,
      mean: 2.5,
      // انحراف العينة: الجذر التربيعي لـ (5/3)
      stdDev: 1.29,
      median: 2.5,
      mode: 1,
    });
  });

  it('يعيد أصفاراً بلا قسمة على صفر عند غياب القيم', () => {
    expect(computeDescriptiveStats([])).toEqual({
      count: 0,
      sum: 0,
      mean: 0,
      stdDev: 0,
      median: 0,
      mode: 0,
    });
  });

  it('لا يحسب تشتتاً لاستجابة واحدة', () => {
    expect(computeDescriptiveStats([4]).stdDev).toBe(0);
  });
});

describe('الوزن النسبي والمؤشر المعياري', () => {
  it('الوزن النسبي نسبة من أقصى مجموع ممكن', () => {
    // ١٠ مشاركين × ٥ درجات = ٥٠ أقصى مجموع؛ المرصود ٣٩
    expect(computeRelativeWeight(39, 10, 5)).toBe(78);
  });

  it('أرضية الوزن النسبي ٢٠٪ لا صفر', () => {
    expect(computeRelativeWeight(10, 10, 5)).toBe(20);
  });

  it('المؤشر المعياري يجعل الحياد التام ٥٠ بالضبط', () => {
    expect(computeNormalizedScore(3, 1, 5)).toBe(50);
  });

  it('المؤشر المعياري يمتد من صفر حقيقي إلى مئة', () => {
    expect(computeNormalizedScore(1, 1, 5)).toBe(0);
    expect(computeNormalizedScore(5, 1, 5)).toBe(100);
  });

  it('يقصّ القيم الشاذة داخل النطاق بدل إخراج نسبة مستحيلة', () => {
    expect(computeNormalizedScore(9, 1, 5)).toBe(100);
    expect(computeNormalizedScore(-3, 1, 5)).toBe(0);
  });
});

describe('عكس الترميز', () => {
  it('يقلب طرفي السُّلَّم', () => {
    expect(reverseCode(1, 5, 1)).toBe(5);
    expect(reverseCode(5, 5, 1)).toBe(1);
  });

  it('لا يحرّك منتصف السُّلَّم', () => {
    expect(reverseCode(3, 5, 1)).toBe(3);
  });

  it('العكس مرتين يعيد القيمة الأصلية', () => {
    for (let value = 1; value <= 5; value += 1) {
      expect(reverseCode(reverseCode(value, 5, 1), 5, 1)).toBe(value);
    }
  });
});

describe('التوزيع التكراري', () => {
  it('يعرض كل مستويات السُّلَّم حتى الخالية منها', () => {
    const distribution = computeDistribution([5, 5, 4], 5, 1);
    expect(distribution.map((slice) => slice.value)).toEqual([5, 4, 3, 2, 1]);
    expect(distribution.find((slice) => slice.value === 3)!.count).toBe(0);
  });

  it('مجموع النسب مئة ومجموع الأعداد يساوي عدد الاستجابات', () => {
    const values = [5, 4, 4, 3, 2, 1, 1];
    const distribution = computeDistribution(values, 5, 1);
    expect(distribution.reduce((sum, slice) => sum + slice.count, 0)).toBe(values.length);
    expect(distribution.reduce((sum, slice) => sum + slice.percentage, 0)).toBeCloseTo(100, 1);
  });
});

describe('اتجاهات الرأي', () => {
  it('يقسم حول منتصف السُّلَّم لا حول أرقام مكتوبة يدوياً', () => {
    expect(computeOpinionShares([5, 5, 4, 3, 2, 1], 1, 5)).toEqual({
      negative: 33.33,
      neutral: 16.67,
      positive: 50,
    });
  });

  it('يعيد أصفاراً بلا قيم', () => {
    expect(computeOpinionShares([], 1, 5)).toEqual({ negative: 0, neutral: 0, positive: 0 });
  });
});

describe('ألفا كرونباخ المعياري', () => {
  it('يساوي واحداً عند الارتباط التام', () => {
    const result = computeCronbachAlpha([
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
      [4, 4, 4],
    ]);
    expect(result?.alpha).toBe(1);
    expect(result?.respondents).toBe(4);
  });

  it('لا يعطي قيمة عند انعدام تباين بند', () => {
    expect(
      computeCronbachAlpha([
        [3, 1],
        [3, 2],
        [3, 4],
      ])
    ).toBeUndefined();
  });

  it('لا يعطي قيمة لبند واحد أو لصفوف ناقصة', () => {
    expect(computeCronbachAlpha([[1], [2]])).toBeUndefined();
    expect(
      computeCronbachAlpha([
        [1, null],
        [2, 3],
      ])
    ).toBeUndefined();
  });

  it('يستبعد الصفوف غير المكتملة بالحذف القائمي', () => {
    const result = computeCronbachAlpha([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, null],
    ]);
    expect(result?.respondents).toBe(3);
  });
});

describe('تجميع التعليقات', () => {
  it('يستبعد الإجابات الخالية ويعدّ المتكرر مرة واحدة', () => {
    const group = aggregateAnswers('ملاحظات', [
      'لا يوجد',
      'تحسين المعامل.',
      'تحسين المعامل',
      '-',
    ]);
    expect(group.answers).toHaveLength(1);
    expect(group.answers[0].occurrences).toBe(2);
    expect(group.skippedCount).toBe(2);
  });
});
