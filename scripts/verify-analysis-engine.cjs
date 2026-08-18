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

assert.deepEqual(statistics.computeDescriptiveStats([1, 2, 3, 4]), {
  count: 4,
  sum: 10,
  mean: 2.5,
  stdDev: 1.29,
  median: 2.5,
  mode: 1,
});
assert.equal(statistics.detectScaleMax([1, 2, 4]), 4);
assert.equal(statistics.detectScaleMax([1, 3], 5), 5);
assert.equal(statistics.reverseCode(1, 5), 5);
assert.equal(statistics.computeRelativeWeight(12, 4, 4), 75);

const perfectAlpha = statistics.computeCronbachAlpha([
  [1, 1, 1],
  [2, 2, 2],
  [3, 3, 3],
  [4, 4, 4],
]);
assert.equal(perfectAlpha.alpha, 1);
assert.equal(perfectAlpha.respondents, 4);

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

console.log('Analysis engine verification passed.');
