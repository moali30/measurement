import {
  Axis,
  CategoryComparison,
  QuestionResult,
  ReportData,
} from '../types/analysis';
import { aggregateCommentGroups } from './analysis/comments';
import { NARRATIVE_THRESHOLDS, generateAxisComment } from './analysis/narrative';
import { ANALYSIS_SCALE } from './analysis/scale';
import {
  assignCompetitionRanks,
  computeCronbachAlpha,
  computeDescriptiveStats,
  computeDistribution,
  computeRelativeWeight,
  detectScaleMax,
  reverseCode,
} from './analysis/statistics';

/** ترجمة الاستجابات النصية العربية إلى قيم رقمية */
const LIKERT_MAP: Record<string, number> = {
  'موافق جداً': 5, 'موافق جدا': 5,
  'موافق': 4,
  'محايد': 3, 'إلى حد ما': 3,
  'غير موافق': 2,
  'غير موافق جداً': 1, 'غير موافق جدا': 1,
  'ممتاز': 5,
  'جيد جداً': 4, 'جيد جدا': 4,
  'جيد': 3,
  'مقبول': 2,
  'ضعيف': 1,
  'دائماً': 5, 'دائما': 5,
  'غالباً': 4, 'غالبا': 4,
  'أحياناً': 3, 'أحيانا': 3,
  'نادراً': 2, 'نادرا': 2,
  'أبداً': 1, 'أبدا': 1,
  'نعم': 5,
  'لا': 1,
};

/**
 * الاستجابات الثنائية. تُرصد عند التحويل لا بعده: قيمتا 1 و5 وحدهما لا تكفيان
 * للحكم بأن السؤال ثنائي، فقد يكون سؤالاً خماسياً اختار الجميع طرفيه.
 */
const BINARY_ANSWERS = new Set(['نعم', 'لا']);

/** أنواع الأسئلة التي لا تدخل التحليل الكمي أصلاً */
const NON_ANALYTIC_TYPES = ['radio', 'select', 'dropdown', 'multiple_choice', 'checkbox'];

export interface ProcessOptions {
  questionTypes?: Record<string, string>;
  commentQuestions?: string[];
  /** أسئلة يكون فيها أدنى تقدير هو الأفضل، فتُعاد ترميزها قبل الحساب */
  reversedQuestions?: string[];
  /** تثبيت السُّلَّم يدوياً بدل اكتشافه من البيانات */
  scaleMaxOverride?: number;
  /** توصيف السُّلَّم لكل سؤال كما هو مخزّن في النموذج */
  questionScaleMax?: Record<string, number>;
  /** ترميز خيارات السؤال بالترتيب المخزّن في النموذج */
  questionValueMaps?: Record<string, Record<string, number>>;
  /** عمود التصنيف الذي تُبنى عليه المقارنة بين الفئات */
  comparisonColumn?: string;
}

interface ParsedColumn {
  question: string;
  questionNumber: number;
  values: number[];
  /** قيمة كل مشارك في موضعه الأصلي؛ null للقيمة المفقودة أو غير الرقمية */
  rowValues: Array<number | null>;
  missing: number;
  /** كم قيمة جاءت من إجابة نعم/لا */
  binaryHits: number;
}

type ProcessResult = Pick<
  ReportData,
  | 'results'
  | 'resultsForAnalysis'
  | 'overallAverage'
  | 'axes'
  | 'autoComment'
  | 'comments'
  | 'binaryResults'
  | 'totalRespondents'
  | 'scaleMax'
  | 'overallCronbachAlpha'
  | 'cronbachRespondents'
  | 'comparison'
>;

/** يستخرج رقم السؤال من بادئة عنوان العمود، وإلا فترتيبه */
function questionNumberFrom(question: string, index: number): number {
  const match = question.match(/^(\d+)[.)\s]/);
  return match ? parseInt(match[1], 10) : index + 1;
}

