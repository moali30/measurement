import { describe, expect, it } from 'vitest';
import { auditReport, formatAuditIssue } from '@/lib/analysis/audit';
import { collectFindings } from '@/lib/analysis/findings';
import {
  MAX_RECOMMENDATIONS,
  MAX_STRENGTH_RECOMMENDATIONS,
  buildRecommendations,
} from '@/lib/analysis/recommendations';
import { classifyTheme } from '@/lib/analysis/themes';
import type { ReportData } from '@/types/analysis';
import { LevelCounts, analyseSurvey, buildSurvey, toReport } from './fixtures';

/** استبيان فيه مشكلة من كل نوع: ضعف حاد، انقسام، ضعف عادي، وتميّز */
function troubledReport(): ReportData {
  const patterns: LevelCounts[] = [
    [18, 12, 6, 4, 0], // 82% — سليم
    [4, 6, 6, 12, 12], // 49% — ضعف حاد
    [14, 4, 2, 8, 12], // 60% — منقسم
    [3, 5, 6, 12, 14], // 45.5% — ضعف حاد
    [10, 8, 8, 8, 6], // 64% — منقسم
    [12, 5, 3, 8, 12], // 58.5% — ضعف حاد
    [6, 6, 6, 10, 12], // 52% — ضعف حاد
    [20, 12, 4, 4, 0], // 84% — سليم
  ];
  const survey = buildSurvey({
    patterns,
    questionTexts: [
      'أهداف المقرر ومخرجات التعلم معلنة وواضحة',
      'محتوى المقرر يواكب متطلبات سوق العمل',
      'معايير تقييم الطلاب في الامتحانات معلنة وعادلة',
      'المعامل مجهزة بالأجهزة اللازمة',
      'أعضاء هيئة التدريس يستخدمون أساليب شرح متنوعة',
      'المكتبة توفر المراجع العلمية المطلوبة',
      'الإرشاد الأكاديمي متاح ويقدم دعماً فعلياً',
      'جدية الإشراف والمتابعة لبرامج التدريب الميداني',
    ],
    axes: [
      { name: 'المقرر والتقويم', start: 1, end: 3, questionNumbers: [1, 2, 3] },
      { name: 'الموارد والمرافق', start: 4, end: 6, questionNumbers: [4, 5, 6] },
      { name: 'الدعم والتدريب', start: 7, end: 8, questionNumbers: [7, 8] },
    ],
  });
  return toReport(analyseSurvey(survey, survey.genderKey));
}

/** استبيان ممتاز في كل بنوده */
function excellentReport(): ReportData {
  const survey = buildSurvey({
    patterns: Array.from({ length: 6 }, () => [30, 8, 2, 0, 0] as unknown as LevelCounts),
    withDemographics: false,
  });
  return toReport(analyseSurvey(survey));
}

describe('تصنيف المجال', () => {
  it('يقرأ المجال من نص السؤال', () => {
    expect(classifyTheme('3. معايير تقييم الطلاب في الامتحانات معلنة')).toBe('assessment');
    expect(classifyTheme('4. المعامل مجهزة بالأجهزة اللازمة')).toBe('facilities');
    expect(classifyTheme('6. المكتبة توفر المراجع العلمية المطلوبة')).toBe('resources');
    expect(classifyTheme('7. الإرشاد الأكاديمي متاح ويقدم دعماً فعلياً')).toBe('support');
    expect(classifyTheme('8. جدية الإشراف على التدريب الميداني')).toBe('training');
  });

  it('يرجّح اسم المحور على نص السؤال', () => {
    // النص وحده يميل إلى «الإعلان»، واسم المحور يحسم أنه تقويم
    expect(classifyTheme('معايير التقييم معلنة وواضحة', 'التقويم والامتحانات')).toBe('assessment');
  });

  it('لا يتأثر بالتشكيل ولا باختلاف الهمزات', () => {
    expect(classifyTheme('1. الأهدافُ معلنةٌ في دليل الطالب')).toBe(
      classifyTheme('1. الاهداف معلنه في دليل الطالب')
    );
  });

  it('يعيد المجال العام حين لا تطابق أي كلمة', () => {
    expect(classifyTheme('س. زززز ككك ممم')).toBe('general');
  });
});

describe('رصد النتائج', () => {
  const report = troubledReport();
  const findings = collectFindings(report);

  it('يرصد الضعف الحاد والانقسام وضعف المحور', () => {
    const kinds = new Set(findings.map((finding) => finding.kind));
    expect(kinds).toContain('critical-weakness');
    expect(kinds).toContain('polarization');
    expect(kinds).toContain('axis-weakness');
  });

  it('لا يرصد الانقسام على بند ضعفه ظاهر في متوسطه', () => {
    // البند الرابع (45.5%) منقسم فعلاً، لكن المتوسط لا يخفي شيئاً هنا
    const polarizedNumbers = findings
      .filter((finding) => finding.kind === 'polarization')
      .map((finding) => finding.questionNumber);
    expect(polarizedNumbers).not.toContain(4);
  });

  it('يرتّب تنازلياً بالشدة', () => {
    findings.forEach((finding, index) => {
      if (index > 0) expect(findings[index - 1].severity).toBeGreaterThanOrEqual(finding.severity);
    });
  });

  it('كل نتيجة تحمل دليلاً رقمياً', () => {
    findings.forEach((finding) => {
      const numbers = Object.values(finding.evidence).filter((value) => typeof value === 'number');
      expect(numbers.length).toBeGreaterThan(0);
    });
  });
});

