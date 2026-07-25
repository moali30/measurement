import { Axis, QuestionResult, ReportData } from '@/types/analysis';

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

export function getWeightDistributionPieData(results: QuestionResult[]) {
  const dist = {
    high: results.filter((item) => item.relativeWeight >= 80).length,
    medium: results.filter((item) => item.relativeWeight >= 60 && item.relativeWeight < 80).length,
    low: results.filter((item) => item.relativeWeight < 60).length,
  };

  return [
    { name: 'مرتفع (>=80%)', value: dist.high, fill: '#4caf50' },
    { name: 'متوسط (60-80%)', value: dist.medium, fill: '#ffc107' },
    { name: 'منخفض (<60%)', value: dist.low, fill: '#f44336' },
  ].filter((item) => item.value > 0);
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
