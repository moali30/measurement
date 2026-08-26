/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * تدقيق محرك التحليل — يُشغَّل بـ `npm run verify:analysis`.
 *
 * ثلاث طبقات مرتبة من الأضيق إلى الأوسع:
 *   ١) عيّنة ذهبية محسوبة بالورقة، رقماً برقم.
 *   ٢) ثوابت يجب أن تصح على أي بيانات، تُختبر بالمسح لا بمثال واحد.
 *   ٣) اختبار سلبي للمدقّق نفسه: نكسر كل ثابت عمداً ونتأكد أنه أمسكه.
 *
 * الطبقة الثالثة هي الأهم: مدقّق لا يفشل أبداً لا يثبت أن الأرقام سليمة،
 * بل يثبت أنه لا يفحص شيئاً.
 */
const assert = require('node:assert/strict');
const { loadTypeScriptModule } = require('./load-ts.cjs');

const statistics = loadTypeScriptModule('src/lib/analysis/statistics.ts');
const analysis = loadTypeScriptModule('src/lib/analysis-utils.ts');
const comments = loadTypeScriptModule('src/lib/analysis/comments.ts');
const scale = loadTypeScriptModule('src/lib/analysis/scale.ts');
const auditModule = loadTypeScriptModule('src/lib/analysis/audit.ts');
const reportHelpers = loadTypeScriptModule('src/lib/pdf/report-helpers.ts');
const reportLayout = loadTypeScriptModule('src/lib/pdf/report-layout.ts');

const { ANALYSIS_SCALE } = scale;
const LABELS = ['موافق جداً', 'موافق', 'محايد', 'غير موافق', 'غير موافق جداً'];
const VALUE_MAP = Object.fromEntries(LABELS.map((label, index) => [label, 5 - index]));

/** يبني صفوف استجابات من أعداد لكل بديل: counts[i] عدد من اختار LABELS[i] */
function rowsFromCounts(question, counts) {
  const rows = [];
  counts.forEach((count, level) => {
    for (let i = 0; i < count; i += 1) rows.push({ [question]: LABELS[level] });
  });
  return rows;
}

function likertOptions(question, extra = {}) {
  return {
    questionOptionCounts: { [question]: 5 },
    questionValueMaps: { [question]: VALUE_MAP },
    ...extra,
  };
}

function analyseOne(question, counts, extra = {}) {
  return analysis.processData(
    rowsFromCounts(question, counts),
    [],
    { [question]: 'likert' },
    [],
    likertOptions(question, extra)
  );
}

// ============================================================
// ١) الدوال الإحصائية الخام
// ============================================================

assert.deepEqual(statistics.computeDescriptiveStats([1, 2, 3, 4]), {
  count: 4,
  sum: 10,
  mean: 2.5,
  stdDev: 1.29,
  median: 2.5,
  mode: 1,
});

assert.equal(statistics.reverseCode(1, 5, 1), 5);
assert.equal(statistics.reverseCode(5, 5, 1), 1);
assert.equal(statistics.computeRelativeWeight(39, 10, 5), 78);
assert.equal(statistics.computeNormalizedScore(3.9, 1, 5), 72.5);
assert.equal(statistics.computeNormalizedScore(3, 1, 5), 50);
assert.equal(statistics.computeNormalizedScore(1, 1, 5), 0);
assert.equal(statistics.computeNormalizedScore(5, 1, 5), 100);

const perfectAlpha = statistics.computeCronbachAlpha([
  [1, 1, 1],
  [2, 2, 2],
  [3, 3, 3],
  [4, 4, 4],
]);
assert.equal(perfectAlpha.alpha, 1);
assert.equal(perfectAlpha.respondents, 4);

const grouped = comments.aggregateAnswers('ملاحظات', [
  'لا يوجد',
  'تحسين المعامل.',
  'تحسين المعامل',
  '-',
]);
assert.equal(grouped.answers.length, 1);
assert.equal(grouped.answers[0].occurrences, 2);
assert.equal(grouped.skippedCount, 2);