describe('بناء التوصيات', () => {
  const report = troubledReport();
  const recommendations = report.recommendations ?? [];

  it('ينتج توصيات', () => {
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
  });

  it('توصية واحدة لكل مجال — لا تكرار', () => {
    const themes = recommendations.map((recommendation) => recommendation.theme);
    expect(new Set(themes).size).toBe(themes.length);
  });

  it('كل توصية كاملة الحقول الأربعة', () => {
    recommendations.forEach((recommendation) => {
      expect(recommendation.action.trim()).not.toBe('');
      expect(recommendation.rationale.trim()).not.toBe('');
      expect(recommendation.indicator.trim()).not.toBe('');
      expect(recommendation.target.trim()).not.toBe('');
    });
  });

  it('كل توصية مستندة إلى نتيجة قائمة', () => {
    const ids = new Set(collectFindings(report).map((finding) => finding.id));
    recommendations.forEach((recommendation) => {
      expect(recommendation.findingIds.length).toBeGreaterThan(0);
      recommendation.findingIds.forEach((id) => expect(ids).toContain(id));
    });
  });

  it('الإجراء محدد لا صيغة عامة', () => {
    const generic = 'تحليل أسباب النتيجة في هذا المجال';
    recommendations
      .filter((recommendation) => recommendation.theme !== 'general')
      .forEach((recommendation) => {
        expect(recommendation.action).not.toContain(generic);
      });
  });

  it('الانقسام يستدعي إجراءً مختلفاً عن الضعف', () => {
    const polarized = recommendations.find(
      (recommendation) => recommendation.kind === 'polarization'
    );
    expect(polarized?.action).toContain('الفئة الرافضة');
  });

  it('مرتبة بالأولوية تنازلياً', () => {
    recommendations.forEach((recommendation, index) => {
      if (index > 0) {
        expect(recommendations[index - 1].severity).toBeGreaterThanOrEqual(recommendation.severity);
      }
    });
  });

  it('الأولوية تطابق درجة الشدة', () => {
    recommendations.forEach((recommendation) => {
      if (recommendation.severity >= 80) expect(recommendation.priority).toBe('عاجلة');
      else if (recommendation.severity >= 60) expect(recommendation.priority).toBe('عالية');
      else if (recommendation.severity >= 40) expect(recommendation.priority).toBe('متوسطة');
      else expect(recommendation.priority).toBe('داعمة');
    });
  });

  it('المؤشر موحَّد على الوزن النسبي', () => {
    recommendations.forEach((recommendation) => {
      expect(recommendation.indicator).toBe('الوزن النسبي');
    });
  });

  it('الهدف رقمي وقابل للتحقق', () => {
    recommendations.forEach((recommendation) => {
      expect(recommendation.target).toMatch(/\d/);
    });
  });

  it('يلتقط شواهد من تعليقات المشاركين في المجال نفسه', () => {
    const withQuotes = recommendations.filter(
      (recommendation) => recommendation.quotes.length > 0
    );
    expect(withQuotes.length).toBeGreaterThan(0);
  });
});

/**
 * أهم ثابت في المحرك كله: لا رقم في نص التوصية بلا أصل في أدلتها.
 * تقرير رسمي يذكر نسبة لا مصدر لها أسوأ من تقرير بلا توصيات.
 */
describe('لا رقم بلا أصل', () => {
  const shapes: Array<[string, LevelCounts[]]> = [
    ['ضعف حاد', [[0, 0, 2, 8, 10]]],
    ['انقسام', [[8, 0, 4, 0, 8]]],
    ['ذيل سلبي', [[4, 6, 2, 4, 4]]],
    ['تميّز', [[16, 4, 0, 0, 0]]],
    ['مختلط', [
      [18, 12, 6, 4, 0],
      [4, 6, 6, 12, 12],
      [14, 4, 2, 8, 12],
      [3, 5, 6, 12, 14],
    ]],
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
    const report = toReport(analyseSurvey(survey, survey.genderKey));
    const audit = auditReport(report);
    const unsupported = audit.errors.filter(
      (issue) => issue.code === 'recommendation-unsupported-number'
    );
    expect(unsupported.map(formatAuditIssue)).toEqual([]);
    expect(audit.errors.map(formatAuditIssue)).toEqual([]);
  });
});

describe('نقاط القوة تُذكر ولا تُعدّد', () => {
  it('استبيان ممتاز في كل بنوده لا ينتج قائمة تهنئة', () => {
    const report = excellentReport();
    const recommendations = report.recommendations ?? [];
    const strengths = recommendations.filter(
      (recommendation) => recommendation.kind === 'strength'
    );
    expect(strengths.length).toBeLessThanOrEqual(MAX_STRENGTH_RECOMMENDATIONS);
    expect(strengths.length).toBeGreaterThan(0);
    expect(auditReport(report).errors).toEqual([]);
  });

  it('نقطة القوة تُوصي بالتوثيق والنشر لا بالإصلاح', () => {
    const strength = (excellentReport().recommendations ?? []).find(
      (recommendation) => recommendation.kind === 'strength'
    );
    expect(strength?.action).toContain('توثيق');
  });
});

describe('حتمية المخرجات', () => {
  it('تشغيلان على البيانات نفسها ينتجان التوصيات نفسها حرفياً', () => {
    const first = JSON.stringify(buildRecommendations(troubledReport()));
    const second = JSON.stringify(buildRecommendations(troubledReport()));
    expect(second).toBe(first);
  });

  it('تقرير بلا مشكلات ولا تميّز لا ينتج توصيات', () => {
    const survey = buildSurvey({
      patterns: [[0, 20, 20, 0, 0]], // 75% — لا ضعف ولا تميّز ولا انقسام
      withDemographics: false,
    });
    expect(buildRecommendations(toReport(analyseSurvey(survey)))).toEqual([]);
  });
});
