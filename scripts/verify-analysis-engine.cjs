/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const moduleCache = new Map();

function resolveLocalModule(fromFile, request) {
  const base = request.startsWith('@/')
    ? path.join(projectRoot, 'src', request.slice(2))
    : path.resolve(path.dirname(fromFile), request);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve ${request} from ${fromFile}`);
}

function loadTypeScriptModule(filename) {
  const absolute = path.resolve(projectRoot, filename);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;

  const module = { exports: {} };
  moduleCache.set(absolute, module);
  const source = fs.readFileSync(absolute, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: absolute,
  }).outputText;

  const localRequire = (request) => {
    if (request.startsWith('.') || request.startsWith('@/')) {
      return loadTypeScriptModule(resolveLocalModule(absolute, request));
    }
    return require(request);
  };

  const execute = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  execute(module.exports, localRequire, module, absolute, path.dirname(absolute));
  return module.exports;
}

const statistics = loadTypeScriptModule('src/lib/analysis/statistics.ts');
const analysis = loadTypeScriptModule('src/lib/analysis-utils.ts');
const comments = loadTypeScriptModule('src/lib/analysis/comments.ts');
const reportHelpers = loadTypeScriptModule('src/lib/pdf/report-helpers.ts');
const reportLayout = loadTypeScriptModule('src/lib/pdf/report-layout.ts');

assert.deepEqual(statistics.computeDescriptiveStats([1, 2, 3, 4]), {
  count: 4,
  sum: 10,
  mean: 2.5,
  stdDev: 1.29,
  median: 2.5,
  mode: 1,
});
assert.equal(statistics.detectScaleMax([1, 2, 4]), 5);
assert.equal(statistics.detectScaleMax([1, 2, 6]), 7);
assert.equal(statistics.detectScaleMax([1, 3], 5), 5);
assert.equal(statistics.reverseCode(1, 5), 5);
assert.equal(statistics.reverseCode(0, 10, 0), 10);
assert.equal(statistics.computeRelativeWeight(12, 4, 4), 75);

const perfectAlpha = statistics.computeCronbachAlpha([
  [1, 1, 1],
  [2, 2, 2],
  [3, 3, 3],
  [4, 4, 4],
]);
assert.equal(perfectAlpha.alpha, 1);
assert.equal(perfectAlpha.respondents, 4);

// ألفا المعياري لا يتأثر بكون بند على سُلَّم 3 وآخر على سُلَّم 5 ما داما
// يتحركان بالنمط نفسه.
const mixedScaleAlpha = statistics.computeCronbachAlpha([
  [1, 1],
  [2, 3],
  [3, 5],
]);
assert.equal(mixedScaleAlpha.alpha, 1);

const grouped = comments.aggregateAnswers('ملاحظات', ['لا يوجد', 'تحسين المعامل.', 'تحسين المعامل', '-']);
assert.equal(grouped.answers.length, 1);
assert.equal(grouped.answers[0].occurrences, 2);
assert.equal(grouped.skippedCount, 2);

const q1 = '2. جودة المحتوى';
const q2 = '3. وضوح الشرح';
const binary = '4. هل توصي بالبرنامج؟';
const rows = [
  { '1. النوع': 'ذكر', [q1]: 'موافق', [q2]: 'موافق', [binary]: 'نعم' },
  { '1. النوع': 'أنثى', [q1]: 'محايد', [q2]: 'محايد', [binary]: 'لا' },
  { '1. النوع': 'ذكر', [q1]: 'غير موافق', [q2]: 'غير موافق', [binary]: 'نعم' },
];
const optionMap = { موافق: 3, محايد: 2, 'غير موافق': 1 };
const processed = analysis.processData(
  rows,
  [{ name: 'التدريس', start: 2, end: 4, questionNumbers: [2, 3] }],
  { '1. النوع': 'radio', [q1]: 'likert', [q2]: 'likert', [binary]: 'yes_no' },
  [],
  {
    questionScaleMax: { [q1]: 3, [q2]: 3 },
    questionValueMaps: { [q1]: optionMap, [q2]: optionMap },
    comparisonColumn: '1. النوع',
  }
);

assert.equal(processed.results.length, 2);
assert.equal(processed.binaryResults.length, 1);
assert.equal(processed.results[0].scaleMax, 3);
assert.equal(processed.axes[0].count, 2);
assert.equal(processed.axes[0].cronbachAlpha, 1);
assert.equal(processed.overallCronbachAlpha, 1);
assert.equal(processed.comparison.rows.length, 2);

// بيانات قديمة تصف السُلَّم بأنه 3 بينما تحمل قيماً حتى 5: يجب إصلاح المقام
// وإصدار تحذير، ولا يجوز أن يتجاوز الوزن 100%.
const legacyQuestion = '2. سؤال قديم بسُلَّم متعارض';
const repairedLegacy = analysis.processData(
  [{ [legacyQuestion]: 5 }, { [legacyQuestion]: 4 }, { [legacyQuestion]: 3 }],
  [],
  { [legacyQuestion]: 'likert' },
  [],
  { questionScaleMax: { [legacyQuestion]: 3 } }
);
assert.equal(repairedLegacy.results[0].scaleMax, 5);
assert.equal(repairedLegacy.results[0].relativeWeight, 80);
assert.equal(repairedLegacy.analysisWarnings[0].code, 'scale-promoted');

const zeroBasedQuestion = '1. مقياس خطي يبدأ من صفر';
const zeroBased = analysis.processData(
  [{ [zeroBasedQuestion]: 0 }, { [zeroBasedQuestion]: 5 }, { [zeroBasedQuestion]: 10 }],
  [],
  { [zeroBasedQuestion]: 'linear_scale' },
  [],
  {
    questionScaleMin: { [zeroBasedQuestion]: 0 },
    questionScaleMax: { [zeroBasedQuestion]: 10 },
  }
);
assert.equal(zeroBased.results[0].scaleMin, 0);
assert.equal(zeroBased.results[0].mean, 5);
assert.equal(zeroBased.results[0].relativeWeight, 50);

// السُلَّم الثلاثي الحقيقي يبقى ثلاثياً عندما تكون خريطة البدائل 3،2،1.
assert.equal(processed.results[0].relativeWeight, 66.67);
assert.ok(processed.results.every((item) => item.relativeWeight <= 100));

const validReport = {
  title: 'تقرير تحقق', reportDate: '2026-08-24', surveyDate: '2026-08-01',
  results: repairedLegacy.results,
  resultsForAnalysis: repairedLegacy.resultsForAnalysis,
  overallAverage: repairedLegacy.overallAverage,
  axes: [], autoComment: '', manualComment: '',
  logos: { quality: '', university: '', college: '' }, signatures: [],
};
assert.equal(reportHelpers.validateReportData(validReport), true);
assert.equal(
  reportHelpers.validateReportData({
    ...validReport,
    results: [{ ...validReport.results[0], relativeWeight: 126 }],
  }),
  false
);

const compactProfile = reportLayout.getReportLayoutProfile({
  ...validReport,
  results: Array.from({ length: 60 }, (_, index) => ({
    ...validReport.results[0], questionNumber: index + 1, question: `سؤال طويل ${index}`,
  })),
});
assert.equal(compactProfile.density, 'compact');
const compactCommentsProfile = reportLayout.getReportLayoutProfile({
  ...validReport,
  results: Array.from({ length: 60 }, (_, index) => ({
    ...validReport.results[0], questionNumber: index + 1, question: `سؤال ${index}`,
  })),
  comments: [{
    question: 'تعليقات', totalResponses: 3, skippedCount: 0,
    answers: [{ text: 'تعليق قصير قابل للتوزيع.', occurrences: 1 }],
  }],
});
assert.equal(compactCommentsProfile.commentColumns, 3);
const longCommentProfile = reportLayout.getReportLayoutProfile({
  ...validReport,
  comments: [{
    question: 'تعليقات', totalResponses: 1, skippedCount: 0,
    answers: [{ text: 'ن'.repeat(500), occurrences: 1 }],
  }],
});
assert.equal(longCommentProfile.commentColumns, 1);

// عمود نصي لم يختره المستخدم في قائمة التعليقات يخرج من التقرير بالكامل —
// لا يُحسب كمياً ولا يُطبع كتعليق. أسماء المشاركين كانت تُطبع رغم إزالة علامة الصح.
const nameColumn = '1. الاسم';
const notesColumn = '5. ملاحظات';
const textRows = [
  { [nameColumn]: 'محمد علي', [notesColumn]: 'تطوير المعامل.', [q1]: 'موافق' },
  { [nameColumn]: 'سارة أحمد', [notesColumn]: 'زيادة التطبيقات العملية.', [q1]: 'محايد' },
];
const textTypes = { [nameColumn]: 'text', [notesColumn]: 'textarea', [q1]: 'likert' };

const withoutName = analysis.processData(textRows, [], textTypes, [notesColumn]);
assert.deepEqual(
  withoutName.comments.map((group) => group.question),
  [notesColumn]
);

const withName = analysis.processData(textRows, [], textTypes, [nameColumn, notesColumn]);
assert.deepEqual(
  withName.comments.map((group) => group.question),
  [nameColumn, notesColumn]
);

// بلا قائمة صريحة (مستدعٍ قديم) يبقى الاكتشاف التلقائي للأعمدة النصية
const autoDetected = analysis.processData(textRows, [], textTypes);
assert.deepEqual(
  autoDetected.comments.map((group) => group.question),
  [nameColumn, notesColumn]
);

console.log('Analysis engine verification passed.');