// ============================================================
// ٢) العيّنة الذهبية — محسوبة بالورقة
//    ١٠ مشاركين: ٣ موافق جداً، ٤ موافق، ٢ محايد، ١ غير موافق
//    المجموع 39 · المتوسط 3.9 · الوزن 39÷50=78% · المعياري (3.9-1)÷4=72.5
// ============================================================

const golden = analyseOne('1. المحاضر يشرح بوضوح', [3, 4, 2, 1, 0]).results[0];
assert.equal(golden.count, 10);
assert.equal(golden.mean, 3.9);
assert.equal(golden.relativeWeight, 78);
assert.equal(golden.normalizedScore, 72.5);
assert.equal(golden.negativeShare, 10);
assert.equal(golden.neutralShare, 20);
assert.equal(golden.positiveShare, 70);

// ============================================================
// ٣) الحدود ومعناها المنطوق
// ============================================================

const worst = analyseOne('1. س', [0, 0, 0, 0, 8]).results[0];
assert.equal(worst.relativeWeight, 20, 'أسوأ تقييم ممكن أرضيته 20% لا صفر');
assert.equal(worst.normalizedScore, 0, 'المؤشر المعياري أرضيته صفر حقيقي');

const best = analyseOne('1. س', [8, 0, 0, 0, 0]).results[0];
assert.equal(best.relativeWeight, 100);
assert.equal(best.normalizedScore, 100);

const neutral = analyseOne('1. س', [0, 0, 10, 0, 0]).results[0];
assert.equal(neutral.relativeWeight, 60, 'الحياد التام يساوي 60% بالوزن النسبي');
assert.equal(neutral.normalizedScore, 50, 'والحياد التام يساوي 50 بالمؤشر المعياري');

// ============================================================
// ٤) الانقسام لا يظهر في المتوسط — وهو سبب وجود قسم مستقل له
// ============================================================

const split = analyseOne('1. س', [5, 0, 0, 0, 5]);
assert.equal(split.results[0].mean, neutral.mean);
assert.equal(split.results[0].relativeWeight, neutral.relativeWeight);
assert.equal(split.results[0].normalizedScore, neutral.normalizedScore);
assert.ok(split.results[0].stdDev > 2, 'الانقسام يظهر في التشتت وحده');
assert.equal(analysis.getPolarizedQuestions(split.results).length, 1);
assert.equal(analysis.getPolarizedQuestions([neutral]).length, 0);

// ============================================================
// ٥) عكس الترميز
// ============================================================

const reversedQuestion = '1. أواجه صعوبة في المقرر';
const reversed = analysis.processData(
  rowsFromCounts(reversedQuestion, [0, 0, 0, 0, 7]),
  [],
  { [reversedQuestion]: 'likert' },
  [],
  likertOptions(reversedQuestion, { reversedQuestions: [reversedQuestion] })
);
assert.equal(reversed.results[0].mean, 5, 'أدنى إجابة تصبح أعلى درجة بعد العكس');
assert.equal(reversed.results[0].relativeWeight, 100);

// ============================================================
// ٦) الحراسة: السُّلَّم قرار معلن لا قيمة تُستنتج
// ============================================================

const outOfScale = analysis.processData(
  [{ '1. س': 7 }, { '1. س': 3 }],
  [],
  { '1. س': 'likert' },
  [],
  { questionOptionCounts: { '1. س': 5 } }
);
assert.deepEqual(
  outOfScale.analysisErrors.map((error) => error.code),
  ['values-out-of-scale']
);
assert.equal(outOfScale.results.length, 0, 'الخطأ يوقف التقرير ولا يُنتج نتائج جزئية');

const badLikert = analysis.processData(
  rowsFromCounts('1. س', [1, 1, 1, 0, 0]),
  [],
  { '1. س': 'likert' },
  [],
  { questionOptionCounts: { '1. س': 3 }, questionValueMaps: { '1. س': VALUE_MAP } }
);
assert.deepEqual(
  badLikert.analysisErrors.map((error) => error.code),
  ['non-standard-likert']
);

// ============================================================
// ٧) المتغيرات الديموغرافية توصف ولا تُقيَّم
// ============================================================

