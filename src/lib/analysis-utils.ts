import {
  AnalysisError,
  AnalysisWarning,
  Axis,
  CategoryComparison,
  QuestionResult,
  ReportData,
  SampleProfileGroup,
} from '../types/analysis';
import type { Recommendation } from './analysis/recommendations';
import { aggregateCommentGroups } from './analysis/comments';
import { NARRATIVE_THRESHOLDS, generateAxisComment } from './analysis/narrative';
import { ANALYSIS_SCALE, POLARIZATION } from './analysis/scale';
import { buildRecommendations } from './analysis/recommendations';
import {
  assignCompetitionRanks,
  computeCronbachAlpha,
  computeDescriptiveStats,
  computeDistribution,
  computeNormalizedScore,
  computeOpinionShares,
  computeRelativeWeight,
  reverseCode,
} from './analysis/statistics';

/**
 * ترجمة الاستجابات النصية العربية إلى قيم رقمية.
 *
 * «نعم» و«لا» ليستا هنا عمداً: السؤال ذو الإجابتين ليس مقياس ليكرت، وترميزه
 * 5 و1 كان يُدخله التحليل الكمي كأنه سؤال خماسي متطرف. صار متغيراً ديموغرافياً
 * يوصَف في جدول العيّنة ويصلح للمقارنة بين الفئات.
 */
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
};

/** النوع الوحيد الذي يدخل التحليل الكمي */
const LIKERT_TYPE = 'likert';

/** أنواع تصف العيّنة ولا تُقيَّم: تدخل جدول التوصيف والفلترة والمقارنة */
const DEMOGRAPHIC_TYPES = [
  'radio',
  'select',
  'dropdown',
  'multiple_choice',
  'checkbox',
  'yes_no',
];

/** أنواع كمية لكنها ليست ليكرت — خارج التحليل مع توثيق الاستبعاد */
const EXCLUDED_TYPES = ['rating', 'linear_scale', 'number', 'date', 'file', 'matrix'];

const TEXT_TYPES = ['text', 'textarea'];

/**
 * أقصى نسبة قيم خارج المقياس يحتملها عمود قبل أن نحكم بأنه ليس سؤال ليكرت.
 *
 * ملف النتائج المصدَّر يحمل عمود ترقيم وعمود تاريخ. أرقام الترقيم تتجاوز
 * الخمسة، وقيم التاريخ أرقام تسلسلية كبيرة، فكان رفض التقرير بسببهما يجعل كل
 * ملف تصدير غير قابل للتحليل. والتمييز بسيط: سؤال ليكرت فيه قيم فاسدة تبقى
 * أغلب قيمه صالحة، أما عمود ليس سؤالاً فأغلب قيمه خارج المقياس أو كلها.
 *
 * لا ينطبق هذا على عمود أُعلن نوعه `likert` في النموذج: الإعلان يقين، فأي قيمة
 * خارج المقياس فيه خلل في البيانات يوقف التقرير.
 */
const MAX_OUT_OF_SCALE_SHARE = 0.2;

/** أقصى عدد فئات يجعل عموداً نصياً في ملف Excel متغيراً ديموغرافياً لا تعليقاً */
const MAX_DEMOGRAPHIC_CATEGORIES = 12;
const MAX_DEMOGRAPHIC_LABEL_LENGTH = 40;

export interface ProcessOptions {
  questionTypes?: Record<string, string>;
  commentQuestions?: string[];
  /** أسئلة يكون فيها أدنى تقدير هو الأفضل، فتُعاد ترميزها قبل الحساب */
  reversedQuestions?: string[];
  /** عدد بدائل كل سؤال ليكرت كما هو مخزّن في النموذج — للتحقق لا للحساب */
  questionOptionCounts?: Record<string, number>;
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
  /** قيم رقمية وقعت خارج المقياس الخماسي — تمنع إنتاج التقرير */
  outOfScale: number[];
}

interface ParsedData {
  columns: ParsedColumn[];
  commentGroups: { question: string; answers: string[] }[];
  demographics: SampleProfileGroup[];
  /** أعمدة رقمية استُبعدت لأنها ليست أسئلة ليكرت أصلاً */
  nonQuestionColumns: string[];
}

