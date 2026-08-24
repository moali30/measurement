const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const output = path.resolve(process.argv[3] || 'tmp/pdfs/analysis-verification.pdf');

function svgDataUrl(label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="72"><rect width="180" height="72" rx="8" fill="${color}"/><text x="90" y="45" text-anchor="middle" font-family="Arial" font-size="22" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const results = Array.from({ length: 28 }, (_, index) => {
  const questionNumber = index + 1;
  const relativeWeight = Number((91 - questionNumber * 0.75).toFixed(2));
  const scaleMax = questionNumber % 7 === 0 ? 3 : 5;
  const distribution = scaleMax === 3
    ? [
        { value: 3, count: 11, percentage: 55 },
        { value: 2, count: 7, percentage: 35 },
        { value: 1, count: 2, percentage: 10 },
      ]
    : [
        { value: 5, count: 6, percentage: 30 },
        { value: 4, count: 8, percentage: 40 },
        { value: 3, count: 4, percentage: 20 },
        { value: 2, count: 2, percentage: 10 },
        { value: 1, count: 0, percentage: 0 },
      ];

  return {
    question: `السؤال التجريبي رقم ${questionNumber} حول جودة العملية التعليمية والخدمات المقدمة للطلاب ومدى وضوح الإجراءات وسهولة تطبيقها`,
    questionNumber,
    count: 20,
    mean: Number(((relativeWeight / 100) * scaleMax).toFixed(2)),
    relativeWeight,
    rank: questionNumber,
    stdDev: 0.65,
    median: scaleMax === 3 ? 2 : 4,
    mode: scaleMax,
    missing: 0,
    responseRate: 100,
    scaleMax,
    distribution,
  };
});

const report = {
  title: 'تقرير التحقق من تحليل الاستبيان وتخطيط الصفحات الذكي',
  surveyDate: '2026-06-01',
  reportDate: '2026-08-24',
  results,
  resultsForAnalysis: results,
  overallAverage: 79.88,
  axes: [
    { name: 'القيادة والإدارة', start: 1, end: 4, questionNumbers: [1, 2, 3, 4], average: 88.5, count: 4, rank: 1, cronbachAlpha: 0.88, reliabilityRespondents: 20 },
    { name: 'التخطيط وإدارة أنشطة الجودة', start: 5, end: 8, questionNumbers: [5, 6, 7, 8], average: 85.5, count: 4, rank: 2, cronbachAlpha: 0.86, reliabilityRespondents: 20 },
    { name: 'نشر ثقافة الجودة وبناء القدرات', start: 9, end: 12, questionNumbers: [9, 10, 11, 12], average: 82.5, count: 4, rank: 3, cronbachAlpha: 0.84, reliabilityRespondents: 20 },
    { name: 'التواصل والعمل الجماعي', start: 13, end: 16, questionNumbers: [13, 14, 15, 16], average: 79.5, count: 4, rank: 4, cronbachAlpha: 0.82, reliabilityRespondents: 20 },
    { name: 'إدارة الوثائق والتقارير', start: 17, end: 20, questionNumbers: [17, 18, 19, 20], average: 76.5, count: 4, rank: 5, cronbachAlpha: 0.8, reliabilityRespondents: 20 },
    { name: 'المتابعة والتطوير المستمر', start: 21, end: 24, questionNumbers: [21, 22, 23, 24], average: 73.5, count: 4, rank: 6, cronbachAlpha: 0.79, reliabilityRespondents: 20 },
    { name: 'التقييم العام', start: 25, end: 28, questionNumbers: [25, 26, 27, 28], average: 70.5, count: 4, rank: 7, cronbachAlpha: 0.77, reliabilityRespondents: 20 },
  ],
  autoComment: '<div><h4>تحليل النتائج</h4><p>تشير النتائج إلى مستوى جيد مع فرص واضحة للتحسين، مع تقارب عام بين المحاور ووجود أولوية لتطوير إجراءات المتابعة وقياس أثر خطط التحسين.</p><p>تظهر البنود الأعلى اتساقاً في القيادة والتخطيط، بينما تحتاج البنود الأقل إلى تحليل أسباب ومؤشرات متابعة زمنية.</p></div>',
  manualComment: 'توصي اللجنة بربط كل إجراء تحسين بمسؤول تنفيذ ومؤشر قياس وموعد مراجعة، مع عرض التقدم بصورة دورية على مجلس إدارة الوحدة.',
  logos: {
    quality: svgDataUrl('QUALITY', '#1a237e'),
    university: svgDataUrl('UNIVERSITY', '#2e7d32'),
    college: svgDataUrl('COLLEGE', '#6a1b9a'),
  },
  signatures: [{ name: 'رئيس لجنة القياس والتقويم', url: svgDataUrl('SIGN', '#455a64') }],
  comments: [
    {
      question: 'ما أهم مقترحات التحسين؟',
      answers: [
        { text: 'زيادة التطبيقات العملية داخل المقررات.', occurrences: 4 },
        { text: 'تطوير التجهيزات داخل المعامل.', occurrences: 3 },
        { text: 'توضيح مسؤوليات التنفيذ ومواعيد المتابعة في خطة سنوية مختصرة يمكن لجميع الأطراف الرجوع إليها.', occurrences: 2 },
      ],
      totalResponses: 10,
      skippedCount: 3,
    },
    {
      question: 'ما أبرز نقاط القوة؟',
      answers: [
        { text: 'الاستجابة السريعة والتعاون والقدرة على إيجاد حلول عملية للمشكلات اليومية.', occurrences: 5 },
        { text: 'الالتزام والدقة في متابعة الوثائق والتواصل المستمر مع الأقسام العلمية.', occurrences: 4 },
        { text: 'دعم العمل الجماعي وتشجيع المبادرات التطويرية.', occurrences: 2 },
      ],
      totalResponses: 14,
      skippedCount: 3,
    },
    {
      question: 'ما الجوانب التي تحتاج إلى تحسين؟',
      answers: [
        { text: 'زيادة سرعة اتخاذ القرار في الحالات العاجلة مع توثيق سبب القرار والجهة المسؤولة عن المتابعة.', occurrences: 3 },
        { text: 'توزيع المهام بصورة أوضح لتجنب تكرار العمل وإعادة إعداد المستندات أكثر من مرة.', occurrences: 2 },
        { text: 'إعلان نتائج المتابعة ومؤشرات الإنجاز بصورة دورية ومختصرة.', occurrences: 1 },
      ],
      totalResponses: 9,
      skippedCount: 3,
    },
  ],
  filters: [],
  binaryResults: [{
    question: 'هل توصي بالبرنامج؟', questionNumber: 29, count: 20, mean: 4.2,
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
  analysisWarnings: [{
    code: 'scale-promoted',
    questionNumber: 7,
    question: results[6].question,
    message: 'اكتشف اختبار التحقق وصفاً قديماً للسُلَّم وتمت مواءمته مع القيم المرصودة قبل الحساب.',
  }],
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