const demoRows = rowsFromCounts('1. س', [4, 4, 0, 0, 0]).map((row, index) => ({
  ...row,
  '2. النوع': index % 2 === 0 ? 'ذكر' : 'أنثى',
  '3. هل حضرت الورشة': index < 6 ? 'نعم' : 'لا',
}));
const withDemographics = analysis.processData(
  demoRows,
  [],
  { '1. س': 'likert', '2. النوع': 'radio', '3. هل حضرت الورشة': 'yes_no' },
  [],
  likertOptions('1. س')
);
assert.equal(withDemographics.results.length, 1, 'نعم/لا لا يدخل التحليل الكمي');
assert.equal(withDemographics.sampleProfile.length, 2);
const yesNoGroup = withDemographics.sampleProfile.find(
  (group) => group.column === '3. هل حضرت الورشة'
);
assert.deepEqual(
  yesNoGroup.values.map((value) => [value.label, value.count]),
  [
    ['نعم', 6],
    ['لا', 2],
  ]
);

// ============================================================
// ٨) ثوابت تُختبر بالمسح لا بمثال واحد
// ============================================================

let worstTransformGap = 0;
const RESPONDENTS = 6;
for (let a = 0; a <= RESPONDENTS; a += 1) {
  for (let b = 0; b <= RESPONDENTS - a; b += 1) {
    for (let c = 0; c <= RESPONDENTS - a - b; c += 1) {
      const d = RESPONDENTS - a - b - c;
      const item = analyseOne('1. س', [a, b, c, d, 0]).results[0];

      // المتوسط داخل السُّلَّم
      assert.ok(item.mean >= ANALYSIS_SCALE.min && item.mean <= ANALYSIS_SCALE.max);
      // الوزن النسبي بين الأرضية والسقف
      assert.ok(item.relativeWeight >= 20 - 0.01 && item.relativeWeight <= 100);
      // المؤشر المعياري بين صفر ومئة
      assert.ok(item.normalizedScore >= 0 && item.normalizedScore <= 100);
      // مجموع التوزيع يساوي عدد الاستجابات الصالحة
      assert.equal(
        item.distribution.reduce((sum, slice) => sum + slice.count, 0),
        item.count
      );
      // مجموع نسب الاتجاهات مئة
      assert.ok(
        Math.abs(item.negativeShare + item.neutralShare + item.positiveShare - 100) < 0.06
      );
      // العكس مرتين يعيد القيمة الأصلية
      assert.equal(statistics.reverseCode(statistics.reverseCode(item.mode, 5, 1), 5, 1), item.mode);

      // التحويل بين المؤشرين خطي: المعياري = الوزن × 1.25 − 25
      worstTransformGap = Math.max(
        worstTransformGap,
        Math.abs(item.relativeWeight * 1.25 - 25 - item.normalizedScore)
      );
    }
  }
}
assert.ok(
  worstTransformGap < 0.05,
  `فارق التحويل الخطي ${worstTransformGap} تجاوز هامش التقريب — المؤشر يُحسب من مصدر آخر`
);

// ============================================================
// ٩) اتساق المحاور مع المتوسط العام
// ============================================================

const q1 = '1. أ';
const q2 = '2. ب';
const axisRows = rowsFromCounts(q1, [4, 2, 2, 0, 0]).map((row, index) => ({
  ...row,
  ...rowsFromCounts(q2, [0, 2, 4, 2, 0])[index],
}));
const withAxis = analysis.processData(
  axisRows,
  [{ name: 'المحور الأول', start: 1, end: 2, questionNumbers: [1, 2] }],
  { [q1]: 'likert', [q2]: 'likert' },
  [],
  {
    questionOptionCounts: { [q1]: 5, [q2]: 5 },
    questionValueMaps: { [q1]: VALUE_MAP, [q2]: VALUE_MAP },
  }
);
const expectedAxisAverage =
  Math.round(
    ((withAxis.results[0].relativeWeight + withAxis.results[1].relativeWeight) / 2) * 100
  ) / 100;