/**
 * يقرأ كل أعمدة البيانات مرة واحدة: يفصل الأسئلة الكمية عن النصية، ويحوّل
 * الاستجابات النصية إلى أرقام، ويعدّ القيم المفقودة لكل سؤال.
 */
function parseColumns(
  data: Record<string, unknown>[],
  options: ProcessOptions
): { columns: ParsedColumn[]; commentGroups: { question: string; answers: string[] }[] } {
  const { questionTypes, commentQuestions } = options;
  const questions = Object.keys(data[0] || {});
  const columns: ParsedColumn[] = [];
  const commentGroups: { question: string; answers: string[] }[] = [];

  // قائمة أسئلة التعليقات تصل من واجهة مربّعات اختيار تعرض كل الأعمدة،
  // فوجودها — حتى فارغة — يعني أن المستخدم حسم أمر كل عمود. عمود نصي لم يختره
  // يجب ألّا يُطبع بتاتاً. بدون هذا التمييز كان عمود «الاسم» — وهو بلا قيم
  // رقمية — يسقط في الاستثناء أدناه وتُطبع أسماء المشاركين رغم إزالة علامة الصح.
  // غياب القائمة (undefined) يبقى على الاكتشاف التلقائي للمستدعين القدامى.
  const hasExplicitCommentSelection = Array.isArray(commentQuestions);

  questions.forEach((question, index) => {
    const qType = questionTypes?.[question];

    if (qType && NON_ANALYTIC_TYPES.includes(qType)) return;

    // سؤال حدّده المستخدم كتعليق — يخرج من التحليل الكمي كلياً
    if (commentQuestions?.includes(question)) {
      const texts = data
        .map((row) => row[question])
        .filter((v) => v !== undefined && v !== null && v !== '')
        .map((v) => String(v).trim());
      if (texts.length > 0) commentGroups.push({ question, answers: texts });
      return;
    }

    const values: number[] = [];
    const rowValues: Array<number | null> = [];
    const textAnswers: string[] = [];
    let missing = 0;
    let binaryHits = 0;

    data.forEach((row) => {
      const val = row[question];
      if (val === undefined || val === null || val === '') {
        missing += 1;
        rowValues.push(null);
        return;
      }

      if (typeof val === 'number') {
        if (qType === 'text' || qType === 'textarea') {
          textAnswers.push(String(val));
          rowValues.push(null);
        } else {
          values.push(val);
          rowValues.push(val);
        }
        return;
      }

      const cleanVal = String(val).trim();
      if (!cleanVal) {
        missing += 1;
        rowValues.push(null);
        return;
      }

      if (qType === 'text' || qType === 'textarea') {
        textAnswers.push(cleanVal);
        rowValues.push(null);
        return;
      }

      const mapped = options.questionValueMaps?.[question]?.[cleanVal] ?? LIKERT_MAP[cleanVal];
      if (mapped !== undefined) {
        values.push(mapped);
        rowValues.push(mapped);
        if (BINARY_ANSWERS.has(cleanVal)) binaryHits += 1;
        return;
      }

      const num = parseFloat(cleanVal);
      if (!Number.isNaN(num)) {
        values.push(num);
        rowValues.push(num);
      } else {
        textAnswers.push(cleanVal);
        rowValues.push(null);
      }
    });

    if (values.length > 0) {
      columns.push({
        question,
        questionNumber: questionNumberFrom(question, index),
        values,
        rowValues,
        missing,
        binaryHits,
      });
    } else if (textAnswers.length > 0 && !hasExplicitCommentSelection) {
      commentGroups.push({ question, answers: textAnswers });
    }
  });

  return { columns, commentGroups };
}