export interface ProcessResult {
  results: QuestionResult[];
  resultsForAnalysis: QuestionResult[];
  overallAverage: number;
  overallNormalized: number;
  axes: Axis[];
  autoComment: string;
  comments: ReportData['comments'];
  sampleProfile: SampleProfileGroup[];
  totalRespondents: number;
  overallCronbachAlpha?: number;
  cronbachRespondents?: number;
  comparison?: CategoryComparison;
  recommendations: Recommendation[];
  analysisWarnings: AnalysisWarning[];
  /** أخطاء توقف إنتاج التقرير — تُعرض للمستخدم ولا تُحفظ في التقرير */
  analysisErrors: AnalysisError[];
}

/** يستخرج رقم السؤال من بادئة عنوان العمود، وإلا فترتيبه */
function questionNumberFrom(question: string, index: number): number {
  const match = question.match(/^(\d+)[.)\s]/);
  return match ? parseInt(match[1], 10) : index + 1;
}

function stripNumberPrefix(question: string): string {
  return question.replace(/^\d+\.\s*/, '');
}

/** يبني توصيف فئة واحدة من قيم عمود ديموغرافي */
function buildDemographicGroup(
  question: string,
  rawValues: string[]
): SampleProfileGroup | undefined {
  if (rawValues.length === 0) return undefined;

  const counts = new Map<string, number>();
  rawValues.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  const answered = rawValues.length;
  const values = Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: parseFloat(((count / answered) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ar'));

  return { column: question, answered, values };
}

/**
 * يقرأ كل أعمدة البيانات مرة واحدة ويوزعها على ثلاثة مسارات:
 * بنود ليكرت الكمية، متغيرات ديموغرافية توصف العيّنة، وتعليقات نصية.
 */
function parseColumns(data: Record<string, unknown>[], options: ProcessOptions): ParsedData {
  const { questionTypes, commentQuestions } = options;
  const questions = Object.keys(data[0] || {});
  const columns: ParsedColumn[] = [];
  const commentGroups: { question: string; answers: string[] }[] = [];
  const demographics: SampleProfileGroup[] = [];
  const nonQuestionColumns: string[] = [];

  // قائمة أسئلة التعليقات تصل من واجهة مربّعات اختيار تعرض كل الأعمدة،
  // فوجودها — حتى فارغة — يعني أن المستخدم حسم أمر كل عمود.
  const hasExplicitCommentSelection = Array.isArray(commentQuestions);

  const textValuesOf = (question: string): string[] =>
    data
      .map((row) => row[question])
      .filter((v) => v !== undefined && v !== null && v !== '')
      .map((v) => String(v).trim())
      .filter(Boolean);

  questions.forEach((question, index) => {
    const qType = questionTypes?.[question];

    // سؤال حدّده المستخدم كتعليق — يخرج من التحليل الكمي كلياً
    if (commentQuestions?.includes(question)) {
      const texts = textValuesOf(question);
      if (texts.length > 0) commentGroups.push({ question, answers: texts });
      return;
    }

    if (qType && DEMOGRAPHIC_TYPES.includes(qType)) {
      const group = buildDemographicGroup(question, textValuesOf(question));
      if (group) demographics.push(group);
      return;
    }

    if (qType && EXCLUDED_TYPES.includes(qType)) return;

    if (qType && TEXT_TYPES.includes(qType)) {
      const texts = textValuesOf(question);
      if (texts.length > 0 && !hasExplicitCommentSelection) {
        commentGroups.push({ question, answers: texts });
      }
      return;
    }

    const values: number[] = [];
    const rowValues: Array<number | null> = [];
    const textAnswers: string[] = [];
    const outOfScale: number[] = [];
    let missing = 0;

    const pushNumber = (num: number) => {
      if (num >= ANALYSIS_SCALE.min && num <= ANALYSIS_SCALE.max) {
        values.push(num);
        rowValues.push(num);
      } else {
        outOfScale.push(num);
        rowValues.push(null);
      }
    };

    data.forEach((row) => {
      const val = row[question];
      if (val === undefined || val === null || val === '') {
        missing += 1;
        rowValues.push(null);
        return;
      }

      if (typeof val === 'number') {
        pushNumber(val);
        return;
      }

      const cleanVal = String(val).trim();
      if (!cleanVal) {
        missing += 1;
        rowValues.push(null);
        return;
      }

      const mapped = options.questionValueMaps?.[question]?.[cleanVal] ?? LIKERT_MAP[cleanVal];
      if (mapped !== undefined) {
        pushNumber(mapped);
        return;
      }

      const num = parseFloat(cleanVal);
      if (!Number.isNaN(num)) {
        pushNumber(num);
      } else {
        textAnswers.push(cleanVal);
        rowValues.push(null);
      }
    });

    if (values.length > 0 || outOfScale.length > 0) {
      const declaredLikert = qType === LIKERT_TYPE;
      const outOfScaleShare = outOfScale.length / (values.length + outOfScale.length);
      if (!declaredLikert && outOfScaleShare > MAX_OUT_OF_SCALE_SHARE) {
        nonQuestionColumns.push(question);
        return;
      }

      columns.push({
        question,
        questionNumber: questionNumberFrom(question, index),
        values,
        rowValues,
        missing,
        outOfScale,
      });
      return;
    }

    // عمود نصي بلا نوع معلن — مصدره ملف Excel. عدد فئات صغير يعني متغيراً
    // ديموغرافياً (النوع، المستوى، الشعبة)؛ النصوص الطويلة المتنوعة تعليقات.
    if (textAnswers.length > 0) {
      const distinct = new Set(textAnswers);
      const looksCategorical =
        distinct.size <= MAX_DEMOGRAPHIC_CATEGORIES &&
        Array.from(distinct).every((label) => label.length <= MAX_DEMOGRAPHIC_LABEL_LENGTH);

      if (looksCategorical) {
        const group = buildDemographicGroup(question, textAnswers);
        if (group) demographics.push(group);
      } else if (!hasExplicitCommentSelection) {
        commentGroups.push({ question, answers: textAnswers });
      }
    }
  });

  return { columns, commentGroups, demographics, nonQuestionColumns };
}

/** يحوّل عموداً مقروءاً إلى نتيجة سؤال كاملة الإحصاءات على السُّلَّم الخماسي */
function buildQuestionResult(
  column: ParsedColumn,
  totalRespondents: number,
  isReversed: boolean
): QuestionResult {
  const { min: scaleMin, max: scaleMax } = ANALYSIS_SCALE;
  const values = isReversed
    ? column.values.map((v) => reverseCode(v, scaleMax, scaleMin))
    : column.values;

  const stats = computeDescriptiveStats(values);
  const shares = computeOpinionShares(values, scaleMin, scaleMax);
  // من المجموع لا من stats.mean: المتوسط المعروض مقرَّب لمنزلتين، وضرب خطأ
  // التقريب في مدى السُّلَّم (×25 هنا) كان يزيح المؤشر المعياري حتى 0.13 نقطة
  // فيتناقض مع الوزن النسبي المحسوب من المجموع نفسه.
  const exactMean = stats.count > 0 ? stats.sum / stats.count : scaleMin;

  return {
    question: column.question,
    questionNumber: column.questionNumber,
    count: stats.count,
    mean: stats.mean,
    relativeWeight: computeRelativeWeight(stats.sum, stats.count, scaleMax),
    normalizedScore: computeNormalizedScore(exactMean, scaleMin, scaleMax),
    stdDev: stats.stdDev,
    median: stats.median,
    mode: stats.mode,
    missing: column.missing,
    responseRate:
      totalRespondents > 0
        ? parseFloat(((stats.count / totalRespondents) * 100).toFixed(2))
        : 0,
    scaleMax,
    scaleMin,
    distribution: computeDistribution(values, scaleMax, scaleMin),
    negativeShare: shares.negative,
    neutralShare: shares.neutral,
    positiveShare: shares.positive,
    ...(isReversed ? { isReversed: true } : {}),
  };
}

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

/**
 * يتحقق من صلاحية كل عمود قبل الحساب.
 *
 * لا نصلّح ولا نخمّن: السُّلَّم قرار المصمم لا خاصية في البيانات. سؤال ليكرت
 * ببدائل غير خمس، أو قيمة خارج 1-5، يعني خللاً في النموذج أو في الملف؛
 * وحسابه بصمت ينتج نسبة خاطئة تبدو سليمة تماماً.
 */
function collectErrors(columns: ParsedColumn[], options: ProcessOptions): AnalysisError[] {
  const errors: AnalysisError[] = [];

  columns.forEach((column) => {
    const declaredOptions = options.questionOptionCounts?.[column.question];
    const isLikert = options.questionTypes?.[column.question] === LIKERT_TYPE;

    if (isLikert && declaredOptions !== undefined && declaredOptions !== ANALYSIS_SCALE.points) {
      errors.push({
        code: 'non-standard-likert',
        question: column.question,
        questionNumber: column.questionNumber,
        message:
          `السؤال ${column.questionNumber} «${stripNumberPrefix(column.question)}» مخزَّن بـ ` +
          `${declaredOptions} بدائل بينما التحليل يعتمد ${ANALYSIS_SCALE.label}. ` +
          `عدّل بدائل السؤال في النموذج إلى خمسة ثم أعد التحليل.`,
      });
    }

    if (column.outOfScale.length > 0) {
      const highest = column.outOfScale.reduce(
        (max, value) => (value > max ? value : max),
        -Infinity
      );
      const lowest = column.outOfScale.reduce(
        (min, value) => (value < min ? value : min),
        Infinity
      );
      errors.push({
        code: 'values-out-of-scale',
        question: column.question,
        questionNumber: column.questionNumber,
        message:
          `السؤال ${column.questionNumber} «${stripNumberPrefix(column.question)}» فيه ` +
          `${column.outOfScale.length} قيمة خارج المقياس ${ANALYSIS_SCALE.min}-${ANALYSIS_SCALE.max} ` +
          `(من ${lowest} إلى ${highest}). إن لم يكن سؤال ليكرت فاستبعده بتحديده ضمن أعمدة التعليقات.`,
      });
    }
  });

  return errors;
}

/** استبعادات موثقة داخل التقرير لا توقفه */
function collectExclusionWarnings(
  options: ProcessOptions,
  nonQuestionColumns: string[]
): AnalysisWarning[] {
  const types = options.questionTypes ?? {};
  const numericExclusions: AnalysisWarning[] = nonQuestionColumns.map((question) => ({
    code: 'question-excluded' as const,
    question,
    message:
      `استُبعد العمود «${stripNumberPrefix(question)}» لأن أغلب قيمه خارج المقياس ` +
      `${ANALYSIS_SCALE.min}-${ANALYSIS_SCALE.max}، فهو ليس بند قياس.`,
  }));

  return numericExclusions.concat(
    Object.entries(types)
      .filter(
        ([question, type]) =>
          EXCLUDED_TYPES.includes(type) && !options.commentQuestions?.includes(question)
      )
      .map(([question]) => ({
        code: 'question-excluded' as const,
        question,
        message:
          `استُبعد «${stripNumberPrefix(question)}» من التحليل الكمي لأنه ليس سؤال ليكرت خماسياً؛ ` +
          `المتوسط العام يقتصر على بنود ${ANALYSIS_SCALE.label}.`,
      }))
  );
}

/**
 * النواة الحسابية: تُستدعى مرة للتقرير كله، ومرة لكل فئة عند بناء جدول المقارنة.
 * لذلك لا تعرف شيئاً عن المحاور ولا عن النصوص التفسيرية.
 */
function computeCore(data: Record<string, unknown>[], options: ProcessOptions) {
  const totalRespondents = data.length;
  const { columns, commentGroups, demographics, nonQuestionColumns } = parseColumns(data, options);
  const reversed = new Set(options.reversedQuestions ?? []);

  const scoredColumns: ScoredColumn[] = columns
    .filter((column) => column.values.length > 0)
    .map((column) => {
      const isReversed = reversed.has(column.question);
      return {
        result: buildQuestionResult(column, totalRespondents, isReversed),
        rowValues: column.rowValues.map((value) =>
          value !== null && isReversed
            ? reverseCode(value, ANALYSIS_SCALE.max, ANALYSIS_SCALE.min)
            : value
        ),
      };
    });

  const results = scoredColumns
    .map((column) => column.result)
    .sort((a, b) => a.questionNumber - b.questionNumber);
  const reliability = reliabilityForColumns(scoredColumns);

  const meanOf = (pick: (item: QuestionResult) => number) =>
    results.length > 0
      ? parseFloat((results.reduce((sum, item) => sum + pick(item), 0) / results.length).toFixed(2))
      : 0;

  return {
    columns,
    results,
    overallAverage: meanOf((item) => item.relativeWeight),
    overallNormalized: meanOf((item) => item.normalizedScore),
    totalRespondents,
    commentGroups,
    demographics,
    nonQuestionColumns,
    scoredColumns,
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
  options: ProcessOptions
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
    const core = computeCore(categoryRows, scopedOptions);
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

  const empty: ProcessResult = {
    results: [],
    resultsForAnalysis: [],
    overallAverage: 0,
    overallNormalized: 0,
    axes: currentAxes,
    autoComment: generateAutoComment([], 0, currentAxes),
    comments: [],
    sampleProfile: [],
    totalRespondents: 0,
    overallCronbachAlpha: undefined,
    cronbachRespondents: undefined,
    comparison: undefined,
    recommendations: [],
    analysisWarnings: [],
    analysisErrors: [],
  };

  if (!data || data.length === 0) return empty;

  const core = computeCore(data, options);
  const errors = collectErrors(core.columns, options);

  if (core.results.length === 0) {
    errors.push({
      code: 'no-likert-questions',
      message: `لا توجد بنود ${ANALYSIS_SCALE.label} صالحة للتحليل في هذه البيانات.`,
    });
  }

  // خطأ واحد يكفي لإيقاف التقرير: نتيجة محسوبة على سُلَّم خاطئ أسوأ من غياب
  // التقرير، لأنها تبدو صحيحة ولا شيء في الصفحة يكشف الخلل.
  if (errors.length > 0) {
    return { ...empty, totalRespondents: core.totalRespondents, analysisErrors: errors };
  }

  const resultsForAnalysis = assignCompetitionRanks(core.results, (r) => r.relativeWeight);
  // الرتبة تُنسخ إلى الجدول المرتب برقم السؤال حتى يظهر العمودان متسقين
  const rankByQuestion = new Map(resultsForAnalysis.map((r) => [r.question, r.rank]));
  const results = core.results.map((r) => ({ ...r, rank: rankByQuestion.get(r.question) }));

  const axesWithAverages =
    currentAxes.length > 0 ? processAxesAverages(results, currentAxes) : currentAxes;
  const axes = axesWithAverages.map((axis) => {
    const axisColumns = core.scoredColumns.filter((column) =>
      questionBelongsToAxis(column.result, axis)
    );
    const reliability = reliabilityForColumns(axisColumns);
    return reliability
      ? {
          ...axis,
          cronbachAlpha: reliability.alpha,
          reliabilityRespondents: reliability.respondents,
        }
      : axis;
  });
  const axisWarnings: AnalysisWarning[] = axes
    .filter((axis) => !axis.count)
    .map((axis) => ({
      code: 'empty-axis',
      message: `المحور «${axis.name}» لا يطابق أي سؤال محلل.`,
    }));

  const comments = aggregateCommentGroups(core.commentGroups);
  const comparison = computeCategoryComparison(data, axes, options);

  const summary = {
    results,
    resultsForAnalysis,
    overallAverage: core.overallAverage,
    overallNormalized: core.overallNormalized,
    axes,
    comments,
    sampleProfile: core.demographics,
    totalRespondents: core.totalRespondents,
    overallCronbachAlpha: core.reliability?.alpha,
    cronbachRespondents: core.reliability?.respondents,
    comparison,
  };

  return {
    ...summary,
    autoComment: generateAutoComment(resultsForAnalysis, core.overallAverage, axes),
    // التوصيات تُبنى أخيراً لأنها تقرأ كل ما سبق: البنود والمحاور والمقارنة
    // والتعليقات معاً. بناؤها داخل الحساب كان سيجعلها ترى نصف الصورة.
    recommendations: buildRecommendations(summary as unknown as ReportData),
    analysisWarnings: [
      ...collectExclusionWarnings(options, core.nonQuestionColumns),
      ...axisWarnings,
    ],
    analysisErrors: [],
  };
}

function questionBelongsToAxis(item: QuestionResult, axis: Axis): boolean {
  if (axis.questionNumbers?.length) return axis.questionNumbers.includes(item.questionNumber);
  return item.questionNumber >= axis.start && item.questionNumber <= axis.end;
}

export function processAxesAverages(results: QuestionResult[], axes: Axis[]): Axis[] {
  const withAverages = axes.map((axis) => {
    const axisQuestions = results.filter((item) => questionBelongsToAxis(item, axis));
    const mean = (pick: (item: QuestionResult) => number) =>
      parseFloat(
        (axisQuestions.length > 0
          ? axisQuestions.reduce((sum, item) => sum + pick(item), 0) / axisQuestions.length
          : 0
        ).toFixed(2)
      );

    return {
      ...axis,
      average: mean((item) => item.relativeWeight),
      normalizedAverage: mean((item) => item.normalizedScore),
      count: axisQuestions.length,
    };
  });

  return assignCompetitionRanks(withAverages, (axis) => axis.average);
}

/**
 * الأسئلة التي انقسم الرأي حولها: طرفا التوزيع معاً فوق العتبة.
 *
 * مرتبة تنازلياً حسب الطرف الأصغر، لأن أشدّ انقسام هو ما تتقارب فيه الكتلتان
 * لا ما يكبر فيه أحد الطرفين وحده.
 */
export function getPolarizedQuestions(results: QuestionResult[]): QuestionResult[] {
  return results
    .filter(
      (item) =>
        item.count > 0 &&
        item.negativeShare >= POLARIZATION.endShare &&
        item.positiveShare >= POLARIZATION.endShare
    )
    .sort(
      (a, b) =>
        Math.min(b.negativeShare, b.positiveShare) - Math.min(a.negativeShare, a.positiveShare)
    );
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

export function generateAutoComment(
  results: QuestionResult[],
  average: number,
  axes: Axis[]
): string {
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
  const polarized = getPolarizedQuestions(results);

  const perfComment =
    average >= 85 ? 'أداء متميز' : average >= 70 ? 'أداء جيد' : 'أداء يحتاج إلى تحسين';

  let comment = `
    <div class="detailed-analysis bg-green-50/50 border-r-4 border-green-700 p-4 rounded-xl my-4 text-gray-800 dark:text-gray-200 dark:bg-green-900/20">
      <h4 class="font-bold mb-2">تحليل النتائج</h4>
      <p>بلغ المتوسط العام ${average}% مما يشير إلى ${perfComment}.</p>
      <p>أعلى سؤال تقييماً هو "${escapeHtml(highest.question)}" (رقم ${highest.questionNumber}) بنسبة ${highest.relativeWeight}%.</p>
      <p>أقل سؤال تقييماً هو "${escapeHtml(lowest.question)}" (رقم ${lowest.questionNumber}) بنسبة ${lowest.relativeWeight}%.</p>`;

  if (strengths.length > 0) {
    comment += `<p><b>نقاط القوة (أعلى من ${NARRATIVE_THRESHOLDS.strength}%):</b> الأسئلة ${strengths
      .slice(0, 5)
      .join(', ')}.</p>`;
  }
  if (weaknesses.length > 0) {
    comment += `<p><b>نقاط تحتاج لتحسين (أقل من ${NARRATIVE_THRESHOLDS.weakness}%):</b> الأسئلة ${weaknesses
      .slice(0, 5)
      .map((r) => r.questionNumber)
      .join(', ')}.</p>`;
  }

  // الانقسام لا يظهر في المتوسط إطلاقاً: نصف رافض ونصف موافق يعطي نفس متوسط
  // عيّنة كلها محايدة. لذلك يُذكر صراحةً بنسبتي الطرفين لا بالانحراف المعياري،
  // الذي لا يقول شيئاً للقارئ غير المتخصص.
  if (polarized.length > 0) {
    const sample = polarized.slice(0, 3);
    comment += `<p><b>انقسام في الآراء (${polarized.length} ${
      polarized.length === 1 ? 'سؤال' : 'أسئلة'
    }):</b> ${sample
      .map(
        (r) =>
          `السؤال ${r.questionNumber} (${r.negativeShare}% غير موافق مقابل ${r.positiveShare}% موافق)`
      )
      .join('، ')}. المتوسط وحده لا يكشف هذه الأسئلة، وتفاصيلها في قسم انقسام الآراء.</p>`;
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

  return comment;
}