assert.equal(withAxis.axes[0].average, expectedAxisAverage);
assert.equal(withAxis.overallAverage, expectedAxisAverage);

// ============================================================
// ١١) المدقّق: يمر على السليم، ويمسك كل خلل مصطنع
// ============================================================

function buildReport(questionCounts, axes = []) {
  const total = questionCounts[0].reduce((sum, count) => sum + count, 0);
  const rows = [];
  for (let person = 0; person < total; person += 1) {
    const row = { 'ز. النوع': person % 2 ? 'ذكر' : 'أنثى' };
    questionCounts.forEach((counts, index) => {
      let remaining = person;
      let choice = LABELS[LABELS.length - 1];
      for (let level = 0; level < counts.length; level += 1) {
        if (remaining < counts[level]) {
          choice = LABELS[level];
          break;
        }
        remaining -= counts[level];
      }
      row[`${index + 1}. سؤال ${index + 1}`] = choice;
    });
    rows.push(row);
  }

  const types = { 'ز. النوع': 'radio' };
  const optionCounts = {};
  const valueMaps = {};
  questionCounts.forEach((_, index) => {
    const key = `${index + 1}. سؤال ${index + 1}`;
    types[key] = 'likert';
    optionCounts[key] = 5;
    valueMaps[key] = VALUE_MAP;
  });

  const processed = analysis.processData(rows, axes, types, [], {
    questionOptionCounts: optionCounts,
    questionValueMaps: valueMaps,
  });
  assert.equal(processed.analysisErrors.length, 0);

  return {
    title: 'تقرير تحقق',
    surveyDate: '2026-08-01',
    reportDate: '2026-08-24',
    manualComment: '',
    autoComment: '',
    logos: { quality: '', university: '', college: '' },
    signatures: [],
    ...processed,
  };
}

const cleanReport = buildReport(
  [
    [18, 14, 6, 2, 0],
    [6, 8, 6, 10, 10],
    [14, 6, 2, 8, 10],
    [22, 12, 4, 2, 0],
  ],
  [{ name: 'المحور', start: 1, end: 4, questionNumbers: [1, 2, 3, 4] }]
);

const cleanAudit = auditModule.auditReport(cleanReport);
assert.equal(
  cleanAudit.errors.length,
  0,
  `تقرير سليم رُصدت فيه أخطاء: ${cleanAudit.errors.map(auditModule.formatAuditIssue).join(' | ')}`
);
assert.ok(cleanAudit.checks > 60, 'عدد الفحوص أقل من المتوقع — هل سقطت مجموعة ثوابت؟');
assert.equal(reportHelpers.validateReportData(cleanReport), true);

/** كل سطر: وصف الخلل، ورمز الخطأ الذي يجب أن يمسكه المدقّق، وكيفية إحداثه */
const mutations = [
  ['وزن نسبي معدَّل يدوياً', 'weight-mean-mismatch', (r) => { r.results[0].relativeWeight = 95; }],
  ['مؤشر معياري لا يطابق متوسطه', 'normalized-mean-mismatch', (r) => { r.results[0].normalizedScore = 10; }],
  ['متوسط خارج السُّلَّم', 'mean-out-of-scale', (r) => { r.results[0].mean = 7; }],
  ['سُلَّم مخالف للخماسي', 'scale-mismatch', (r) => { r.results[0].scaleMax = 3; }],
  ['الصالح + المفقود لا يساوي المشاركين', 'count-missing-mismatch', (r) => { r.results[0].missing += 3; }],
  ['نسبة اتجاه محرَّفة', 'shares-sum-mismatch', (r) => { r.results[0].positiveShare += 12; }],
  ['توزيع تكراري لا يجمع', 'distribution-count-mismatch', (r) => { r.results[0].distribution[0].count += 5; }],
  ['وسيط خارج السُّلَّم', 'median-out-of-scale', (r) => { r.results[0].median = 9; }],
  ['انحراف مستحيل', 'stddev-implausible', (r) => { r.results[0].stdDev = 9; }],
  ['معدل استجابة لا يطابق العدد', 'response-rate-mismatch', (r) => { r.results[0].responseRate = 12; }],
  ['متوسط عام محرَّف', 'overall-average-mismatch', (r) => { r.overallAverage += 4; }],
  ['مؤشر عام محرَّف', 'overall-normalized-mismatch', (r) => { r.overallNormalized += 4; }],
  ['متوسط محور محرَّف', 'axis-average-mismatch', (r) => { r.axes[0].average = 12; }],
  ['عدد أسئلة المحور محرَّف', 'axis-count-mismatch', (r) => { r.axes[0].count = 99; }],
  ['رقم سؤال مكرر', 'duplicate-question-numbers', (r) => { r.results[1].questionNumber = r.results[0].questionNumber; }],
  ['رتبة تخالف الوزن', 'rank-inconsistent', (r) => { r.results[0].rank = 99; }],
  ['جدول ترتيب غير مرتب', 'ranking-not-sorted', (r) => { r.resultsForAnalysis.reverse(); }],
  ['ألفا أكبر من واحد', 'alpha-above-one', (r) => { r.overallCronbachAlpha = 1.4; }],
  ['توصيف عيّنة لا يجمع', 'profile-count-mismatch', (r) => { r.sampleProfile[0].values[0].count += 7; }],
];