/** يحوّل عموداً مقروءاً إلى نتيجة سؤال كاملة الإحصاءات */
function buildQuestionResult(
  column: ParsedColumn,
  scaleMax: number,
  totalRespondents: number,
  isReversed: boolean
): QuestionResult {
  const values = isReversed
    ? column.values.map((v) => reverseCode(v, scaleMax))
    : column.values;

  const stats = computeDescriptiveStats(values);
  const isBinary = column.binaryHits > 0 && column.binaryHits === column.values.length;

  return {
    question: column.question,
    questionNumber: column.questionNumber,
    count: stats.count,
    mean: stats.mean,
    relativeWeight: computeRelativeWeight(stats.sum, stats.count, scaleMax),
    stdDev: stats.stdDev,
    median: stats.median,
    mode: stats.mode,
    missing: column.missing,
    responseRate:
      totalRespondents > 0
        ? parseFloat(((stats.count / totalRespondents) * 100).toFixed(2))
        : 0,
    scaleMax,
    distribution: computeDistribution(values, scaleMax),
    ...(isBinary ? { isBinary: true } : {}),
    ...(isReversed ? { isReversed: true } : {}),
  };
}

/**
 * النواة الحسابية: تُستدعى مرة للتقرير كله، ومرة لكل فئة عند بناء جدول المقارنة.
 * لذلك لا تعرف شيئاً عن المحاور ولا عن النصوص التفسيرية.
 */
interface ScoredColumn {
  result: QuestionResult;
  rowValues: Array<number | null>;
}

function reliabilityForColumns(columns: ScoredColumn[]) {
  if (columns.length < 2) return undefined;
  const rowCount = Math.max(0, ...columns.map((column) => column.rowValues.length));
  const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
    columns.map((column) => column.rowValues[rowIndex] ?? null)
  );
  return computeCronbachAlpha(rows);
}

function computeCore(
  data: Record<string, unknown>[],
  options: ProcessOptions,
  forcedScaleByQuestion?: Record<string, number>
) {
  const totalRespondents = data.length;
  const { columns, commentGroups } = parseColumns(data, options);

  const reversed = new Set(options.reversedQuestions ?? []);
  const scaleByQuestion: Record<string, number> = {};

  // السُّلَّم المُستنتَج يُحسب من كل الأسئلة مجتمعةً، لا من كل سؤال على حدة.
  // الاستنتاج لكل سؤال منفرداً كان يعطي كل سؤال مقاماً مختلفاً حسب أعلى إجابة
  // وصلته، فتصبح الأسئلة غير قابلة للمقارنة والترتيب والمتوسط العام بلا معنى.
  // الأسئلة الثنائية مستبعدة من الاستنتاج لأن مداها ليس مدى السُّلَّم.
  const pooledValues = columns
    .filter((column) => column.binaryHits !== column.values.length)
    .reduce<number[]>((all, column) => all.concat(column.values), []);
  const inferredScale = detectScaleMax(pooledValues, options.scaleMaxOverride);

  const scoredColumns: ScoredColumn[] = columns.map((column) => {
    // توصيف السؤال المخزَّن في النموذج هو المرجع الأدق؛ الاستنتاج آخر ملاذ
    const configuredScale =
      options.scaleMaxOverride ??
      forcedScaleByQuestion?.[column.question] ??
      options.questionScaleMax?.[column.question];
    const scaleMax = configuredScale && configuredScale > 1 ? configuredScale : inferredScale;
    const isReversed = reversed.has(column.question);
    scaleByQuestion[column.question] = scaleMax;

    return {
      result: buildQuestionResult(column, scaleMax, totalRespondents, isReversed),
      rowValues: column.rowValues.map((value) =>
        value !== null && isReversed ? reverseCode(value, scaleMax) : value
      ),
    };
  });

  const all = scoredColumns.map((column) => column.result);

  const results = all.filter((r) => !r.isBinary).sort((a, b) => a.questionNumber - b.questionNumber);
  const binaryResults = all.filter((r) => r.isBinary).sort((a, b) => a.questionNumber - b.questionNumber);
  const analyticColumns = scoredColumns.filter((column) => !column.result.isBinary);
  const reliability = reliabilityForColumns(analyticColumns);
  const scaleMax =
    results.length > 0
      ? Math.max(...results.map((result) => result.scaleMax))
      : ANALYSIS_SCALE.max;

  const totalWeight = results.reduce((sum, item) => sum + item.relativeWeight, 0);
  const overallAverage =
    results.length > 0 ? parseFloat((totalWeight / results.length).toFixed(2)) : 0;

  return {
    results,
    binaryResults,
    overallAverage,
    scaleMax,
    totalRespondents,
    commentGroups,
    scoredColumns: analyticColumns,
    scaleByQuestion,
    reliability,
  };
}

