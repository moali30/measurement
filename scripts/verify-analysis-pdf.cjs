const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const output = path.resolve(process.argv[3] || 'tmp/pdfs/analysis-verification.pdf');

function svgDataUrl(label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="72"><rect width="180" height="72" rx="8" fill="${color}"/><text x="90" y="45" text-anchor="middle" font-family="Arial" font-size="22" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const results = Array.from({ length: 12 }, (_, index) => {
  const questionNumber = index + 1;
  const relativeWeight = 92 - questionNumber * 2;
  return {
    question: `السؤال التجريبي رقم ${questionNumber} حول جودة العملية التعليمية والخدمات المقدمة للطلاب`,
    questionNumber,
    count: 20,
    mean: Number((relativeWeight / 20).toFixed(2)),
    relativeWeight,
    rank: questionNumber,
    stdDev: 0.65,
    median: 4,
    mode: 4,
    missing: 0,
    responseRate: 100,
    scaleMax: 5,
    distribution: [
      { value: 5, count: 6, percentage: 30 },
      { value: 4, count: 8, percentage: 40 },
      { value: 3, count: 4, percentage: 20 },
      { value: 2, count: 2, percentage: 10 },
      { value: 1, count: 0, percentage: 0 },
    ],
  };
});

const report = {
  title: 'تقرير التحقق من تحليل الاستبيان',
  surveyDate: '2026-06-01',
  reportDate: '2026-08-18',
  results,
  resultsForAnalysis: results,
  overallAverage: 79,
  axes: [
    {
      name: 'جودة التدريس', start: 1, end: 6, questionNumbers: [1, 2, 3, 4, 5, 6],
      average: 85, count: 6, rank: 1, cronbachAlpha: 0.88, reliabilityRespondents: 20,
    },
    {
      name: 'الخدمات الطلابية', start: 7, end: 12, questionNumbers: [7, 8, 9, 10, 11, 12],
      average: 73, count: 6, rank: 2, cronbachAlpha: 0.81, reliabilityRespondents: 20,
    },
  ],
  autoComment: '<div><h4>تحليل النتائج</h4><p>تشير النتائج إلى مستوى جيد مع فرص واضحة للتحسين.</p></div>',
  manualComment: 'تم إعداد هذا التقرير للتحقق من تنسيق الصفحات والطباعة.',
  logos: {
    quality: svgDataUrl('QUALITY', '#1a237e'),
    university: svgDataUrl('UNIVERSITY', '#2e7d32'),
    college: svgDataUrl('COLLEGE', '#6a1b9a'),
  },
  signatures: [{ name: 'رئيس لجنة القياس والتقويم', url: svgDataUrl('SIGN', '#455a64') }],
  comments: [{
    question: 'ما أهم مقترحات التحسين؟',
    answers: [
      { text: 'زيادة التطبيقات العملية داخل المقررات.', occurrences: 4 },
      { text: 'تطوير التجهيزات داخل المعامل.', occurrences: 3 },
    ],
    totalResponses: 10,
    skippedCount: 3,
  }],
  filters: [],
  binaryResults: [{
    question: 'هل توصي بالبرنامج؟', questionNumber: 13, count: 20, mean: 4.2,
    relativeWeight: 84, stdDev: 1.6, median: 5, mode: 5, missing: 0,
    responseRate: 100, scaleMax: 5, isBinary: true,
    distribution: [
      { value: 5, count: 16, percentage: 80 },
      { value: 4, count: 0, percentage: 0 },
      { value: 3, count: 0, percentage: 0 },
      { value: 2, count: 0, percentage: 0 },
      { value: 1, count: 4, percentage: 20 },
    ],
  }],
  totalRespondents: 20,
  scaleMax: 5,
  overallCronbachAlpha: 0.86,
  cronbachRespondents: 20,
};

(async () => {
  const response = await fetch(`${baseUrl}/api/reports/analysis`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes);
  console.log(`PDF verification generated: ${output} (${bytes.length} bytes)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