mutations.forEach(([label, code, mutate]) => {
  const broken = structuredClone(cleanReport);
  mutate(broken);
  const audit = auditModule.auditReport(broken);
  assert.ok(
    audit.errors.some((issue) => issue.code === code),
    `المدقّق لم يمسك «${label}» — المتوقع ${code}، والمرصود: ` +
      `${audit.errors.map((issue) => issue.code).join(', ') || 'لا شيء'}`
  );
  assert.equal(
    reportHelpers.validateReportData(broken),
    false,
    `بوابة الطباعة قبلت تقريراً مكسوراً: ${label}`
  );
});

// ملاحظات قوة الدلالة لا تمنع الطباعة
const smallSample = structuredClone(cleanReport);
smallSample.totalRespondents = 8;
smallSample.results.forEach((item) => {
  item.missing = 8 - item.count;
});
const smallAudit = auditModule.auditReport(smallSample);
assert.ok(smallAudit.warnings.some((issue) => issue.code === 'small-sample'));

// ============================================================
// ١٢) اختيار كثافة التخطيط ومسار التعليقات
// ============================================================

const layoutBase = {
  ...cleanReport,
  results: Array.from({ length: 60 }, (_, index) => ({
    ...cleanReport.results[0],
    questionNumber: index + 1,
    question: `سؤال طويل ${index}`,
  })),
};
assert.equal(reportLayout.getReportLayoutProfile(layoutBase).density, 'compact');
assert.equal(
  reportLayout.getReportLayoutProfile({
    ...cleanReport,
    comments: [
      {
        question: 'تعليقات',
        totalResponses: 1,
        skippedCount: 0,
        answers: [{ text: 'ن'.repeat(500), occurrences: 1 }],
      },
    ],
  }).commentColumns,
  1
);

const nameColumn = '1. الاسم';
const notesColumn = '5. ملاحظات';
const textRows = [
  { [nameColumn]: 'محمد علي', [notesColumn]: 'تطوير المعامل بشكل عاجل وواضح.', '2. س': 'موافق' },
  { [nameColumn]: 'سارة أحمد', [notesColumn]: 'زيادة التطبيقات العملية للمقررات.', '2. س': 'محايد' },
];
const textTypes = { [nameColumn]: 'text', [notesColumn]: 'textarea', '2. س': 'likert' };
const withoutName = analysis.processData(textRows, [], textTypes, [notesColumn], {
  questionOptionCounts: { '2. س': 5 },
  questionValueMaps: { '2. س': VALUE_MAP },
});
assert.deepEqual(
  withoutName.comments.map((group) => group.question),
  [notesColumn],
  'عمود لم يختره المستخدم يجب ألا يُطبع كتعليق'
);

console.log(
  `Analysis engine verification passed — ${cleanAudit.checks} فحصاً على تقرير المرجع، ` +
    `و${mutations.length} خللاً مصطنعاً أُمسك كاملاً.`
);