/**
 * يقارن المحاور بين فئات عمود تصنيفي واحد (النوع، المستوى، الشعبة…).
 * الفلاتر كانت تُستخدم لتقليص العينة فقط؛ هنا تُستخدم للمقارنة.
 */
function computeCategoryComparison(
  data: Record<string, unknown>[],
  axes: Axis[],
  options: ProcessOptions,
  scaleByQuestion: Record<string, number>
): CategoryComparison | undefined {
  const column = options.comparisonColumn;
  if (!column || axes.length === 0) return undefined;

  const groups = new Map<string, Record<string, unknown>[]>();
  data.forEach((row) => {
    const raw = row[column];
    if (raw === undefined || raw === null || raw === '') return;
    const key = String(raw).trim();
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  if (groups.size < 2) return undefined; // مقارنة فئة واحدة بلا معنى

  // عمود المقارنة نفسه يجب ألا يُحلَّل ككميّ داخل الفئات
  const scopedOptions: ProcessOptions = {
    ...options,
    comparisonColumn: undefined,
    questionTypes: { ...(options.questionTypes ?? {}), [column]: 'radio' },
  };

  const rows = Array.from(groups.entries()).map(([category, categoryRows]) => {
    const core = computeCore(categoryRows, scopedOptions, scaleByQuestion);
    const categoryAxes = processAxesAverages(core.results, axes);

    return {
      category,
      respondents: categoryRows.length,
      overallAverage: core.overallAverage,
      // نرتب حسب ترتيب المحاور في التقرير لا حسب ترتيب المتوسطات داخل الفئة
      axisAverages: axes.map((axis) => {
        const match = categoryAxes.find((a) => a.name === axis.name && a.start === axis.start);
        return match?.average ?? 0;
      }),
    };
  });

  rows.sort((a, b) => b.overallAverage - a.overallAverage);

  return { column, axisNames: axes.map((a) => a.name), rows };
}

export function processData(
  data: Record<string, unknown>[],
  currentAxes: Axis[],
  questionTypes?: Record<string, string>,
  commentQuestions?: string[],
  extraOptions?: Omit<ProcessOptions, 'questionTypes' | 'commentQuestions'>
): ProcessResult {
  const options: ProcessOptions = { questionTypes, commentQuestions, ...extraOptions };

  if (!data || data.length === 0) {
    return {
      results: [],
      resultsForAnalysis: [],
      overallAverage: 0,
      axes: currentAxes,
      autoComment: generateAutoComment([], 0, currentAxes),
      comments: [],
      binaryResults: [],
      totalRespondents: 0,
      scaleMax: undefined,
      overallCronbachAlpha: undefined,
      cronbachRespondents: undefined,
      comparison: undefined,
    };
  }

  const core = computeCore(data, options);

  const resultsForAnalysis = assignCompetitionRanks(core.results, (r) => r.relativeWeight);
  // الرتبة تُنسخ إلى الجدول المرتب برقم السؤال حتى يظهر العمودان متسقين
  const rankByQuestion = new Map(resultsForAnalysis.map((r) => [r.question, r.rank]));
  const results = core.results.map((r) => ({ ...r, rank: rankByQuestion.get(r.question) }));

  const axesWithAverages =
    currentAxes.length > 0 ? processAxesAverages(results, currentAxes) : currentAxes;
  const axes = axesWithAverages.map((axis) => {
    const axisColumns = core.scoredColumns.filter((column) => questionBelongsToAxis(column.result, axis));
    const reliability = reliabilityForColumns(axisColumns);
    return reliability
      ? {
          ...axis,
          cronbachAlpha: reliability.alpha,
          reliabilityRespondents: reliability.respondents,
        }
      : axis;
  });

  return {
    results,
    resultsForAnalysis,
    overallAverage: core.overallAverage,
    axes,
    autoComment: generateAutoComment(resultsForAnalysis, core.overallAverage, axes),
    comments: aggregateCommentGroups(core.commentGroups),
    binaryResults: core.binaryResults,
    totalRespondents: core.totalRespondents,
    scaleMax: core.scaleMax,
    overallCronbachAlpha: core.reliability?.alpha,
    cronbachRespondents: core.reliability?.respondents,
    comparison: computeCategoryComparison(data, axes, options, core.scaleByQuestion),
  };
}

function questionBelongsToAxis(item: QuestionResult, axis: Axis): boolean {
  if (axis.questionNumbers?.length) return axis.questionNumbers.includes(item.questionNumber);
  return item.questionNumber >= axis.start && item.questionNumber <= axis.end;
}

export function processAxesAverages(results: QuestionResult[], axes: Axis[]): Axis[] {
  const withAverages = axes.map((axis) => {
    const axisQuestions = results.filter((item) => questionBelongsToAxis(item, axis));
    const totalWeight = axisQuestions.reduce((sum, item) => sum + item.relativeWeight, 0);
    const average = parseFloat(
      (axisQuestions.length > 0 ? totalWeight / axisQuestions.length : 0).toFixed(2)
    );
    return { ...axis, average, count: axisQuestions.length };
  });

  return assignCompetitionRanks(withAverages, (axis) => axis.average);
}

export { generateAxisComment };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateAutoComment(results: QuestionResult[], average: number, axes: Axis[]): string {
  if (!results || results.length === 0) {
    return `
      <div class="detailed-analysis bg-green-50/50 border-r-4 border-green-700 p-4 rounded-xl my-4 text-gray-800 dark:text-gray-200 dark:bg-green-900/20">
        <h4 class="font-bold mb-2">تحليل النتائج</h4>
        <p>لم يتم العثور على بيانات أسئلة صالحة للتحليل. يرجى التأكد من أن الملف يحتوي على بيانات.</p>
      </div>`;
  }

  const highest = results[0];
  const lowest = results[results.length - 1];
  const strengths = results
    .filter((r) => r.relativeWeight >= NARRATIVE_THRESHOLDS.strength)
    .map((r) => r.questionNumber);
  const weaknesses = results.filter((r) => r.relativeWeight < NARRATIVE_THRESHOLDS.weakness);

  const perfComment = average >= 85 ? 'أداء متميز' : average >= 70 ? 'أداء جيد' : 'أداء يحتاج إلى تحسين';

  // أكثر الأسئلة تشتتاً — إشارة إلى انقسام في الرأي لا يظهره المتوسط وحده
  const mostDivisive = [...results].sort((a, b) => b.stdDev - a.stdDev)[0];

  let comment = `
    <div class="detailed-analysis bg-green-50/50 border-r-4 border-green-700 p-4 rounded-xl my-4 text-gray-800 dark:text-gray-200 dark:bg-green-900/20">
      <h4 class="font-bold mb-2">تحليل النتائج</h4>
      <p>بلغ المتوسط العام ${average}% مما يشير إلى ${perfComment}.</p>
      <p>أعلى سؤال تقييماً هو "${escapeHtml(highest.question)}" (رقم ${highest.questionNumber}) بنسبة ${highest.relativeWeight}%.</p>
      <p>أقل سؤال تقييماً هو "${escapeHtml(lowest.question)}" (رقم ${lowest.questionNumber}) بنسبة ${lowest.relativeWeight}%.</p>`;

  if (mostDivisive && mostDivisive.stdDev > 0) {
    comment += `<p>أكثر الأسئلة تبايناً في الآراء هو "${escapeHtml(mostDivisive.question)}" (انحراف معياري ${mostDivisive.stdDev})، مما يشير إلى تفاوت واضح في تقييم المشاركين له.</p>`;
  }

  if (strengths.length > 0) {
    comment += `<p><b>نقاط القوة (أعلى من ${NARRATIVE_THRESHOLDS.strength}%):</b> الأسئلة ${strengths.slice(0, 5).join(', ')}.</p>`;
  }
  if (weaknesses.length > 0) {
    comment += `<p><b>نقاط تحتاج لتحسين (أقل من ${NARRATIVE_THRESHOLDS.weakness}%):</b> الأسئلة ${weaknesses
      .slice(0, 5)
      .map((r) => r.questionNumber)
      .join(', ')}.</p>`;
  }

  if (axes.length > 0 && axes[0].average !== undefined) {
    const highestAxis = axes[0];
    const lowestAxis = axes[axes.length - 1];

    comment += `
      </div>
      <div class="detailed-analysis bg-indigo-50/50 border-r-4 border-indigo-700 p-4 rounded-xl my-4 text-gray-800 dark:text-gray-200 dark:bg-indigo-900/20">
        <h4 class="font-bold mb-2">تحليل مفصل للمحاور</h4>
        <p>بناءً على تحليل المحاور المحددة، تظهر النتائج التالية لأعلى محور وأقل محور:</p>

        <div class="flex justify-between my-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
          <div>
            <strong>${escapeHtml(highestAxis.name)}</strong>
            <div>متوسط الوزن النسبي: ${highestAxis.average?.toFixed(2)}%</div>
          </div>
          <div>الترتيب: ${highestAxis.rank}</div>
        </div>

        <div class="flex justify-between my-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
          <div>
            <strong>${escapeHtml(lowestAxis.name)}</strong>
            <div>متوسط الوزن النسبي: ${lowestAxis.average?.toFixed(2)}%</div>
          </div>
          <div>الترتيب: ${lowestAxis.rank}</div>
        </div>

        <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border-r-4 border-indigo-900 shadow-sm mt-4">
          <h5 class="font-bold mb-2">ملاحظات على المحاور:</h5>
          <p>محور "${escapeHtml(highestAxis.name)}" ${generateAxisComment(highestAxis.average || 0)}.</p>
          <p>محور "${escapeHtml(lowestAxis.name)}" ${generateAxisComment(lowestAxis.average || 0)}.</p>
        </div>
      </div>`;
  }

  if (weaknesses.length > 0) {
    comment += `
      <div class="detailed-analysis bg-blue-50/50 border-r-4 border-blue-700 p-4 rounded-xl my-4 text-gray-800 dark:text-gray-200 dark:bg-blue-900/20">
        <h4 class="font-bold mb-2 text-blue-800 dark:text-blue-400">التوصيات وخطة التحسين المبدئية</h4>
        <p class="mb-2">بناءً على النتائج التي حصلت على تقييم أقل من ${NARRATIVE_THRESHOLDS.weakness}%، نوصي بالآتي:</p>
        <ul class="list-disc list-inside space-y-1">
          ${weaknesses
            .slice(0, 5)
            .map(
              (r) =>
                `<li>مراجعة الأسباب المؤدية لتدني تقييم <strong>"${escapeHtml(r.question)}"</strong> (نسبة ${r.relativeWeight}%) ووضع خطة تصحيحية فورية.</li>`
            )
            .join('')}
        </ul>
      </div>`;
  }

  return comment;
}
