import { describe, expect, it } from 'vitest';
import { auditReport, formatAuditIssue } from '@/lib/analysis/audit';
import { validateReportData } from '@/lib/pdf/report-helpers';
import type { ReportData } from '@/types/analysis';
import { LevelCounts, analyseSurvey, buildSurvey, toReport } from './fixtures';

const PATTERNS: LevelCounts[] = [
  [18, 14, 6, 2, 0],
  [6, 8, 6, 10, 10],
  [14, 6, 2, 8, 10],
  [22, 12, 4, 2, 0],
];

function referenceReport(): ReportData {
  const survey = buildSurvey({
    patterns: PATTERNS,
    axes: [{ name: 'المحور', start: 1, end: 4, questionNumbers: [1, 2, 3, 4] }],
  });
  return toReport(analyseSurvey(survey, survey.genderKey));
}

describe('المدقّق على تقرير سليم', () => {
  const report = referenceReport();
  const audit = auditReport(report);

  it('لا يرصد أي خطأ', () => {
    expect(audit.errors.map(formatAuditIssue)).toEqual([]);
  });

  it('ينفّذ عدداً معتبراً من الفحوص', () => {
    expect(audit.checks).toBeGreaterThan(60);
  });

  it('بوابة الطباعة تقبله', () => {
    expect(validateReportData(report)).toBe(true);
  });
});

/**
 * الاختبار السلبي هو جوهر المنهجية: مدقّق لا يفشل أبداً لا يثبت سلامة الأرقام،
 * بل يثبت أنه لا يفحص شيئاً. نكسر كل ثابت على حدة ونتأكد أنه أمسكه بالاسم.
 */
describe('المدقّق يمسك كل خلل مصطنع', () => {
  const mutations: Array<[string, string, (report: ReportData) => void]> = [
    ['وزن نسبي معدَّل يدوياً', 'weight-mean-mismatch', (r) => { r.results[0].relativeWeight = 95; }],
    ['مؤشر معياري لا يطابق متوسطه', 'normalized-mean-mismatch', (r) => { r.results[0].normalizedScore = 10; }],
    ['متوسط خارج السُّلَّم', 'mean-out-of-scale', (r) => { r.results[0].mean = 7; }],
    ['سُلَّم مخالف للخماسي', 'scale-mismatch', (r) => { r.results[0].scaleMax = 3; }],
    ['الصالح + المفقود لا يساوي المشاركين', 'count-missing-mismatch', (r) => { r.results[0].missing += 3; }],
    ['نسبة اتجاه محرَّفة', 'shares-sum-mismatch', (r) => { r.results[0].positiveShare += 12; }],
    ['اتجاهات لا تطابق التوزيع', 'shares-distribution-mismatch', (r) => {
      r.results[0].negativeShare += 10;
      r.results[0].positiveShare -= 10;
    }],
    ['توزيع تكراري لا يجمع', 'distribution-count-mismatch', (r) => { r.results[0].distribution[0].count += 5; }],
    ['مستوى ناقص من التوزيع', 'distribution-levels-mismatch', (r) => { r.results[0].distribution.pop(); }],
    ['وسيط خارج السُّلَّم', 'median-out-of-scale', (r) => { r.results[0].median = 9; }],
    ['منوال خارج السُّلَّم', 'mode-out-of-scale', (r) => { r.results[0].mode = 0; }],
    ['انحراف مستحيل', 'stddev-implausible', (r) => { r.results[0].stdDev = 9; }],
    ['معدل استجابة لا يطابق العدد', 'response-rate-mismatch', (r) => { r.results[0].responseRate = 12; }],
    ['متوسط عام محرَّف', 'overall-average-mismatch', (r) => { r.overallAverage += 4; }],
    ['مؤشر عام محرَّف', 'overall-normalized-mismatch', (r) => { r.overallNormalized += 4; }],
    ['متوسط محور محرَّف', 'axis-average-mismatch', (r) => { r.axes[0].average = 12; }],
    ['مؤشر محور محرَّف', 'axis-normalized-mismatch', (r) => { r.axes[0].normalizedAverage = 12; }],
    ['عدد أسئلة المحور محرَّف', 'axis-count-mismatch', (r) => { r.axes[0].count = 99; }],
    ['محور لا يطابق أي سؤال', 'empty-axis', (r) => { r.axes[0].questionNumbers = [99]; }],
    ['رقم سؤال مكرر', 'duplicate-question-numbers', (r) => {
      r.results[1].questionNumber = r.results[0].questionNumber;
    }],
    ['رتبة تخالف الوزن', 'rank-inconsistent', (r) => { r.results[0].rank = 99; }],
    ['جدول ترتيب غير مرتب', 'ranking-not-sorted', (r) => { r.resultsForAnalysis.reverse(); }],
    ['جدول ترتيب ناقص', 'ranking-length-mismatch', (r) => { r.resultsForAnalysis.pop(); }],
    ['ألفا أكبر من واحد', 'alpha-above-one', (r) => { r.overallCronbachAlpha = 1.4; }],
    ['عينة ثبات أكبر من العيّنة', 'reliability-sample-too-large', (r) => { r.cronbachRespondents = 999; }],
    ['توصيف عيّنة لا يجمع', 'profile-count-mismatch', (r) => { r.sampleProfile![0].values[0].count += 7; }],
    ['توصيف عيّنة أكبر من العيّنة', 'profile-oversized', (r) => {
      r.sampleProfile![0].answered = 999;
      r.sampleProfile![0].values[0].count += 999 - r.sampleProfile![0].values.reduce((s, v) => s + v.count, 0);
    }],
    ['فئات مقارنة تتجاوز المشاركين', 'comparison-oversized', (r) => {
      r.comparison!.rows[0].respondents = 9999;
    }],
    ['عنوان مفقود', 'missing-title', (r) => { r.title = '   '; }],
  ];

  it.each(mutations)('يمسك: %s', (_label, code, mutate) => {
    const broken = structuredClone(referenceReport());
    mutate(broken);
    const audit = auditReport(broken);
    expect(audit.errors.map((issue) => issue.code)).toContain(code);
    expect(validateReportData(broken)).toBe(false);
  });
});

describe('ملاحظات قوة الدلالة لا تمنع الطباعة', () => {
  it('ترصد العيّنة الصغيرة بلا رفض', () => {
    // عيّنة صغيرة حقيقية لا تقرير كبير حُرّفت أعداده: التحريف يكسر ثوابت أخرى
    // فيتحول الاختبار إلى فحص للتحريف بدل فحص الملاحظة المقصودة.
    const small = buildSurvey({
      patterns: [
        [3, 2, 2, 1, 0],
        [1, 1, 2, 2, 2],
      ],
      withDemographics: false,
    });
    const audit = auditReport(toReport(analyseSurvey(small)));
    expect(audit.warnings.map((issue) => issue.code)).toContain('small-sample');
    expect(audit.errors).toEqual([]);
  });

  it('ترصد السؤال خارج كل المحاور', () => {
    const report = structuredClone(referenceReport());
    report.axes[0].questionNumbers = [1, 2];
    report.axes[0].count = 2;
    report.axes[0].average =
      Math.round(((report.results[0].relativeWeight + report.results[1].relativeWeight) / 2) * 100) / 100;
    report.axes[0].normalizedAverage =
      Math.round(((report.results[0].normalizedScore + report.results[1].normalizedScore) / 2) * 100) / 100;
    const audit = auditReport(report);
    expect(audit.warnings.map((issue) => issue.code)).toContain('question-without-axis');
    expect(audit.errors).toEqual([]);
  });
});
